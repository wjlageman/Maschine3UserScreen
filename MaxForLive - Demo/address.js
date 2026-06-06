post("COMPILING address.js STARTS\n");

"use strict";

autowatch = 1;

inlets = 1;
outlets = 4;
var regions_menu = 0;
var widgets_menu = 1;
var region_address = 2;
var widget_address = 3;

var g_dict = null;
var g_containers = [];
var g_widgets = [];
var g_containers_by_address = {};
var g_widgets_by_address = {};
var g_current_container_address = "";
var g_current_tab_widgets = [];

function parse_structure()
{
    try
    {
        g_dict = new Dict("maschine3");
        rebuild_indexes();
        output_container_menu();
        post("address.js: structure parsed from dict maschine3\n");
    }
    catch (e)
    {
        g_dict = null;
        g_containers = [];
        g_widgets = [];
        g_containers_by_address = {};
        g_widgets_by_address = {};
        g_current_container_address = "";
        g_current_tab_widgets = [];
        post("address.js: parse error: " + String(e && e.message ? e.message : e) + "\n");
    }
}

function select_container(container_address)
{
    var i = 0;
    var widget = "";
    var container = null;
    var tabs = ["tabs"];

    outlet(region_address, container_address);


    if (!g_dict)
    {
        post("address.js: no structure loaded\n");
        return;
    }

    container_address = normalize_address(container_address);
    g_current_container_address = container_address;
    g_current_tab_widgets = [];

    if (container_address === "all-widgets")
    {

        if (g_widgets.length === 0)
        {
            tabs.push("<empty>");
        }
        else
        {
            for (i = 0; i < g_widgets.length; i += 1)
            {
                widget = g_widgets[i];

                tabs.push(last_address_part(widget));
                g_current_tab_widgets.push(widget);
            }
        }

        outlet.apply(null, [widgets_menu].concat(tabs));
        outlet(widgets_menu, -1);
        return;
    }

    if (!g_containers_by_address[container_address])
    {
        post("address.js: container address not found: " + container_address + "\n");
        outlet(widgets_menu, "tabs", "<empty>");
        outlet(widgets_menu, -1);
        return;
    }

    container = read_dict_object(container_address);

    if (!container)
    {
        post("address.js: container data not found: " + container_address + "\n");
        outlet(widgets_menu, "tabs", "<empty>");
        outlet(widgets_menu, -1);
        return;
    }

    add_container_widgets_to_tabs(container, tabs);
    if (g_current_tab_widgets.length === 0)
    {
        tabs.push("<empty>");
    }
    outlet.apply(null, [widgets_menu].concat(tabs));
    outlet(widgets_menu, -1);
}

function add_container_widgets_to_tabs(container, tabs)
{
    var key = "";
    var ref = null;
    var widget_id = "";
    var widget_name = "";

    if (!container || !container.widgets)
    {
        return;
    }

    for (key in container.widgets)
    {
        if (!container.widgets.hasOwnProperty(key))
        {
            continue;
        }

        ref = container.widgets[key];
        widget_id = ref && ref.id ? normalize_address(ref.id) : normalize_address(key);
        widget_name = ref && ref.name ? ref.name : last_address_part(widget_id);

        tabs.push(widget_name);
        g_current_tab_widgets.push(widget_id);
    }
}

function get_widget_address(identifier, tab_index)
{
    var widget = "";
    var obj = null;
    var json = "";

    if (!g_dict)
    {
        post("address.js: no structure loaded\n");
        return;
    }
    widget = resolve_widget_address(identifier, tab_index);

    if (!widget)
    {
        post("ERROR", "address.js: widget not found: " + String(identifier) + "\n");
        return;
    }
    outlet(widget_address, widget);
}

