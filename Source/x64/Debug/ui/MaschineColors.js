// MaschineColors.js
// M3 LED colors. Keep the C++ table order and two-color line format.

const DEBUG = false;

var LED_NIGHTTIME_MODE = true;

const MASCHINE_COLORS =
{
    black:   { index: 0x00, rgb: 0x000000 }, chalk:       { index: 0x47, rgb: 0xF5F5F5 },

    red:     { index: 0x05, rgb: 0x8F0D12 }, redhot:      { index: 0x06, rgb: 0xE01010 },
    brown:   { index: 0x09, rgb: 0x8C3410 }, orange:      { index: 0x0A, rgb: 0xCC6218 },
    tomato:  { index: 0x0D, rgb: 0x965510 }, coral:       { index: 0x0E, rgb: 0xD17624 },
    gold:    { index: 0x11, rgb: 0x8A6718 }, khaki:       { index: 0x12, rgb: 0xB98F28 },
    olive:   { index: 0x15, rgb: 0x82711D }, sun:         { index: 0x16, rgb: 0xB5A110 },
    spring:  { index: 0x19, rgb: 0x62841F }, lime:        { index: 0x1A, rgb: 0x86B832 },

    green:   { index: 0x1D, rgb: 0x12B020 }, forestgreen: { index: 0x1E, rgb: 0x10D040 },
    emerald: { index: 0x21, rgb: 0x1E8262 }, limegreen:   { index: 0x22, rgb: 0x32BA8B },
    pine:    { index: 0x25, rgb: 0x167884 }, granny:      { index: 0x26, rgb: 0x28A9B8 },
    teal:    { index: 0x29, rgb: 0x146684 }, cyan:        { index: 0x2A, rgb: 0x2494BD },

    lilac:   { index: 0x2D, rgb: 0x17439A }, turquoise:   { index: 0x2E, rgb: 0x2B6FD0 },
    blue:    { index: 0x31, rgb: 0x1818B8 }, navy:        { index: 0x32, rgb: 0x3B3FD6 },
    indigo:  { index: 0x35, rgb: 0x56169C }, violet:      { index: 0x36, rgb: 0x7E2AD0 },

    orchid:  { index: 0x39, rgb: 0x8A1A8C }, purple:      { index: 0x3A, rgb: 0xBE32C0 },
    toy:     { index: 0x3D, rgb: 0x981460 }, rose:        { index: 0x3E, rgb: 0xD02A88 },
    pink:    { index: 0x41, rgb: 0x961050 }, hotpink:     { index: 0x42, rgb: 0xD02878 },

    gray:    { index: 0x44, rgb: 0x454545 }, lightgray:   { index: 0x46, rgb: 0x707070 },
    silver:  { index: 0x45, rgb: 0x909090 }, white:       { index: 0x47, rgb: 0xFFFFFF }
};


