#include "udp_osc_transport.h"

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <winsock2.h>
#include <ws2tcpip.h>

#include <algorithm>
#include <atomic>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <queue>
#include <sstream>
#include <thread>
#include <vector>

#pragma comment(lib, "ws2_32.lib")

namespace
{
    static const bool DEBUG_UDP_OSC = false;
    // --- DEBUG counters (temporary)
    static int g_debug_counter_rx = 0;
    static int g_debug_counter_tx = 0;

    static bool read_padded_osc_string(const unsigned char* data, int size, int& offset, std::string& out_value, std::string& out_error)
    {
        if (offset < 0 || offset >= size)
        {
            out_error = "string offset out of range";
            return false;
        }

        int start = offset;
        int end = start;

        while (end < size && data[end] != 0)
        {
            ++end;
        }

        if (end >= size)
        {
            out_error = "unterminated OSC string";
            return false;
        }

        out_value.assign(reinterpret_cast<const char*>(data + start), end - start);
        ++end;

        while ((end & 3) != 0)
        {
            if (end >= size)
            {
                out_error = "OSC string padding out of range";
                return false;
            }

            ++end;
        }

        offset = end;
        return true;
    }

    static bool read_be_int32(const unsigned char* data, int size, int& offset, int32_t& out_value, std::string& out_error)
    {
        if (offset < 0 || (offset + 4) > size)
        {
            out_error = "int32 read out of range";
            return false;
        }

        out_value =
            (static_cast<int32_t>(data[offset + 0]) << 24) |
            (static_cast<int32_t>(data[offset + 1]) << 16) |
            (static_cast<int32_t>(data[offset + 2]) << 8) |
            static_cast<int32_t>(data[offset + 3]);

        offset += 4;
        return true;
    }

    static bool read_be_float32(const unsigned char* data, int size, int& offset, float& out_value, std::string& out_error)
    {
        int32_t raw = 0;

        if (!read_be_int32(data, size, offset, raw, out_error))
        {
            return false;
        }

        static_assert(sizeof(float) == sizeof(int32_t), "float must be 32-bit");
        std::memcpy(&out_value, &raw, 4);
        return true;
    }

    static bool read_blob(const unsigned char* data, int size, int& offset, std::vector<unsigned char>& out_blob, std::string& out_error)
    {
        int32_t blob_size = 0;

        if (!read_be_int32(data, size, offset, blob_size, out_error))
        {
            return false;
        }

        if (blob_size < 0)
        {
            out_error = "negative OSC blob size";
            return false;
        }

        if (offset < 0 || (offset + blob_size) > size)
        {
            out_error = "OSC blob data out of range";
            return false;
        }

        out_blob.assign(data + offset, data + offset + blob_size);
        offset += blob_size;

        while ((offset & 3) != 0)
        {
            if (offset >= size)
            {
                out_error = "OSC blob padding out of range";
                return false;
            }

            ++offset;
        }

        return true;
    }

    static void split_address(const std::string& address, std::vector<std::string>& out_parts)
    {
        out_parts.clear();

        std::string current;
        size_t i;

        for (i = 0; i < address.size(); ++i)
        {
            char ch = address[i];

            if (ch == '/')
            {
                if (!current.empty())
                {
                    out_parts.push_back(current);
                    current.clear();
                }
            }
            else
            {
                current += ch;
            }
        }

        if (!current.empty())
        {
            out_parts.push_back(current);
        }
    }

    static std::string atom_to_string(const UdpOscAtom& atom)
    {
        std::ostringstream stream;

        if (atom.type == UDP_OSC_ATOM_INT32)
        {
            stream << atom.int_value;
            return stream.str();
        }

        if (atom.type == UDP_OSC_ATOM_FLOAT32)
        {
            stream << atom.float_value;
            return stream.str();
        }

        if (atom.type == UDP_OSC_ATOM_STRING)
        {
            stream << '"' << atom.string_value << '"';
            return stream.str();
        }

        if (atom.type == UDP_OSC_ATOM_BLOB)
        {
            stream << "<blob " << atom.blob_value.size() << " bytes>";
            return stream.str();
        }

        if (atom.type == UDP_OSC_ATOM_TRUE)
        {
            return "true";
        }

        if (atom.type == UDP_OSC_ATOM_FALSE)
        {
            return "false";
        }

        if (atom.type == UDP_OSC_ATOM_NIL)
        {
            return "nil";
        }

        return "impulse";
    }

