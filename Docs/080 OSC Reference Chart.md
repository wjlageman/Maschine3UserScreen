# OSC Reference Chart for the JS / Sciter Application

This reference chart describes the supported OSC messages of the Javascript application. Messages are grouped by level and by widget type.

The general rule is:

- the OSC address selects a widget, container, or screen object
- the first atom determines the action or property

The OSC layer follows the same state-based design as the rest of the Javascript application. State forms the single source of truth.

OSC messages explicitly modify widget states, and rendering reflects only the current state.

The rendering pipeline follows the model:

```text
layout → state → render
```

The OSC layer avoids implicit corrections, hidden modifications, and automatic recovery mechanisms. Invalid messages generate explicit error messages.

After a template has been loaded, the layout structure becomes fixed. Runtime OSC messages primarily modify widget values, colours, texts, and widget states.

**Note:** The Javascript source code still contains legacy CC code. That route is not a supported interface and is therefore not documented here. Do not use `/cc/<number>` messages and do not document `set_cc`, `set_cc_touch`, or `set_cc2` as public OSC functions.

# 1. General Rules

| Component | Description |
|------------|------------|
| Transport | OSC over UDP. The C++ application receives UDP/OSC and forwards messages to Javascript. |
| Address | An address refers to a widget, container, or screen object. Example: `/split/left/dials/dial-1`. |
| Atoms | The first atom is the action or property. The following atoms are arguments. |
| Property Name | OSC uses kebab-case: `background-color`. Internally, JS uses snake_case: `background_color`. |
| Reply | Replies are sent back as OSC to the configured UDP output port. |
| Errors | Invalid messages send an error message containing address, code, message, and the original atoms. |
| Silent | Actions can be executed with `silent` so the widget does not generate a normal output event. |

# 2. Global Screen Messages

| OSC Message | Meaning | Reply / Effect |
|------------|------------|------------|
| `/maschine3/screen get json` | Request the complete current UI state. | `/maschine3/screen <json>` |
| `/maschine3/screen load <template>` | Load another `.htm` template and rebuild the complete widget structure. | Reply: `/maschine3/screen loaded <template> <title>` |
| `/screen redraw` | Redraw the current screen. | No separate data reply; the screen is rendered again. |
| `/screen structure` | Request structural information about the screen. | `/query/structure <structure-json>` |

After loading a screen, the Javascript application builds a completely new widget structure and `ui_state`. Clients should therefore wait for the loaded event before requesting widget or structure information.

Typical lifecycle:

```text
/maschine3/screen load MyScreen.htm
→ /maschine3/screen loaded MyScreen.htm "Window Title"
→ /screen structure
→ /maschine3/screen get json
```

## 3.1 Screen Lifecycle

The loaded event forms the synchronization point between the client and the Javascript application. Only after this event may the current widget structure be queried.

# 4. General Widget and Container Messages

| OSC Message | Valid For | Meaning | Reply / Effect |
|------------|------------|------------|------------|
| `<address> get <property>` | widgets and containers | Request a scalar property. | `<address> <property> <value>` |
| `<address> get json` | widgets and containers | Request an object as JSON. | `<address> json <object-json>` |
| `<address> <property> <value>` | widgets and containers | Set a property and redraw the UI. | `<address> <property> <value>` |
| `<address> items <a> <b> <c>` | widgets with items | Set the items array. | `<address> items <a> <b> <c>` |
| `<address> draw` | objects with `draw()` | Redraw the object. | No standard reply. |
| `<address> remove border-left` | box/widget/container | Remove border override. | `<address> border-left nil` |
| `<address> remove border-top` | box/widget/container | Remove border override. | `<address> border-top nil` |
| `<address> remove border-right` | box/widget/container | Remove border override. | `<address> border-right nil` |
| `<address> remove border-bottom` | box/widget/container | Remove border override. | `<address> border-bottom nil` |

