// ButtonWidget.js

const DEBUG_BUTTON = false;

class ButtonWidget extends MidiWidget
{
    constructor(spec = {})
    {
        super(Object.assign({}, spec, { type: "button" }));

        this.type = "button";
        this.value = spec.value !== undefined ? parse_integer(spec.value, 0) : 0;
        this.overlay_element = null;
        this.led_color = spec.led_color || spec["led-color"] || "";

        this._items = [];
        this._text_color_values = [];
        this._background_color_values = [];

        this._base_text = this.text ? this.text.text : "";
        this._base_text_color = this.text ? this.text.text_color : "";
        this._base_background_color = this.background_color || "";

        this.normalizeValue();

        if (spec.items !== undefined)
        {
            this.items = spec.items;
        }

        if (spec.text_color !== undefined)
        {
            this.setStateColorValues("text_color", spec.text_color);
        }

        if (spec.background_color !== undefined)
        {
            this.setStateColorValues("background_color", spec.background_color);
        }

        this.applyCurrentStateAppearance();
        this.normalize();
    }

    get items()
    {
        return this._items;
    }

    set items(value)
    {
        var parsed = this.tryParseStateArrayStrict(value, "items");

        if (parsed === null)
        {
            return;
        }

        this._items = parsed;
        this.applyCurrentStateAppearance();

        if (this.dom_element)
        {
            this.draw();
        }
    }

    setStateColorValues(key, value)
    {
        var parsed = null;

        if (value === undefined || value === null)
        {
            return false;
        }

        if (String(value).indexOf("|") < 0)
        {
            if (key === "text_color")
            {
                this._text_color_values = [];
                this._base_text_color = String(value || "");
            }
            else if (key === "background_color")
            {
                this._background_color_values = [];
                this._base_background_color = String(value || "");
            }

            return false;
        }

        parsed = this.tryParseStateArrayStrict(value, key === "text_color" ? "text-color" : "background-color");

        if (parsed === null)
        {
            return false;
        }

        if (key === "text_color")
        {
            this._text_color_values = parsed;
            this._base_text_color = "";
            return true;
        }

        if (key === "background_color")
        {
            this._background_color_values = parsed;
            this._base_background_color = "";
            return true;
        }

        return false;
    }

    setState(properties = {})
    {
        var needs_redraw = false;
        var parsed = null;

        super.setState(properties);

        if (properties.text !== undefined && this.text)
        {
            this._base_text = this.text.text;
            needs_redraw = true;
        }

        if (properties.text_color !== undefined && this.text)
        {
            this.setStateColorValues("text_color", properties.text_color);
            needs_redraw = true;
        }

        if (properties["text-color"] !== undefined && this.text)
        {
            this.setStateColorValues("text_color", properties["text-color"]);
            needs_redraw = true;
        }

        if (properties.background_color !== undefined)
        {
            this.setStateColorValues("background_color", properties.background_color);
            needs_redraw = true;
        }

        if (properties["background-color"] !== undefined)
        {
            this.setStateColorValues("background_color", properties["background-color"]);
            needs_redraw = true;
        }

        if (properties.value !== undefined)
        {
            this.value = parse_integer(properties.value, this.value);
            this.normalizeValue();
            needs_redraw = true;
        }

        if (properties.items !== undefined)
        {
            parsed = this.tryParseStateArrayStrict(properties.items, "items");

            if (parsed !== null)
            {
                this._items = parsed;
                needs_redraw = true;
            }
        }


        if (properties.led_color !== undefined)
        {
            this.led_color = properties.led_color || "";
        }

        if (properties["led-color"] !== undefined)
        {
            this.led_color = properties["led-color"] || "";
        }


        this.applyCurrentStateAppearance();

        if (needs_redraw && this.dom_element)
        {
            this.draw();
        }
    }

    normalizeValue()
    {
        this.value = parse_integer(this.value, 0);

        if (this.value !== 0)
        {
            this.value = 1;
        }
    }

