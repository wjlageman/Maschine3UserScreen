#include "MaschineUsbControls.h"
#include "WidgetLookup.h"
#include "LedIndex.h"
#include <stdio.h>
#include <string.h>
#include <conio.h>
#include <windows.h>
#include <hidapi.h>

#if LED_CTRL_DEBUG
#define LED_CTRL_PRINT(...) printf(__VA_ARGS__)
#define LED_CTRL_FLUSH() fflush(stdout)
#else
#define LED_CTRL_PRINT(...)
#define LED_CTRL_FLUSH()
#endif

BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID reserved)
{
    (void)module;
    (void)reserved;

    if (reason == DLL_PROCESS_ATTACH)
    {
        //printf("MaschineUsbControls.dll loaded\n");
        //fflush(stdout);
    }

    return TRUE;
}

static hid_device* g_device = NULL;
static char g_path[1024] = { 0 };
static ControlsEventCallback g_event_callback = NULL;
static volatile LONG g_read_stop_requested = 0;
static int g_strip_touch_prev = 0;
static int g_strip_touch_base = 0;

static unsigned char g_state_buf[CONTROLS_REPORT_SIZE];
static int g_state_valid = 0;
static int g_state_test_on = 0;
static int g_debug_select_color_base = 0;
static int g_night_time = 0;

static unsigned char g_input_buf[CONTROLS_REPORT_SIZE];
static int g_input_valid = 0;

struct QueuedControlEvent
{
    char name[64];
    int value;
};

struct ControlEventQueue
{
    QueuedControlEvent events[128];
    int count;
};

static void clear_control_event_queue(ControlEventQueue* queue)
{
    queue->count = 0;
}

static void queue_control_event(ControlEventQueue* queue, const char* name, int value)
{
    if (!queue)
    {
        LED_CTRL_PRINT("[EVENT QUEUE] drop: queue=null name=%s value=%d\n", name ? name : "NULL", value);
        return;
    }

    if (queue->count >= 128)
    {
        LED_CTRL_PRINT("[EVENT QUEUE] drop: queue full name=%s value=%d\n", name ? name : "NULL", value);
        return;
    }

    LED_CTRL_PRINT("[EVENT QUEUE] add index=%d name=%s value=%d\n", queue->count, name ? name : "NULL", value);

    strncpy_s(queue->events[queue->count].name, sizeof(queue->events[queue->count].name), name, _TRUNCATE);
    queue->events[queue->count].value = value;
    ++queue->count;
}


static void flush_control_event_queue(ControlEventQueue* queue)
{
    int i;

    if (!queue)
    {
        LED_CTRL_PRINT("[EVENT FLUSH] skipped: queue=null\n");
        return;
    }

    if (!g_event_callback)
    {
        LED_CTRL_PRINT("[EVENT FLUSH] skipped: callback=null count=%d\n", queue->count);
        queue->count = 0;
        return;
    }

    LED_CTRL_PRINT("[EVENT FLUSH] count=%d\n", queue->count);

    for (i = 0; i < queue->count; ++i)
    {
        LED_CTRL_PRINT("[DLL EMIT] callback name=%s value=%d\n", queue->events[i].name, queue->events[i].value);
        LED_CTRL_FLUSH();
        g_event_callback(queue->events[i].name, queue->events[i].value);
    }

    queue->count = 0;
}



static void dump_report_hex(const unsigned char* buffer, int len)
{
    int i;
    int j;

    LED_CTRL_PRINT("read %d bytes\n", len);

    for (i = 0; i < len; i += 16)
    {
        LED_CTRL_PRINT("%04X: ", i);

        for (j = 0; j < 16; ++j)
        {
            if (i + j < len)
            {
                LED_CTRL_PRINT("%02X ", buffer[i + j]);
            }
            else
            {
                LED_CTRL_PRINT("   ");
            }
        }

        LED_CTRL_PRINT("\n");
    }
}

static void dump_report_hex_single_line(const unsigned char* buffer, int len)
{
    int i;

    for (i = 0; i < len; ++i)
    {
        if (i > 0)
        {
            LED_CTRL_PRINT(" ");

            if ((i % 8) == 0)
            {
                LED_CTRL_PRINT("  ");
            }
        }

        LED_CTRL_PRINT("%02X", buffer[i]);
    }
}

