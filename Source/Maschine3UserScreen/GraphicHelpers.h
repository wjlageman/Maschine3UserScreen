#pragma once

#include <string>
#include <vector>

unsigned short rgb565(unsigned char r, unsigned char g, unsigned char b);

void put_pixel_rgb565(
    std::vector<unsigned char>& frame,
    int x,
    int y,
    unsigned short color565,
    bool swap_bytes = false);

void put_pixel_combined_rgb565(
    std::vector<unsigned char>& left,
    std::vector<unsigned char>& right,
    int x,
    int y,
    unsigned short color565,
    bool swap_bytes = false);

void fill_rect_rgb565(
    std::vector<unsigned char>& frame,
    int x,
    int y,
    int w,
    int h,
    unsigned short color565,
    bool swap_bytes = false);

void draw_border(
    std::vector<unsigned char>& frame,
    unsigned short color565,
    bool swap_bytes = false);

void draw_logo_block(
    std::vector<unsigned char>& frame,
    int origin_x,
    int origin_y,
    unsigned short main_color,
    unsigned short accent_color,
    bool swap_bytes = false);

int text_width_5x7(
    const std::string& text,
    int scale,
    int spacing);

void draw_char_combined_5x7(
    std::vector<unsigned char>& left,
    std::vector<unsigned char>& right,
    char c,
    int origin_x,
    int origin_y,
    int scale,
    int spacing,
    unsigned short color565,
    bool swap_bytes = false);

void draw_text_combined_5x7(
    std::vector<unsigned char>& left,
    std::vector<unsigned char>& right,
    const std::string& text,
    int origin_x,
    int origin_y,
    int scale,
    int spacing,
    unsigned short color565,
    bool swap_bytes = false);