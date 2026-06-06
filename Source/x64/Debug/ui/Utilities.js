// Utilities.js
// Split 1 from base2.js

function join_path(path, id)
{
    return path + "/" + id;
}

function get_target()
{
    return get_screen_type();
}

function get_document_filename(default_filename)
{
    if (window.__screen_definition_file)
    {
        return String(window.__screen_definition_file).replace(/\\/g, "/");
    }

    return default_filename || "";
}

function get_document_title()
{
    var title_node = document.$("head > title");

    if (!title_node)
    {
        return "";
    }

    return title_node.textContent || title_node.text || "";
}

function clear_generated_nodes(screen)
{
    var nodes = screen.$$("[data-generated]");
    var i;

    for (i = 0; i < nodes.length; i++)
    {
        nodes[i].remove();
    }
}

function clear_debug_nodes(screen)
{
    var nodes = screen.$$("[data-debug]");
    var i;

    for (i = 0; i < nodes.length; i++)
    {
        nodes[i].remove();
    }
}

function parse_integer(v, d)
{
    var n = parseInt(v, 10);

    if (isNaN(n))
    {
        return d;
    }

    return n;
}

function px(v)
{
    return v + "px";
}

function get_error_message(e)
{
    if (e === undefined || e === null)
    {
        return "Unknown error";
    }

    if (typeof e === "string")
    {
        return e;
    }

    if (e.message)
    {
        return e.message;
    }

    return String(e);
}

function get_error_stack(e)
{
    if (!e)
    {
        return "";
    }

    if (e.stack)
    {
        return String(e.stack);
    }

    return "";
}

function format_error_details(e)
{
    var text = "";
    var message = get_error_message(e);
    var stack = get_error_stack(e);

    text += "ERROR: " + message;

    if (stack)
    {
        text += "\n\nCALL STACK:\n" + stack;
    }

    return text;
}

function show_fatal_error(e)
{
    var details = format_error_details(e);

    try
    {
        console.error(details);
    }
    catch (console_error)
    {
        // Ignore console logging errors
    }

    try
    {
        log(details);
    }
    catch (log_error)
    {
        // Ignore host logging errors
    }
}

function install_global_error_handlers()
{
    if (window.__fatal_error_handlers_installed__)
    {
        return;
    }

    window.__fatal_error_handlers_installed__ = true;

    window.onerror = function (message, source, lineno, colno, error)
    {
        var err;

        if (error)
        {
            show_fatal_error(error);
            return false;
        }

        err = new Error(String(message || "Unknown error"));
        err.source = source || "";
        err.line = lineno || 0;
        err.column = colno || 0;

        if (!err.stack)
        {
            err.stack =
                "at " + (source || "<unknown>") +
                ":" + (lineno || 0) +
                ":" + (colno || 0);
        }

        show_fatal_error(err);
        return false;
    };

    window.addEventListener("unhandledrejection", function (event)
    {
        if (event && event.reason)
        {
            show_fatal_error(event.reason);
            return;
        }

        show_fatal_error(new Error("Unhandled promise rejection"));
    });
}

function log()
{
    Window.this.xcall("log", Array.prototype.join.call(arguments, " "));
}

install_global_error_handlers();

function get_optional_integer_attr(node, name)
{
    var value;

    if (!node)
    {
        return undefined;
    }

    value = node.getAttribute(name);

    if (value === null || value === "")
    {
        return undefined;
    }

    return parse_integer(value, 0);
}

function get_optional_string_attr(node, name)
{
    var value;

    if (!node)
    {
        return undefined;
    }

    value = node.getAttribute(name);

    if (value === null || value === "")
    {
        return undefined;
    }

    return value;
}

function get_screen_type()
{
    var screen = document.$("#screen");
    var type = "";

    if (screen)
    {
        type = screen.getAttribute("type");
    }

    if (!type)
    {
        type = "screen";
    }

    return type.toLowerCase();
}
