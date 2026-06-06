// ScrollWidget.js

const SCROLL_DIAL_DELTA_STEP = 90;
const SCROLL_MAX_VISIBLE_ITEMS = 31;
const SCROLL_LINE_EXTRA_PIXELS = 3;
const SCROLL_ITEM_FONT_SIZE = 11;
const SCROLL_SELECTED_FONT_SIZE = 14;

class ScrollWidget extends ButtonWidget
{
    constructor(spec = {})
    {
        super(spec);

        this.type = "scroll";
        this.dial_delta_accu = 0;
        this.touch_active = 0;
        this.touch_start_value = -1;
        this.touch_changed = false;
        if (this.isJoystickScroll(spec))
        {
            this.is_joystick = true;
            this.setJoyDirectionLed("joy-up", 0);
            this.setJoyDirectionLed("joy-left", 0);
            this.setJoyDirectionLed("joy-right", 0);
            this.setJoyDirectionLed("joy-down", 0);
        }

        this._base_text = this.text ? this.text.text : "";
        this._base_text_color = this.text ? this.text.text_color : "";
        this._base_background_color = this.background_color || "";

        if (this.text)
        {
            this.text.bold = false;
        }

        if (!this._items || Object.prototype.toString.call(this._items) !== "[object Array]")
        {
            this._items = [];
        }

        this.value = spec.value !== undefined ? parse_integer(spec.value, -1) : this.value;

        if (spec.items === undefined || spec.items === null)
        {
            this.items = ["One", "Two", "Three"];
        }
        else
        {
            this.items = spec.items;
        }

        this.normalizeValue();
    }

    isJoystickScroll(spec)
    {
        var id = spec && spec.id !== undefined ? String(spec.id) : "";
        var path = spec && spec.path !== undefined ? String(spec.path) : "";

        if (id.indexOf("-joy") >= 0)
        {
            return true;
        }

        return path.indexOf("joy-step") >= 0;
    }

    get items()
    {
        return this._items;
    }

    set items(value)
    {
        this._items = this.parseMenuItems(value);
        this.normalizeValue();
        this.applyCurrentStateAppearance();

        if (this.dom_element)
        {
            this.draw();
        }
    }

    parseMenuItems(value)
    {
        var list = [];
        var text = "";
        var i = 0;

        if (value === undefined || value === null)
        {
            return [];
        }

        if (Object.prototype.toString.call(value) === "[object Array]")
        {
            list = value.slice(0);
        }
        else
        {
            text = String(value);

            if (text === "")
            {
                return [];
            }

            if (text.indexOf("|") >= 0)
            {
                list = text.split("|");
            }
            else
            {
                list = text.split(" ");
            }
        }

        for (i = 0; i < list.length; i++)
        {
            if (list[i] === undefined || list[i] === null)
            {
                list[i] = "";
            }
            else
            {
                list[i] = String(list[i]).trim();
            }
        }

        return list;
    }

    getMaxValue()
    {
        if (!this._items || this._items.length <= 0)
        {
            return -1;
        }

        return this._items.length - 1;
    }

    normalizeValue()
    {
        this.value = parse_integer(this.value, -1);

        if (!this._items || this._items.length <= 0)
        {
            this.value = -1;
            return;
        }

        if (this.value < -1)
        {
            this.value = -1;
            return;
        }

        if (this.value > this.getMaxValue())
        {
            this.value = this.getMaxValue();
        }
    }

    getCurrentText()
    {
        if (this.value === -1)
        {
            return "";
        }

        if (!this._items || this.value < 0 || this.value >= this._items.length)
        {
            return "";
        }

        return this._items[this.value];
    }

    getCurrentString()
    {
        return this.getCurrentText();
    }

    sendScrollEvent(event_name)
    {
        osc_send(this.path, [event_name, this.value, this.getCurrentString()]);

        return {
            ok: true,
            code: "ok",
            message: event_name + " sent"
        };
    }

    applyCurrentStateAppearance()
    {
        if (this.text)
        {
            this.text.text = this.getCurrentText();
            this.text.text_color = this._base_text_color;
        }

        this.background_color = this._base_background_color;
        this.syncLedState();
    }

    stepForwardFrom(value)
    {
        var last_index = this.getMaxValue();

        value = parse_integer(value, -1);

        if (last_index < 0)
        {
            return -1;
        }

        if (value < 0)
        {
            return 0;
        }

        if (value >= last_index)
        {
            return last_index;
        }

        return value + 1;
    }

    stepBackwardFrom(value)
    {
        var last_index = this.getMaxValue();

        value = parse_integer(value, -1);

        if (last_index < 0)
        {
            return -1;
        }

        if (value < 0)
        {
            return last_index;
        }

        if (value <= 0)
        {
            return 0;
        }

        return value - 1;
    }

