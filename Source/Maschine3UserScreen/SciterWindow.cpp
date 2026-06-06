#include "SciterWindow.h"
#include "SciterSession.h"

#include <windows.h>
#include <cstring>
#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "Maschine3UserScreen.h"
#include "MaschineUsbControls.h"
#include "Udp_osc_transport.h"

#if SCITER_SESSION_DEBUG
#define SCITER_DEBUG_BLOCK(code) do { code } while (0)
#else
#define SCITER_DEBUG_BLOCK(code) do { } while (0)
#endif

static WNDPROC g_original_sciter_window_proc = nullptr;
static volatile LONG g_sciter_draw_update_requested = 0;
static int g_sciter_draw_update_counter = 0;

void log_line(const std::string& text);
std::string bool_text(bool v);

SciterWindow::SciterWindow(const RECT& rc)
    : sciter::window(SW_MAIN | SW_ENABLE_DEBUG, rc)
    , display_(nullptr)
{
    log_line("SciterWindow constructed");
}


void SciterWindow::set_display(Maschine3UserScreen* display)
{
    display_ = display;
}

void SciterWindow::request_draw_update()
{
    InterlockedExchange(&g_sciter_draw_update_requested, 1);
}

LRESULT CALLBACK SciterWindow::draw_window_proc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam)
{
    if (message == WM_PAINT)
    {
        LRESULT result = CallWindowProcW(g_original_sciter_window_proc, hwnd, message, wparam, lparam);

        ++g_sciter_draw_update_counter;

        SCITER_DEBUG_BLOCK(
            {
                if (g_sciter_draw_update_counter <= 5 || (g_sciter_draw_update_counter % 50) == 0)
                {
                    std::ostringstream ss;
                    ss << "[SCITER ON_DRAW] update request #" << g_sciter_draw_update_counter;
                    printf("%s\n", ss.str().c_str());
                    fflush(stdout);
                    log_line(ss.str());
                }
            });

        request_draw_update();
        return result;
    }

    return CallWindowProcW(g_original_sciter_window_proc, hwnd, message, wparam, lparam);
}

void SciterWindow::install_draw_update_callback()
{
    HWND hwnd = static_cast<HWND>(get_hwnd());

    if (hwnd == nullptr)
    {
        log_line("SciterWindow::install_draw_update_callback(): hwnd null");
        return;
    }

    if (g_original_sciter_window_proc != nullptr)
    {
        log_line("SciterWindow::install_draw_update_callback(): already installed");
        return;
    }

    LONG_PTR old_proc = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(draw_window_proc));

    if (old_proc == 0)
    {
        DWORD error = GetLastError();
        std::ostringstream ss;
        ss << "SciterWindow::install_draw_update_callback(): SetWindowLongPtr failed error=" << error;
        printf("%s\n", ss.str().c_str());
        fflush(stdout);
        log_line(ss.str());
        return;
    }

    g_original_sciter_window_proc = reinterpret_cast<WNDPROC>(old_proc);
    log_line("SciterWindow::install_draw_update_callback(): installed");
}

void SciterWindow::reset_draw_update_state()
{
    InterlockedExchange(&g_sciter_draw_update_requested, 0);
}

void SciterWindow::request_full_display_redraw()
{
    if (display_ != nullptr)
    {
        display_->request_display_update(0, SCITER_WIDTH);
    }

    request_draw_update();
}

bool SciterWindow::pump_draw_update()
{
    if (!InterlockedCompareExchange(&g_sciter_draw_update_requested, 0, 0))
    {
        return true;
    }

    if (display_ == nullptr)
    {
        InterlockedExchange(&g_sciter_draw_update_requested, 0);
        return true;
    }

    InterlockedExchange(&g_sciter_draw_update_requested, 0);

    bool ok = display_->pump_dirty_side_after_draw(this);

    if (display_->has_dirty_side())
    {
        InterlockedExchange(&g_sciter_draw_update_requested, 1);
    }

    return ok;
}


sciter::value SciterWindow::js_request_display_update(const sciter::value& x_pos_value, const sciter::value& width_value)
{
    int x_pos = x_pos_value.get(0);
    int width = width_value.get(0);

    if (display_ != nullptr)
    {
        display_->request_display_update(x_pos, width);
    }

    return sciter::value(display_ != nullptr);
}

sciter::value SciterWindow::js_get_delta_accu(const sciter::value& dial_index_value)
{
    int dial_index = dial_index_value.get(0);

    return sciter::value(get_delta_accu(dial_index));
}

