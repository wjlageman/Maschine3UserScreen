// Screen.js

const SCREEN_DEBUG = false;

class Screen extends Region
{
    constructor(node, screen_name)
    {
        super(node, null);

        this.screen = this;
        this.node = node || null;
        this.screen_name = screen_name || "";
        this.filename = "";
        this.target = "";
        this.address = "/screen";
        this.compiler = null;
        this.generated_widget_ids = null;

        this.ui_state =
        {
            id: "",
            path: "",
            filename: "",
            screen_name: "",
            target: "",
            containers: {},
            widgets_by_path: {}
        };

        this.read_screen_properties();

        debug_screen_log(
            "constructor",
            "screen_name=" + JSON.stringify(this.screen_name)
        );
    }

    read_screen_properties()
    {
        if (!this.node)
        {
            this.add_error("missing-screen-node", "screen has no source node");
            return;
        }

        if (!this.screen_name)
        {
            this.screen_name = this.node.getAttribute("template-name") || "";
        }

        this.filename = get_document_filename(this.screen_name);
        this.ui_state.filename = this.filename;
        this.ui_state.screen_name = this.screen_name;
    }

    reset_diagnostics()
    {
        this.warnings = [];
        this.errors = [];
    }

    clear_ui_state()
    {
        this.ui_state.id = "";
        this.ui_state.path = "";
        this.filename = get_document_filename(this.screen_name);
        this.ui_state.filename = this.filename;
        this.ui_state.screen_name = this.screen_name;
        this.ui_state.target = this.target;
        this.ui_state.containers = {};

        this.reset_widget_registry();

        this.ui_state.widget_registry = this.widget_registry;
        this.ui_state.widgets_by_id = this.widget_registry.by_id;
        this.ui_state.widgets_by_path = this.widget_registry.by_path;
    }

    reset_runtime_data()
    {
        this.clear_runtime_data();
        this.reset_diagnostics();
        this.clear_ui_state();
        this.read_screen_properties();
    }

    parse()
    {
        if (!this.node)
        {
            this.add_error("missing-screen-node", "screen has no source node");
            return {
                ok: false,
                code: "missing-screen-node",
                message: "screen has no source node"
            };
        }

        return this.compiler.compile(this);
    }

    draw()
    {
        var result;

        debug_screen_log(
            "draw.begin",
            "screen_name=" + JSON.stringify(this.screen_name)
        );

        if (!this.node)
        {
            this.add_error("missing-screen-node", "screen has no source node");
            return {
                ok: false,
                code: "missing-screen-node",
                message: "screen has no source node"
            };
        }

        this.clear_ui_state();
        this.clear_draw_surface();
        this.set_geometry(1, 1, 958, 270);

        result = super.draw();

        if (!result || result.ok !== true)
        {
            debug_screen_log(
                "draw.end",
                "ok=false"
            );

            return result || {
                ok: false,
                code: "screen-draw-failed",
                message: "screen draw failed"
            };
        }

        this.redraw_ui();

        if (this.has_errors())
        {
            debug_screen_log(
                "draw.end",
                "ok=false errorCount=" + this.errors.length
            );

            return {
                ok: false,
                code: "screen-draw-failed",
                message: "screen draw completed with errors"
            };
        }

        debug_screen_log(
            "draw.end",
            "ok=true"
        );

        return {
            ok: true,
            code: "ok",
            message: "screen drawn"
        };
    }

    clear_draw_surface()
    {
        if (!this.node)
        {
            return;
        }

        clear_generated_nodes(this.node);
        clear_debug_nodes(this.node);
    }

