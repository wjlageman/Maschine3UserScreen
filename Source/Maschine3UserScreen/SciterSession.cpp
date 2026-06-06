#include "SciterSession.h"
#include "SciterTemplate.h"
#include "Menu.h"
#include "SciterWindow.h"
#include "Maschine3ControlsRouter.h"

static const bool DEBUG_SHUTDOWN = false;

#include <windows.h>
#include <chrono>
#include <cstring>
#include <cctype>
#include <cstdio>
#include <ctime>
#include <fstream>
#include <functional>
#include <deque>
#include <mutex>
#include <regex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>
#include <iostream>
#include <conio.h>

#include "Maschine3UserScreen.h"
#include "Udp_osc_transport.h"
#include "MaschineUsbControls.h"

#include <Sciter/sciter-x.h>
#include <Sciter/sciter-x-window.hpp>
#include <Sciter/sciter-x-dom.hpp>

static bool g_sciter_started = false;
static volatile LONG g_application_quit_requested = 0;
static volatile LONG g_shutdown_complete = 0;
static volatile LONG g_console_handler_installed = 0;


static void return_focus_to_console()
{
    HWND console_hwnd = GetConsoleWindow();

    if (console_hwnd == nullptr)
    {
        return;
    }

    ShowWindow(console_hwnd, SW_SHOW);
    SetForegroundWindow(console_hwnd);
    SetFocus(console_hwnd);
}

void log_line(const std::string& text);
std::string bool_text(bool v);

#if SCITER_SESSION_DEBUG
#define SCITER_DEBUG_BLOCK(code) do { code } while (0)
#else
#define SCITER_DEBUG_BLOCK(code) do { } while (0)
#endif

static BOOL WINAPI console_close_handler(DWORD ctrl_type)
{
    int i;

    if (ctrl_type != CTRL_CLOSE_EVENT &&
        ctrl_type != CTRL_C_EVENT &&
        ctrl_type != CTRL_BREAK_EVENT &&
        ctrl_type != CTRL_LOGOFF_EVENT &&
        ctrl_type != CTRL_SHUTDOWN_EVENT)
    {
        return FALSE;
    }

    printf("\n[CONSOLE] close/control event: request normal quit\n");
    fflush(stdout);
    log_line("[CONSOLE] close/control event: request normal quit");
    udp_osc_send_text("[CONSOLE] close/control event: request normal quit");

    InterlockedExchange(&g_application_quit_requested, 1);

    for (i = 0; i < 80; ++i)
    {
        if (InterlockedCompareExchange(&g_shutdown_complete, 0, 0))
        {
            udp_osc_send_text("[CONSOLE] shutdown completed before console close");
            return TRUE;
        }

        Sleep(100);
    }

    udp_osc_send_text("[CONSOLE] shutdown wait timed out");
    return TRUE;
}

static void install_console_close_handler()
{
    if (InterlockedCompareExchange(&g_console_handler_installed, 1, 0) != 0)
    {
        return;
    }

    if (!SetConsoleCtrlHandler(console_close_handler, TRUE))
    {
        printf("[CONSOLE] close handler install failed\n");
        fflush(stdout);
        log_line("[CONSOLE] close handler install failed");
        udp_osc_send_text("[CONSOLE] close handler install failed");
    }
    /*
    else
    {
        printf("[CONSOLE] close handler installed\n");
        fflush(stdout);
        log_line("[CONSOLE] close handler installed");
        udp_osc_send_text("[CONSOLE] close handler installed");
    }
    */
}

static std::string get_sciter_session_log_path()
{
    char module_path[MAX_PATH] = {};
    GetModuleFileNameA(nullptr, module_path, MAX_PATH);

    std::string path(module_path);
    size_t p = path.find_last_of("\\/");

    if (p != std::string::npos)
    {
        path = path.substr(0, p + 1);
    }

    path += "sciter_session.log";

    return path;
}

void clear_sciter_session_log()
{
    std::ofstream f(
        get_sciter_session_log_path().c_str(),
        std::ios::out | std::ios::trunc | std::ios::binary
    );
}


