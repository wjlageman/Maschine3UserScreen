// MidiWidget.js

const DEBUG_MIDI_WIDGET = false;

class MidiWidget extends PanelWidget
{
    constructor(spec = {})
    {
        super(spec);

        this.name = this.path.split("/").pop();
        this.control = spec.control || this.name;
        this.cc = spec.cc !== undefined ? parse_integer(spec.cc, -1) : -1;
        this.cc_touch = spec.cc_touch !== undefined ? parse_integer(spec.cc_touch, -1) : -1;
        this.register_midi_aliases();
    }

    call_native(name)
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
            return false;
        }
    }


    debugMidi(kind, payload = {})
    {
        var line;

        if (!DEBUG_MIDI_WIDGET)
        {
            return;
        }

        line = "MIDIWIDGETDBG kind=" + kind +
            " path=" + this.path +
            " payload=" + JSON.stringify(payload);

        console.log(line);

        if (typeof osc_send === "function")
        {
            osc_send("/debug", [line]);
        }
    }

    register_midi_alias(cc_value, label)
    {
        var cc_number = parse_integer(cc_value, -1);
        var midi_address = "";

        if (cc_number < 0)
        {
            return;
        }

        midi_address = "/cc/" + cc_number;

        this.debugMidi("register.begin",
        {
            label: label,
            cc: cc_number,
            midi_address: midi_address,
            target_address: this.path
        });

        OscMessage.set_midi_lookup(cc_number, this.path);

        this.debugMidi("register.end",
        {
            label: label,
            cc: cc_number,
            midi_address: midi_address
        });
    }

    register_midi_aliases()
    {
        this.register_midi_alias(this.cc, "cc");
        this.register_midi_alias(this.cc_touch, "cc_touch");
    }

    set_cc(cc_value)
    {
        this.cc = parse_integer(cc_value, -1);

        this.debugMidi("set_cc",
        {
            cc: this.cc
        });

        this.register_midi_alias(this.cc, "cc");

        return {
            ok: true,
            code: "ok",
            message: "cc assigned"
        };
    }

    set_cc_touch(cc_value)
    {
        this.cc_touch = parse_integer(cc_value, -1);

        this.debugMidi("set_cc_touch",
        {
            cc_touch: this.cc_touch
        });

        this.register_midi_alias(this.cc_touch, "cc_touch");

        return {
            ok: true,
            code: "ok",
            message: "cc_touch assigned"
        };
    }

    setState(properties = {})
    {
        super.setState(properties);

        if (properties.control !== undefined)
        {
            this.control = properties.control || this.name;
        }

        if (properties.cc !== undefined)
        {
            this.cc = parse_integer(properties.cc, this.cc);
        }

        if (properties.cc_touch !== undefined)
        {
            this.cc_touch = parse_integer(properties.cc_touch, this.cc_touch);
        }

        this.register_midi_aliases();
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();

        if (this.control && this.control !== this.name)
        {
            json.control = this.control;
        }

        if (this.cc !== undefined)
        {
            json.cc = this.cc;
        }

        if (this.cc_touch !== undefined)
        {
            json.cc_touch = this.cc_touch;
        }

        if (this.led_color !== undefined)
        {
            json.led_color = this.led_color;
        }


        return json;
    }
}
