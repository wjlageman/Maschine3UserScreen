// OscMessage.js
// Minimal OSC message receiver for containers and widgets.

const DEBUG_OSC_MESSAGE = false;

class OscMessage
{
    static address_lookup = {};
    static midi_lookup = {};

    static set_address_lookup(address_lookup)
    {
        OscMessage.address_lookup = address_lookup || {};
    }

    static set_midi_lookup(cc, osc_address)
    {
        var cc_number = parse_integer(cc, -1);
        var midi_address = "";
        var previous_address = "";
        var stored_address = "";

        if (cc_number < 0)
        {
            throw new Error("OscMessage.set_midi_lookup() requires a valid cc number");
        }

        if (!osc_address || typeof osc_address !== "string")
        {
            throw new Error("OscMessage.set_midi_lookup() requires a valid osc_address");
        }

        midi_address = "/cc/" + cc_number;
        previous_address = OscMessage.midi_lookup[midi_address];

        if (previous_address && previous_address !== osc_address)
        {
            osc_send("/warning", [midi_address, "midi alias overwritten", previous_address, osc_address]);
        }

        OscMessage.midi_lookup[midi_address] = osc_address;
        stored_address = OscMessage.midi_lookup[midi_address];

        if (DEBUG_OSC_MESSAGE)
        {
            osc_send(
                "MIDILOOKUP SET alias=" + midi_address +
                " requested=" + osc_address +
                " stored=" + String(stored_address)
            );
        }
    }

