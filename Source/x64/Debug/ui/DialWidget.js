// DialWidget.js

const DIAL_DEBUG = false;

// thresholds use raw widget height
const DIAL_ARC_MIN_HEIGHT = 60;
const DIAL_TEXT_ONLY_MIN_HEIGHT = 40;
const DIAL_INLINE_MIN_HEIGHT = 17;

// vertical slider trigger
const DIAL_VERTICAL_MIN_WIDTH = 50;
const DIAL_VERTICAL_HEIGHT_RATIO = 2.0;

// layout ratios
const DIAL_HEADER_HEIGHT_RATIO_FULL = 0.30;
const DIAL_HEADER_HEIGHT_RATIO_COMPACT = 0.42;
const DIAL_HEADER_HEIGHT_RATIO_TINY_COMPACT = 0.40;
const DIAL_HEADER_HEIGHT_RATIO_INLINE = 0.0;
const DIAL_HEADER_HEIGHT_RATIO_VERTICAL = 0.15;

const DIAL_VALUE_HEIGHT_RATIO_FULL = 0.18;
const DIAL_COMPACT_VALUE_HEIGHT_RATIO = 0.42;
const DIAL_VALUE_HEIGHT_RATIO_VERTICAL = 0.16;

// value vertical tweaks
const DIAL_VALUE_Y_OFFSET_FULL = -2;
const DIAL_VALUE_Y_OFFSET_COMPACT = 2;

// arc tuning
const DIAL_ARC_START_DEG = 150;
const DIAL_ARC_END_DEG = 390;
const DIAL_ARC_SIZE_FACTOR = 0.68;

// visuals
const DIAL_BODY_COLOR = "#303030";
const DIAL_ARC_INACTIVE_COLOR = "#6a6a6a";
const DIAL_ARC_WIDTH = 7;
const DIAL_NEEDLE_WIDTH = 3;
const DIAL_NEEDLE_OVERSHOOT = 3;

// compact value-indicator mode
const DIAL_SLIDER_FILL_COLOR = "#3a4a58";
const DIAL_INLINE_SLIDER_FILL_COLOR = "#4A4A4A";
const DIAL_SLIDER_NEEDLE_COLOR = "#8A5A20";

// inline mode
const DIAL_INLINE_GAP = 0;
const DIAL_INLINE_LABEL_PADDING_X = 3;
const DIAL_INLINE_VALUE_PADDING_X = 3;
const DIAL_INLINE_LABEL_SIZE_FACTOR_SMALL = 1.00;
const DIAL_INLINE_LABEL_SIZE_FACTOR_MEDIUM = 1.15;
const DIAL_INLINE_LABEL_SIZE_FACTOR_LARGE = 1.30;
const DIAL_INLINE_VALUE_FONT_PX_SMALL = 11;
const DIAL_INLINE_VALUE_FONT_PX_MEDIUM = 13;
const DIAL_INLINE_VALUE_FONT_PX_LARGE = 15;

// vertical mode
const DIAL_VERTICAL_LINE_X_RATIO = 0.66;
const DIAL_VERTICAL_LINE_WIDTH = 2;
const DIAL_VERTICAL_TRIANGLE_WIDTH = 8;
const DIAL_VERTICAL_TRIANGLE_HALF_HEIGHT = 5;
const DIAL_VERTICAL_TICK_HALF_WIDTH = 3;
const DIAL_VERTICAL_BODY_TOP_MARGIN = 4;
const DIAL_VERTICAL_BODY_BOTTOM_MARGIN = 4;
const DIAL_VERTICAL_LABEL_GAP = 4;
const DIAL_VERTICAL_SCALE_FONT_PX = 11;
const DIAL_VERTICAL_VALUE_FONT_PX = 14;

// value text
const DIAL_VALUE_FONT_PX = 16;
const DIAL_TEXT_ONLY_VALUE_FONT_PX = 27;

// defaults
const DIAL_DEFAULT_MIN = 0;
const DIAL_DEFAULT_MAX = 127;
const DIAL_DEFAULT_NORM_VALUE = 0.33;
const DIAL_DEFAULT_PACE = 1.0;
const DIAL_MIN_PACE = 0.2;
const DIAL_MAX_PACE = 5.0;
const DIAL_DELTA_DIVISOR = 8.0 * 128.0;

