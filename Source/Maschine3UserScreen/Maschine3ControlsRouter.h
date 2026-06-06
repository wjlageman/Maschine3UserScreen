#pragma once

#include <string>

struct MaschineControlEvent
{
    std::string name;
    int value;
};

class SciterWindow;

int get_delta_accu(int dial_index);
void reset_delta_accu(int dial_index);
bool start_maschine_controls();
void stop_maschine_controls();
void flush_dial_accumulators_to_js();
void consume_pending_control_messages(SciterWindow* frame);
