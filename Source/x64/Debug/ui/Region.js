// Region.js

const DEBUG_REGION = false;

class Region extends Box
{
    constructor(node, screen)
    {
        super(Region.build_box_spec(node));

        this.node = node || null;
        this.screen = screen || null;

        this.id = "";
        this.path = "";
        this.type = "region";
        this.orientation = "vertical";
        this.gap = undefined;
        this.left_bleed = 0;
        this.right_bleed = 0;
        this.middle_bleed = 0;
        this.top_bleed = 0;
        this.bottom_bleed = 0;

        this.parent_layouts = {};
        this.layouts = {};
        this.children = [];

        this.warnings = [];
        this.errors = [];

        this.has_export_id = false;
        this.export_subtree_enabled = true;

        this.read_region_properties();
        this.export_subtree_enabled = this.has_export_id === true;
    }

    static build_box_spec(node)
    {
        var spec = {};
        var id = "";
        var border = undefined;
        var border_left = undefined;
        var border_top = undefined;
        var border_right = undefined;
        var border_bottom = undefined;
        var border_color = undefined;
        var background_color = undefined;

        if (!node)
        {
            return spec;
        }

        id = node.getAttribute("id") || "region";
        background_color = node.getAttribute("background-color");
        border_color = node.getAttribute("border-color");

        if (node.hasAttribute("border"))
        {
            border = parse_integer(node.getAttribute("border"), 0);
        }

        if (node.hasAttribute("border-left"))
        {
            border_left = parse_integer(node.getAttribute("border-left"), 0);
        }

        if (node.hasAttribute("border-top"))
        {
            border_top = parse_integer(node.getAttribute("border-top"), 0);
        }

        if (node.hasAttribute("border-right"))
        {
            border_right = parse_integer(node.getAttribute("border-right"), 0);
        }

        if (node.hasAttribute("border-bottom"))
        {
            border_bottom = parse_integer(node.getAttribute("border-bottom"), 0);
        }

        spec.id = id;
        spec.path = "";
        spec.background_color = background_color !== null ? background_color : undefined;
        spec.border_color = border_color !== null ? border_color : undefined;

        if (border !== undefined)
        {
            spec.border = border;
        }

        if (border_left !== undefined)
        {
            spec.border_left = border_left;
        }

        if (border_top !== undefined)
        {
            spec.border_top = border_top;
        }

        if (border_right !== undefined)
        {
            spec.border_right = border_right;
        }

        if (border_bottom !== undefined)
        {
            spec.border_bottom = border_bottom;
        }

        return spec;
    }

    read_region_properties()
    {
        var tag = "";

        if (!this.node)
        {
            this.add_error("missing-region-node", "region has no source node");
            return;
        }

        tag = String(this.node.tagName || "").toLowerCase();

        this.has_export_id = this.node.hasAttribute("id") && (this.node.getAttribute("id") || "") !== "";
        this.id = this.node.getAttribute("id") || "region";
        this.path = "";
        this.type = "region";
        this.orientation = this.node.getAttribute("orientation") || "vertical";

        if (this.node.hasAttribute("gap"))
        {
            this.gap = parse_integer(this.node.getAttribute("gap"), 0);
        }

        if (tag === "row")
        {
            this.orientation = "horizontal";
        }
        else if (tag === "column")
        {
            this.orientation = "vertical";
        }
        else if (tag === "spacer")
        {
            if (this.node.hasAttribute("height"))
            {
                this.orientation = "horizontal";
            }
            else if (this.node.hasAttribute("width"))
            {
                this.orientation = "vertical";
            }
        }

        this.background_color = this.node.getAttribute("background-color") || undefined;

        if (this.node.hasAttribute("border"))
        {
            this.border = parse_integer(this.node.getAttribute("border"), this.border !== undefined ? this.border : 0);
        }

        if (this.node.hasAttribute("border-left"))
        {
            this.border_left = parse_integer(this.node.getAttribute("border-left"), this.border_left !== undefined ? this.border_left : 0);
        }

        if (this.node.hasAttribute("border-top"))
        {
            this.border_top = parse_integer(this.node.getAttribute("border-top"), this.border_top !== undefined ? this.border_top : 0);
        }

        if (this.node.hasAttribute("border-right"))
        {
            this.border_right = parse_integer(this.node.getAttribute("border-right"), this.border_right !== undefined ? this.border_right : 0);
        }

        if (this.node.hasAttribute("border-bottom"))
        {
            this.border_bottom = parse_integer(this.node.getAttribute("border-bottom"), this.border_bottom !== undefined ? this.border_bottom : 0);
        }

        if (this.node.hasAttribute("border-color"))
        {
            this.border_color = this.node.getAttribute("border-color") || this.border_color;
        }

        if (!this.id)
        {
            this.add_warning("missing-region-id", "region has no id");
        }
    }

