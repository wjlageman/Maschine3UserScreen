// WidgetState.js
// Helper/state classes only. No concrete widget classes here.

class Events
{
    constructor(spec = {})
    {
        this.event = spec.event || spec.input || spec.input_event || "";
        this.cc = spec.cc !== undefined && spec.cc !== null && spec.cc !== "" ? parse_integer(spec.cc, -1) : -1;
        this.channel = spec.channel !== undefined && spec.channel !== null && spec.channel !== "" ? parse_integer(spec.channel, -1) : -1;
        this.silent = spec.silent !== undefined ? !!spec.silent : false;
    }

    setState(spec = {})
    {
        if (spec.event !== undefined)
        {
            this.event = spec.event || "";
        }

        if (spec.input !== undefined)
        {
            this.event = spec.input || "";
        }

        if (spec.input_event !== undefined)
        {
            this.event = spec.input_event || "";
        }

        if (spec.cc !== undefined)
        {
            this.cc = spec.cc === "" || spec.cc === null ? -1 : parse_integer(spec.cc, this.cc);
        }

        if (spec.channel !== undefined)
        {
            this.channel = spec.channel === "" || spec.channel === null ? -1 : parse_integer(spec.channel, this.channel);
        }

        if (spec.silent !== undefined)
        {
            this.silent = !!spec.silent;
        }

        this.normalize();
    }

    normalize()
    {
        this.event = this.event || "";
        this.cc = parse_integer(this.cc, -1);
        this.channel = parse_integer(this.channel, -1);
        this.silent = !!this.silent;
    }

    matchesEvent(name)
    {
        if (!name)
        {
            return false;
        }

        if (!this.event)
        {
            return false;
        }

        return String(name) === String(this.event);
    }

    matchesCC(cc, channel)
    {
        if (this.cc < 0)
        {
            return false;
        }

        if (parse_integer(cc, -999) !== this.cc)
        {
            return false;
        }

        if (this.channel >= 0 && parse_integer(channel, -999) !== this.channel)
        {
            return false;
        }

        return true;
    }

    shouldIgnoreValue(value)
    {
        return parse_number(value, 0) === 0;
    }

    getPublicData()
    {
        var json = {};

        if (this.event)
        {
            json.event = this.event;
        }

        if (this.cc >= 0)
        {
            json.cc = this.cc;
        }

        if (this.channel >= 0)
        {
            json.channel = this.channel;
        }

        if (this.silent)
        {
            json.silent = 1;
        }

        return json;
    }
}

class Output
{
    constructor(spec = {})
    {
        this.event = spec.output_event || spec.out_event || "bang";
        this.address = spec.output || spec.output_address || spec.osc_output || "";
        this.cc = spec.output_cc !== undefined && spec.output_cc !== null && spec.output_cc !== "" ? parse_integer(spec.output_cc, -1) : -1;
        this.channel = spec.output_channel !== undefined && spec.output_channel !== null && spec.output_channel !== "" ? parse_integer(spec.output_channel, -1) : -1;
    }

    setState(spec = {})
    {
        if (spec.output_event !== undefined)
        {
            this.event = spec.output_event || "bang";
        }

        if (spec.out_event !== undefined)
        {
            this.event = spec.out_event || "bang";
        }

        if (spec.output !== undefined)
        {
            this.address = spec.output || "";
        }

        if (spec.output_address !== undefined)
        {
            this.address = spec.output_address || "";
        }

        if (spec.osc_output !== undefined)
        {
            this.address = spec.osc_output || "";
        }

        if (spec.output_cc !== undefined)
        {
            this.cc = spec.output_cc === "" || spec.output_cc === null ? -1 : parse_integer(spec.output_cc, this.cc);
        }

        if (spec.output_channel !== undefined)
        {
            this.channel = spec.output_channel === "" || spec.output_channel === null ? -1 : parse_integer(spec.output_channel, this.channel);
        }

        this.normalize();
    }

    normalize()
    {
        this.event = this.event || "bang";
        this.address = this.address || "";
        this.cc = parse_integer(this.cc, -1);
        this.channel = parse_integer(this.channel, -1);
    }

    createBangMessage(widget)
    {
        return {
            type: "bang",
            event: this.event || "bang",
            address: this.address || (widget && typeof widget.getOscAddress === "function" ? widget.getOscAddress("bang") : ""),
            cc: this.cc,
            channel: this.channel,
            widget_id: widget ? widget.id : "",
            widget_path:this.path
        };
    }

    getPublicData()
    {
        var json = {};

        if (this.event)
        {
            json.output_event = this.event;
        }

        if (this.address)
        {
            json.output = this.address;
        }

        if (this.cc >= 0)
        {
            json.output_cc = this.cc;
        }

        if (this.channel >= 0)
        {
            json.output_channel = this.channel;
        }

        return json;
    }
}

class BlinkState
{
    constructor(spec = {})
    {
        this.duration_ms = parse_integer(spec.blink_duration !== undefined ? spec.blink_duration : spec.bang_duration, 120);
        this.active_until = 0;
        this.active = false;
        this.timer_id = 0;
    }