    parseStateArray(value)
    {
        var text = "";
        var parts = null;
        var i = 0;

        if (value === undefined || value === null)
        {
            return [];
        }

        if (Object.prototype.toString.call(value) === "[object Array]")
        {
            parts = value.slice(0);

            for (i = 0; i < parts.length; i++)
            {
                if (parts[i] === undefined || parts[i] === null)
                {
                    parts[i] = "";
                }
                else
                {
                    parts[i] = String(parts[i]);
                }
            }

            return parts;
        }

        text = String(value);

        if (text === "")
        {
            return [];
        }

        if (text.indexOf("|") >= 0)
        {
            parts = text.split("|");

            for (i = 0; i < parts.length; i++)
            {
                parts[i] = String(parts[i]);
            }

            return parts;
        }

        return [text];
    }

    parseStateArrayStrict(value, property_name)
    {
        var parts = this.parseStateArray(value);

        if (parts.length === 0)
        {
            return [];
        }

        if (parts.length !== 2)
        {
            throw new Error(property_name + " requires exactly 2 entries");
        }

        return parts;
    }

    tryParseStateArrayStrict(value, property_name)
    {
        var message = "";

        try
        {
            return this.parseStateArrayStrict(value, property_name);
        }
        catch (e)
        {
            message = e && e.message ? e.message : (property_name + " parse error");

            if (typeof osc_send === "function")
            {
                osc_send("/warning", [this.path || "<no-path>", property_name, message, JSON.stringify(value)]);
            }

            if (typeof console !== "undefined" && console && typeof console.log === "function")
            {
                console.log("WARNING", this.path || "<no-path>", property_name, message, JSON.stringify(value));
            }

            return null;
        }
    }

    getStateArrayValue(list, state_value)
    {
        var index = parse_integer(state_value, 0);

        if (!list || list.length <= 0)
        {
            return "";
        }

        if (index < 0)
        {
            index = 0;
        }

        if (index >= list.length)
        {
            index = list.length - 1;
        }

        return list[index];
    }

    hasAlternateLayout()
    {
        return this._items.length === 2 || this._text_color_values.length === 2 || this._background_color_values.length === 2;
    }

    getStateText()
    {
        return this.getStateArrayValue(this._items, this.value);
    }

    getStateTextColor()
    {
        return this.getStateArrayValue(this._text_color_values, this.value);
    }

    getStateBackgroundColor()
    {
        return this.getStateArrayValue(this._background_color_values, this.value);
    }

    getRenderTextForState()
    {
        var state_text = "";
        var first_item = "";
        var second_item = "";

        if (this._items.length !== 2)
        {
            return this._base_text;
        }

        state_text = this.getStateText();

        if (state_text !== "")
        {
            if (this.value === 0)
            {
                first_item = String(this._items[0]).toLowerCase();
                second_item = String(this._items[1]).toLowerCase();

                if (first_item === "off" && second_item !== "on")
                {
                    return this._base_text;
                }
            }

            return state_text;
        }

        return this._base_text;
    }

    getRenderTextColorForState()
    {
        var state_color = "";

        if (this._text_color_values.length !== 2)
        {
            return this._base_text_color;
        }

        state_color = this.getStateTextColor();

        if (state_color !== "")
        {
            return resolve_companion_color(this._text_color_values.join("|"), this.value, this.path, "text-color");
        }

        return this._base_text_color;
    }

    getRenderBackgroundColorForState()
    {
        var state_background = "";

        if (this._background_color_values.length !== 2)
        {
            return this._base_background_color;
        }

        state_background = this.getStateBackgroundColor();

        if (state_background !== "")
        {
            return resolve_companion_color(this._background_color_values.join("|"), this.value, this.path, "background-color");
        }

        return this._base_background_color;
    }

    applyCurrentStateAppearance()
    {
        this.background_color = this.getRenderBackgroundColorForState();

        if (this.text)
        {
            this.text.text = this.getRenderTextForState();
            this.text.text_color = this.getRenderTextColorForState();

            if (this.text.text_color === "*" || this.text.text_color === "auto")
            {
                this.text.text_color = auto_text_color(this.background_color);
            }
        }

        this.syncVisualState();
        this.syncLedState();
    }

