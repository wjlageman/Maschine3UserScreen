#include "LedIndex.h"
#include <string.h>
#include <string>
#include <unordered_map>

const LedIndexpEntry g_led_index[] =
{
    {  0, "channel" },
    {  1, "plug-in" },
    {  2, "arranger" },
    {  3, "mixer" },
    {  4, "browser" },
    {  5, "sampling" },
    {  6, "arrow-left" },
    {  7, "arrow-right" },
    {  8, "file" },
    {  9, "settings" },
    { 10, "auto" },
    { 11, "macro" },

    { 12, "button-1" },
    { 13, "button-2" },
    { 14, "button-3" },
    { 15, "button-4" },
    { 16, "button-5" },
    { 17, "button-6" },
    { 18, "button-7" },
    { 19, "button-8" },

    { 20, "volume" },
    { 21, "swing" },
    { 22, "note-repeat" },
    { 23, "tempo" },
    { 24, "lock" },
    { 25, "pitch" },
    { 26, "mod" },
    { 27, "perform" },
    { 28, "notes" },

    { 29, "select-1" },
    { 30, "select-2" },
    { 31, "select-3" },
    { 32, "select-4" },
    { 33, "select-5" },
    { 34, "select-6" },
    { 35, "select-7" },
    { 36, "select-8" },

    { 37, "restart" },
    { 38, "erase" },
    { 39, "tap" },
    { 40, "follow" },
    { 41, "play" },
    { 42, "rec" },
    { 43, "stop" },
    { 44, "shift" },

    { 45, "fixed-vel" },
    { 46, "pad-mode" },
    { 47, "keyboard" },
    { 48, "chords" },
    { 49, "step" },
    { 50, "scene" },
    { 51, "pattern" },
    { 52, "events" },
    { 53, "variation" },
    { 54, "dupicate" },
    { 55, "select" },
    { 56, "solo" },
    { 57, "mute" },

    { 58, "joy-up" },
    { 59, "joy-left" },
    { 60, "joy-right" },
    { 61, "joy-down" },
};

const int g_led_index_count = sizeof(g_led_index) / sizeof(g_led_index[0]);

const ColorIndexEntry maschine_color_index[] =
{
    { 0x00, "black" },
    { 0x04, "red" },
    { 0x08, "orange" },
    { 0x0c, "light-orange" },
    { 0x10, "warm-yellow" },
    { 0x14, "yellow" },
    { 0x18, "lime" },
    { 0x20, "green" },
    { 0x22, "mint" },
    { 0x24, "cyan" },
    { 0x28, "turquoise" },
    { 0x2c, "blue" },
    { 0x30, "plum" },
    { 0x34, "violet" },
    { 0x38, "purple" },
    { 0x3c, "magenta" },
    { 0x42, "fuchsia" },
    { 0x44, "gray1" },
    { 0x45, "gray2" },
    { 0x46, "gray3" },
    { 0x47, "white" },
};

const int g_color_index_count = sizeof(maschine_color_index) / sizeof(maschine_color_index[0]);

const Push2HtmlMaschineMapEntry html_color_map[] =
{
    { "black",       0x00, "#000000" },
    { "red",         0x05, "#B80000" }, { "redhot",      0x06, "#FF0000" },
    { "brown",       0x09, "#804713" }, { "orange",      0x0A, "#FF9B14" },
    { "tomato",      0x0D, "#DF5F30" }, { "coral",       0x0E, "#FF6E41" },
    { "gold",        0x11, "#F0E68C" }, { "khaki",       0x12, "#FFD700" },
    { "yellow",      0x15, "#B0B000" }, { "sun",         0x16, "#FFFF00" },
    { "spring",      0x19, "#7ACF1D" }, { "lime",        0x1A, "#AAFF2D" },
    { "green",       0x1D, "#007F00" }, { "forestgreen", 0x1E, "#00BF00" },
    { "emerald",     0x21, "#00B955" }, { "limegreen",   0x22, "#00FF00" },
    { "pine",        0x25, "#00AF00" }, { "granny",      0x26, "#00FF00" },
    { "teal",        0x29, "#008080" }, { "cyan",        0x2A, "#00FFFF" },
    { "lilac",       0x2D, "#0078BF" }, { "turquoise",   0x2E, "#00C8FF" },
    { "plum",        0x31, "#000080" }, { "blue",        0x32, "#0032FF" },
    { "indigo",      0x35, "#4232D1" }, { "violet",      0x36, "#6E48CE" },
    { "orchid",      0x39, "#E157E3" }, { "purple",      0x3A, "#D232F5" },
    { "toy",         0x3D, "#FA00FA" }, { "rose",        0x3E, "#FF4A96" },
    { "pink",        0x41, "#A000A0" }, { "hotpink",     0x42, "#FF1493" },
    { "gray",        0x44, "#606060" }, { "lightgray",   0x46, "#C0C0C0" },
    { "silver",      0x45, "#A0A0A0" }, { "white",       0x47, "#FFFFFF" },
};

const int g_push2_html_maschine_map_count = sizeof(html_color_map) / sizeof(html_color_map[0]);

static const std::unordered_map<std::string, int> g_led_lookup =
{
    { "channel", 0 },
    { "plug-in", 1 },
    { "arranger", 2 },
    { "mixer", 3 },
    { "browser", 4 },
    { "sampling", 5 },
    { "arrow-left", 6 },
    { "arrow-right", 7 },
    { "file", 8 },
    { "settings", 9 },
    { "auto", 10 },
    { "macro", 11 },

    { "button-1", 12 },
    { "button-2", 13 },
    { "button-3", 14 },
    { "button-4", 15 },
    { "button-5", 16 },
    { "button-6", 17 },
    { "button-7", 18 },
    { "button-8", 19 },

    { "volume", 20 },
    { "swing", 21 },
    { "note-repeat", 22 },
    { "tempo", 23 },
    { "lock", 24 },
    { "pitch", 25 },
    { "mod", 26 },
    { "perform", 27 },
    { "notes", 28 },

    { "select-1", 29 },
    { "select-2", 30 },
    { "select-3", 31 },
    { "select-4", 32 },
    { "select-5", 33 },
    { "select-6", 34 },
    { "select-7", 35 },
    { "select-8", 36 },

    { "restart", 37 },
    { "erase", 38 },
    { "tap", 39 },
    { "follow", 40 },
    { "play", 41 },
    { "rec", 42 },
    { "stop", 43 },
    { "shift", 44 },

    { "fixed-vel", 45 },
    { "pad-mode", 46 },
    { "keyboard", 47 },
    { "chords", 48 },
    { "step", 49 },
    { "scene", 50 },
    { "pattern", 51 },
    { "events", 52 },
    { "variation", 53 },
    { "dupicate", 54 },
    { "select", 55 },
    { "solo", 56 },
    { "mute", 57 },

    { "joy-up", 58 },
    { "joy-left", 59 },
    { "joy-right", 60 },
    { "joy-down", 61 },
};

int led_index_lookup(const char* name)
{
    std::unordered_map<std::string, int>::const_iterator it;

    if (!name)
    {
        return -1;
    }

    it = g_led_lookup.find(name);

    if (it == g_led_lookup.end())
    {
        return -1;
    }

    return it->second;
}
