// Main.js

document.on("ready", function ()
{
    var template_name = "index.htm";
    var manager;

    try
    {
        //log("MAIN ready");

        manager = ScreenManager.GetInstance();
        manager.load_template(template_name);
    }
    catch (e)
    {
        show_fatal_error(e);
    }
});