    redraw_ui()
    {
        var screen_node = this.node;
        var container_id;
        var container;
        var widget_id;
        var entry;
        var region_boxes = [];
        var i;

        if (!screen_node || !this.ui_state)
        {
            return;
        }

        clear_generated_nodes(screen_node);

        debug_screen_log(
            "redraw_ui.begin",
            "containerCount=" + Object.keys(this.ui_state.containers || {}).length
        );

        for (container_id in this.ui_state.containers)
        {
            if (!Object.prototype.hasOwnProperty.call(this.ui_state.containers, container_id))
            {
                continue;
            }

            container = this.ui_state.containers[container_id];

            if (container.box && container.box.visible)
            {
                this.render_entry(screen_node,
                {
                    widget: container.box
                });

                if (this.has_box_border(container.box))
                {
                    region_boxes.push(container.box);
                }
            }

            for (widget_id in container.widgets)
            {
                if (!Object.prototype.hasOwnProperty.call(container.widgets, widget_id))
                {
                    continue;
                }

                entry = container.widgets[widget_id];

                if (!entry.widget.visible)
                {
                    debug_screen_log(
                        "redraw_ui.skip_widget",
                        "region=" + container_id +
                        " widgetId=" + widget_id +
                        " reason=not-visible"
                    );
                    continue;
                }

                this.render_entry(screen_node, entry);
            }
        }

        for (i = 0; i < region_boxes.length; i += 1)
        {
            this.render_box_border_overlay(screen_node, region_boxes[i]);
        }

        debug_screen_log(
            "redraw_ui.end",
            "done=true"
        );
    }

    has_box_border(box)
    {
        return (
            box &&
            (
                box.border !== undefined ||
                box.border_left !== undefined ||
                box.border_top !== undefined ||
                box.border_right !== undefined ||
                box.border_bottom !== undefined
            )
        );
    }

    render_box_border_overlay(screen_node, box)
    {
        var background_color = box.background_color;

        box.background_color = undefined;

        this.render_entry(screen_node,
        {
            widget: box
        });

        box.background_color = background_color;
    }

    render_entry(screen_node, entry)
    {
        var widget = entry.widget;
        var draw_el = document.createElement("div");

        debug_screen_log(
            "render_entry.begin",
            "path=" + widget.path +
            " type=" + widget.type +
            " rect=(" + widget.xpos + "," + widget.ypos + "," + widget.width + "," + widget.height + ")"
        );

        draw_el.setAttribute("data-generated", "widget");
        draw_el.setAttribute("data-path", widget.path);

        screen_node.append(draw_el);
        widget.applyToElement(draw_el);

        debug_screen_log(
            "render_entry.drawn",
            "path=" + widget.path +
            " mode=widget.applyToElement"
        );
    }

    get_structure_json()
    {
        try
        {
            return json_ui_state(this.ui_state);
        }
        catch (e)
        {
            return JSON.stringify(this.toJSON(), null, 4);
        }
    }

    apply_message(atoms)
    {
        var command = "";
        var payload = "";

        if (!atoms || atoms.length <= 0)
        {
            return {
                ok: false,
                code: "empty-message",
                message: "message has no atoms"
            };
        }

        command = String(atoms[0]);
        debug_screen_log("COMMAND", command)
        payload = String(atoms[1]);
        debug_screen_log("PAYLOAD", payload)


        if (command === "redraw")
        {
            if (atoms.length > 1)
            {
                osc_send("/warning", [this.address, "redraw", "extra arguments ignored", JSON.stringify(atoms.slice(1))]);
            }

            return this.draw();
        }

        if (command === "query")
        {
            if (atoms.length < 2)
            {
                return {
                    ok: false,
                    code: "missing-query-name",
                    message: "query requires a name"
                };
            }

            payload = String(atoms[1]);

            if (payload === "structure")
            {
                osc_send("/query/structure", [this.get_structure_json()]);
                return {
                    ok: true,
                    code: "ok",
                    message: "structure query sent"
                };
            }

            return {
                ok: false,
                code: "unknown-query",
                message: "unknown query: " + payload
            };
        }

        return {
            ok: false,
            code: "unknown-command",
            message: "unknown screen command: " + command
        };
    }

    ensure_container(container_id, region_id)
    {
        if (!this.ui_state.containers[container_id])
        {
            this.ui_state.containers[container_id] =
            {
                id: container_id,
                path: "",
                address: "/" + container_id,
                region_id: region_id || "",
                type: "region",
                export_enabled: false,
                box: null,
                widgets: {},
                apply_message: OscMessage.prototype.apply_message
            };
        }

        return this.ui_state.containers[container_id];
    }