    stepForward()
    {
        var last_index = this.getMaxValue();

        if (last_index < 0)
        {
            return -1;
        }

        if (this.value < 0)
        {
            return 0;
        }

        if (this.value >= last_index)
        {
            return last_index;
        }

        return this.value + 1;
    }

    stepBackward()
    {
        var last_index = this.getMaxValue();

        if (last_index < 0)
        {
            return -1;
        }

        if (this.value < 0)
        {
            return last_index;
        }

        if (this.value <= 0)
        {
            return 0;
        }

        return this.value - 1;
    }

    setValueInternal(next_value)
    {
        this.value = parse_integer(next_value, -1);
        this.normalizeValue();
        this.applyCurrentStateAppearance();
    }

    applyValueChange(silent, next_value, source_name)
    {
        next_value = parse_integer(next_value, -1);

        if (next_value < -1)
        {
            next_value = -1;
        }

        if (this._items.length <= 0)
        {
            next_value = -1;
        }
        else if (next_value > this.getMaxValue())
        {
            next_value = this.getMaxValue();
        }

        if (this.value === next_value)
        {
            if (silent)
            {
                return {
                    ok: true,
                    code: "ok",
                    message: "silent value unchanged"
                };
            }

            return {
                ok: true,
                code: "ok",
                message: "value unchanged"
            };
        }

        this.setValueInternal(next_value);

        if (this.touch_active)
        {
            this.touch_changed = true;
        }

        if (this.dom_element)
        {
            this.draw();
        }

        if (silent)
        {
            return {
                ok: true,
                code: "ok",
                message: "silent value applied"
            };
        }

        return this.sendScrollEvent("hover");
    }

    sendValueOsc()
    {
        return this.sendScrollEvent("value");
    }

    on_value(silent, atoms)
    {
        var raw_value = atoms && atoms.length > 0 ? atoms[0] : -1;
        var new_value = parse_integer(raw_value, -1);
        var result = this.applyValueChange(silent, new_value, "value");

        if (silent)
        {
            return result;
        }

        return this.sendValueOsc();
    }

    applyScrollStep(direction, source_name)
    {
        var next_value;

        direction = parse_integer(direction, 0);

        if (direction === 0)
        {
            return {
                ok: true,
                code: "ok",
                message: "zero step ignored"
            };
        }

        if (direction > 0)
        {
            next_value = this.stepForward();
        }
        else
        {
            next_value = this.stepBackward();
        }

        if (next_value === this.value)
        {
            this.dial_delta_accu = 0;

            return {
                ok: true,
                code: "ok",
                message: "scroll boundary reached"
            };
        }

        return this.applyValueChange(false, next_value, source_name);
    }

    applyScrollSteps(steps, source_name)
    {
        var i = 0;
        var result = {
            ok: true,
            code: "ok",
            message: "no scroll steps"
        };

        steps = parse_integer(steps, 0);

        if (steps > 0)
        {
            for (i = 0; i < steps; i++)
            {
                result = this.applyScrollStep(1, source_name);

                if (!result || result.code === "scroll boundary reached")
                {
                    return result;
                }
            }
        }
        else
        {
            for (i = 0; i < -steps; i++)
            {
                result = this.applyScrollStep(-1, source_name);

                if (!result || result.code === "scroll boundary reached")
                {
                    return result;
                }
            }
        }

        return result;
    }

    on_dial(value)
    {
        var delta = parse_integer(value, 0);
        var steps = 0;
        var result;

        if (delta === 0)
        {
            return {
                ok: true,
                code: "ok",
                message: "zero delta ignored"
            };
        }

        if (this.is_joystick)
        {
            return this.applyScrollSteps(delta, "joy-step");
        }

        this.dial_delta_accu += delta;

        if (Math.abs(this.dial_delta_accu) < SCROLL_DIAL_DELTA_STEP)
        {
            return {
                ok: true,
                code: "ok",
                message: "dial delta accumulated"
            };
        }

        while (this.dial_delta_accu >= SCROLL_DIAL_DELTA_STEP)
        {
            this.dial_delta_accu -= SCROLL_DIAL_DELTA_STEP;
            result = this.applyScrollStep(1, "dial");

            if (!result || result.code === "scroll boundary reached")
            {
                return result;
            }
        }

        while (this.dial_delta_accu <= -SCROLL_DIAL_DELTA_STEP)
        {
            this.dial_delta_accu += SCROLL_DIAL_DELTA_STEP;
            result = this.applyScrollStep(-1, "dial");

            if (!result || result.code === "scroll boundary reached")
            {
                return result;
            }
        }

        return {
            ok: true,
            code: "ok",
            message: "dial delta applied"
        };
    }

    on_delta(value)
    {
        return this.on_dial(value);
    }