class DialWidget extends PanelWidget
{
    constructor(spec = {})
    {
        var has_norm_value = false;
        var init_norm_value = DIAL_DEFAULT_NORM_VALUE;

        super(Object.assign({}, spec,
        {
            type: "dial",
            header_height_ratio: (spec.header_height_ratio !== undefined) ? spec.header_height_ratio : DIAL_HEADER_HEIGHT_RATIO_FULL
        }));

        this.type = "dial";
        this._value = 0;
        this.dial_nr = this.read_dial_nr();

        this.min = (spec.min !== undefined) ? parseFloat(spec.min) : DIAL_DEFAULT_MIN;
        this.max = (spec.max !== undefined) ? parseFloat(spec.max) : DIAL_DEFAULT_MAX;
        this.bipolar = spec.bipolar !== undefined ? (parse_integer(spec.bipolar, 0) !== 0) : false;
        this.pace = DIAL_DEFAULT_PACE;
        this.set_pace((spec.pace !== undefined) ? spec.pace : DIAL_DEFAULT_PACE);

        if (spec.value !== undefined && spec.value !== null && spec.value !== "")
        {
            this._value = parseFloat(spec.value);
        }
        else
        {
            if (spec.norm_value !== undefined)
            {
                init_norm_value = parseFloat(spec.norm_value);
                has_norm_value = true;
            }
            else if (spec.value_norm !== undefined)
            {
                init_norm_value = parseFloat(spec.value_norm);
                has_norm_value = true;
            }

            if (has_norm_value)
            {
                this._value = this.denormalize(init_norm_value);
            }
            else
            {
                this._value = this.denormalize(DIAL_DEFAULT_NORM_VALUE);
            }
        }

        this.value_text = (spec["value-text"] !== undefined) ? String(spec["value-text"]) : "";
        this.has_label = (spec.has_label !== undefined) ? !!parseInt(spec.has_label, 10) : true;

        this.body_color = spec["body-color"] || DIAL_BODY_COLOR;
        this.arc_color = spec["arc-color"] || "#ff9500";
        this.arc_inactive_color = spec["arc-inactive-color"] || DIAL_ARC_INACTIVE_COLOR;
        this.needle_color = spec["needle-color"] || "#ffd060";
        this.touch_active = 0;

        this.value_label = new Label(
        {
            text: this.getValueDisplayText(),
            align: "center",
            valign: "middle",
            font: "",
            font_size: DIAL_VALUE_FONT_PX,
            text_color: spec["value-color"] || "*",
            bold: true,
            ellipsis: true,
            max_lines: 1
        });

        this.normalize();
    }

    get value()
    {
        return this.getActualValue();
    }

    set value(value)
    {
        this.reset_delta_accu();
        this._value = parseFloat(value);
    }

    get norm_value()
    {
        return this.getActualNormValue();
    }

    set norm_value(value)
    {
        this.reset_delta_accu();
        this.setNormValue(parseFloat(value));
    }

    get value_norm()
    {
        return this.getActualNormValue();
    }

    set value_norm(value)
    {
        this.reset_delta_accu();
        this.setNormValue(parseFloat(value));
    }

    set_pace(value)
    {
        var numeric_value = parseFloat(value);

        if (
            isNaN(numeric_value) ||
            numeric_value < DIAL_MIN_PACE ||
            numeric_value > DIAL_MAX_PACE
        )
        {
            log(
                "[DIAL pace]",
                this.path || "",
                "invalid pace",
                String(value),
                "default=" + DIAL_DEFAULT_PACE
            );

            this.pace = DIAL_DEFAULT_PACE;
            return {
                ok: false,
                code: "invalid-pace",
                message: "pace must be between 0.2 and 5.0"
            };
        }

        this.pace = numeric_value;

        return {
            ok: true,
            code: "ok",
            message: "pace assigned"
        };
    }

    setState(properties = {})
    {
        var has_value = false;
        var has_norm_value = false;
        var next_norm_value = 0;

        super.setState(properties);

        if (
            properties.value !== undefined ||
            properties.norm_value !== undefined ||
            properties.value_norm !== undefined
        )
        {
            this.reset_delta_accu();
        }

        if (properties.min !== undefined)
        {
            this.min = parseFloat(properties.min);
        }

        if (properties.max !== undefined)
        {
            this.max = parseFloat(properties.max);
        }

        if (properties.pace !== undefined)
        {
            this.set_pace(properties.pace);
        }

        if (properties.value !== undefined && properties.value !== null && properties.value !== "")
        {
            this._value = parseFloat(properties.value);
            has_value = true;
        }

        if (properties.norm_value !== undefined)
        {
            next_norm_value = parseFloat(properties.norm_value);
            has_norm_value = true;
        }
        else if (properties.value_norm !== undefined)
        {
            next_norm_value = parseFloat(properties.value_norm);
            has_norm_value = true;
        }

        if (!has_value && has_norm_value)
        {
            this.setNormValue(next_norm_value);
        }

        if (properties["value-text"] !== undefined)
        {
            this.value_text = String(properties["value-text"]);
        }
    }

    getDisplayHeight()
    {
        return this.height;
    }

    isVerticalMode()
    {
        return this.width >= DIAL_VERTICAL_MIN_WIDTH && this.height >= Math.round(this.width * DIAL_VERTICAL_HEIGHT_RATIO);
    }

    isArcMode()
    {
        if (this.isVerticalMode())
        {
            return false;
        }

        return this.getDisplayHeight() >= DIAL_ARC_MIN_HEIGHT;
    }

