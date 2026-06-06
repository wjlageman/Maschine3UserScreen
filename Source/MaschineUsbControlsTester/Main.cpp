#include <iostream>
#include <iomanip>
#include <string>
#include <vector>
#include <set>
#include <utility>
#include <cctype>

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX

#include <windows.h>
#include <shellapi.h>
#include <libusb.h>

#include "Udp_osc_transport.h"

#include "Maschine3UserScreen.h"
#include "BannerDemo.h"
#include "SciterSession.h"

static const bool DEBUG_USB_SCAN = false;

// Forward declarations
struct DisplayPathInfo;
struct Mk3CandidateInfo;

static void print_program_header();
static void print_device_descriptor_brief(libusb_device* dev);
static bool query_display_path(libusb_device* dev, DisplayPathInfo& info);
static std::vector<Mk3CandidateInfo> find_mk3_candidates(libusb_context* ctx, bool print_scan);
static void release_candidates(std::vector<Mk3CandidateInfo>& candidates);
static bool reset_libusb_context(libusb_context*& ctx);
static void print_mk3_configuration_info(const std::vector<Mk3CandidateInfo>& candidates);
static void print_menu_no_device(bool sciter_debug_visible);
static void print_menu_with_device(bool sciter_debug_visible);
static bool qualify_mk3_candidate(const Mk3CandidateInfo& candidate, bool verbose);
static int choose_preferred_mk3_candidate(const std::vector<Mk3CandidateInfo>& candidates, bool verbose);
static bool run_banner_demo_from_candidates(const std::vector<Mk3CandidateInfo>& candidates);
static std::wstring get_exe_directory();
static void setup_sciter_dll_directory();
static bool file_exists_w(const std::wstring& path);
static std::wstring build_driver_script_directory();
static std::wstring build_script_path(const wchar_t* file_name);
static bool run_driver_script_elevated(const wchar_t* script_file_name);
static bool restart_self();
static bool get_sciter_debug_window_visible();
static void set_sciter_debug_window_visible(bool visible);
static bool has_command_line_argument(const wchar_t* argument);
static std::wstring get_template_argument();
static bool restart_self_with_template(const std::wstring& template_file);
static bool restart_self_with_argument(const wchar_t* argument);
static void wait_for_parent_process_if_requested();

static void setup_console(int width, int height);

struct DisplayPathInfo
{
    bool found;
    int interface_number;
    unsigned char endpoint_out;

    DisplayPathInfo()
        : found(false)
        , interface_number(-1)
        , endpoint_out(0)
    {
    }
};

struct Mk3CandidateInfo
{
    libusb_device* device;
    int bus_number;
    int device_address;
    DisplayPathInfo display_path;

    Mk3CandidateInfo()
        : device(nullptr)
        , bus_number(0)
        , device_address(0)
    {
    }
};

enum RestartMode
{
    RestartNone,
    RestartFresh,
    RestartTemplate,
    RestartBanner
};

static void setup_sciter_dll_directory()
{
    std::wstring dll_directory = get_exe_directory() + L"\\sciter";

    SetDllDirectoryW(dll_directory.c_str());
}

