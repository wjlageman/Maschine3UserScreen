// MenuWidget.js

class MenuWidget extends ButtonWidget
{
    constructor(spec = {})
    {
        super(spec);

        this.type = "menu";
        this.cc2 = -1;
        this.back = spec.back || "";
        this.led_blink = new BlinkState(spec);
        this.led_blink_timer_id = 0;
        this.blink_overlay_element = null;

        this._base_text = this.text ? this.text.text : "";
        this._base_text_color = this.text ? this.text.text_color : "";
        this._base_background_color = this.background_color || "";

        if (!this._items || Object.prototype.toString.call(this._items) !== "[object Array]")
        {
            this._items = [];
        }

        this.value = spec.value !== undefined ? parse_integer(spec.value, -1) : this.value;

        if (spec.cc2 !== undefined)
        {
            this.set_cc2(spec.cc2);
        }

        if (spec.items === undefined || spec.items === null)
        {
            this.items = ["One", "Two", "Three"];
        }
        else
        {
            this.items = spec.items;
        }

        this.normalize();
        this.syncLedState();
    }

    get items()
    {
        return this._items;
    }

    set items(value)
    {
        this._items = this.parseMenuItems(value);

        if (this._items.length <= 0)
        {
            this.value = -1;
        }
        else if (this.value < 0)
        {
            this.value = 0;
        }
        else if (this.value >= this._items.length)
        {
            this.value = this._items.length - 1;
        }

        this.applyCurrentStateAppearance();

        if (this.dom_element)
        {
            this.draw();
        }
    }

    parseMenuItems(value)
    {
        var list = [];
        var text = "";
        var i = 0;

        if (value === undefined || value === null)
        {
            return [];
        }

        if (Object.prototype.toString.call(value) === "[object Array]")
        {
            list = value.slice(0);
        }
        else
        {
            text = String(value);

            if (text === "")
            {
                return [];
            }

            if (text.indexOf("|") >= 0)
            {
                list = text.split("|");
            }
            else
            {
                list = text.split(" ");
            }
        }

        for (i = 0; i < list.length; i++)
        {
            if (list[i] === undefined || list[i] === null)
            {
                list[i] = "";
            }
            else
            {
                list[i] = String(list[i]).trim();
            }
        }

        return list;
    }

    set_cc2(cc)
    {
        this.cc2 = parse_integer(cc, -1);

        if (this.cc2 >= 0)
        {
            OscMessage.set_midi_lookup(this.cc2, this.path);
        }

        return {
            ok: true,
            code: "ok",
            message: "cc2 set"
        };
    }

    normalizeValue()
    {
        this.value = parse_integer(this.value, -1);

        if (this._items.length <= 0)
        {
            this.value = -1;
            return;
        }

        if (this.value < 0)
        {
            this.value = 0;
            return;
        }

        if (this.value >= this._items.length)
        {
            this.value = this._items.length - 1;
        }
    }

    getCurrentText()
    {
        if (this.value === -1)
        {
            return "";
        }

        if (!this._items || this.value < 0 || this.value >= this._items.length)
        {
            return "";
        }

        return this._items[this.value];
    }

    applyCurrentStateAppearance()
    {
        if (this.text)
        {
            this.text.text = this.getCurrentText();
            this.text.text_color = this._base_text_color;
        }

        this.background_color = this._base_background_color;
        this.syncLedState();
    }

