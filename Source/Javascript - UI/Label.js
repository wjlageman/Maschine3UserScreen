// Label.js

var ellipsis_position = 0.3;
var vertical_correction = 1.25;

class Label
{
    constructor(spec = {})
    {
        this.text = spec.text !== undefined ? String(spec.text) : "";

        this.align = spec.align || "center";
        this.valign = spec.valign || "middle";

        this.font = spec.font || "";
        this.font_size = parse_number(spec.font_size, parse_number(spec["font-size"], 0));

        this.text_color = spec.text_color || spec["text-color"] || "*";
        this.bold = spec.bold !== undefined ? !!spec.bold : false;
        this.italic = spec.italic !== undefined ? !!spec.italic : false;
        this.underline = spec.underline !== undefined ? !!spec.underline : false;

        this.ellipsis = spec.ellipsis !== undefined ? !!spec.ellipsis : true;
        this.max_lines = spec.max_lines !== undefined ? parse_integer(spec.max_lines, 0) : parse_integer(spec["max-lines"], 0);

        this.font_fit = spec.font_fit || spec["font-fit"] || "off";

        this.normalize();
    }

    setState(spec = {})
    {
        if (spec.text !== undefined)
        {
            this.text = String(spec.text);
        }

        if (spec.align !== undefined)
        {
            this.align = spec.align;
        }

        if (spec.valign !== undefined)
        {
            this.valign = spec.valign;
        }

        if (spec.font !== undefined)
        {
            this.font = spec.font;
        }

        if (spec.font_size !== undefined)
        {
            this.font_size = parse_number(spec.font_size, this.font_size);
        }

        if (spec["font-size"] !== undefined)
        {
            this.font_size = parse_number(spec["font-size"], this.font_size);
        }

        if (spec.text_color !== undefined)
        {
            this.text_color = spec.text_color;
        }

        if (spec["text-color"] !== undefined)
        {
            this.text_color = spec["text-color"];
        }

        if (spec.bold !== undefined)
        {
            this.bold = !!spec.bold;
        }

        if (spec.italic !== undefined)
        {
            this.italic = !!spec.italic;
        }

        if (spec.underline !== undefined)
        {
            this.underline = !!spec.underline;
        }

        if (spec.ellipsis !== undefined)
        {
            this.ellipsis = !!spec.ellipsis;
        }

        if (spec.max_lines !== undefined)
        {
            this.max_lines = parse_integer(spec.max_lines, this.max_lines);
        }

        if (spec["max-lines"] !== undefined)
        {
            this.max_lines = parse_integer(spec["max-lines"], this.max_lines);
        }

        if (spec.font_fit !== undefined)
        {
            this.font_fit = String(spec.font_fit || "off");
        }

        if (spec["font-fit"] !== undefined)
        {
            this.font_fit = String(spec["font-fit"] || "off");
        }

        this.normalize();
    }

    normalize()
    {
        if (this.align !== "left" && this.align !== "center" && this.align !== "right")
        {
            this.align = "center";
        }

        if (this.valign === "center")
        {
            this.valign = "middle";
        }

        if (this.valign !== "top" && this.valign !== "middle" && this.valign !== "bottom")
        {
            this.valign = "middle";
        }

        this.font_size = parse_number(this.font_size, 0);
        this.bold = !!this.bold;
        this.italic = !!this.italic;
        this.underline = !!this.underline;
        this.ellipsis = !!this.ellipsis;
        this.max_lines = Math.max(0, parse_integer(this.max_lines, 0));
        this.font_fit = String(this.font_fit || "off");
    }