void log_line(const std::string& text)
{
    std::string line = text + "\r\n";

    OutputDebugStringA(line.c_str());

    char module_path[MAX_PATH] = {};
    GetModuleFileNameA(nullptr, module_path, MAX_PATH);

    std::string path(module_path);
    size_t p = path.find_last_of("\\/");
    if (p != std::string::npos)
    {
        path = path.substr(0, p + 1);
    }
    path += "sciter_session.log";

    std::ofstream f(path.c_str(), std::ios::out | std::ios::app | std::ios::binary);
    if (f.is_open())
    {
        std::time_t now = std::time(nullptr);
        std::tm tm_now = {};
        localtime_s(&tm_now, &now);

        char ts[64] = {};
        std::strftime(ts, sizeof(ts), "%Y-%m-%d %H:%M:%S", &tm_now);

        f << "[" << ts << "] " << text << "\r\n";
    }
}

std::string bool_text(bool v)
{
    return v ? "true" : "false";
}

static bool get_sciter_debug_window_visible()
{
    wchar_t buffer[16] = {};
    DWORD len = GetEnvironmentVariableW(L"MASCHINE_SCITER_DEBUG_WINDOW", buffer, 16);

    if (len == 0)
    {
        return false;
    }

    return buffer[0] == L'1';
}

static void set_sciter_debug_window_visible(bool visible)
{
    SetEnvironmentVariableW(L"MASCHINE_SCITER_DEBUG_WINDOW", visible ? L"1" : L"0");
}

int uimain(std::function<int()> run)
{
    log_line("uimain() enter");

    if (!g_sciter_started)
    {
        log_line("uimain() starting Sciter application");
        sciter::application::start();
        g_sciter_started = true;
    }
    else
    {
        log_line("uimain() Sciter already started");
    }

    int rc = run();

    {
        std::ostringstream ss;
        ss << "uimain() leave rc=" << rc;
        log_line(ss.str());
    }

    return rc;
}

static bool load_current_template(SciterWindow* frame)
{
    std::string runtime_html;

    if (frame == nullptr)
    {
        return false;
    }

    if (!build_runtime_template_html(get_sciter_template_file(), runtime_html))
    {
        return false;
    }

    if (runtime_html.empty())
    {
        std::cout << "Runtime template is empty.";
        return false;
    }

    return frame->load_html(
        reinterpret_cast<const unsigned char*>(runtime_html.data()),
        static_cast<UINT>(runtime_html.size()),
        UI_HOME
    );
}

static UINT get_window_dpi_or_default(HWND hwnd)
{
    typedef UINT(WINAPI* GetDpiForWindowProc)(HWND hwnd);

    HMODULE user32 = GetModuleHandleW(L"user32.dll");
    GetDpiForWindowProc get_dpi_for_window = nullptr;

    if (user32 != nullptr)
    {
        get_dpi_for_window = reinterpret_cast<GetDpiForWindowProc>(
            GetProcAddress(user32, "GetDpiForWindow")
            );
    }

    if (get_dpi_for_window != nullptr)
    {
        UINT dpi = get_dpi_for_window(hwnd);

        if (dpi != 0)
        {
            return dpi;
        }
    }

    return 96;
}

static bool adjust_window_rect_for_current_dpi(HWND hwnd, RECT& wr, DWORD style, DWORD ex_style)
{
    typedef BOOL(WINAPI* AdjustWindowRectExForDpiProc)(LPRECT lpRect, DWORD dwStyle, BOOL bMenu, DWORD dwExStyle, UINT dpi);

    HMODULE user32 = GetModuleHandleW(L"user32.dll");
    AdjustWindowRectExForDpiProc adjust_for_dpi = nullptr;

    if (user32 != nullptr)
    {
        adjust_for_dpi = reinterpret_cast<AdjustWindowRectExForDpiProc>(
            GetProcAddress(user32, "AdjustWindowRectExForDpi")
            );
    }

    if (adjust_for_dpi != nullptr)
    {
        UINT dpi = get_window_dpi_or_default(hwnd);
        return adjust_for_dpi(&wr, style, FALSE, ex_style, dpi) != FALSE;
    }

    return AdjustWindowRectEx(&wr, style, FALSE, ex_style) != FALSE;
}