    static std::string json_escape(const std::string& value)
    {
        std::string out;
        size_t i;

        for (i = 0; i < value.size(); ++i)
        {
            unsigned char ch = static_cast<unsigned char>(value[i]);

            if (ch == '"')
            {
                out += "\\\"";
            }
            else if (ch == '\\')
            {
                out += "\\\\";
            }
            else if (ch == '\b')
            {
                out += "\\b";
            }
            else if (ch == '\f')
            {
                out += "\\f";
            }
            else if (ch == '\n')
            {
                out += "\\n";
            }
            else if (ch == '\r')
            {
                out += "\\r";
            }
            else if (ch == '\t')
            {
                out += "\\t";
            }
            else if (ch < 0x20)
            {
                char buf[7] = {};
                std::snprintf(buf, sizeof(buf), "\\u%04x", static_cast<unsigned int>(ch));
                out += buf;
            }
            else
            {
                out += static_cast<char>(ch);
            }
        }

        return out;
    }

    static void write_padded_osc_string(std::vector<unsigned char>& out, const std::string& text)
    {
        size_t i;

        for (i = 0; i < text.size(); ++i)
        {
            out.push_back(static_cast<unsigned char>(text[i]));
        }

        out.push_back(0);

        while ((out.size() & 3) != 0)
        {
            out.push_back(0);
        }
    }

    static void write_be_int32(std::vector<unsigned char>& out, int32_t value)
    {
        out.push_back(static_cast<unsigned char>((value >> 24) & 0xFF));
        out.push_back(static_cast<unsigned char>((value >> 16) & 0xFF));
        out.push_back(static_cast<unsigned char>((value >> 8) & 0xFF));
        out.push_back(static_cast<unsigned char>(value & 0xFF));
    }

    static void write_be_float32(std::vector<unsigned char>& out, float value)
    {
        int32_t raw = 0;
        std::memcpy(&raw, &value, 4);
        write_be_int32(out, raw);
    }

    static void write_blob(std::vector<unsigned char>& out, const std::vector<unsigned char>& blob)
    {
        size_t i;

        write_be_int32(out, static_cast<int32_t>(blob.size()));

        for (i = 0; i < blob.size(); ++i)
        {
            out.push_back(blob[i]);
        }

        while ((out.size() & 3) != 0)
        {
            out.push_back(0);
        }
    }

    // These must be declared before UdpOscTransport::thread_proc() uses them.
    std::mutex g_message_mutex;
    std::queue<UdpOscMessage> g_message_queue;

    class UdpOscTransport
    {
    public:
        UdpOscTransport()
            : _started(false)
            , _socket(INVALID_SOCKET)
            , _echo_port(4148)
            , _listen_port(4147)
        {
            std::memset(&_echo_addr, 0, sizeof(_echo_addr));
        }

        ~UdpOscTransport()
        {
            stop();

        }

        bool start()
        {
            if (_started)
            {
                return true;
            }

            WSADATA wsa_data;
            int rc = WSAStartup(MAKEWORD(2, 2), &wsa_data);
            if (rc != 0)
            {
                std::printf("UDP/OSC: WSAStartup failed: %d\n", rc);
                return false;
            }

            _socket = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
            if (_socket == INVALID_SOCKET)
            {
                std::printf("UDP/OSC: socket() failed: %d\n", WSAGetLastError());
                WSACleanup();
                return false;
            }

            sockaddr_in listen_addr;
            std::memset(&listen_addr, 0, sizeof(listen_addr));
            listen_addr.sin_family = AF_INET;
            listen_addr.sin_addr.s_addr = htonl(INADDR_ANY);
            listen_addr.sin_port = htons(static_cast<u_short>(_listen_port));

            if (bind(_socket, reinterpret_cast<const sockaddr*>(&listen_addr), sizeof(listen_addr)) == SOCKET_ERROR)
            {
                std::printf("UDP/OSC: bind(%d) failed: %d\n", _listen_port, WSAGetLastError());
                closesocket(_socket);
                _socket = INVALID_SOCKET;
                WSACleanup();
                return false;
            }

            std::memset(&_echo_addr, 0, sizeof(_echo_addr));
            _echo_addr.sin_family = AF_INET;
            _echo_addr.sin_port = htons(static_cast<u_short>(_echo_port));

            if (inet_pton(AF_INET, "127.0.0.1", &_echo_addr.sin_addr) != 1)
            {
                std::printf("UDP/OSC: inet_pton failed for echo address.\n");
                closesocket(_socket);
                _socket = INVALID_SOCKET;
                WSACleanup();
                return false;
            }

            _started = true;
            _thread = std::thread(&UdpOscTransport::thread_proc, this);

            std::printf("UDP/OSC: listening on 4147, sending to 127.0.0.1:4148\n\n");
            return true;
        }

