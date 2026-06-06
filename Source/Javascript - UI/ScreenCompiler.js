// ScreenCompiler.js

const DEBUG_COMPILER = false;

class ScreenCompiler
{
    compile(screen)
    {
        var ok = false;

        if (!screen.node)
        {
            screen.add_error("missing-screen-node", "screen has no source node");

            return {
                ok: false,
                code: "missing-screen-node",
                message: "screen has no source node"
            };
        }

        screen.reset_runtime_data();

        screen.target = get_target();
        screen.ui_state.target = screen.target;

        screen.layouts = this.read_layouts(screen.node);
        this.collect_layout_diagnostics(screen, screen.layouts);

        this.debug_compile(screen);

        ok = !screen.has_errors();

        return {
            ok: ok,
            code: ok ? "ok" : "screen-compile-failed",
            message: ok ? "screen compiled" : "screen compiled with errors"
        };
    }

    debug_compile(screen)
    {
        var child_count = this.get_layout_children(screen.node).length;

        if (!DEBUG_COMPILER || typeof osc_send !== "function")
        {
            return;
        }

        osc_send("/debug", [
            "COMPILERDBG screen=" + (screen.screen_name || "") +
            " orientation=" + (screen.orientation || "") +
            " children=" + child_count +
            " layouts=" + Object.keys(screen.layouts || {}).length
        ]);
    }

    collect_layout_diagnostics(screen, layouts)
    {
        var key;
        var layout_object;
        var i;

        for (key in layouts)
        {
            if (!Object.prototype.hasOwnProperty.call(layouts, key))
            {
                continue;
            }

            layout_object = layouts[key];

            if (!layout_object)
            {
                continue;
            }

            if (layout_object.warnings)
            {
                for (i = 0; i < layout_object.warnings.length; i++)
                {
                    screen.warnings.push(layout_object.warnings[i]);
                }
            }

            if (layout_object.errors)
            {
                for (i = 0; i < layout_object.errors.length; i++)
                {
                    screen.errors.push(layout_object.errors[i]);
                }
            }
        }
    }

    read_layouts(scope)
    {
        var layouts = {};
        var layouts_node;
        var nodes;
        var i;
        var n;
        var id;
        var layout_object;

        if (!scope)
        {
            return layouts;
        }

        layouts_node = this.get_direct_child(scope, "layouts");

        if (!layouts_node)
        {
            return layouts;
        }

        nodes = layouts_node.children;

        for (i = 0; i < nodes.length; i++)
        {
            n = nodes[i];

            if (this.tag(n) !== "layout")
            {
                continue;
            }

            id = n.getAttribute("id");

            if (!id)
            {
                continue;
            }

            layout_object = new ScreenLayout(n);
            layouts[id] = layout_object;
        }

        return layouts;
    }

    merge_layouts(base_layouts, local_layouts)
    {
        var out = {};
        var k;

        for (k in base_layouts)
        {
            if (base_layouts.hasOwnProperty(k))
            {
                out[k] = base_layouts[k];
            }
        }

        for (k in local_layouts)
        {
            if (local_layouts.hasOwnProperty(k))
            {
                out[k] = local_layouts[k];
            }
        }

        return out;
    }

    get_layout_children(node)
    {
        var nodes;
        var out = [];
        var i;
        var tag;

        if (!node || !node.children)
        {
            return out;
        }

        nodes = node.children;

        for (i = 0; i < nodes.length; i++)
        {
            tag = this.tag(nodes[i]);

            if (tag === "layouts" || tag === "layout")
            {
                continue;
            }

            if (tag === "region" || tag === "widget")
            {
                out.push(nodes[i]);
            }
        }

        return out;
    }

    calculate_region_metrics(child_nodes, orientation, total_primary, gap)
    {
        var sizes = [];
        var fixed_size = 0;
        var star_items = [];
        var star_weight = 0;
        var total_gaps = 0;
        var remaining = 0;
        var unit = 0;
        var remainder = 0;
        var i;
        var attr_name = orientation === "horizontal" ? "width" : "height";
        var value = "";
        var weight = 0;
        var fixed = 0;

        gap = parse_integer(gap, 0);
        total_gaps = Math.max(0, child_nodes.length - 1) * gap;

        for (i = 0; i < child_nodes.length; i++)
        {
            value = child_nodes[i].getAttribute(attr_name) || "*";
            weight = this.get_star_weight(value);

            if (weight > 0)
            {
                sizes[i] = 0;
                star_items.push({ index: i, weight: weight });
                star_weight += weight;
                continue;
            }

            fixed = parse_integer(value, 0);
            sizes[i] = fixed;
            fixed_size += fixed;
        }

        remaining = total_primary - fixed_size - total_gaps;

        if (remaining < 0)
        {
            remaining = 0;
        }

        if (star_weight > 0)
        {
            unit = Math.floor(remaining / star_weight);
            remainder = remaining - (unit * star_weight);

            for (i = 0; i < star_items.length; i++)
            {
                sizes[star_items[i].index] = unit * star_items[i].weight;

                while (remainder > 0 && star_items[i].weight > 0)
                {
                    sizes[star_items[i].index] += 1;
                    remainder -= 1;
                    star_items[i].weight -= 1;
                }
            }
        }

        return {
            gap: gap,
            sizes: sizes
        };
    }

