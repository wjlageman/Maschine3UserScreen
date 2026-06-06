// PanelWidget.js

const DEBUG_PANEL_LIFECYCLE = false;
const DEBUG_PANEL_DRAW = false;

class PanelWidget extends Widget
{
    constructor(spec = {})
    {
        super(Object.assign({}, spec, { type: "panel" }));

        this.background_color = spec.background_color || "";
        this.background_color2 = spec.background_color2 || "";
        this.header_height_ratio = (spec.header_height_ratio !== undefined) ? spec.header_height_ratio : 1.0;

        this.text = new Label(
        {
            text: spec.text,
            align: spec.align || "center",
            valign: spec.valign || "middle",
            font: spec.font,
            font_size: spec.font_size,
            text_color: spec.text_color,
            bold: spec.bold,
            italic: spec.italic,
            underline: spec.underline
        });

        this.text_color2 = spec.text_color2 || "";

        if (spec.type === undefined || spec.type === "panel")
        {
            this.normalize();
        }

        if (DEBUG_PANEL_LIFECYCLE)
        {
            debug_panel_log(
                this,
                "constructor",
                "outer=(" + this.xpos + "," + this.ypos + "," + this.width + "," + this.height + ")" +
                " headerHeightRatio=" + this.header_height_ratio +
                " text=" + JSON.stringify(this.text ? this.text.text : "")
            );
        }
    }

    setState(properties = {})
    {
        var base_properties = {};
        var key;

        if (properties.background_color !== undefined)
        {
            this.background_color = properties.background_color || "";
        }

        if (properties.background_color2 !== undefined)
        {
            this.background_color2 = properties.background_color2 || "";
        }

        if (properties.header_height_ratio !== undefined)
        {
            this.header_height_ratio = properties.header_height_ratio;
        }

        if (properties.text_color2 !== undefined)
        {
            this.text_color2 = properties.text_color2 || "";
        }

        if (
            properties.text !== undefined ||
            properties.align !== undefined ||
            properties.valign !== undefined ||
            properties.font !== undefined ||
            properties.font_size !== undefined ||
            properties.text_color !== undefined ||
            properties.bold !== undefined ||
            properties.italic !== undefined ||
            properties.underline !== undefined
        )
        {
            this.text.setState(
            {
                text: properties.text,
                align: properties.align,
                valign: properties.valign,
                font: properties.font,
                font_size: properties.font_size,
                text_color: properties.text_color,
                bold: properties.bold,
                italic: properties.italic,
                underline: properties.underline
            });
        }

        for (key in properties)
        {
            if (!Object.prototype.hasOwnProperty.call(properties, key))
            {
                continue;
            }

            if (
                key === "text" ||
                key === "align" ||
                key === "valign" ||
                key === "font" ||
                key === "font_size" ||
                key === "text_color" ||
                key === "bold" ||
                key === "italic" ||
                key === "underline"
            )
            {
                continue;
            }

            base_properties[key] = properties[key];
        }

        super.setState(base_properties);

        if (DEBUG_PANEL_LIFECYCLE)
        {
            debug_panel_log(
                this,
                "setState",
                "outer=(" + this.xpos + "," + this.ypos + "," + this.width + "," + this.height + ")" +
                " headerHeightRatio=" + this.header_height_ratio +
                " text=" + JSON.stringify(this.text ? this.text.text : "")
            );
        }
    }

    draw()
    {
        var payload_el = null;
        var text_margin = 1;
        var payload_rect;
        var payload_text_rect;
        var box_el = this.dom_element;
        var header_height = 0;

        if (DEBUG_PANEL_DRAW)
        {
            debug_panel_log(
                this,
                "draw.begin",
                "outer=(" + this.xpos + "," + this.ypos + "," + this.width + "," + this.height + ")" +
                " inner=(" + this.inner_x + "," + this.inner_y + "," + this.inner_width + "," + this.inner_height + ")" +
                " headerHeightRatio=" + this.header_height_ratio +
                " text=" + JSON.stringify(this.text ? this.text.text : "")
            );
        }

        super.draw();

        header_height = Math.max(0, Math.round(this.inner_height * this.header_height_ratio));

        payload_rect =
        {
            xpos: this.inner_x,
            ypos: this.inner_y,
            width: this.inner_width,
            height: header_height
        };

        payload_text_rect =
        {
            xpos: text_margin,
            ypos: text_margin,
            width: Math.max(0, payload_rect.width - (2 * text_margin)),
            height: Math.max(0, payload_rect.height - (2 * text_margin))
        };

        if (!this.text || typeof this.text.applyToElement !== "function")
        {
            if (DEBUG_PANEL_DRAW)
            {
                debug_panel_log(
                    this,
                    "draw.no_text_renderer",
                    "payloadRect=(" + payload_rect.xpos + "," + payload_rect.ypos + "," + payload_rect.width + "," + payload_rect.height + ")"
                );
            }

            return;
        }

        payload_el = document.createElement("div");
        payload_el.setAttribute("data-role", "panel-payload");
        payload_el.style.position = "absolute";
        payload_el.style.left = px(payload_rect.xpos);
        payload_el.style.top = px(payload_rect.ypos);
        payload_el.style.width = px(payload_rect.width);
        payload_el.style.height = px(payload_rect.height);
        payload_el.style.overflow = "hidden";
        payload_el.style.boxSizing = "border-box";

        box_el.append(payload_el);

        this.text.applyToElement(
            payload_el,
            this.getRenderTextColor(),
            {
                width: payload_text_rect.width,
                height: payload_text_rect.height
            }
        );

        payload_el.style.left = px(payload_rect.xpos + payload_text_rect.xpos);
        payload_el.style.top = px(payload_rect.ypos + payload_text_rect.ypos);
        payload_el.style.width = px(payload_text_rect.width);
        payload_el.style.height = px(payload_text_rect.height);

        if (DEBUG_PANEL_DRAW)
        {
            debug_panel_log(
                this,
                "draw.end",
                "finalPayloadEl=(" +
                (payload_rect.xpos + payload_text_rect.xpos) + "," +
                (payload_rect.ypos + payload_text_rect.ypos) + "," +
                payload_text_rect.width + "," +
                payload_text_rect.height + ")"
            );
        }

        this.requestDisplayUpdate();
    }

    getRenderBackgroundColor()
    {
        if (this.background_color === undefined || this.background_color === null || this.background_color === "")
        {
            return "";
        }

        return resolve_companion_color(this.background_color, 0, this.path, "background-color");
    }

    getRenderTextColor()
    {
        var color = this.text && this.text.text_color ? this.text.text_color : "*";

        if (color === "*" || color === "auto")
        {
            return auto_text_color(this.getRenderBackgroundColor());
        }

        return color;
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();
        var text_json = this.text.getPublicData();
        var key;

        if (this.background_color)
        {
            json.background_color = this.background_color;
        }

        if (this.background_color2)
        {
            json.background_color2 = this.background_color2;
        }

        if (this.header_height_ratio !== 1.0)
        {
            json.header_height_ratio = this.header_height_ratio;
        }

        if (this.text_color2)
        {
            json.text_color2 = this.text_color2;
        }

        for (key in text_json)
        {
            json[key] = text_json[key];
        }

        return json;
    }
}

function debug_panel_log(widget, stage, msg)
{
    var path = (widget && widget.path) ? widget.path : "<no-path>";
    var line = "PANELDBG stage=" + stage + " path=" + path + " " + msg;

    if (typeof console !== "undefined" && console && typeof console.log === "function")
    {
        console.log(line);
    }

    if (typeof osc_send === "function")
    {
        osc_send("/debug", [line]);
    }
}