    register_widget_path(entry)
    {
        this.register_widget_entry(entry);
    }

    reset_widget_registry()
    {
        this.widget_registry =
        {
            by_id: {},
            by_path: {},
            next_button: 1,
            next_select: 1,
            next_dial: 1
        };

        this.generated_widget_ids = this.widget_registry;
    }

    reset_generated_widget_ids()
    {
        this.reset_widget_registry();
    }

    ensure_widget_registry()
    {
        if (!this.widget_registry)
        {
            this.reset_widget_registry();
        }

        if (!this.widget_registry.by_id)
        {
            this.widget_registry.by_id = {};
        }

        if (!this.widget_registry.by_path)
        {
            this.widget_registry.by_path = {};
        }

        this.generated_widget_ids = this.widget_registry;
    }

    ensure_generated_widget_ids()
    {
        this.ensure_widget_registry();
    }

    is_generated_widget_id_used(id)
    {
        this.ensure_widget_registry();

        if (!id)
        {
            return false;
        }

        return Object.prototype.hasOwnProperty.call(this.widget_registry.by_id, id);
    }

    reserve_widget_id(id)
    {
        this.ensure_widget_registry();

        if (id)
        {
            this.widget_registry.by_id[id] = null;
        }
    }

    mark_generated_widget_id_used(id)
    {
        this.reserve_widget_id(id);
    }

    register_widget_entry(entry)
    {
        var id = "";
        var path = "";

        this.ensure_widget_registry();

        if (!entry)
        {
            return;
        }

        id = entry.id || "";
        path = entry.widget && entry.widget.path ? entry.widget.path : "";

        if (id)
        {
            this.widget_registry.by_id[id] = entry;
        }

        if (path)
        {
            this.widget_registry.by_path[path] = entry;
        }
    }

    get_explicit_widget_id(widget_def)
    {
        if (!widget_def || widget_def.virtual)
        {
            return "";
        }

        return widget_def.getAttribute("id") || "";
    }

    parse_start_at(value)
    {
        var text = String(value || "");
        var match = text.match(/^(.+)-(\d+)$/);

        if (!match)
        {
            return null;
        }

        return {
            prefix: match[1],
            number: parse_integer(match[2], 1)
        };
    }

    get_start_at_value(row, widget_def)
    {
        var value = "";

        if (widget_def)
        {
            value = widget_def.getAttribute("start-at") || "";
        }

        if (!value && row)
        {
            value = row.getAttribute("start-at") || "";
        }

        return value;
    }

    get_default_control_prefix(type)
    {
        if (type === "dial")
        {
            return "dial";
        }

        if (type === "toggle" || type === "radio")
        {
            return "select";
        }

        if (type === "button")
        {
            return "button";
        }

        return "";
    }

    get_next_default_number(prefix)
    {
        this.ensure_generated_widget_ids();

        if (prefix === "button")
        {
            return this.widget_registry.next_button;
        }

        if (prefix === "select")
        {
            return this.widget_registry.next_select;
        }

        if (prefix === "dial")
        {
            return this.widget_registry.next_dial;
        }

        return 1;
    }

    set_next_default_number(prefix, value)
    {
        this.ensure_generated_widget_ids();

        if (prefix === "button")
        {
            this.widget_registry.next_button = value;
        }
        else if (prefix === "select")
        {
            this.widget_registry.next_select = value;
        }
        else if (prefix === "dial")
        {
            this.widget_registry.next_dial = value;
        }
    }

    reserve_numbered_id(prefix, number)
    {
        var candidate;

        while (true)
        {
            candidate = prefix + "-" + number;

            if (!this.is_generated_widget_id_used(candidate))
            {
                this.mark_generated_widget_id_used(candidate);
                return candidate;
            }

            number += 1;
        }
    }