static bool resize_window_to_client(HWND hwnd, int client_width, int client_height)
{
    if (hwnd == nullptr)
    {
        return false;
    }

    RECT wr = { 0, 0, client_width, client_height };

    DWORD style = static_cast<DWORD>(GetWindowLongPtr(hwnd, GWL_STYLE));
    DWORD ex_style = static_cast<DWORD>(GetWindowLongPtr(hwnd, GWL_EXSTYLE));

    if (!adjust_window_rect_for_current_dpi(hwnd, wr, style, ex_style))
    {
        return false;
    }

    int outer_width = wr.right - wr.left;
    int outer_height = wr.bottom - wr.top;
    UINT dpi = get_window_dpi_or_default(hwnd);

    BOOL ok = SetWindowPos(
        hwnd,
        nullptr,
        SCITER_WINDOW_X,
        SCITER_WINDOW_Y,
        outer_width,
        outer_height,
        SWP_NOZORDER | SWP_NOACTIVATE
    );

    {
        std::ostringstream ss;
        ss << "resize_window_to_client(): dpi=" << dpi
            << " outer=" << outer_width << "x" << outer_height
            << " client=" << client_width << "x" << client_height
            << " ok=" << bool_text(ok != FALSE);
        log_line(ss.str());
    }

    return ok != FALSE;
}

static void apply_debug_window_visibility(HWND hwnd, bool show_window)
{
    if (hwnd == nullptr)
    {
        return;
    }

    {
        std::ostringstream ss;
        ss << "apply_debug_window_visibility(): show_window=" << bool_text(show_window);
        log_line(ss.str());
    }

    if (show_window)
    {
        ShowWindow(hwnd, SW_SHOW);
        UpdateWindow(hwnd);
    }
    else
    {
        ShowWindow(hwnd, SW_HIDE);
    }
}

static sciter::dom::element get_dom_element(SciterWindow* frame, const wchar_t* element_id)
{
    if (frame == nullptr || !frame->is_valid())
    {
        log_line("get_dom_element(): frame invalid");
        return sciter::dom::element();
    }

    sciter::dom::element root = frame->root();
    if (!root.is_valid())
    {
        log_line("get_dom_element(): root invalid");
        return sciter::dom::element();
    }

    sciter::dom::element el = root.get_element_by_id(element_id);
    if (!el.is_valid())
    {
        log_line("get_dom_element(): element not found");
        return sciter::dom::element();
    }

    return el;
}

static bool try_set_dom_text(SciterWindow* frame, const wchar_t* element_id, const std::wstring& text)
{
    sciter::dom::element el = get_dom_element(frame, element_id);
    if (!el.is_valid())
    {
        return false;
    }

    el.set_text(text.c_str());
    el.update(true);
    return true;
}

static bool is_nighttime_atom_on(const UdpOscAtom& atom)
{
    std::string value;

    if (atom.type == UDP_OSC_ATOM_TRUE)
    {
        return true;
    }

    if (atom.type == UDP_OSC_ATOM_FALSE)
    {
        return false;
    }

    if (atom.type == UDP_OSC_ATOM_INT32)
    {
        return atom.int_value != 0;
    }

    if (atom.type == UDP_OSC_ATOM_FLOAT32)
    {
        return atom.float_value != 0.0f;
    }

    if (atom.type == UDP_OSC_ATOM_STRING)
    {
        value = atom.string_value;

        for (size_t i = 0; i < value.size(); ++i)
        {
            value[i] = (char)tolower((unsigned char)value[i]);
        }

        return value == "1" || value == "on" || value == "true" || value == "nighttime";
    }

    return false;
}

static std::wstring utf8_to_wide(const std::string& text)
{
    int length;
    std::wstring result;

    if (text.empty())
    {
        return L"";
    }

    length = MultiByteToWideChar(CP_UTF8, 0, text.c_str(), -1, nullptr, 0);

    if (length <= 1)
    {
        return L"";
    }

    result.resize(static_cast<size_t>(length));

    MultiByteToWideChar(CP_UTF8, 0, text.c_str(), -1, &result[0], length);

    result.resize(static_cast<size_t>(length - 1));

    return result;
}

