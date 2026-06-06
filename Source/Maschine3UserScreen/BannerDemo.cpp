#include "BannerDemo.h"

#include <iostream>
#include <vector>
#include <string>
#include <chrono>
#include <thread>
#include <cstdlib>
#include <ctime>
#include <conio.h>

#include "Maschine3UserScreen.h"
#include "GraphicHelpers.h"

static const int LOGO_WIDTH = 96;
static const int LOGO_HEIGHT = 56;

static const int LEFT_LOGO_START_X = 0;
static const int LEFT_LOGO_START_Y = 30;
static const int RIGHT_LOGO_START_X = DISPLAY_WIDTH - LOGO_WIDTH;
static const int RIGHT_LOGO_START_Y = 100;

static const int LEFT_LOGO_DX = 8;
static const int LEFT_LOGO_DY = 5;
static const int RIGHT_LOGO_DX = -9;
static const int RIGHT_LOGO_DY = -5;

static const int BANNER_DX = 6;
static const int BANNER_SCALE = 2;
static const int BANNER_SPACING = 2;
static const int BANNER_Y = (DISPLAY_HEIGHT * 2) / 3;

static const unsigned short COLOR_BLACK = 0x0000;
static const unsigned short COLOR_WHITE = 0xFFFF;
static const unsigned short COLOR_RED = 0xF800;
static const unsigned short COLOR_GREEN = 0x07E0;
static const unsigned short COLOR_YELLOW = 0xFFE0;
static const unsigned short COLOR_CYAN = 0x07FF;
static const unsigned short COLOR_BORDER = 0x39E7;

static const char* DEMO_QUOTES[] =
{
    "IN THE FUTURE EVERYONE WILL BE FAMOUS FOR 15 MINUTES - ANDY WARHOL",
    "ALLES VAN WAARDE IS WEERLOOS - LUCEBERT",
    "EVERYTHING OF VALUE IS DEFENSELESS - LUCEBERT",
    "RUIMTE SCHEIDT DE LICHAMEN, NIET DE GEESTEN - ERASMUS",
    "DE OMGEVING VAN DE MENS IS DE MEDEMENS - JULES DEELDER",
    "NIET LULLEN MAAR POETSEN - ROTTERDAM"
};

struct BannerState
{
    int quote_index;
    std::string text;
    int width;
    int x;
    bool active;
};

struct QuoteCycleState
{
    std::vector<int> order;
    int next_pos;
    bool first_cycle;
    int previous_cycle_last_index;

    QuoteCycleState()
        : next_pos(0)
        , first_cycle(true)
        , previous_cycle_last_index(-1)
    {
    }
};

static int demo_quote_count()
{
    return static_cast<int>(sizeof(DEMO_QUOTES) / sizeof(DEMO_QUOTES[0]));
}

static void seed_random_once()
{
    static bool seeded = false;

    if (!seeded)
    {
        std::srand(static_cast<unsigned int>(std::time(nullptr)));
        seeded = true;
    }
}

static void shuffle_indices(std::vector<int>& values)
{
    if (values.size() <= 1)
    {
        return;
    }

    for (int i = static_cast<int>(values.size()) - 1; i > 0; --i)
    {
        int j = std::rand() % (i + 1);
        int temp = values[i];
        values[i] = values[j];
        values[j] = temp;
    }
}

static void build_next_quote_cycle(QuoteCycleState& state)
{
    int count = demo_quote_count();

    state.order.clear();
    state.next_pos = 0;

    if (count <= 0)
    {
        return;
    }

    if (count == 1)
    {
        state.order.push_back(0);
        state.previous_cycle_last_index = 0;
        state.first_cycle = false;
        return;
    }

    if (state.first_cycle)
    {
        state.order.push_back(0);

        std::vector<int> tail;
        for (int i = 1; i < count; ++i)
        {
            tail.push_back(i);
        }

        shuffle_indices(tail);

        for (size_t i = 0; i < tail.size(); ++i)
        {
            state.order.push_back(tail[i]);
        }
    }
    else
    {
        for (int i = 0; i < count; ++i)
        {
            state.order.push_back(i);
        }

        do
        {
            shuffle_indices(state.order);
        } while (state.order[0] == state.previous_cycle_last_index);
    }

    state.previous_cycle_last_index = state.order.back();
    state.first_cycle = false;
}

static int next_quote_index(QuoteCycleState& state)
{
    if (state.order.empty() || state.next_pos >= static_cast<int>(state.order.size()))
    {
        build_next_quote_cycle(state);
    }

    if (state.order.empty())
    {
        return 0;
    }

    int result = state.order[state.next_pos];
    state.next_pos++;
    return result;
}

static void init_banner(BannerState& banner, int quote_index)
{
    banner.quote_index = quote_index;
    banner.text = DEMO_QUOTES[quote_index];
    banner.width = text_width_5x7(banner.text, BANNER_SCALE, BANNER_SPACING);
    banner.x = COMBINED_WIDTH;
    banner.active = true;
}