    isTextOnlyMode()
    {
        if (this.isVerticalMode())
        {
            return false;
        }

        return this.getDisplayHeight() >= DIAL_TEXT_ONLY_MIN_HEIGHT && this.getDisplayHeight() < DIAL_ARC_MIN_HEIGHT;
    }

    isInlineMode()
    {
        if (this.isVerticalMode())
        {
            return false;
        }

        return this.getDisplayHeight() >= DIAL_INLINE_MIN_HEIGHT && this.getDisplayHeight() < DIAL_TEXT_ONLY_MIN_HEIGHT;
    }

    denormalize(norm_value)
    {
        if (this.max === this.min)
        {
            return this.min;
        }

        return this.min + ((this.max - this.min) * norm_value);
    }

    read_dial_nr()
    {
        var match = String(this.path || "").match(/\/dial-([1-8])$/);

        if (!match)
        {
            return 0;
        }

        return parseInt(match[1], 10);
    }

    get_delta_accu(int_dial_nr)
    {
        var dial_nr = (int_dial_nr !== undefined) ? parseInt(int_dial_nr, 10) : this.dial_nr;
        var result;

        if (dial_nr < 1 || dial_nr > 8)
        {
            return 0;
        }

        try
        {
            result = Window.this.xcall("get_delta_accu", dial_nr - 1);
            return parseInt(result, 10);
        }
        catch (e)
        {
            log("[DIAL delta accu]", this.path || "", String(e && e.message ? e.message : e));
            return 0;
        }
    }

    reset_delta_accu(int_dial_nr)
    {
        var dial_nr = (int_dial_nr !== undefined) ? parseInt(int_dial_nr, 10) : this.dial_nr;

        if (dial_nr < 1 || dial_nr > 8)
        {
            return;
        }

        try
        {
            Window.this.xcall("reset_delta_accu", dial_nr - 1);
        }
        catch (e)
        {
            log("[DIAL delta accu reset]", this.path || "", String(e && e.message ? e.message : e));
        }
    }

    getNormValue()
    {
        if (this.max === this.min)
        {
            return 0.5;
        }

        return (this._value - this.min) / (this.max - this.min);
    }

    getActualNormValue()
    {
        return this.clipNormValue(this.getNormValue() + (this.get_delta_accu() / DIAL_DELTA_DIVISOR * this.pace));
    }

    getActualValue()
    {
        return this.denormalize(this.getActualNormValue());
    }

    getClippedNormValue()
    {
        var norm_value = this.getNormValue();

        if (norm_value < 0)
        {
            return 0;
        }

        if (norm_value > 1)
        {
            return 1;
        }

        return norm_value;
    }

    setNormValue(norm_value)
    {
        this._value = this.denormalize(norm_value);
    }

    formatValueDisplayNumber(value)
    {
        var abs_value;
        var decimals = 0;

        if (typeof value !== "number" || isNaN(value))
        {
            return "";
        }

        abs_value = Math.abs(value);

        if (abs_value < 10)
        {
            decimals = 2;
        }
        else if (abs_value < 100)
        {
            decimals = 1;
        }
        else
        {
            decimals = 0;
        }

        return value.toFixed(decimals);
    }

    getValueDisplayText()
    {
        if (this.value_text !== "")
        {
            return this.value_text;
        }

        return this.formatValueDisplayNumber(this._value);
    }

    getInlineValueDisplayText()
    {
        if (this.value_text !== "")
        {
            return this.value_text;
        }

        return this.formatValueDisplayNumber(this._value);
    }

    getHeaderHeightRatio()
    {
        if (!this.has_label)
        {
            return 0.0;
        }
        if (this.isVerticalMode())
        {
            return DIAL_HEADER_HEIGHT_RATIO_VERTICAL;
        }

        if (this.isInlineMode())
        {
            return DIAL_HEADER_HEIGHT_RATIO_INLINE;
        }

        if (this.isTextOnlyMode())
        {
            if (this.getDisplayHeight() < 45)
            {
                return DIAL_HEADER_HEIGHT_RATIO_TINY_COMPACT;
            }

            return DIAL_HEADER_HEIGHT_RATIO_COMPACT;
        }

        return DIAL_HEADER_HEIGHT_RATIO_FULL;
    }

    getInlineLabelSizeFactor()
    {
        if (this.getDisplayHeight() <= 24)
        {
            return DIAL_INLINE_LABEL_SIZE_FACTOR_SMALL;
        }

        if (this.getDisplayHeight() <= 32)
        {
            return DIAL_INLINE_LABEL_SIZE_FACTOR_MEDIUM;
        }

        return DIAL_INLINE_LABEL_SIZE_FACTOR_LARGE;
    }

    getInlineValueFontPx()
    {
        return this.getInlineLabelFontPx();
    }