static void dump_led_state_groups(const unsigned char* buffer, int len)
{
    int i;

    LED_CTRL_PRINT("[DLL LED WRITE]");

    for (i = 0; i < len; ++i)
    {
        if ((i % 8) == 0)
        {
            LED_CTRL_PRINT("   ");
        }
        else
        {
            LED_CTRL_PRINT(" ");
        }

        LED_CTRL_PRINT("%02X", buffer[i]);
    }

    LED_CTRL_PRINT("\n");
    LED_CTRL_FLUSH();
}



static int get_semantic_report_length(const unsigned char* buffer, int len)
{
    if (len <= 0)
    {
        return len;
    }

    if (buffer[0] == 0x80)
    {
        return 63;
    }

    if (buffer[0] == 0x01)
    {
        return 42;
    }

    if (buffer[0] == 0x81)
    {
        return 42;
    }

    return len;
}

static unsigned int read_u16_le(const unsigned char* buffer, int offset)
{
    unsigned int lo = (unsigned int)buffer[offset];
    unsigned int hi = (unsigned int)buffer[offset + 1];

    return lo | (hi << 8);
}

static int is_night_time_led_state_offset(int state_offset)
{
    return state_offset == 5 || (state_offset >= 29 && state_offset <= 36);
}

static unsigned char apply_night_time_to_led_value(int state_offset, unsigned char value)
{
    if (!g_night_time)
    {
        return value;
    }

    if (!is_night_time_led_state_offset(state_offset))
    {
        return value;
    }

    if ((value & 0x02) != 0)
    {
        return value;
    }

    return (unsigned char)(value & ~0x01);
}

static unsigned char apply_night_time_switch_to_led_value(int state_offset, unsigned char value)
{
    if (!is_night_time_led_state_offset(state_offset))
    {
        return value;
    }

    if ((value & 0x02) != 0)
    {
        return value;
    }

    if (g_night_time)
    {
        return (unsigned char)(value & ~0x01);
    }

    return (unsigned char)(value | 0x01);
}

static void apply_night_time_switch_to_state_frame(void)
{
    int i;
    static const int offsets[] =
    {
        5, 29, 30, 31, 32, 33, 34, 35, 36
    };

    for (i = 0; i < (int)(sizeof(offsets) / sizeof(offsets[0])); ++i)
    {
        g_state_buf[offsets[i]] = apply_night_time_switch_to_led_value(offsets[i], g_state_buf[offsets[i]]);
    }
}

static void init_known_state_frame(void)
{
    unsigned char frame[CONTROLS_REPORT_SIZE] =
    {
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x00, 0x00,
    };

    /*
    unsigned char frame[CONTROLS_REPORT_SIZE] =
    {
        0x80, 0x7C, 0x7C, 0x7C, 0x7C, 0x7E, 0x7E, 0x7C,
        0x7C, 0x7C, 0x7C, 0x7E, 0x7C, 0x7C, 0x7C, 0x7C,
        0x7C, 0x7C, 0x7C, 0x7C, 0x7C, 0x7C, 0x7C, 0x7E,
        0x7C, 0x7C, 0x7E, 0x7E, 0x7C, 0x7E, 0x2A, 0x28,
        0x28, 0x28, 0x28, 0x28, 0x28, 0x28, 0x7E, 0x7C,
        0x7C, 0x7E, 0x7C, 0x7C, 0x7E, 0x7C, 0x7C, 0x7C,
        0x7C, 0x7C, 0x7C, 0x7C, 0x7C, 0x7C, 0x7C, 0x7C,
        0x7C, 0x7C, 0x7C, 0x0C, 0x0C, 0x0C, 0x0C, 0x00
    };
    */

    memcpy(g_state_buf, frame, sizeof(g_state_buf));
    g_state_valid = 1;
    g_state_test_on = 0;
    apply_night_time_switch_to_state_frame();
}

static int controls_request_input_baseline(void)
{
    unsigned char request_buf[CONTROLS_REPORT_SIZE];
    int request_len;

    if (!g_device)
    {
        printf("input baseline failed: device not open\n");
        return 0;
    }

    memset(request_buf, 0, sizeof(request_buf));
    request_buf[0] = CONTROLS_REPORT_OFFSET;

    request_len = hid_get_input_report(g_device, request_buf, sizeof(request_buf));

    if (request_len < 0)
    {
        printf("input baseline failed: hid_get_input_report failed\n");
        return 0;
    }

    if (request_len == 0)
    {
        printf("input baseline failed: hid_get_input_report returned no data\n");
        return 0;
    }

    if (request_buf[0] != CONTROLS_REPORT_OFFSET)
    {
        printf("input baseline failed: unexpected report type 0x%02X\n", request_buf[0]);
        return 0;
    }

    if (request_len != CONTROLS_REPORT_SIZE && request_len != 42)
    {
        printf("warning: input baseline report length is %d, expected %d\n",
            request_len,
            CONTROLS_REPORT_SIZE);
    }

    memset(g_input_buf, 0, sizeof(g_input_buf));
    memcpy(g_input_buf, request_buf, request_len);
    g_input_valid = 1;

    LED_CTRL_PRINT("[BASELINE] requested input baseline\n");
    dump_report_hex(g_input_buf, CONTROLS_REPORT_SIZE);
    LED_CTRL_FLUSH();

    return 1;
}