        void stop()
        {
            if (!_started)
            {
                return;
            }

            _started = false;

            if (_socket != INVALID_SOCKET)
            {
                closesocket(_socket);
                _socket = INVALID_SOCKET;
            }

            if (_thread.joinable())
            {
                _thread.join();
            }

            WSACleanup();
            //std::printf("UDP/OSC: stopped.\n");
        }

        bool send_log(const char* text)
        {
            if (!_started || _socket == INVALID_SOCKET || text == nullptr)
            {
                return false;
            }

            // Bouw een geldig OSC-pakket: address + type-tags + string
            std::vector<unsigned char> packet;

            // Kies een address dat logisch is voor jouw pipeline.
            // Als je callers elders op een specifiek address rekenen, pas het hier aan.
            write_padded_osc_string(packet, "/log");
            write_padded_osc_string(packet, ",s");
            write_padded_osc_string(packet, std::string(text));

            if (DEBUG_UDP_OSC)
            {
                std::printf("UDP TX (send_text) -> address=/log size=%d\n", (int)packet.size());
                fflush(stdout);
            }

            return send_binary(packet);
        }

        bool send_binary(const std::vector<unsigned char>& bytes)
        {
            if (DEBUG_UDP_OSC)
            {
                std::printf("UDP TX SIZE: %d\n", (int)bytes.size());
            }

            if (!_started || _socket == INVALID_SOCKET || bytes.empty())
            {
                return false;
            }

            int sent = sendto(
                _socket,
                reinterpret_cast<const char*>(&bytes[0]),
                static_cast<int>(bytes.size()),
                0,
                reinterpret_cast<const sockaddr*>(&_echo_addr),
                static_cast<int>(sizeof(_echo_addr)));

            return sent == static_cast<int>(bytes.size());
        }

    private:
        void thread_proc()
        {
            unsigned char buffer[4096];

            while (_started)
            {
                sockaddr_in from_addr;
                int from_len = static_cast<int>(sizeof(from_addr));

                int received = recvfrom(
                    _socket,
                    reinterpret_cast<char*>(buffer),
                    static_cast<int>(sizeof(buffer)),
                    0,
                    reinterpret_cast<sockaddr*>(&from_addr),
                    &from_len);

                if (received == SOCKET_ERROR)
                {
                    if (_started)
                    {
                        int error = WSAGetLastError();

                        if (DEBUG_UDP_OSC || error != WSAECONNRESET)
                        {
                            std::printf("UDP/OSC: recvfrom() failed: %d\n", error);
                        }
                    }
                    break;
                }

                if (received <= 0)
                {
                    continue;
                }

                if (DEBUG_UDP_OSC)
                {
                    std::printf("UDP RX RAW size=%d\n", received);
                }

                UdpOscMessage message;
                std::string error;

                if (udp_osc_parse_message(buffer, received, message, error))
                {
                    if (DEBUG_UDP_OSC)
                    {
                        std::string text = udp_osc_message_to_string(message);
                        std::printf("UDP RX OK: %s\n", text.c_str());
                    }

                    {
                        std::lock_guard<std::mutex> lock(g_message_mutex);
                        g_message_queue.push(message);
                    }
                }
                else
                {
                    if (DEBUG_UDP_OSC)
                    {
                        std::printf("UDP RX ERROR: %s\n", error.c_str());
                    }
                }

                g_debug_counter_rx++;
            }
        }