    build_start_at_widget_id(row, widget_def, widget_index)
    {
        var parsed = this.parse_start_at(this.get_start_at_value(row, widget_def));

        if (!parsed)
        {
            return "";
        }

        return this.reserve_numbered_id(parsed.prefix, parsed.number + parse_integer(widget_index, 0));
    }

    build_default_widget_id(type)
    {
        var prefix = this.get_default_control_prefix(type);
        var number;
        var id;

        if (!prefix)
        {
            return "";
        }

        number = this.get_next_default_number(prefix);
        id = this.reserve_numbered_id(prefix, number);
        this.set_next_default_number(prefix, parse_integer(id.replace(/^.*-/, ""), number) + 1);

        return id;
    }

    build_unique_widget_id(row, widget_def, type, widget_id)
    {
        var explicit_id = this.get_explicit_widget_id(widget_def);
        var id = "";

        if (explicit_id)
        {
            this.mark_generated_widget_id_used(explicit_id);
            return explicit_id;
        }

        id = this.build_start_at_widget_id(row, widget_def, widget_id);

        if (id)
        {
            return id;
        }

        id = this.build_default_widget_id(type);

        if (id)
        {
            return id;
        }

        id = String(widget_id || "0");

        if (!this.is_generated_widget_id_used(id))
        {
            this.mark_generated_widget_id_used(id);
            return id;
        }

        return this.reserve_numbered_id("widget", 1);
    }

    build_box_spec(screen_node, region_node, layout, row, widget_def, entry_path, x, y, width, height)
    {
        var spec =
        {
            id: "box",
            path: entry_path,
            xpos: x,
            ypos: y,
            width: width,
            height: height
        };

        this.merge_box_color_defaults_from_node(spec, this.node);
        this.merge_box_color_defaults_from_node(spec, region_node);

        if (layout)
        {
            this.merge_box_color_defaults_from_layout(spec, layout);
        }

        this.merge_box_color_defaults_from_node(spec, row);
        this.merge_box_defaults_from_node(spec, widget_def);

        return spec;
    }

    read_color_attribute(node, name)
    {
        var value;
        var parts;

        if (!node)
        {
            return undefined;
        }

        value = get_optional_string_attr(node, name);
        if (value === undefined)
        {
            return undefined;
        }

        value = String(value);

        if (value.indexOf("|") < 0)
        {
            if (value === "*")
            {
                this.add_warning("invalid-color-value", name + " cannot be a single companion marker; attribute ignored");
                return undefined;
            }

            return value;
        }

        parts = value.split("|");

        if (parts.length !== 2 || parts[0] === "" || parts[1] === "" || (parts[0] === "*" && parts[1] === "*"))
        {
            this.add_warning("invalid-color-value", name + " has invalid value " + JSON.stringify(value) + "; attribute ignored");
            return undefined;
        }

        return value;
    }

    reject_color_aliases(node)
    {
        this.reject_color_alias(node, "colors");
        this.reject_color_alias(node, "text-colors");
        this.reject_color_alias(node, "text_colors");
        this.reject_color_alias(node, "background-colors");
        this.reject_color_alias(node, "background_colors");
        this.reject_color_alias(node, "led-colors");
        this.reject_color_alias(node, "led_colors");
        this.reject_color_alias(node, "border-colors");
        this.reject_color_alias(node, "border_colors");
    }

    reject_color_alias(node, name)
    {
        if (!node || !node.hasAttribute || !node.hasAttribute(name))
        {
            return;
        }

        this.add_error("deprecated-color-key", name + " is not supported; use the singular dash-style color attribute");
    }

    assign_color_attribute(spec, key, value)
    {
        if (value === undefined)
        {
            return;
        }

        spec[key] = value;
    }

    merge_box_defaults_from_layout(spec, layout)
    {
        if (!layout)
        {
            return;
        }

        this.assign_if_defined(spec, "border", layout.border);
        this.assign_if_defined(spec, "border_left", layout.border_left);
        this.assign_if_defined(spec, "border_top", layout.border_top);
        this.assign_if_defined(spec, "border_right", layout.border_right);
        this.assign_if_defined(spec, "border_bottom", layout.border_bottom);
        this.assign_if_defined(spec, "border_color", layout.border_color);
        this.assign_if_defined(spec, "background_color", layout.background_color);
    }


