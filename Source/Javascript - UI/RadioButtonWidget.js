// RadioButtonWidget.js

class RadioButtonWidget extends ToggleWidget
{
    static groups = {};

    constructor(spec = {})
    {
        super(spec);

        this.type = "radio";
        this.group = spec.group !== undefined ? String(spec.group) : "";
        this.required = spec.required !== undefined ? (parse_integer(spec.required, 0) !== 0) : false;
        this.applyCurrentStateAppearance();

        this.registerGroup();

        if (this.group !== "")
        {
            RadioButtonWidget.ensureRequiredSelection(this.group);
        }

        this.normalize();
    }

    static ensureGroup(group_name)
    {
        if (!RadioButtonWidget.groups[group_name])
        {
            RadioButtonWidget.groups[group_name] = [];
        }

        return RadioButtonWidget.groups[group_name];
    }

    registerGroup()
    {
        var members = null;
        var i = 0;

        if (this.group === "")
        {
            return;
        }

        members = RadioButtonWidget.ensureGroup(this.group);

        for (i = 0; i < members.length; i++)
        {
            if (members[i] === this)
            {
                return;
            }
        }

        members.push(this);
    }

    static getGroupMembers(group_name)
    {
        if (!group_name || !RadioButtonWidget.groups[group_name])
        {
            return [];
        }

        return RadioButtonWidget.groups[group_name];
    }

    static getActiveIndex(group_name)
    {
        var members = RadioButtonWidget.getGroupMembers(group_name);
        var i = 0;

        for (i = 0; i < members.length; i++)
        {
            if (members[i].value === 1)
            {
                return i;
            }
        }

        return -1;
    }

    static groupIsRequired(group_name)
    {
        var members = RadioButtonWidget.getGroupMembers(group_name);
        var i = 0;

        for (i = 0; i < members.length; i++)
        {
            if (members[i].required)
            {
                return true;
            }
        }

        return false;
    }

    static ensureRequiredSelection(group_name)
    {
        var members = RadioButtonWidget.getGroupMembers(group_name);
        var active_index = RadioButtonWidget.getActiveIndex(group_name);

        if (!RadioButtonWidget.groupIsRequired(group_name))
        {
            return;
        }

        if (members.length <= 0)
        {
            return;
        }

        if (active_index >= 0)
        {
            return;
        }

        members[0].setValueInternal(1);
        members[0].updateOverlayForValue();

        if (members[0].dom_element)
        {
            members[0].draw();
        }
    }

    updateOverlayForValue()
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

    setValueInternal(next_value)
    {
        next_value = parse_integer(next_value, 0);

        if (next_value !== 0)
        {
            next_value = 1;
        }

        this.value = next_value;
        this.applyCurrentStateAppearance();
    }

    applyValueChange(silent, new_value, source_name)
    {
        var old_value = this.value;
        var has_alternate_layout = false;

        new_value = parse_integer(new_value, 0);

        if (new_value !== 0)
        {
            new_value = 1;
        }

        if (this.value === new_value)
        {
            if (!this.hasAlternateLayout())
            {
                this.updateOverlayForValue();
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
                    message: "silent value unchanged"
                };
            }

            return this.sendValueOsc();
        }

        this.setValueInternal(new_value);

        this.debugIncoming(source_name + ".applied",
        {
            old_value: old_value,
            new_value: this.value,
            silent: !!silent
        });

        has_alternate_layout = this.hasAlternateLayout();

        if (!has_alternate_layout)
        {
            this.updateOverlayForValue();
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

    activateThisRadio(silent, source_name)
    {
        var members = RadioButtonWidget.getGroupMembers(this.group);
        var i = 0;
        var member = null;

        for (i = 0; i < members.length; i++)
        {
            member = members[i];

            if (member === this)
            {
                continue;
            }

            if (member.value !== 0)
            {
                member.applyValueChange(silent, 0, source_name || "group");
            }
        }

        return this.applyValueChange(silent, 1, source_name || "group");
    }

    deactivateThisRadio(silent, source_name)
    {
        if (this.group !== "" && RadioButtonWidget.groupIsRequired(this.group))
        {
            return {
                ok: true,
                code: "ok",
                message: "required radio unchanged"
            };
        }

        return this.applyValueChange(silent, 0, source_name || "group");
    }

    on_bang(silent, atoms)
    {
        if (this.group === "")
        {
            return ToggleWidget.prototype.on_bang.call(this, silent, atoms);
        }

        if (this.value === 1)
        {
            return this.deactivateThisRadio(silent, "bang");
        }

        return this.activateThisRadio(silent, "bang");
    }

    on_cc(value)
    {
        if (value === 0)
        {
            return {
                ok: true,
                code: "ok",
                message: "radio release ignored"
            };
        }

        return this.on_bang(false, []);
    }


    on_value(silent, atoms)
    {
        var next_value = atoms && atoms.length > 0 ? parse_integer(atoms[0], 0) : 0;

        if (next_value !== 0)
        {
            return this.activateThisRadio(silent, "value");
        }

        return this.deactivateThisRadio(silent, "value");
    }

    apply_message(atoms)
    {
        var command = "";
        var payload = "";
        var active_index = -1;
        var numeric_value = 0;

        if (!atoms || atoms.length <= 0)
        {
            return {
                ok: false,
                code: "empty-message",
                message: "message has no atoms"
            };
        }

        if (atoms.length >= 2)
        {
            command = String(atoms[0]);
            payload = String(atoms[1]);

            if (command === "get" && payload === this.group && this.group !== "")
            {
                active_index = RadioButtonWidget.getActiveIndex(this.group);
                osc_send(this.path, [this.group, active_index]);

                return {
                    ok: true,
                    code: "ok",
                    message: "group index returned"
                };
            }
        }

        if (atoms.length === 1)
        {
            numeric_value = parse_number(atoms[0], 0);

            if (numeric_value !== 0)
            {
                return this.on_bang(false, []);
            }

            return {
                ok: true,
                code: "ok",
                message: "radio release ignored"
            };
        }

        if (String(atoms[0]) === "cc")
        {
            if (atoms.length < 2)
            {
                return {
                    ok: false,
                    code: "missing-cc-value",
                    message: "cc requires a value"
                };
            }

            return this.on_cc(parse_integer(atoms[1], 0));
        }

        return OscMessage.prototype.apply_message.call(this, atoms);
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();

        json.type = this.type;
        json.group = this.group;
        json.required = this.required ? 1 : 0;

        if (this.group !== "")
        {
            json.group_index = RadioButtonWidget.getActiveIndex(this.group);
        }

        return json;
    }
}