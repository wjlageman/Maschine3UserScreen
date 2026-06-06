#include "Maschine3UserScreen.h"
#include "SciterWindow.h"

#include <Sciter/sciter-x.h>
#include <Sciter/sciter-x-dom.hpp>

static const bool DEBUG_DISPLAY_CLOSE = false;

#include <iostream>
#include <chrono>
#include <string>
#include <cstring>
#include <sstream>

#if MASCHINE3_DISPLAY_DEBUG
#define DISPLAY_DEBUG_BLOCK(code) do { code } while (0)
#else
#define DISPLAY_DEBUG_BLOCK(code) do { } while (0)
#endif


extern void log_line(const std::string& text);

static int g_probe_frame_counter = 0;

Maschine3UserScreen::Maschine3UserScreen()
    : handle_(nullptr)
    , swap_bytes_(false)
    , left_(DISPLAY_BYTES)
    , right_(DISPLAY_BYTES)
    , left_dirty_(0)
    , right_dirty_(0)
    , display_update_running_(0)
    , update_request_counter_(0)
    , next_side_(0)
{
}

Maschine3UserScreen::~Maschine3UserScreen()
{
    close();
}

bool Maschine3UserScreen::open(libusb_device* device)
{
    close();

    if (device == nullptr)
    {
        std::cout << "Maschine3UserScreen::open: device is null\n";
        return false;
    }

    int rc = libusb_open(device, &handle_);
    if (rc != 0 || handle_ == nullptr)
    {
        std::cout << "Maschine3UserScreen: selected candidate could not be opened for direct display access.\n";
        handle_ = nullptr;
        return false;
    }

    // On this setup auto-detach is optional. The working route may report that
    // auto-detach is unavailable while normal open + claim still succeeds.
    libusb_set_auto_detach_kernel_driver(handle_, 1);

    rc = libusb_claim_interface(handle_, INTERFACE_NUMBER);
    if (rc != 0)
    {
        std::cout << "Maschine3UserScreen: display interface could not be claimed.\n";
        libusb_close(handle_);
        handle_ = nullptr;
        return false;
    }

    clear_both(0x0000);
    return true;
}

void Maschine3UserScreen::close()
{
    if (handle_ != nullptr)
    {
        if (DEBUG_DISPLAY_CLOSE)
        {
            std::cout << "Maschine3UserScreen::close: release display interface\n";
        }

        int release_rc = libusb_release_interface(handle_, INTERFACE_NUMBER);

        if (DEBUG_DISPLAY_CLOSE)
        {
            std::cout << "Maschine3UserScreen::close: release rc=" << release_rc << "\n";
            std::cout << "Maschine3UserScreen::close: close handle\n";
        }

        libusb_close(handle_);
        handle_ = nullptr;

        if (DEBUG_DISPLAY_CLOSE)
        {
            std::cout << "Maschine3UserScreen::close: handle closed\n";
        }
    }
}

bool Maschine3UserScreen::is_open() const
{
    return handle_ != nullptr;
}

std::vector<unsigned char>& Maschine3UserScreen::left_buffer()
{
    return left_;
}

std::vector<unsigned char>& Maschine3UserScreen::right_buffer()
{
    return right_;
}

const std::vector<unsigned char>& Maschine3UserScreen::left_buffer() const
{
    return left_;
}

const std::vector<unsigned char>& Maschine3UserScreen::right_buffer() const
{
    return right_;
}

void Maschine3UserScreen::clear_left(unsigned short color565)
{
    fill_rgb565_frame(left_, color565);
}

void Maschine3UserScreen::clear_right(unsigned short color565)
{
    fill_rgb565_frame(right_, color565);
}

void Maschine3UserScreen::clear_both(unsigned short color565)
{
    fill_rgb565_frame(left_, color565);
    fill_rgb565_frame(right_, color565);
}

bool Maschine3UserScreen::commit_left()
{
    if (handle_ == nullptr)
    {
        return false;
    }

    return send_frame_to_display(0, left_.data(), DISPLAY_BYTES, DISPLAY_WIDTH, DISPLAY_HEIGHT, "full-left");
}

bool Maschine3UserScreen::commit_right()
{
    if (handle_ == nullptr)
    {
        return false;
    }

    return send_frame_to_display(1, right_.data(), DISPLAY_BYTES, DISPLAY_WIDTH, DISPLAY_HEIGHT, "full-right");
}