    add_warning(code, message)
    {
        this.warnings.push(
        {
            code: code || "warning",
            message: message || ""
        });
    }

    add_error(code, message)
    {
        this.errors.push(
        {
            code: code || "error",
            message: message || ""
        });
    }

    add_diagnostics(source)
    {
        var i;

        if (!source)
        {
            return;
        }

        if (source.warnings)
        {
            for (i = 0; i < source.warnings.length; i++)
            {
                this.warnings.push(source.warnings[i]);
            }
        }

        if (source.errors)
        {
            for (i = 0; i < source.errors.length; i++)
            {
                this.errors.push(source.errors[i]);
            }
        }
    }

    has_errors()
    {
        return this.errors.length > 0;
    }

    clear_runtime_data()
    {
        this.setRect(0, 0, 0, 0);

        this.parent_layouts = {};
        this.layouts = {};
        this.children = [];

        this.warnings = [];
        this.errors = [];

        this.has_export_id = false;
        this.export_subtree_enabled = true;

        this.read_region_properties();
        this.export_subtree_enabled = this.has_export_id === true;
    }

    set_geometry(xpos, ypos, width, height)
    {
        this.setRect(xpos, ypos, width, height);

        if (this.width < 0)
        {
            this.add_warning("region-width-adjusted", "region width adjusted from negative value to 0");
            this.width = 0;
        }

        if (this.height < 0)
        {
            this.add_warning("region-height-adjusted", "region height adjusted from negative value to 0");
            this.height = 0;
        }

        this.updateInnerRect();
    }

    read_local_layouts()
    {
        var compiler = this.screen ? this.screen.compiler : null;

        if (!compiler || typeof compiler.read_layouts !== "function")
        {
            this.add_error("missing-layout-reader", "screen.compiler.read_layouts() is not available");
            return {};
        }

        return compiler.read_layouts(this.node);
    }

    merge_layout_tables(parent_layouts, local_layouts)
    {
        var compiler = this.screen ? this.screen.compiler : null;

        if (!compiler || typeof compiler.merge_layouts !== "function")
        {
            this.add_error("missing-layout-merger", "screen.compiler.merge_layouts() is not available");
            return local_layouts || {};
        }

        return compiler.merge_layouts(parent_layouts || {}, local_layouts || {});
    }

    ensure_layouts_ready()
    {
        var local_layouts;

        if (this.layouts && Object.keys(this.layouts).length > 0)
        {
            return;
        }

        local_layouts = this.read_local_layouts();
        this.layouts = this.merge_layout_tables(this.parent_layouts || {}, local_layouts);
    }

    ensure_children_ready()
    {
        if (this.children && this.children.length > 0)
        {
            return;
        }

        this.ensure_layouts_ready();
        this.children = this.build_children();
    }

    get_region_layout()
    {
        var layout_name = this.node ? (this.node.getAttribute("layout") || "") : "";

        if (!layout_name)
        {
            return null;
        }

        this.ensure_layouts_ready();

        return this.layouts[layout_name] || null;
    }

    parse(parent_layouts, xpos, ypos, width, height, parent_path, parent_export_subtree_enabled)
    {
        var local_layouts;

        this.clear_runtime_data();
        this.export_subtree_enabled = (parent_export_subtree_enabled === true && this.has_export_id === true);
        this.set_geometry(xpos, ypos, width, height);

        this.path = join_path(parent_path || "", this.id || "region");
        this.parent_layouts = parent_layouts || {};
        local_layouts = this.read_local_layouts();
        this.layouts = this.merge_layout_tables(this.parent_layouts, local_layouts);
        this.children = this.build_children();
    }