    on_cc(value)
    {
        return this.on_dial(value);
    }

    on_bang(silent, atoms)
    {
        return this.applyValueChange(silent, this.stepForward(), "bang");
    }

    on_touch(value)
    {
        value = parse_integer(value, 0);

        if (value !== 0)
        {
            this.touch_active = 1;
            this.touch_start_value = this.value;
            this.touch_changed = false;

            if (this.dom_element)
            {
                this.draw();
            }

            return {
                ok: true,
                code: "ok",
                message: "scroll touch on"
            };
        }

        if (this.touch_active)
        {
            this.touch_active = 0;
            this.touch_changed = false;

            if (this.dom_element)
            {
                this.draw();
            }

            return this.sendScrollEvent("commit");
        }

        this.touch_changed = false;

        return {
            ok: true,
            code: "ok",
            message: "scroll touch off"
        };
    }

    on_enter(value)
    {
        value = parse_integer(value, 1);

        if (value === 0)
        {
            return {
                ok: true,
                code: "ok",
                message: "scroll enter release"
            };
        }

        return this.sendScrollEvent("enter");
    }

    setJoyDirectionLed(name, value)
    {
        var led_value = parse_integer(value, 0) !== 0 ? 0x0e : 0x0c;

        return this.call_native("controls_set_led_value", name, led_value);
    }

    on_joy_up(value)
    {
        value = parse_integer(value, 0);
        this.setJoyDirectionLed("joy-up", value);

        if (value === 0)
        {
            return {
                ok: true,
                code: "ok",
                message: "joy-up release"
            };
        }

        return this.applyValueChange(false, 0, "joy-up");
    }

    on_joy_down(value)
    {
        value = parse_integer(value, 0);
        this.setJoyDirectionLed("joy-down", value);

        if (value === 0)
        {
            return {
                ok: true,
                code: "ok",
                message: "joy-down release"
            };
        }

        return this.applyValueChange(false, this.getMaxValue(), "joy-down");
    }

    on_joy_left(value)
    {
        value = parse_integer(value, 0);
        this.setJoyDirectionLed("joy-left", value);

        return {
            ok: true,
            code: "ok",
            message: "joy-left led"
        };
    }