    applyToElement(el, fallback_text_color, bounds)
    {
        var base_font_size = this.font_size > 0 ? this.font_size : 14;
        var width = 0;
        var height = 0;
        var measure_el;
        var font_specs;
        var layout;
        var single_el;
        var line1_el;
        var line2_el;
        var x1;
        var x2;
        var y1;
        var y2;
        var total_height;
        var single_y;

        if (!bounds)
        {
            bounds = {
                width: 0,
                height: 0
            };
        }

        width = parse_integer(bounds.width, 0);
        height = parse_integer(bounds.height, 0);

        el.innerHTML = "";
        el.style.position = "absolute";
        // IMPORTANT:
        // Do not reset position/left/top here.
        // The caller may already have placed this element intentionally.
        el.style.width = px(width);
        el.style.height = px(height);
        el.style.overflow = "hidden";
        el.style.boxSizing = "border-box";

        measure_el = document.createElement("div");
        measure_el.style.position = "absolute";
        measure_el.style.left = "-10000px";
        measure_el.style.top = "-10000px";
        measure_el.style.visibility = "hidden";
        measure_el.style.whiteSpace = "nowrap";
        measure_el.style.padding = "0";
        measure_el.style.margin = "0";
        measure_el.style.border = "0";
        measure_el.style.boxSizing = "border-box";
        measure_el.style.overflow = "visible";
        measure_el.style.lineHeight = "normal";

        el.append(measure_el);

        font_specs = build_font_specs(this, measure_el);

        layout = prepare_label_layout(
        {
            text: this.text || "",
            width: width,
            height: height,
            base_font_size: base_font_size,
            ellipsis: this.ellipsis,
            max_lines: this.max_lines,
            measure_el: measure_el,
            font_specs: font_specs,
            label: this
        });

        /*
        debug_label_log(
            this,
            "layout",
            JSON.stringify({
                font: layout.font_spec ? layout.font_spec.font_family : "",
                font_size: layout.font_size,
                lineCount: layout.lineCount,
                line1: layout.line1,
                line2: layout.line2,
                truncated: layout.truncated
            })
        );
        */

        measure_el.remove();

        if (layout.lineCount <= 1)
        {
            single_el = document.createElement("div");
            single_el.style.position = "absolute";
            single_el.style.left = px(calculate_aligned_x(this.align, width, layout.line1Width));

            single_y = calculate_single_line_y(this.valign, height, layout.line1Height);
            single_el.style.top = px(single_y + vertical_correction);

            single_el.style.whiteSpace = "nowrap";
            single_el.style.padding = "0";
            single_el.style.margin = "0";
            single_el.style.border = "0";
            single_el.style.boxSizing = "border-box";
            single_el.style.overflow = "hidden";
            single_el.style.lineHeight = "normal";

            apply_label_styles(single_el, this, fallback_text_color, layout.font_size, layout.font_spec);
            single_el.textContent = layout.line1;

            el.append(single_el);
            return;
        }

        x1 = calculate_aligned_x(this.align, width, layout.line1Width);
        x2 = calculate_aligned_x(this.align, width, layout.line2Width);
        total_height = layout.line1Height + layout.line2Height;

        if (this.valign === "top")
        {
            y1 = 0;
            y2 = layout.line1Height;
        }
        else if (this.valign === "bottom")
        {
            y1 = Math.max(0, height - total_height);
            y2 = y1 + layout.line1Height;
        }
        else
        {
            y1 = Math.max(0, Math.floor((height - total_height) / 2));
            y2 = y1 + layout.line1Height;
        }

        line1_el = document.createElement("div");
        line1_el.style.position = "absolute";
        line1_el.style.left = px(x1);
        line1_el.style.top = px(y1);
        line1_el.style.whiteSpace = "nowrap";
        line1_el.style.padding = "0";
        line1_el.style.margin = "0";
        line1_el.style.border = "0";
        line1_el.style.boxSizing = "border-box";
        line1_el.style.overflow = "hidden";
        line1_el.style.lineHeight = "normal";
        apply_label_styles(line1_el, this, fallback_text_color, layout.font_size, layout.font_spec);
        line1_el.textContent = layout.line1;

        line2_el = document.createElement("div");
        line2_el.style.position = "absolute";
        line2_el.style.left = px(x2);
        line2_el.style.top = px(y2);
        line2_el.style.whiteSpace = "nowrap";
        line2_el.style.padding = "0";
        line2_el.style.margin = "0";
        line2_el.style.border = "0";
        line2_el.style.boxSizing = "border-box";
        line2_el.style.overflow = "hidden";
        line2_el.style.lineHeight = "normal";
        apply_label_styles(line2_el, this, fallback_text_color, layout.font_size, layout.font_spec);
        line2_el.textContent = layout.line2;

        el.append(line1_el);
        el.append(line2_el);
    }