    apply_message(atoms)
    {

        var address = "";
        var property_name = "";
        var value = null;
        var action_target = this;
        var result = null;
        var silent = false;
        var owner = null;
        var is_multi_value_property = false;

        address = this.path || this.address || "";

        if (!atoms || atoms.length <= 0)
        {
            return {
                ok: false,
                code: "empty-message",
                message: "message has no atoms"
            };
        }

        property_name = String(atoms[0]);

        if (property_name === "silent" || property_name === "value" || property_name === "delta" || property_name === "touch" || property_name === "click" || property_name === "cc")
        {
            if (property_name === "silent")
            {
                silent = true;
                atoms = atoms.slice(1);

                if (atoms.length === 0)
                {
                    return {
                        ok: false,
                        code: "missing-action",
                        message: "silent requires an action"
                    };
                }

                property_name = String(atoms[0]);

                if (property_name === "click")
                {
                    property_name = "on_bang";
                }
                else if (property_name === "value" || property_name === "delta" || property_name === "touch" || property_name === "cc")
                {
                    property_name = "on_" + property_name;
                }
                else
                {
                    return {
                        ok: false,
                        code: "invalid-silent-action",
                        message: "silent only applies to actions"
                    };
                }
            }
            else
            {
                property_name = "on_" + property_name;
            }

            if (property_name === "on_bang")
            {
                if (atoms.length > 1)
                {
                    osc_send("/warning", [address, property_name, "extra arguments ignored", JSON.stringify(atoms.slice(1))]);
                }
            }
            else
            {
                if (atoms.length < 2)
                {
                    return {
                        ok: false,
                        code: "missing-action-argument",
                        message: "action requires an argument: '" + property_name + "'"
                    };
                }

                if (atoms.length > 2)
                {
                    osc_send("/warning", [address, property_name, "extra arguments ignored", JSON.stringify(atoms.slice(2))]);
                }
            }

            if (typeof action_target[property_name] === "function")
            {
                result = action_target[property_name].call(action_target, silent, atoms.slice(1));
                return validate_result_object(result, property_name);
            }

            return {
                ok: false,
                code: "action-not-defined",
                message: "action not defined: '" + property_name + "'"
            };
        }

        if (property_name === "draw")
        {
            if (atoms.length > 1)
            {
                osc_send("/warning", [address, property_name, "extra arguments ignored", JSON.stringify(atoms.slice(1))]);
            }

            if (typeof action_target.draw === "function")
            {
                action_target.draw();

                return {
                    ok: true,
                    code: "ok",
                    message: "draw executed"
                };
            }

            return {
                ok: false,
                code: "missing-draw-handler",
                message: "draw is not defined"
            };
        }

        if (property_name === "remove")
        {
            if (atoms.length < 2)
            {
                return {
                    ok: false,
                    code: "missing-property",
                    message: "remove requires a property name"
                };
            }

            if (atoms.length > 2)
            {
                osc_send("/warning", [address, "remove", "extra arguments ignored", JSON.stringify(atoms.slice(2))]);
            }

            property_name = internal_property_name(String(atoms[1]));

            if (!is_removable_box_property(property_name))
            {
                return {
                    ok: false,
                    code: "invalid-remove-property",
                    message: "remove only supports border side overrides"
                };
            }

            owner = find_property_owner(this, action_target, property_name);

            if (!owner)
            {
                return {
                    ok: false,
                    code: "missing-property",
                    message: "property not found"
                };
            }

            delete owner[property_name];

            redraw_current_screen(this);
            send_update(address, external_property_name(property_name), "nil", this);

            return {
                ok: true,
                code: "ok",
                message: "property override removed"
            };
        }

        if (property_name === "set_cc" || property_name === "set_cc_touch" || property_name === "set_cc2")
        {
            if (atoms.length < 2)
            {
                return {
                    ok: false,
                    code: "missing-cc-number",
                    message: property_name + " requires a cc number"
                };
            }

            if (atoms.length > 2)
            {
                osc_send("/warning", [address, property_name, "extra arguments ignored", JSON.stringify(atoms.slice(2))]);
            }

            value = parse_integer(atoms[1], -1);

            if (value < 0)
            {
                return {
                    ok: false,
                    code: "invalid-cc-number",
                    message: property_name + " requires a valid cc number"
                };
            }

            if (typeof action_target[property_name] === "function")
            {
                result = action_target[property_name].call(action_target, value);
                return validate_result_object(result, property_name);
            }

            return {
                ok: false,
                code: "action-not-defined",
                message: "action not defined: '" + property_name + "'"
            };
        }

        if (property_name === "get")
        {
            // TODO: move get handling out of OscMessage and into Widget or a more appropriate class.
            atoms = atoms.slice(1);

            if (atoms.length < 1)
            {
                return {
                    ok: false,
                    code: "missing-property",
                    message: "get requires a property name"
                };
            }

            if (atoms.length > 1)
            {
                osc_send("/warning", [address, "get", "extra arguments ignored", JSON.stringify(atoms.slice(1))]);
            }

            property_name = internal_property_name(String(atoms[0]));

            if (property_name === "json")
            {
                try
                {
                    osc_send(address, ["json", object_to_json(this)]);
                }
                catch (e)
                {
                    return {
                        ok: false,
                        code: "osc-send-error",
                        message: "could not send the object json using OSC"
                    };
                }

                return {
                    ok: true,
                    code: "ok",
                    message: "object json returned"
                };
            }

            owner = find_property_owner(this, action_target, property_name);

            if (!owner)
            {
                return {
                    ok: false,
                    code: "missing-property",
                    message: "property not found"
                };
            }

            value = owner[property_name];

            if (value === undefined && is_box_property(property_name) && is_box_like_object(owner))
            {
                value = null;
            }

            if (!is_scalar_value(value))
            {
                if (property_name === "text" && value && typeof value === "object" && is_scalar_value(value.text))
                {
                    value = value.text;
                }
                else if (is_multi_value(property_name) && Object.prototype.toString.call(value) === "[object Array]")
                {
                    value = value.slice(0);
                }
                else
                {
                    return {
                        ok: false,
                        code: "non-scalar-value",
                        message: "value is not scalar"
                    };
                }
            }

            try
            {
                if (Object.prototype.toString.call(value) === "[object Array]")
                {
                    osc_send(address, [external_property_name(property_name)].concat(value));
                }
                else
                {
                    osc_send(address, [external_property_name(property_name), value]);
                }
            }
            catch (e)
            {
                return {
                    ok: false,
                    code: "osc-send-error",
                    message: "could not send the value using OSC"
                };
            }

            return {
                ok: true,
                code: "ok",
                message: "property returned"
            };
        }

        // TODO: move default property assignment out of OscMessage and into Widget or a more appropriate class.
        if (atoms.length < 2)
        {
            return {
                ok: false,
                code: "unsupported-message",
                message: "set requires a property name and a value"
            };
        }

        property_name = internal_property_name(String(atoms[0]));

        is_multi_value_property = is_multi_value(property_name);

        if (!is_multi_value_property && atoms.length > 2)
        {
            osc_send("/warning", [address, String(atoms[0]), "extra arguments ignored", JSON.stringify(atoms.slice(2))]);
        }

        if (is_multi_value_property)
        {
            if (atoms.length === 2)
            {
                value = atoms[1];
            }
            else
            {
                value = atoms.slice(1);
            }
        }
        else
        {
            value = atoms[1];

            if (!is_scalar_value(value))
            {

                return {
                    ok: false,
                    code: "non-scalar-value",
                    message: "value is not scalar"
                };
            }
        }

        owner = find_property_owner(this, action_target, property_name);

        if (!owner)
        {
            if (DEBUG_OSC_MESSAGE)
            {
                osc_send(address + "/js/object", [JSON.stringify(this)]);
            }

            return {
                ok: false,
                code: "missing-property",
                message: "property not found"
            };
        }

        try
        {

            apply_property_assignment(this, owner, property_name, value);

            send_update(address, external_property_name(property_name), value, this);

            return {
                ok: true,
                code: "ok",
                message: "property assigned"
            };
        }
        catch (e)
        {
            osc_send("/log", ["SET PROPERTY ERROR", e]);
            return {
                ok: false,
                code: "assignment-error",
                message: String(e && e.message ? e.message : e)
            };
        }
    }
}

function get_box_action_target(root)
{
    if (!root || typeof root !== "object")
    {
        return null;
    }

    if (root.box && typeof root.box === "object")
    {
        return root.box;
    }

    if (is_box_like_object(root))
    {
        return root;
    }

    return null;
}