    getRenderLedColorForState()
    {
        var color = "";

        if (this.type === "toggle")
        {
            if (this.led_color !== undefined && this.led_color !== null && this.led_color !== "")
            {
                if (String(this.led_color).indexOf("|") >= 0)
                {
                    color = resolve_companion_color(this.led_color, this.value, this.path, "led-color");
                    return this.value !== 0 ? active_led_color(color) : visible_led_color(color);
                }

                if (this.value === 0)
                {
                    return "gray";
                }

                return active_led_color(this.led_color);
            }

            if (this.value === 0)
            {
                return "gray";
            }

            if (this.background_color !== undefined && this.background_color !== null && this.background_color !== "")
            {
                color = resolve_companion_color(this.background_color, 1, this.path, "background-color");
                return active_led_color(color);
            }

            return "chalk";
        }

        if (this.led_color !== undefined && this.led_color !== null && this.led_color !== "")
        {
            color = resolve_companion_color(this.led_color, this.value, this.path, "led-color");
            return this.value !== 0 ? active_led_color(color) : visible_led_color(color);
        }

        if (this.control && this.control.indexOf("select-") === 0)
        {
            if (this.background_color !== undefined && this.background_color !== null && this.background_color !== "")
            {
                color = resolve_companion_color(this.background_color, this.value, this.path, "background-color");
                return this.value !== 0 ? active_led_color(color) : visible_led_color(color);
            }
        }

        if (this.type === "button" || this.type === "menu")
        {
            if (this.value !== 0)
            {
                return "chalk";
            }

            return "gray";
        }

        if (this.background_color !== undefined && this.background_color !== null && this.background_color !== "")
        {
            color = this.background_color;
            return this.value !== 0 ? active_led_color(color) : visible_led_color(color);
        }

        return "gray";
    }

    syncLedState()
    {
        var color = this.getRenderLedColorForState();
        var index = color_led_index(color);

        if (DEBUG_BUTTON)
        {
            osc_send("debug_led_value", ["control", this.control, "value", this.value, "background_color", this.background_color, "led_color", this.led_color, "resolved_color", color, "index", index]);
        }

        return this.call_native("controls_set_led_color_index", this.control, index);
    }

    debugIncoming(kind, payload = {})
    {
        var line = "";

        if (!DEBUG_BUTTON)
        {
            return;
        }

        line = "BUTTONDBG incoming kind=" + kind +
            " path=" + this.path +
            " payload=" + JSON.stringify(payload);

        console.log(line);
        osc_send("/debug", [line]);
    }

    createOverlay()
    {
        var overlay_el = null;

        if (!this.dom_element)
        {
            return;
        }

        if (this.overlay_element)
        {
            this.overlay_element.style.left = px(this.inner_x);
            this.overlay_element.style.top = px(this.inner_y);
            this.overlay_element.style.width = px(this.inner_width);
            this.overlay_element.style.height = px(this.inner_height);
            this.overlay_element.style.display = "block";
            this.requestDisplayUpdate();
            return;
        }

        overlay_el = document.createElement("div");
        overlay_el.setAttribute("data-role", "button-overlay");
        overlay_el.style.position = "absolute";
        overlay_el.style.left = px(this.inner_x);
        overlay_el.style.top = px(this.inner_y);
        overlay_el.style.width = px(this.inner_width);
        overlay_el.style.height = px(this.inner_height);
        overlay_el.style.backgroundColor = "rgba(255,255,255,0.35)";
        overlay_el.style.border = "1px solid rgba(255,255,255,0.75)";
        overlay_el.style.pointerEvents = "none";
        overlay_el.style.boxSizing = "border-box";
        overlay_el.style.zIndex = "1000";
        overlay_el.style.display = "block";

        this.dom_element.append(overlay_el);
        this.overlay_element = overlay_el;
        this.requestDisplayUpdate();
    }