    getPublicData()
    {
        var json = {};

        if (this.text !== "")
        {
            json.text = this.text;
        }

        if (this.align)
        {
            json.align = this.align;
        }

        if (this.valign)
        {
            json.valign = this.valign;
        }

        if (this.font)
        {
            json.font = this.font;
        }

        if (this.font_size > 0)
        {
            json["font-size"] = this.font_size;
        }

        if (this.text_color)
        {
            json["text-color"] = this.text_color;
        }

        if (this.bold)
        {
            json.bold = 1;
        }

        if (this.italic)
        {
            json.italic = 1;
        }

        if (this.underline)
        {
            json.underline = 1;
        }

        if (this.ellipsis === false)
        {
            json.ellipsis = 0;
        }

        if (this.max_lines > 0)
        {
            json["max-lines"] = this.max_lines;
        }

        if (this.font_fit && this.font_fit !== "off")
        {
            json["font-fit"] = this.font_fit;
        }

        return json;
    }
}

function build_font_specs(label, measure_el)
{
    var specs = [];
    var used = {};
    var original_name = normalize_font_name(label.font);
    var fit_name = normalize_font_name(label.font_fit);

    push_font_spec(specs, used, make_font_spec(original_name, false, "original"));

    if (fit_name === "on")
    {
        push_font_spec(specs, used, make_font_spec("Arial", false, "fit-arial"));
        push_font_spec(specs, used, make_font_spec("Arial Narrow", true, "fit-arial-narrow"));
        return specs;
    }

    if (fit_name === "" || fit_name === "off")
    {
        return specs;
    }

    if (font_family_exists(fit_name, measure_el))
    {
        push_font_spec(specs, used, make_font_spec(fit_name, false, "fit-custom"));
    }

    return specs;
}

function push_font_spec(specs, used, spec)
{
    var key;

    if (!spec)
    {
        return;
    }

    key = (spec.font_family || "<default>") + "|" + (spec.force_bold ? "1" : "0");

    if (used[key])
    {
        return;
    }

    used[key] = true;
    specs.push(spec);
}

function make_font_spec(font_family, force_bold, source_name)
{
    return {
        font_family: font_family || "",
        force_bold: !!force_bold,
        source_name: source_name || ""
    };
}

function normalize_font_name(name)
{
    if (name === null || name === undefined)
    {
        return "";
    }

    return String(name).trim();
}

function font_family_exists(font_family, measure_el)
{
    var probe = "";
    var generic_a = "monospace";
    var generic_b = "serif";
    var generic_c = "sans-serif";
    var size_a;
    var size_b;
    var size_c;
    var test_a;
    var test_b;
    var test_c;

    if (!font_family)
    {
        return true;
    }

    if (font_family === "serif" || font_family === "sans-serif" || font_family === "monospace")
    {
        return true;
    }

    if (!measure_el)
    {
        return false;
    }

    probe = "mmmmmmmmmmlliWWW@@@__--00112233";

    apply_probe_font(measure_el, generic_a);
    size_a = measure_text_size(measure_el, probe, 16);

    apply_probe_font(measure_el, generic_b);
    size_b = measure_text_size(measure_el, probe, 16);

    apply_probe_font(measure_el, generic_c);
    size_c = measure_text_size(measure_el, probe, 16);

    apply_probe_font(measure_el, quote_font_family(font_family) + "," + generic_a);
    test_a = measure_text_size(measure_el, probe, 16);

    apply_probe_font(measure_el, quote_font_family(font_family) + "," + generic_b);
    test_b = measure_text_size(measure_el, probe, 16);

    apply_probe_font(measure_el, quote_font_family(font_family) + "," + generic_c);
    test_c = measure_text_size(measure_el, probe, 16);

    if (test_a.width !== size_a.width || test_a.height !== size_a.height)
    {
        return true;
    }

    if (test_b.width !== size_b.width || test_b.height !== size_b.height)
    {
        return true;
    }

    if (test_c.width !== size_c.width || test_c.height !== size_c.height)
    {
        return true;
    }

    return false;
}

