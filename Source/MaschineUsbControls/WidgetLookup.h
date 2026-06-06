#pragma once

struct WidgetLookupEntry
{
    unsigned int bit_number;
    const char* name;
};

const char* widget_lookup_name(unsigned int bit_number);