    setState(spec = {})
    {
        if (spec.blink_duration !== undefined)
        {
            this.duration_ms = parse_integer(spec.blink_duration, this.duration_ms);
        }

        if (spec.bang_duration !== undefined)
        {
            this.duration_ms = parse_integer(spec.bang_duration, this.duration_ms);
        }

        this.normalize();
    }

    normalize()
    {
        this.duration_ms = parse_integer(this.duration_ms, 120);

        if (this.duration_ms < 1)
        {
            this.duration_ms = 1;
        }
    }

    trigger(duration_ms)
    {
        var now = Date.now();
        var duration = duration_ms !== undefined ? parse_integer(duration_ms, this.duration_ms) : this.duration_ms;

        if (duration < 1)
        {
            duration = 1;
        }

        this.active = true;
        this.active_until = now + duration;
    }

    isActive()
    {
        if (!this.active)
        {
            return false;
        }

        if (Date.now() >= this.active_until)
        {
            this.active = false;
            return false;
        }

        return true;
    }

    clear()
    {
        this.active = false;
        this.active_until = 0;
    }

    getPublicData()
    {
        return {
            blink_duration: this.duration_ms,
            blinking: this.isActive() ? 1 : 0
        };
    }
}

class ItemsState
{
    constructor(spec = {})
    {
        this.items = Array.isArray(spec.items) ? spec.items.slice(0) : [];
        this.icons = Array.isArray(spec.icons) ? spec.icons.slice(0) : [];
        this.icon = spec.icon || "hidden";
        this.value = parse_integer(spec.value, -1);
    }

    setState(spec = {})
    {
        if (spec.items !== undefined)
        {
            this.items = Array.isArray(spec.items) ? spec.items.slice(0) : [];
        }

        if (spec.icons !== undefined)
        {
            this.icons = Array.isArray(spec.icons) ? spec.icons.slice(0) : [];
        }

        if (spec.icon !== undefined)
        {
            this.icon = spec.icon || "hidden";
        }

        if (spec.value !== undefined)
        {
            this.value = parse_integer(spec.value, this.value);
        }

        this.normalize();
    }

    normalize()
    {
        this.value = parse_integer(this.value, -1);
    }

    getPublicData()
    {
        var json =
        {
            items: this.items.slice(0),
            value: this.value
        };

        if (this.icons.length > 0)
        {
            json.icons = this.icons.slice(0);
        }

        if (this.icon)
        {
            json.icon = this.icon;
        }

        return json;
    }
}

class ValueState
{
    constructor(spec = {})
    {
        this.value_text = spec.value_text || "";
        this.value = parse_number(spec.value, 0.0);
        this.value_norm = parse_number(spec.value_norm, 0.0);
        this.min = parse_number(spec.min, 0.0);
        this.max = parse_number(spec.max, 1.0);
        this.step = parse_number(spec.step, 0.01);
        this.show_value = spec.show_value !== undefined ? !!spec.show_value : true;
        this.show_arc = spec.show_arc !== undefined ? !!spec.show_arc : true;
        this.show_needle = spec.show_needle !== undefined ? !!spec.show_needle : true;
        this.orientation = spec.orientation || "vertical";
    }

    setState(spec = {})
    {
        if (spec.value_text !== undefined)
        {
            this.value_text = spec.value_text || "";
        }

        if (spec.value !== undefined)
        {
            this.value = parse_number(spec.value, this.value);
        }

        if (spec.value_norm !== undefined)
        {
            this.value_norm = parse_number(spec.value_norm, this.value_norm);
        }

        if (spec.min !== undefined)
        {
            this.min = parse_number(spec.min, this.min);
        }

        if (spec.max !== undefined)
        {
            this.max = parse_number(spec.max, this.max);
        }

        if (spec.step !== undefined)
        {
            this.step = parse_number(spec.step, this.step);
        }

        if (spec.show_value !== undefined)
        {
            this.show_value = !!spec.show_value;
        }

        if (spec.show_arc !== undefined)
        {
            this.show_arc = !!spec.show_arc;
        }

        if (spec.show_needle !== undefined)
        {
            this.show_needle = !!spec.show_needle;
        }

        if (spec.orientation !== undefined)
        {
            this.orientation = spec.orientation || "vertical";
        }

        this.normalize();
    }

    normalize()
    {
        this.value = parse_number(this.value, 0.0);
        this.value_norm = parse_number(this.value_norm, 0.0);
        this.min = parse_number(this.min, 0.0);
        this.max = parse_number(this.max, 1.0);
        this.step = parse_number(this.step, 0.01);

        if (this.max < this.min)
        {
            var temp = this.min;
            this.min = this.max;
            this.max = temp;
        }

        if (this.value < this.min)
        {
            this.value = this.min;
        }

        if (this.value > this.max)
        {
            this.value = this.max;
        }

        if (this.value_norm < 0.0)
        {
            this.value_norm = 0.0;
        }

        if (this.value_norm > 1.0)
        {
            this.value_norm = 1.0;
        }
    }

    getPublicData()
    {
        return {
            value_text: this.value_text,
            value: this.value,
            value_norm: this.value_norm,
            min: this.min,
            max: this.max,
            step: this.step,
            show_value: this.show_value,
            show_arc: this.show_arc,
            show_needle: this.show_needle,
            orientation: this.orientation
        };
    }
}