    getHeaderRect()
    {
        var header_height = Math.round(this.inner_height * this.getHeaderHeightRatio());

        return {
            xpos: this.inner_x,
            ypos: this.inner_y,
            width: this.inner_width,
            height: header_height
        };
    }

    getBodyRect()
    {
        var header = this.getHeaderRect();

        return {
            xpos: this.inner_x,
            ypos: this.inner_y + header.height,
            width: this.inner_width,
            height: this.inner_height - header.height
        };
    }

    getValueRect()
    {
        var body = this.getBodyRect();
        var h = Math.round(this.inner_height * DIAL_VALUE_HEIGHT_RATIO_FULL);
        var y = 0;

        if (this.isVerticalMode())
        {
            h = Math.round(this.inner_height * DIAL_VALUE_HEIGHT_RATIO_VERTICAL);
            y = body.height - h;

            return {
                xpos: 0,
                ypos: Math.max(0, y),
                width: body.width,
                height: h
            };
        }

        if (this.isArcMode())
        {
            y = body.height - h + DIAL_VALUE_Y_OFFSET_FULL;

            return {
                xpos: 0,
                ypos: Math.max(0, y),
                width: body.width,
                height: h
            };
        }

        if (this.isTextOnlyMode())
        {
            h = Math.round(this.inner_height * DIAL_COMPACT_VALUE_HEIGHT_RATIO);
            y = Math.floor((body.height - h) / 2) + DIAL_VALUE_Y_OFFSET_COMPACT;

            return {
                xpos: 0,
                ypos: Math.max(0, y),
                width: body.width,
                height: h
            };
        }

        y = body.height - h;

        return {
            xpos: 0,
            ypos: Math.max(0, y),
            width: body.width,
            height: h
        };
    }

    getVerticalGraphRect()
    {
        var body = this.getBodyRect();
        var value = this.getValueRect();

        return {
            xpos: 0,
            ypos: 0,
            width: body.width,
            height: Math.max(0, value.ypos)
        };
    }

    getArcCenterYFactor()
    {
        if (this.getDisplayHeight() >= 140)
        {
            return 0.46;
        }

        if (this.getDisplayHeight() >= 100)
        {
            return 0.48;
        }

        return 0.58;
    }

    getBodyValueFontPx()
    {
        if (this.isVerticalMode())
        {
            return DIAL_VERTICAL_VALUE_FONT_PX;
        }

        if (this.isTextOnlyMode())
        {
            return DIAL_TEXT_ONLY_VALUE_FONT_PX;
        }

        return DIAL_VALUE_FONT_PX;
    }

    getInlineLabelFontPx()
    {
        return this.text.font_size * this.getInlineLabelSizeFactor();
    }

    getTextColorForBackground(color, background_color)
    {
        if (
            color === undefined ||
            color === null ||
            color === "" ||
            color === "*" ||
            color === "auto"
        )
        {
            return auto_text_color(background_color);
        }

        return color;
    }

    getLabelTextColor()
    {
        return this.getTextColorForBackground(this.text ? this.text.text_color : "", this.background_color);
    }

    getRenderTextColor()
    {
        return this.getLabelTextColor();
    }

    getValueTextColor()
    {
        return this.getTextColorForBackground(this.value_label ? this.value_label.text_color : "", this.body_color);
    }



    redraw()
    {
        if (this.dom_element)
        {
            this.draw();
        }
    }

    clipNormValue(norm_value)
    {
        if (norm_value < 0)
        {
            return 0;
        }

        if (norm_value > 1)
        {
            return 1;
        }

        return norm_value;
    }


    sendValueOsc()
    {
        osc_send(this.path, ["value", this.value]);
        osc_send(this.path, ["norm-value", this.getNormValue()]);

        return {
            ok: true,
            code: "ok",
            message: "value and norm-value sent"
        };
    }

    applyValueChange(silent, next_value, source_name)
    {
        var old_value = this._value;

        this.reset_delta_accu();
        this._value = parseFloat(next_value);
        this.redraw();

        if (DIAL_DEBUG)
        {
            log(
                "[DIAL value]",
                this.path || "",
                "source=" + source_name,
                "value=" + old_value + " -> " + this._value,
                "silent=" + (!!silent)
            );
        }

        if (silent)
        {
            return {
                ok: true,
                code: "ok",
                message: "silent value applied"
            };
        }

        return this.sendValueOsc();
    }

    on_value(silent, atoms)
    {
        var raw_value = atoms && atoms.length > 0 ? atoms[0] : this._value;
        var next_value = parseFloat(raw_value);

        if (isNaN(next_value))
        {
            next_value = this._value;
        }

        return this.applyValueChange(silent, next_value, "value");
    }

