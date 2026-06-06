// JsonFormatter.js
// Debug formatter for the current UI state structure.

const DEBUG_JSON_FORMAT = false;
var NEWLINE_AFTER_TYPE = false;

function json_ui_state(ui_state)
{
    var exported =
    {
        filename: ui_state.filename,
        target: ui_state.target,
        containers: {}
    };

    for (var container_id in ui_state.containers)
    {
        if (!Object.prototype.hasOwnProperty.call(ui_state.containers, container_id))
        {
            continue;
        }

        exported.containers[container_id] = export_container(ui_state.containers[container_id]);
    }

    for (container_id in ui_state.containers)
    {
        if (!Object.prototype.hasOwnProperty.call(ui_state.containers, container_id))
        {
            continue;
        }

        export_container_widgets_as_root_entries(exported.containers, ui_state.containers[container_id], container_id);
    }

    var lines = [];

    lines.push("{");
    lines.push(handle_indent(1) + "\"filename\": " + json_value(exported.filename) + ",");
    lines.push(handle_indent(1) + "\"target\": " + json_value(exported.target) + ",");

    format_containers(lines, exported.containers, 1);

    lines.push("}");

    return lines.join("\n");
}
function export_container_widgets_as_root_entries(out, container, container_id)
{
    var widget_id;
    var entry;
    var widget_key = "";

    if (!container || !container.widgets)
    {
        return;
    }

    for (widget_id in container.widgets)
    {
        if (!Object.prototype.hasOwnProperty.call(container.widgets, widget_id))
        {
            continue;
        }

        entry = container.widgets[widget_id];
        widget_key = entry && entry.widget && entry.widget.path ? String(entry.widget.path).replace(/^\//, "") : "";

        if (!widget_key)
        {
            widget_key = String(container_id || "") + "/" + String(widget_id || "");
        }

        out[widget_key] = export_entry(entry);
    }
}

function object_to_json(obj)
{
    if (!obj)
    {
        return "{}";
    }

    if (obj.type === "region")
    {
        return format_update_container_object(export_container(obj));
    }

    return format_update_entry_object(export_entry(
    {
        widget: obj
    }));
}

function format_update_entry_object(entry)
{
    var lines = [];

    format_entry_lines(lines, "widget", entry, 0, false);

    if (lines.length >= 2)
    {
        lines[0] = "{";
        lines.pop();
        lines.push("}");
    }

    return lines.join("\n");
}

function format_update_container_object(container)
{
    var lines = [];

    lines.push("{");
    format_container_properties(lines, container, 1, false);
    lines.push("}");

    return lines.join("\n");
}



function local_name_from_address(address)
{
    var text = String(address || "");
    var parts;

    text = text.replace(/^\/+/, "");

    if (!text)
    {
        return "";
    }

    parts = text.split("/");

    return parts[parts.length - 1] || "";
}

function address_from_path(path)
{
    var text = String(path || "");

    if (!text)
    {
        return "";
    }

    if (text.charAt(0) !== "/")
    {
        text = "/" + text;
    }

    return text;
}


function format_container_properties(lines, container, indent, has_more_after)
{
    var box = "";
    var background_color = null;
    var property_start = lines.length;

    lines.push(handle_indent(indent) + "\"type\": " + json_value(container.type || "region") + ",");
    lines.push(handle_indent(indent) + "\"name\": " + json_value(local_name_from_address(container.address || "")) + ",");
    lines.push(handle_indent(indent) + "\"address\": " + json_value(address_from_path(container.address || "")) + ",");

    if (Object.prototype.hasOwnProperty.call(container, "gap"))
    {
        lines.push(handle_indent(indent) + "\"gap\": " + json_value(container.gap) + ",");
    }

    if (Object.prototype.hasOwnProperty.call(container, "box"))
    {
        box = box_to_json(container.box || {});

        if (box !== "")
        {
            lines.push(handle_indent(indent) + box + ",");
        }
    }

    if (Object.prototype.hasOwnProperty.call(container, "background-color"))
    {
        background_color = container["background-color"];
    }
    else if (Object.prototype.hasOwnProperty.call(container, "background_color"))
    {
        background_color = container.background_color;
    }

    if (background_color !== null && background_color !== undefined && background_color !== "")
    {
        lines.push(handle_indent(indent) + "\"background-color\": " + json_value(background_color) + ",");
    }

    if (!has_more_after && lines.length > property_start)
    {
        lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "");
    }
}