function is_box_like_object(obj)
{
    if (!obj || typeof obj !== "object")
    {
        return false;
    }

    return (
        Object.prototype.hasOwnProperty.call(obj, "border") ||
        Object.prototype.hasOwnProperty.call(obj, "border_left") ||
        Object.prototype.hasOwnProperty.call(obj, "border_top") ||
        Object.prototype.hasOwnProperty.call(obj, "border_right") ||
        Object.prototype.hasOwnProperty.call(obj, "border_bottom") ||
        Object.prototype.hasOwnProperty.call(obj, "border_color") ||
        typeof obj.getBorders === "function"
    );
}

function is_box_property(name)
{
    return (
        name === "border" ||
        name === "border_left" ||
        name === "border_top" ||
        name === "border_right" ||
        name === "border_bottom" ||
        name === "border_color" 
    );
}

function is_removable_box_property(name)
{
    return (
        name === "border_left" ||
        name === "border_top" ||
        name === "border_right" ||
        name === "border_bottom"
    );
}

function is_container_property(name)
{
    return (
        name === "gap" ||
        name === "background_color"
    );
}

function find_property_owner(root, action_target, property_name)
{

    var child = null;
    var child_name = "";

    if (is_box_property(property_name))
    {

        if (action_target && action_target.box)
        {

            return action_target.box;
        }

        if (is_box_like_object(action_target))
        {

            return action_target;
        }

        if (action_target === root)
        {
            child = get_box_action_target(root);

            if (child)
            {
                return child;
            }
        }

        return null;
    }

    if (property_name in action_target)
    {
        return action_target;
    }

    if (
        action_target === root &&
        root &&
        root.type === "region" &&
        is_container_property(property_name)
    )
    {
        return root;
    }

    if (action_target !== root)
    {
        return null;
    }

    for (child_name in root)
    {
        if (!Object.prototype.hasOwnProperty.call(root, child_name))
        {
            continue;
        }

        if (child_name === "box")
        {
            continue;
        }

        child = root[child_name];

        if (!child || typeof child !== "object")
        {
            continue;
        }

        if (Object.prototype.toString.call(child) === "[object Array]")
        {
            continue;
        }

        if (property_name in child)
        {
            return child;
        }
    }

    return null;
}

function find_property_owner2(root, action_target, property_name)
{
    var child = null;
    var child_name = "";

    if (property_name in action_target)
    {
        return action_target;
    }

    if (
        action_target === root &&
        root &&
        root.type === "region" &&
        is_container_property(property_name)
    )
    {
        return root;
    }

    if (is_box_property(property_name) && is_box_like_object(action_target))
    {
        return action_target;
    }

    if (action_target === root && is_box_property(property_name))
    {
        child = get_box_action_target(root);

        if (child)
        {
            return child;
        }
    }

    if (
        action_target === root &&
        root &&
        root.type === "region" &&
        is_container_property(property_name)
    )
    {
        return root;
    }

    if (action_target !== root)
    {
        return null;
    }

    for (child_name in root)
    {
        if (!Object.prototype.hasOwnProperty.call(root, child_name))
        {
            continue;
        }

        if (child_name === "box")
        {
            continue;
        }

        child = root[child_name];

        if (!child || typeof child !== "object")
        {
            continue;
        }

        if (Object.prototype.toString.call(child) === "[object Array]")
        {
            continue;
        }

        if (property_name in child)
        {
            return child;
        }
    }

    return null;
}

function validate_result_object(result, source_name)
{
    if (!result || typeof result !== "object" || typeof result.ok !== "boolean")
    {
        return {
            ok: false,
            code: "invalid-result",
            message: "invalid result from: " + source_name
        };
    }

    return result;
}

function is_scalar_value(value)
{
    var t = typeof value;

    return (
        value === null ||
        t === "string" ||
        t === "number" ||
        t === "boolean"
    );
}

function is_multi_value(name)
{
    return ( name === "items" );
}

function internal_property_name(name)
{
    return String(name).replace(/-/g, "_");
}

function external_property_name(name)
{
    return String(name).replace(/_/g, "-");
}

function apply_property_assignment(root, owner, property_name, value)
{
    var properties = {};

    if (is_box_like_object(owner))
    {

        owner[property_name] = value;
        redraw_current_screen(root);
        return;
    }
    else if (root && owner === root && typeof root.setState === "function")
    {

        properties[property_name] = value;
        root.setState(properties);

        redraw_current_screen(root);
        return;
    }

    owner[property_name] = value;

    redraw_current_screen(root);
}

function redraw_current_screen(root)
{
    if (typeof current_screen !== "undefined" && current_screen && typeof current_screen.redraw_ui === "function")
    {
        current_screen.redraw_ui();
        return;
    }

    if (root && typeof root.redraw_ui === "function")
    {
        root.redraw_ui();
    }
}

function send_update(address, name, value, obj)
{

    var payload = null;

    try
    {
        payload = [name, value];

        osc_send(address, payload);

    }
    catch (e)
    {
    }
}