sciter::value SciterWindow::js_reset_delta_accu(const sciter::value& dial_index_value)
{
    int dial_index = dial_index_value.get(0);

    reset_delta_accu(dial_index);

    return sciter::value(true);
}

sciter::value SciterWindow::js_controls_reset_leds_to_default()
{
    bool ok = controls_reset_leds_to_default() != 0;

    {
        std::ostringstream ss;
        SCITER_DEBUG_BLOCK(
            {
                ss << "[DEBUG] controls_reset_leds_to_default() ok=" << bool_text(ok);
                printf("%s\n", ss.str().c_str());
                log_line(ss.str());
            });
    }

    return sciter::value(ok);
}

sciter::value SciterWindow::js_controls_set_led_value(const sciter::value& name_value, const sciter::value& value_value)
{
    std::string name = value_to_utf8(name_value);
    int value = value_value.get(0);

    bool ok = controls_set_led_value(name.c_str(), value) != 0;

    {
        std::ostringstream ss;
        ss << "js_controls_set_led_value() name=" << name
            << " value=" << value
            << " ok=" << bool_text(ok);
        log_line(ss.str());
    }

    return sciter::value(ok);
}

sciter::value SciterWindow::js_controls_set_led_color(const sciter::value& name_value, const sciter::value& value_value, const sciter::value& color_value)
{
    std::string name = value_to_utf8(name_value);
    std::string color = value_to_utf8(color_value);
    int value = value_value.get(0);

    bool ok = controls_set_led_color(name.c_str(), value, color.c_str()) != 0;

    {
        std::ostringstream ss;
        ss << "js_controls_set_led_color() name=" << name
            << " value=" << value
            << " color=" << color
            << " ok=" << bool_text(ok);
        log_line(ss.str());
    }

    return sciter::value(ok);
}

sciter::value SciterWindow::js_controls_set_led_color_index(const sciter::value& name_value, const sciter::value& color_value)
{
    std::string name = value_to_utf8(name_value);
    int color = color_value.get(0);

    bool ok = controls_set_led_color_index(name.c_str(), color) != 0;

    {
        std::ostringstream ss;
        ss << "js_controls_set_led_color_index() name=" << name
            << " color=" << color
            << " ok=" << bool_text(ok);
        log_line(ss.str());
    }

    return sciter::value(ok);
}


sciter::value SciterWindow::js_controls_debug_select_color_scan()
{
    controls_debug_select_color_scan();
    log_line("js_controls_debug_select_color_scan()");
    return sciter::value(true);
}

bool SciterWindow::call_script_function_2(const char* function_name, const sciter::value& arg0, const sciter::value& arg1, sciter::value& result)
{
    HWND hwnd = static_cast<HWND>(get_hwnd());

    SCITER_VALUE args[2];
    SCITER_VALUE rv;

    args[0] = arg0;
    args[1] = arg1;

    memset(&rv, 0, sizeof(rv));

    SBOOL ok = SciterCall(hwnd, function_name, 2, args, &rv);
    result = rv;

    if (!ok)
    {
        std::ostringstream ss;
        ss << "[WARNING] SciterCall failed: " << function_name;
        log_line(ss.str());
        return false;
    }

    if (result.is_error_string())
    {
        std::ostringstream ss;
        ss << "[WARNING] Sciter script error in " << function_name
            << ": " << value_to_utf8(result);
        log_line(ss.str());
        return false;
    }

    return true;
}

bool SciterWindow::dispatch_control_to_js(const MaschineControlEvent& event)
{
    sciter::value result;

    if (!call_script_function_2(
        "controls_receive",
        sciter::value(event.name.c_str()),
        sciter::value(event.value),
        result))
    {
        std::ostringstream ss;
        ss << "[WARNING] control event not forwarded: " << event.name
            << " = " << event.value;
        log_line(ss.str());
        return false;
    }

    {
        std::ostringstream ss;
        ss << "dispatch_control_to_js() name=" << event.name
            << " value=" << event.value
            << " result=" << value_to_utf8(result);
        log_line(ss.str());
    }

    return true;
}

