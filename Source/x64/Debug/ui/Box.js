// Box.js

const DEBUG_BOX_GEOMETRY = false;
const DEBUG_BOX_DRAW = false;

class Box
{
    constructor(spec = {})
    {
        this.id = spec.id || "box";
        this.path = spec.path || "";
        this.xpos = parse_integer(spec.xpos, 0);
        this.ypos = parse_integer(spec.ypos, 0);
        this.width = parse_integer(spec.width, 0);
        this.height = parse_integer(spec.height, 0);
        this.dom_element = null;

        if (spec.border !== undefined)
        {
            this.border = parse_integer(spec.border, 0);
        }

        if (spec.border_left !== undefined)
        {
            this.border_left = parse_integer(spec.border_left, 0);
        }

        if (spec.border_top !== undefined)
        {
            this.border_top = parse_integer(spec.border_top, 0);
        }

        if (spec.border_right !== undefined)
        {
            this.border_right = parse_integer(spec.border_right, 0);
        }

        if (spec.border_bottom !== undefined)
        {
            this.border_bottom = parse_integer(spec.border_bottom, 0);
        }

        this.border_color = spec.border_color !== undefined ? spec.border_color : "#666";
        this.background_color = spec.background_color;

        this.inner_x = 0;
        this.inner_y = 0;
        this.inner_width = 0;
        this.inner_height = 0;
    }

    getBorders()
    {
        var borders =
        {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0
        };

        var requested_left = 0;
        var requested_top = 0;
        var requested_right = 0;
        var requested_bottom = 0;
        var max_h = Math.floor(this.width / 4);
        var max_v = Math.floor(this.height / 4);

        if (max_h < 0)
        {
            max_h = 0;
        }

        if (max_v < 0)
        {
            max_v = 0;
        }

        if (this.border !== undefined)
        {
            requested_left = parse_integer(this.border, 0);
            requested_top = parse_integer(this.border, 0);
            requested_right = parse_integer(this.border, 0);
            requested_bottom = parse_integer(this.border, 0);
        }

        if (this.border_left !== undefined)
        {
            requested_left = parse_integer(this.border_left, requested_left);
        }

        if (this.border_top !== undefined)
        {
            requested_top = parse_integer(this.border_top, requested_top);
        }

        if (this.border_right !== undefined)
        {
            requested_right = parse_integer(this.border_right, requested_right);
        }

        if (this.border_bottom !== undefined)
        {
            requested_bottom = parse_integer(this.border_bottom, requested_bottom);
        }

        borders.left = requested_left;
        borders.top = requested_top;
        borders.right = requested_right;
        borders.bottom = requested_bottom;

        if (borders.left < 0)
        {
            borders.left = 0;
        }

        if (borders.left > max_h)
        {
            borders.left = max_h;
        }

        if (borders.top < 0)
        {
            borders.top = 0;
        }

        if (borders.top > max_v)
        {
            borders.top = max_v;
        }

        if (borders.right < 0)
        {
            borders.right = 0;
        }

        if (borders.right > max_h)
        {
            borders.right = max_h;
        }

        if (borders.bottom < 0)
        {
            borders.bottom = 0;
        }

        if (borders.bottom > max_v)
        {
            borders.bottom = max_v;
        }

        if (borders.left !== requested_left)
        {
            this.border_left = borders.left;

            if (typeof osc_send === "function")
            {
                osc_send("/warning", ["box", this.path, "border_left adjusted", requested_left, borders.left]);
            }
        }

        if (borders.top !== requested_top)
        {
            this.border_top = borders.top;

            if (typeof osc_send === "function")
            {
                osc_send("/warning", ["box", this.path, "border_top adjusted", requested_top, borders.top]);
            }
        }

        if (borders.right !== requested_right)
        {
            this.border_right = borders.right;

            if (typeof osc_send === "function")
            {
                osc_send("/warning", ["box", this.path, "border_right adjusted", requested_right, borders.right]);
            }
        }

        if (borders.bottom !== requested_bottom)
        {
            this.border_bottom = borders.bottom;

            if (typeof osc_send === "function")
            {
                osc_send("/warning", ["box", this.path, "border_bottom adjusted", requested_bottom, borders.bottom]);
            }
        }

        if (DEBUG_BOX_GEOMETRY)
        {
            debug_box_log(
                this,
                "getBorders",
                "requested=(" + requested_left + "," + requested_top + "," + requested_right + "," + requested_bottom + ")" +
                " effective=(" + borders.left + "," + borders.top + "," + borders.right + "," + borders.bottom + ")" +
                " size=(" + this.width + "," + this.height + ")" +
                " max=(" + max_h + "," + max_v + ")"
            );
        }

        return borders;
    }