int main()
{
    wait_for_parent_process_if_requested();

    setup_sciter_dll_directory();

    //setup_console(120, 40);

    print_program_header();

    if (has_command_line_argument(L"--banner-demo"))
    {
        libusb_context* banner_ctx = nullptr;
        int banner_rc = libusb_init(&banner_ctx);

        if (banner_rc != 0)
        {
            std::cout << "libusb_init failed.\n";
            udp_osc_stop();
            return 1;
        }

        std::vector<Mk3CandidateInfo> banner_candidates = find_mk3_candidates(banner_ctx, false);
        run_banner_demo_from_candidates(banner_candidates);
        release_candidates(banner_candidates);

        libusb_exit(banner_ctx);

        restart_self();

        return 0;
    }

    set_sciter_template_file(get_template_argument());

    // Default: debug window visible during development.
    set_sciter_debug_window_visible(true);

    if (!udp_osc_start())
    {
        std::cout << "UDP/OSC start failed.\n";
    }

    libusb_context* ctx = nullptr;
    int rc = libusb_init(&ctx);

    if (rc != 0)
    {
        std::cout << "libusb_init failed.\n";
        udp_osc_stop();
        return 1;
    }

    std::vector<Mk3CandidateInfo> startup_candidates = find_mk3_candidates(ctx, DEBUG_USB_SCAN);
    if (DEBUG_USB_SCAN)
    {
        print_mk3_configuration_info(startup_candidates);
    }

    release_candidates(startup_candidates);

    bool running = true;
    RestartMode restart_mode = RestartNone;
    std::wstring restart_template_file;

    while (running)
    {
        std::vector<Mk3CandidateInfo> candidates = find_mk3_candidates(ctx, false);
        bool has_mk3 = !candidates.empty();
        bool sciter_debug_visible = get_sciter_debug_window_visible();

        if (has_mk3)
        {
            int preferred_index = choose_preferred_mk3_candidate(candidates, DEBUG_USB_SCAN);

            if (preferred_index >= 0)
            {
                if (DEBUG_USB_SCAN)
                {
                    std::cout
                        << "Starting active Maschine3 session on qualified candidate "
                        << (preferred_index + 1)
                        << "/"
                        << candidates.size()
                        << "...\n";
                }

                char session_command = run_sciter_session(candidates[preferred_index].device);

                release_candidates(candidates);

                std::cout << "Session command: " << session_command << "\n";

                if (session_command == 'L')
                {
                    restart_template_file = get_sciter_template_file();
                    restart_mode = RestartTemplate;

                    std::wcout << L"Restarting application with selected template: " << restart_template_file << std::endl;

                    running = false;
                    continue;
                }

                if (session_command == 'O')
                {
                    std::cout << "Starting NI-mode reset batch...\n";
                    fflush(stdout);

                    if (!run_driver_script_elevated(L"Reset-MaschineMK3-NIMode.cmd"))
                    {
                        std::cout << "NI-mode reset batch did not complete successfully.\n";
                    }
                    else
                    {
                        std::cout << "NI-mode reset batch finished.\n";
                    }

                    running = false;
                    continue;
                }

                if (session_command == 'U')
                {
                    std::cout << "Starting user-mode setup script...\n";
                    fflush(stdout);

                    if (!run_driver_script_elevated(L"Set-MaschineMK3-UserMode.cmd"))
                    {
                        std::cout << "User-mode setup script did not complete successfully.\n";
                    }
                    else
                    {
                        std::cout << "User-mode setup script finished.\n";
                        restart_mode = RestartFresh;
                    }

                    running = false;
                    continue;
                }

                if (session_command == 'R')
                {
                    std::cout << "Restarting application for a fresh Maschine3 session.\n\n";
                    restart_mode = RestartFresh;
                    running = false;
                    continue;
                }

                if (session_command == 'B')
                {
                    restart_mode = RestartBanner;
                    running = false;
                    continue;
                }

                //std::cout << "Quitting.\n";
                running = false;
                continue;
            }
        }

        if (has_mk3)
        {
            std::cout << "Maschine MK3 is visible, but no candidate can be claimed for a session.\n";
            print_menu_with_device(sciter_debug_visible);
        }
        else
        {
            print_menu_no_device(sciter_debug_visible);
        }

        std::string choice;
        std::getline(std::cin, choice);

        char command = '\0';
        if (!choice.empty())
        {
            command = static_cast<char>(std::toupper(static_cast<unsigned char>(choice[0])));
        }

        if (command == 'U')
        {
            std::cout << "Starting user-mode setup script...\n";

            if (!run_driver_script_elevated(L"Set-MaschineMK3-UserMode.cmd"))
            {
                std::cout << "User-mode setup script did not complete successfully.\n";
            }
            else
            {
                std::cout << "User-mode setup script finished.\n";
                restart_mode = RestartFresh;
            }

            running = false;
        }
        else if (command == 'N' && has_mk3)
        {
            std::cout << "Starting NI-mode reset batch...\n";

            if (!run_driver_script_elevated(L"Reset-MaschineMK3-NIMode.cmd"))
            {
                std::cout << "NI-mode reset batch did not complete successfully.\n";
            }
            else
            {
                std::cout << "NI-mode reset batch finished.\n";
            }

            running = false;
        }
        else if (command == 'R' && has_mk3)
        {
            std::cout << "Restarting application for a fresh Maschine3 session.\n";
            restart_mode = RestartFresh;
            running = false;
        }
        else if (command == 'D' && has_mk3)
        {
            if (!run_banner_demo_from_candidates(candidates))
            {
                std::cout << "Banner demo could not be started because no candidate passed the deterministic open-and-claim test.\n";
            }
        }
        else if (command == 'S')
        {
            std::cout << "Rescanning for Maschine MK3...\n";
        }
        else if (command == 'W')
        {
            bool visible = !sciter_debug_visible;
            set_sciter_debug_window_visible(visible);
            std::cout << "Sciter debug window is now " << (visible ? "visible" : "hidden") << ".\n";
        }
        else if (command == 'Q')
        {
            std::cout << "Quitting.\n";
            running = false;
        }
        else
        {
            std::cout << "Unknown choice.\n";
        }

        release_candidates(candidates);
    }

    udp_osc_stop();

    if (ctx != nullptr)
    {
        libusb_exit(ctx);
        ctx = nullptr;
    }

    if (restart_mode == RestartBanner)
    {
        restart_self_with_argument(L"--banner-demo");
        return 0;
    }

    if (restart_mode == RestartTemplate)
    {
        restart_self_with_template(restart_template_file);
        return 0;
    }

    if (restart_mode == RestartFresh)
    {
        restart_self();
        return 0;
    }

    return 0;
}

