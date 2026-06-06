#pragma once

#include <cstdint>
#include <string>
#include <vector>

enum UdpOscAtomType
{
    UDP_OSC_ATOM_INT32 = 0,
    UDP_OSC_ATOM_FLOAT32,
    UDP_OSC_ATOM_STRING,
    UDP_OSC_ATOM_BLOB,
    UDP_OSC_ATOM_TRUE,
    UDP_OSC_ATOM_FALSE,
    UDP_OSC_ATOM_NIL,
    UDP_OSC_ATOM_IMPULSE
};

struct UdpOscAtom
{
    UdpOscAtomType type;
    int32_t int_value;
    float float_value;
    std::string string_value;
    std::vector<unsigned char> blob_value;

    UdpOscAtom()
        : type(UDP_OSC_ATOM_INT32)
        , int_value(0)
        , float_value(0.0f)
    {
    }
};

struct UdpOscMessage
{
    std::string address;
    std::vector<std::string> address_parts;
    std::vector<UdpOscAtom> atoms;
};

bool udp_osc_start();
void udp_osc_stop();

bool udp_osc_send_text(const char* text);
bool udp_osc_send_message(const char* address, const std::vector<UdpOscAtom>& atoms);

bool udp_osc_parse_message(const void* data_ptr, int size, UdpOscMessage& out_message, std::string& out_error);
std::string udp_osc_message_to_string(const UdpOscMessage& message);

bool udp_osc_pop_message(UdpOscMessage& out_message);
std::string udp_osc_atoms_to_json(const std::vector<UdpOscAtom>& atoms);