function apply_probe_font(el, font_family_css)
{
    el.style.fontFamily = font_family_css;
    el.style.fontWeight = "normal";
    el.style.fontStyle = "normal";
    el.style.textDecoration = "none";
    el.style.fontSize = "16px";
}

function quote_font_family(name)
{
    if (!name)
    {
        return "";
    }

    if (name.indexOf(" ") >= 0)
    {
        return "\"" + name + "\"";
    }

    return name;
}

function apply_label_styles(el, label, fallback_text_color, font_size, font_spec)
{
    var font_family = "";
    var is_bold = false;

    if (font_spec && font_spec.font_family)
    {
        font_family = font_spec.font_family;
    }
    else if (label.font)
    {
        font_family = label.font;
    }

    if (font_family)
    {
        el.style.fontFamily = quote_font_family(font_family);
    }
    else
    {
        el.style.removeProperty("font-family");
    }

    is_bold = !!label.bold;

    if (font_spec && font_spec.force_bold)
    {
        is_bold = true;
    }

    el.style.fontSize = font_size + "px";

    if (label.text_color === "*" || label.text_color === "auto")
    {
        el.style.color = color_css(fallback_text_color || "#ccc");
    }
    else
    {
        el.style.color = color_css(label.text_color || fallback_text_color || "#ccc");
    }

    el.style.fontWeight = is_bold ? "bold" : "normal";
    el.style.fontStyle = label.italic ? "italic" : "normal";
    el.style.textDecoration = label.underline ? "underline" : "none";
}

function calculate_aligned_x(align, available_width, text_width)
{
    if (align === "left")
    {
        return 0;
    }

    if (align === "right")
    {
        return Math.max(0, available_width - text_width);
    }

    return Math.max(0, Math.floor((available_width - text_width) / 2));
}

function calculate_single_line_y(valign, available_height, text_height)
{
    if (valign === "top")
    {
        return 0;
    }

    if (valign === "bottom")
    {
        return Math.max(0, available_height - text_height);
    }

    return Math.max(0, Math.floor((available_height - text_height) / 2));
}

function measure_text_size(el, text, default_height)
{
    var rect;
    var width = 0;
    var height = 0;

    if (el)
    {
        el.textContent = text;
    }

    if (el && el.getBoundingClientRect)
    {
        rect = el.getBoundingClientRect();

        if (rect)
        {
            width = Math.ceil(rect.width);
            height = Math.ceil(rect.height);
        }
    }

    if (width <= 0 && el && el.offsetWidth !== undefined)
    {
        width = el.offsetWidth;
    }

    if (width <= 0 && el && el.scrollWidth !== undefined)
    {
        width = el.scrollWidth;
    }

    if (height <= 0 && el && el.offsetHeight !== undefined)
    {
        height = el.offsetHeight;
    }

    if (height <= 0 && el && el.scrollHeight !== undefined)
    {
        height = el.scrollHeight;
    }

    if (width <= 0)
    {
        width = Math.max(0, String(text).length * 8);
    }

    if (height <= 0)
    {
        height = default_height || 16;
    }

    return {
        width: width,
        height: height
    };
}