    merge_box_color_defaults_from_layout(spec, layout)
    {
        if (!layout)
        {
            return;
        }

        this.assign_if_defined(spec, "border_color", layout.border_color);
        this.assign_if_defined(spec, "background_color", layout.background_color);
    }

    merge_box_color_defaults_from_node(spec, node)
    {
        var value;

        if (!node)
        {
            return;
        }

        this.reject_color_aliases(node);

        value = this.read_color_attribute(node, "border-color");
        if (value !== undefined) spec.border_color = value;

        value = this.read_color_attribute(node, "background-color");
        this.assign_color_attribute(spec, "background_color", value);
    }

    merge_box_defaults_from_node(spec, node)
    {
        var value;

        if (!node)
        {
            return;
        }

        this.reject_color_aliases(node);

        value = get_optional_integer_attr(node, "border");
        if (value !== undefined) spec.border = value;

        value = get_optional_integer_attr(node, "border-left");
        if (value !== undefined) spec.border_left = value;

        value = get_optional_integer_attr(node, "border-top");
        if (value !== undefined) spec.border_top = value;

        value = get_optional_integer_attr(node, "border-right");
        if (value !== undefined) spec.border_right = value;

        value = get_optional_integer_attr(node, "border-bottom");
        if (value !== undefined) spec.border_bottom = value;

        value = this.read_color_attribute(node, "border-color");
        if (value !== undefined) spec.border_color = value;

        value = this.read_color_attribute(node, "background-color");
        this.assign_color_attribute(spec, "background_color", value);

        value = this.read_color_attribute(node, "led-color");
        this.assign_color_attribute(spec, "led_color", value);
    }

    build_widget_spec(screen_node, region_node, layout, row, widget_def, type, entry_path, box_spec, widget_id)
    {
        var normalized_type = this.normalize_widget_type(type);
        var spec =
        {
            id: widget_id,
            path: entry_path,
            control: widget_id,
            type: normalized_type,
            visible: true,
            enabled: true,
            active: false,
            text: this.build_default_text(row, normalized_type, widget_id, widget_def),
            value_text: "",
            value: 0.0,
            value_norm: 0.0,
            min: 0.0,
            max: 1.0
        };

        this.apply_text_defaults_from_node(spec, this.node);
        this.apply_text_defaults_from_node(spec, region_node);
        this.apply_text_defaults_from_layout(spec, layout);
        this.apply_text_defaults_from_node(spec, row);
        this.apply_text_defaults_from_node(spec, widget_def);

        this.apply_widget_defaults_from_node(spec, this.node);
        this.apply_widget_defaults_from_node(spec, region_node);
        this.apply_widget_defaults_from_node(spec, row);
        this.apply_widget_defaults_from_node(spec, widget_def);

        if (normalized_type === "panel")
        {
            this.assign_if_defined(spec, "background_color", box_spec ? box_spec.background_color : undefined);
        }

        return spec;
    }

    apply_text_defaults_from_layout(spec, layout)
    {
        if (!layout)
        {
            return;
        }

        this.assign_if_defined(spec, "align", layout.align);
        this.assign_if_defined(spec, "valign", layout.valign);
        this.assign_if_defined(spec, "font", layout.font);
        this.assign_if_defined(spec, "font_size", layout.font_size);
        this.assign_if_defined(spec, "text_color", layout.text_color);
        this.assign_if_defined(spec, "bold", layout.bold);
        this.assign_if_defined(spec, "italic", layout.italic);
        this.assign_if_defined(spec, "underline", layout.underline);
    }