    on_joy_right(value)
    {
        value = parse_integer(value, 0);
        this.setJoyDirectionLed("joy-right", value);

        return {
            ok: true,
            code: "ok",
            message: "joy-right led"
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

    getScrollFontSize(selected)
    {
        return selected ? SCROLL_SELECTED_FONT_SIZE : SCROLL_ITEM_FONT_SIZE;
    }

    getNormalScrollLineHeight()
    {
        return Math.max(1, Math.ceil(SCROLL_ITEM_FONT_SIZE + SCROLL_LINE_EXTRA_PIXELS));
    }

    getSelectedScrollLineHeight()
    {
        return Math.max(1, Math.ceil(SCROLL_SELECTED_FONT_SIZE + (SCROLL_LINE_EXTRA_PIXELS * 2)));
    }

    getVisibleItemCount()
    {
        var normal_line_height = this.getNormalScrollLineHeight();
        var selected_line_height = this.getSelectedScrollLineHeight();
        var count = 1;

        if (this.inner_height > selected_line_height)
        {
            count = Math.floor((this.inner_height - selected_line_height) / normal_line_height) + 1;
        }

        if (count < 1)
        {
            count = 1;
        }

        if (count > SCROLL_MAX_VISIBLE_ITEMS)
        {
            count = SCROLL_MAX_VISIBLE_ITEMS;
        }

        if ((count % 2) === 0)
        {
            count -= 1;
        }

        if (count < 1)
        {
            count = 1;
        }

        while (count > 1 && this.getScrollListHeight(count) > this.inner_height)
        {
            count -= 2;
        }

        return count;
    }

    getScrollListHeight(visible_count)
    {
        visible_count = parse_integer(visible_count, 1);

        if (visible_count < 1)
        {
            visible_count = 1;
        }

        return this.getSelectedScrollLineHeight() + ((visible_count - 1) * this.getNormalScrollLineHeight());
    }


    getScrollFontFamily()
    {
        if (this.text && this.text.font && this.text.font !== "")
        {
            return this.text.font;
        }

        return "Arial";
    }

    applyScrollFontStyle(el, selected)
    {
        var weight = selected ? "700" : "400";
        var font_size = this.getScrollFontSize(selected);
        var font_family = this.getScrollFontFamily();

        el.style.font = weight + " " + px(font_size) + " " + font_family;
        el.style.fontSize = px(font_size);
        el.style.fontWeight = weight;

        if (el.style.setProperty)
        {
            el.style.setProperty("font", weight + " " + px(font_size) + " " + font_family, "important");
            el.style.setProperty("font-size", px(font_size), "important");
            el.style.setProperty("font-weight", weight, "important");
        }
    }

    drawScrollLine(parent_el, row_top, item_index, line_height, selected)
    {
        var row_el = document.createElement("div");
        var label_el = document.createElement("div");
        var text_color = this._base_text_color || (this.text ? this.text.text_color : "*");
        var background_color = selected ? "white" : this.background_color;
        var text = "";
        var align = this.text ? this.text.align : "center";
        var color = text_color === "*" || text_color === "auto" ? auto_text_color(background_color) : text_color;

        row_el.style.position = "absolute";
        row_el.style.left = px(this.inner_x);
        row_el.style.top = px(row_top);
        row_el.style.width = px(this.inner_width);
        row_el.style.height = px(line_height);
        row_el.style.overflow = "hidden";
        row_el.style.boxSizing = "border-box";
        this.applyScrollFontStyle(row_el, selected);

        if (selected)
        {
            row_el.style.backgroundColor = "rgba(255,255,255,0.22)";
        }

        parent_el.append(row_el);

        if (item_index < 0 || item_index >= this._items.length)
        {
            return;
        }

        text = this._items[item_index];

        label_el.style.position = "absolute";
        label_el.style.left = px(2);
        label_el.style.top = px(0);
        label_el.style.width = px(Math.max(0, this.inner_width - 4));
        label_el.style.height = px(line_height);
        label_el.style.overflow = "hidden";
        label_el.style.boxSizing = "border-box";
        label_el.style.whiteSpace = "nowrap";
        label_el.style.textOverflow = "ellipsis";
        label_el.style.lineHeight = px(line_height);
        label_el.style.textAlign = align;
        this.applyScrollFontStyle(label_el, selected);
        label_el.style.fontStyle = this.text && this.text.italic ? "italic" : "normal";
        label_el.style.textDecoration = this.text && this.text.underline ? "underline" : "none";
        label_el.style.color = color_css(color);


        label_el.textContent = text;
        row_el.append(label_el);
    }

    getVisibleRenderCount()
    {
        var visible_count = this.getVisibleItemCount();

        if (!this._items || this._items.length <= 0)
        {
            return 0;
        }

        if (visible_count > this._items.length)
        {
            visible_count = this._items.length;
        }

        if (visible_count < 1)
        {
            visible_count = 1;
        }

        return visible_count;
    }

    getScrollStartIndex(visible_count)
    {
        var selected_row = Math.floor(visible_count / 2);
        var max_start = 0;
        var start_index = 0;

        if (!this._items || this._items.length <= 0 || this.value < 0)
        {
            return 0;
        }

        max_start = Math.max(0, this._items.length - visible_count);
        start_index = this.value - selected_row;

        if (start_index < 0)
        {
            start_index = 0;
        }

        if (start_index > max_start)
        {
            start_index = max_start;
        }

        return start_index;
    }

    getClampedScrollListHeight(start_index, visible_count)
    {
        var row = 0;
        var item_index = 0;
        var selected_line_height = this.getSelectedScrollLineHeight();
        var normal_line_height = this.getNormalScrollLineHeight();
        var list_height = 0;

        for (row = 0; row < visible_count; row++)
        {
            item_index = start_index + row;
            list_height += item_index === this.value ? selected_line_height : normal_line_height;
        }

        return list_height;
    }

    drawScrollItems()
    {
        var visible_count = this.getVisibleRenderCount();
        var start_index = this.getScrollStartIndex(visible_count);
        var normal_line_height = this.getNormalScrollLineHeight();
        var selected_line_height = this.getSelectedScrollLineHeight();
        var list_height = this.getClampedScrollListHeight(start_index, visible_count);
        var row_top = this.inner_y + Math.floor((this.inner_height - list_height) / 2);
        var row = 0;
        var item_index = 0;
        var selected = false;
        var line_height = 0;

        for (row = 0; row < visible_count; row++)
        {
            item_index = start_index + row;
            selected = item_index === this.value;
            line_height = selected ? selected_line_height : normal_line_height;
            this.drawScrollLine(this.dom_element, row_top, item_index, line_height, selected);
            row_top += line_height;
        }
    }

    draw()
    {
        this.applyCurrentStateAppearance();
        Widget.prototype.draw.call(this);
        this.dom_element.style.fontWeight = "400";
        this.dom_element.style.fontStyle = "normal";

        if (this.dom_element.style.setProperty)
        {
            this.dom_element.style.setProperty("font-weight", "400", "important");
        }
        this.removeOverlay();
        this.drawScrollItems();
        this.draw_touch_overlay();
        this.requestDisplayUpdate();
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();

        json.type = this.type;
        json.value = this.value;
        json.items = this.items.slice(0);

        if (this.is_joystick)
        {
            json.is_joystick = true;
        }

        return json;
    }
}