static UdpOscAtom make_string_atom(const std::string& value)
{
    UdpOscAtom atom;

    atom.type = UDP_OSC_ATOM_STRING;
    atom.string_value = value;

    return atom;
}

static void send_system_osc_error(
    const char* address,
    const char* code,
    const char* message_text,
    const UdpOscMessage& source_message)
{
    std::vector<UdpOscAtom> error_atoms;
    std::vector<UdpOscAtom> screen_atoms;
    std::string atoms_json;

    atoms_json = udp_osc_atoms_to_json(source_message.atoms);

    error_atoms.push_back(make_string_atom(address ? address : ""));
    error_atoms.push_back(make_string_atom(code ? code : "error"));
    error_atoms.push_back(make_string_atom(message_text ? message_text : ""));
    error_atoms.push_back(make_string_atom(atoms_json));

    udp_osc_send_message("/error", error_atoms);

    if (address != nullptr && std::strcmp(address, "/maschine3/screen") == 0)
    {
        screen_atoms.push_back(make_string_atom("error"));
        screen_atoms.push_back(make_string_atom(code ? code : "error"));
        screen_atoms.push_back(make_string_atom(message_text ? message_text : ""));
        screen_atoms.push_back(make_string_atom(atoms_json));

        udp_osc_send_message("/maschine3/screen", screen_atoms);
    }
}

static bool get_screen_load_definition_file(const UdpOscMessage& message, std::wstring& screen_definition_file)
{
    if (message.address != "/maschine3/screen")
    {
        return false;
    }

    if (message.atoms.size() < 2)
    {
        return false;
    }

    if (message.atoms[0].type != UDP_OSC_ATOM_STRING)
    {
        return false;
    }

    if (message.atoms[1].type != UDP_OSC_ATOM_STRING)
    {
        return false;
    }

    if (message.atoms[0].string_value != "load")
    {
        return false;
    }

    screen_definition_file = utf8_to_wide(message.atoms[1].string_value);

    return !screen_definition_file.empty();
}

static bool screen_definition_file_has_required_structure(const std::wstring& screen_definition_file)
{
    std::string html;
    std::regex structure_regex(
        "<!DOCTYPE\\s+html[^>]*>"
        "[\\s\\S]*<html\\b[^>]*>"
        "[\\s\\S]*<head\\b[^>]*>"
        "[\\s\\S]*</head>"
        "[\\s\\S]*<body\\b[^>]*>"
        "[\\s\\S]*<screen\\b(?=[^>]*\\bid\\s*=\\s*[\\\"']screen[\\\"'])(?=[^>]*\\btype\\s*=\\s*[\\\"']maschine3[\\\"'])[^>]*>"
        "[\\s\\S]*</screen>"
        "[\\s\\S]*</body>"
        "[\\s\\S]*</html>",
        std::regex_constants::ECMAScript | std::regex_constants::icase
    );

    if (!read_file_text_utf8(screen_definition_file, html))
    {
        return false;
    }

    return std::regex_search(html, structure_regex);
}

static bool screen_definition_file_exists(const std::wstring& screen_definition_file)
{
    DWORD attributes = GetFileAttributesW(screen_definition_file.c_str());

    if (attributes == INVALID_FILE_ATTRIBUTES)
    {
        return false;
    }

    if ((attributes & FILE_ATTRIBUTE_DIRECTORY) != 0)
    {
        return false;
    }

    return true;
}

