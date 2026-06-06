// OscManager.js

const DEBUG_OSC_MANAGER = false;

function osc_manager_debug(message)
{
    if (!DEBUG_OSC_MANAGER)
    {
        return;
    }

    if (typeof osc_send === "function")
    {
        osc_send("/debug", [message]);
    }
}

function normalize_transport_atoms(raw_atoms)
{
    if (raw_atoms === undefined || raw_atoms === null)
    {
        return [];
    }

    if (Object.prototype.toString.call(raw_atoms) === "[object Array]")
    {
        return raw_atoms;
    }

    if (typeof raw_atoms === "string")
    {
        try
        {
            return JSON.parse(raw_atoms);
        }
        catch (e)
        {
            return [raw_atoms];
        }
    }

    return [raw_atoms];
}

function osc_send(address, atoms)
{
    var normalized_atoms = atoms;
    var atoms_json = "";

    if (normalized_atoms === undefined || normalized_atoms === null)
    {
        normalized_atoms = [];
    }

    atoms_json = JSON.stringify(normalized_atoms);

    try
    {
        if (DEBUG_OSC_MANAGER)
        {
            log("JS OSC SEND CALL", address || "", atoms_json);
        }

        return Window.this.xcall("osc_send", address || "", atoms_json);
    }
    catch (e)
    {
        log("JS OSC SEND ERROR", address || "", atoms_json, String(e && e.message ? e.message : e));
        return false;
    }
}

function osc_send_error(address, code, message, atoms)
{
    var error_address = "error";
    var payload = [];

    if (address)
    {
        payload.push(address);
    }

    payload.push(code || "error");
    payload.push(message || "");

    if (atoms !== undefined)
    {
        payload.push(JSON.stringify(atoms));
    }

    log("JS OSC ERROR", error_address, JSON.stringify(payload));
    osc_send(error_address, payload);
}

function osc_lookup_object(address)
{
    var entry = null;
    var key = "";
    var container = null;

    if (!ui_state)
    {
        return null;
    }

    if (ui_state.widgets_by_path)
    {
        entry = ui_state.widgets_by_path[address] || null;

        if (entry && entry.widget)
        {
            return entry.widget;
        }
    }

    if (ui_state.containers)
    {
        for (key in ui_state.containers)
        {
            if (!ui_state.containers.hasOwnProperty(key))
            {
                continue;
            }

            container = ui_state.containers[key];

            if (container && container.address === address)
            {
                return container;
            }
        }
    }

    return null;
}

function osc_lookup_midi_object(address)
{
    var resolved_address = "";
    var object = null;

    if (typeof address !== "string" || address.indexOf("/cc/") !== 0)
    {
        return null;
    }

    if (typeof OscMessage === "undefined" || !OscMessage || !OscMessage.midi_lookup)
    {
        return null;
    }

    resolved_address = OscMessage.midi_lookup[address] || "";

    if (DEBUG_OSC_MANAGER)
    {
        osc_manager_debug("OSC MIDI LOOKUP " + (address || "") + " -> " + (resolved_address || "<miss>"));
    }

    if (!resolved_address)
    {
        return null;
    }

    object = osc_lookup_object(resolved_address);

    if (DEBUG_OSC_MANAGER)
    {
        osc_manager_debug(
            "OSC MIDI TARGET alias=" + (address || "") +
            " resolved=" + resolved_address +
            " found=" + String(!!object)
        );
    }

    return object;
}

