#include "WidgetLookup.h"

static const WidgetLookupEntry g_widget_lookup[] =
{
    { 0,  "joy-press" },
    { 2,  "joy-up" },
    { 3,  "joy-right" },
    { 4,  "joy-down" },
    { 5,  "joy-left" },

    { 6,  "shift" },
    { 7,  "button-8" },

    { 8,  "select-1" },
    { 9,  "select-2" },
    { 10, "select-3" },
    { 11, "select-4" },
    { 12, "select-5" },
    { 13, "select-6" },
    { 14, "select-7" },
    { 15, "select-8" },

    { 16, "notes" },
    { 17, "volume" },
    { 18, "swing" },
    { 19, "tempo" },
    { 20, "note-repeat" },
    { 21, "lock" },

    { 24, "pad-mode" },
    { 25, "keyboard" },
    { 26, "chords" },
    { 27, "step" },

    { 28, "fixed-vel" },
    { 29, "scene" },
    { 30, "pattern" },
    { 31, "events" },

    { 33, "variation" },
    { 34, "dupicate" },
    { 35, "select" },
    { 36, "solo" },
    { 37, "mute" },

    { 38, "pitch" },
    { 39, "mod" },
    { 40, "perform" },

    { 41, "restart" },
    { 42, "erase" },
    { 43, "tap" },
    { 44, "follow" },
    { 45, "play" },
    { 46, "rec" },
    { 47, "stop" },
    { 48, "macro" },
    { 49, "settings" },
    { 50, "arrow-right" },
    { 51, "sampling" },
    { 52, "mixer" },
    { 53, "plug-in" },
    { 56, "channel" },
    { 57, "arranger" },
    { 58, "browser" },
    { 59, "arrow-left" },
    { 60, "file" },
    { 61, "auto" },

    { 64, "button-1" },
    { 65, "button-2" },
    { 66, "button-3" },
    { 67, "button-4" },
    { 68, "button-5" },
    { 69, "button-6" },
    { 70, "button-7" },

    { 71, "joy-touch" },

    { 72, "touch-8" },
    { 73, "touch-7" },
    { 74, "touch-6" },
    { 75, "touch-5" },
    { 76, "touch-4" },
    { 77, "touch-3" },
    { 78, "touch-2" },
    { 79, "touch-1" },
};

const char* widget_lookup_name(unsigned int bit_number)
{
    int i;
    int count = (int)(sizeof(g_widget_lookup) / sizeof(g_widget_lookup[0]));

    for (i = 0; i < count; ++i)
    {
        if (g_widget_lookup[i].bit_number == bit_number)
        {
            return g_widget_lookup[i].name;
        }
    }

    return 0;
}