function prepare_label_layout(spec)
{
    var text = String(spec.text || "");
    var width = parse_integer(spec.width, 0);
    var height = parse_integer(spec.height, 0);
    var base_font_size = parse_integer(spec.base_font_size, 14);
    var allow_ellipsis = spec.ellipsis !== false;
    var max_lines = parse_integer(spec.max_lines, 0);
    var measure_el = spec.measure_el;
    var font_specs = spec.font_specs || [];
    var label = spec.label;
    var can_use_two_lines;
    var has_explicit_split;
    var i;
    var current_font_spec;
    var single_font_size;
    var two_line_font_size;
    var try_single;
    var try_double;
    var try_double_truncated;
    var try_single_truncated;

    if (max_lines <= 0)
    {
        max_lines = (height >= (base_font_size * 2)) ? 2 : 1;
    }

    can_use_two_lines = (max_lines > 1) && (height >= 2);
    has_explicit_split = text.indexOf("~") >= 0;

    if (!font_specs.length)
    {
        font_specs.push(make_font_spec("", false, "default"));
    }

    for (i = 0; i < font_specs.length; i++)
    {
        current_font_spec = font_specs[i];

        single_font_size = fit_font_size_to_height(measure_el, label, current_font_spec, base_font_size, height, 1);

        if (can_use_two_lines)
        {
            two_line_font_size = fit_font_size_to_height(measure_el, label, current_font_spec, base_font_size, height, 2);
            if (two_line_font_size > 0)
            {
                try_double = layout_two_lines(measure_el, text, width, two_line_font_size, current_font_spec, label, false);
                if (try_double)
                {
                    return try_double;
                }
            }
        }

        if (single_font_size > 0)
        {
            try_single = layout_single_line(measure_el, text, width, single_font_size, current_font_spec, label);
            if (try_single && (!has_explicit_split || !can_use_two_lines))
            {
                return try_single;
            }
        }

        if (i === font_specs.length - 1 && allow_ellipsis)
        {
            if (can_use_two_lines && two_line_font_size > 0)
            {
                try_double_truncated = layout_two_lines(measure_el, text, width, two_line_font_size, current_font_spec, label, true);
                if (try_double_truncated)
                {
                    return try_double_truncated;
                }
            }

            if (single_font_size > 0)
            {
                try_single_truncated = layout_single_line_truncated(measure_el, text, width, single_font_size, current_font_spec, label);
                if (try_single_truncated)
                {
                    return try_single_truncated;
                }
            }
        }
    }

    return {
        lineCount: 1,
        line1: String(text || "").replace("~", " ").trim(),
        line2: "",
        line1Width: Math.max(0, String(text || "").length * 8),
        line1Height: height,
        line2Width: 0,
        line2Height: 0,
        font_spec: font_specs[0],
        font_size: Math.max(1, base_font_size),
        truncated: false
    };
}

function fit_font_size_to_height(measure_el, label, font_spec, base_font_size, available_height, line_count)
{
    var high;
    var low;
    var best;
    var mid;
    var measured_height;

    if (available_height <= 0)
    {
        return 0;
    }

    high = Math.max(1, parse_integer(base_font_size, 14));
    low = 1;
    best = 0;

    while (low <= high)
    {
        mid = ((low + high) / 2) | 0;
        measured_height = measure_label_block_height(measure_el, label, font_spec, mid, line_count);

        if (measured_height <= available_height)
        {
            best = mid;
            low = mid + 1;
        }
        else
        {
            high = mid - 1;
        }
    }

    return best;
}

function measure_label_block_height(measure_el, label, font_spec, font_size, line_count)
{
    var metrics;
    var block_height;

    apply_label_styles(measure_el, label, "", font_size, font_spec);

    metrics = measure_text_size(measure_el, "Ag", font_size);
    block_height = metrics.height * line_count;

    return block_height;
}

function layout_single_line(measure_el, text, max_width, font_size, font_spec, label)
{
    var normalized = String(text || "").replace("~", " ").trim();
    var size;

    apply_label_styles(measure_el, label, "", font_size, font_spec);
    size = measure_text_size(measure_el, normalized, font_size);

    if (size.width > max_width)
    {
        return null;
    }

    return {
        lineCount: 1,
        line1: normalized,
        line2: "",
        line1Width: size.width,
        line1Height: size.height,
        line2Width: 0,
        line2Height: 0,
        font_spec: font_spec,
        font_size: font_size,
        truncated: false
    };
}

function layout_single_line_truncated(measure_el, text, max_width, font_size, font_spec, label)
{
    var normalized = String(text || "").replace("~", " ").trim();
    var truncated;
    var size;

    apply_label_styles(measure_el, label, "", font_size, font_spec);
    truncated = truncate_with_middle_ellipsis(measure_el, normalized, max_width, font_size);
    size = measure_text_size(measure_el, truncated, font_size);

    return {
        lineCount: 1,
        line1: truncated,
        line2: "",
        line1Width: size.width,
        line1Height: size.height,
        line2Width: 0,
        line2Height: 0,
        font_spec: font_spec,
        font_size: font_size,
        truncated: truncated !== normalized
    };
}

