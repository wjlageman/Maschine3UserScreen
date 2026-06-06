#include "SciterTemplate.h"
#include "SciterSession.h"

#include <commdlg.h>
#include <cstring>
#include <fstream>
#include <iostream>

#pragma comment(lib, "Comdlg32.lib")

static std::wstring g_current_template_file;
static HHOOK g_template_file_dialog_cbt_hook = nullptr;
static bool g_template_file_dialog_positioned = false;

void set_sciter_template_file(const std::wstring& path)
{
    g_current_template_file = path;
}

const std::wstring& get_sciter_template_file()
{
    return g_current_template_file;
}

static LRESULT CALLBACK template_file_dialog_cbt_proc(
    int code,
    WPARAM wparam,
    LPARAM lparam)
{
    if (code == HCBT_ACTIVATE && !g_template_file_dialog_positioned)
    {
        HWND hwnd = reinterpret_cast<HWND>(wparam);

        if (hwnd != nullptr)
        {
            g_template_file_dialog_positioned = true;

            SetWindowPos(
                hwnd,
                nullptr,
                100,
                100,
                1400,
                900,
                SWP_NOZORDER
            );
        }
    }

    return CallNextHookEx(g_template_file_dialog_cbt_hook, code, wparam, lparam);
}

std::wstring select_template_file(HWND owner)
{
    wchar_t file_name[MAX_PATH] = L"";

    OPENFILENAMEW ofn = {};

    ofn.lStructSize = sizeof(ofn);
    ofn.hwndOwner = owner;
    ofn.lpstrFile = file_name;
    ofn.nMaxFile = MAX_PATH;
    ofn.lpstrFilter =
        L"Maschine3 screen definition files (*.htm;*.html;*.m3)\0*.htm;*.html;*.m3\0"
        L"HTML files (*.htm;*.html)\0*.htm;*.html\0"
        L"Maschine3 files (*.m3)\0*.m3\0"
        L"All files (*.*)\0*.*\0";
    ofn.nFilterIndex = 1;
    ofn.Flags = OFN_PATHMUSTEXIST | OFN_FILEMUSTEXIST | OFN_HIDEREADONLY | OFN_EXPLORER | OFN_ENABLESIZING;

    g_template_file_dialog_positioned = false;
    g_template_file_dialog_cbt_hook = SetWindowsHookExW(
        WH_CBT,
        template_file_dialog_cbt_proc,
        nullptr,
        GetCurrentThreadId()
    );

    BOOL ok = GetOpenFileNameW(&ofn);

    if (g_template_file_dialog_cbt_hook != nullptr)
    {
        UnhookWindowsHookEx(g_template_file_dialog_cbt_hook);
        g_template_file_dialog_cbt_hook = nullptr;
    }

    if (ok)
    {
        return std::wstring(file_name);
    }

    return L"";
}

bool read_file_bytes(const std::wstring& path, std::vector<unsigned char>& out_bytes)
{
    std::ifstream in(path.c_str(), std::ios::binary);

    out_bytes.clear();

    if (!in)
    {
        return false;
    }

    in.seekg(0, std::ios::end);
    std::streamoff file_size = in.tellg();

    if (file_size < 0)
    {
        return false;
    }

    in.seekg(0, std::ios::beg);
    out_bytes.resize(static_cast<size_t>(file_size));

    if (!out_bytes.empty())
    {
        in.read(reinterpret_cast<char*>(&out_bytes[0]), file_size);
    }

    return true;
}

std::wstring get_exe_directory_for_ui()
{
    wchar_t exe_path[MAX_PATH] = L"";
    std::wstring path;
    size_t pos;

    if (GetModuleFileNameW(nullptr, exe_path, MAX_PATH) == 0)
    {
        return L"";
    }

    path = exe_path;
    pos = path.find_last_of(L"\\/");

    if (pos == std::wstring::npos)
    {
        return L"";
    }

    return path.substr(0, pos);
}

std::wstring build_ui_file_path(const wchar_t* file_name)
{
    std::wstring dir = get_exe_directory_for_ui();

    if (dir.empty())
    {
        return L"";
    }

    return dir + L"\\ui\\" + file_name;
}