    getRenderLedColorForState()
    {
        var color = "";

        if (this.led_color !== undefined && this.led_color !== null && this.led_color !== "")
        {
            return visible_led_color(resolve_companion_color(this.led_color, 0, this.path, "led-color"));
        }

        if (this.control && this.control.indexOf("select-") === 0)
        {
            if (this.background_color !== undefined && this.background_color !== null && this.background_color !== "")
            {
                color = resolve_companion_color(this.background_color, this.value, this.path, "background-color");
                return this.value !== 0 ? active_led_color(color) : visible_led_color(color);
            }
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

        if (this.control && this.control.indexOf("select-") === 0)
        {
            if (this.background_color !== undefined && this.background_color !== null && this.background_color !== "")
            {
                if (String(this.background_color).indexOf("|") >= 0)
                {
                    return active_led_color(resolve_companion_color(this.background_color, 1, this.path, "background-color"));
                }

                partner = color_partner_name(this.background_color);
                return active_led_color(partner !== "" ? partner : this.background_color);
            }
        }

        return "chalk";
    }

    syncLedState()
    {
        var color = this.getRenderLedColorForState();
        var index = color_led_index(color);

        return this.call_native("controls_set_led_color_index", this.control, index);
    }

    syncBlinkLedState()
    {
        var color = this.getBlinkLedColorForState();
        var index = color_led_index(color);

        return this.call_native("controls_set_led_color_index", this.control, index);
    }

    syncBackLedState()
    {
        if (!this.back)
        {
            return true;
        }

        return this.call_native("controls_set_led_color_index", this.back, color_led_index("gray"));
    }

    syncLedState()
    {
        var result = super.syncLedState();

        this.syncBackLedState();

        return result;
    }

    triggerBackLedBlink(duration_ms)
    {
        var self = this;
        var duration = duration_ms !== undefined ? parse_integer(duration_ms, this.led_blink.duration_ms) : this.led_blink.duration_ms;
        var color = this.getBlinkLedColorForState();
        var index = color_led_index(color);

        if (!this.back)
        {
            return true;
        }

        this.call_native("controls_set_led_color_index", this.back, index);

        setTimeout(function ()
        {
            self.syncBackLedState();
        }, duration);

        return true;
    }

    triggerLedBlink(duration_ms)
    {
        var self = this;
        var duration = duration_ms !== undefined ? parse_integer(duration_ms, this.led_blink.duration_ms) : this.led_blink.duration_ms;

        this.syncBlinkLedState();

        if (this.led_blink_timer_id)
        {
            clearTimeout(this.led_blink_timer_id);
            this.led_blink_timer_id = 0;
        }

        this.led_blink_timer_id = setTimeout(function ()
        {
            self.led_blink_timer_id = 0;
            self.syncLedState();
        }, duration);
    }

    hasBackwardButton()
    {
        return this.cc2 >= 0 || this.back !== "";
    }

    stepForward()
    {
        var last_index = 0;

        if (!this._items || this._items.length <= 0)
        {
            return -1;
        }

        if (this.value < 0)
        {
            return 0;
        }

        last_index = this._items.length - 1;

        if (this.hasBackwardButton())
        {
            if (this.value >= last_index)
            {
                return last_index;
            }

            return this.value + 1;
        }

        return (this.value + 1) % this._items.length;
    }

    stepBackward()
    {
        var last_index = 0;

        if (!this._items || this._items.length <= 0)
        {
            return -1;
        }

        last_index = this._items.length - 1;

        if (this.value < 0)
        {
            return last_index;
        }

        if (this.hasBackwardButton())
        {
            if (this.value <= 0)
            {
                return 0;
            }

            return this.value - 1;
        }

        return (this.value - 1 + this._items.length) % this._items.length;
    }

    setValueInternal(next_value)
    {
        this.value = parse_integer(next_value, -1);

        if (this._items.length <= 0)
        {
            this.value = -1;
        }
        else if (this.value < 0 || this.value >= this._items.length)
        {
            this.value = -1;
        }

        this.applyCurrentStateAppearance();
    }

    applyValueChange(silent, next_value, source_name)
    {
        var changed = false;
        var result;

        next_value = parse_integer(next_value, -1);

        if (this.value === next_value)
        {
            if (silent)
            {
                return {
                    ok: true,
                    code: "ok",
                    changed: false,
                    message: "silent value unchanged"
                };
            }

            result = this.sendValueOsc();
            result.changed = false;

            return result;
        }

        this.setValueInternal(next_value);
        changed = true;

        if (this.dom_element)
        {
            this.draw();
        }

        if (silent)
        {
            return {
                ok: true,
                code: "ok",
                changed: changed,
                message: "silent value applied"
            };
        }

        result = this.sendValueOsc();
        result.changed = changed;

        return result;
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

    on_value(silent, atoms)
    {
        var raw_value = atoms && atoms.length > 0 ? atoms[0] : -1;
        var new_value = parse_integer(raw_value, -1);

        if (this._items.length <= 0)
        {
            new_value = -1;
        }
        else if (new_value < 0 || new_value >= this._items.length)
        {
            new_value = -1;
        }

        return this.applyValueChange(silent, new_value, "value");
    }

    on_cc(value)
    {
        var new_value = this.value;
        var result;

        if (value === 0)
        {
            return {
                ok: true,
                code: "ok",
                message: "menu control zero ignored"
            };
        }

        new_value = this.stepForward();
        result = this.applyValueChange(false, new_value, "control");

        if (result && result.changed)
        {
            this.triggerLedBlink();
        }

        return result;
    }

    on_back(value)
    {
        var new_value = this.value;
        var result;

        if (value === 0)
        {
            return {
                ok: true,
                code: "ok",
                message: "menu back zero ignored"
            };
        }

        new_value = this.stepBackward();
        result = this.applyValueChange(false, new_value, "back");

        if (result && result.changed)
        {
            this.triggerBackLedBlink();
        }

        return result;
    }


    on_bang(silent, atoms)
    {
        return this.applyValueChange(silent, this.stepForward(), "bang");
    }

    draw()
    {
        this.applyCurrentStateAppearance();
        super.draw();

        if (this.value === -1)
        {
            this.createOverlay();
        }
        else
        {
            this.removeOverlay();
        }

        if (this.blink_overlay_element)
        {
            this.blink_overlay_element.style.left = px(this.inner_x);
            this.blink_overlay_element.style.top = px(this.inner_y);
            this.blink_overlay_element.style.width = px(this.inner_width);
            this.blink_overlay_element.style.height = px(this.inner_height);
        }

        this.requestDisplayUpdate();
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();

        json.type = this.type;
        json.value = this.value;
        json.cc2 = this.cc2;
        json.back = this.back;
        json.items = this.items.slice(0);

        return json;
    }
}