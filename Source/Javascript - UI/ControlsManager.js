// ControlsManager.js

const DEBUG_CONTROLS_MANAGER = false;
const DEBUG_LED_MANAGER = false;

var ControlsDemo = (function ()
{
    var pad_colors = [
        "red", "orange", "tomato", "gold",
        "yellow", "spring", "green", "emerald",
        "pine", "teal", "lilac", "plum",
        "indigo", "orchid", "toy", "pink"
    ];

    var cached_color = "red";

    function controls_log()
    {
        var args = Array.prototype.slice.call(arguments);

        if (!DEBUG_CONTROLS_MANAGER)
        {
            return;
        }

        args.unshift("[JS]");

        log.apply(null, args);
    }

    function led_log()
    {
        var args = Array.prototype.slice.call(arguments);

        if (!DEBUG_LED_MANAGER)
        {
            return;
        }

        args.unshift("[LED]");

        log.apply(null, args);
    }

    function call_native(name)
    {
        var args = Array.prototype.slice.call(arguments, 1);
        var result;

        try
        {
            result = Window.this.xcall.apply(Window.this, [name].concat(args));
            return result;
        }
        catch (e)
        {
            controls_log("NATIVE FAILED", name, String(e && e.message ? e.message : e));
            return false;
        }
    }

    function parse_number_suffix(name, prefix)
    {
        if (!name || name.indexOf(prefix) !== 0)
        {
            return -1;
        }

        return parseInt(name.substr(prefix.length), 10);
    }

    function handle_pad(name, value)
    {
        var pad_index;

        if (value <= 0)
        {
            return;
        }

        pad_index = parse_number_suffix(name, "pad-");

        if (pad_index < 1 || pad_index > 16)
        {
            return;
        }

        cached_color = pad_colors[pad_index - 1];
        controls_log("STATE", "cached color", cached_color);
    }

    function starts_with(text, prefix)
    {
        return typeof text === "string" && text.indexOf(prefix) === 0;
    }

    function get_widget_by_id(id)
    {
        var key;
        var entry;
        var normalized_id = normalize_control_name(id);

        if (!ui_state || !ui_state.widgets_by_id)
        {
            controls_log("REGISTRY", "not ready", id);
            return null;
        }

        entry = ui_state.widgets_by_id[normalized_id];

        if (entry && entry.widget)
        {
            return entry.widget;
        }

        for (key in ui_state.widgets_by_id)
        {
            if (!Object.prototype.hasOwnProperty.call(ui_state.widgets_by_id, key))
            {
                continue;
            }

            if (normalize_control_name(key) !== normalized_id)
            {
                continue;
            }

            entry = ui_state.widgets_by_id[key];

            if (entry && entry.widget)
            {
                return entry.widget;
            }
        }

        return null;
    }

    function get_widget_by_control(control_name)
    {
        var key;
        var entry;
        var widget;
        var normalized_control_name = normalize_control_name(control_name);

        if (!ui_state || !ui_state.widgets_by_id)
        {
            controls_log("REGISTRY", "not ready for control", control_name);
            return null;
        }

        for (key in ui_state.widgets_by_id)
        {
            if (!Object.prototype.hasOwnProperty.call(ui_state.widgets_by_id, key))
            {
                continue;
            }

            entry = ui_state.widgets_by_id[key];

            if (!entry || !entry.widget)
            {
                continue;
            }

            widget = entry.widget;

            if (normalize_control_name(key) === normalized_control_name)
            {
                return widget;
            }

            if (widget.id && normalize_control_name(widget.id) === normalized_control_name)
            {
                return widget;
            }

            if (widget.control && normalize_control_name(widget.control) === normalized_control_name)
            {
                return widget;
            }
        }

        return null;
    }

    function dispatch_touch_event(name, value)
    {
        var dial_name = name.replace(/^touch-/, "dial-");
        var scroll_name = name.replace(/^touch-/, "scroll-");
        var widget = get_widget_by_control(dial_name);
        var routed_name = dial_name;
        var result;

        if (!widget)
        {
            widget = get_widget_by_control(scroll_name);
            routed_name = scroll_name;
        }

        if (!widget)
        {
            controls_log("CONTROL", "missing widget for touch", name, "->", dial_name, "or", scroll_name, value);
            return false;
        }

        if (typeof widget.on_touch !== "function")
        {
            return true;
        }

        result = widget.on_touch(value);

        if (!result || result.ok !== true)
        {
            controls_log("CONTROL", "touch rejected", routed_name, value, JSON.stringify(result));
            return false;
        }

        return true;
    }

    function get_widget_by_back(id)
    {
        var key;
        var entry;
        var widget;

        if (!ui_state || !ui_state.widgets_by_id)
        {
            controls_log("REGISTRY", "not ready for back", id);
            return null;
        }

        for (key in ui_state.widgets_by_id)
        {
            if (!Object.prototype.hasOwnProperty.call(ui_state.widgets_by_id, key))
            {
                continue;
            }

            entry = ui_state.widgets_by_id[key];

            if (!entry || !entry.widget)
            {
                continue;
            }

            widget = entry.widget;

            if (widget.back === id)
            {
                return widget;
            }
        }

        return null;
    }

    function get_widget_by_next(id)
    {
        var key;
        var entry;
        var widget;

        if (!ui_state || !ui_state.widgets_by_id)
        {
            controls_log("REGISTRY", "not ready for next", id);
            return null;
        }

        for (key in ui_state.widgets_by_id)
        {
            if (!Object.prototype.hasOwnProperty.call(ui_state.widgets_by_id, key))
            {
                continue;
            }

            entry = ui_state.widgets_by_id[key];

            if (!entry || !entry.widget)
            {
                continue;
            }

            widget = entry.widget;

            if (widget.next === id)
            {
                return widget;
            }
        }

        return null;
    }

    function get_widget_by_enter(id)
    {
        var key;
        var entry;
        var widget;

        if (!ui_state || !ui_state.widgets_by_id)
        {
            controls_log("REGISTRY", "not ready for enter", id);
            return null;
        }

        for (key in ui_state.widgets_by_id)
        {
            if (!Object.prototype.hasOwnProperty.call(ui_state.widgets_by_id, key))
            {
                continue;
            }

            entry = ui_state.widgets_by_id[key];

            if (!entry || !entry.widget)
            {
                continue;
            }

            widget = entry.widget;

            if (widget.enter === id)
            {
                return widget;
            }
        }

        return null;
    }

    function get_current_joy_step_widget()
    {
        var key;
        var entry;
        var widget;

        if (!ui_state)
        {
            controls_log("JOY-STEP", "ui_state missing");
            return null;
        }

        if (ui_state.widgets_by_id)
        {
            entry = ui_state.widgets_by_id["joy-step"];

            if (entry && entry.widget)
            {
                return entry.widget;
            }

            for (key in ui_state.widgets_by_id)
            {
                if (!Object.prototype.hasOwnProperty.call(ui_state.widgets_by_id, key))
                {
                    continue;
                }

                if (normalize_control_name(key) !== "joy-step")
                {
                    continue;
                }

                entry = ui_state.widgets_by_id[key];

                if (entry && entry.widget)
                {
                    return entry.widget;
                }
            }
        }

        if (ui_state.widgets_by_path)
        {
            for (key in ui_state.widgets_by_path)
            {
                if (!Object.prototype.hasOwnProperty.call(ui_state.widgets_by_path, key))
                {
                    continue;
                }

                if (normalize_control_name(key).indexOf("joy-step") < 0)
                {
                    continue;
                }

                entry = ui_state.widgets_by_path[key];

                if (entry && entry.widget)
                {
                    return entry.widget;
                }
            }
        }

        if (current_screen && current_screen.widget_registry && current_screen.widget_registry.by_id)
        {
            entry = current_screen.widget_registry.by_id["joy-step"];

            if (entry && entry.widget)
            {
                return entry.widget;
            }
        }

        controls_log("JOY-STEP", "widget missing");
        return null;
    }

    function dispatch_joy_step_to_current_widget(value)
    {
        var widget = get_current_joy_step_widget();
        var result;

        if (!widget)
        {
            return false;
        }

        if (typeof widget.on_cc !== "function")
        {
            controls_log("JOY-STEP", "widget has no on_cc", widget.id, widget.path);
            return false;
        }

        result = widget.on_cc(value);

        if (!result || result.ok !== true)
        {
            controls_log("JOY-STEP", "on_cc rejected", widget.id, widget.path, value, JSON.stringify(result));
            return false;
        }

        return true;
    }

    function dispatch_joy_touch_to_current_widget(value)
    {
        var widget = get_current_joy_step_widget();
        var result;

        if (!widget)
        {
            return false;
        }

        if (typeof widget.on_touch !== "function")
        {
            controls_log("JOY-TOUCH", "widget has no on_touch", widget.id, widget.path);
            return false;
        }

        result = widget.on_touch(value);

        if (!result || result.ok !== true)
        {
            controls_log("JOY-TOUCH", "on_touch rejected", widget.id, widget.path, value, JSON.stringify(result));
            return false;
        }

        return true;
    }

    function dispatch_joy_enter_to_current_widget(value)
    {
        var widget = get_current_joy_step_widget();
        var result;

        if (!widget)
        {
            return false;
        }

        if (typeof widget.on_enter !== "function")
        {
            controls_log("JOY-ENTER", "widget has no on_enter", widget.id, widget.path);
            return false;
        }

        result = widget.on_enter(value);

        if (!result || result.ok !== true)
        {
            controls_log("JOY-ENTER", "on_enter rejected", widget.id, widget.path, value, JSON.stringify(result));
            return false;
        }

        return true;
    }

    function dispatch_cc_event(name, value)
    {
        var widget = get_widget_by_control(name);
        var routed_name = name;
        var result;
        var method_name = "on_cc";

        if (!widget && starts_with(name, "dial-"))
        {
            routed_name = name.replace(/^dial-/, "scroll-");
            widget = get_widget_by_control(routed_name);
        }

        if (!widget)
        {
            widget = get_widget_by_back(name);
            routed_name = widget ? widget.id : name;
            method_name = "on_back";
        }

        if (!widget)
        {
            widget = get_widget_by_next(name);
            routed_name = widget ? widget.id : name;
            method_name = "on_next";
        }

        if (!widget)
        {
            widget = get_widget_by_enter(name);
            routed_name = widget ? widget.id : name;
            method_name = "on_enter";
        }

        if (!widget)
        {
            controls_log("CONTROL", "missing widget", name, value);
            return false;
        }

        if (typeof widget[method_name] !== "function")
        {
            controls_log("CONTROL", "widget has no method", routed_name, method_name, value);
            return false;
        }

        result = widget[method_name](value);

        if (!result || result.ok !== true)
        {
            controls_log("CONTROL", method_name + " rejected", routed_name, value, JSON.stringify(result));
            return false;
        }

        return true;
    }

    function dispatch_widget_method(widget_name, method_name, value)
    {
        var widget = get_widget_by_control(widget_name);
        var result;

        if (!widget)
        {
            controls_log("CONTROL", "missing widget", widget_name, value);
            return false;
        }

        if (typeof widget[method_name] !== "function")
        {
            controls_log("CONTROL", "widget has no method", widget_name, method_name, value);
            return false;
        }

        result = widget[method_name](value);

        if (!result || result.ok !== true)
        {
            controls_log("CONTROL", "method rejected", widget_name, method_name, value, JSON.stringify(result));
            return false;
        }

        return true;
    }

    function normalize_control_name(name)
    {
        return String(name || "").replace(/[_.]/g, "-");
    }

    function dispatch_joy_step_event(value)
    {
        return dispatch_joy_step_to_current_widget(value);
    }

    function dispatch_joy_touch_event(value)
    {
        return dispatch_joy_touch_to_current_widget(value);
    }

    function dispatch_joy_enter_event(value)
    {
        return dispatch_joy_enter_to_current_widget(value);
    }

    function receive(name, value)
    {
        name = normalize_control_name(name);

        controls_log("RECEIVE", name, value);

        if (name === "joy-step")
        {
            controls_log("RECEIVE BRANCH", "joy-step", value);
            return dispatch_joy_step_event(value);
        }

        if (name === "joy-touch")
        {
            controls_log("RECEIVE BRANCH", "joy-touch", value);
            return dispatch_joy_touch_event(value);
        }

        if (name === "joy-enter" || name === "joy-button" || name === "joy-press")
        {
            controls_log("RECEIVE BRANCH", "joy-enter", name, value);
            return dispatch_joy_enter_event(value);
        }

        if (starts_with(name, "touch-"))
        {
            controls_log("RECEIVE BRANCH", "touch", name, value);
            return dispatch_touch_event(name, value);
        }

        controls_log("RECEIVE BRANCH", "cc", name, value);
        return dispatch_cc_event(name, value);
    }


    function init()
    {
        var ok = call_native("controls_init");
        controls_log("INIT", ok);

        if (ok)
        {
            call_native("controls_reset_leds_to_default");
        }

        return ok;
    }

    function set_led_value(name, value)
    {
        return call_native("controls_set_led_value", name, value);
    }

    function set_led_color(name, value, color)
    {
        return call_native("controls_set_led_color", name, value, color);
    }

    return {
        init: init,
        receive: receive,
        set_led_value: set_led_value,
        set_led_color: set_led_color
    };
})();

function controls_receive(name, value)
{
    return ControlsDemo.receive(name, value);
}