    get_star_weight(value)
    {
        var text = String(value || "");
        var matches;

        if (text === "")
        {
            return 1;
        }

        matches = text.match(/\*/g);

        if (!matches || matches.length <= 0)
        {
            return 0;
        }

        return matches.length;
    }

    get_direct_child_by_id(container, id)
    {
        var nodes;
        var i;
        var n;

        if (!container || !container.children)
        {
            return null;
        }

        nodes = container.children;

        for (i = 0; i < nodes.length; i++)
        {
            n = nodes[i];

            if ((n.getAttribute("id") || "") === id)
            {
                return n;
            }
        }

        return null;
    }

    get_direct_child(node, tag_name)
    {
        var nodes;
        var i;

        if (!node || !node.children)
        {
            return null;
        }

        nodes = node.children;

        for (i = 0; i < nodes.length; i++)
        {
            if (this.tag(nodes[i]) === tag_name)
            {
                return nodes[i];
            }
        }

        return null;
    }

    get_direct_children(node, tag_name)
    {
        var nodes;
        var out = [];
        var i;

        if (!node || !node.children)
        {
            return out;
        }

        nodes = node.children;

        for (i = 0; i < nodes.length; i++)
        {
            if (this.tag(nodes[i]) === tag_name)
            {
                out.push(nodes[i]);
            }
        }

        return out;
    }

    get_direct_widget_defs(container)
    {
        var widgets = [];

        if (!container)
        {
            return widgets;
        }

        widgets = this.get_direct_children(container, "widget");
        return this.wrap_widget_nodes(widgets, container);
    }

    wrap_widget_node(widget_node, inherited_type, owner_node)
    {
        return new WidgetDefAdapter(widget_node, inherited_type || "", owner_node || null);
    }

    wrap_widget_nodes(widget_nodes, source_node)
    {
        var out = [];
        var i;
        var node;
        var inherited_type = "";

        inherited_type = this.node_type_or_empty(source_node);

        for (i = 0; i < widget_nodes.length; i++)
        {
            node = widget_nodes[i];
            out.push(new WidgetDefAdapter(node, inherited_type, source_node));
        }

        return out;
    }

    node_type_or_empty(n)
    {
        if (!n)
        {
            return "";
        }

        return n.getAttribute("type") || "";
    }

    find_layout_node(start_node, layout_id)
    {
        var current = start_node;
        var layouts_node;
        var layout_node;

        while (current)
        {
            layouts_node = this.get_direct_child(current, "layouts");

            if (layouts_node)
            {
                layout_node = this.get_direct_child_by_id(layouts_node, layout_id);

                if (layout_node && this.tag(layout_node) === "layout")
                {
                    return layout_node;
                }
            }

            current = current.parentElement;
        }

        return null;
    }

    get_effective_gap(source, owner, layout)
    {
        var gap_attr = source ? source.getAttribute("gap") : null;

        if (gap_attr === null && owner)
        {
            gap_attr = owner.getAttribute("gap");
        }

        if (gap_attr === null)
        {
            return parse_integer(layout ? layout.gap : 0, 0);
        }

        return parse_integer(gap_attr, parse_integer(layout ? layout.gap : 0, 0));
    }

    get_effective_bleed(source, owner, layout, side)
    {
        if (side === "middle")
        {
            return 2;
        }

        return 0;
    }