static int write_state_frame(void)
{
    int result;

    if (!g_device)
    {
        printf("device not open\n");
        return -1;
    }

    if (!g_state_valid)
    {
        LED_CTRL_PRINT("state frame not initialized\n");
        return -1;
    }

    dump_led_state_groups(g_state_buf, CONTROLS_REPORT_SIZE);

    result = hid_write(g_device, g_state_buf, CONTROLS_REPORT_SIZE);

    if (result < 0)
    {
        printf("hid_write failed\n");
        return -1;
    }

    //printf("hid_write returned %d\n", result);
    return result;
}


static int cycle_led_for_name(const char* name)
{
    int led_index;
    int state_offset;

    if (!g_state_valid)
    {
        init_known_state_frame();
    }

    led_index = led_index_lookup(name);

    if (led_index < 0)
    {
        return 0;
    }

    state_offset = led_index + 1;

    if (g_state_buf[state_offset] == 0x00)
    {
        g_state_buf[state_offset] = 0x7c;
    }
    else if (g_state_buf[state_offset] == 0x7c)
    {
        g_state_buf[state_offset] = 0x7e;
    }
    else
    {
        g_state_buf[state_offset] = 0x00;
    }

    return write_state_frame();
}



static int color_index_lookup(const char* name)
{
    int i;

    if (!name)
    {
        name = "white";
    }

    for (i = 0; i < g_push2_html_maschine_map_count; ++i)
    {
        if (strcmp(html_color_map[i].name, name) == 0)
        {
            return html_color_map[i].index;
        }
    }

    return -1;
}

static unsigned char map_led_color_index_value(int color_index, int value)
{
    if (value < 0)
    {
        return 0x00;
    }

    if (color_index < 0)
    {
        return 0x00;
    }

    if (color_index > 0xFF)
    {
        return 0xFF;
    }

    return (unsigned char)color_index;
}

CONTROLS_API bool controls_set_led_color(const char* name, int value, const char* color)
{
    int led_index;
    int color_index;
    int state_offset;
    int result;

    if (!g_state_valid)
    {
        init_known_state_frame();
    }

    if (!name)
    {
        return false;
    }

    led_index = led_index_lookup(name);

    if (led_index < 0)
    {
        return false;
    }

    color_index = color_index_lookup(color);

    if (color_index < 0)
    {
        return false;
    }

    state_offset = led_index + 1;
    g_state_buf[state_offset] = apply_night_time_to_led_value(state_offset, map_led_color_index_value(color_index, value));

    result = write_state_frame();

    return result >= 0;
}

CONTROLS_API bool controls_set_led_color_index(const char* name, int color)
{
    int led_index;
    int state_offset;
    int result;

    if (!g_state_valid)
    {
        init_known_state_frame();
    }

    if (!name)
    {
        return false;
    }

    led_index = led_index_lookup(name);

    if (led_index < 0)
    {
        return false;
    }

    if (color < 0)
    {
        color = 0;
    }

    if (color > 0xFF)
    {
        color = 0xFF;
    }

    state_offset = led_index + 1;
    g_state_buf[state_offset] = apply_night_time_to_led_value(state_offset, (unsigned char)color);

    result = write_state_frame();

    return result >= 0;
}


CONTROLS_API bool controls_set_led_value(const char* name, int value)
{
    int led_index;
    int state_offset;
    int result;

    if (!g_state_valid)
    {
        init_known_state_frame();
    }

    if (!name)
    {
        return false;
    }

    led_index = led_index_lookup(name);

    if (led_index < 0)
    {
        return false;
    }

    state_offset = led_index + 1;
    if (value < 0)
    {
        value = 0;
    }

    if (value > 0xFF)
    {
        value = 0xFF;
    }

    g_state_buf[state_offset] = apply_night_time_to_led_value(state_offset, (unsigned char)value);

    result = write_state_frame();

    return result >= 0;
}