    on_cc(value)
    {
        var int_arg = parseInt(value, 10);
        var norm_before;
        var norm_after;

        if (isNaN(int_arg))
        {
            int_arg = 0;
        }

        norm_before = this.getNormValue();

        norm_after = norm_before;
        norm_after += int_arg / DIAL_DELTA_DIVISOR * this.pace;
        norm_after = this.clipNormValue(norm_after);
        if (DIAL_DEBUG)
        {
            log("int_arg", int_arg, "pace", this.pace, norm_after);

            log(
                "[DIAL on_cc]",
                this.path || "",
                "int_arg=" + int_arg,
                "norm=" + norm_before + " -> " + norm_after,
                "value=" + this._value
            );
        }

        this.setNormValue(norm_after);
        this.redraw();

        return this.sendValueOsc();
    }

    on_touch(value)
    {
        var next_touch_active = value ? 1 : 0;

        if (this.touch_active !== next_touch_active)
        {
            this.touch_active = next_touch_active;
            this.redraw();
        }

        return {
            ok: true,
            code: "ok",
            message: "dial touch updated"
        };
    }

    draw_touch_overlay()
    {
        var overlay_el;

        if (!this.touch_active)
        {
            return;
        }

        overlay_el = document.createElement("div");
        overlay_el.setAttribute("data-role", "touch-overlay");
        overlay_el.style.position = "absolute";
        overlay_el.style.left = px(this.inner_x);
        overlay_el.style.top = px(this.inner_y);
        overlay_el.style.width = px(this.inner_width);
        overlay_el.style.height = px(this.inner_height);
        overlay_el.style.border = "1px solid rgba(255,255,255,0.75)";
        overlay_el.style.backgroundColor = "rgba(255,255,255,0.12)";
        overlay_el.style.pointerEvents = "none";
        overlay_el.style.boxSizing = "border-box";
        overlay_el.style.zIndex = "1000";

        this.dom_element.append(overlay_el);
        this.overlay_element = overlay_el;
    }

    draw()
    {
        var t0 = Date.now();
        var t1;

        this.header_height_ratio = this.getHeaderHeightRatio();
        super.draw();
        this.draw_body();
        this.draw_touch_overlay();

        t1 = Date.now();

        if (DIAL_DEBUG)
        {
            log(
                "[DIAL draw]",
                this.path || "",
                "ms=" + (t1 - t0),
                "value=" + this._value,
                "norm=" + this.getNormValue()
            );
        }

        this.requestDisplayUpdate();
    }

    draw_body()
    {
        var body_rect = this.getBodyRect();
        var value_rect = this.getValueRect();
        var body_el = document.createElement("div");
        var value_el = document.createElement("div");
        body_el.style.position = "absolute";
        body_el.style.left = px(body_rect.xpos);
        body_el.style.top = px(body_rect.ypos);
        body_el.style.width = px(body_rect.width);
        body_el.style.height = px(body_rect.height);
        body_el.style.backgroundColor = color_css(this.body_color);
        body_el.style.overflow = "hidden";

        this.dom_element.append(body_el);

        if (this.isVerticalMode())
        {
            body_el.append(this.draw_vertical_slider(body_rect));
        }
        else if (this.isArcMode())
        {
            body_el.append(this.draw_arc(body_rect));
        }
        else if (this.isTextOnlyMode())
        {
            body_el.append(this.draw_value_indicator(body_rect));
        }

        if (this.isInlineMode())
        {
            body_el.append(this.draw_value_indicator(body_rect));
            this.draw_inline(body_el, body_rect);
            return;
        }

        value_el.style.position = "absolute";
        value_el.style.left = px(value_rect.xpos);
        value_el.style.top = px(value_rect.ypos);
        value_el.style.width = px(value_rect.width);
        value_el.style.height = px(value_rect.height);
        value_el.style.overflow = "hidden";

        body_el.append(value_el);

        if (this.isVerticalMode())
        {
            new Label(
            {
                text: this.getValueDisplayText(),
                align: "center",
                valign: "middle",
                font: "",
                font_size: DIAL_VERTICAL_VALUE_FONT_PX,
                text_color: this.getValueTextColor(),
                bold: true,
                ellipsis: true,
                max_lines: 1
            }).applyToElement(
                value_el,
                this.getValueTextColor(),
                {
                    width: value_rect.width,
                    height: value_rect.height
                }
            );

            return;
        }

        this.value_label.setState(
        {
            text: this.getValueDisplayText(),
            font: "",
            font_size: this.getBodyValueFontPx()
        });

        this.value_label.applyToElement(
            value_el,
            this.getValueTextColor(),
            {
                width: value_rect.width,
                height: value_rect.height
            }
        );
    }