function export_container_update(container)
{
    var raw_box = {};
    var out =
    {
        name: local_name_from_address(container.address || ""),
        address: address_from_path(container.address || ""),
        type: container.type || "region",
        box: {},
        background_color: ""
    };
    var key;

    if (Object.prototype.hasOwnProperty.call(container, "gap"))
    {
        out.gap = container.gap;
    }

    if (container.box && typeof container.box.toJSON === "function")
    {
        raw_box = container.box.toJSON();
    }
    else if (container.box && typeof container.box === "object")
    {
        raw_box = container.box;
    }

    for (key in raw_box)
    {
        if (!Object.prototype.hasOwnProperty.call(raw_box, key))
        {
            continue;
        }

        if (
            key === "id" ||
            key === "path" ||
            key === "xpos" ||
            key === "ypos" ||
            key === "width" ||
            key === "height" ||
            key === "inner_x" ||
            key === "inner_y" ||
            key === "inner_width" ||
            key === "inner_height"
        )
        {
            continue;
        }

        out.box[key] = raw_box[key];
    }

    if (Object.prototype.hasOwnProperty.call(container, "background-color"))
    {
        out.background_color = container["background-color"];
    }
    else if (Object.prototype.hasOwnProperty.call(container, "background_color"))
    {
        out.background_color = container.background_color;
    }
    else if (out.box && Object.prototype.hasOwnProperty.call(out.box, "background-color"))
    {
        out.background_color = out.box["background-color"];
        delete out.box["background-color"];
    }

    return out;
}

function export_container(container)
{
    var out = export_container_update(container);
    var widget_id;
    var entry;

    out.widgets = {};

    for (widget_id in container.widgets)
    {
        if (!Object.prototype.hasOwnProperty.call(container.widgets, widget_id))
        {
            continue;
        }

        entry = container.widgets[widget_id];
        out.widgets[widget_id] = export_widget_reference(entry, widget_id);
    }

    return out;
}

function export_widget_reference(entry, widget_id)
{
    var widget = entry ? entry.widget : null;
    var path = widget && widget.path ? String(widget.path) : "";

    return {
        name: widget_id,
        address: address_from_path(path),
        type: widget && widget.type ? widget.type : "widget"
    };
}

function export_entry(entry)
{
    var raw = entry.widget.toEntryJSON();
    var out = {};
    var raw_box = raw.box || {};
    var raw_widget = raw.widget || {};
    var key;

    out.name = local_name_from_address(entry.widget.path);
    out.address = address_from_path(entry.widget.path);
    out.box = {};

    for (key in raw_box)
    {
        if (!Object.prototype.hasOwnProperty.call(raw_box, key))
        {
            continue;
        }

        if (
            key === "id" ||
            key === "path" ||
            key === "xpos" ||
            key === "ypos" ||
            key === "width" ||
            key === "height" ||
            key === "inner_x" ||
            key === "inner_y" ||
            key === "inner_width" ||
            key === "inner_height"
        )
        {
            continue;
        }

        out.box[key] = raw_box[key];
    }

    for (key in raw_widget)
    {
        if (!Object.prototype.hasOwnProperty.call(raw_widget, key))
        {
            continue;
        }

        if (
            key === "id" ||
            key === "path" ||
            key === "xpos" ||
            key === "ypos" ||
            key === "width" ||
            key === "height" ||
            key === "inner_x" ||
            key === "inner_y" ||
            key === "inner_width" ||
            key === "inner_height" ||
            key === "box" ||
            key === "widget" ||
            key === "visible" ||
            key === "active" ||
            key === "enabled" ||
            key === "output_event" ||
            key === "cc" ||
            key === "cc_touch" ||
            key === "cc2" ||
            key === "is_joystick" ||
            key === "led_color" ||
            key === "overlay_active" ||
            key === "pressed" ||
            key === "midi_cc_is_down" ||
            key === "header_height_ratio"
        )
        {
            continue;
        }

        out[key] = raw_widget[key];
    }

    return out;
}