CONTROLS_API bool controls_debug_select_color_scan(void)
{
    int i;
    int led_index;
    int state_offset;
    int map_index;
    int group_start;
    int group_count;
    int result;
    const char* group_name;

    if (!g_state_valid)
    {
        init_known_state_frame();
    }

    if (g_debug_select_color_base < 4)
    {
        group_start = 1 + (g_debug_select_color_base * 8);
        group_count = 8;
        group_name = "color";
    }
    else
    {
        group_start = 33;
        group_count = g_push2_html_maschine_map_count - group_start;
        group_name = "neutral";
    }

    LED_CTRL_PRINT("Color demo group %d (%s):", g_debug_select_color_base + 1, group_name);

    for (i = 0; i < 8; ++i)
    {
        char select_name[16];

        sprintf_s(select_name, sizeof(select_name), "select-%d", i + 1);
        led_index = led_index_lookup(select_name);

        if (led_index < 0)
        {
            continue;
        }

        state_offset = led_index + 1;

        if (i < group_count)
        {
            map_index = group_start + i;

            g_state_buf[state_offset] = (unsigned char)html_color_map[map_index].index;

            LED_CTRL_PRINT(" select-%d=%s 0x%02X",
                i + 1,
                html_color_map[map_index].name,
                html_color_map[map_index].index);
        }
        else
        {
            g_state_buf[state_offset] = 0x00;
        }
    }

    LED_CTRL_PRINT("");

    result = write_state_frame();

    ++g_debug_select_color_base;

    if (g_debug_select_color_base >= 5)
    {
        g_debug_select_color_base = 0;
    }

    return result >= 0;
}

CONTROLS_API bool controls_set_night_time(bool night_time)
{
    int result;

    g_night_time = night_time ? 1 : 0;

    if (!g_state_valid)
    {
        init_known_state_frame();
    }
    else
    {
        apply_night_time_switch_to_state_frame();
    }

    result = write_state_frame();

    return result >= 0;
}

CONTROLS_API bool controls_get_night_time(void)
{
    return g_night_time ? true : false;
}

CONTROLS_API bool controls_reset_leds_to_default(void)
{
    int result;

    init_known_state_frame();

    result = write_state_frame();

    return result >= 0;
}

static int write_state_test_toggle(void)
{
    if (!g_state_valid)
    {
        init_known_state_frame();
    }

    if (g_state_test_on)
    {
        g_state_buf[42] = 0x7e;
        g_state_buf[30] = 0x7e;
        g_state_test_on = 0;
    }
    else
    {
        g_state_buf[42] = 0x7c;
        g_state_buf[30] = 0x7c;
        g_state_test_on = 1;
    }

    return write_state_frame();
}

static void report_bit_deltas(const unsigned char* prev_buf, const unsigned char* curr_buf, ControlEventQueue* queue)
{
    const unsigned char* prev;
    const unsigned char* curr;
    int i;
    int bit;

    prev = &prev_buf[CONTROLS_REPORT_OFFSET];
    curr = &curr_buf[CONTROLS_REPORT_OFFSET];

    for (i = 0; i < CONTROLS_DELTA_BYTES; ++i)
    {
        unsigned char prev_byte = prev[i];
        unsigned char curr_byte = curr[i];
        unsigned char changed = prev_byte ^ curr_byte;
        unsigned int offset;

        if (changed == 0)
        {
            continue;
        }

        offset = (unsigned int)i * 8;

        for (bit = 0; bit < 8; ++bit)
        {
            unsigned char mask = (unsigned char)(1 << bit);

            if ((changed & mask) == 0)
            {
                continue;
            }

            {
                unsigned int bit_number = offset + (unsigned int)bit;
                unsigned int bit_value = (curr_byte & mask) ? 1u : 0u;
                const char* name = widget_lookup_name(bit_number);

                if (name)
                {
                    LED_CTRL_PRINT("  knob-%u (%s) = %u\n", bit_number, name, bit_value);
                    {
                        char event_name[96];
                        queue_control_event(queue, name, (int)bit_value);
                    }

                    // LED feedback is handled by the caller callback.

                }
                else
                {
                    LED_CTRL_PRINT("  bit-%u = %u\n", bit_number, bit_value);
                }
            }
        }
    }
}