static bool handle_system_osc_message(const UdpOscMessage& message, char& out_command)
{
    bool nighttime;
    bool ok;
    std::wstring screen_definition_file;

    out_command = '\0';

    if (message.address == "/nighttime")
    {
        nighttime = false;

        if (!message.atoms.empty())
        {
            nighttime = is_nighttime_atom_on(message.atoms[0]);
        }

        ok = controls_set_night_time(nighttime) != 0;

        printf("LED %s mode %s.\n", nighttime ? "night-time" : "day-time", ok ? "set" : "failed");
        fflush(stdout);

        return true;
    }

    if (message.address == "/maschine3/screen")
    {
        if (!message.atoms.empty() &&
            message.atoms[0].type == UDP_OSC_ATOM_STRING &&
            message.atoms[0].string_value == "load")
        {
            if (!get_screen_load_definition_file(message, screen_definition_file))
            {
                send_system_osc_error(
                    "/maschine3/screen",
                    "missing-screen-definition",
                    "load requires a screen definition file path",
                    message);
                return true;
            }

            if (!screen_definition_file_exists(screen_definition_file))
            {
                send_system_osc_error(
                    "/maschine3/screen",
                    "screen-definition-not-found",
                    "screen definition file not found",
                    message);

                std::wcout << std::endl << L"OSC screen definition load rejected, file not found: " << screen_definition_file << std::endl;

                return true;
            }

            if (!screen_definition_file_has_required_structure(screen_definition_file))
            {
                send_system_osc_error(
                    "/maschine3/screen",
                    "invalid-screen-definition-structure",
                    "screen definition file must contain html, head, body and <screen id=\"screen\" type=\"maschine3\">",
                    message);

                std::wcout << std::endl << L"OSC screen definition load rejected, invalid screen definition structure: " << screen_definition_file << std::endl;

                return true;
            }

            set_sciter_template_file(screen_definition_file);
            out_command = 'L';

            std::wcout << std::endl << L"OSC screen definition load requested: " << screen_definition_file << std::endl;
            std::wcout << L"Restarting application with OSC screen definition file." << std::endl;

            return true;
        }
    }

    return false;
}

static char consume_pending_transport_messages(SciterWindow* frame)
{
    UdpOscMessage message;
    char command;

    if (frame == nullptr)
    {
        return '\0';
    }

    while (udp_osc_pop_message(message))
    {
        command = '\0';

        std::ostringstream ss;
        ss << "consume_pending_transport_messages() " << message.address
            << " atoms=" << udp_osc_atoms_to_json(message.atoms);
        log_line(ss.str());

        if (handle_system_osc_message(message, command))
        {
            if (command != '\0')
            {
                return command;
            }

            continue;
        }

        frame->dispatch_osc_to_js(message);
    }

    return '\0';
}


static void debug_shutdown_osc(const char* text)
{
    if (!DEBUG_SHUTDOWN)
    {
        return;
    }

    printf("%s", text);
    fflush(stdout);

    log_line(text);
    udp_osc_send_text(text);
}

static void shutdown_maschine_display(Maschine3UserScreen& display)
{
    bool left_ok;
    bool right_ok;

    debug_shutdown_osc("[DISPLAY] shutdown: clear both screens");

    display.clear_both(0x0000);

    debug_shutdown_osc("[DISPLAY] shutdown: commit left");
    left_ok = display.commit_left();

    debug_shutdown_osc("[DISPLAY] shutdown: commit right");
    right_ok = display.commit_right();

    {
        std::ostringstream ss;
        ss << "[DISPLAY] shutdown commit result left=" << bool_text(left_ok)
            << " right=" << bool_text(right_ok);
        debug_shutdown_osc(ss.str().c_str());
    }

    Sleep(100);

    debug_shutdown_osc("[DISPLAY] shutdown: close display interface");
    display.close();

    debug_shutdown_osc("[DISPLAY] shutdown: display interface closed");
    Sleep(250);
}

static void pump_sciter_before_menu()
{
    int i;

    for (i = 0; i < 20; ++i)
    {
        sciter::application::run_iteration();
        Sleep(5);
    }
}