    draw_inline(body_el, body_rect)
    {
        var value_text = this.getInlineValueDisplayText();
        var label_text = this.text.text || "";
        var label_el = document.createElement("div");
        var value_el = document.createElement("div");
        var value_width = this.measure_inline_value_width(body_el, value_text);
        var label_width = Math.max(0, body_rect.width - value_width - DIAL_INLINE_GAP - DIAL_INLINE_LABEL_PADDING_X);
        var value_font_px = this.getInlineValueFontPx();

        label_el.style.position = "absolute";
        label_el.style.left = px(DIAL_INLINE_LABEL_PADDING_X);
        label_el.style.top = "0px";
        label_el.style.width = px(label_width);
        label_el.style.height = px(body_rect.height);
        label_el.style.overflow = "hidden";

        value_el.style.position = "absolute";
        value_el.style.left = px(body_rect.width - value_width);
        value_el.style.top = "0px";
        value_el.style.width = px(value_width);
        value_el.style.height = px(body_rect.height);
        value_el.style.overflow = "hidden";

        body_el.append(label_el);
        body_el.append(value_el);

        new Label(
        {
            text: label_text,
            align: "left",
            valign: "middle",
            font: this.text.font,
            font_size: this.getInlineLabelFontPx(),
            text_color: this.getLabelTextColor(),
            bold: this.text.bold,
            italic: this.text.italic,
            underline: this.text.underline,
            ellipsis: true,
            max_lines: 1
        }).applyToElement(
            label_el,
            this.getLabelTextColor(),
            {
                width: label_width,
                height: body_rect.height
            }
        );

        new Label(
        {
            text: value_text,
            align: "center",
            valign: "middle",
            font: "",
            font_size: value_font_px,
            text_color: this.getValueTextColor(),
            bold: true,
            ellipsis: false,
            max_lines: 1
        }).applyToElement(
            value_el,
            this.getValueTextColor(),
            {
                width: value_width,
                height: body_rect.height
            }
        );
    }

    measure_inline_value_width(body_el, value_text)
    {
        var probe = document.createElement("div");
        var width = 0;
        var value_font_px = this.getInlineValueFontPx();

        probe.style.position = "absolute";
        probe.style.left = "-10000px";
        probe.style.top = "-10000px";
        probe.style.visibility = "hidden";
        probe.style.whiteSpace = "nowrap";
        probe.style.padding = "0";
        probe.style.margin = "0";
        probe.style.border = "0";
        probe.style.boxSizing = "border-box";
        probe.style.fontSize = value_font_px + "px";
        probe.style.fontWeight = "bold";
        probe.style.fontStyle = "normal";
        probe.style.textDecoration = "none";
        probe.style.lineHeight = "1";

        probe.textContent = value_text;
        body_el.append(probe);

        width = Math.ceil(probe.getBoundingClientRect().width) + (DIAL_INLINE_VALUE_PADDING_X * 2);

        probe.remove();

        return Math.max(12, width);
    }

    draw_vertical_slider(body)
    {
        var graph = this.getVerticalGraphRect();
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        var top = this.has_label ? Math.round(DIAL_VERTICAL_BODY_TOP_MARGIN) : Math.round(DIAL_VERTICAL_BODY_TOP_MARGIN + 2);
        var bottom = Math.round(Math.max(top + 10, graph.height - DIAL_VERTICAL_BODY_BOTTOM_MARGIN));
        var line_x = Math.round(graph.width * DIAL_VERTICAL_LINE_X_RATIO);
        var norm = this.getClippedNormValue();
        var y = Math.round(top + ((bottom - top) * (1 - norm)));
        var triangle_left = line_x + 2;
        var triangle_right = triangle_left + DIAL_VERTICAL_TRIANGLE_WIDTH;
        var text_right = line_x - DIAL_VERTICAL_LABEL_GAP - DIAL_VERTICAL_TICK_HALF_WIDTH;
        var scale_color = this.getTextColorForBackground(this.text ? this.text.text_color : "", this.body_color);
        var min_y = bottom;
        var max_y = top;
        var zero_y = 0;
        var zero_norm = 0;

        svg.setAttribute("width", graph.width);
        svg.setAttribute("height", graph.height);
        svg.style.position = "absolute";
        svg.style.left = "0px";
        svg.style.top = "0px";
        svg.style.width = px(graph.width);
        svg.style.height = px(graph.height);

        this.drawVerticalLine(svg, line_x, top, bottom);
        this.drawVerticalActiveLine(svg, line_x, top, bottom, y);
        this.drawRightToLeftTriangle(svg, triangle_left, triangle_right, y);

        this.drawVerticalTick(svg, line_x, max_y + 1, false);
        this.drawVerticalScaleLabel(svg, this.formatScaleValue(this.max), text_right, max_y - 1, scale_color, false);

        this.drawVerticalTick(svg, line_x, min_y - 1, false);
        this.drawVerticalScaleLabel(svg, this.formatScaleValue(this.min), text_right, min_y - 1, scale_color, true);

        if (this.bipolar && this.min < 0 && this.max > 0)
        {
            zero_norm = (0 - this.min) / (this.max - this.min);
            zero_y = Math.round(top + ((bottom - top) * (1 - zero_norm)));
            this.drawVerticalTick(svg, line_x, zero_y, true);
            this.drawVerticalCenteredScaleLabel(svg, "0", text_right, zero_y, scale_color);
        }

        return svg;
    }

