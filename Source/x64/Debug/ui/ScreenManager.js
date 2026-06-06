// ScreenManager.js

var current_screen = null;
var ui_state = null;
var template_manager = null;

class ScreenManager
{
    constructor()
    {
        this.current_screen = null;
        this.ui_state = null;
    }

    // ✔ verplaatst uit global scope
    static GetInstance()
    {
        if (!template_manager)
        {
            template_manager = new ScreenManager();
        }

        return template_manager;
    }

    load_template(template_name)
    {
        var screen_node = document.$("#screen");
        var compile_result;
        var draw_result;

        if (!screen_node)
        {
            return {
                ok: false,
                code: "missing-screen-node",
                message: "screen node not found"
            };
        }

        this.current_screen = new Screen(screen_node, template_name || "index.htm");
        this.current_screen.compiler = new ScreenCompiler();

        this.ui_state = this.current_screen.ui_state;

        current_screen = this.current_screen;
        ui_state = this.ui_state;

        log("FILENAME", "'" + String(this.current_screen.filename) + "'");
        log("TITLE", "'" + get_document_title() + "'");

        compile_result = this.current_screen.compiler.compile(this.current_screen);

        if (!compile_result || compile_result.ok !== true)
        {
            this.ui_state = this.current_screen.ui_state;
            current_screen = this.current_screen;
            ui_state = this.ui_state;

            this.debug_dump_ui_state();

            return compile_result || {
                ok: false,
                code: "screen-compile-failed",
                message: "screen compile failed"
            };
        }

        draw_result = this.current_screen.draw();

        this.ui_state = this.current_screen.ui_state;
        current_screen = this.current_screen;
        ui_state = this.ui_state;

        if (draw_result && draw_result.ok === true)
        {
            osc_send("/maschine3/screen", ["loaded", this.current_screen.screen_name, get_document_title()]);
        }

        this.debug_dump_ui_state();

        return draw_result;
    }

    debug_dump_ui_state()
    {
        if (!this.ui_state)
        {
            return;
        }

        //log("UI_STATE", debug_format_ui_state(this.ui_state));
    }
}