    removeOverlay()
    {
        if (this.overlay_element && this.overlay_element.parentNode)
        {
            this.overlay_element.parentNode.removeChild(this.overlay_element);
            this.requestDisplayUpdate();
        }

        this.overlay_element = null;
    }

    syncVisualState()
    {
        if (!this.dom_element)
        {
            return;
        }

        if (this.hasAlternateLayout())
        {
            this.removeOverlay();
            return;
        }

        if (this.value === 0)
        {
            this.removeOverlay();
            return;
        }

        this.createOverlay();
    }

    setValueInternal(next_value)
    {
        this.value = parse_integer(next_value, 0);

        if (this.value !== 0)
        {
            this.value = 1;
        }

        this.applyCurrentStateAppearance();
    }

    sendValueOsc()
    {
        osc_send(this.path, ["value", this.value]);

        return {
            ok: true,
            code: "ok",
            message: "value sent"
        };
    }

    applyValueChange(silent, next_value, source_name)
    {
        var old_value = this.value;
        var has_alternate_layout = false;

        next_value = parse_integer(next_value, 0);

        if (next_value !== 0)
        {
            next_value = 1;
        }

        if (this.value === next_value)
        {
            if (silent)
            {
                return {
                    ok: true,
                    code: "ok",
                    message: "silent value unchanged"
                };
            }

            return this.sendValueOsc();
        }

        this.setValueInternal(next_value);

        this.debugIncoming(source_name + ".applied",
        {
            old_value: old_value,
            new_value: this.value,
            silent: !!silent
        });

        has_alternate_layout = this.hasAlternateLayout();

        if (!has_alternate_layout)
        {
            if (this.value === 1)
            {
                this.createOverlay();
            }
            else
            {
                this.removeOverlay();
            }
        }
        else if (this.dom_element)
        {
            this.draw();
        }

        if (silent)
        {
            return {
                ok: true,
                code: "ok",
                message: "silent value applied"
            };
        }

        return this.sendValueOsc();
    }

    on_bang(silent, atoms)
    {
        var next_value = this.value === 0 ? 1 : 0;

        this.debugIncoming("on_bang",
        {
            
            
            old_value: this.value,
            new_value: next_value
        });

        return this.applyValueChange(silent, next_value, "bang");
    }

    on_value(silent, atoms)
    {
        var value = atoms && atoms.length > 0 ? atoms[0] : 0;
        var numeric_value = parse_number(value, 0);
        var next_value = numeric_value === 0 ? 0 : 1;

        this.debugIncoming("on_value",
        {
            silent: !!silent,
            atoms: atoms || [],
            value: value,
            numeric_value: numeric_value,
            new_value: next_value
        });

        return this.applyValueChange(silent, next_value, "value");
    }


    on_cc(value)
    {
        var next_value = value === 0 ? 0 : 1;

        this.debugIncoming("on_cc",
        {
            value: value,
            new_value: next_value,
            cc_widget: this.cc,
            cc_touch_widget: this.cc_touch
        });

        return this.applyValueChange(false, next_value, "cc");
    }


    draw()
    {
        this.applyCurrentStateAppearance();
        super.draw();
        this.syncVisualState();

        this.debugIncoming("draw",
        {
            value: this.value,
            overlay_active: this.overlay_element ? true : false,
            has_alternate_layout: this.hasAlternateLayout(),
            render_text: this.text ? this.text.text : "",
            render_text_color: this.text ? this.text.text_color : "",
            render_background_color: this.background_color,
            inner_x: this.inner_x,
            inner_y: this.inner_y,
            inner_width: this.inner_width,
            inner_height: this.inner_height,
            cc: this.cc,
            cc_touch: this.cc_touch
        });

        this.requestDisplayUpdate();
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();

        json.type = this.type;
        json.value = this.value;
        json.pressed = this.value;
        json.overlay_active = this.overlay_element ? 1 : 0;
        json.items = this.items.slice(0);

        if (this._text_color_values.length === 2)
        {
            json.text_color = this._text_color_values.join("|");
        }

        if (this._background_color_values.length === 2)
        {
            json.background_color = this._background_color_values.join("|");
        }

        return json;
    }
}