    drawVerticalLine(svg, x, y1, y2)
    {
        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");

        line.setAttribute("x1", Math.round(x));
        line.setAttribute("y1", Math.round(y1));
        line.setAttribute("x2", Math.round(x));
        line.setAttribute("y2", Math.round(y2));
        line.setAttribute("stroke", color_css(DIAL_ARC_INACTIVE_COLOR));
        line.setAttribute("stroke-width", DIAL_VERTICAL_LINE_WIDTH);
        line.setAttribute("stroke-linecap", "butt");

        svg.append(line);
    }

    drawVerticalActiveLine(svg, x, top, bottom, y)
    {
        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        var zero_norm = 0;
        var zero_y = bottom;
        var y1 = bottom;
        var y2 = y;

        if (this.bipolar && this.min < 0 && this.max > 0)
        {
            zero_norm = (0 - this.min) / (this.max - this.min);
            zero_y = Math.round(top + ((bottom - top) * (1 - zero_norm)));
            y1 = zero_y;
            y2 = y;
        }

        line.setAttribute("x1", Math.round(x));
        line.setAttribute("y1", Math.round(y1));
        line.setAttribute("x2", Math.round(x));
        line.setAttribute("y2", Math.round(y2));
        line.setAttribute("stroke", color_css(this.arc_color));
        line.setAttribute("stroke-width", DIAL_VERTICAL_LINE_WIDTH);
        line.setAttribute("stroke-linecap", "butt");

        svg.append(line);
    }

    drawVerticalTick(svg, x, y, is_zero)
    {
        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        var stroke_color = this.arc_inactive_color;
        var stroke_width = is_zero ? 2 : 1;

        x = Math.round(x);
        y = Math.round(y);

        line.setAttribute("x1", x - DIAL_VERTICAL_TICK_HALF_WIDTH - 2);
        line.setAttribute("y1", y);
        line.setAttribute("x2", x - 1);
        line.setAttribute("y2", y);
        line.setAttribute("stroke", color_css(stroke_color));
        line.setAttribute("stroke-width", stroke_width);
        line.setAttribute("stroke-linecap", "butt");

        svg.append(line);
    }

    drawRightToLeftTriangle(svg, x1, x2, y)
    {
        var poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        x1 = Math.round(x1);
        x2 = Math.round(x2);
        y = Math.round(y);

        var p1 = x2 + "," + Math.round(y - DIAL_VERTICAL_TRIANGLE_HALF_HEIGHT);
        var p2 = x1 + "," + y;
        var p3 = x2 + "," + Math.round(y + DIAL_VERTICAL_TRIANGLE_HALF_HEIGHT);

        poly.setAttribute("points", p1 + " " + p2 + " " + p3);
        poly.setAttribute("fill", color_css(this.arc_color));

        svg.append(poly);
    }

    drawVerticalScaleLabel(svg, text, right_x, y, color, bottom_align)
    {
        var el = document.createElementNS("http://www.w3.org/2000/svg", "text");

        el.setAttribute("x", Math.round(right_x));
        el.setAttribute("y", Math.round(y));
        el.setAttribute("fill", color_css(color));
        el.setAttribute("font-size", DIAL_VERTICAL_SCALE_FONT_PX);
        el.setAttribute("font-weight", "normal");
        el.setAttribute("text-anchor", "end");

        if (bottom_align)
        {
            el.setAttribute("dominant-baseline", "text-after-edge");
        }
        else
        {
            el.setAttribute("dominant-baseline", "hanging");
        }

        el.textContent = text;
        svg.append(el);
    }

    drawVerticalCenteredScaleLabel(svg, text, right_x, y, color)
    {
        var el = document.createElementNS("http://www.w3.org/2000/svg", "text");

        el.setAttribute("x", Math.round(right_x));
        el.setAttribute("y", Math.round(y));
        el.setAttribute("fill", color_css(color));
        el.setAttribute("font-size", DIAL_VERTICAL_SCALE_FONT_PX);
        el.setAttribute("font-weight", "normal");
        el.setAttribute("text-anchor", "end");
        el.setAttribute("dominant-baseline", "middle");

        el.textContent = text;
        svg.append(el);
    }

    formatScaleValue(value)
    {
        if (Math.round(value) === value)
        {
            return String(value);
        }

        return value.toFixed(2);
    }