static bool restart_self()
{
    wchar_t exe_path[MAX_PATH] = {};
    DWORD len = GetModuleFileNameW(nullptr, exe_path, MAX_PATH);
    STARTUPINFOW si = {};
    PROCESS_INFORMATION pi = {};
    std::wstring command_line;

    if (len == 0 || len >= MAX_PATH)
    {
        std::cout << "restart_self: GetModuleFileNameW failed.\n";
        return false;
    }

    command_line = L"\"";
    command_line += exe_path;
    command_line += L"\"";
    command_line += L" --wait-parent ";
    command_line += std::to_wstring(GetCurrentProcessId());

    si.cb = sizeof(si);

    BOOL ok = CreateProcessW(
        nullptr,
        const_cast<wchar_t*>(command_line.data()),
        nullptr,
        nullptr,
        FALSE,
        0,
        nullptr,
        nullptr,
        &si,
        &pi);

    if (!ok)
    {
        std::cout << "restart_self: CreateProcessW failed.\n";
        return false;
    }

    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);

    return true;
}

static void print_program_header()
{
    std::cout << "\x1b[32m";
    std::cout << "\nMaschine3 User Screen\n";
    std::cout << "=====================\n\n";
    std::cout << "Windows-only developer tool for Native Instruments Maschine MK3 displays\n";
    std::cout << "PID: " << GetCurrentProcessId() << "\n";
    std::cout << "\x1b[0m";
    std::cout << "\n";
}

static void print_device_descriptor_brief(libusb_device* dev)
{
    libusb_device_descriptor desc = {};
    int rc = libusb_get_device_descriptor(dev, &desc);

    if (rc != 0)
    {
        std::cout << "  libusb_get_device_descriptor failed\n";
        return;
    }

    uint8_t bus_number = libusb_get_bus_number(dev);
    uint8_t device_address = libusb_get_device_address(dev);

    std::cout
        << "  Bus " << static_cast<int>(bus_number)
        << " Device " << static_cast<int>(device_address)
        << "  VID:PID = "
        << std::hex << std::setw(4) << std::setfill('0') << desc.idVendor
        << ":"
        << std::hex << std::setw(4) << std::setfill('0') << desc.idProduct
        << std::dec
        << "\n";
}

static bool query_display_path(libusb_device* dev, DisplayPathInfo& info)
{
    info = DisplayPathInfo();

    libusb_config_descriptor* cfg = nullptr;
    int rc = libusb_get_active_config_descriptor(dev, &cfg);

    if (rc != 0 || cfg == nullptr)
    {
        return false;
    }

    bool found = false;

    for (uint8_t i = 0; i < cfg->bNumInterfaces && !found; ++i)
    {
        const libusb_interface& iface = cfg->interface[i];

        for (int alt_index = 0; alt_index < iface.num_altsetting && !found; ++alt_index)
        {
            const libusb_interface_descriptor& alt = iface.altsetting[alt_index];

            if (alt.bInterfaceNumber != INTERFACE_NUMBER)
            {
                continue;
            }

            for (uint8_t ep_index = 0; ep_index < alt.bNumEndpoints; ++ep_index)
            {
                const libusb_endpoint_descriptor& ep = alt.endpoint[ep_index];

                if (ep.bEndpointAddress == EP_OUT)
                {
                    info.found = true;
                    info.interface_number = static_cast<int>(alt.bInterfaceNumber);
                    info.endpoint_out = ep.bEndpointAddress;
                    found = true;
                    break;
                }
            }
        }
    }

    libusb_free_config_descriptor(cfg);
    return found;
}