    private:
        std::atomic<bool> _started;
        SOCKET _socket;
        sockaddr_in _echo_addr;
        int _echo_port;
        int _listen_port;
        std::thread _thread;
    };

    UdpOscTransport g_transport;
}

// wrapper functions

bool udp_osc_start()
{
    return g_transport.start();
}

void udp_osc_stop()
{
    g_transport.stop();
}

bool udp_osc_send_text(const char* text)
{
    return g_transport.send_log(text);
}

bool udp_osc_send_message(const char* address, const std::vector<UdpOscAtom>& atoms)
{
    std::vector<unsigned char> packet;
    std::string type_tags = ",";
    size_t i;

    if (address == nullptr || address[0] == 0)
    {
        return false;
    }

    for (i = 0; i < atoms.size(); ++i)
    {
        if (atoms[i].type == UDP_OSC_ATOM_INT32)
        {
            type_tags += "i";
        }
        else if (atoms[i].type == UDP_OSC_ATOM_FLOAT32)
        {
            type_tags += "f";
        }
        else if (atoms[i].type == UDP_OSC_ATOM_STRING)
        {
            type_tags += "s";
        }
        else if (atoms[i].type == UDP_OSC_ATOM_BLOB)
        {
            type_tags += "b";
        }
        else if (atoms[i].type == UDP_OSC_ATOM_TRUE)
        {
            type_tags += "T";
        }
        else if (atoms[i].type == UDP_OSC_ATOM_FALSE)
        {
            type_tags += "F";
        }
        else if (atoms[i].type == UDP_OSC_ATOM_NIL)
        {
            type_tags += "N";
        }
        else if (atoms[i].type == UDP_OSC_ATOM_IMPULSE)
        {
            type_tags += "I";
        }
        else
        {
            return false;
        }
    }

    write_padded_osc_string(packet, address);
    write_padded_osc_string(packet, type_tags);

    for (i = 0; i < atoms.size(); ++i)
    {
        const UdpOscAtom& atom = atoms[i];

        if (atom.type == UDP_OSC_ATOM_INT32)
        {
            write_be_int32(packet, atom.int_value);
        }
        else if (atom.type == UDP_OSC_ATOM_FLOAT32)
        {
            write_be_float32(packet, atom.float_value);
        }
        else if (atom.type == UDP_OSC_ATOM_STRING)
        {
            write_padded_osc_string(packet, atom.string_value);
        }
        else if (atom.type == UDP_OSC_ATOM_BLOB)
        {
            write_blob(packet, atom.blob_value);
        }
        else if (
            atom.type == UDP_OSC_ATOM_TRUE ||
            atom.type == UDP_OSC_ATOM_FALSE ||
            atom.type == UDP_OSC_ATOM_NIL ||
            atom.type == UDP_OSC_ATOM_IMPULSE
            )
        {
        }
        else
        {
            return false;
        }
    }

    if (DEBUG_UDP_OSC)
    {
        std::printf("UDP TX: %s | atoms=%d | size=%d\n",
            address,
            (int)atoms.size(),
            (int)packet.size());
    }

    return g_transport.send_binary(packet);
}