function layout_two_lines(measure_el, text, max_width, font_size, font_spec, label, allow_truncation_on_line2)
{
    var raw = String(text || "");
    var split_index = raw.indexOf("~");
    var first_part = "";
    var second_part = "";
    var best_split;
    var longest_first;
    var size1;
    var size2;
    var trunc2;

    apply_label_styles(measure_el, label, "", font_size, font_spec);

    if (split_index >= 0)
    {
        first_part = raw.substring(0, split_index).trim();
        second_part = raw.substring(split_index + 1).trim();

        if (first_part && second_part)
        {
            size1 = measure_text_size(measure_el, first_part, font_size);
            size2 = measure_text_size(measure_el, second_part, font_size);

            if (size1.width <= max_width && size2.width <= max_width)
            {
                return {
                    lineCount: 2,
                    line1: first_part,
                    line2: second_part,
                    line1Width: size1.width,
                    line1Height: size1.height,
                    line2Width: size2.width,
                    line2Height: size2.height,
                    font_spec: font_spec,
                    font_size: font_size,
                    truncated: false
                };
            }

            if (allow_truncation_on_line2 && size1.width <= max_width)
            {
                trunc2 = truncate_with_biased_middle_ellipsis(measure_el, second_part, max_width, font_size, ellipsis_position);
                size2 = measure_text_size(measure_el, trunc2, font_size);

                if (size2.width <= max_width)
                {
                    return {
                        lineCount: 2,
                        line1: first_part,
                        line2: trunc2,
                        line1Width: size1.width,
                        line1Height: size1.height,
                        line2Width: size2.width,
                        line2Height: size2.height,
                        font_spec: font_spec,
                        font_size: font_size,
                        truncated: trunc2 !== second_part
                    };
                }
            }
        }
    }

    best_split = find_best_two_line_split(measure_el, raw.replace("~", " ").trim(), max_width, font_size);
    if (best_split)
    {
        best_split.font_spec = font_spec;
        best_split.font_size = font_size;
        best_split.truncated = false;
        return best_split;
    }

    if (!allow_truncation_on_line2)
    {
        return null;
    }

    longest_first = find_longest_first_line_split(measure_el, raw.replace("~", " ").trim(), max_width, font_size);
    if (!longest_first)
    {
        return null;
    }

    trunc2 = truncate_with_biased_middle_ellipsis(measure_el, longest_first.line2, max_width, font_size, ellipsis_position);
    size2 = measure_text_size(measure_el, trunc2, font_size);

    if (size2.width > max_width)
    {
        return null;
    }

    longest_first.line2 = trunc2;
    longest_first.line2Width = size2.width;
    longest_first.line2Height = size2.height;
    longest_first.font_spec = font_spec;
    longest_first.font_size = font_size;
    longest_first.truncated = trunc2 !== longest_first.original_line2;
    delete longest_first.original_line2;

    return longest_first;
}