    draw_arc(body)
    {
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        var start = DIAL_ARC_START_DEG * Math.PI / 180;
        var end = DIAL_ARC_END_DEG * Math.PI / 180;
        var pos = this.getClippedNormValue();
        var size = Math.min(body.width, body.height);
        var diameter = size * DIAL_ARC_SIZE_FACTOR;
        var r = diameter / 2;
        var cx = body.width / 2;
        var cy = body.height * this.getArcCenterYFactor();
        var current;
        var zero;
        var zero_angle;
        var current_angle;

        svg.setAttribute("width", body.width);
        svg.setAttribute("height", body.height);
        svg.style.position = "absolute";
        svg.style.left = "0px";
        svg.style.top = "0px";
        svg.style.width = px(body.width);
        svg.style.height = px(body.height);

        this.drawArc(svg, cx, cy, r, start, end, this.arc_inactive_color);

        if (this.bipolar && this.min < 0 && this.max > 0)
        {
            zero = (0 - this.min) / (this.max - this.min);
            zero_angle = start + ((end - start) * zero);
            current_angle = start + ((end - start) * pos);

            if (pos > zero)
            {
                this.drawArc(svg, cx, cy, r, zero_angle, current_angle, this.arc_color);
            }
            else if (pos < zero)
            {
                this.drawArc(svg, cx, cy, r, current_angle, zero_angle, this.arc_color);
            }

            this.drawNeedle(svg, cx, cy, r, current_angle);
            return svg;
        }

        current = start + ((end - start) * pos);
        this.drawArc(svg, cx, cy, r, start, current, this.arc_color);
        this.drawNeedle(svg, cx, cy, r, current);

        return svg;
    }

    draw_value_indicator(body)
    {
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        var pos = this.getClippedNormValue();
        var x1;
        var x2;
        var needle_x;
        var zero;

        svg.setAttribute("width", body.width);
        svg.setAttribute("height", body.height);
        svg.style.position = "absolute";
        svg.style.left = "0px";
        svg.style.top = "0px";
        svg.style.width = px(body.width);
        svg.style.height = px(body.height);

        if (this.bipolar && this.min < 0 && this.max > 0)
        {
            zero = (0 - this.min) / (this.max - this.min);
            x1 = body.width * zero;
            x2 = body.width * pos;

            if (x2 < x1)
            {
                this.drawIndicatorFill(svg, x2, 0, x1 - x2, body.height, DIAL_INLINE_SLIDER_FILL_COLOR);
                needle_x = x2;
            }
            else if (x2 > x1)
            {
                this.drawIndicatorFill(svg, x1, 0, x2 - x1, body.height, DIAL_INLINE_SLIDER_FILL_COLOR);
                needle_x = x2;
            }
            else
            {
                needle_x = x1;
            }
        }
        else
        {
            x1 = 0;
            x2 = body.width * pos;

            if (x2 > x1)
            {
                this.drawIndicatorFill(svg, x1, 0, x2 - x1, body.height, DIAL_INLINE_SLIDER_FILL_COLOR);
            }

            needle_x = x2;
        }

        this.drawIndicatorNeedle(svg, needle_x, body.height);

        return svg;
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();

        json.type = this.type;
        json.value = this.value;
        json.value_norm = this.value_norm;
        json.min = this.min;
        json.max = this.max;
        json.pace = this.pace;

        return json;
    }

    drawIndicatorFill(svg, x, y, width, height, color)
    {
        var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");

        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("fill", color_css(color));

        svg.append(rect);
    }

    drawIndicatorNeedle(svg, x, height)
    {
        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");

        line.setAttribute("x1", x);
        line.setAttribute("y1", 0);
        line.setAttribute("x2", x);
        line.setAttribute("y2", height);
        line.setAttribute("stroke", color_css(DIAL_SLIDER_NEEDLE_COLOR));
        line.setAttribute("stroke-width", 2);
        line.setAttribute("stroke-linecap", "butt");

        svg.append(line);
    }

    drawArc(svg, cx, cy, r, a1, a2, color)
    {
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        var x1 = cx + (Math.cos(a1) * r);
        var y1 = cy + (Math.sin(a1) * r);
        var x2 = cx + (Math.cos(a2) * r);
        var y2 = cy + (Math.sin(a2) * r);
        var large = Math.abs(a2 - a1) > Math.PI ? 1 : 0;
        var d = "M " + x1 + " " + y1 + " A " + r + " " + r + " 0 " + large + " 1 " + x2 + " " + y2;

        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", color_css(color));
        path.setAttribute("stroke-width", DIAL_ARC_WIDTH);
        path.setAttribute("stroke-linecap", "butt");

        svg.append(path);
    }

    drawNeedle(svg, cx, cy, r, angle)
    {
        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        var x2 = cx + (Math.cos(angle) * (r + DIAL_NEEDLE_OVERSHOOT));
        var y2 = cy + (Math.sin(angle) * (r + DIAL_NEEDLE_OVERSHOOT));

        line.setAttribute("x1", cx);
        line.setAttribute("y1", cy);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", color_css(this.needle_color));
        line.setAttribute("stroke-width", DIAL_NEEDLE_WIDTH);
        line.setAttribute("stroke-linecap", "round");

        svg.append(line);
    }
}
