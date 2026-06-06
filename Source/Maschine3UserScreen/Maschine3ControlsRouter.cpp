#include "Maschine3ControlsRouter.h"

#include "MaschineUsbControls.h"
#include "SciterWindow.h"
#include "Udp_osc_transport.h"

#include <windows.h>
#include <cstdio>
#include <cstring>
#include <deque>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>

static const bool DEBUG_SHUTDOWN = false;

static std::mutex g_maschine_control_events_mutex;
static std::deque<MaschineControlEvent> g_maschine_control_events;
static int g_dial_accumulators[8] = { 0 };
static HANDLE g_maschine_controls_read_thread = nullptr;
static DWORD g_maschine_controls_read_thread_id = 0;
static bool g_maschine_controls_started = false;

void log_line(const std::string& text);
std::string bool_text(bool v);

#if SCITER_DEMO_DEBUG
#define SCITER_DEBUG_BLOCK(code) do { code } while (0)
#else
#define SCITER_DEBUG_BLOCK(code) do { } while (0)
#endif

static bool starts_with(const char* text, const char* prefix)
{
    if (text == nullptr || prefix == nullptr)
    {
        return false;
    }

    size_t prefix_len = strlen(prefix);

    return strncmp(text, prefix, prefix_len) == 0;
}

static int get_dial_index(const char* name)
{
    int index;

    if (!starts_with(name, "dial-"))
    {
        return -1;
    }

    if (name[5] < '1' || name[5] > '8')
    {
        return -1;
    }

    if (name[6] != '\0')
    {
        return -1;
    }

    index = name[5] - '1';

    return index;
}

int get_delta_accu(int dial_index)
{
    int value = 0;

    if (dial_index < 0 || dial_index >= 8)
    {
        return 0;
    }

    {
        std::lock_guard<std::mutex> lock(g_maschine_control_events_mutex);
        value = g_dial_accumulators[dial_index];
    }

    return value;
}

void reset_delta_accu(int dial_index)
{
    if (dial_index < 0 || dial_index >= 8)
    {
        return;
    }

    {
        std::lock_guard<std::mutex> lock(g_maschine_control_events_mutex);
        g_dial_accumulators[dial_index] = 0;
    }
}

static void queue_maschine_control_event(const char* name, int value)
{
    MaschineControlEvent event;

    event.name.assign(name);
    event.value = value;
    g_maschine_control_events.push_back(event);
}

void flush_dial_accumulators_to_js()
{
    int i;

    std::lock_guard<std::mutex> lock(g_maschine_control_events_mutex);

    for (i = 0; i < 8; ++i)
    {
        int value = g_dial_accumulators[i];

        if (value == 0)
        {
            continue;
        }

        char name[16] = {};
        sprintf_s(name, sizeof(name), "dial-%d", i + 1);

        g_dial_accumulators[i] = 0;
        queue_maschine_control_event(name, value);
    }
}

static bool is_cpp_osc_control_event(const char* name)
{
    if (name == nullptr)
    {
        return false;
    }

    if (starts_with(name, "pad-"))
    {
        return true;
    }

    if (strcmp(name, "pressure") == 0)
    {
        return true;
    }

    if (strcmp(name, "strip.delta") == 0 ||
        strcmp(name, "strip-touch") == 0 ||
        strcmp(name, "modwheel") == 0 ||
        strcmp(name, "wheel-delta") == 0 ||
        strcmp(name, "pitchbend") == 0)
    {
        return true;
    }

    return false;
}

static void publish_control_event_to_osc(const char* name, int value)
{
    std::string address = std::string("/controls/") + name;
    std::vector<UdpOscAtom> atoms;
    UdpOscAtom atom;

    atom.type = UDP_OSC_ATOM_INT32;
    atom.int_value = value;

    atoms.push_back(atom);
    udp_osc_send_message(address.c_str(), atoms);
}

static void log_control_router(const char* route, const char* name, int value)
{
    SCITER_DEBUG_BLOCK(
        {
            std::ostringstream ss;

            ss << "[CONTROL ROUTER] " << route
                << " name=" << (name ? name : "NULL")
                << " value=" << value;

            printf("%s\n", ss.str().c_str());
            fflush(stdout);
            log_line(ss.str());
        });
}

static void maschine_controls_event_callback(const char* name, int value)
{
    if (name == nullptr)
    {
        log_control_router("IN-NULL", name, value);
        return;
    }

    log_control_router("IN", name, value);

    log_control_router("OSC", name, value);
    publish_control_event_to_osc(name, value);

    {
        int dial_index = get_dial_index(name);

        if (dial_index >= 0)
        {
            std::lock_guard<std::mutex> lock(g_maschine_control_events_mutex);
            g_dial_accumulators[dial_index] += value;
            return;
        }
    }

    if (is_cpp_osc_control_event(name))
    {
        return;
    }

    log_control_router("JS", name, value);

    std::lock_guard<std::mutex> lock(g_maschine_control_events_mutex);
    queue_maschine_control_event(name, value);
}

static DWORD WINAPI maschine_controls_read_thread_proc(LPVOID)
{
    SCITER_DEBUG_BLOCK(
        {
        });

    while (g_maschine_controls_started)
    {
        controls_read_once();
        Sleep(1);
    }

    SCITER_DEBUG_BLOCK(
        {
        });

    return 0;
}