bool Maschine3UserScreen::commit_left_test_frame(unsigned char* frame_data, int frame_size, int width, int height, const char* mode_name)
{
    if (handle_ == nullptr)
    {
        return false;
    }

    return send_frame_to_display(0, frame_data, frame_size, width, height, mode_name);
}

bool Maschine3UserScreen::write_bulk_exact(unsigned char* data, int length, unsigned int timeout_ms, const char* phase)
{
    static int transfer_count = 0;
    static std::chrono::steady_clock::time_point last_transfer_start;

    int transferred = 0;
    auto start = std::chrono::steady_clock::now();
    int rc = libusb_bulk_transfer(handle_, EP_OUT, data, length, &transferred, timeout_ms);
    auto end = std::chrono::steady_clock::now();

    double period_ms = 0.0;
    if (transfer_count > 0)
    {
        period_ms = std::chrono::duration<double, std::milli>(start - last_transfer_start).count();
    }

    last_transfer_start = start;
    transfer_count++;

    double transfer_ms = std::chrono::duration<double, std::milli>(end - start).count();

    DISPLAY_DEBUG_BLOCK(
        std::cout
        << "[DISPLAY USB] #" << transfer_count
        << " phase=" << phase
        << " bytes=" << length
        << " transferred=" << transferred
        << " rc=" << rc
        << " period_ms=" << period_ms
        << " transfer_ms=" << transfer_ms
        << "\n";
    );

    if (rc != 0)
    {
        std::cout << "Maschine3UserScreen: bulk transfer failed.\n";
        return false;
    }

    if (transferred != length)
    {
        std::cout << "Maschine3UserScreen: bulk transfer was shorter than expected.\n";
        return false;
    }

    return true;
}

bool Maschine3UserScreen::send_frame_to_display(int display_index, unsigned char* frame_data, int frame_size, int width, int height, const char* mode_name)
{
    unsigned char header[16] =
    {
        0x84, 0x00, 0x00, 0x60,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x01, 0xE0, 0x01, 0x10
    };

    unsigned char command[4] =
    {
        0x00, 0x00, 0xFF, 0x00
    };

    unsigned char footer[8] =
    {
        0x03, 0x00, 0x00, 0x00,
        0x40, 0x00, 0x00, 0x00
    };

    header[2] = static_cast<unsigned char>(display_index & 0xFF);
    header[12] = static_cast<unsigned char>((width >> 8) & 0xFF);
    header[13] = static_cast<unsigned char>(width & 0xFF);
    header[14] = static_cast<unsigned char>((height >> 8) & 0xFF);
    header[15] = static_cast<unsigned char>(height & 0xFF);

    const char* display_name = display_index == 0 ? "left" : "right";
    std::string header_phase = std::string(display_name) + ".header." + mode_name;
    std::string command_phase = std::string(display_name) + ".command." + mode_name;
    std::string frame_phase = std::string(display_name) + ".frame." + mode_name;
    std::string footer_phase = std::string(display_name) + ".footer." + mode_name;

    DISPLAY_DEBUG_BLOCK(
        std::cout
        << "[DISPLAY TEST FRAME] display=" << display_index
        << " mode=" << mode_name
        << " header_width=" << width
        << " header_height=" << height
        << " payload_bytes=" << frame_size
        << "\n";
    );

    auto frame_start = std::chrono::steady_clock::now();

    if (!write_bulk_exact(header, sizeof(header), 1000, header_phase.c_str()))
    {
        return false;
    }

    if (!write_bulk_exact(command, sizeof(command), 1000, command_phase.c_str()))
    {
        return false;
    }

    if (!write_bulk_exact(frame_data, frame_size, 3000, frame_phase.c_str()))
    {
        return false;
    }

    if (!write_bulk_exact(footer, sizeof(footer), 1000, footer_phase.c_str()))
    {
        return false;
    }

    auto frame_end = std::chrono::steady_clock::now();
    double total_ms = std::chrono::duration<double, std::milli>(frame_end - frame_start).count();

    DISPLAY_DEBUG_BLOCK(
        std::cout
        << "[DISPLAY USB FRAME] display=" << display_index
        << " mode=" << mode_name
        << " bytes=" << frame_size
        << " total_ms=" << total_ms
        << "\n";
    );

    return true;
}

