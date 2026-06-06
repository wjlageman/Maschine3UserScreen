// ScreenLayout.js

class ScreenLayout
{
    constructor(node)
    {
        this.node = node || null;

        this.id = "";

        this.widget_count = 1;
        this.gap = 0;


        this.border = undefined;
        this.border_left = undefined;
        this.border_top = undefined;
        this.border_right = undefined;
        this.border_bottom = undefined;

        this.border_color = undefined;
        this.background_color = undefined;

        this.align = undefined;
        this.valign = undefined;
        this.font = undefined;
        this.font_size = undefined;
        this.text_color = undefined;
        this.bold = undefined;
        this.italic = undefined;
        this.underline = undefined;

        this.warnings = [];
        this.errors = [];

        this.read_from_node(node);
        this.normalize();
    }

    add_warning(code, message)
    {
        this.warnings.push(
        {
            code: code || "warning",
            message: message || ""
        });
    }

    add_error(code, message)
    {
        this.errors.push(
        {
            code: code || "error",
            message: message || ""
        });
    }

    has_errors()
    {
        return this.errors.length > 0;
    }

    read_color_attribute(node, name)
    {
        var value;
        var parts;

        value = get_optional_string_attr(node, name);
        if (value === undefined)
        {
            return undefined;
        }

        value = String(value);

        if (value.indexOf("|") < 0)
        {
            if (value === "*")
            {
                this.add_error("invalid-color-value", name + " cannot be a single companion marker");
                return undefined;
            }

            return value;
        }

        parts = value.split("|");

        if (parts.length !== 2 || parts[0] === "" || parts[1] === "" || (parts[0] === "*" && parts[1] === "*"))
        {
            this.add_error("invalid-color-value", name + " has invalid value " + JSON.stringify(value));
            return undefined;
        }

        return value;
    }

    reject_color_aliases(node)
    {
        this.reject_color_alias(node, "colors");
        this.reject_color_alias(node, "text-colors");
        this.reject_color_alias(node, "text_colors");
        this.reject_color_alias(node, "background-colors");
        this.reject_color_alias(node, "background_colors");
        this.reject_color_alias(node, "led-colors");
        this.reject_color_alias(node, "led_colors");
        this.reject_color_alias(node, "border-colors");
        this.reject_color_alias(node, "border_colors");
    }

    reject_color_alias(node, name)
    {
        if (!node || !node.hasAttribute || !node.hasAttribute(name))
        {
            return;
        }

        this.add_error("deprecated-color-key", name + " is not supported; use the singular dash-style color attribute");
    }

    assign_color_attribute(key, value)
    {
        if (value === undefined)
        {
            return;
        }

        this[key] = value;
    }

    read_from_node(node)
    {
        if (!node)
        {
            this.add_error("missing-layout-node", "layout has no source node");
            return;
        }

        this.node = node;
        this.id = node.getAttribute("id") || "";

        this.reject_color_aliases(node);

        if (!this.id)
        {
            this.add_error("missing-layout-id", "layout has no id");
        }

        this.widget_count = parse_integer(node.getAttribute("widget-count"), 1);
        this.gap = parse_integer(node.getAttribute("gap"), 0);


        this.border = get_optional_integer_attr(node, "border");
        this.border_left = get_optional_integer_attr(node, "border-left");
        this.border_top = get_optional_integer_attr(node, "border-top");
        this.border_right = get_optional_integer_attr(node, "border-right");
        this.border_bottom = get_optional_integer_attr(node, "border-bottom");

        this.border_color = this.read_color_attribute(node, "border-color");
        this.assign_color_attribute("background_color", this.read_color_attribute(node, "background-color"));

        this.align = get_optional_string_attr(node, "align");
        this.valign = get_optional_string_attr(node, "valign");
        this.font = get_optional_string_attr(node, "font");

        this.font_size = get_optional_integer_attr(node, "font-size");

        if (this.font_size === undefined)
        {
            this.font_size = get_optional_integer_attr(node, "fontsize");
        }

        this.assign_color_attribute("text_color", this.read_color_attribute(node, "text-color"));
        this.bold = get_optional_integer_attr(node, "bold");
        this.italic = get_optional_integer_attr(node, "italic");
        this.underline = get_optional_integer_attr(node, "underline");
    }