The widget hierarchy starts with `PanelWidget`. PanelWidget forms the visual base layer for almost all interactive widgets. This class manages general properties such as layout, colours, borders, labels, and rendering.

Above that is `MidiWidget`. The name MidiWidget is historical and actually outdated. Within the current architecture, the name ControlWidget would be more appropriate because the class is not specifically tied to MIDI.

MidiWidget forms the foundation for widgets that respond to user input such as value, delta, touch, and click. Almost all interactive widgets ultimately inherit from this class.

Specialized widgets such as BangWidget, ButtonWidget, ToggleWidget, MenuWidget, ScrollWidget, and DialWidget are built on top of it.

# 5. PanelWidget and MidiWidget

| Class | Role | Note |
|---------|---------|---------|
| PanelWidget | Visual base widget | Manages layout, rendering, and general widget properties. |
| MidiWidget | Base class for interactive widgets | The name is historical; ControlWidget would be more appropriate. |

BangWidget is intended for momentary actions. A bang sends a short event and does not store a persistent value like a toggle.

# 6. BangWidget

| OSC Message | Meaning | Outbound |
|------------|------------|------------|
| `<address> click` | Execute a bang. | `<address> bang` |
| `<address> silent click` | Execute a bang internally without outbound bang. | No bang output. |
| `<address> value <nonzero>` | A non-zero value is interpreted as a bang. | `<address> bang` |
| `<address> value 0` | A zero value is ignored. | No bang output. |

ButtonWidget has a binary value: 0 or 1. The widget can use labels, text colours, and background colours per state.

# 7. ButtonWidget

| OSC Message | Meaning | Outbound |
|------------|------------|------------|
| `<address> click` | Toggle between 0 and 1. | `<address> value <0|1>` |
| `<address> silent click` | Toggle between 0 and 1 without output. | No value output. |
| `<address> value <value>` | Set value. Anything other than 0 becomes 1. | `<address> value <0|1>` |
| `<address> silent value <value>` | Set value without output. | No value output. |
| `<address> items <off> <on>` | Set labels per state. | `<address> items <off> <on>` |
| `<address> text-color <off>|<on>` | Set text colour per state. | `<address> text-color <value>` |
| `<address> background-color <off>|<on>` | Set background colour per state. | `<address> background-color <value>` |
| `<address> led-color <off>|<on>` | Set LED colour per state. | `<address> led-color <value>` |

# 8. ToggleWidget

ToggleWidget inherits from ButtonWidget but uses stricter colour behaviour for toggle/radio LEDs. An explicit colour pair is expected for LED colours.

| OSC Message | Meaning | Outbound |
|------------|------------|------------|
| `<address> click` | Toggle between 0 and 1. | `<address> value <0|1>` |
| `<address> value <value>` | Set toggle value. Non-zero becomes 1. | `<address> value <0|1>` |
| `<address> led-color <off>|<on>` | Configure LED colour pair. | `<address> led-color <value>` |
| `<address> background-color <off>|<on>` | Configure background colour pair. | `<address> background-color <value>` |

# 9. RadioButtonWidget

RadioButtonWidget is a ToggleWidget with group behaviour. Within a group, one button is active.

| OSC Message | Meaning | Outbound |
|------------|------------|------------|
| `<address> click` | Activates this radio button; if already active it may be deactivated according to group rules. | `<address> <group> <active-index>` |
| `<address> value 1` | Activate this radio button. | `<address> <group> <active-index>` |
| `<address> value 0` | Deactivate this radio button. | `<address> <group> <active-index>` |

# 10. MenuWidget

MenuWidget is a ButtonWidget with an items list and a numeric value. The value is the index of the currently selected item.

| OSC Message | Meaning | Outbound |
|------------|------------|------------|
| `<address> click` | Step forward through the menu. | `<address> value <index>` |
| `<address> value <index>` | Select index. | `<address> value <index>` |
| `<address> silent value <index>` | Select index without output. | No value output. |
| `<address> items <item1> <item2> ...` | Replace menu items. | `<address> items ...` |