static void report_joy_step_delta(const unsigned char* prev_buf, const unsigned char* curr_buf, ControlEventQueue* queue)
{
    unsigned int prev_value;
    unsigned int curr_value;
    unsigned int forward;
    unsigned int backward;
    int delta;

    prev_value = (unsigned int)(prev_buf[0x0B] & 0x0F);
    curr_value = (unsigned int)(curr_buf[0x0B] & 0x0F);

    if (prev_value == curr_value)
    {
        return;
    }

    forward = (curr_value + 16u - prev_value) & 0x0Fu;
    backward = (prev_value + 16u - curr_value) & 0x0Fu;

    if (forward <= backward)
    {
        delta = (int)forward;
    }
    else
    {
        delta = -(int)backward;
    }

    LED_CTRL_PRINT("  value-80 (joy-step) = %d", delta);
    queue_control_event(queue, "joy-step", delta);
}

static void report_dial_deltas(const unsigned char* prev_buf, const unsigned char* curr_buf, ControlEventQueue* queue)
{
    int dial_index;

    for (dial_index = 0; dial_index < 8; ++dial_index)
    {
        int base = 0x0C + (dial_index * 2);
        unsigned int prev_low = (unsigned int)prev_buf[base];
        unsigned int prev_high = (unsigned int)(prev_buf[base + 1] & 0x03);
        unsigned int curr_low = (unsigned int)curr_buf[base];
        unsigned int curr_high = (unsigned int)(curr_buf[base + 1] & 0x03);
        int prev_value = (int)(prev_low | (prev_high << 8));
        int curr_value = (int)(curr_low | (curr_high << 8));
        int delta = curr_value - prev_value;
        int value_id = 82 + dial_index;

        if (delta > 512)
        {
            delta -= 1024;
        }
        else if (delta < -512)
        {
            delta += 1024;
        }

        if (delta == 0)
        {
            continue;
        }

        LED_CTRL_PRINT("  value-%d (dial-%d) = %d", value_id, dial_index + 1, delta);
        {
            char event_name[32];
            sprintf_s(event_name, sizeof(event_name), "dial-%d", dial_index + 1);
            queue_control_event(queue, event_name, delta);
        }
    }
}

static void report_strip_deltas(const unsigned char* prev_buf, const unsigned char* curr_buf, ControlEventQueue* queue)
{
    unsigned int prev_counter;
    unsigned int curr_counter;
    unsigned int prev_raw;
    unsigned int curr_raw;
    int prev_touch;
    int curr_touch;
    int prev_abs;
    int curr_abs;
    int counter_delta;

    prev_counter = read_u16_le(prev_buf, 0x1C);
    curr_counter = read_u16_le(curr_buf, 0x1C);

    prev_raw = read_u16_le(prev_buf, 0x1E);
    curr_raw = read_u16_le(curr_buf, 0x1E);

    prev_touch = (prev_raw != 0) ? 1 : 0;
    curr_touch = (curr_raw != 0) ? 1 : 0;

    prev_abs = prev_touch ? ((int)prev_raw - 1) : 0;
    curr_abs = curr_touch ? ((int)curr_raw - 1) : 0;

    if (prev_counter != curr_counter)
    {
        counter_delta = (int)((curr_counter - prev_counter) / 16u);
        LED_CTRL_PRINT("  value-strip.delta = %d", counter_delta);
        queue_control_event(queue, "strip.delta", counter_delta);
    }

    if (prev_touch != curr_touch)
    {
        LED_CTRL_PRINT("  value-strip-touch = %d", curr_touch);
        queue_control_event(queue, "strip-touch", curr_touch);
    }

    if (curr_touch)
    {
        if (!g_strip_touch_prev && curr_touch)
        {
            g_strip_touch_base = curr_abs;
        }

        if (!prev_touch || prev_abs != curr_abs)
        {
            LED_CTRL_PRINT("  value-modwheel = %d", curr_abs);
            queue_control_event(queue, "modwheel", curr_abs);
        }

        if (prev_touch)
        {
            if (prev_abs != curr_abs)
            {
                LED_CTRL_PRINT("  value-wheel-delta = %d", curr_abs - prev_abs);
                queue_control_event(queue, "wheel-delta", curr_abs - prev_abs);
            }
        }
        else
        {
            LED_CTRL_PRINT("  value-wheel-delta = 0");
            queue_control_event(queue, "wheel-delta", 0);
        }

        LED_CTRL_PRINT("  value-pitchbend = %d", curr_abs - g_strip_touch_base);
        queue_control_event(queue, "pitchbend", curr_abs - g_strip_touch_base);
    }
    else
    {
        if (prev_touch)
        {
            LED_CTRL_PRINT("  value-modwheel = 0");
            queue_control_event(queue, "modwheel", 0);
            LED_CTRL_PRINT("  value-wheel-delta = 0");
            queue_control_event(queue, "wheel-delta", 0);
            LED_CTRL_PRINT("  value-pitchbend = 0");
            queue_control_event(queue, "pitchbend", 0);
        }
    }

    g_strip_touch_prev = curr_touch;
}