function format_containers(lines, containers, indent)
{
    var ids = get_keys(containers);
    var i;
    var container_id;
    var item;

    for (i = 0; i < ids.length; i++)
    {
        container_id = ids[i];
        item = containers[container_id];

        if (item && Object.prototype.hasOwnProperty.call(item, "widgets"))
        {
            format_container(lines, container_id, item, indent, i < ids.length - 1);
        }
        else
        {
            format_entry_lines(lines, container_id, item, indent, i < ids.length - 1);
        }
    }
}

function format_container(lines, container_id, container, indent, has_comma)
{
    lines.push(handle_indent(indent) + json_key(container_id) + ": {");

    format_container_properties(lines, container, indent + 1, true);

    lines.push(handle_indent(indent + 1) + "\"widgets\": {");

    format_widgets(lines, container.widgets || {}, indent + 2);

    lines.push(handle_indent(indent + 1) + "}");

    lines.push(handle_indent(indent) + "}" + (has_comma ? "," : ""));
}

function format_widgets(lines, widgets, indent)
{
    var ids = get_keys(widgets);
    var i;
    var widget_id;

    for (i = 0; i < ids.length; i++)
    {
        widget_id = ids[i];
        format_widget_reference_lines(lines, widget_id, widgets[widget_id], indent, i < ids.length - 1);
    }
}

function format_widget_reference_lines(lines, widget_id, widget, indent, has_comma)
{
    lines.push(
        handle_indent(indent) +
        json_key(widget_id) +
        ": { \"name\": " + json_value(widget.name || widget_id) +
        ", \"address\": " + json_value(address_from_path(widget.address || widget.path || "")) +
        ", \"type\": " + json_value(widget.type || "widget") +
        " }" +
        (has_comma ? "," : "")
    );
}

function format_entry_lines(lines, widget_id, entry, indent, has_comma)
{
    var groups = group_entry_properties(entry);
    var i;

    lines.push(handle_indent(indent) + json_key(widget_id) + ": {");

    if (Object.prototype.hasOwnProperty.call(entry, "type"))
    {
        lines.push(handle_indent(indent + 1) + "\"type\": " + json_value(entry.type) + ",");
    }

    lines.push(handle_indent(indent + 1) + "\"name\": " + json_value(entry.name || local_name_from_address(entry.address)) + ",");
    lines.push(handle_indent(indent + 1) + "\"address\": " + json_value(address_from_path(entry.address)) + ",");

    if (Object.prototype.hasOwnProperty.call(entry, "box"))
    {
        lines.push(handle_indent(indent + 1) + box_to_json(entry.box || {}) + ",");
    }

    for (i = 0; i < groups.length; i++)
    {
        lines.push(
            handle_indent(indent + 1) +
            groups[i] +
            (i < groups.length - 1 ? "," : "")
        );
    }

    lines.push(handle_indent(indent) + "}" + (has_comma ? "," : ""));
}

function group_entry_properties(entry)
{
    var groups = [];
    var used = {};
    var group;
    var remaining;

    used.address = true;
    used.name = true;
    used.box = true;
    used.type = true;
    used.visible = true;
    used.active = true;
    used.enabled = true;
    used.output_event = true;
    used.cc = true;
    used.cc_touch = true;
    used.cc2 = true;
    used.is_joystick = true;
    used.led_color = true;
    used.overlay_active = true;
    used.pressed = true;
    used.midi_cc_is_down = true;
    used.header_height_ratio = true;

    group = collect_group(entry,
    [
        "visible",
        "active",
        "enabled"
    ], used);
    if (group)
    {
        groups.push(group);
    }

    group = collect_group(entry,
    [
        "output_event",
        "trigger",
        "trigger_value",
        "group"
    ], used);
    if (group)
    {
        groups.push(group);
    }

    group = collect_group(entry,
    [
        "text",
        "align",
        "valign",
        "value_text"
    ], used);
    if (group)
    {
        groups.push(group);
    }

    group = collect_group(entry,
    [
        "value",
        "value_norm",
        "min",
        "max",
        "step",
        "items"
    ], used);
    if (group)
    {
        groups.push(group);
    }

    group = collect_group(entry,
    [
        "show_value",
        "show_arc",
        "show_needle",
        "orientation",
        "blinking",
        "blink_duration",
        "clicked"
    ], used);
    if (group)
    {
        groups.push(group);
    }

    group = collect_group(entry,
    [
        "font",
        "font-size",
        "font_size",
        "text-color",
        "text_color",
        "bold",
        "italic",
        "underline",
        "background_color",
        "background_color2",
        "icons",
        "icon"
    ], used);
    if (group)
    {
        groups.push(group);
    }

    remaining = collect_remaining_group(entry, used);
    if (remaining)
    {
        groups.push(remaining);
    }

    return groups;
}

