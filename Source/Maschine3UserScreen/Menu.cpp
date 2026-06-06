#include "Menu.h"

#include <cstddef>
#include <cstdio>

void print_command_prompt()
{
    printf("CMD> ");
    fflush(stdout);
}

void print_active_session_menu()
{
    printf("\n");
    printf("Active Maschine3 session\n");
    printf("  O. Reset driver to original NI Maschine software and quit\n");
    //printf("  U. Set driver for user access and restart\n"); // We have this driver already installed
    //printf("  W. Toggle Sciter debug window\n");
    printf("  D. Set LED day-time mode\n");
    printf("  N. Set LED night-time mode\n");
    printf("  L. Load HTML/M3 display file\n");
    printf("  R. Restart application for a fresh Maschine3 session\n");
    printf("  B. Show Banner Demo\n");
    printf("  S. Redraw Screens\n");
    printf("  Q. Quit\n");
    printf("\n");
    print_command_prompt();
}

bool is_active_session_command(char command)
{
    return command == 'S' ||
        command == 'W' ||
        command == 'D' ||
        command == 'N' ||
        command == 'L' ||
        command == 'R' ||
        command == 'B' ||
        command == 'O' ||
        command == 'U' ||
        command == 'Q';
}

char normalize_menu_key(int ch)
{
    if (ch >= 'a' && ch <= 'z')
    {
        return static_cast<char>(ch - 'a' + 'A');
    }

    return static_cast<char>(ch);
}

char get_command_from_line(const std::string& line)
{
    size_t i;

    for (i = 0; i < line.size(); ++i)
    {
        unsigned char ch = static_cast<unsigned char>(line[i]);

        if (ch != ' ' && ch != '\t')
        {
            return normalize_menu_key(ch);
        }
    }

    return '\0';
}