void Maschine3UserScreen::fill_rgb565_frame(std::vector<unsigned char>& frame, unsigned short color565)
{
    unsigned char hi = static_cast<unsigned char>((color565 >> 8) & 0xFF);
    unsigned char lo = static_cast<unsigned char>(color565 & 0xFF);

    for (int i = 0; i < DISPLAY_BYTES; i += 2)
    {
        if (swap_bytes_)
        {
            frame[i] = lo;
            frame[i + 1] = hi;
        }
        else
        {
            frame[i] = hi;
            frame[i + 1] = lo;
        }
    }
}

bool Maschine3UserScreen::create_topdown_dib(
    HDC reference_dc,
    int width,
    int height,
    HDC& mem_dc,
    HBITMAP& dib,
    HGDIOBJ& old_bmp,
    void*& bits)
{
    mem_dc = CreateCompatibleDC(reference_dc);
    if (mem_dc == nullptr)
    {
        log_line("create_topdown_dib(): CreateCompatibleDC failed");
        return false;
    }

    BITMAPINFO bmi = {};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = width;
    bmi.bmiHeader.biHeight = -height;
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;

    bits = nullptr;
    dib = CreateDIBSection(reference_dc, &bmi, DIB_RGB_COLORS, &bits, nullptr, 0);
    if (dib == nullptr || bits == nullptr)
    {
        log_line("create_topdown_dib(): CreateDIBSection failed");
        DeleteDC(mem_dc);
        mem_dc = nullptr;
        dib = nullptr;
        bits = nullptr;
        return false;
    }

    old_bmp = SelectObject(mem_dc, dib);
    if (old_bmp == nullptr)
    {
        log_line("create_topdown_dib(): SelectObject failed");
        DeleteObject(dib);
        DeleteDC(mem_dc);
        mem_dc = nullptr;
        dib = nullptr;
        bits = nullptr;
        return false;
    }

    return true;
}

void Maschine3UserScreen::destroy_topdown_dib(HDC mem_dc, HBITMAP dib, HGDIOBJ old_bmp)
{
    if (mem_dc != nullptr && old_bmp != nullptr)
    {
        SelectObject(mem_dc, old_bmp);
    }

    if (dib != nullptr)
    {
        DeleteObject(dib);
    }

    if (mem_dc != nullptr)
    {
        DeleteDC(mem_dc);
    }
}

bool Maschine3UserScreen::capture_client_bgra(HWND hwnd, int width, int height, std::vector<unsigned char>& bgra, bool force_redraw)
{
    if (hwnd == nullptr)
    {
        log_line("capture_client_bgra(): hwnd null");
        return false;
    }

    RECT cr = {};
    if (!GetClientRect(hwnd, &cr))
    {
        log_line("capture_client_bgra(): GetClientRect failed");
        return false;
    }

    int client_width = cr.right - cr.left;
    int client_height = cr.bottom - cr.top;

    if (client_width != width || client_height != height)
    {
        std::ostringstream ss;
        ss << "capture_client_bgra(): client mismatch "
            << client_width << "x" << client_height
            << " expected " << width << "x" << height;
        log_line(ss.str());
        return false;
    }

    HDC hwnd_dc = GetDC(hwnd);
    if (hwnd_dc == nullptr)
    {
        log_line("capture_client_bgra(): GetDC failed");
        return false;
    }

    HDC mem_dc = nullptr;
    HBITMAP dib = nullptr;
    HGDIOBJ old_bmp = nullptr;
    void* bits = nullptr;

    if (!create_topdown_dib(hwnd_dc, width, height, mem_dc, dib, old_bmp, bits))
    {
        ReleaseDC(hwnd, hwnd_dc);
        return false;
    }

    bool captured = false;

    if (force_redraw)
    {
        SciterUpdateWindow(hwnd);
        RedrawWindow(hwnd, nullptr, nullptr, RDW_INVALIDATE | RDW_UPDATENOW | RDW_ALLCHILDREN | RDW_FRAME);
    }

    BOOL pw_ok = PrintWindow(hwnd, mem_dc, PW_CLIENTONLY);
    if (pw_ok)
    {
        captured = true;
        //log_line("capture_client_bgra(): PrintWindow(PW_CLIENTONLY) ok");
    }
    else
    {
        log_line("capture_client_bgra(): PrintWindow(PW_CLIENTONLY) failed");
    }

    if (!captured)
    {
        SendMessage(hwnd, WM_PRINTCLIENT, reinterpret_cast<WPARAM>(mem_dc), PRF_CLIENT);
        captured = true;
        log_line("capture_client_bgra(): WM_PRINTCLIENT attempted");
    }

    if (!captured)
    {
        BOOL blt_ok = BitBlt(mem_dc, 0, 0, width, height, hwnd_dc, 0, 0, SRCCOPY);
        if (blt_ok)
        {
            captured = true;
            log_line("capture_client_bgra(): BitBlt fallback ok");
        }
        else
        {
            log_line("capture_client_bgra(): BitBlt fallback failed");
        }
    }

    if (captured)
    {
        bgra.resize(width * height * 4);
        std::memcpy(&bgra[0], bits, bgra.size());
    }

    destroy_topdown_dib(mem_dc, dib, old_bmp);
    ReleaseDC(hwnd, hwnd_dc);

    return captured;
}