    apply_text_defaults_from_node(spec, node)
    {
        var value;

        if (!node)
        {
            return;
        }

        value = get_optional_string_attr(node, "text");
        if (value !== undefined) spec.text = value;

        value = get_optional_string_attr(node, "align");
        if (value !== undefined) spec.align = value;

        value = get_optional_string_attr(node, "valign");
        if (value !== undefined) spec.valign = value;

        value = get_optional_string_attr(node, "font");
        if (value !== undefined) spec.font = value;

        value = get_optional_integer_attr(node, "font-size");
        if (value !== undefined) spec.font_size = value;

        value = get_optional_integer_attr(node, "fontsize");
        if (value !== undefined && spec.font_size === undefined) spec.font_size = value;

        value = this.read_color_attribute(node, "text-color");
        this.assign_color_attribute(spec, "text_color", value);

        value = get_optional_integer_attr(node, "bold");
        if (value !== undefined) spec.bold = value;

        value = get_optional_integer_attr(node, "italic");
        if (value !== undefined) spec.italic = value;

        value = get_optional_integer_attr(node, "underline");
        if (value !== undefined) spec.underline = value;
    }

    apply_widget_defaults_from_node(spec, node)
    {
        var value;

        if (!node)
        {
            return;
        }

        value = get_optional_string_attr(node, "items");
        if (value !== undefined) spec.items = value;

        value = this.read_color_attribute(node, "led-color");
        this.assign_color_attribute(spec, "led_color", value);

        value = get_optional_integer_attr(node, "cc");
        if (value !== undefined) spec.cc = value;

        value = get_optional_integer_attr(node, "cc2");
        if (value !== undefined) spec.cc2 = value;

        value = get_optional_string_attr(node, "back");
        if (value !== undefined) spec.back = value;

        value = get_optional_string_attr(node, "next");
        if (value !== undefined) spec.next = value;

        value = get_optional_string_attr(node, "enter");
        if (value !== undefined) spec.enter = value;

        value = get_optional_string_attr(node, "control");
        if (value !== undefined) spec.control = value;

        value = get_optional_integer_attr(node, "cc-touch");
        if (value !== undefined) spec.cc_touch = value;

        value = get_optional_integer_attr(node, "cc_touch");
        if (value !== undefined && spec.cc_touch === undefined) spec.cc_touch = value;

        value = get_optional_string_attr(node, "group");
        if (value !== undefined) spec.group = value;

        value = get_optional_string_attr(node, "value");
        if (value !== undefined) spec.value = value;

        value = get_optional_string_attr(node, "min");
        if (value !== undefined) spec.min = value;

        value = get_optional_string_attr(node, "max");
        if (value !== undefined) spec.max = value;

        value = get_optional_string_attr(node, "pace");
        if (value !== undefined) spec.pace = value;

        value = get_optional_string_attr(node, "norm_value");
        if (value !== undefined) spec.norm_value = value;

        value = get_optional_string_attr(node, "value_norm");
        if (value !== undefined && spec.norm_value === undefined) spec.value_norm = value;

        value = get_optional_integer_attr(node, "required");
        if (value !== undefined) spec.required = value;
    }

    copy_box_spec_to_widget_spec(widget_spec, box_spec)
    {
        if (!widget_spec || !box_spec)
        {
            return;
        }

        widget_spec.xpos = box_spec.xpos;
        widget_spec.ypos = box_spec.ypos;
        widget_spec.width = box_spec.width;
        widget_spec.height = box_spec.height;

        this.assign_if_defined(widget_spec, "border_color", box_spec.border_color);

        if (widget_spec.background_color === undefined || widget_spec.background_color === null || widget_spec.background_color === "")
        {
            this.assign_if_defined(widget_spec, "background_color", box_spec.background_color);
        }

    }

