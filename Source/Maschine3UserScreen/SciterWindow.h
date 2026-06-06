#pragma once

#include <string>
#include <vector>
#include <windows.h>

#include <Sciter/sciter-x.h>
#include <Sciter/sciter-x-window.hpp>

#include "Udp_osc_transport.h"
#include "Maschine3ControlsRouter.h"

class Maschine3UserScreen;

class SciterWindow : public sciter::window
{
public:
    SciterWindow(const RECT& rc);

    void set_display(Maschine3UserScreen* display);
    void install_draw_update_callback();
    void reset_draw_update_state();
    void request_full_display_redraw();
    bool pump_draw_update();

    BEGIN_FUNCTION_MAP
        FUNCTION_1("log", js_log)
        FUNCTION_2("osc_send", js_osc_send)
        FUNCTION_0("controls_reset_leds_to_default", js_controls_reset_leds_to_default)
        FUNCTION_2("controls_set_led_value", js_controls_set_led_value)
        FUNCTION_3("controls_set_led_color", js_controls_set_led_color)
        FUNCTION_2("controls_set_led_color_index", js_controls_set_led_color_index)
        FUNCTION_0("controls_debug_select_color_scan", js_controls_debug_select_color_scan)
        FUNCTION_2("request_display_update", js_request_display_update)
        FUNCTION_1("get_delta_accu", js_get_delta_accu)
        FUNCTION_1("reset_delta_accu", js_reset_delta_accu)
    END_FUNCTION_MAP

    sciter::value js_request_display_update(const sciter::value& x_pos_value, const sciter::value& width_value);
    sciter::value js_get_delta_accu(const sciter::value& dial_index_value);
    sciter::value js_reset_delta_accu(const sciter::value& dial_index_value);
    sciter::value js_controls_reset_leds_to_default();
    sciter::value js_controls_set_led_value(const sciter::value& name_value, const sciter::value& value_value);
    sciter::value js_controls_set_led_color(const sciter::value& name_value, const sciter::value& value_value, const sciter::value& color_value);
    sciter::value js_controls_set_led_color_index(const sciter::value& name_value, const sciter::value& color_value);
    sciter::value js_controls_debug_select_color_scan();
    bool call_script_function_2(const char* function_name, const sciter::value& arg0, const sciter::value& arg1, sciter::value& result);
    bool dispatch_control_to_js(const MaschineControlEvent& event);
    sciter::value js_osc_send(const sciter::value& address_value, const sciter::value& atoms_json_value);
    bool dispatch_osc_to_js(const UdpOscMessage& message);
    sciter::value js_log(const sciter::value& text);

    static std::string value_to_utf8(const sciter::value& value);

private:
    Maschine3UserScreen* display_;

    static void request_draw_update();
    static LRESULT CALLBACK draw_window_proc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam);

    static void skip_json_ws(const std::string& text, size_t& pos);
    static bool parse_json_literal(const std::string& text, size_t& pos, const char* literal);
    static bool parse_json_string_token(const std::string& text, size_t& pos, std::string& out_value);
    static bool parse_json_number_token(const std::string& text, size_t& pos, UdpOscAtom& out_atom);
    static bool parse_atoms_json(const std::string& json, std::vector<UdpOscAtom>& out_atoms);
};
