// BangWidget.js

const DEBUG_BANG = false;

class BangWidget extends MidiWidget
{
    constructor(spec = {})
    {
        super(Object.assign({}, spec, { type: "bang" }));

        this.type = "bang";
        this.blink = new BlinkState(spec);
        this.blink_timer_id = 0;
        this.blink_overlay_element = null;
        this.led_color = spec.led_color || spec["led-color"] || "";

        this.syncLedState();
    }

    setState(properties = {})
    {
        if (this.blink)
        {
            this.blink.setState(properties);
        }

        super.setState(properties);

        if (properties.led_color !== undefined)
        {
            this.led_color = properties.led_color || "";
        }

        if (properties["led-color"] !== undefined)
        {
            this.led_color = properties["led-color"] || "";
        }


        this.syncLedState();
    }

    getBaseLedColorForState()
    {
        if (this.led_color !== undefined && this.led_color !== null && this.led_color !== "")
        {
            return visible_led_color(resolve_companion_color(this.led_color, 0, this.path, "led-color"));
        }

        if (this.background_color !== undefined && this.background_color !== null && this.background_color !== "")
        {
            return visible_led_color(resolve_companion_color(this.background_color, 0, this.path, "background-color"));
        }

        return "gray";
    }

    getBlinkLedColorForState()
    {
        var color = "";
        var partner = "";

        if (this.led_color !== undefined && this.led_color !== null && this.led_color !== "")
        {
            if (String(this.led_color).indexOf("|") >= 0)
            {
                return active_led_color(resolve_companion_color(this.led_color, 1, this.path, "led-color"));
            }

            partner = color_partner_name(this.led_color);
            return active_led_color(partner !== "" ? partner : this.led_color);
        }

        if (this.background_color !== undefined && this.background_color !== null && this.background_color !== "")
        {
            if (String(this.background_color).indexOf("|") >= 0)
            {
                return active_led_color(resolve_companion_color(this.background_color, 1, this.path, "background-color"));
            }

            partner = color_partner_name(this.background_color);
            return active_led_color(partner !== "" ? partner : this.background_color);
        }

        color = this.getBaseLedColorForState();
        partner = color_partner_name(color);

        return active_led_color(partner !== "" ? partner : color);
    }

    syncLedState()
    {
        var color = this.getBaseLedColorForState();
        var index = color_led_index(color);

        return this.call_native("controls_set_led_color_index", this.control, index);
    }

    syncBlinkLedState()
    {
        var color = this.getBlinkLedColorForState();
        var index = color_led_index(color);

        return this.call_native("controls_set_led_color_index", this.control, index);
    }

    triggerBlink(duration_ms)
    {
        var self = this;
        var duration = duration_ms !== undefined ? parse_integer(duration_ms, this.blink.duration_ms) : this.blink.duration_ms;
        var overlay_el = null;

        this.debugIncoming("blink.start",
        {
            duration_ms: duration,
            timer_active: this.blink_timer_id ? true : false,
            overlay_active: this.blink_overlay_element ? true : false
        });

        this.syncBlinkLedState();

        if (!this.dom_element)
        {
            throw new Error("BangWidget.triggerBlink() requires this.dom_element to be set");
        }

        if (!this.blink_overlay_element)
        {
            overlay_el = document.createElement("div");
            overlay_el.setAttribute("data-role", "bang-blink-overlay");
            overlay_el.style.position = "absolute";
            overlay_el.style.left = px(this.inner_x);
            overlay_el.style.top = px(this.inner_y);
            overlay_el.style.width = px(this.inner_width);
            overlay_el.style.height = px(this.inner_height);
            overlay_el.style.backgroundColor = "rgba(255,255,255,0.28)";
            overlay_el.style.pointerEvents = "none";
            overlay_el.style.boxSizing = "border-box";

            this.dom_element.append(overlay_el);
            this.blink_overlay_element = overlay_el;
            this.requestDisplayUpdate();

            this.debugIncoming("blink.overlay.created",
            {
                inner_x: this.inner_x,
                inner_y: this.inner_y,
                inner_width: this.inner_width,
                inner_height: this.inner_height
            });
        }

        if (this.blink_timer_id)
        {
            clearTimeout(this.blink_timer_id);
            this.blink_timer_id = 0;
        }

        this.blink_timer_id = setTimeout(function ()
        {
            self.blink_timer_id = 0;

            if (self.blink_overlay_element && self.blink_overlay_element.parentNode)
            {
                self.blink_overlay_element.parentNode.removeChild(self.blink_overlay_element);
            }

            self.blink_overlay_element = null;

            self.syncLedState();
            self.requestDisplayUpdate();

            self.debugIncoming("blink.end",
            {
                duration_ms: duration
            });
        }, duration);
    }

    debugIncoming(kind, payload = {})
    {
        var line = "";

        if (!DEBUG_BANG)
        {
            return;
        }

        line = "BANGDBG incoming kind=" + kind +
            " path=" + this.path +
            " payload=" + JSON.stringify(payload);

        console.log(line);
        osc_send("/debug", [line]);
    }

    on_bang(silent, atoms)
    {
        this.debugIncoming("on_bang",
        {
            silent: !!silent,
            atoms: atoms || []
        });

        if (silent)
        {
            osc_send("/warning", [
                this.path,
                "silent event is swallowed by " + this.type + " at " + this.path
            ]);

            return {
                ok: true,
                code: "ok",
                message: "silent bang swallowed"
            };
        }

        this.triggerBlink();

        osc_send(this.path, ["bang"]);

        return {
            ok: true,
            code: "ok",
            message: "bang sent"
        };
    }

    on_value(silent, atoms)
    {
        var value = atoms && atoms.length > 0 ? atoms[0] : 0;
        var numeric_value = parse_number(value, 0);

        this.debugIncoming("on_value",
        {
            silent: !!silent,
            atoms: atoms || [],
            value: value,
            numeric_value: numeric_value
        });

        if (silent)
        {
            osc_send("/warning", [
                this.path,
                "silent event is swallowed by " + this.type + " at " + this.path
            ]);

            return {
                ok: true,
                code: "ok",
                message: "silent value swallowed"
            };
        }

        if (numeric_value === 0)
        {
            return {
                ok: true,
                code: "ok",
                message: "zero value ignored"
            };
        }

        this.triggerBlink();

        osc_send(this.path, ["bang"]);

        return {
            ok: true,
            code: "ok",
            message: "bang sent"
        };
    }

    on_cc(value)
    {
        this.debugIncoming("on_cc",
        {
            value: value,
            cc_widget: this.cc,
            cc_touch_widget: this.cc_touch
        });

        if (value === 0)
        {
            return {
                ok: true,
                code: "ok",
                message: "zero cc value ignored"
            };
        }

        this.triggerBlink();

        osc_send(this.path, ["bang"]);

        return {
            ok: true,
            code: "ok",
            message: "bang sent"
        };
    }


    draw()
    {
        super.draw();

        if (!this.blink_timer_id && !this.blink_overlay_element)
        {
            this.syncLedState();
        }

        this.debugIncoming("draw",
        {
            overlay_active: this.blink_overlay_element ? true : false,
            timer_active: this.blink_timer_id ? true : false,
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
        var blink_json = this.blink.getPublicData();
        var key;

        json.type = this.type;
        json.blinking = this.blink_overlay_element ? 1 : 0;

        for (key in blink_json)
        {
            json[key] = blink_json[key];
        }

        return json;
    }
}
