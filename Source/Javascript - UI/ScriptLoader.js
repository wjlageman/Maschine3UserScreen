document.body.innerHTML = "loader start";

var s = document.createElement("script");
s.src = "probe.js";

s.onload = function ()
{
    document.body.innerHTML += "<br>probe.js onload";

    if (typeof probe_function === "function")
    {
        document.body.innerHTML += "<br>probe_function exists";
        probe_function();
    }
    else
    {
        document.body.innerHTML += "<br>probe_function missing";
    }
};

s.onerror = function ()
{
    document.body.innerHTML += "<br>probe.js onerror";
};

document.head.appendChild(s);

document.body.innerHTML += "<br>script appended";