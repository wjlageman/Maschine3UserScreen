#pragma once

/*

// To Do:
Documentatie

// Nice to have -> versie 2.0
Integratie van de joystick
Widget banks
M3 pages
MIDI output, cc en cc2 properties


OSC berichten C++:
Uitgaand:

/log ....
/controls/name int_value

Inkomend:
Geen

Nodig:
/nighttime 1/0 on/off false/true
/load filename

OSC berichten JS:
/query structure antwoord /query/structure json

Container pad zoals:
/screen
/header/title
/left-right/screen-left/dials/dial-1
/left-right/screen-left/buttons-left/play
/left-right/right/buttons-right/button-1

[address] ["value", x]
[address] ["delta", x]
[address] ["touch", x]
[address] ["bang"]
[address] ["cc", x]
[address] ["silent", "value"|"delta"|"touch"|"bang"|"cc", x]
[address] ["draw"]
[address] ["box", ...]
[address] ["set_cc", cc]
[address] ["set_cc_touch", cc]
[address] ["set_cc2", cc]
[address] ["get", property]
[address] [property, value]

/cc/number value

Uitgaand:
Widget-output:

[widget.path] ["value", value]
[widget.path] ["bang"]
[widget.path] [group, active_index]          // radio
[widget.path] ["hover", value, text]         // scroll
[widget.path] ["select", value, text]        // scroll
[widget.path] ["commit", value, text]        // scroll

Query/get/update responses:

[address] [property, value]
[address] ["box", property, value]
[address]/js/updated [...]
[address]/js/object [json]       // alleen bij DEBUG_OSC_MESSAGE
[address]/js/error [...]

Debug-only / test-adressen:

debug_led_value [...]
DEBUG_CSS_COLOR [...]

*/