static std::vector<Mk3CandidateInfo> find_mk3_candidates(libusb_context* ctx, bool print_scan)
{
    std::vector<Mk3CandidateInfo> result;

    libusb_device** list = nullptr;
    ssize_t count = libusb_get_device_list(ctx, &list);

    if (count < 0)
    {
        std::cout << "libusb_get_device_list failed.\n";
        return result;
    }

    if (print_scan)
    {
        std::cout << "Scanning USB devices for Native Instruments hardware...\n";
    }

    std::set<std::pair<int, int> > printed_bus_addr;

    for (ssize_t i = 0; i < count; ++i)
    {
        libusb_device* dev = list[i];
        libusb_device_descriptor desc = {};

        int rc = libusb_get_device_descriptor(dev, &desc);
        if (rc != 0)
        {
            continue;
        }

        if (desc.idVendor != 0x17CC)
        {
            continue;
        }

        int bus = static_cast<int>(libusb_get_bus_number(dev));
        int addr = static_cast<int>(libusb_get_device_address(dev));

        if (print_scan && printed_bus_addr.insert(std::make_pair(bus, addr)).second)
        {
            print_device_descriptor_brief(dev);
        }

        if (desc.idProduct != 0x1600)
        {
            continue;
        }

        DisplayPathInfo display_path;
        if (!query_display_path(dev, display_path))
        {
            continue;
        }

        Mk3CandidateInfo candidate;
        candidate.device = libusb_ref_device(dev);
        candidate.bus_number = bus;
        candidate.device_address = addr;
        candidate.display_path = display_path;

        result.push_back(candidate);
    }

    libusb_free_device_list(list, 1);
    return result;
}

static void release_candidates(std::vector<Mk3CandidateInfo>& candidates)
{
    for (size_t i = 0; i < candidates.size(); ++i)
    {
        if (candidates[i].device != nullptr)
        {
            libusb_unref_device(candidates[i].device);
            candidates[i].device = nullptr;
        }
    }

    candidates.clear();
}

static bool reset_libusb_context(libusb_context*& ctx)
{
    std::cout << "Resetting libusb context after running Session...\n";

    if (ctx != nullptr)
    {
        libusb_exit(ctx);
        ctx = nullptr;
        std::cout << "libusb_exit complete.\n";
    }

    int rc = libusb_init(&ctx);

    if (rc != 0)
    {
        ctx = nullptr;
        std::cout << "libusb_init failed after reset.\n";
        return false;
    }

    std::cout << "libusb_init complete.\n";

    return true;
}

static void print_mk3_configuration_info(const std::vector<Mk3CandidateInfo>& candidates)
{
    if (candidates.empty())
    {
        std::cout << "Maschine MK3 status: not found\n";
        return;
    }

    libusb_device_descriptor desc = {};
    int rc = libusb_get_device_descriptor(candidates[0].device, &desc);

    std::cout << "Maschine MK3 status: found\n";

    if (rc == 0)
    {
        std::cout << "  Vendor ID      : 0x"
            << std::hex << std::setw(4) << std::setfill('0') << desc.idVendor
            << std::dec << "\n";
        std::cout << "  Product ID     : 0x"
            << std::hex << std::setw(4) << std::setfill('0') << desc.idProduct
            << std::dec << "\n";
    }

    std::cout << "  Bus            : " << candidates[0].bus_number << "\n";
    std::cout << "  Device address : " << candidates[0].device_address << "\n";
    std::cout << "  Display iface  : " << candidates[0].display_path.interface_number << "\n";
    std::cout << "  Display EP out : 0x"
        << std::hex << std::setw(2) << std::setfill('0')
        << static_cast<int>(candidates[0].display_path.endpoint_out)
        << std::dec << "\n";
    std::cout << "  Matching MK3 candidates: " << candidates.size() << "\n";
}

static void print_menu_no_device(bool sciter_debug_visible)
{
    std::cout << "\n";
    std::cout << "Menu\n";
    std::cout << "  U. Set driver for user access and restart\n";
    std::cout << "  S. Rescan after starting Maschine MK3\n";
    //std::cout << "  W. Toggle Sciter debug window (" << (sciter_debug_visible ? "visible" : "hidden") << ")\n";
    std::cout << "  Q. Quit\n";
    std::cout << "Choice: ";
}

