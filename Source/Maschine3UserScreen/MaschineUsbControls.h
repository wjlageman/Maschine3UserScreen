#pragma once

#define LED_CTRL_DEBUG 0

#ifdef _WIN32
#define CONTROLS_API extern "C" __declspec(dllexport)
#else
#define CONTROLS_API extern "C"
#endif

static const int CONTROLS_REPORT_SIZE = 64;
static const int CONTROLS_DELTA_BYTES = 10;
static const unsigned char CONTROLS_REPORT_OFFSET = 0x01;

typedef void (*ControlsEventCallback)(const char* name, int value);

CONTROLS_API int controls_list_devices(void);
CONTROLS_API int controls_open_first_maschine(void);
CONTROLS_API void controls_set_event_callback(ControlsEventCallback callback);
CONTROLS_API void controls_close_device(void);
CONTROLS_API void controls_request_stop_reading(void);
CONTROLS_API int controls_read_once(void);
CONTROLS_API int controls_read_n_times(int count);
CONTROLS_API int controls_read_until_escape(void);
CONTROLS_API bool controls_set_led_value(const char* name, int value);
CONTROLS_API bool controls_set_led_color(const char* name, int value, const char* color);
CONTROLS_API bool controls_set_led_color_index(const char* name, int color);
CONTROLS_API bool controls_set_night_time(bool night_time);
CONTROLS_API bool controls_get_night_time(void);
CONTROLS_API bool controls_reset_leds_to_default(void);

// For debugging
CONTROLS_API int controls_ping(void);
CONTROLS_API bool controls_debug_select_color_scan(void);