function find_best_two_line_split(measure_el, text, max_width, font_size)
{
    var best = null;
    var best_diff = Infinity;
    var i;
    var prev;
    var curr;
    var part1;
    var part2;
    var size1;
    var size2;
    var diff;
    var is_boundary;

    for (i = 1; i < text.length; i++)
    {
        prev = text.charAt(i - 1);
        curr = text.charAt(i);

        is_boundary =
            curr === " " ||
            curr === "-" ||
            curr === "_" ||
            ((curr >= "A" && curr <= "Z") && (prev >= "a" && prev <= "z")) ||
            ((curr >= "A" && curr <= "Z") && (prev >= "0" && prev <= "9")) ||
            ((curr >= "a" && curr <= "z") && (prev >= "0" && prev <= "9")) ||
            ((curr >= "0" && curr <= "9") && (prev >= "A" && prev <= "Z")) ||
            ((curr >= "0" && curr <= "9") && (prev >= "a" && prev <= "z"));

        if (!is_boundary)
        {
            continue;
        }

        part1 = text.substring(0, i).trim();
        part2 = text.substring(curr === " " || curr === "-" || curr === "_" ? i + 1 : i).trim();

        if (!part1 || !part2)
        {
            continue;
        }

        size1 = measure_text_size(measure_el, part1, font_size);
        size2 = measure_text_size(measure_el, part2, font_size);

        if (size1.width <= max_width && size2.width <= max_width)
        {
            diff = Math.abs(size1.width - size2.width);

            if (diff < best_diff)
            {
                best_diff = diff;
                best = {
                    lineCount: 2,
                    line1: part1,
                    line2: part2,
                    line1Width: size1.width,
                    line1Height: size1.height,
                    line2Width: size2.width,
                    line2Height: size2.height
                };
            }
        }
    }

    return best;
}

function find_longest_first_line_split(measure_el, text, max_width, font_size)
{
    var best = null;
    var best_width = 0;
    var delimiters = [" ", "-", "_"];
    var di;
    var delimiter;
    var i;
    var part1;
    var part2;
    var size1;

    for (di = 0; di < delimiters.length; di++)
    {
        delimiter = delimiters[di];

        for (i = 1; i < text.length; i++)
        {
            if (text.charAt(i) !== delimiter)
            {
                continue;
            }

            part1 = text.substring(0, i).trim();
            part2 = text.substring(i + 1).trim();

            if (!part1 || !part2)
            {
                continue;
            }

            size1 = measure_text_size(measure_el, part1, font_size);

            if (size1.width <= max_width && size1.width > best_width)
            {
                best_width = size1.width;
                best = {
                    lineCount: 2,
                    line1: part1,
                    line2: part2,
                    original_line2: part2,
                    line1Width: size1.width,
                    line1Height: size1.height,
                    line2Width: 0,
                    line2Height: 0
                };
            }
        }
    }

    return best;
}

function truncate_with_middle_ellipsis(measure_el, text, max_width, font_size)
{
    return truncate_with_biased_middle_ellipsis(measure_el, text, max_width, font_size, 0.50);
}

function truncate_with_biased_middle_ellipsis(measure_el, text, max_width, font_size, left_ratio)
{
    var ellipsis = "...";
    var ellipsis_size;
    var full_size;
    var remove_count;
    var keep_total;
    var left_keep;
    var right_keep;
    var candidate;
    var candidate_size;
    var best;

    text = (text === null || text === undefined) ? "" : String(text);
    left_ratio = (left_ratio === undefined || left_ratio === null) ? 0.50 : left_ratio;

    if (left_ratio < 0.05)
    {
        left_ratio = 0.05;
    }

    if (left_ratio > 0.95)
    {
        left_ratio = 0.95;
    }

    ellipsis_size = measure_text_size(measure_el, ellipsis, font_size);
    if (ellipsis_size.width > max_width)
    {
        return "";
    }

    full_size = measure_text_size(measure_el, text, font_size);
    if (full_size.width <= max_width)
    {
        return text;
    }

    best = ellipsis;

    for (remove_count = 1; remove_count <= text.length; remove_count++)
    {
        keep_total = text.length - remove_count;
        if (keep_total < 0)
        {
            keep_total = 0;
        }

        left_keep = Math.floor(keep_total * left_ratio);
        right_keep = keep_total - left_keep;

        candidate = text.slice(0, left_keep) + ellipsis + text.slice(text.length - right_keep);
        candidate_size = measure_text_size(measure_el, candidate, font_size);

        if (candidate_size.width <= max_width)
        {
            best = candidate;
            break;
        }
    }

    return best;
}

function debug_label_log(label, stage, msg)
{
    var line = "LABELDBG stage=" + stage + " text=" + JSON.stringify(label.text || "") + " " + msg;

    if (typeof console !== "undefined" && console && typeof console.log === "function")
    {
        console.log(line);
    }

    if (typeof osc_send === "function")
    {
        osc_send("/debug", [line]);
    }
}