const CSS_COLORS =
{
    aliceblue       : 0xF0F8FF, antiquewhite    : 0xFAEBD7, aqua            : 0x00FFFF, aquamarine      : 0x7FFFD4, azure               : 0xF0FFFF,
    beige           : 0xF5F5DC, bisque          : 0xFFE4C4, blanchedalmond  : 0xFFEBCD, blueviolet      : 0x8A2BE2, burlywood           : 0xDEB887,
    cadetblue       : 0x5F9EA0, chartreuse      : 0x7FFF00, chocolate       : 0xD2691E, cornflowerblue  : 0x6495ED, cornsilk            : 0xFFF8DC,
    crimson         : 0xDC143C, darkblue        : 0x00008B, darkcyan        : 0x008B8B, darkgoldenrod   : 0xB8860B, darkgray            : 0xA9A9A9,
    darkgreen       : 0x006400, darkgrey        : 0xA9A9A9, darkkhaki       : 0xBDB76B, darkmagenta     : 0x8B008B, darkolivegreen      : 0x556B2F,
    darkorange      : 0xFF8C00, darkorchid      : 0x9932CC, darkred         : 0x8B0000, darksalmon      : 0xE9967A, darkseagreen        : 0x8FBC8F,
    darkslateblue   : 0x483D8B, darkslategray   : 0x2F4F4F, darkslategrey   : 0x2F4F4F, darkturquoise   : 0x00CED1, darkviolet          : 0x9400D3,
    deeppink        : 0xFF1493, deepskyblue     : 0x00BFFF, dimgray         : 0x696969, dimgrey         : 0x696969, dodgerblue          : 0x1E90FF,
    firebrick       : 0xB22222, floralwhite     : 0xFFFAF0, fuchsia         : 0xFF00FF, gainsboro       : 0xDCDCDC, ghostwhite          : 0xF8F8FF,
    goldenrod       : 0xDAA520, greenyellow     : 0xADFF2F, grey            : 0x808080, honeydew        : 0xF0FFF0, indianred           : 0xCD5C5C,
    ivory           : 0xFFFFF0, lavender        : 0xE6E6FA, lavenderblush   : 0xFFF0F5, lawngreen       : 0x7CFC00, lemonchiffon        : 0xFFFACD,
    lightblue       : 0xADD8E6, lightcoral      : 0xF08080, lightcyan       : 0xE0FFFF, whitesmoke      : 0xF5F5F5, lightgreen          : 0x90EE90,
    lightgrey       : 0xD3D3D3, lightpink       : 0xFFB6C1, lightsalmon     : 0xFFA07A, lightseagreen   : 0x20B2AA, lightskyblue        : 0x87CEFA,
    lightslategray  : 0x778899, lightslategrey  : 0x778899, lightsteelblue  : 0xB0C4DE, lightyellow     : 0xFFFFE0, linen               : 0xFAF0E6,
    magenta         : 0xFF00FF, maroon          : 0x800000, mediumaquamarine: 0x66CDAA, mediumblue      : 0x0000CD, mediumorchid        : 0xBA55D3,
    mediumpurple    : 0x9370DB, mediumseagreen  : 0x3CB371, mediumslateblue : 0x7B68EE, mediumturquoise : 0x48D1CC, mediumvioletred     : 0xC71585,
    midnightblue    : 0x191970, mintcream       : 0xF5FFFA, mistyrose       : 0xFFE4E1, moccasin        : 0xFFE4B5, navajowhite         : 0xFFDEAD,
    oldlace         : 0xFDF5E6, olivedrab       : 0x6B8E23, orangered       : 0xFF4500, plum            : 0xDDA0DD, lightgoldenrodyellow: 0xFAFAD2,
    palegoldenrod   : 0xEEE8AA, palegreen       : 0x98FB98, paleturquoise   : 0xAFEEEE, palevioletred   : 0xDB7093, papayawhip          : 0xFFEFD5,
    peachpuff       : 0xFFDAB9, peru            : 0xCD853F, powderblue      : 0xB0E0E6, rebeccapurple   : 0x663399, rosybrown           : 0xBC8F8F,
    royalblue       : 0x4169E1, saddlebrown     : 0x8B4513, salmon          : 0xFA8072, sandybrown      : 0xF4A460, seagreen            : 0x2E8B57,
    seashell        : 0xFFF5EE, sienna          : 0xA0522D, skyblue         : 0x87CEEB, slateblue       : 0x6A5ACD, slategray           : 0x708090,
    slategrey       : 0x708090, snow            : 0xFFFAFA, springgreen     : 0x00FF7F, steelblue       : 0x4682B4, mediumspringgreen   : 0x00FA9A,
    tan             : 0xD2B48C, thistle         : 0xD8BFD8, wheat           : 0xF5F5F5, yellow          : 0xFFFF00, yellowgreen         : 0x9ACD32
};