bool run_banner_demo(libusb_device* device)
{
    seed_random_once();

    Maschine3UserScreen display;
    if (!display.open(device))
    {
        return false;
    }

    int left_x = LEFT_LOGO_START_X;
    int left_y = LEFT_LOGO_START_Y;
    int right_x = RIGHT_LOGO_START_X;
    int right_y = RIGHT_LOGO_START_Y;

    int left_dx = LEFT_LOGO_DX;
    int left_dy = LEFT_LOGO_DY;
    int right_dx = RIGHT_LOGO_DX;
    int right_dy = RIGHT_LOGO_DY;

    QuoteCycleState quote_cycle;
    BannerState current_banner = {};
    BannerState next_banner = {};

    init_banner(current_banner, next_quote_index(quote_cycle));
    next_banner.active = false;

    auto fps_window_start = std::chrono::high_resolution_clock::now();
    int sets_sent_in_window = 0;
    int fps_print_counter = 0;

    std::cout << "Running banner demo. Press Esc to stop.\n";

    while (true)
    {
        if (_kbhit())
        {
            int ch = _getch();
            if (ch == 27)
            {
                break;
            }
        }

        display.clear_both(COLOR_BLACK);

        draw_border(display.left_buffer(), COLOR_BORDER);
        draw_border(display.right_buffer(), COLOR_BORDER);

        if (current_banner.active)
        {
            draw_text_combined_5x7(
                display.left_buffer(),
                display.right_buffer(),
                current_banner.text,
                current_banner.x,
                BANNER_Y,
                BANNER_SCALE,
                BANNER_SPACING,
                COLOR_WHITE);
        }

        if (next_banner.active)
        {
            draw_text_combined_5x7(
                display.left_buffer(),
                display.right_buffer(),
                next_banner.text,
                next_banner.x,
                BANNER_Y,
                BANNER_SCALE,
                BANNER_SPACING,
                COLOR_WHITE);
        }

        draw_logo_block(display.left_buffer(), left_x, left_y, COLOR_RED, COLOR_YELLOW);
        draw_logo_block(display.right_buffer(), right_x, right_y, COLOR_GREEN, COLOR_CYAN);

        if (!display.commit_left())
        {
            std::cout << "commit_left failed\n";
            return false;
        }

        if (!display.commit_right())
        {
            std::cout << "commit_right failed\n";
            return false;
        }

        ++sets_sent_in_window;

        left_x += left_dx;
        left_y += left_dy;
        right_x += right_dx;
        right_y += right_dy;

        current_banner.x -= BANNER_DX;

        if (next_banner.active)
        {
            next_banner.x -= BANNER_DX;
        }

        if (!next_banner.active && (current_banner.x + current_banner.width <= DISPLAY_WIDTH))
        {
            init_banner(next_banner, next_quote_index(quote_cycle));
        }

        if (current_banner.active && (current_banner.x + current_banner.width < 0))
        {
            if (next_banner.active)
            {
                current_banner = next_banner;
                next_banner.active = false;
            }
            else
            {
                init_banner(current_banner, next_quote_index(quote_cycle));
            }
        }

        if (left_x < 0)
        {
            left_x = 0;
            left_dx = -left_dx;
        }
        if (left_y < 0)
        {
            left_y = 0;
            left_dy = -left_dy;
        }
        if (left_x + LOGO_WIDTH >= DISPLAY_WIDTH)
        {
            left_x = DISPLAY_WIDTH - LOGO_WIDTH;
            left_dx = -left_dx;
        }
        if (left_y + LOGO_HEIGHT >= DISPLAY_HEIGHT)
        {
            left_y = DISPLAY_HEIGHT - LOGO_HEIGHT;
            left_dy = -left_dy;
        }

        if (right_x < 0)
        {
            right_x = 0;
            right_dx = -right_dx;
        }
        if (right_y < 0)
        {
            right_y = 0;
            right_dy = -right_dy;
        }
        if (right_x + LOGO_WIDTH >= DISPLAY_WIDTH)
        {
            right_x = DISPLAY_WIDTH - LOGO_WIDTH;
            right_dx = -right_dx;
        }
        if (right_y + LOGO_HEIGHT >= DISPLAY_HEIGHT)
        {
            right_y = DISPLAY_HEIGHT - LOGO_HEIGHT;
            right_dy = -right_dy;
        }

        auto now = std::chrono::high_resolution_clock::now();
        double window_ms = std::chrono::duration<double, std::milli>(now - fps_window_start).count();

        if (window_ms >= 1000.0)
        {
            double sets_per_sec = 1000.0 * sets_sent_in_window / window_ms;

            if ((fps_print_counter % 5) == 0)
            {
                std::cout << "sets/sec = " << sets_per_sec << "\n";
            }

            fps_print_counter++;
            fps_window_start = now;
            sets_sent_in_window = 0;
        }
    }

    display.clear_both(COLOR_BLACK);
    display.commit_left();
    display.commit_right();

    return true;
}