    getInnerRect()
    {
        var borders = this.getBorders();
        var x = borders.left;
        var y = borders.top;
        var w = this.width - borders.left - borders.right;
        var h = this.height - borders.top - borders.bottom;

        if (w < 0)
        {
            w = 0;

            if (typeof osc_send === "function")
            {
                osc_send("/warning", ["box", this.path, "inner width adjusted", "negative", 0]);
            }
        }

        if (h < 0)
        {
            h = 0;

            if (typeof osc_send === "function")
            {
                osc_send("/warning", ["box", this.path, "inner height adjusted", "negative", 0]);
            }
        }

        if (DEBUG_BOX_GEOMETRY)
        {
            debug_box_log(
                this,
                "getInnerRect",
                "borders=(" + borders.left + "," + borders.top + "," + borders.right + "," + borders.bottom + ")" +
                " rect=(" + x + "," + y + "," + w + "," + h + ")" +
                " outer=(" + this.width + "," + this.height + ")"
            );
        }

        return {
            xpos: x,
            ypos: y,
            width: w,
            height: h
        };
    }

    updateInnerRect()
    {
        var rect = this.getInnerRect();

        this.inner_x = rect.xpos;
        this.inner_y = rect.ypos;
        this.inner_width = rect.width;
        this.inner_height = rect.height;

        if (DEBUG_BOX_GEOMETRY)
        {
            debug_box_log(
                this,
                "updateInnerRect",
                "inner=(" + this.inner_x + "," + this.inner_y + "," + this.inner_width + "," + this.inner_height + ")"
            );
        }

        return rect;
    }

    setRect(xpos, ypos, width, height)
    {
        this.xpos = parse_integer(xpos, this.xpos);
        this.ypos = parse_integer(ypos, this.ypos);
        this.width = parse_integer(width, this.width);
        this.height = parse_integer(height, this.height);

        if (DEBUG_BOX_GEOMETRY)
        {
            debug_box_log(
                this,
                "setRect",
                "rect=(" + this.xpos + "," + this.ypos + "," + this.width + "," + this.height + ")"
            );
        }
    }

    draw_borders(dom_element)
    {
        var borders = this.getBorders();
        var border_color = color_css(resolve_companion_color(this.border_color || "#666", 0, this.path, "border-color"));
        var rendered_border_color = border_color;
        var border_color_ok = true;
        var rect;
        var box_el;

        if (arguments.length > 0)
        {
            this.dom_element = dom_element;
        }

        box_el = this.dom_element;

        if (!box_el)
        {
            throw new Error("Box.draw_borders() requires this.dom_element to be set");
        }

        if (DEBUG_BOX_DRAW)
        {
            debug_box_log(
                this,
                "draw_borders.begin",
                "rect=(" + this.xpos + "," + this.ypos + "," + this.width + "," + this.height + ")" +
                " borders=(" + borders.left + "," + borders.top + "," + borders.right + "," + borders.bottom + ")"
            );
        }

        box_el.style.position = "absolute";
        box_el.style.left = this.xpos + "px";
        box_el.style.top = this.ypos + "px";
        box_el.style.width = this.width + "px";
        box_el.style.height = this.height + "px";
        box_el.style.overflow = "hidden";
        box_el.style.boxSizing = "border-box";

        box_el.style.backgroundColor = "";

        box_el.style.borderLeftColor = "";
        box_el.style.borderTopColor = "";
        box_el.style.borderRightColor = "";
        box_el.style.borderBottomColor = "";

        if (border_color !== undefined)
        {
            box_el.style.borderLeftColor = rendered_border_color;

            if (box_el.style.borderLeftColor === "")
            {
                border_color_ok = false;

                if (typeof osc_send === "function")
                {
                    osc_send("/warning", ["box", this.path, "invalid border_color", border_color]);
                }
            }
        }

        box_el.style.borderLeft = borders.left + "px solid " + rendered_border_color;
        box_el.style.borderTop = borders.top + "px solid " + rendered_border_color;
        box_el.style.borderRight = borders.right + "px solid " + rendered_border_color;
        box_el.style.borderBottom = borders.bottom + "px solid " + rendered_border_color;

        if (border_color_ok === false)
        {
            box_el.style.borderLeft = "";
            box_el.style.borderTop = "";
            box_el.style.borderRight = "";
            box_el.style.borderBottom = "";
        }

        rect = this.updateInnerRect();

        if (DEBUG_BOX_DRAW)
        {
            debug_box_log(
                this,
                "draw_borders.before_draw",
                "inner=(" + rect.xpos + "," + rect.ypos + "," + rect.width + "," + rect.height + ")" +
                " dispatch=" + get_draw_owner_name(this)
            );
        }

        this.draw();

        if (DEBUG_BOX_DRAW)
        {
            debug_box_log(
                this,
                "draw_borders.end",
                "background=" + JSON.stringify(this.background_color) +
                " inner=(" + this.inner_x + "," + this.inner_y + "," + this.inner_width + "," + this.inner_height + ")"
            );
        }
    }