sciter::value SciterWindow::js_osc_send(const sciter::value& address_value, const sciter::value& atoms_json_value)
{
    std::string address = value_to_utf8(address_value);
    std::string atoms_json = value_to_utf8(atoms_json_value);
    std::vector<UdpOscAtom> atoms;

    {
        std::ostringstream ss;
        ss << "js_osc_send() address=" << address << " atoms_json=" << atoms_json;
        log_line(ss.str());
    }

    if (address.empty())
    {
        log_line("js_osc_send(): empty address");
        return sciter::value(false);
    }

    if (!parse_atoms_json(atoms_json, atoms))
    {
        log_line("js_osc_send(): parse_atoms_json failed");
        return sciter::value(false);
    }

    return sciter::value(udp_osc_send_message(address.c_str(), atoms));
}



std::string SciterWindow::value_to_utf8(const sciter::value& value)
{
    std::string out;
    sciter::string ws = value.to_string();
    const wchar_t* p = ws.c_str();

    if (p != nullptr)
    {
        int needed = WideCharToMultiByte(CP_UTF8, 0, p, -1, nullptr, 0, nullptr, nullptr);

        if (needed > 1)
        {
            out.resize(static_cast<size_t>(needed - 1));

            WideCharToMultiByte(
                CP_UTF8,
                0,
                p,
                -1,
                &out[0],
                needed - 1,
                nullptr,
                nullptr
            );
        }
    }

    return out;
}

