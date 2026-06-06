#include "GraphicHelpers.h"
#include "Maschine3UserScreen.h"

#include <cstdint>

static const int LOGO_WIDTH = 96;
static const int LOGO_HEIGHT = 56;

static const uint8_t* glyph_5x7(char c)
{
    static const uint8_t SPACE[7] = { 0,0,0,0,0,0,0 };
    static const uint8_t DASH[7] = { 0,0,0,31,0,0,0 };
    static const uint8_t DOT[7] = { 0,0,0,0,0,12,12 };
    static const uint8_t APOST[7] = { 4,4,0,0,0,0,0 };

    static const uint8_t D0[7] = { 14,17,19,21,25,17,14 };
    static const uint8_t D1[7] = { 4,12,4,4,4,4,14 };
    static const uint8_t D2[7] = { 14,17,1,2,4,8,31 };
    static const uint8_t D3[7] = { 30,1,1,14,1,1,30 };
    static const uint8_t D4[7] = { 2,6,10,18,31,2,2 };
    static const uint8_t D5[7] = { 31,16,16,30,1,1,30 };
    static const uint8_t D6[7] = { 14,16,16,30,17,17,14 };
    static const uint8_t D7[7] = { 31,1,2,4,8,8,8 };
    static const uint8_t D8[7] = { 14,17,17,14,17,17,14 };
    static const uint8_t D9[7] = { 14,17,17,15,1,1,14 };

    static const uint8_t A[7] = { 14,17,17,31,17,17,17 };
    static const uint8_t B[7] = { 30,17,17,30,17,17,30 };
    static const uint8_t C[7] = { 14,17,16,16,16,17,14 };
    static const uint8_t D[7] = { 30,17,17,17,17,17,30 };
    static const uint8_t E[7] = { 31,16,16,30,16,16,31 };
    static const uint8_t F[7] = { 31,16,16,30,16,16,16 };
    static const uint8_t G[7] = { 14,17,16,23,17,17,14 };
    static const uint8_t H[7] = { 17,17,17,31,17,17,17 };
    static const uint8_t I[7] = { 31,4,4,4,4,4,31 };
    static const uint8_t J[7] = { 1,1,1,1,17,17,14 };
    static const uint8_t K[7] = { 17,18,20,24,20,18,17 };
    static const uint8_t L[7] = { 16,16,16,16,16,16,31 };
    static const uint8_t M[7] = { 17,27,21,21,17,17,17 };
    static const uint8_t N[7] = { 17,25,21,19,17,17,17 };
    static const uint8_t O[7] = { 14,17,17,17,17,17,14 };
    static const uint8_t P[7] = { 30,17,17,30,16,16,16 };
    static const uint8_t Q[7] = { 14,17,17,17,21,18,13 };
    static const uint8_t R[7] = { 30,17,17,30,20,18,17 };
    static const uint8_t S[7] = { 15,16,16,14,1,1,30 };
    static const uint8_t T[7] = { 31,4,4,4,4,4,4 };
    static const uint8_t U[7] = { 17,17,17,17,17,17,14 };
    static const uint8_t V[7] = { 17,17,17,17,17,10,4 };
    static const uint8_t W[7] = { 17,17,17,21,21,21,10 };
    static const uint8_t X[7] = { 17,17,10,4,10,17,17 };
    static const uint8_t Y[7] = { 17,17,10,4,4,4,4 };
    static const uint8_t Z[7] = { 31,1,2,4,8,16,31 };

    if (c >= 'a' && c <= 'z')
    {
        c = static_cast<char>(c - 'a' + 'A');
    }

    switch (c)
    {
    case '0': return D0; case '1': return D1; case '2': return D2; case '3': return D3; case '4': return D4;
    case '5': return D5; case '6': return D6; case '7': return D7; case '8': return D8; case '9': return D9;

    case 'A': return A; case 'B': return B; case 'C': return C; case 'D': return D; case 'E': return E;
    case 'F': return F; case 'G': return G; case 'H': return H; case 'I': return I; case 'J': return J;
    case 'K': return K; case 'L': return L; case 'M': return M; case 'N': return N; case 'O': return O;
    case 'P': return P; case 'Q': return Q; case 'R': return R; case 'S': return S; case 'T': return T;
    case 'U': return U; case 'V': return V; case 'W': return W; case 'X': return X; case 'Y': return Y;
    case 'Z': return Z;

    case '-': return DASH;
    case '.': return DOT;
    case '\'': return APOST;
    case ' ': return SPACE;
    default: return SPACE;
    }
}

unsigned short rgb565(unsigned char r, unsigned char g, unsigned char b)
{
    return static_cast<unsigned short>(
        ((r & 0xF8) << 8) |
        ((g & 0xFC) << 3) |
        ((b & 0xF8) >> 3));
}

