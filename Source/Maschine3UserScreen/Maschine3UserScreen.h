#pragma once

#include <vector>
#include <windows.h>
#include <libusb.h>

class SciterWindow;

static const int DISPLAY_WIDTH = 480;
static const int DISPLAY_HEIGHT = 272;
static const int BYTES_PER_PIXEL = 2;
static const int DISPLAY_BYTES = DISPLAY_WIDTH * DISPLAY_HEIGHT * BYTES_PER_PIXEL;
static const int COMBINED_WIDTH = DISPLAY_WIDTH * 2;

static const unsigned char EP_OUT = 0x04;
static const int INTERFACE_NUMBER = 5;

class Maschine3UserScreen
{
public:
    Maschine3UserScreen();
    ~Maschine3UserScreen();

    bool open(libusb_device* device);
    void close();

    bool is_open() const;

    std::vector<unsigned char>& left_buffer();
    std::vector<unsigned char>& right_buffer();

    const std::vector<unsigned char>& left_buffer() const;
    const std::vector<unsigned char>& right_buffer() const;

    void clear_left(unsigned short color565 = 0x0000);
    void clear_right(unsigned short color565 = 0x0000);
    void clear_both(unsigned short color565 = 0x0000);

    bool commit_left();
    bool commit_right();
    bool commit_left_test_frame(unsigned char* frame_data, int frame_size, int width, int height, const char* mode_name);

    void request_display_update(int x_pos, int width);
    void reset_dirty_state();
    bool has_dirty_side();
    bool pump_dirty_side_after_draw(SciterWindow* frame);
    bool render_dirty_side_after_draw(SciterWindow* frame, int side);
    bool render_all(SciterWindow* frame);

private:
    libusb_device_handle* handle_;
    bool swap_bytes_;
    std::vector<unsigned char> left_;
    std::vector<unsigned char> right_;
    volatile LONG left_dirty_;
    volatile LONG right_dirty_;
    volatile LONG display_update_running_;
    int update_request_counter_;
    int next_side_;

    bool write_bulk_exact(unsigned char* data, int length, unsigned int timeout_ms, const char* phase);
    bool send_frame_to_display(int display_index, unsigned char* frame_data, int frame_size, int width, int height, const char* mode_name);
    void fill_rgb565_frame(std::vector<unsigned char>& frame, unsigned short color565);
    int choose_dirty_side();
    void clear_dirty_side(int side);

    static bool create_topdown_dib(HDC reference_dc, int width, int height, HDC& mem_dc, HBITMAP& dib, HGDIOBJ& old_bmp, void*& bits);
    static void destroy_topdown_dib(HDC mem_dc, HBITMAP dib, HGDIOBJ old_bmp);
    static bool capture_client_bgra(HWND hwnd, int width, int height, std::vector<unsigned char>& bgra, bool force_redraw);
    static unsigned short bgra_to_rgb565(unsigned char b, unsigned char g, unsigned char r);
    static void copy_half_to_rgb565(const std::vector<unsigned char>& bgra, int src_width, int src_x0, std::vector<unsigned char>& dst);
    static void log_bgra_probe(const std::vector<unsigned char>& bgra, int width, int height);
    static void log_rgb565_probe(const char* label, const std::vector<unsigned char>& data);
    static void log_render_probes_if_needed(const std::vector<unsigned char>& bgra, const std::vector<unsigned char>& left, const std::vector<unsigned char>& right);
    bool flush_sciter_paint_before_capture(SciterWindow* frame, HWND hwnd);
};