void SciterWindow::skip_json_ws(const std::string& text, size_t& pos)
{
    while (pos < text.size())
    {
        char ch = text[pos];

        if (ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n')
        {
            ++pos;
        }
        else
        {
            break;
        }
    }
}

bool SciterWindow::parse_json_literal(const std::string& text, size_t& pos, const char* literal)
{
    size_t i = 0;

    while (literal[i] != 0)
    {
        if ((pos + i) >= text.size() || text[pos + i] != literal[i])
        {
            return false;
        }

        ++i;
    }

    pos += i;
    return true;
}

bool SciterWindow::parse_json_string_token(const std::string& text, size_t& pos, std::string& out_value)
{
    out_value.clear();

    if (pos >= text.size() || text[pos] != '"')
    {
        return false;
    }

    ++pos;

    while (pos < text.size())
    {
        char ch = text[pos++];

        if (ch == '"')
        {
            return true;
        }

        if (ch == '\\')
        {
            if (pos >= text.size())
            {
                return false;
            }

            char esc = text[pos++];

            if (esc == '"' || esc == '\\' || esc == '/')
            {
                out_value += esc;
            }
            else if (esc == 'b')
            {
                out_value += '\b';
            }
            else if (esc == 'f')
            {
                out_value += '\f';
            }
            else if (esc == 'n')
            {
                out_value += '\n';
            }
            else if (esc == 'r')
            {
                out_value += '\r';
            }
            else if (esc == 't')
            {
                out_value += '\t';
            }
            else if (esc == 'u')
            {
                if ((pos + 4) > text.size())
                {
                    return false;
                }

                unsigned int code = 0;
                size_t j;

                for (j = 0; j < 4; ++j)
                {
                    char hex = text[pos + j];
                    code <<= 4;

                    if (hex >= '0' && hex <= '9')
                    {
                        code |= static_cast<unsigned int>(hex - '0');
                    }
                    else if (hex >= 'a' && hex <= 'f')
                    {
                        code |= static_cast<unsigned int>(hex - 'a' + 10);
                    }
                    else if (hex >= 'A' && hex <= 'F')
                    {
                        code |= static_cast<unsigned int>(hex - 'A' + 10);
                    }
                    else
                    {
                        return false;
                    }
                }

                pos += 4;

                if (code <= 0x7F)
                {
                    out_value += static_cast<char>(code);
                }
                else if (code <= 0x7FF)
                {
                    out_value += static_cast<char>(0xC0 | ((code >> 6) & 0x1F));
                    out_value += static_cast<char>(0x80 | (code & 0x3F));
                }
                else
                {
                    out_value += static_cast<char>(0xE0 | ((code >> 12) & 0x0F));
                    out_value += static_cast<char>(0x80 | ((code >> 6) & 0x3F));
                    out_value += static_cast<char>(0x80 | (code & 0x3F));
                }
            }
            else
            {
                return false;
            }
        }
        else
        {
            out_value += ch;
        }
    }

    return false;
}

bool SciterWindow::parse_json_number_token(const std::string& text, size_t& pos, UdpOscAtom& out_atom)
{
    size_t start = pos;
    bool saw_dot = false;
    bool saw_exp = false;

    if (pos < text.size() && (text[pos] == '-' || text[pos] == '+'))
    {
        ++pos;
    }

    while (pos < text.size())
    {
        char ch = text[pos];

        if (ch >= '0' && ch <= '9')
        {
            ++pos;
        }
        else if (ch == '.')
        {
            saw_dot = true;
            ++pos;
        }
        else if (ch == 'e' || ch == 'E')
        {
            saw_exp = true;
            ++pos;

            if (pos < text.size() && (text[pos] == '-' || text[pos] == '+'))
            {
                ++pos;
            }
        }
        else
        {
            break;
        }
    }

    if (pos <= start)
    {
        return false;
    }

    std::string token = text.substr(start, pos - start);

    if (saw_dot || saw_exp)
    {
        out_atom.type = UDP_OSC_ATOM_FLOAT32;
        out_atom.float_value = static_cast<float>(std::strtod(token.c_str(), nullptr));
    }
    else
    {
        out_atom.type = UDP_OSC_ATOM_INT32;
        out_atom.int_value = static_cast<int32_t>(std::strtol(token.c_str(), nullptr, 10));
    }

    return true;
}

bool SciterWindow::parse_atoms_json(const std::string& json, std::vector<UdpOscAtom>& out_atoms)
{
    size_t pos = 0;

    out_atoms.clear();
    skip_json_ws(json, pos);

    if (pos >= json.size() || json[pos] != '[')
    {
        return false;
    }

    ++pos;
    skip_json_ws(json, pos);

    if (pos < json.size() && json[pos] == ']')
    {
        ++pos;
        skip_json_ws(json, pos);
        return pos == json.size();
    }

    while (pos < json.size())
    {
        UdpOscAtom atom;
        std::string string_value;

        skip_json_ws(json, pos);

        if (pos >= json.size())
        {
            return false;
        }

        if (json[pos] == '"')
        {
            if (!parse_json_string_token(json, pos, string_value))
            {
                return false;
            }

            if (string_value == "impulse")
            {
                atom.type = UDP_OSC_ATOM_IMPULSE;
            }
            else
            {
                atom.type = UDP_OSC_ATOM_STRING;
                atom.string_value = string_value;
            }
        }
        else if (json[pos] == '-' || json[pos] == '+' || (json[pos] >= '0' && json[pos] <= '9'))
        {
            if (!parse_json_number_token(json, pos, atom))
            {
                return false;
            }
        }
        else if (parse_json_literal(json, pos, "true"))
        {
            atom.type = UDP_OSC_ATOM_TRUE;
        }
        else if (parse_json_literal(json, pos, "false"))
        {
            atom.type = UDP_OSC_ATOM_FALSE;
        }
        else if (parse_json_literal(json, pos, "null"))
        {
            atom.type = UDP_OSC_ATOM_NIL;
        }
        else
        {
            return false;
        }

        out_atoms.push_back(atom);

        skip_json_ws(json, pos);

        if (pos >= json.size())
        {
            return false;
        }

        if (json[pos] == ',')
        {
            ++pos;
            continue;
        }

        if (json[pos] == ']')
        {
            ++pos;
            skip_json_ws(json, pos);
            return pos == json.size();
        }

        return false;
    }

    return false;
}

bool SciterWindow::dispatch_osc_to_js(const UdpOscMessage& message)
{
    std::string atoms_json = udp_osc_atoms_to_json(message.atoms);
    sciter::value result;

    if (!call_script_function_2(
        "osc_receive",
        sciter::value(message.address.c_str()),
        sciter::value(atoms_json.c_str()),
        result))
    {
        std::ostringstream ss;
        ss << "[WARNING] osc event not forwarded: " << message.address;
        log_line(ss.str());
        return false;
    }

    {
        std::ostringstream ss;
        ss << "dispatch_osc_to_js() address=" << message.address
            << " atoms_json=" << atoms_json
            << " result=" << value_to_utf8(result);
        log_line(ss.str());
    }

    return true;
}


sciter::value SciterWindow::js_log(const sciter::value& text)
{
    std::string msg;

    {
        sciter::string ws = text.to_string();
        const wchar_t* p = ws.c_str();

        if (p != nullptr)
        {
            int needed = WideCharToMultiByte(CP_UTF8, 0, p, -1, nullptr, 0, nullptr, nullptr);

            if (needed > 1)
            {
                msg.resize(static_cast<size_t>(needed - 1));

                WideCharToMultiByte(
                    CP_UTF8,
                    0,
                    p,
                    -1,
                    &msg[0],
                    needed - 1,
                    nullptr,
                    nullptr
                );
            }
        }
    }

    log_line(msg);
    std::cout << msg << std::endl;

    return sciter::value();
}
