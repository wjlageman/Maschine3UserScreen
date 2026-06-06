#pragma once

struct LedIndexpEntry
{
    int index;
    const char* name;
};

struct ColorIndexEntry
{
    int value;
    const char* name;
};

struct Push2HtmlMaschineMapEntry
{
    const char* name;
    int index;
    const char* color;
};

extern const Push2HtmlMaschineMapEntry html_color_map[];
extern const int g_push2_html_maschine_map_count;

extern const LedIndexpEntry g_led_index[];
extern const int g_led_index_count;

extern const ColorIndexEntry maschine_color_index[];
extern const int g_color_index_count;

int led_index_lookup(const char* name);