function collect_group(obj, keys, used)
{
    var parts = [];
    var i;
    var key;

    for (i = 0; i < keys.length; i++)
    {
        key = keys[i];

        if (used[key])
        {
            continue;
        }

        if (!Object.prototype.hasOwnProperty.call(obj, key))
        {
            continue;
        }

        used[key] = true;
        parts.push(json_key(external_json_property_name(key)) + ":" + json_value(obj[key]));
    }

    return parts.length > 0 ? parts.join(",") : "";
}

function collect_remaining_group(obj, used)
{
    var keys = get_sorted_keys(obj);
    var parts = [];
    var i;
    var key;

    for (i = 0; i < keys.length; i++)
    {
        key = keys[i];

        if (used[key])
        {
            continue;
        }

        parts.push(json_key(external_json_property_name(key)) + ":" + json_value(obj[key]));
    }

    return parts.length > 0 ? parts.join(",") : "";
}

function external_json_property_name(key)
{
    if (key === "background_color") return "background-color";
    if (key === "text_color") return "text-color";
    if (key === "led_color") return "led-color";
    if (key === "border_color") return "border-color";
    if (key === "font_size") return "font-size";
    if (key === "value_norm") return "value-norm";
    if (key === "blink_duration") return "blink-duration";
    if (key === "header_height_ratio") return "header-height-ratio";
    if (key === "cc_touch") return "cc-touch";

    return key;
}

function box_to_json(obj)
{
    var keys;
    var parts = [];
    var i;
    var key;

    if (!obj)
    {
        return "";
    }

    if (typeof obj === "string")
    {
        return obj;
    }

    keys = get_sorted_keys(obj);

    for (i = 0; i < keys.length; i++)
    {
        key = keys[i];
        if (key === "background-color")
        {
            continue;
        }
        parts.push(json_key(key) + ":" + json_value(obj[key]));
    }

    return parts.join(",");
}

function inline_object_to_json(obj)
{
    var keys;
    var parts = [];
    var i;
    var key;

    if (!obj)
    {
        return "{}";
    }

    keys = get_sorted_keys(obj);

    for (i = 0; i < keys.length; i++)
    {
        key = keys[i];
        parts.push(json_key(key) + ":" + json_value(obj[key]));
    }

    return "{" + parts.join(",") + "}";
}

function get_sorted_keys(obj)
{
    var keys = get_keys(obj);
    keys.sort(compare_keys);
    return keys;
}

function get_keys(obj)
{
    var keys = [];
    var key;

    if (!obj)
    {
        return keys;
    }

    for (key in obj)
    {
        if (!Object.prototype.hasOwnProperty.call(obj, key))
        {
            continue;
        }

        keys.push(key);
    }

    return keys;
}

function compare_keys(a, b)
{
    var ai = parseInt(a, 10);
    var bi = parseInt(b, 10);
    var a_is_number = String(ai) === a;
    var b_is_number = String(bi) === b;

    if (a_is_number && b_is_number)
    {
        return ai - bi;
    }

    if (a < b)
    {
        return -1;
    }

    if (a > b)
    {
        return 1;
    }

    return 0;
}

function handle_indent(level)
{
    var s = "";
    var i;

    for (i = 0; i < level; i++)
    {
        s += "    ";
    }

    return s;
}

function json_key(key)
{
    return JSON.stringify(key);
}

function json_value(value)
{
    if (value === undefined)
    {
        return "null";
    }

    return JSON.stringify(value);
}

function debug()
{
    if (!DEBUG_JSON_FORMAT)
    {
        return;
    }
    let args = [];
    for (let i = 0; i < arguments.length; i += 1)
    {
        args.push(String(arguments[i]));
    }

    osc_send("/log", args);
}