unsigned short Maschine3UserScreen::bgra_to_rgb565(unsigned char b, unsigned char g, unsigned char r)
{
    unsigned short r5 = static_cast<unsigned short>(r >> 3);
    unsigned short g6 = static_cast<unsigned short>(g >> 2);
    unsigned short b5 = static_cast<unsigned short>(b >> 3);
    return static_cast<unsigned short>((r5 << 11) | (g6 << 5) | b5);
}

void Maschine3UserScreen::copy_half_to_rgb565(const std::vector<unsigned char>& bgra, int src_width, int src_x0, std::vector<unsigned char>& dst)
{
    for (int y = 0; y < DISPLAY_HEIGHT; ++y)
    {
        for (int x = 0; x < DISPLAY_WIDTH; ++x)
        {
            int sx = src_x0 + x;
            int src_index = (y * src_width + sx) * 4;

            unsigned char b = bgra[src_index + 0];
            unsigned char g = bgra[src_index + 1];
            unsigned char r = bgra[src_index + 2];

            unsigned short c565 = bgra_to_rgb565(b, g, r);

            int dst_index = (y * DISPLAY_WIDTH + x) * 2;
            dst[dst_index + 0] = static_cast<unsigned char>((c565 >> 8) & 0xFF);
            dst[dst_index + 1] = static_cast<unsigned char>(c565 & 0xFF);
        }
    }
}

void Maschine3UserScreen::log_bgra_probe(const std::vector<unsigned char>& bgra, int width, int height)
{
    if (bgra.size() < 4)
    {
        log_line("probe BGRA: buffer too small");
        return;
    }

    int tl = 0;
    int center = ((height / 2) * width + (width / 2)) * 4;
    int br = ((height - 1) * width + (width - 1)) * 4;

    unsigned int sample_sum = 0;
    int non_zero = 0;
    int sample_count = 0;

    for (size_t i = 0; i < bgra.size() && sample_count < 64; i += 4, ++sample_count)
    {
        unsigned int px = bgra[i + 0] + bgra[i + 1] + bgra[i + 2];
        sample_sum += px;
        if (px != 0)
        {
            non_zero++;
        }
    }

    std::ostringstream ss;
    ss
        << "probe BGRA"
        << " TL=("
        << static_cast<int>(bgra[tl + 2]) << ","
        << static_cast<int>(bgra[tl + 1]) << ","
        << static_cast<int>(bgra[tl + 0]) << ")"
        << " C=("
        << static_cast<int>(bgra[center + 2]) << ","
        << static_cast<int>(bgra[center + 1]) << ","
        << static_cast<int>(bgra[center + 0]) << ")"
        << " BR=("
        << static_cast<int>(bgra[br + 2]) << ","
        << static_cast<int>(bgra[br + 1]) << ","
        << static_cast<int>(bgra[br + 0]) << ")"
        << " sample_sum=" << sample_sum
        << " sample_non_zero=" << non_zero
        << "/64";

    log_line(ss.str());
}

