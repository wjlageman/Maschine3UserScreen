# Technical Description: Maschine MK3 LEDs

## Purpose

This manual describes exclusively the low-level C++ LED control of the Native Instruments Maschine MK3. The text focuses on HID state frames, LED indexes, and color values as used in the native C++ code.

This document describes LED output only. The structure of controller events and input reports is documented separately. The LED route uses its own state frame and its own mapping from LED names to state offsets.

## 1. Main Source Files

### LedIndex.cpp / LedIndex.h

Contains the mapping of LED names to LED indexes and the available color indexes.

- g_led_index: numeric LED index to name
- g_led_lookup: name to LED index
- maschine_color_index: base colors
- html_color_map: color names and HTML colors to Maschine color indexes

### MaschineUsbControls.cpp / MaschineUsbControls.h

Contains the LED state buffer, the HID write route, and the functions used by C++ and Javascript.

- init_known_state_frame()
- write_state_frame()
- controls_set_led_value()
- controls_set_led_color()
- controls_set_led_color_index()
- controls_set_night_time()
- controls_reset_leds_to_default()

The controller events and LED control are contained in a separate native DLL. This DLL handles both the HID input reports for the controls and the HID output reports for the LEDs. The display interface uses a separate USB/display route.

## 2. HID State Frame

The LED control uses the same HID device route as the controller interface, but in the output direction. The code writes a fixed 64-byte buffer to the HID device.

```cpp
CONTROLS_REPORT_SIZE = 64
static unsigned char g_state_buf[CONTROLS_REPORT_SIZE];

result = hid_write(g_device, g_state_buf, CONTROLS_REPORT_SIZE);
```

The LED state frame starts with report byte `0x80`. After that, one state byte follows for each LED.

LED index 0 is written to state offset 1.

General rule:

```cpp
state_offset = led_index + 1
```

Bytes 1 through 62 may contain LED state bytes. Byte 63 contains the value `0x00` in the known initialization state. The code always writes the complete 64-byte buffer.

## 3. Initialization of the LED Frame

The known initialization state is built in `init_known_state_frame()`.

The active initialization sets all LED states to `0x00`, except byte 59.

```text
byte 0  = 0x80
byte 59 = 0x0c
all other bytes = 0x00
```

After filling `g_state_buf`, `g_state_valid` is set and the nighttime transformation is applied if nighttime mode is active.

## 4. LED Names, Indexes, and State Offsets

The following table comes directly from `LedIndex.cpp`. The state offset is the byte position in `g_state_buf` where the LED value is written.

| LED Index | State Offset | Name |
|-----------|-------------|------|
| 0 | 1 | channel |
| 1 | 2 | plug-in |
| 2 | 3 | arranger |
| 3 | 4 | mixer |
| 4 | 5 | browser |
| 5 | 6 | sampling |
| 6 | 7 | arrow-left |
| 7 | 8 | arrow-right |
| 8 | 9 | file |
| 9 | 10 | settings |
| 10 | 11 | auto |
| 11 | 12 | macro |
| 12 | 13 | button-1 |
| 13 | 14 | button-2 |
| 14 | 15 | button-3 |
| 15 | 16 | button-4 |
| 16 | 17 | button-5 |
| 17 | 18 | button-6 |
| 18 | 19 | button-7 |
| 19 | 20 | button-8 |
| 20 | 21 | volume |
| 21 | 22 | swing |
| 22 | 23 | note-repeat |
| 23 | 24 | tempo |
| 24 | 25 | lock |
| 25 | 26 | pitch |
| 26 | 27 | mod |
| 27 | 28 | perform |
| 28 | 29 | notes |
| 29 | 30 | select-1 |
| 30 | 31 | select-2 |
| 31 | 32 | select-3 |
| 32 | 33 | select-4 |
| 33 | 34 | select-5 |
| 34 | 35 | select-6 |
| 35 | 36 | select-7 |
| 36 | 37 | select-8 |
| 37 | 38 | restart |
| 38 | 39 | erase |
| 39 | 40 | tap |
| 40 | 41 | follow |
| 41 | 42 | play |
| 42 | 43 | rec |
| 43 | 44 | stop |
| 44 | 45 | shift |
| 45 | 46 | fixed-vel |
| 46 | 47 | pad-mode |
| 47 | 48 | keyboard |
| 48 | 49 | chords |
| 49 | 50 | step |
| 50 | 51 | scene |
| 51 | 52 | pattern |
| 52 | 53 | events |
| 53 | 54 | variation |
| 54 | 55 | dupicate |
| 55 | 56 | select |
| 56 | 57 | solo |
| 57 | 58 | mute |
| 58 | 59 | joy-up |
| 59 | 60 | joy-left |
| 60 | 61 | joy-right |
| 61 | 62 | joy-down |

## 5. Maschine MK3 Color Indexes

Each LED state is one byte. The functions accept values from 0 through 255.

Negative values are converted to 0.

Values above 255 are converted to 255.

```cpp
if (value < 0) value = 0;
if (value > 0xFF) value = 0xFF;

g_state_buf[state_offset] = (unsigned char)value;
```

### Base Color Indexes