static void report_pad_records(const unsigned char* buffer, int len, ControlEventQueue* queue)
{
    int offset;
    int max_pressure;
    int has_pressure;

    offset = 1;
    max_pressure = 0;
    has_pressure = 0;

    while (offset + 2 < len)
    {
        unsigned int pad;
        unsigned int status;
        unsigned int fn;
        unsigned int value;

        pad = (unsigned int)buffer[offset];
        status = (unsigned int)buffer[offset + 1];
        fn = (status >> 4) & 0x0F;
        value = ((status & 0x0F) << 8) | (unsigned int)buffer[offset + 2];

        if (fn == 0)
        {
            break;
        }

        if (fn == 1)
        {
            LED_CTRL_PRINT("pad-%u velocity = %u\n", pad, value);
            {
                char event_name[32];
                sprintf_s(event_name, sizeof(event_name), "pad-%u", pad);
                queue_control_event(queue, event_name, (int)value);
            }
        }
        else if (fn == 3)
        {
            LED_CTRL_PRINT("pad-%u = 0\n", pad);
            {
                char event_name[32];
                sprintf_s(event_name, sizeof(event_name), "pad-%u", pad);
                queue_control_event(queue, event_name, 0);
            }
        }
        else if (fn == 4)
        {
            LED_CTRL_PRINT("pad-%u-pressure = %u\n", pad, value);
            {
                char event_name[32];
                sprintf_s(event_name, sizeof(event_name), "pad-%u-pressure", pad);
                queue_control_event(queue, event_name, (int)value);
            }

            if (!has_pressure || (int)value > max_pressure)
            {
                max_pressure = (int)value;
            }

            has_pressure = 1;
        }

        offset += 3;
    }

    if (has_pressure)
    {
        LED_CTRL_PRINT("pressure = %d\n", max_pressure);
        queue_control_event(queue, "pressure", max_pressure);
    }
}

static int write_touchstrip_test(const unsigned char* state_buf, unsigned int absolute_value)
{
    unsigned char write_buf[CONTROLS_REPORT_SIZE];
    unsigned int raw_value;
    int result;

    memset(write_buf, 0, sizeof(write_buf));
    memcpy(write_buf, state_buf, sizeof(write_buf));

    if (absolute_value > 1023u)
    {
        absolute_value = 1023u;
    }

    if (absolute_value == 0u)
    {
        raw_value = 0u;
    }
    else
    {
        raw_value = absolute_value + 1u;
    }

    write_buf[0x1E] = (unsigned char)(raw_value & 0xFFu);
    write_buf[0x1F] = (unsigned char)((raw_value >> 8) & 0xFFu);

    LED_CTRL_PRINT("write touchstrip absolute=%u raw=%u\n", absolute_value, raw_value);
    dump_report_hex(write_buf, CONTROLS_REPORT_SIZE);

    result = hid_write(g_device, write_buf, CONTROLS_REPORT_SIZE);

    if (result < 0)
    {
        printf("hid_write failed\n");
        return -1;
    }

    LED_CTRL_PRINT("hid_write returned %d\n", result);
    return result;
}

int controls_ping(void)
{
    return 3137;
}
void controls_set_event_callback(ControlsEventCallback callback)
{
    g_event_callback = callback;
}

void controls_request_stop_reading(void)
{
    InterlockedExchange(&g_read_stop_requested, 1);
    LED_CTRL_PRINT("read stop requested\n");
}

int controls_list_devices(void)
{
    struct hid_device_info* devs = hid_enumerate(0x17cc, 0x1600);
    struct hid_device_info* cur = devs;

    while (cur)
    {
        LED_CTRL_PRINT("VID:PID = %04x:%04x | interface=%d | usage_page=%u | usage=%u\n",
            cur->vendor_id,
            cur->product_id,
            cur->interface_number,
            cur->usage_page,
            cur->usage);

        LED_CTRL_PRINT("path=%s\n", cur->path ? cur->path : "null");
        LED_CTRL_PRINT("\n");

        cur = cur->next;
    }

    hid_free_enumeration(devs);
    return 0;
}