function osc_receive(address, atoms_json)
{
    var atoms = normalize_transport_atoms(atoms_json);
    var object = null;
    var result = null;
    var cc_number = -1;
    var cc_value = 0;

    try
    {
        if (!ui_state)
        {
            log("JS OSC", "ui_state not ready", address || "", JSON.stringify(atoms));
            osc_send_error(address, "ui-state-not-ready", "ui_state not ready", atoms);
            return false;
        }

        if (osc_handle_query(address, atoms))
        {
            return true;
        }

        if (typeof address === "string" && address.indexOf("/cc/") === 0)
        {
            object = osc_lookup_midi_object(address);

            if (!object)
            {
                log("JS OSC", "midi address not found1", address || "", JSON.stringify(atoms));
                osc_send_error(address, "not-found", "address not found1", atoms);
                return false;
            }

            if (typeof object.on_cc !== "function")
            {
                log("JS OSC", "on_cc missing", address || "", JSON.stringify(atoms));
                osc_send_error(address, "no-on-cc", "target has no on_cc()", atoms);
                return false;
            }

            cc_number = parse_integer(String(address).slice(4), -1);
            cc_value = atoms.length > 0 ? parse_integer(atoms[0], 0) : 0;

            if (DEBUG_OSC_MANAGER)
            {
                osc_manager_debug(
                    "JS OSC MIDI RECEIVE alias=" + (address || "") +
                    " cc=" + String(cc_number) +
                    " value=" + String(cc_value)
                );
            }

            result = object.on_cc(cc_value);

            if (!result || result.ok !== true)
            {
                if (DEBUG_OSC_MANAGER)
                {
                    log("JS OSC MIDI REJECT", address || "", JSON.stringify(atoms), JSON.stringify(result));
                }

                osc_send_error(
                    address,
                    result && result.code ? result.code : "invalid-message",
                    result && result.message ? result.message : "message rejected",
                    atoms
                );
                return false;
            }

            return true;
        }

        object = osc_lookup_object(address);
        if (!object)
        {
            log("JS OSC", "address not found2", address || "", JSON.stringify(atoms));
            osc_send_error(address, "not-found", "address not found2", atoms);
            return false;
        }

        if (typeof object.apply_message !== "function")
        {
            log("JS OSC", "apply_message missing", address || "", JSON.stringify(atoms));
            osc_send_error(address, "no-apply-message", "target has no apply_message()", atoms);
            return false;
        }
        osc_send("/log", ["OBJECT.APPLY_MESSAGE2", typeof object.apply_message]);

        if (DEBUG_OSC_MANAGER)
        {
            log("JS OSC RECEIVE", address || "", JSON.stringify(atoms));
        }

        result = object.apply_message(atoms);

        if (!result || result.ok !== true)
        {
            if (DEBUG_OSC_MANAGER)
            {
                log("JS OSC REJECT", address || "", JSON.stringify(atoms), JSON.stringify(result));
            }

            osc_send_error(
                address,
                result && result.code ? result.code : "invalid-message",
                result && result.message ? result.message : "message rejected",
                atoms
            );
            return false;
        }

        return true;
    }
    catch (e)
    {
        log("JS OSC RECEIVE ERROR", address || "", JSON.stringify(atoms), String(e && e.message ? e.message : e));
        osc_send_error(address, "exception", String(e && e.message ? e.message : e), atoms);
        return false;
    }
}

function osc_handle_query(address, atoms)
{
    var cmd = "";
    var cmd2 = "";
    var json = "";

    if (address !== "/maschine3/screen")
    {
        return false;
    }

    cmd = (atoms && atoms.length > 0) ? atoms[0] : "";
    cmd2 = (atoms && atoms.length > 1) ? atoms[1] : "";

    try
    {
        if (cmd === "get" && cmd2 === "json")
        {
            if (!ui_state)
            {
                log("JS QUERY", "structure", "ui_state not ready");
                return false;
            }

            json = json_ui_state(ui_state);

            osc_send("/maschine3/screen", [json]);

            if (DEBUG_OSC_MANAGER)
            {
                log("JS QUERY STRUCTURE", "size:", json.length);
            }

            return true;
        }

        return false;
    }
    catch (e)
    {
        osc_send_error("/maschine3/screen", "exception", String(e && e.message ? e.message : e), atoms);
        return true;
    }
}