    build_children()
    {
        var compiler = this.screen ? this.screen.compiler : null;
        var child_nodes = [];
        var positions = [];
        var children = [];
        var available_x = this.xpos + this.inner_x;
        var available_y = this.ypos + this.inner_y;
        var available_width = this.inner_width;
        var available_height = this.inner_height;
        var i;
        var node;
        var tag;
        var child;

        if (!compiler || typeof compiler.get_layout_children !== "function")
        {
            this.add_error("missing-child-reader", "screen.compiler.get_layout_children() is not available");
            return children;
        }

        child_nodes = compiler.get_layout_children(this.node) || [];
        positions = this.calculate_child_positions(child_nodes, available_x, available_y, available_width, available_height);

        this.debug_region_layout(child_nodes, positions);

        for (i = 0; i < child_nodes.length; i++)
        {
            node = child_nodes[i];
            tag = compiler.tag(node);

            if (tag === "region")
            {
                child = this.create_region_child(node, positions[i]);
            }
            else
            {
                child = this.create_widget_child(node, String(i), positions[i]);
            }

            if (child)
            {
                children.push(child);
            }
        }

        return children;
    }

    calculate_child_positions(child_nodes, xpos, ypos, width, height)
    {
        var compiler = this.screen ? this.screen.compiler : null;
        var layout = this.get_region_layout();
        var primary_size = this.orientation === "horizontal" ? width : height;
        var cross_size = this.orientation === "horizontal" ? height : width;
        var gap = 0;
        var left_bleed = 0;
        var right_bleed = 0;
        var middle_bleed = 0;
        var metrics;
        var positions = [];
        var slot_positions = [];
        var cursor = 0;
        var i;
        var primary;
        var node;
        var pos;

        if (!compiler)
        {
            this.add_error("missing-region-compiler", "screen.compiler is not available");
            return positions;
        }

        gap = compiler.get_effective_gap ? compiler.get_effective_gap(null, this.node, layout) : parse_integer(this.node ? this.node.getAttribute("gap") : 0, 0);
        this.gap = gap;

        if (compiler.get_effective_bleed)
        {
            left_bleed = compiler.get_effective_bleed(null, this.node, layout || {}, "left");
            right_bleed = compiler.get_effective_bleed(null, this.node, layout || {}, "right");
            middle_bleed = compiler.get_effective_bleed(null, this.node, layout || {}, "middle");
        }
        else if (layout)
        {
            left_bleed = layout.left_bleed || 0;
            right_bleed = layout.right_bleed || 0;
            middle_bleed = layout.middle_bleed || 0;
        }

        this.left_bleed = left_bleed;
        this.right_bleed = right_bleed;
        this.middle_bleed = middle_bleed;

        if (this.orientation === "horizontal" && layout && this.children_are_regions(child_nodes) && typeof compiler.calculate_widget_positions === "function")
        {
            slot_positions = compiler.calculate_widget_positions(
                width,
                Math.min(layout.widget_count || child_nodes.length, child_nodes.length),
                gap,
                left_bleed,
                right_bleed,
                middle_bleed
            );

            for (i = 0; i < child_nodes.length; i++)
            {
                pos = slot_positions[i] || { x: 0, width: 0 };

                positions.push(
                {
                    x: xpos + pos.x,
                    y: ypos,
                    width: pos.width,
                    height: cross_size
                });
            }

            return positions;
        }

        if (this.orientation === "horizontal" && layout && typeof compiler.calculate_widget_positions_for_defs === "function")
        {
            slot_positions = compiler.calculate_widget_positions_for_defs(
                width,
                child_nodes,
                layout.widget_count || child_nodes.length,
                gap,
                left_bleed,
                right_bleed,
                middle_bleed
            );

            for (i = 0; i < child_nodes.length; i++)
            {
                pos = slot_positions[i] || { x: 0, width: 0 };

                positions.push(
                {
                    x: xpos + pos.x,
                    y: ypos,
                    width: pos.width,
                    height: cross_size
                });
            }

            return positions;
        }

        if (!compiler || typeof compiler.calculate_region_metrics !== "function")
        {
            this.add_error("missing-region-metrics", "screen.compiler.calculate_region_metrics() is not available");
            return positions;
        }

        metrics = compiler.calculate_region_metrics(child_nodes, this.orientation, primary_size, gap);

        for (i = 0; i < child_nodes.length; i++)
        {
            node = child_nodes[i];
            primary = metrics.sizes[i] || 0;

            if (this.orientation === "horizontal")
            {
                pos = {
                    x: xpos + cursor,
                    y: ypos,
                    width: primary,
                    height: cross_size
                };
            }
            else
            {
                pos = {
                    x: xpos,
                    y: ypos + cursor,
                    width: cross_size,
                    height: primary
                };
            }

            positions.push(pos);
            cursor += primary;

            if (i < child_nodes.length - 1)
            {
                cursor += metrics.gap;
            }
        }

        return positions;
    }

