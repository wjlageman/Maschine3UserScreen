#pragma once

#include <string>

void print_command_prompt();
void print_active_session_menu();
bool is_active_session_command(char command);
char normalize_menu_key(int ch);
char get_command_from_line(const std::string& line);