    register_entry(row, source, layout, type, widget_id, x, y, width, height)
    {
        var container_id = row.getAttribute("id") || "";
        var region_node = this.find_parent_region(row);
        var region_id = region_node ? (region_node.getAttribute("id") || "") : "";
        var container = this.ensure_container(container_id, region_id);
        var base_path = join_path(container.path, container.id);
        var entry_path = join_path(base_path, widget_id);
        var widget_def = this.get_widget_definition_node(source, row, widget_id);
        var box_spec = this.build_box_spec(this.node, region_node, layout, row, widget_def, entry_path, x, y, width, height);
        var widget_spec = this.build_widget_spec(this.node, region_node, layout, row, widget_def, type, entry_path, box_spec, widget_id);
        var widget = null;

        this.copy_box_spec_to_widget_spec(widget_spec, box_spec);

        widget = WidgetFactory.create(widget_spec);

        debug_screen_log(
            "register_entry",
            "path=" + widget.path +
            " type=" + widget.type +
            " rect=(" + widget.xpos + "," + widget.ypos + "," + widget.width + "," + widget.height + ")"
        );

        container.widgets[widget_id] =
        {
            id: widget_id,
            path: base_path,
            box: widget,
            widget: widget
        };

        this.register_widget_path(container.widgets[widget_id]);
    }

