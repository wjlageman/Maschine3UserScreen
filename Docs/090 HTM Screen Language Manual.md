# HTM Screen File Manual

This manual describes the `.htm` language used to build screens for the Javascript / Sciter application. The `.htm` file is not a normal web page for a browser, but a declarative layout description for the Maschine MK3 user screen.

The layout files follow a number of fixed design principles. State is always the single source of truth. Rendering reflects only the current state. There are no implicit modifications or hidden recovery mechanisms.

Values are initialized once when the template is loaded. After that, widgets are modified exclusively through explicit state or OSC updates.

Rendering proceeds deterministically according to the model:

```text
layout → state → render
```

After compilation, the layout structure is fixed. During runtime, widget values, colours, texts, and widget states are the primary elements that change.

The C++ application loads an `.htm` file into Sciter. The Javascript application reads the custom tags, compiles the layout into an internal structure of containers and widgets, and renders the result to the combined Maschine MK3 display.

# 1. Basic Structure

A screen file is a normal HTML file with a `<screen>` element in the body. Inside `<screen>` are layout definitions, regions, rows, columns, spacers, and widgets.

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Maschine3Display - Feature demo</title>
</head>
<body>

<screen id="screen" type="maschine3" template-name="my-screen">
    ...
</screen>

</body>
</html>
```

The `<title>` in the HTML head is used by the application as the screen title. This title is also included in the screen-loaded message.

# 2. The `<screen>` Element

The `<screen>` element is the root of the screen language. It must have an id and contains the complete screen layout.

| Attribute | Example | Meaning |
|------------|------------|------------|
| id | screen | Root id. In the demo this is always `screen`. |
| type | maschine3 | Target screen type. Used as the screen type. |
| template-name | dual-panel-test | Internal template or layout name. |
| orientation | vertical | Main orientation of direct children: `vertical` or `horizontal`. |
| background-color | black | Screen background colour. |
| gap | 1 | Space in pixels between direct children. |
| border | 0 | General border thickness. |
| border-color | blue | Border colour. |

```html
<screen id="screen"
        type="maschine3"
        template-name="dual-panel-test"
        orientation="vertical"
        background-color="black"
        gap="1"
        border="0"
        border-color="blue">
```

# 3. Layout Definitions

Layouts are defined inside a `<layouts>` block.

```html
<layouts>
    <layout id="full-width" orientation="horizontal" widget-count="1"></layout>
    <layout id="left-right" orientation="horizontal" widget-count="2"></layout>
    <layout id="controls-8" orientation="horizontal" widget-count="8" gap="-1"></layout>
    <layout id="vertical-4" orientation="vertical" widget-count="4" gap="-1"></layout>
</layouts>
```

| Attribute | Example | Meaning |
|------------|------------|------------|
| id | controls-8 | Name used later to reference the layout. |
| orientation | horizontal | Direction of child distribution. |
| widget-count | 8 | Number of slots on which distribution is based. |
| gap | 4 | Space between slots. Negative values pull widgets closer together. |

A local `<layouts>` block overrides or extends the available layouts within its scope.

# 4. Regions, Rows, Columns and Spacers

| Tag | Usage | Note |
|------|------|------|
| row | Horizontal or vertical container | Internally treated as a region |
| column | Container for vertical stacking | Internally treated as a region |
| region | General container | Can contain widgets and nested containers |
| spacer | Empty layout space | May have width, height, and background-colour |

```html
<row id="split" layout="left-right" height="*">
    <column id="left" width="*"> ... </column>
    <column id="right" width="*"> ... </column>
</row>
```

# 5. Dimensions: Fixed Pixels and Star Sizing

| Value | Meaning |
|---------|---------|
| height="24" | Fixed height of 24 pixels |
| width="120" | Fixed width of 120 pixels |
| height="*" | Take a proportional share of remaining space |
| width="*" | Take a proportional share of remaining space |
| width="*.*" | Larger star weight. The compiler counts the number of `*` characters as weight. |

# 6. Type Inheritance

A container may define a `type` attribute. Widgets without their own type inherit the type of the owner container.

```html
<row id="buttons" type="button">
    <widget id="button-1" text="Button 1"></widget>
    <widget id="button-2" text="Button 2"></widget>