bool read_file_text_utf8(const std::wstring& path, std::string& out_text)
{
    std::vector<unsigned char> bytes;

    out_text.clear();

    if (!read_file_bytes(path, bytes))
    {
        return false;
    }

    if (!bytes.empty())
    {
        out_text.assign(reinterpret_cast<const char*>(&bytes[0]), bytes.size());
    }

    return true;
}

static bool ascii_equal_ci(char a, char b)
{
    if (a >= 'A' && a <= 'Z')
    {
        a = static_cast<char>(a - 'A' + 'a');
    }

    if (b >= 'A' && b <= 'Z')
    {
        b = static_cast<char>(b - 'A' + 'a');
    }

    return a == b;
}

static size_t find_ascii_ci(const std::string& text, const char* needle)
{
    size_t i;
    size_t j;
    size_t needle_len = strlen(needle);

    if (needle_len == 0 || text.size() < needle_len)
    {
        return std::string::npos;
    }

    for (i = 0; i <= text.size() - needle_len; ++i)
    {
        for (j = 0; j < needle_len; ++j)
        {
            if (!ascii_equal_ci(text[i + j], needle[j]))
            {
                break;
            }
        }

        if (j == needle_len)
        {
            return i;
        }
    }

    return std::string::npos;
}


static std::string wide_to_utf8(const std::wstring& text)
{
    int length;
    std::string result;

    if (text.empty())
    {
        return "";
    }

    length = WideCharToMultiByte(
        CP_UTF8,
        0,
        text.c_str(),
        -1,
        nullptr,
        0,
        nullptr,
        nullptr
    );

    if (length <= 1)
    {
        return "";
    }

    result.resize(static_cast<size_t>(length - 1));

    WideCharToMultiByte(
        CP_UTF8,
        0,
        text.c_str(),
        -1,
        &result[0],
        length,
        nullptr,
        nullptr
    );

    return result;
}

static std::string json_escape_string(const std::string& text)
{
    std::string out;
    size_t i;
    char c;

    out.push_back('"');

    for (i = 0; i < text.size(); ++i)
    {
        c = text[i];

        if (c == '\\' || c == '"')
        {
            out.push_back('\\');
            out.push_back(c);
        }
        else if (c == '\n')
        {
            out += "\\n";
        }
        else if (c == '\r')
        {
            out += "\\r";
        }
        else
        {
            out.push_back(c);
        }
    }

    out.push_back('"');

    return out;
}

static std::string build_screen_definition_script(const std::wstring& screen_definition_file)
{
    std::string filename = wide_to_utf8(screen_definition_file);
    size_t i;

    for (i = 0; i < filename.size(); ++i)
    {
        if (filename[i] == '\\')
        {
            filename[i] = '/';
        }
    }

    return
        "<script>\n"
        "window.__screen_definition_file = " +
        json_escape_string(filename) +
        ";\n"
        "</script>\n";
}


bool build_runtime_template_html(const std::wstring& template_file, std::string& out_html)
{
    std::wstring source_template_file = template_file;
    std::wstring includes_file = build_ui_file_path(L"includes.htm");
    std::string template_html;
    std::string includes_html;
    size_t head_close;

    out_html.clear();

    if (source_template_file.empty())
    {
        source_template_file = build_ui_file_path(UI_PAGE);
    }

    if (source_template_file.empty())
    {
        std::cout << "Screen definition file path could not be resolved.\n";
        return false;
    }

    if (!read_file_text_utf8(source_template_file, template_html))
    {
        std::wcout << L"Screen definition file could not be read: " << source_template_file << std::endl;
        return false;
    }

    if (!read_file_text_utf8(includes_file, includes_html))
    {
        std::wcout << L"Includes file could not be read: " << includes_file << std::endl;
        return false;
    }

    head_close = find_ascii_ci(template_html, "</head>");

    if (head_close == std::string::npos)
    {
        std::wcout << L"Screen definition file has no </head>: " << source_template_file << std::endl;
        return false;
    }

    out_html.reserve(template_html.size() + includes_html.size() + 512);
    out_html.append(template_html, 0, head_close);
    out_html.append("\n");
    out_html.append(build_screen_definition_script(source_template_file));
    out_html.append(includes_html);
    out_html.append("\n");
    out_html.append(template_html, head_close, std::string::npos);

    return true;
}