int controls_open_first_maschine(void)
{
    struct hid_device_info* devs = NULL;
    struct hid_device_info* cur = NULL;

    if (g_device)
    {
        if (!g_input_valid)
        {
            printf("device already open but input baseline is invalid\n");
            return 0;
        }

        LED_CTRL_PRINT("device already open\n");
        return 1;
    }

    g_path[0] = 0;

    devs = hid_enumerate(0x17cc, 0x1600);
    cur = devs;

    while (cur)
    {
        if (cur->path && cur->interface_number == 4)
        {
            strncpy_s(g_path, sizeof(g_path), cur->path, _TRUNCATE);
            break;
        }

        cur = cur->next;
    }

    hid_free_enumeration(devs);

    if (!g_path[0])
    {
        printf("no Maschine interface found\n");
        return 0;
    }

    g_device = hid_open_path(g_path);

    if (!g_device)
    {
        printf("hid_open_path failed\n");
        return 0;
    }

    InterlockedExchange(&g_read_stop_requested, 0);

    LED_CTRL_PRINT("opened shared HID path for manual M3-start test: %s\n", g_path);
    LED_CTRL_PRINT("Maschine 3 may now be started manually while this program is running.\n");

    init_known_state_frame();

    if (!controls_request_input_baseline())
    {
        hid_close(g_device);
        g_device = NULL;
        g_path[0] = 0;
        g_input_valid = 0;
        memset(g_input_buf, 0, sizeof(g_input_buf));
        return 0;
    }

    return 1;
}

void controls_close_device(void)
{
    if (g_device)
    {
        hid_close(g_device);
        g_device = NULL;
        g_path[0] = 0;
        LED_CTRL_PRINT("device closed\n");
    }

    g_strip_touch_prev = 0;
    g_strip_touch_base = 0;
    g_state_valid = 0;
    g_state_test_on = 0;
    g_input_valid = 0;
    memset(g_input_buf, 0, sizeof(g_input_buf));
    InterlockedExchange(&g_read_stop_requested, 0);
}

int controls_read_once(void)
{
    unsigned char prev_input_buf[CONTROLS_REPORT_SIZE];
    unsigned char buffer[CONTROLS_REPORT_SIZE];
    unsigned char report_type;
    int result;
    int semantic_len;
    ControlEventQueue event_queue;

    if (!g_device)
    {
        printf("device not open\n");
        return -1;
    }

    memset(buffer, 0, sizeof(buffer));
    memset(prev_input_buf, 0, sizeof(prev_input_buf));

    result = hid_read_timeout(g_device, buffer, sizeof(buffer), 5000);

    if (result < 0)
    {
        printf("hid_read_timeout failed\n");
        return -1;
    }

    if (result == 0)
    {
        //printf("timeout, no data\n");
        return 0;
    }

    report_type = buffer[0];
    semantic_len = get_semantic_report_length(buffer, result);

    LED_CTRL_PRINT("[READ ONCE] len=%d type=0x%02X semantic_len=%d\n", result, report_type, semantic_len);
    dump_report_hex(buffer, result);

    clear_control_event_queue(&event_queue);

    if (report_type == 2)
    {
        LED_CTRL_PRINT("[READ ONCE] route=pad-records\n");
        report_pad_records(buffer, result, &event_queue);
        flush_control_event_queue(&event_queue);
        return result;
    }

    if (report_type == 0x80)
    {
        LED_CTRL_PRINT("[READ ONCE] route=state-write-echo ignored\n");
        return result;
    }

    if (!g_input_valid)
    {
        printf("input baseline error: controls_read_once called without requested input baseline\n");
        return -1;
    }

    memcpy(prev_input_buf, g_input_buf, sizeof(prev_input_buf));

    memset(g_input_buf, 0, sizeof(g_input_buf));
    memcpy(g_input_buf, buffer, result);

    LED_CTRL_PRINT("[READ ONCE] route=input-delta\n");
    report_bit_deltas(prev_input_buf, g_input_buf, &event_queue);
    report_joy_step_delta(prev_input_buf, g_input_buf, &event_queue);
    report_dial_deltas(prev_input_buf, g_input_buf, &event_queue);
    report_strip_deltas(prev_input_buf, g_input_buf, &event_queue);
    flush_control_event_queue(&event_queue);

    return result;
}



int controls_read_n_times(int count)
{
    int i;

    for (i = 0; i < count; ++i)
    {
        LED_CTRL_PRINT("report %d:\n", i + 1);
        controls_read_once();
    }

    return 1;
}