static void print_menu_with_device(bool sciter_debug_visible)
{
    std::cout << "\n";
    std::cout << "Menu\n";
    std::cout << "  U. Set driver for user access and restart\n";
    std::cout << "  R. Close other instance and restart\n";
    std::cout << "  D. Show Banner Demo\n";
    //std::cout << "  S. Rescan / start session if possible\n";
    //std::cout << "  W. Toggle Sciter debug window (" << (sciter_debug_visible ? "visible" : "hidden") << ")\n";
    std::cout << "  Q. Quit\n";
    std::cout << "Choice: ";
}

static bool qualify_mk3_candidate(const Mk3CandidateInfo& candidate, bool verbose)
{
    libusb_device_handle* handle = nullptr;
    int rc = libusb_open(candidate.device, &handle);

    if (rc != 0 || handle == nullptr)
    {
        if (verbose)
        {
            std::cout
                << "Candidate bus "
                << candidate.bus_number
                << " device "
                << candidate.device_address
                << " is visible in USB descriptors but cannot be opened by libusb on this Windows/libusb route.\n";
        }

        return false;
    }

    // This call is optional on the working route. On this setup it may report
    // that auto-detach is unavailable even though normal direct access works.
    libusb_set_auto_detach_kernel_driver(handle, 1);

    rc = libusb_claim_interface(handle, candidate.display_path.interface_number);

    if (rc != 0)
    {
        if (verbose)
        {
            std::cout
                << "Candidate bus "
                << candidate.bus_number
                << " device "
                << candidate.device_address
                << " opens, but display interface "
                << candidate.display_path.interface_number
                << " cannot be claimed for direct user access.\n";
        }

        libusb_close(handle);
        return false;
    }

    libusb_release_interface(handle, candidate.display_path.interface_number);
    libusb_close(handle);

    if (verbose)
    {
        std::cout
            << "Candidate bus "
            << candidate.bus_number
            << " device "
            << candidate.device_address
            << " passes deterministic open-and-claim qualification.\n";
    }

    return true;
}

static int choose_preferred_mk3_candidate(const std::vector<Mk3CandidateInfo>& candidates, bool verbose)
{
    // Windows/libusb can expose more than one libusb-visible candidate for the
    // same physical Maschine MK3. The USB descriptors can look identical, so a
    // descriptor match alone is not enough. We therefore choose the first
    // candidate that deterministically passes open + claim on the display
    // interface, and only then start the demo on that route.
    for (size_t i = 0; i < candidates.size(); ++i)
    {
        if (verbose)
        {
            std::cout
                << "Qualifying candidate "
                << (i + 1)
                << "/"
                << candidates.size()
                << " (bus "
                << candidates[i].bus_number
                << ", device "
                << candidates[i].device_address
                << ", iface "
                << candidates[i].display_path.interface_number
                << ", ep 0x"
                << std::hex
                << std::setw(2)
                << std::setfill('0')
                << static_cast<int>(candidates[i].display_path.endpoint_out)
                << std::dec
                << ")...\n";
        }

        if (qualify_mk3_candidate(candidates[i], verbose))
        {
            return static_cast<int>(i);
        }
    }

    return -1;
}

static bool run_banner_demo_from_candidates(const std::vector<Mk3CandidateInfo>& candidates)
{
    if (candidates.empty())
    {
        std::cout << "No Maschine MK3 found.\n";
        return false;
    }

    int preferred_index = choose_preferred_mk3_candidate(candidates, DEBUG_USB_SCAN);

    if (preferred_index < 0)
    {
        return false;
    }

    if (DEBUG_USB_SCAN)
    {
        std::cout
            << "Starting banner demo on qualified candidate "
            << (preferred_index + 1)
            << "/"
            << candidates.size()
            << "...\n";
    }

    if (run_banner_demo(candidates[preferred_index].device))
    {
        if (DEBUG_USB_SCAN)
        {
            std::cout << "Banner demo ended.\n";
        }
        return true;
    }

    if (DEBUG_USB_SCAN)
    {
        std::cout << "Qualified candidate was selected, but the banner demo still failed after qualification.\n";
    }
    return false;
}