void Maschine3UserScreen::log_rgb565_probe(const char* label, const std::vector<unsigned char>& data)
{
    if (data.size() < 2)
    {
        std::ostringstream ss;
        ss << "probe " << label << ": buffer too small";
        log_line(ss.str());
        return;
    }

    size_t pixel_count = data.size() / 2;
    size_t center_pixel = pixel_count / 2;
    size_t last_pixel = pixel_count - 1;

    unsigned short p0 =
        static_cast<unsigned short>((static_cast<unsigned short>(data[0]) << 8) | data[1]);

    unsigned short pc =
        static_cast<unsigned short>((static_cast<unsigned short>(data[center_pixel * 2]) << 8) | data[(center_pixel * 2) + 1]);

    unsigned short pl =
        static_cast<unsigned short>((static_cast<unsigned short>(data[last_pixel * 2]) << 8) | data[last_pixel * 2 + 1]);

    unsigned int sample_sum = 0;
    int non_zero = 0;
    int sample_count = 0;

    for (size_t i = 0; i + 1 < data.size() && sample_count < 64; i += 2, ++sample_count)
    {
        unsigned short px =
            static_cast<unsigned short>((static_cast<unsigned short>(data[i]) << 8) | data[i + 1]);

        sample_sum += px;
        if (px != 0)
        {
            non_zero++;
        }
    }

    std::ostringstream ss;
    ss
        << "probe " << label
        << " P0=0x" << std::hex << p0
        << " Pc=0x" << pc
        << " Pl=0x" << pl
        << std::dec
        << " sample_sum=" << sample_sum
        << " sample_non_zero=" << non_zero
        << "/64";

    log_line(ss.str());
}

void Maschine3UserScreen::log_render_probes_if_needed(
    const std::vector<unsigned char>& bgra,
    const std::vector<unsigned char>& left,
    const std::vector<unsigned char>& right)
{
    g_probe_frame_counter++;

    bool do_log = false;

    if (g_probe_frame_counter <= 5)
    {
        do_log = true;
    }
    else if ((g_probe_frame_counter % 20) == 0)
    {
        do_log = true;
    }

    if (!do_log)
    {
        return;
    }

    {
        std::ostringstream ss;
        ss << "probe frame=" << g_probe_frame_counter;
        log_line(ss.str());
    }

    log_bgra_probe(bgra, COMBINED_WIDTH, DISPLAY_HEIGHT);
    log_rgb565_probe("LEFT", left);
    log_rgb565_probe("RIGHT", right);
}

bool Maschine3UserScreen::flush_sciter_paint_before_capture(SciterWindow* frame, HWND hwnd)
{
    if (frame == nullptr || !frame->is_valid())
    {
        log_line("flush_sciter_paint_before_capture(): frame invalid");
        return false;
    }

    if (hwnd == nullptr)
    {
        log_line("flush_sciter_paint_before_capture(): hwnd null");
        return false;
    }

    sciter::dom::element root = frame->root();
    if (!root.is_valid())
    {
        log_line("flush_sciter_paint_before_capture(): root invalid");
        return false;
    }

    root.update(true);
    SciterUpdateWindow(hwnd);
    UpdateWindow(hwnd);

    return true;
}


void Maschine3UserScreen::request_display_update(int x_pos, int width)
{
    int x_end = x_pos + width;

    ++update_request_counter_;

    if (x_pos < DISPLAY_WIDTH && x_end > 0)
    {
        InterlockedExchange(&left_dirty_, 1);
    }

    if (x_end > DISPLAY_WIDTH)
    {
        InterlockedExchange(&right_dirty_, 1);
    }

    DISPLAY_DEBUG_BLOCK(
        {
            std::ostringstream ss;
            ss << "[DISPLAY UPDATE REQUEST] #" << update_request_counter_
                << " x=" << x_pos
                << " width=" << width
                << " left_dirty=" << InterlockedCompareExchange(&left_dirty_, 0, 0)
                << " right_dirty=" << InterlockedCompareExchange(&right_dirty_, 0, 0);
            printf("%s\n", ss.str().c_str());
            fflush(stdout);
            log_line(ss.str());
        });
}

void Maschine3UserScreen::reset_dirty_state()
{
    InterlockedExchange(&left_dirty_, 0);
    InterlockedExchange(&right_dirty_, 0);
    InterlockedExchange(&display_update_running_, 0);
    next_side_ = 0;
}

int Maschine3UserScreen::choose_dirty_side()
{
    int left_dirty = InterlockedCompareExchange(&left_dirty_, 0, 0);
    int right_dirty = InterlockedCompareExchange(&right_dirty_, 0, 0);
    int side = -1;

    if (!left_dirty && !right_dirty)
    {
        return -1;
    }

    if (next_side_ == 0)
    {
        if (left_dirty)
        {
            side = 0;
        }
        else if (right_dirty)
        {
            side = 1;
        }
    }
    else
    {
        if (right_dirty)
        {
            side = 1;
        }
        else if (left_dirty)
        {
            side = 0;
        }
    }

    return side;
}