    draw()
    {
        var background_color_ok = true;
        var box_el = this.dom_element;

        if (!box_el)
        {
            throw new Error("Box.draw() requires this.dom_element to be set");
        }

        if (DEBUG_BOX_DRAW)
        {
            debug_box_log(
                this,
                "draw.begin",
                "background=" + JSON.stringify(this.background_color)
            );
        }

        while (box_el.firstChild)
        {
            box_el.removeChild(box_el.firstChild);
        }

        var background_color = this.background_color;

        if (typeof this.getBoxBackgroundColor === "function")
        {
            background_color = this.getBoxBackgroundColor();
        }

        if (background_color !== undefined && background_color !== null && background_color !== "")
        {
            var resolved_background_color = resolve_companion_color(background_color, 0, this.path, "background-color");
            var css_background_color = color_css(resolved_background_color);

            if (css_background_color !== "")
            {
                box_el.style.backgroundColor = css_background_color;
            }
            else
            {
                background_color_ok = false;
                box_el.style.backgroundColor = "";

                if (typeof osc_send === "function")
                {
                    osc_send("/warning", ["box", this.path, "invalid background_color", background_color]);
                }
            }
        }
        else
        {
            box_el.style.backgroundColor = "";
        }

        if (background_color_ok === false)
        {
            box_el.style.backgroundColor = "";
        }

        if (DEBUG_BOX_DRAW)
        {
            debug_box_log(
                this,
                "draw.end",
                "appliedBackground=" + JSON.stringify(box_el.style.backgroundColor || "")
            );
        }
    }

    applyToElement(dom_element)
    {
        if (DEBUG_BOX_DRAW)
        {
            debug_box_log(
                this,
                "applyToElement",
                "dispatch=draw_borders"
            );
        }

        this.draw_borders(dom_element);
    }

    toJSON()
    {
        var json =
        {
            id: this.id,
            path: this.path,
            xpos: this.xpos,
            ypos: this.ypos,
            width: this.width,
            height: this.height,
            inner_x: this.inner_x,
            inner_y: this.inner_y,
            inner_width: this.inner_width,
            inner_height: this.inner_height
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

        return json;
    }
}

function debug_box_log(box, stage, msg)
{
    var line = "BOXDBG stage=" + stage + " path=" + box.path + " " + msg;

    if (typeof console !== "undefined" && console && typeof console.log === "function")
    {
        console.log(line);
    }

    if (typeof osc_send === "function")
    {
        osc_send("/debug", [line]);
    }
}

function get_draw_owner_name(obj)
{
    if (!obj)
    {
        return "<null>";
    }

    if (obj.constructor && obj.constructor.name)
    {
        return obj.constructor.name + ".draw";
    }

    return "<unknown>.draw";
}