const MASCHINE_COLOR_PAIRS =
{
    black:           "chalk",           chalk:           "black",
    red:             "redhot",          redhot:          "red",
    brown:           "orange",          orange:          "brown",
    tomato:          "coral",           coral:           "tomato",
    gold:            "khaki",           khaki:           "gold",
    olive:           "sun",             sun:             "olive",
    spring:          "lime",            lime:            "spring",
    green:           "forestgreen",     forestgreen:     "green",
    emerald:         "limegreen",       limegreen:       "emerald",
    pine:            "granny",          granny:          "pine",
    teal:            "cyan",            cyan:            "teal",
    lilac:           "turquoise",       turquoise:       "lilac",
    blue:            "navy",            navy:            "blue",
    indigo:          "violet",          violet:          "indigo",
    orchid:          "purple",          purple:          "orchid",
    toy:             "rose",            rose:            "toy",
    pink:            "hotpink",         hotpink:         "pink",
    gray:            "lightgray",       lightgray:       "gray",
    silver:          "white",           white:           "silver",

    // CSS color pairs
    darkred:         "indianred",       indianred:       "darkred",
    firebrick:       "lightcoral",      lightcoral:      "firebrick",
    orangered:       "lightsalmon",     lightsalmon:     "orangered",
    saddlebrown:     "sandybrown",      sandybrown:      "saddlebrown",
    chocolate:       "burlywood",       burlywood:       "chocolate",
    darkgoldenrod:   "goldenrod",       goldenrod:       "darkgoldenrod",
    olivedrab:       "yellowgreen",     yellowgreen:     "olivedrab",
    darkgreen:       "mediumseagreen",  mediumseagreen:  "darkgreen",
    seagreen:        "palegreen",       palegreen:       "seagreen",
    darkcyan:        "mediumturquoise", mediumturquoise: "darkcyan",
    cadetblue:       "paleturquoise",   paleturquoise:   "cadetblue",
    darkslateblue:   "mediumpurple",    mediumpurple:    "darkslateblue",
    mediumblue:      "deepskyblue",     deepskyblue:     "mediumblue",
    royalblue:       "lightskyblue",    lightskyblue:    "royalblue",
    rebeccapurple:   "mediumorchid",    mediumorchid:    "rebeccapurple",
    darkorchid:      "plum",            plum:            "darkorchid",
    mediumvioletred: "lightpink",       lightpink:       "mediumvioletred",
    crimson:         "palevioletred",   palevioletred:   "crimson",
    dimgray:         "lightgrey",       lightgrey:       "dimgray",
    darkgray:        "gainsboro",       gainsboro:       "darkgray"
};

/*
const UNUSED_CSS_COLORS =
{ 
    black           : 0x000000, blue            : 0x0000FF, brown           : 0xA52A2A, coral           : 0xFF7F50, cyan                : 0x00FFFF,
    forestgreen     : 0x228B22, gold            : 0xFFD700, gray            : 0x808080, green           : 0x008000, hotpink             : 0xFF69B4,
    indigo          : 0x4B0082, khaki           : 0xF0E68C, lightgray       : 0xD3D3D3, lime            : 0x00FF00, limegreen           : 0x32CD32,
    navy            : 0x000080, olive           : 0x808000, orange          : 0xFFA500, orchid          : 0xDA70D6, pink                : 0xFFC0CB,
    purple          : 0x800080, red             : 0xFF0000, silver          : 0xC0C0C0, teal            : 0x008080, tomato              : 0xFF6347,
    turquoise       : 0x40E0D0, violet          : 0xEE82EE, white           : 0xFFFFFF
};
*/

function color_entry(color)
{
    return MASCHINE_COLORS[color] || null;
}

function is_machine_color(color)
{
    return color_entry(color) !== null;
}

function color_partner_name(color)
{
    return MASCHINE_COLOR_PAIRS[color] || "";
}

function color_rgb(color)
{
    var entry = color_entry(color);

    if (!entry)
    {
        return -1;
    }

    return entry.rgb;
}

function color_css(color)
{
    var rgb = color_rgb(color);

    if (rgb < 0)
    {
        return color;
    }

    return "#" + ("000000" + rgb.toString(16).toUpperCase()).slice(-6);
}

function set_led_nighttime_mode(value)
{
    LED_NIGHTTIME_MODE = value ? true : false;
}

function get_led_nighttime_mode()
{
    return LED_NIGHTTIME_MODE;
}

function led_nighttime_color_index(index)
{
    if (LED_NIGHTTIME_MODE && index >= 0x04 && index <= 0x43)
    {
        return index & ~0x01;
    }

    return index;
}

function color_led_index(color)
{
    var entry = color_entry(color);

    if (!entry)
    {
        entry = color_entry("gray");
    }

    return led_nighttime_color_index(entry.index);
}