static void start_maschine_controls_read_thread()
{
    if (g_maschine_controls_read_thread != nullptr)
    {
        SCITER_DEBUG_BLOCK(log_line("[DEBUG] Maschine controls read thread already running"););
        return;
    }

    g_maschine_controls_read_thread = CreateThread(
        nullptr,
        0,
        maschine_controls_read_thread_proc,
        nullptr,
        0,
        &g_maschine_controls_read_thread_id
    );

    if (g_maschine_controls_read_thread == nullptr)
    {
        DWORD error = GetLastError();
        std::ostringstream ss;
        ss << "[ERROR] CreateThread for Maschine controls failed error=" << error;
        printf("%s\n", ss.str().c_str());
        log_line(ss.str());
        return;
    }

    {
        std::ostringstream ss;
        SCITER_DEBUG_BLOCK(
            {
                ss << "[DEBUG] Maschine controls read thread handle=" << g_maschine_controls_read_thread
                    << " id=" << g_maschine_controls_read_thread_id;
                printf("%s\n", ss.str().c_str());
                log_line(ss.str());
            });
    }
}

bool start_maschine_controls()
{
    if (g_maschine_controls_started)
    {
        SCITER_DEBUG_BLOCK(
            {
                printf("[DEBUG] Maschine controls already started\n");
                log_line("[DEBUG] Maschine controls already started");
            });
        return true;
    }

    SCITER_DEBUG_BLOCK(
        {
        });

    int ping = controls_ping();

    {
        std::ostringstream ss;
        SCITER_DEBUG_BLOCK(
            {
                ss << "[DEBUG] controls_ping() = " << ping;
                printf("%s\n", ss.str().c_str());
                log_line(ss.str());
            });
    }

    SCITER_DEBUG_BLOCK(
        {
        });
    controls_set_event_callback(maschine_controls_event_callback);

    SCITER_DEBUG_BLOCK(
        {
        });

    bool ok = controls_open_first_maschine() != 0;

    {
        std::ostringstream ss;
        SCITER_DEBUG_BLOCK(
            {
                ss << "[DEBUG] controls_open_first_maschine() ok=" << bool_text(ok);
                printf("%s\n", ss.str().c_str());
                log_line(ss.str());
            });
    }

    if (ok)
    {
        g_maschine_controls_started = true;

        bool reset_ok = controls_reset_leds_to_default() != 0;

        {
            std::ostringstream ss;
            SCITER_DEBUG_BLOCK(
                {
                    ss << "[DEBUG] controls_reset_leds_to_default() ok=" << bool_text(reset_ok);
                    printf("%s\n", ss.str().c_str());
                    log_line(ss.str());
                });
        }

        start_maschine_controls_read_thread();
    }

    return ok;
}

void stop_maschine_controls()
{
    if (!g_maschine_controls_started && g_maschine_controls_read_thread == nullptr)
    {
        SCITER_DEBUG_BLOCK(log_line("[DEBUG] stop_maschine_controls() ignored: not started"););
        return;
    }

    SCITER_DEBUG_BLOCK(
        {
        });

    SCITER_DEBUG_BLOCK(
        {
        });
    controls_set_event_callback(nullptr);

    SCITER_DEBUG_BLOCK(
        {
        });
    controls_request_stop_reading();

    if (g_maschine_controls_read_thread != nullptr)
    {
        SCITER_DEBUG_BLOCK(
            {
                printf("[DEBUG] waiting for Maschine controls read thread before closing device\n");
                log_line("[DEBUG] waiting for Maschine controls read thread before closing device");
            });

        DWORD wait_result = WaitForSingleObject(g_maschine_controls_read_thread, 1500);

        {
            std::ostringstream ss;
            SCITER_DEBUG_BLOCK(
                {
                    ss << "[DEBUG] Maschine controls read thread wait result=" << wait_result;
                    printf("%s\n", ss.str().c_str());
                    log_line(ss.str());
                });
        }

        if (wait_result == WAIT_OBJECT_0)
        {
            CloseHandle(g_maschine_controls_read_thread);
            g_maschine_controls_read_thread = nullptr;
            g_maschine_controls_read_thread_id = 0;
        }
        else
        {
            if (DEBUG_SHUTDOWN)
            {
                printf("[WARNING] Maschine controls read thread did not stop; device close skipped\n");
                log_line("[WARNING] Maschine controls read thread did not stop; device close skipped");
            }
            g_maschine_controls_started = false;
            SCITER_DEBUG_BLOCK(
                {
                });
            return;
        }
    }

    SCITER_DEBUG_BLOCK(
        {
        });
    controls_close_device();

    {
        int i;

        std::lock_guard<std::mutex> lock(g_maschine_control_events_mutex);
        g_maschine_control_events.clear();

        for (i = 0; i < 8; ++i)
        {
            g_dial_accumulators[i] = 0;
        }
    }

    g_maschine_controls_started = false;

    SCITER_DEBUG_BLOCK(
        {
        });
}

static bool pop_maschine_control_event(MaschineControlEvent& event)
{
    std::lock_guard<std::mutex> lock(g_maschine_control_events_mutex);

    if (g_maschine_control_events.empty())
    {
        return false;
    }

    event = g_maschine_control_events.front();
    g_maschine_control_events.pop_front();
    return true;
}

void consume_pending_control_messages(SciterWindow* frame)
{
    MaschineControlEvent event;

    if (frame == nullptr)
    {
        return;
    }

    while (pop_maschine_control_event(event))
    {
        SCITER_DEBUG_BLOCK(
            {
                std::ostringstream ss;
                ss << "[CONTROL ROUTER] JS-DISPATCH name=" << event.name
                    << " value=" << event.value;
                printf("%s\n", ss.str().c_str());
                fflush(stdout);
                log_line(ss.str());
            });

        frame->dispatch_control_to_js(event);
    }
}
