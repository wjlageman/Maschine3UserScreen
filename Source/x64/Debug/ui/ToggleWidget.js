// ToggleWidget.js

const DEBUG_TOGGLE = false;

class ToggleWidget extends ButtonWidget
{
    constructor(spec = {})
    {
        super(spec);

        this.type = "toggle";
        this._midi_cc_is_down = false;

        if (this._single_toggle_led_color_warning_sent === undefined)
        {
            this._single_toggle_led_color_warning_sent = false;
        }

        this.normalize();
        this.applyCurrentStateAppearance();
    }

    debugToggle(kind, payload = {})
    {
        var line = "";

        if (!DEBUG_TOGGLE)
        {
            return;
        }

        line = "TOGGLEDBG kind=" + kind +
            " path=" + this.path +
            " payload=" + JSON.stringify(payload);

        console.log(line);
        osc_send("/debug", [line]);
    }

    hasColorPair(value)
    {
        return String(value || "").indexOf("|") >= 0;
    }


    warnSingleToggleLedColor(property_name, color)
    {
        if (this._single_toggle_led_color_warning_sent)
        {
            return;
        }

        this._single_toggle_led_color_warning_sent = true;

        if (typeof osc_send === "function")
        {
            osc_send("/warning",
            [
                this.path || "<no-path>",
                property_name || "color",
                "toggle/radio LED requires explicit color pair, using gray|white",
                String(color || "")
            ]);
        }
    }


    getStateBackgroundColorPair()
    {
        if (
            this._background_color_values &&
            this._background_color_values.length === 2
        )
        {
            return this._background_color_values.join("|");
        }

        return "";
    }


    getLedColorPairValue(value, property_name)
    {
        var color = resolve_companion_color(value, this.value, this.path, property_name);

        if (color === "black")
        {
            return "gray";
        }

        if (color === "chalk")
        {
            return "white";
        }

        return color;
    }


    getRenderLedColorForState()
    {
        var pair = "";
        var color = "";

        if (this.led_color !== undefined && this.led_color !== null && this.led_color !== "")
        {
            if (this.hasColorPair(this.led_color))
            {
                return this.getLedColorPairValue(this.led_color, "led-color");
            }

            this.warnSingleToggleLedColor("led-color", this.led_color);

            return this.value === 0 ? "gray" : "white";
        }

        pair = this.getStateBackgroundColorPair();

        if (pair !== "")
        {
            return this.getLedColorPairValue(pair, "background-color");
        }

        if (this._base_background_color !== undefined && this._base_background_color !== null && this._base_background_color !== "")
        {
            this.warnSingleToggleLedColor("background-color", this._base_background_color);

            return this.value === 0 ? "gray" : "white";
        }

        color = this.background_color || "";

        if (color !== "")
        {
            this.warnSingleToggleLedColor("background-color", color);

            return this.value === 0 ? "gray" : "white";
        }

        return this.value === 0 ? "gray" : "white";
    }


    on_cc(value)
    {
        var new_value = 0;

        if (value === 0)
        {
            return {
                ok: true,
                code: "ok",
                message: "toggle release ignored"
            };
        }

        new_value = 1 - this.value;

        return this.applyValueChange(false, new_value, "cc");
    }


    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();

        json.type = this.type;
        json.midi_cc_is_down = this._midi_cc_is_down ? 1 : 0;

        return json;
    }
}
