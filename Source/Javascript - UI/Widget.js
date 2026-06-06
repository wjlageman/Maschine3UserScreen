// Widget.js
// Core widget base class and factory
// Uses WidgetUtilities.js, WidgetBox.js and WidgetText.js

const DEBUG_WIDGET_LIFECYCLE = false;
const DEBUG_WIDGET_DRAW = false;
const DEBUG_WIDGET_FACTORY = false;

class Widget extends Box
{
    constructor(spec = {})
    {
        super(spec);

        this.id = spec.id || "widget";
        this.path = spec.path || "";
        this.type = spec.type || "widget";

        this.visible = spec.visible !== undefined ? !!spec.visible : true;
        this.active = spec.active !== undefined ? !!spec.active : false;
        this.enabled = spec.enabled !== undefined ? !!spec.enabled : true;
        this.inherited_background_color = spec.inherited_background_color || "";

        this.events = new Events(spec);
        this.output = new Output(spec);

        if (this.constructor === Widget)
        {
            this.normalize();
        }

        if (DEBUG_WIDGET_LIFECYCLE)
        {
            debug_widget_log(
                this,
                "constructor",
                "type=" + this.type +
                " rect=(" + this.xpos + "," + this.ypos + "," + this.width + "," + this.height + ")" +
                " visible=" + this.visible +
                " active=" + this.active +
                " enabled=" + this.enabled
            );
        }
    }

    getOscAddress(property_name)
    {
        var address = this.path || "";

        if (property_name === undefined || property_name === null || property_name === "")
        {
            return address;
        }

        return address + "/" + property_name;
    }

    setState(properties = {})
    {
        var key;

        if (this.events)
        {
            this.events.setState(properties);
        }

        if (this.output)
        {
            this.output.setState(properties);
        }

        for (key in properties)
        {
            if (Object.prototype.hasOwnProperty.call(properties, key))
            {
                if (key === "events" || key === "output")
                {
                    continue;
                }

                this[key] = properties[key];
            }
        }

        this.normalize();

        if (DEBUG_WIDGET_LIFECYCLE)
        {
            debug_widget_log(
                this,
                "setState",
                "type=" + this.type +
                " rect=(" + this.xpos + "," + this.ypos + "," + this.width + "," + this.height + ")" +
                " visible=" + this.visible +
                " active=" + this.active +
                " enabled=" + this.enabled
            );
        }
    }

    normalize()
    {
        this.xpos = parse_integer(this.xpos, 0);
        this.ypos = parse_integer(this.ypos, 0);
        this.width = parse_integer(this.width, 0);
        this.height = parse_integer(this.height, 0);
        this.visible = !!this.visible;
        this.active = !!this.active;
        this.enabled = !!this.enabled;

        if (DEBUG_WIDGET_LIFECYCLE)
        {
            debug_widget_log(
                this,
                "normalize",
                "type=" + this.type +
                " rect=(" + this.xpos + "," + this.ypos + "," + this.width + "," + this.height + ")" +
                " inner=(" + this.inner_x + "," + this.inner_y + "," + this.inner_width + "," + this.inner_height + ")"
            );
        }
    }

    getBoxBackgroundColor()
    {
        if (this.background_color !== undefined && this.background_color !== null && this.background_color !== "")
        {
            return this.background_color;
        }

        return this.inherited_background_color;
    }

    on_draw(silent, atoms)
    {
        if (DEBUG_WIDGET_DRAW)
        {
            debug_widget_log(
                this,
                "on_draw",
                "silent=" + (!!silent) +
                " atoms=" + JSON.stringify(atoms || [])
            );
        }

        this.draw();

        return {
            ok: true,
            code: "ok",
            message: "draw executed"
        };
    }

    draw()
    {
        if (DEBUG_WIDGET_DRAW)
        {
            debug_widget_log(
                this,
                "draw.begin",
                "type=" + this.type +
                " outer=(" + this.xpos + "," + this.ypos + "," + this.width + "," + this.height + ")" +
                " inner=(" + this.inner_x + "," + this.inner_y + "," + this.inner_width + "," + this.inner_height + ")"
            );
        }

        super.draw();

        if (DEBUG_WIDGET_DRAW)
        {
            debug_widget_log(
                this,
                "draw.end",
                "type=" + this.type +
                " background=" + JSON.stringify(this.background_color)
            );
        }
    }

    requestDisplayUpdate()
    {
        if (typeof request_display_update === "function")
        {
            return request_display_update(this.xpos, this.width);
        }

        return false;
    }

    getPublicWidgetData()
    {
        var json =
        {
            id: this.id,
            path: this.path,
            type: this.type,
            xpos: this.xpos,
            ypos: this.ypos,
            width: this.width,
            height: this.height,
            inner_x: this.inner_x,
            inner_y: this.inner_y,
            inner_width: this.inner_width,
            inner_height: this.inner_height,
            visible: this.visible,
            active: this.active,
            enabled: this.enabled
        };
        var events_json = this.events ? this.events.getPublicData() : null;
        var output_json = this.output ? this.output.getPublicData() : null;
        var key;

        if (events_json)
        {
            for (key in events_json)
            {
                json[key] = events_json[key];
            }
        }

        if (output_json)
        {
            for (key in output_json)
            {
                json[key] = output_json[key];
            }
        }

        return json;
    }

    toEntryJSON()
    {
        return {
            id: this.id,
            path: this.path,
            box: this.toJSON(),
            widget: this.getPublicWidgetData()
        };
    }
}

Widget.prototype.apply_message = OscMessage.prototype.apply_message;

class WidgetFactory
{
    static create(spec = {})
    {
        if (DEBUG_WIDGET_FACTORY)
        {
            debug_widget_factory_log(
                "create",
                "type=" + JSON.stringify(spec.type || "widget") +
                " id=" + JSON.stringify(spec.id || "widget")
            );
        }

        switch (spec.type)
        {
            case "panel": return new PanelWidget(spec);
            case "bang": return new BangWidget(spec);
            case "button": return new ButtonWidget(spec);
            case "toggle": return new ToggleWidget(spec);
            case "radio": return new RadioButtonWidget(spec);
            case "radio_button": return new RadioButtonWidget(spec);
            case "menu": return new MenuWidget(spec);
            case "dial": return new DialWidget(spec);
            case "scroll": return new ScrollWidget(spec);
            default: return new Widget(spec);
        }
    }
}

function debug_widget_log(widget, stage, msg)
{
    var path = (widget && widget.path) ? widget.path : "<no-path>";
    var line = "WIDGETDBG stage=" + stage + " path=" + path + " " + msg;

    if (typeof console !== "undefined" && console && typeof console.log === "function")
    {
        console.log(line);
    }

    if (typeof osc_send === "function")
    {
        osc_send("/debug", [line]);
    }
}

function debug_widget_factory_log(stage, msg)
{
    var line = "WIDGETFACTORYDBG stage=" + stage + " " + msg;

    if (typeof console !== "undefined" && console && typeof console.log === "function")
    {
        console.log(line);
    }

    if (typeof osc_send === "function")
    {
        osc_send("/debug", [line]);
    }
}
