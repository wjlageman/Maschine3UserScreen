#pragma once

#include <string>
#include <vector>
#include <windows.h>

void set_sciter_template_file(const std::wstring& path);
const std::wstring& get_sciter_template_file();
std::wstring select_template_file(HWND owner);
bool read_file_bytes(const std::wstring& path, std::vector<unsigned char>& out_bytes);
bool read_file_text_utf8(const std::wstring& path, std::string& out_text);
std::wstring get_exe_directory_for_ui();
std::wstring build_ui_file_path(const wchar_t* file_name);
bool build_runtime_template_html(const std::wstring& template_file, std::string& out_html);