int controls_read_until_escape(void)
{
    unsigned char prev_buf[CONTROLS_REPORT_SIZE];
    unsigned char curr_buf[CONTROLS_REPORT_SIZE];
    unsigned char live_buf[CONTROLS_REPORT_SIZE];
    int prev_len;
    int curr_len;
    int live_len;
    int frame_index;
    int state_index;
    int modwheel_test_on;

    if (!g_device)
    {
        printf("device not open\n");
        return -1;
    }

    if (!g_input_valid)
    {
        printf("input baseline error: controls_read_until_escape called without requested input baseline\n");
        return -1;
    }

    memset(prev_buf, 0, sizeof(prev_buf));
    memset(curr_buf, 0, sizeof(curr_buf));
    memset(live_buf, 0, sizeof(live_buf));

    memcpy(curr_buf, g_input_buf, sizeof(curr_buf));

    prev_len = CONTROLS_REPORT_SIZE;
    curr_len = CONTROLS_REPORT_SIZE;
    live_len = 0;
    frame_index = 0;
    state_index = 0;
    modwheel_test_on = 0;

    g_strip_touch_prev = 0;
    g_strip_touch_base = 0;

    InterlockedExchange(&g_read_stop_requested, 0);

    LED_CTRL_PRINT("Reading reports. Press ESC to stop.\n");
    LED_CTRL_PRINT("Press M for touchstrip write test.\n");
    LED_CTRL_PRINT("Press L for state write test.\n");

    for (;;)
    {
        unsigned char report_type;
        int semantic_len;

        if (InterlockedCompareExchange(&g_read_stop_requested, 0, 0))
        {
            LED_CTRL_PRINT("read stop flag detected before read\n");
            break;
        }

        if (_kbhit())
        {
            int key = _getch();

            if (key == 27)
            {
                LED_CTRL_PRINT("ESC pressed, stopping\n");
                break;
            }

            if (key == 'm' || key == 'M')
            {
                if (modwheel_test_on)
                {
                    write_touchstrip_test(curr_buf, 0u);
                    modwheel_test_on = 0;
                }
                else
                {
                    write_touchstrip_test(curr_buf, 256u);
                    modwheel_test_on = 1;
                }
            }

            if (key == 'l' || key == 'L')
            {
                write_state_test_toggle();
            }
        }

        memset(live_buf, 0, sizeof(live_buf));

        live_len = hid_read_timeout(g_device, live_buf, sizeof(live_buf), 250);

        if (InterlockedCompareExchange(&g_read_stop_requested, 0, 0))
        {
            LED_CTRL_PRINT("read stop flag detected after read\n");
            break;
        }

        if (live_len < 0)
        {
            printf("hid_read_timeout failed\n");
            return -1;
        }

        if (live_len == 0)
        {
            continue;
        }

        report_type = live_buf[0];
        semantic_len = get_semantic_report_length(live_buf, live_len);

        if (report_type == 2)
        {
            ControlEventQueue event_queue;

            clear_control_event_queue(&event_queue);
            report_pad_records(live_buf, live_len, &event_queue);
            flush_control_event_queue(&event_queue);
            continue;
        }

        if (report_type == 0x80)
        {
            ++state_index;
            LED_CTRL_PRINT("State %d: ", state_index);
            dump_report_hex_single_line(live_buf, semantic_len);
            LED_CTRL_PRINT("\n");
            continue;
        }

        memcpy(prev_buf, curr_buf, sizeof(prev_buf));
        prev_len = curr_len;

        memset(curr_buf, 0, sizeof(curr_buf));
        memcpy(curr_buf, live_buf, live_len);
        curr_len = live_len;

        ++frame_index;

        if (curr_len != prev_len)
        {
            printf("warning: report length changed: prev=%d curr=%d\n", prev_len, curr_len);
        }

        {
            ControlEventQueue event_queue;

            clear_control_event_queue(&event_queue);

            LED_CTRL_PRINT("Frame %d: ", frame_index);
            dump_report_hex_single_line(curr_buf, semantic_len);
            report_bit_deltas(prev_buf, curr_buf, &event_queue);
            report_joy_step_delta(prev_buf, curr_buf, &event_queue);
            report_dial_deltas(prev_buf, curr_buf, &event_queue);
            report_strip_deltas(prev_buf, curr_buf, &event_queue);
            LED_CTRL_PRINT("\n");

            flush_control_event_queue(&event_queue);
        }
    }

    return 1;
}