static std::wstring get_exe_directory()
{
    wchar_t buffer[MAX_PATH] = {};
    DWORD length = GetModuleFileNameW(nullptr, buffer, MAX_PATH);

    if (length == 0 || length >= MAX_PATH)
    {
        return L"";
    }

    std::wstring full_path(buffer);
    size_t slash_pos = full_path.find_last_of(L"\\/");

    if (slash_pos == std::wstring::npos)
    {
        return L"";
    }

    return full_path.substr(0, slash_pos);
}

static bool file_exists_w(const std::wstring& path)
{
    DWORD attrs = GetFileAttributesW(path.c_str());
    return (attrs != INVALID_FILE_ATTRIBUTES) && ((attrs & FILE_ATTRIBUTE_DIRECTORY) == 0);
}

static std::wstring build_driver_script_directory()
{
    std::wstring dir = get_exe_directory();

    if (dir.empty())
    {
        return L"";
    }

    return dir + L"\\Maschine3Drivers";
}

static std::wstring build_script_path(const wchar_t* file_name)
{
    std::wstring dir = build_driver_script_directory();

    if (dir.empty())
    {
        return L"";
    }

    std::wstring result = dir;
    result += L"\\";
    result += file_name;
    return result;
}

static bool run_driver_script_elevated(const wchar_t* script_file_name)
{
    std::wstring script_path = build_script_path(script_file_name);
    std::wstring script_dir = build_driver_script_directory();

    if (script_path.empty())
    {
        std::cout << "[ERROR] Could not resolve executable directory for driver batch.\n";
        return false;
    }

    if (!file_exists_w(script_path))
    {
        std::wcout << L"[ERROR] Driver batch not found: " << script_path << L"\n";
        return false;
    }

    std::wstring parameters = L"/c \"\"";
    parameters += script_path;
    parameters += L"\"\"";

    SHELLEXECUTEINFOW sei = {};
    sei.cbSize = sizeof(sei);
    sei.fMask = SEE_MASK_NOCLOSEPROCESS;
    sei.hwnd = nullptr;
    sei.lpVerb = L"runas";
    sei.lpFile = L"cmd.exe";
    sei.lpParameters = parameters.c_str();
    sei.lpDirectory = script_dir.empty() ? nullptr : script_dir.c_str();
    sei.nShow = SW_SHOWNORMAL;

    std::wcout << L"Running driver batch: " << script_path << L"\n";

    if (!ShellExecuteExW(&sei))
    {
        DWORD err = GetLastError();

        if (err == ERROR_CANCELLED)
        {
            std::cout << "[ERROR] The user cancelled the administrator prompt.\n";
        }
        else
        {
            std::cout << "[ERROR] Could not start driver batch with administrator rights. GetLastError=" << err << "\n";
            std::wcout << L"[ERROR] Command: cmd.exe " << parameters << L"\n";
        }

        return false;
    }

    if (sei.hProcess == nullptr)
    {
        std::cout << "[ERROR] Driver batch process handle was not returned.\n";
        return false;
    }

    WaitForSingleObject(sei.hProcess, INFINITE);

    DWORD exit_code = 1;
    if (!GetExitCodeProcess(sei.hProcess, &exit_code))
    {
        DWORD err = GetLastError();
        CloseHandle(sei.hProcess);
        std::cout << "[ERROR] Could not read the driver batch exit code. GetLastError=" << err << "\n";
        return false;
    }

    CloseHandle(sei.hProcess);

    if (exit_code != 0)
    {
        std::cout << "[ERROR] Driver batch failed. Exit code=" << exit_code << "\n";
        std::wcout << L"[ERROR] Batch: " << script_path << L"\n";
        return false;
    }

    return true;
}

static bool get_sciter_debug_window_visible()
{
    wchar_t buffer[16] = {};
    DWORD len = GetEnvironmentVariableW(L"MASCHINE_SCITER_DEBUG_WINDOW", buffer, 16);

    if (len == 0)
    {
        return false;
    }

    return buffer[0] == L'1';
}

static void set_sciter_debug_window_visible(bool visible)
{
    SetEnvironmentVariableW(L"MASCHINE_SCITER_DEBUG_WINDOW", visible ? L"1" : L"0");
}