function is_inactive_led_color(color)
{
    var value = String(color || "").toLowerCase();

    return value === "" || value === "black" || value === "#000000";
}

function visible_led_color(color)
{
    if (is_inactive_led_color(color))
    {
        return "gray";
    }

    return color;
}

function active_led_color(color)
{
    if (is_inactive_led_color(color))
    {
        return "chalk";
    }

    return color;
}

function parse_pair_color(value)
{
    if (Object.prototype.toString.call(value) === "[object Array]")
    {
        return value.slice(0);
    }

    value = String(value || "");

    if (value.indexOf("|") >= 0)
    {
        return value.split("|");
    }

    return [value];
}

function resolve_companion_color(value, state_value, path, property_name)
{
    var parts = parse_pair_color(value);
    var index = parse_integer(state_value, 0);
    var left = String(parts[0] || "");
    var right = parts.length > 1 ? String(parts[1] || "") : left;
    var partner = "";

    if (right === "*")
    {
        partner = color_partner_name(left);

        if (partner !== "")
        {
            right = partner;
        }
        else
        {
            osc_send("/warning", [path || "<no-path>", property_name || "color", "partner not available, using single color", left]);
            right = left;
        }
    }

    if (left === "*")
    {
        partner = color_partner_name(right);

        if (partner !== "")
        {
            left = partner;
        }
        else
        {
            osc_send("/warning", [path || "<no-path>", property_name || "color", "partner not available, using single color", right]);
            left = right;
        }
    }

    if (index <= 0)
    {
        return left;
    }

    return right;
}

function auto_text_color(background_color)
{

    entry = MASCHINE_COLORS[background_color] || null;
    if (entry)
    {
        rgb = entry.rgb;
    }
    else
    {
        rgb = CSS_COLORS[background_color];
        if (DEBUG) osc_send("DEBUG_CSS_COLOR", ["background_color", background_color, "rgb", rgb])
        if (rgb === undefined)
        {
            rgb = 0xffffff;
        }
    }
    let r = (rgb >> 16) & 0xFF;
    let g = (rgb >> 8) & 0xFF;
    let b = rgb & 0xFF;
    let brightness = (r * 299 + g * 587 + b * 114) / 1000;
    let retVal = brightness > 140 ? "black" : "white";

    if (DEBUG) osc_send("DEBUG_CSS_COLOR", ["background_color", background_color, "rgb", rgb, "brightness", "retVal", retVal])

    return retVal;
}

function auto_text_color(background_color)
{
    entry = MASCHINE_COLORS[background_color] || null;
    if (entry)
    {
        rgb = entry.rgb;
        if (DEBUG) osc_send("DEBUG_CSS_COLOR", ["MASCHINE COLOR", "background_color", background_color, "rgb", rgb])
    }
    else
    {
        rgb = CSS_COLORS[background_color];

        if (rgb === undefined && background_color && background_color.charAt(0) === "#")
        {
            rgb = parseInt(background_color.substr(1), 16);
            if (DEBUG) osc_send("DEBUG_CSS_COLOR", ["# COLOR", "background_color", background_color, "rgb", rgb])
        }
        else
        {
            rgb = CSS_COLORS[background_color];
            if (DEBUG) osc_send("DEBUG_CSS_COLOR", ["CSS COLOR", "background_color", background_color, "rgb", rgb])
            if (rgb === undefined)
            {
                rgb = 0xffffff;
                if (DEBUG) osc_send("DEBUG_CSS_COLOR", ["DEFAULT WHITE COLOR", "background_color", background_color, "rgb", rgb])
            }
        }
    }

    let r = (rgb >> 16) & 0xFF;
    let g = (rgb >> 8) & 0xFF;
    let b = rgb & 0xFF;
    let brightness = (r * 299 + g * 587 + b * 114) / 1000;
    let retVal = brightness > 140 ? "black" : "white";

    if (DEBUG) osc_send("DEBUG_CSS_COLOR", ["background_color", background_color, "rgb", rgb, "brightness", brightness, "retVal", retVal])

    return retVal;
}
