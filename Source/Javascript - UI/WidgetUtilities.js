// WidgetUtilities.js

function join_path(path, id)
{
    return path + "/" + id;
}

function parse_integer(v, d)
{
    var n = parseInt(v, 10);

    if (isNaN(n))
    {
        return d;
    }

    return n;
}

function parse_number(v, d)
{
    var n = parseFloat(v);

    if (isNaN(n))
    {
        return d;
    }

    return n;
}

function request_display_update(xPos, width)
{
    var x = parse_integer(xPos, 0);
    var w = parse_integer(width, 0);

    try
    {
        return Window.this.xcall("request_display_update", x, w);
    }
    catch (e)
    {
        return false;
    }
}