# 11. ScrollWidget

ScrollWidget is intended for scrollable lists. The widget provides hover, value, and commit as separate outbound events.

| OSC Message | Meaning | Outbound |
|------------|------------|------------|
| `<address> value <index>` | Set the current index. | `<address> value <index> <current-string>` |
| `<address> silent value <index>` | Set index without outbound event. | No value output. |
| `<address> click` | Step forward. | `<address> hover <index> <current-string>` |
| `<address> delta <delta>` | Scroll via encoder/dial delta. | `<address> hover <index> <current-string>` |
| `<address> touch 1` | Start touch gesture. | No value output. |
| `<address> touch 0` | End touch gesture; if changed, the value is confirmed. | `<address> value <index> <current-string>` |
| `<address> items <item1> <item2> ...` | Replace items. | `<address> items ...` |
| `<address> enter` | Commit the current selection when this route is used in the controller layer. | `<address> commit <index> <current-string>` |

# 12. DialWidget

DialWidget uses a numeric value and a normalized value. Both are returned on output.

| OSC Message | Meaning | Outbound |
|------------|------------|------------|
| `<address> value <number>` | Set absolute value. | `<address> value <number>` and `<address> norm-value <number>` |
| `<address> norm-value <number>` | Set normalized value. | `<address> value <number>` and `<address> norm-value <number>` |
| `<address> value-text <text>` | Override the displayed value text. | `<address> value-text <text>` |
| `<address> pace <number>` | Set step/speed factor. | `<address> pace <number>` |
| `<address> delta <delta>` | Encoder/dial delta when supported by the widget logic. | Value update through widget logic. |
| `<address> touch <0|1>` | Touch state of the dial. | Widget state is updated. |

| Widget Type | OSC Messages | Meaning |
|------------|------------|------------|
| MidiWidget | no public CC interface | Legacy CC code remains in the source, but is not a documented OSC interface. |
| PanelWidget | general property messages | PanelWidget is a visual base widget and has no value output of its own. |
| Widget | get, get json, draw, remove, property assignment | General base class for all widgets. |

# 13. Outbound System and Error Messages

The OSC interface uses explicit error reporting instead of hidden corrections. An invalid route or property is not silently ignored.

| Address | Payload | Meaning |
|------------|------------|------------|
| `/maschine3/screen` | `loaded <template> <title>` | Template has been loaded. |
| `/maschine3/screen` | `<json>` | Reply to `get json`. |
| `/query/structure` | `<structure-json>` | Reply to `/screen structure`. |
| `/warning` | `<address> <action/property> <message> <details>` | Non-fatal warning. |
| `error` | `<address> <code> <message> <atoms-json>` | Error message for a rejected command. |
| `/debug` | `<message>` | Debug output, only when debug flags are enabled. |
| `/log` | `<message...>` | Internal log output. |

# 14. Frequently Used Examples

| Goal | OSC Message | Result |
|------------|------------|------------|
| Load template | `/maschine3/screen load index.htm` | A new screen is loaded. |
| Request UI state | `/maschine3/screen get json` | JSON containing the complete state. |
| Enable button | `/split/left/buttons/play value 1` | Button value becomes 1. |
| Silent toggle | `/split/left/buttons/play silent value 1` | Value changes without generating an output event. |
| Set menu items | `/split/right/menu items Kick Snare Hat` | Items array is replaced. |
| Select menu item | `/split/right/menu value 2` | The third item is selected. |
| Move scroll | `/split/right/list delta 1` | Hover advances by one step. |
| Set dial value | `/split/left/dials/dial-1 value 0.5` | Value and norm-value are sent. |
| Read property | `/split/left/dials/dial-1 get json` | Widget JSON is returned. |

# 15. Summary

The OSC layer uses a single general model, but the meaning of value, click, delta, and touch differs per widget type.

CC messages are not a supported public interface and are therefore not included in this reference chart.
