#pragma once

#include <string>

#include <libusb.h>

#define SCITER_SESSION_DEBUG 0
#define SCITER_WINDOW_VISIBLE 0

static constexpr const wchar_t* SCITER_WINDOW_TITLE = L"Maschine MK3 User Screen";

static constexpr const wchar_t* UI_HOME = L"home://ui/";
static constexpr const wchar_t* UI_PAGE = L"index.htm";
//static constexpr const wchar_t* UI_PAGE = L"default-10.htm";

#if SCITER_WINDOW_VISIBLE
// Debug position is intentionally hardcoded.
// Adjust these coordinates locally if needed to a
// monitor without DPI scaling for reliable pixel mapping.
static constexpr int SCITER_WINDOW_X = 4793;
static constexpr int SCITER_WINDOW_Y = 18;
#else
static constexpr int SCITER_WINDOW_X = -5000;
static constexpr int SCITER_WINDOW_Y = -5000;
#endif

static constexpr int SCITER_WIDTH = 960;
static constexpr int SCITER_HEIGHT = 272;
// Interval for flushing accumulated controller/dial changes to JS.
static constexpr int CONTROL_FLUSH_INTERVAL_MS = 83;


char run_sciter_session(libusb_device* device);
void clear_sciter_session_log();
void set_sciter_template_file(const std::wstring& path);
const std::wstring& get_sciter_template_file();