    calculate_widget_positions(total_width, count, widget_gap, left_bleed, right_bleed, middle_bleed)
    {
        var positions = [];
        var usable_width;
        var total_gap;
        var widget_width;
        var remainder;
        var widths = [];
        var x;
        var i;
        var left_index;
        var right_index;
        var middle_index;

        if (count <= 0)
        {
            return positions;
        }

        usable_width = total_width - left_bleed - right_bleed;

        if (usable_width < 0)
        {
            usable_width = 0;
        }

        total_gap = widget_gap * (count - 1);

        if (middle_bleed > 0 && count > 1 && (count % 2) === 0)
        {
            total_gap = total_gap - widget_gap + middle_bleed;
        }

        widget_width = Math.floor((usable_width - total_gap) / count);

        if (widget_width < 0)
        {
            widget_width = 0;
        }

        remainder = usable_width - (widget_width * count) - total_gap;

        for (i = 0; i < count; i++)
        {
            widths[i] = widget_width;
        }

        left_index = 0;
        right_index = count - 1;

        while (remainder > 0 && left_index <= right_index)
        {
            widths[left_index] += 1;
            remainder -= 1;

            if (remainder > 0 && right_index !== left_index)
            {
                widths[right_index] += 1;
                remainder -= 1;
            }

            left_index += 1;
            right_index -= 1;
        }

        x = left_bleed;
        middle_index = Math.floor(count / 2) - 1;

        for (i = 0; i < count; i++)
        {
            positions.push(
            {
                x: x,
                width: widths[i]
            });

            x += widths[i];

            if (i < count - 1)
            {
                if (middle_bleed > 0 && (count % 2) === 0 && i === middle_index)
                {
                    x += middle_bleed;
                }
                else
                {
                    x += widget_gap;
                }
            }
        }

        return positions;
    }

    get_widget_slot_span(widget_def)
    {
        var width_attr = "";
        var matches = null;

        if (!widget_def || typeof widget_def.getAttribute !== "function")
        {
            return 1;
        }

        width_attr = widget_def.getAttribute("width") || "";

        if (width_attr === "" || width_attr === "*")
        {
            return 1;
        }

        matches = String(width_attr).match(/\*/g);

        if (!matches || matches.length <= 0)
        {
            return 1;
        }

        return matches.length;
    }

    calculate_widget_positions_for_defs(total_width, widget_defs, expected_count, widget_gap, left_bleed, right_bleed, middle_bleed)
    {
        var positions = [];
        var base_positions = [];
        var total_slots = expected_count;
        var used_slots = 0;
        var span = 1;
        var slot_index = 0;
        var i;
        var j;
        var end_index = 0;
        var x = 0;
        var width = 0;

        if (!widget_defs || widget_defs.length <= 0)
        {
            return positions;
        }

        for (i = 0; i < widget_defs.length; i++)
        {
            used_slots += this.get_widget_slot_span(widget_defs[i]);
        }

        if (used_slots > total_slots)
        {
            total_slots = used_slots;
        }

        base_positions = this.calculate_widget_positions(total_width, total_slots, widget_gap, left_bleed, right_bleed, middle_bleed);

        for (i = 0; i < widget_defs.length; i++)
        {
            span = this.get_widget_slot_span(widget_defs[i]);

            if (span < 1)
            {
                span = 1;
            }

            if (slot_index >= base_positions.length)
            {
                positions.push(
                {
                    x: 0,
                    width: 0
                });
                continue;
            }

            end_index = slot_index + span - 1;

            if (end_index >= base_positions.length)
            {
                end_index = base_positions.length - 1;
            }

            x = base_positions[slot_index].x;
            width = 0;

            for (j = slot_index; j <= end_index; j++)
            {
                if (j === slot_index)
                {
                    width += base_positions[j].width;
                }
                else
                {
                    width = (base_positions[j].x + base_positions[j].width) - x;
                }
            }

            positions.push(
            {
                x: x,
                width: width
            });

            slot_index += span;
        }

        return positions;
    }

    tag(node)
    {
        var tag = String(node && node.tagName ? node.tagName : "").toLowerCase();

        if (tag === "row" || tag === "column" || tag === "spacer")
        {
            return "region";
        }

        return tag;
    }
}

class WidgetDefAdapter
{
    constructor(node, inherited_type, owner_node)
    {
        this.node = node;
        this.inherited_type = inherited_type || "";
        this.owner_node = owner_node || null;
        this.tagName = "div";
        this.virtual = false;
    }

    getAttribute(name)
    {
        var value;

        if (name === "type")
        {
            value = this.node.getAttribute("type");

            if (value !== null && value !== "")
            {
                return value;
            }

            if (this.inherited_type)
            {
                return this.inherited_type;
            }

            return "";
        }

        if (!this.node)
        {
            return null;
        }

        return this.node.getAttribute(name);
    }

    get parentElement()
    {
        return this.node ? this.node.parentElement : null;
    }
}