function resolve_widget_address(identifier, tab_index)
{
    var i = 0;
    var index = -1;
    var address = normalize_address(identifier);
    var local_address = "";
    var widget = "";

    index = widget_index_from_argument(tab_index);

    if (index < 0)
    {
        index = widget_index_from_argument(identifier);
    }

    if (index >= 0 && index < g_current_tab_widgets.length)
    {
        return g_current_tab_widgets[index];
    }

    if (address && g_widgets_by_address[address])
    {
        return address;
    }

    if (address && address.indexOf("/") < 0 && g_current_container_address)
    {
        local_address = normalize_address(g_current_container_address) + "/" + address;

        if (g_widgets_by_address[local_address])
        {
            return local_address;
        }
    }

    for (i = 0; i < g_current_tab_widgets.length; i += 1)
    {
        widget = g_current_tab_widgets[i];

        if (last_address_part(widget) === identifier || widget === address || widget === local_address)
        {
            return widget;
        }
    }

    for (i = 0; i < g_widgets.length; i += 1)
    {
        widget = g_widgets[i];

        if (last_address_part(widget) === identifier || widget === address || widget === local_address)
        {
            return widget;
        }
    }

    return "";
}

function widget_index_from_argument(value)
{
    var index = -1;

    if (value === undefined || value === null || value === "")
    {
        return -1;
    }

    index = parseInt(value, 10);

    if (isNaN(index) || String(index) !== String(value))
    {
        return -1;
    }

    if (index >= 0 && index < g_current_tab_widgets.length)
    {
        return index;
    }

    if (index > 0 && index <= g_current_tab_widgets.length)
    {
        return index - 1;
    }

    return -1;
}

function output_container_menu()
{
    var i = 0;
    var container_address = "";
    var tabs = ["tabs", "all-widgets"];
    var item_count = 1;
    var tab_height = 0;

    for (i = 0; i < g_containers.length; i += 1)
    {
        container_address = g_containers[i];

        tabs.push(container_address);

        item_count += 1;
    }
    outlet.apply(null, [regions_menu].concat(tabs));
    outlet(regions_menu, -1);
}

function rebuild_indexes()
{
    g_containers = [];
    g_widgets = [];
    g_containers_by_address = {};
    g_widgets_by_address = {};
    g_current_container_address = "";
    g_current_tab_widgets = [];
    collect_root_objects();
}

function collect_root_objects()
{
    var i = 0;
    var keys = dict_keys(g_dict);
    var key = "";
    var node = null;
    var address = "";

    for (i = 0; i < keys.length; i += 1)
    {
        key = keys[i];
        node = read_dict_object(key);

        if (!node || typeof node !== "object")
        {
            continue;
        }

        address = normalize_address(node.id || node.address || key);

        if (is_container_node(node))
        {
            add_container(address);
        }
        else if (is_widget_node(node))
        {
            add_widget(address);
        }
    }
}

function add_container(address)
{
    g_containers.push(address);
    g_containers_by_address[address] = true;
}

function add_widget(address)
{
    g_widgets.push(address);
    g_widgets_by_address[address] = true;
}

function is_container_node(node)
{
    return !!(node && node.type === "region" && node.widgets);
}

function is_widget_node(node)
{
    return !!(
        node &&
        node.type &&
        node.type !== "region" &&
        node.address
    );
}

function read_dict_object(key)
{
    var value = null;

    if (!g_dict)
    {
        return null;
    }

    key = normalize_address(key);

    try
    {
        value = g_dict.get(key);
    }
    catch (e)
    {
        post("ERROR", e, "\n");
    }

    return dict_value_to_object(value);
}

function dict_value_to_object(value)
{
    if (!value)
    {
        return null;
    }

    if (typeof value === "string")
    {
        try
        {
            return JSON.parse(value);
        }
        catch (e)
        {
            return null;
        }
    }

    if (typeof value.stringify === "function")
    {
        try
        {
            return JSON.parse(value.stringify());
        }
        catch (e2)
        {
            return null;
        }
    }

    if (typeof value === "object")
    {
        return value;
    }

    return null;
}

function dict_keys(dict)
{
    var keys = [];

    if (!dict || typeof dict.getkeys !== "function")
    {
        return keys;
    }

    keys = dict.getkeys();
    if (!keys)
    {
        return [];
    }

    if (Object.prototype.toString.call(keys) === "[object Array]")
    {
        return keys;
    }

    return [String(keys)];
}

function normalize_address(address)
{
    address = String(address || "");
    while (address.charAt(0) === "/")
    {
        address = address.slice(1);
    }
    return address;
}

function last_address_part(address)
{
    var parts = normalize_address(address).split("/");
    if (parts.length === 0)
    {
        return "";
    }
    return parts[parts.length - 1];
}

post("COMPILING address.js ENDS\n");