void Maschine3UserScreen::clear_dirty_side(int side)
{
    if (side == 0)
    {
        InterlockedExchange(&left_dirty_, 0);
        next_side_ = 1;
        return;
    }

    InterlockedExchange(&right_dirty_, 0);
    next_side_ = 0;
}

bool Maschine3UserScreen::has_dirty_side()
{
    if (InterlockedCompareExchange(&left_dirty_, 0, 0))
    {
        return true;
    }

    if (InterlockedCompareExchange(&right_dirty_, 0, 0))
    {
        return true;
    }

    return false;
}

bool Maschine3UserScreen::pump_dirty_side_after_draw(SciterWindow* frame)
{
    if (InterlockedCompareExchange(&display_update_running_, 1, 0) != 0)
    {
        return true;
    }

    int side = choose_dirty_side();

    if (side < 0)
    {
        InterlockedExchange(&display_update_running_, 0);
        return true;
    }

    clear_dirty_side(side);

    DISPLAY_DEBUG_BLOCK(
        {
            std::ostringstream ss;
            ss << "[DISPLAY UPDATE PUMP] side=" << (side == 0 ? "left" : "right")
                << " next_side=" << (next_side_ == 0 ? "left" : "right")
                << " left_dirty=" << InterlockedCompareExchange(&left_dirty_, 0, 0)
                << " right_dirty=" << InterlockedCompareExchange(&right_dirty_, 0, 0);
            printf("%s\n", ss.str().c_str());
            fflush(stdout);
            log_line(ss.str());
        });

    bool ok = render_dirty_side_after_draw(frame, side);

    InterlockedExchange(&display_update_running_, 0);

    return ok;
}

bool Maschine3UserScreen::render_dirty_side_after_draw(SciterWindow* frame, int side)
{
    if (frame == nullptr || !frame->is_valid())
    {
        log_line("render_dirty_side_to_maschine_after_draw(): frame invalid");
        return false;
    }

    HWND hwnd = static_cast<HWND>(frame->get_hwnd());
    if (hwnd == nullptr)
    {
        log_line("render_dirty_side_to_maschine_after_draw(): hwnd null");
        return false;
    }

    flush_sciter_paint_before_capture(frame, hwnd);

    std::vector<unsigned char> bgra;
    if (!capture_client_bgra(hwnd, COMBINED_WIDTH, DISPLAY_HEIGHT, bgra, false))
    {
        log_line("render_dirty_side_to_maschine_after_draw(): capture failed");
        return false;
    }

    if (side == 0)
    {
        copy_half_to_rgb565(bgra, COMBINED_WIDTH, 0, left_);

        if (!commit_left())
        {
            log_line("render_dirty_side_to_maschine_after_draw(): commit_left failed");
            return false;
        }

        return true;
    }

    copy_half_to_rgb565(bgra, COMBINED_WIDTH, DISPLAY_WIDTH, right_);

    if (!commit_right())
    {
        log_line("render_dirty_side_to_maschine_after_draw(): commit_right failed");
        return false;
    }

    return true;
}

bool Maschine3UserScreen::render_all(SciterWindow* frame)
{
    if (frame == nullptr || !frame->is_valid())
    {
        log_line("render_all_to_maschine(): frame invalid");
        return false;
    }

    HWND hwnd = static_cast<HWND>(frame->get_hwnd());
    if (hwnd == nullptr)
    {
        log_line("render_all_to_maschine(): hwnd null");
        return false;
    }

    std::vector<unsigned char> bgra;
    if (!capture_client_bgra(hwnd, COMBINED_WIDTH, DISPLAY_HEIGHT, bgra, true))
    {
        log_line("render_all_to_maschine(): capture failed");
        return false;
    }

    copy_half_to_rgb565(bgra, COMBINED_WIDTH, 0, left_);
    copy_half_to_rgb565(bgra, COMBINED_WIDTH, DISPLAY_WIDTH, right_);

    log_render_probes_if_needed(bgra, left_, right_);

    if (!commit_left())
    {
        log_line("render_all_to_maschine(): commit_left failed");
        return false;
    }

    if (!commit_right())
    {
        log_line("render_all_to_maschine(): commit_right failed");
        return false;
    }

    return true;
}