    normalize_non_negative(value, name)
    {
        var original = parse_integer(value, 0);
        var normalized = original;

        if (normalized < 0)
        {
            normalized = 0;
        }

        if (normalized !== original)
        {
            this.add_warning(name + "-adjusted", name + " adjusted from " + original + " to " + normalized);
        }

        return normalized;
    }

    normalize_optional_non_negative(value, name)
    {
        var original;
        var normalized;

        if (value === undefined)
        {
            return undefined;
        }

        original = parse_integer(value, 0);
        normalized = original;

        if (normalized < 0)
        {
            normalized = 0;
        }

        if (normalized !== original)
        {
            this.add_warning(name + "-adjusted", name + " adjusted from " + original + " to " + normalized);
        }

        return normalized;
    }

    normalize()
    {
        this.widget_count = this.normalize_non_negative(this.widget_count, "widget-count");
        this.gap = this.normalize_non_negative(this.gap, "gap");

        if (this.widget_count <= 0)
        {
            this.add_warning("widget-count-adjusted", "widget-count adjusted from 0 to 1");
            this.widget_count = 1;
        }


        this.border = this.normalize_optional_non_negative(this.border, "border");
        this.border_left = this.normalize_optional_non_negative(this.border_left, "border-left");
        this.border_top = this.normalize_optional_non_negative(this.border_top, "border-top");
        this.border_right = this.normalize_optional_non_negative(this.border_right, "border-right");
        this.border_bottom = this.normalize_optional_non_negative(this.border_bottom, "border-bottom");

        if (this.align !== undefined)
        {
            this.align = String(this.align).toLowerCase();
        }

        if (this.valign !== undefined)
        {
            this.valign = String(this.valign).toLowerCase();
        }

        if (this.font !== undefined)
        {
            this.font = String(this.font);
        }

        if (this.border_color !== undefined)
        {
            this.border_color = String(this.border_color);
        }

        if (this.background_color !== undefined)
        {
            this.background_color = String(this.background_color);
        }

        if (this.text_color !== undefined)
        {
            this.text_color = String(this.text_color);
        }

        this.font_size = this.normalize_optional_non_negative(this.font_size, "font-size");
        this.bold = this.normalize_optional_non_negative(this.bold, "bold");
        this.italic = this.normalize_optional_non_negative(this.italic, "italic");
        this.underline = this.normalize_optional_non_negative(this.underline, "underline");
    }

    toJSON()
    {
        var json =
        {
            id: this.id,
            widget_count: this.widget_count,
            gap: this.gap,
            warnings: this.warnings.slice(0),
            errors: this.errors.slice(0)
        };

        if (this.border !== undefined)
        {
            json.border = this.border;
        }

        if (this.border_left !== undefined)
        {
            json["border-left"] = this.border_left;
        }

        if (this.border_top !== undefined)
        {
            json["border-top"] = this.border_top;
        }

        if (this.border_right !== undefined)
        {
            json["border-right"] = this.border_right;
        }

        if (this.border_bottom !== undefined)
        {
            json["border-bottom"] = this.border_bottom;
        }

        if (this.border_color !== undefined)
        {
            json["border-color"] = this.border_color;
        }

        if (this.background_color !== undefined)
        {
            json["background-color"] = this.background_color;
        }

        if (this.align !== undefined)
        {
            json.align = this.align;
        }

        if (this.valign !== undefined)
        {
            json.valign = this.valign;
        }

        if (this.font !== undefined)
        {
            json.font = this.font;
        }

        if (this.font_size !== undefined)
        {
            json.font_size = this.font_size;
        }

        if (this.text_color !== undefined)
        {
            json.text_color = this.text_color;
        }

        if (this.bold !== undefined)
        {
            json.bold = this.bold;
        }

        if (this.italic !== undefined)
        {
            json.italic = this.italic;
        }

        if (this.underline !== undefined)
        {
            json.underline = this.underline;
        }

        return json;
    }
}