    register_container_box(region)
    {
        var region_id = region && region.id ? region.id : "";
        var container_id = region && region.path ? String(region.path).replace(/^\//, "") : region_id;
        var container = null;
        var box_path = "";
        var has_border = false;
        var has_background = false;
        var widget = null;

        if (!container_id)
        {
            container_id = region_id || "region";
        }

        container = this.ensure_container(container_id, region_id);
        container.export_enabled = !!(region && region.export_subtree_enabled === true);

        if (region && Object.prototype.hasOwnProperty.call(region, "gap") && region.gap !== undefined)
        {
            container.gap = region.gap;
        }

        if (region && region.background_color !== undefined && region.background_color !== null && region.background_color !== "")
        {
            container.background_color = region.background_color;
        }

        box_path = "/" + container_id;

        has_border = (
            region.border !== undefined ||
            region.border_left !== undefined ||
            region.border_top !== undefined ||
            region.border_right !== undefined ||
            region.border_bottom !== undefined
        );

        has_background = (
            region.background_color !== undefined &&
            region.background_color !== null &&
            region.background_color !== ""
        );

        var box_xpos = region.xpos + parse_integer(region.left_bleed, 0);
        var box_ypos = region.ypos + parse_integer(region.top_bleed, 0);
        var box_width = region.width - parse_integer(region.left_bleed, 0) - parse_integer(region.right_bleed, 0);
        var box_height = region.height - parse_integer(region.top_bleed, 0) - parse_integer(region.bottom_bleed, 0);

        if (box_width < 0)
        {
            box_width = 0;
        }

        if (box_height < 0)
        {
            box_height = 0;
        }

        widget = WidgetFactory.create(
        {
            id: "box",
            path: box_path,
            type: "panel",
            xpos: box_xpos,
            ypos: box_ypos,
            width: box_width,
            height: box_height,
            border: region.border,
            border_left: region.border_left,
            border_top: region.border_top,
            border_right: region.border_right,
            border_bottom: region.border_bottom,
            border_color: region.border_color,
            background_color: region.background_color,
            visible: has_background || has_border,
            enabled: false,
            active: false,
            text: ""
        });

        debug_screen_log(
            "register_container_box",
            "region=" + container_id +
            " rect=(" + widget.xpos + "," + widget.ypos + "," + widget.width + "," + widget.height + ")" +
            " background=" + JSON.stringify(region.background_color)
        );

        container.box = widget;
    }

    register_region_fill(region, x, y, width, height, color)
    {
        if (region && region.id !== undefined && region.path !== undefined)
        {
            this.register_container_box(region);
        }
    }

    register_panel_fill(region, x, y, width, height, color)
    {
        this.register_region_fill(region, x, y, width, height, color);
    }

    register_line_entry(row, source, x, y, width, height, layout)
    {
        var container_id = row.getAttribute("id") || "";
        var region_node = this.find_parent_region(row);
        var region_id = region_node ? (region_node.getAttribute("id") || "") : "";
        var container = this.ensure_container(container_id, region_id);
        var base_path = join_path(container.path, container.id);
        var entry_path = join_path(base_path, "0");
        var left_bleed = this.get_effective_bleed(source, row, layout || {}, "left");
        var right_bleed = this.get_effective_bleed(source, row, layout || {}, "right");
        var line_width = Math.max(0, width - left_bleed - right_bleed);
        var color = source.getAttribute("background-color") || row.getAttribute("background-color") || "gray";
        var widget = WidgetFactory.create(
        {
            id: "widget",
            path: entry_path,
            type: "panel",
            xpos: x + left_bleed,
            ypos: y,
            width: line_width,
            height: height,
            border: 0,
            background_color: color,
            visible: true,
            enabled: false,
            active: false,
            text: ""
        });

//        widget.normalize();

        debug_screen_log(
            "register_line_entry",
            "path=" + widget.path +
            " rect=(" + widget.xpos + "," + widget.ypos + "," + widget.width + "," + widget.height + ")" +
            " color=" + JSON.stringify(color)
        );

        container.widgets["0"] =
        {
            id: "0",
            path: base_path,
            box: widget,
            widget: widget
        };

        this.register_widget_path(container.widgets["0"]);
    }

    get_widget_definition_node(source, row, widget_id)
    {
        var defs;
        var index;

        index = parse_integer(widget_id, -1);

        defs = this.compiler.get_direct_widget_defs(source);

        if ((!defs || defs.length === 0) && source !== row)
        {
            defs = this.compiler.get_direct_widget_defs(row);
        }

        if (!defs || index < 0 || index >= defs.length)
        {
            return null;
        }

        return defs[index];
    }

    normalize_widget_type(type)
    {
        if (type === "label" || type === "region")
        {
            return "panel";
        }

        return type || "panel";
    }

    build_default_text(row, type, widget_id, widget_def)
    {
        var row_id = row.getAttribute("id") || "";
        var index = parse_integer(widget_id, 0);
        var explicit_id = this.get_explicit_widget_id(widget_def);

        if (explicit_id)
        {
            return explicit_id;
        }

        if (String(widget_id || "").match(/^.+-\d+$/))
        {
            return widget_id;
        }

        if (type === "button")
        {
            return "Button " + (index + 1);
        }

        if (type === "dial")
        {
            return "Dial " + (index + 1);
        }

        if (type === "status")
        {
            return row_id || "status";
        }

        if (type === "panel")
        {
            if (row_id === "header")
            {
                return "Title 1";
            }

            if (row_id === "title-left")
            {
                return "Title 1";
            }

            if (row_id === "title-right")
            {
                return "Title 2";
            }

            if (row_id === "text-labels-left")
            {
                return (index === 0) ? "L1" : "L2";
            }

            if (row_id === "text-labels-right")
            {
                return (index === 0) ? "R1" : "R2";
            }
        }

        return "";
    }

    assign_if_defined(obj, key, value)
    {
        if (value !== undefined && value !== null && value !== "")
        {
            obj[key] = value;
        }
    }

    find_parent_region(node)
    {
        var p = node ? node.parentElement : null;
        var tag;

        while (p)
        {
            tag = String(p.tagName || "").toLowerCase();

            if (tag === "region" || tag === "row" || tag === "column" || tag === "panel" || tag === "screen")
            {
                return p;
            }

            p = p.parentElement;
        }

        return null;
    }

    toJSON()
    {
        return {
            filename: this.filename,
            screen_name: this.screen_name,
            target: this.target,
            child_count: this.children ? this.children.length : 0,
            layout_count: Object.keys(this.layouts || {}).length,
            warnings: this.warnings.slice(0),
            errors: this.errors.slice(0)
        };
    }
}

function debug_screen_log(stage, msg)
{
    if (!SCREEN_DEBUG)
    {
        return;
    }

    var line = "SCREENDBG stage=" + stage + " " + msg;

    if (typeof console !== "undefined" && console && typeof console.log === "function")
    {
        console.log(line);
    }

    if (typeof osc_send === "function")
    {
        osc_send("/debug", [line]);
    }
}