char run_sciter_session(libusb_device* device)
{
    install_console_close_handler();
    InterlockedExchange(&g_application_quit_requested, 0);
    InterlockedExchange(&g_shutdown_complete, 0);
    log_line("run_sciter_session(device) DEVICE route enter");

    if (device == nullptr)
    {
        log_line("run_sciter_session(device): device is null");
        return 'Q';
    }

    Maschine3UserScreen display;
    bool opened = display.open(device);

    {
        std::ostringstream ss;
        ss << "run_sciter_session(device): display.open ok=" << bool_text(opened);
        log_line(ss.str());
    }

    if (!opened)
    {
        return 'Q';
    }

    start_maschine_controls();

    int rc = uimain(
        [&]() -> int
        {
            bool show_debug_window = get_sciter_debug_window_visible();

            RECT rc = { SCITER_WINDOW_X, SCITER_WINDOW_Y, SCITER_WINDOW_X + SCITER_WIDTH, SCITER_WINDOW_Y + SCITER_HEIGHT };
            SciterWindow* frame = new SciterWindow(rc);
            frame->set_display(&display);

            bool ok = load_current_template(frame);
            {
                std::ostringstream ss;
                ss << "run_sciter_session(device): load ok=" << bool_text(ok);
                log_line(ss.str());
            }

            if (!ok)
            {
                return -1;
            }

            HWND hwnd = static_cast<HWND>(frame->get_hwnd());
            if (hwnd == nullptr)
            {
                log_line("run_sciter_session(device): hwnd null");
                return -2;
            }

            if (!resize_window_to_client(hwnd, SCITER_WIDTH, SCITER_HEIGHT))
            {
                return -3;
            }

            frame->expand();
            SetWindowTextW(hwnd, SCITER_WINDOW_TITLE);
            frame->install_draw_update_callback();
            log_line("run_sciter_session(device): frame expanded");
            return_focus_to_console();

            apply_debug_window_visibility(hwnd, show_debug_window);

            //try_set_dom_text(frame, L"status", L"Running sciter session. 5");

            if (!display.render_all(frame))
            {
                log_line("run_sciter_session(device): first render failed");
                return -8;
            }

            frame->reset_draw_update_state();
            display.reset_dirty_state();

            flush_dial_accumulators_to_js();

            udp_osc_send_text("Maschine3UserScreen Sciter session started");

            pump_sciter_before_menu();
            print_active_session_menu();

            std::string command_line;
            char exit_command = '\0';

            auto next_control_flush = std::chrono::steady_clock::now() + std::chrono::milliseconds(CONTROL_FLUSH_INTERVAL_MS);

            while (IsWindow(hwnd))
            {
                sciter::application::run_iteration();

                if (InterlockedCompareExchange(&g_application_quit_requested, 0, 0))
                {
                    debug_shutdown_osc("[CONSOLE] close request observed in main loop");
                    exit_command = 'Q';
                    break;
                }

                while (_kbhit())
                {
                    int key = _getch();

                    if (key == 13 || key == 10)
                    {
                        char command;

                        printf("\n");
                        fflush(stdout);

                        command = get_command_from_line(command_line);
                        command_line.clear();

                        if (command == '\0')
                        {
                            print_command_prompt();
                            continue;
                        }

                        if (!is_active_session_command(command))
                        {
                            printf("Unknown choice: %c\n", command);
                            print_command_prompt();
                            continue;
                        }

                        if (command == 'S')
                        {
                            frame->request_full_display_redraw();

                            printf("Redraw Screens requested.\n");
                            fflush(stdout);
                            print_command_prompt();
                            continue;
                        }

                        if (command == 'W')
                        {
                            bool visible = !get_sciter_debug_window_visible();
                            set_sciter_debug_window_visible(visible);
                            apply_debug_window_visibility(hwnd, visible);
                            printf("Sciter debug window is now %s.\n", visible ? "visible" : "hidden");
                            fflush(stdout);
                            print_command_prompt();
                            continue;
                        }

                        if (command == 'L')
                        {
                            std::wstring selected_file = select_template_file(hwnd);

                            if (!selected_file.empty())
                            {
                                set_sciter_template_file(selected_file);

                                if (DEBUG_SHUTDOWN)
                                {
                                    std::wcout << L"Selected screen definition file: " << selected_file << std::endl;
                                }

                                exit_command = 'L';
                                FlushConsoleInputBuffer(GetStdHandle(STD_INPUT_HANDLE));
                                break;
                            }

                            printf("Screen definition file selection cancelled.\n");
                            fflush(stdout);
                            print_command_prompt();
                            continue;
                        }

                        if (command == 'D')
                        {
                            bool ok = controls_set_night_time(false) != 0;
                            printf("LED day-time mode %s.\n", ok ? "set" : "failed");
                            fflush(stdout);
                            print_command_prompt();
                            continue;
                        }

                        if (command == 'N')
                        {
                            bool ok = controls_set_night_time(true) != 0;
                            printf("LED night-time mode %s.\n", ok ? "set" : "failed");
                            fflush(stdout);
                            print_command_prompt();
                            continue;
                        }

                        if (command == 'O')
                        {
                            printf("Reset driver command received. Closing session...\n");
                            fflush(stdout);

                            exit_command = 'O';
                            FlushConsoleInputBuffer(GetStdHandle(STD_INPUT_HANDLE));
                            break;
                        }

                        if (command == 'B')
                        {
                            printf("Restarting application in Banner Demo mode...\n");
                            fflush(stdout);

                            exit_command = 'B';
                            FlushConsoleInputBuffer(GetStdHandle(STD_INPUT_HANDLE));
                            break;
                        }

                        if (command == 'Q')
                        {
                            fflush(stdout);
                        }

                        if (command == 'Q')
                        {
                            printf("Quitting...\n");
                            fflush(stdout);
                        }

                        exit_command = command;
                        break;
                    }

                    if (key == 8 || key == 127)
                    {
                        if (!command_line.empty())
                        {
                            command_line.resize(command_line.size() - 1);
                            printf("\b \b");
                            fflush(stdout);
                        }

                        continue;
                    }

                    if (key == 27)
                    {
                        while (!command_line.empty())
                        {
                            command_line.resize(command_line.size() - 1);
                            printf("\b \b");
                        }

                        fflush(stdout);
                        continue;
                    }

                    if (key >= 32 && key <= 126)
                    {
                        command_line.push_back(static_cast<char>(key));
                        putchar(key);
                        fflush(stdout);
                    }
                }

                if (exit_command != '\0')
                {
                    break;
                }

                auto now = std::chrono::steady_clock::now();


                exit_command = consume_pending_transport_messages(frame);

                if (exit_command != '\0')
                {
                    break;
                }

                consume_pending_control_messages(frame);

                if (now >= next_control_flush)
                {
                    flush_dial_accumulators_to_js();
                    consume_pending_control_messages(frame);
                    next_control_flush = std::chrono::steady_clock::now() + std::chrono::milliseconds(CONTROL_FLUSH_INTERVAL_MS);
                }

                if (!frame->pump_draw_update())
                {
                    if (!IsWindow(hwnd))
                    {
                        break;
                    }

                    log_line("run_sciter_session(device): sciter draw update failed");
                    return -9;
                }

                std::this_thread::sleep_for(std::chrono::milliseconds(2));
            }

            debug_shutdown_osc("[SHUTDOWN] loop exited");
            udp_osc_send_text("Maschine3UserScreen Sciter Session stopped");

            debug_shutdown_osc("[SHUTDOWN] clear Maschine control LEDs");
            controls_reset_leds_to_default();

            debug_shutdown_osc("[SHUTDOWN] stop Maschine controls");
            stop_maschine_controls();

            debug_shutdown_osc("[SHUTDOWN] stop Maschine controls done");
            shutdown_maschine_display(display);

            InterlockedExchange(&g_shutdown_complete, 1);
            debug_shutdown_osc("[SHUTDOWN] display shutdown done");

            log_line("run_sciter_session(device): window loop ended");

            if (exit_command == '\0')
            {
                exit_command = 'Q';
            }

            return static_cast<int>(exit_command);
        }
    );

    {
        std::ostringstream ss;
        ss << "run_sciter_session(device) DEVICE route leave rc=" << rc;
        log_line(ss.str());
    }

    if (rc == 'N' || rc == 'U' || rc == 'R' || rc == 'Q' || rc == 'L' || rc == 'B' || rc == 'O')
    {
        return static_cast<char>(rc);
    }

    return 'Q';
}