</row>
```

# 7. Widgets

| Type | Purpose | Important Properties |
|--------|--------|--------|
| panel | Text/panel without value behaviour | text, font-size, align, valign |
| bang | Momentary button | text, background-color, control |
| button | Binary button | value, items, background-color |
| toggle | Explicit on/off state | value, items, colour pairs |
| radio | Radio button in group | group, required, value |
| menu | Index into item list | items, value, back |
| scroll | Scrollable list | items, value, font-size |
| dial | Numeric rotary control | value, min, max, bipolar |

# 8. General Widget Attributes

| Attribute | Example | Meaning |
|------------|------------|------------|
| id | dial-1 | Unique name within the container |
| type | dial | Widget type |
| text | Volume | Label or text |
| width | * | Width |
| height | 48 | Height |
| background-color | orange | Background colour |
| text-color | white | Text colour |
| font | Magneto | Font family |
| font-size | 24 | Font size |
| bold | 1 | Bold |
| italic | 1 | Italic |
| underline | 1 | Underlined |
| align | left | Horizontal alignment |
| valign | center | Vertical alignment |
| control | dial-1 | Explicit physical control binding |

# 9. Borders and Box Properties

| Attribute | Example | Meaning |
|------------|------------|------------|
| border | 1 | General border thickness |
| border-left | 3 | Left border |
| border-top | 2 | Top border |
| border-right | 4 | Right border |
| border-bottom | 5 | Bottom border |
| border-color | red | Border colour |

Specific borders override the general border.

# 10. Colours

Colours may be specified as standard HTML/CSS colours, hexadecimal colours, or project colours from the colour mapping.

```text
background-color="green|*"
background-color="beige|blue|green|khaki|yellow|white"
```

The asterisk means: use the companion/default colour determined by widget logic.

# 11. Item Lists

```text
items="Off|On"
items="Kick|Snare|Hat|Clap|Tom|Ride|Crash"
```

# 12. DialWidget Attributes

| Attribute | Example | Meaning |
|------------|------------|------------|
| value | -6 | Current value |
| min | -64 | Minimum value |
| max | 6 | Maximum value |
| bipolar | 1 | Bipolar visualization |
| value-text | 0 dB | Overrides displayed value text |
| body-color | gray | Dial body colour |
| arc-color | orange | Active arc colour |
| arc-inactive-color | gray | Inactive arc colour |
| needle-color | white | Needle colour |
| value-color | white | Value text colour |
| pace | 1 | Step/movement factor |

# 13. MenuWidget and ScrollWidget Attributes

| Attribute | Example | Meaning |
|------------|------------|------------|
| items | Zero|One|Two | Choice list |
| value | 2 | Current index |
| back | button-6 | Additional control for stepping backward |
| font-size | 12 | Text size |
| valign | center | Vertical alignment |

# 14. Control Binding

```html
<widget id="dial-1" type="dial"></widget>

<widget id="cutoff" type="dial" control="dial-1"></widget>
```

This makes it possible to use functional widget names while specifying the physical control separately.

# 15. OSC Paths and IDs

```text
id="dial-1"        correct
id="/dial-1"       do not use
```

# 16. Text, Fonts and Special Characters

```text
text="Top 1~button"
text="Atmo-~sphere"
```

The `~` character is used to split text across lines in compact labels.

# 17. Comments and Unknown Content

```html
<!-- This is a comment -->
<spacer height="10" background-color="khaki"><!--Payload is comment only--></spacer>
```

Use comments for explanations, not for functional data.

# 18. Example Structure of the Demo Screen

- screen: type maschine3, vertical main orientation
- layouts: full-width, left-right, controls-8, vertical-4
- header row
- split row
- left column
- right column
- status row

# 19. Practical Guidelines

- Use ids without slashes.
- Use clear layout names.
- Define layouts locally when possible.
- Use type inheritance for compact button rows.
- Use `control="..."` when widget and hardware names differ.
- Use fixed pixel heights for headers and status bars.
- Keep the combined screen size of 960 × 272 pixels in mind.
- Do not place functional meaning inside HTML comments.
- Use pipe-separated items for menu, scroll, and stateful buttons.

# 20. Summary

The language also supports overlays, banks, and state-dependent rendering. Only the active bank is rendered.

The `.htm` language describes the static screen structure. The layout is compiled into regions and widgets during loading. Afterwards, the structure remains fixed and values, colours, texts, and states are modified through OSC.

# Addendum: Colour Tables from MaschineColors.js

This addendum contains the colour tables from `MaschineColors.js`. The Javascript object notation has been removed. The content and order remain identical to the source code.

## A. MASCHINE_COLORS

The MASCHINE_COLORS table keeps the dark/light colour pairs together. Each row contains the dark colour and its corresponding light companion colour.

(Colour table preserved from source.)

## B. CSS_COLORS

The CSS_COLORS table contains the supported CSS colour names and their fixed 0xRRGGBB values.

(Colour table preserved from source.)

## C. MASCHINE_COLOR_PAIRS

The MASCHINE_COLOR_PAIRS table contains the companion colours used for state-dependent rendering.

(Source: MaschineColors.js)