    children_are_regions(child_nodes)
    {
        var compiler = this.screen ? this.screen.compiler : null;
        var i;

        if (!child_nodes || child_nodes.length <= 0 || !compiler || typeof compiler.tag !== "function")
        {
            return false;
        }

        for (i = 0; i < child_nodes.length; i++)
        {
            if (compiler.tag(child_nodes[i]) !== "region")
            {
                return false;
            }
        }

        return true;
    }

    create_region_child(region_node, position)
    {
        var child_region = new Region(region_node, this.screen);

        child_region.parse(
            this.layouts,
            position.x,
            position.y,
            position.width,
            position.height,
            this.path,
            this.export_subtree_enabled
        );

        this.add_diagnostics(child_region);
        return child_region;
    }

    create_widget_child(widget_node, widget_index, position)
    {
        var screen = this.screen;
        var compiler = this.screen ? this.screen.compiler : null;
        var region_layout_name = this.node ? (this.node.getAttribute("layout") || "") : "";
        var layout_name = widget_node.getAttribute("layout") || region_layout_name;
        var layout = layout_name ? this.layouts[layout_name] || null : null;
        var widget_def = null;
        var type = "panel";
        var final_widget_id = widget_index;
        var entry_path = "";
        var box_spec = null;
        var widget_spec = null;
        var widget = null;

        if (!screen || typeof screen.build_box_spec !== "function" || typeof screen.build_widget_spec !== "function")
        {
            this.add_error("missing-widget-builders", "screen widget build helpers are not available");
            return null;
        }

        if (!compiler || typeof compiler.wrap_widget_node !== "function")
        {
            this.add_error("missing-widget-adapter", "screen.compiler.wrap_widget_node() is not available");
            return null;
        }

        widget_def = compiler.wrap_widget_node(widget_node, this.node ? (this.node.getAttribute("type") || "") : "", this.node);
        type = this.get_widget_type(widget_def);

        if (typeof screen.build_unique_widget_id === "function")
        {
            final_widget_id = screen.build_unique_widget_id(this.node, widget_def, type, widget_index);
        }

        entry_path = join_path(this.path, final_widget_id);
        box_spec = screen.build_box_spec(screen.node, this.node, layout, this.node, widget_def, entry_path, position.x, position.y, position.width, position.height);
        this.restore_layout_border_color(box_spec, layout, widget_node);
        widget_spec = screen.build_widget_spec(screen.node, this.node, layout, this.node, widget_def, type, entry_path, box_spec, final_widget_id);

        if (typeof screen.copy_box_spec_to_widget_spec === "function")
        {
            screen.copy_box_spec_to_widget_spec(widget_spec, box_spec);
        }

        widget = WidgetFactory.create(widget_spec);
        widget.export_enabled = (this.export_subtree_enabled === true && widget_def && !widget_def.virtual && (widget_def.getAttribute("id") || "") !== "");

        this.debug_widget_entry(final_widget_id, type, position);

        return widget;
    }

    restore_layout_border_color(box_spec, layout, widget_node)
    {
        if (!box_spec || !layout || layout.border_color === undefined)
        {
            return;
        }

        if (this.node && this.node.hasAttribute && this.node.hasAttribute("border-color"))
        {
            return;
        }

        if (widget_node && widget_node.hasAttribute && widget_node.hasAttribute("border-color"))
        {
            return;
        }

        box_spec.border_color = layout.border_color;
    }

    get_widget_type(def)
    {
        var type = "";

        if (!def)
        {
            return "panel";
        }

        if (def.virtual === true)
        {
            return def.type || "panel";
        }

        type = def.getAttribute ? def.getAttribute("type") : "";

        if (!type)
        {
            type = (def.tagName || "").toLowerCase();
        }

        if (!type || type === "div" || type === "region" || type === "widget")
        {
            type = "panel";
        }

        return type;
    }

    debug_region_layout(child_nodes, positions)
    {
        if (!DEBUG_REGION || typeof osc_send !== "function")
        {
            return;
        }

        osc_send("/debug", [
            "REGIONDBG id=" + (this.id || "") +
            " path=" + (this.path || "") +
            " orientation=" + this.orientation +
            " layout=" + (this.node ? (this.node.getAttribute("layout") || "") : "") +
            " children=" + child_nodes.length +
            " rect=" + this.xpos + "," + this.ypos + "," + this.width + "," + this.height +
            " inner=" + this.inner_width + "x" + this.inner_height
        ]);
    }

