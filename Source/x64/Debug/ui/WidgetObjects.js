// WidgetObjects.js
// Concrete widget classes only.

/*
class ButtonWidget extends PanelWidget
{
    constructor(spec = {})
    {
        super(Object.assign({}, spec, { type: "button" }));

        this.type = "button";
        this.items = new ItemsState(spec);
        this.trigger = spec.trigger || "down";
        this.trigger_value = parse_integer(spec.trigger_value, 127);
        this.clicked = !!spec.clicked;
    }

    setState(properties = {})
    {
        this.items.setState(properties);

        if (properties.trigger !== undefined)
        {
            this.trigger = properties.trigger || "down";
        }

        if (properties.trigger_value !== undefined)
        {
            this.trigger_value = parse_integer(properties.trigger_value, this.trigger_value);
        }

        if (properties.clicked !== undefined)
        {
            this.clicked = !!properties.clicked;
        }

        super.setState(properties);
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();
        var items_json = this.items.getPublicData();
        var key;

        json.type = this.type;
        json.trigger = this.trigger;
        json.trigger_value = this.trigger_value;
        json.clicked = this.clicked;

        for (key in items_json)
        {
            json[key] = items_json[key];
        }

        return json;
    }
}
*/

/*
class ToggleWidget extends ButtonWidget
{
    constructor(spec = {})
    {
        super(spec);
        this.type = "toggle";
    }
}
*/

/*
class RadioButtonWidget extends ToggleWidget
{
    constructor(spec = {})
    {
        super(spec);
        this.type = "radio_button";
        this.group = spec.group || "";
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();

        json.type = this.type;

        if (this.group)
        {
            json.group = this.group;
        }

        return json;
    }
}
*/
/*
class MenuWidget extends ToggleWidget
{
    constructor(spec = {})
    {
        super(spec);
        this.type = "menu";
    }
}

class Menu2Widget extends ToggleWidget
{
    constructor(spec = {})
    {
        super(spec);
        this.type = "menu2";
    }
}
*/

/*
class DialWidget extends PanelWidget
{
    constructor(spec = {})
    {
        super(Object.assign({}, spec, { type: "dial" }));

        this.type = "dial";
        this.value_state = new ValueState(spec);
    }

    setState(properties = {})
    {
        this.value_state.setState(properties);
        super.setState(properties);
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();
        var value_json = this.value_state.getPublicData();
        var key;

        json.type = this.type;

        for (key in value_json)
        {
            json[key] = value_json[key];
        }

        return json;
    }
}
*/

/*
class ScrollWidget extends PanelWidget
{
    constructor(spec = {})
    {
        super(Object.assign({}, spec, { type: "scroll" }));

        this.type = "scroll";
        this.items = new ItemsState(spec);
        this.normalize();
    }

    setState(properties = {})
    {
        this.items.setState(properties);
        super.setState(properties);
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();
        var items_json = this.items.getPublicData();
        var key;

        json.type = this.type;

        for (key in items_json)
        {
            json[key] = items_json[key];
        }

        return json;
    }
}
*/

/*
class UserWidget extends Widget
{
    constructor(spec = {})
    {
        super(Object.assign({}, spec, { type: "user" }));
        this.draw = spec.draw || null;
        this.normalize();
    }

    getPublicWidgetData()
    {
        var json = super.getPublicWidgetData();

        json.type = this.type;

        return json;
    }
}
*/