bool udp_osc_parse_message(const void* data_ptr, int size, UdpOscMessage& out_message, std::string& out_error)
{
    out_message = UdpOscMessage();
    out_error.clear();

    if (data_ptr == nullptr)
    {
        out_error = "null OSC data pointer";
        return false;
    }

    if (size <= 0)
    {
        out_error = "empty OSC packet";
        return false;
    }

    const unsigned char* data = reinterpret_cast<const unsigned char*>(data_ptr);

    if (size >= 7 && std::memcmp(data, "#bundle", 7) == 0)
    {
        out_error = "OSC bundles are not supported yet";
        return false;
    }

    int offset = 0;

    if (!read_padded_osc_string(data, size, offset, out_message.address, out_error))
    {
        return false;
    }

    if (out_message.address.empty())
    {
        out_error = "empty OSC address";
        return false;
    }

    split_address(out_message.address, out_message.address_parts);

    std::string type_tags;
    if (!read_padded_osc_string(data, size, offset, type_tags, out_error))
    {
        return false;
    }

    if (type_tags.empty() || type_tags[0] != ',')
    {
        out_error = "invalid OSC type tag string";
        return false;
    }

    for (size_t i = 1; i < type_tags.size(); ++i)
    {
        char tag = type_tags[i];
        UdpOscAtom atom;

        if (tag == 'i')
        {
            atom.type = UDP_OSC_ATOM_INT32;
            if (!read_be_int32(data, size, offset, atom.int_value, out_error))
            {
                return false;
            }
        }
        else if (tag == 'f')
        {
            atom.type = UDP_OSC_ATOM_FLOAT32;
            if (!read_be_float32(data, size, offset, atom.float_value, out_error))
            {
                return false;
            }
        }
        else if (tag == 's')
        {
            atom.type = UDP_OSC_ATOM_STRING;
            if (!read_padded_osc_string(data, size, offset, atom.string_value, out_error))
            {
                return false;
            }
        }
        else if (tag == 'b')
        {
            atom.type = UDP_OSC_ATOM_BLOB;
            if (!read_blob(data, size, offset, atom.blob_value, out_error))
            {
                return false;
            }
        }
        else if (tag == 'T')
        {
            atom.type = UDP_OSC_ATOM_TRUE;
        }
        else if (tag == 'F')
        {
            atom.type = UDP_OSC_ATOM_FALSE;
        }
        else if (tag == 'N')
        {
            atom.type = UDP_OSC_ATOM_NIL;
        }
        else if (tag == 'I')
        {
            atom.type = UDP_OSC_ATOM_IMPULSE;
        }
        else
        {
            out_error = "unsupported OSC type tag: ";
            out_error += tag;
            return false;
        }

        out_message.atoms.push_back(atom);
    }

    if (offset > size)
    {
        out_error = "OSC read offset exceeded packet size";
        return false;
    }

    return true;
}

std::string udp_osc_message_to_string(const UdpOscMessage& message)
{
    std::ostringstream stream;
    size_t i;

    stream << message.address;

    if (!message.address_parts.empty())
    {
        stream << " [";

        for (i = 0; i < message.address_parts.size(); ++i)
        {
            if (i > 0)
            {
                stream << ", ";
            }

            stream << message.address_parts[i];
        }

        stream << "]";
    }

    if (!message.atoms.empty())
    {
        stream << " => ";

        for (i = 0; i < message.atoms.size(); ++i)
        {
            if (i > 0)
            {
                stream << ", ";
            }

            stream << atom_to_string(message.atoms[i]);
        }
    }

    return stream.str();
}

bool udp_osc_pop_message(UdpOscMessage& out_message)
{
    std::lock_guard<std::mutex> lock(g_message_mutex);

    if (g_message_queue.empty())
    {
        return false;
    }

    out_message = g_message_queue.front();
    g_message_queue.pop();
    return true;
}

std::string udp_osc_atoms_to_json(const std::vector<UdpOscAtom>& atoms)
{
    std::ostringstream stream;
    size_t i;

    stream << "[";

    for (i = 0; i < atoms.size(); ++i)
    {
        const UdpOscAtom& atom = atoms[i];

        if (i > 0)
        {
            stream << ",";
        }

        if (atom.type == UDP_OSC_ATOM_INT32)
        {
            stream << atom.int_value;
        }
        else if (atom.type == UDP_OSC_ATOM_FLOAT32)
        {
            stream << atom.float_value;
        }
        else if (atom.type == UDP_OSC_ATOM_STRING)
        {
            stream << "\"" << json_escape(atom.string_value) << "\"";
        }
        else if (atom.type == UDP_OSC_ATOM_TRUE)
        {
            stream << "true";
        }
        else if (atom.type == UDP_OSC_ATOM_FALSE)
        {
            stream << "false";
        }
        else if (atom.type == UDP_OSC_ATOM_NIL)
        {
            stream << "null";
        }
        else if (atom.type == UDP_OSC_ATOM_IMPULSE)
        {
            stream << "\"impulse\"";
        }
        else if (atom.type == UDP_OSC_ATOM_BLOB)
        {
            stream << "\"<blob " << atom.blob_value.size() << " bytes>\"";
        }
        else
        {
            stream << "null";
        }
    }

    stream << "]";
    return stream.str();
}