    debug_widget_entry(widget_id, type, position)
    {
        if (!DEBUG_REGION || typeof osc_send !== "function")
        {
            return;
        }

        osc_send("/debug", [
            "REGIONDBG widget parent=" + (this.path || "") +
            " id=" + widget_id +
            " type=" + type +
            " rect=" + position.x + "," + position.y + "," + position.width + "," + position.height
        ]);
    }

    register_container_box()
    {
        if (!this.screen || typeof this.screen.register_container_box !== "function")
        {
            this.add_error("missing-container-box-registrar", "screen.register_container_box() is not available");
            return;
        }

        this.screen.register_container_box(this);
    }

    has_region_children()
    {
        var i;

        for (i = 0; i < this.children.length; i++)
        {
            if (this.children[i] instanceof Region)
            {
                return true;
            }
        }

        return false;
    }

    register_widget_child(widget)
    {
        var screen = this.screen;
        var container_id = "";
        var region_id = this.id || "";
        var container = null;
        var widget_id = "";
        var base_path = "";

        if (!widget || !screen || typeof screen.ensure_container !== "function")
        {
            this.add_error("missing-widget-registrar", "screen.ensure_container() is not available");
            return;
        }

        widget_id = this.get_last_path_part(widget.path || "");
        container_id = this.get_parent_path(widget.path || "");

        if (!container_id)
        {
            container_id = this.path ? String(this.path).replace(/^\//, "") : (this.id || "");
        }

        container = screen.ensure_container(container_id, region_id);
        container.export_enabled = this.export_subtree_enabled === true;
        base_path = join_path(container.path, container.id);

        container.widgets[widget_id] =
        {
            id: widget_id,
            path: base_path,
            box: widget,
            widget: widget
        };

        if (typeof screen.register_widget_path === "function")
        {
            screen.register_widget_path(container.widgets[widget_id]);
        }
    }

    get_last_path_part(path)
    {
        var parts = String(path || "").split("/");
        var i;

        for (i = parts.length - 1; i >= 0; i--)
        {
            if (parts[i])
            {
                return parts[i];
            }
        }

        return "0";
    }

    get_parent_path(path)
    {
        var parts = String(path || "").split("/");
        var out = [];
        var i;

        for (i = 0; i < parts.length - 1; i++)
        {
            if (parts[i])
            {
                out.push(parts[i]);
            }
        }

        return out.join("/");
    }

    draw_children()
    {
        var i;
        var child;
        var result;

        for (i = 0; i < this.children.length; i++)
        {
            child = this.children[i];

            if (child instanceof Region)
            {
                result = child.draw();
                this.add_diagnostics(child);

                if (!result || result.ok !== true)
                {
                    this.add_error(
                        result && result.code ? result.code : "region-draw-failed",
                        result && result.message ? result.message : "region draw failed"
                    );
                }

                continue;
            }

            this.register_widget_child(child);
        }
    }

    draw()
    {
        if (this.has_errors())
        {
            return {
                ok: false,
                code: "region-has-errors",
                message: "region has parse errors"
            };
        }

        if (!this.screen)
        {
            this.add_error("missing-screen", "region has no screen reference");
            return {
                ok: false,
                code: "missing-screen",
                message: "region has no screen reference"
            };
        }

        if (!this.node)
        {
            this.add_error("missing-region-node", "region has no source node");
            return {
                ok: false,
                code: "missing-region-node",
                message: "region has no source node"
            };
        }

        this.ensure_children_ready();
        this.screen.register_container_box(this);
        this.draw_children();

        if (this.has_errors())
        {
            return {
                ok: false,
                code: "region-draw-failed",
                message: "region draw completed with errors"
            };
        }

        return {
            ok: true,
            code: "ok",
            message: "region drawn"
        };
    }

    toJSON()
    {
        return {
            id: this.id,
            path: this.path,
            xpos: this.xpos,
            ypos: this.ypos,
            width: this.width,
            height: this.height,
            inner_x: this.inner_x,
            inner_y: this.inner_y,
            inner_width: this.inner_width,
            inner_height: this.inner_height,
            "background-color": this.background_color,
            border: this.border,
            "border-left": this.border_left,
            "border-top": this.border_top,
            "border-right": this.border_right,
            "border-bottom": this.border_bottom,
            "border-color": this.border_color,
            orientation: this.orientation,
            child_count: this.children.length,
            warnings: this.warnings.slice(0),
            errors: this.errors.slice(0)
        };
    }
}