static void wait_for_parent_process_if_requested()
{
    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    DWORD parent_pid = 0;
    int i;

    if (argv == nullptr)
    {
        return;
    }

    for (i = 1; i < argc - 1; ++i)
    {
        if (_wcsicmp(argv[i], L"--wait-parent") == 0)
        {
            parent_pid = static_cast<DWORD>(_wtoi(argv[i + 1]));
            break;
        }
    }

    LocalFree(argv);

    if (parent_pid == 0)
    {
        return;
    }

    HANDLE parent = OpenProcess(SYNCHRONIZE, FALSE, parent_pid);

    if (parent == nullptr)
    {
        return;
    }

    WaitForSingleObject(parent, INFINITE);
    CloseHandle(parent);
}

static bool has_command_line_argument(const wchar_t* argument)
{
    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    bool result = false;
    int i;

    if (argv != nullptr)
    {
        for (i = 1; i < argc; ++i)
        {
            if (_wcsicmp(argv[i], argument) == 0)
            {
                result = true;
                break;
            }
        }

        LocalFree(argv);
    }

    return result;
}

static std::wstring get_template_argument()
{
    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    std::wstring result;
    int i;

    if (argv != nullptr)
    {
        for (i = 1; i < argc; ++i)
        {
            if (argv[i] == nullptr)
            {
                continue;
            }

            if (_wcsicmp(argv[i], L"--wait-parent") == 0)
            {
                ++i;
                continue;
            }

            if (wcsncmp(argv[i], L"--", 2) == 0)
            {
                continue;
            }

            result = argv[i];
            break;
        }

        LocalFree(argv);
    }

    return result;
}

static std::wstring quote_command_line_arg(const std::wstring& text)
{
    return L"\"" + text + L"\"";
}

static bool restart_self_with_argument(const wchar_t* argument)
{
    wchar_t exe_path[MAX_PATH] = L"";
    STARTUPINFOW si = {};
    PROCESS_INFORMATION pi = {};
    std::wstring command_line;

    if (GetModuleFileNameW(nullptr, exe_path, MAX_PATH) == 0)
    {
        std::cout << "restart_self_with_argument: GetModuleFileNameW failed.\n";
        return false;
    }

    command_line = L"\"";
    command_line += exe_path;
    command_line += L"\"";

    if (argument != nullptr && argument[0] != L'\0')
    {
        command_line += L" ";
        command_line += argument;
    }

    command_line += L" --wait-parent ";
    command_line += std::to_wstring(GetCurrentProcessId());

    si.cb = sizeof(si);

    BOOL ok = CreateProcessW(
        nullptr,
        const_cast<wchar_t*>(command_line.data()),
        nullptr,
        nullptr,
        FALSE,
        0,
        nullptr,
        nullptr,
        &si,
        &pi
    );

    if (!ok)
    {
        std::cout << "restart_self_with_argument: CreateProcessW failed.\n";
        return false;
    }

    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);

    return true;
}


static bool restart_self_with_template(const std::wstring& template_file)
{
    wchar_t exe_path[MAX_PATH] = L"";
    STARTUPINFOW si = {};
    PROCESS_INFORMATION pi = {};
    std::wstring command_line;

    if (GetModuleFileNameW(nullptr, exe_path, MAX_PATH) == 0)
    {
        std::cout << "restart_self_with_template: GetModuleFileNameW failed.\n";
        return false;
    }

    command_line = L"\"";
    command_line += exe_path;
    command_line += L"\"";

    if (!template_file.empty())
    {
        command_line += L" ";
        command_line += L"\"";
        command_line += template_file;
        command_line += L"\"";
    }

    command_line += L" --wait-parent ";
    command_line += std::to_wstring(GetCurrentProcessId());

    si.cb = sizeof(si);

    BOOL ok = CreateProcessW(
        nullptr,
        const_cast<wchar_t*>(command_line.data()),
        nullptr,
        nullptr,
        FALSE,
        0,
        nullptr,
        nullptr,
        &si,
        &pi
    );

    if (!ok)
    {
        std::cout << "restart_self_with_template: CreateProcessW failed.\n";
        return false;
    }

    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);

    return true;
}


static void setup_console(int width, int height)
{
    HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);

    COORD bufferSize;
    SMALL_RECT windowSize;

    bufferSize.X = (SHORT)width;
    bufferSize.Y = 30000;

    SetConsoleScreenBufferSize(hOut, bufferSize);

    windowSize.Left = 0;
    windowSize.Top = 0;
    windowSize.Right = (SHORT)(width - 1);
    windowSize.Bottom = (SHORT)(height - 1);

    SetConsoleWindowInfo(hOut, TRUE, &windowSize);
}