| Value | Name |
|--------|------|
| 0x00 | black |
| 0x04 | red |
| 0x08 | orange |
| 0x0c | light-orange |
| 0x10 | warm-yellow |
| 0x14 | yellow |
| 0x18 | lime |
| 0x20 | green |
| 0x22 | mint |
| 0x24 | cyan |
| 0x28 | turquoise |
| 0x2c | blue |
| 0x30 | plum |
| 0x34 | violet |
| 0x38 | purple |
| 0x3c | magenta |
| 0x42 | fuchsia |
| 0x44 | gray1 |
| 0x45 | gray2 |
| 0x46 | gray3 |
| 0x47 | white |

### HTML Color Mapping

| Color Name | Index | HTML Color |
|------------|--------|------------|
| black | 0x00 | #000000 |
| red | 0x05 | #B80000 |
| redhot | 0x06 | #FF0000 |
| brown | 0x09 | #804713 |
| orange | 0x0A | #FF9B14 |
| tomato | 0x0D | #DF5F30 |
| coral | 0x0E | #FF6E41 |
| gold | 0x11 | #F0E68C |
| khaki | 0x12 | #FFD700 |
| yellow | 0x15 | #B0B000 |
| sun | 0x16 | #FFFF00 |
| spring | 0x19 | #7ACF1D |
| lime | 0x1A | #AAFF2D |
| green | 0x1D | #007F00 |
| forestgreen | 0x1E | #00BF00 |
| emerald | 0x21 | #00B955 |
| limegreen | 0x22 | #00FF00 |
| pine | 0x25 | #00AF00 |
| granny | 0x26 | #00FF00 |
| teal | 0x29 | #008080 |
| cyan | 0x2A | #00FFFF |
| lilac | 0x2D | #0078BF |
| turquoise | 0x2E | #00C8FF |
| plum | 0x31 | #000080 |
| blue | 0x32 | #0032FF |
| indigo | 0x35 | #4232D1 |
| violet | 0x36 | #6E48CE |
| orchid | 0x39 | #E157E3 |
| purple | 0x3A | #D232F5 |
| toy | 0x3D | #FA00FA |
| rose | 0x3E | #FF4A96 |
| pink | 0x41 | #A000A0 |
| hotpink | 0x42 | #FF1493 |
| gray | 0x44 | #606060 |
| lightgray | 0x46 | #C0C0C0 |
| silver | 0x45 | #A0A0A0 |
| white | 0x47 | #FFFFFF |

## 7. API Functions

### controls_set_led_value(name, value)

Looks up the LED index based on the name, calculates:

```cpp
state_offset = led_index + 1
```

Limits the value to 0..255, applies nighttime mode if necessary, and then writes the complete state frame.

### controls_set_led_color_index(name, color)

Writes a numeric color index to the LED state. The value is limited to 0..255.

### controls_set_led_color(name, value, color)

Looks up a color name in `html_color_map` and writes the corresponding color index to the LED state.

### controls_reset_leds_to_default()

Calls `init_known_state_frame()` and writes the known default state to the device.

### controls_set_night_time(night_time)

Sets the internal nighttime flag and modifies the relevant LED state bytes. Afterwards, the complete state frame is written.

## 8. Nighttime Mode

Nighttime mode is applied only to a fixed set of state offsets:

```text
5, 29, 30, 31, 32, 33, 34, 35, 36
```

These offsets belong to:

| State Offset | LED Index | Name |
|--------------|-----------|------|
| 5 | 4 | browser |
| 29 | 28 | notes |
| 30 | 29 | select-1 |
| 31 | 30 | select-2 |
| 32 | 31 | select-3 |
| 33 | 32 | select-4 |
| 34 | 33 | select-5 |
| 35 | 34 | select-6 |
| 36 | 35 | select-7 |

The code applies nighttime mode only if bit 1 of the LED value is not set.

If bit 1 is set, the value remains unchanged.

```cpp
if ((value & 0x02) != 0) return value;
```

In nighttime mode, bit 0 is cleared.

In daytime mode, bit 0 is set for these offsets.

```cpp
nighttime: value & ~0x01
daytime:   value | 0x01
```

## 9. Cycle Test

`cycle_led_for_name()` is a test function.

This function cycles an LED through three values:

```text
0x00 -> 0x7c -> 0x7e -> 0x00
```

This route is intended for testing and not as a normal color API.

## 10. Relationship with Controller Events

The LED mapping is not the same as the control-event mapping.

A control event uses input report bits and names from `WidgetLookup.cpp`.

The LED route uses LED indexes from `LedIndex.cpp` and writes to:

```cpp
g_state_buf[state_offset]
```

Examples:

- control-event play: comes from the input bitfield decoder
- LED play: LedIndex.cpp index 41, state offset 42
- control-event button-1: different bit mapping than LED button-1

## 11. Limitations

- Pads are not controlled through this LED route.
- The touch strip is not controlled through this LED route.
- The NI software may continue to write its own LED states; therefore relevant buttons must be set to off in NI Controller Editor when this project manages the LED states.
- The code always writes the complete 64-byte state frame. There is no partial HID write per LED.

## 12. Summary

The LED interface uses a 64-byte HID output state frame.

Byte 0 is report type `0x80`.

Each known LED has an LED index and is written to:

```cpp
state_offset = led_index + 1
```

The LED names and Maschine color indexes are defined in `LedIndex.cpp`.

The state is written using `hid_write()`.

```text
LED name
→ led_index_lookup(name)
→ state_offset = led_index + 1
→ g_state_buf[state_offset] = value
→ hid_write(g_device, g_state_buf, 64)
```