void put_pixel_rgb565(
    std::vector<unsigned char>& frame,
    int x,
    int y,
    unsigned short color565,
    bool swap_bytes)
{
    if (x < 0 || x >= DISPLAY_WIDTH || y < 0 || y >= DISPLAY_HEIGHT)
    {
        return;
    }

    int offset = (y * DISPLAY_WIDTH + x) * 2;

    unsigned char hi = static_cast<unsigned char>((color565 >> 8) & 0xFF);
    unsigned char lo = static_cast<unsigned char>(color565 & 0xFF);

    if (swap_bytes)
    {
        frame[offset] = lo;
        frame[offset + 1] = hi;
    }
    else
    {
        frame[offset] = hi;
        frame[offset + 1] = lo;
    }
}

void put_pixel_combined_rgb565(
    std::vector<unsigned char>& left,
    std::vector<unsigned char>& right,
    int x,
    int y,
    unsigned short color565,
    bool swap_bytes)
{
    if (x < 0 || x >= COMBINED_WIDTH || y < 0 || y >= DISPLAY_HEIGHT)
    {
        return;
    }

    if (x < DISPLAY_WIDTH)
    {
        put_pixel_rgb565(left, x, y, color565, swap_bytes);
    }
    else
    {
        put_pixel_rgb565(right, x - DISPLAY_WIDTH, y, color565, swap_bytes);
    }
}

void fill_rect_rgb565(
    std::vector<unsigned char>& frame,
    int x,
    int y,
    int w,
    int h,
    unsigned short color565,
    bool swap_bytes)
{
    for (int py = 0; py < h; ++py)
    {
        int yy = y + py;
        if (yy < 0 || yy >= DISPLAY_HEIGHT)
        {
            continue;
        }

        for (int px = 0; px < w; ++px)
        {
            int xx = x + px;
            if (xx < 0 || xx >= DISPLAY_WIDTH)
            {
                continue;
            }

            put_pixel_rgb565(frame, xx, yy, color565, swap_bytes);
        }
    }
}

void draw_border(
    std::vector<unsigned char>& frame,
    unsigned short color565,
    bool swap_bytes)
{
    fill_rect_rgb565(frame, 0, 0, DISPLAY_WIDTH, 2, color565, swap_bytes);
    fill_rect_rgb565(frame, 0, DISPLAY_HEIGHT - 2, DISPLAY_WIDTH, 2, color565, swap_bytes);
    fill_rect_rgb565(frame, 0, 0, 2, DISPLAY_HEIGHT, color565, swap_bytes);
    fill_rect_rgb565(frame, DISPLAY_WIDTH - 2, 0, 2, DISPLAY_HEIGHT, color565, swap_bytes);
}

void draw_logo_block(
    std::vector<unsigned char>& frame,
    int origin_x,
    int origin_y,
    unsigned short main_color,
    unsigned short accent_color,
    bool swap_bytes)
{
    fill_rect_rgb565(frame, origin_x, origin_y, LOGO_WIDTH, LOGO_HEIGHT, 0x0000, swap_bytes);

    fill_rect_rgb565(frame, origin_x + 8, origin_y + 8, 18, LOGO_HEIGHT - 16, main_color, swap_bytes);
    fill_rect_rgb565(frame, origin_x + 32, origin_y + 8, 18, LOGO_HEIGHT - 16, main_color, swap_bytes);

    fill_rect_rgb565(frame, origin_x + 58, origin_y + 8, 28, 12, accent_color, swap_bytes);
    fill_rect_rgb565(frame, origin_x + 58, origin_y + 24, 28, 12, accent_color, swap_bytes);
    fill_rect_rgb565(frame, origin_x + 58, origin_y + 40, 28, 8, accent_color, swap_bytes);
}

int text_width_5x7(const std::string& text, int scale, int spacing)
{
    if (text.empty())
    {
        return 0;
    }

    int glyph_w = 5 * scale;
    return static_cast<int>(text.size()) * glyph_w + (static_cast<int>(text.size()) - 1) * spacing;
}

void draw_char_combined_5x7(
    std::vector<unsigned char>& left,
    std::vector<unsigned char>& right,
    char c,
    int origin_x,
    int origin_y,
    int scale,
    int spacing,
    unsigned short color565,
    bool swap_bytes)
{
    const uint8_t* rows = glyph_5x7(c);

    for (int row = 0; row < 7; ++row)
    {
        uint8_t bits = rows[row];

        for (int col = 0; col < 5; ++col)
        {
            bool on = ((bits >> (4 - col)) & 1) != 0;

            if (!on)
            {
                continue;
            }

            int px = origin_x + col * scale;
            int py = origin_y + row * scale;

            for (int sy = 0; sy < scale; ++sy)
            {
                for (int sx = 0; sx < scale; ++sx)
                {
                    put_pixel_combined_rgb565(left, right, px + sx, py + sy, color565, swap_bytes);
                }
            }
        }
    }
}

void draw_text_combined_5x7(
    std::vector<unsigned char>& left,
    std::vector<unsigned char>& right,
    const std::string& text,
    int origin_x,
    int origin_y,
    int scale,
    int spacing,
    unsigned short color565,
    bool swap_bytes)
{
    int cursor_x = origin_x;
    int glyph_w = 5 * scale;

    for (size_t i = 0; i < text.size(); ++i)
    {
        draw_char_combined_5x7(left, right, text[i], cursor_x, origin_y, scale, spacing, color565, swap_bytes);
        cursor_x += glyph_w + spacing;
    }
}