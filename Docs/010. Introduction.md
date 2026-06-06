# Introduction

This project originated from a fairly simple but interesting observation: it turned out to be surprisingly easy to display custom images on the screens of the Native Instruments Maschine MK3. Although there are many projects on GitHub around MIDI controllers and USB reverse engineering, the screen interface of the Maschine MK3 turned out to have been hardly developed in a practical way as a basis for a general user-interface environment.

These experiments connected with earlier experience with the screen technology of the Ableton Push2. The technical approach of both devices shows clear similarities:

- a direct pixel interface
- relatively simple USB communication
- a screen that in fact functions as an external display

But merely being able to draw pixels has little practical value. A screen only becomes interesting when it is part of a larger system: a synthesizer, a DAW controller, a live performance environment, or a general MIDI controller.

For that, several parts are needed that work well together.

This is a Windows 10/11 project; there is no version for Mac or Linux or other operating systems.

The project includes a working version that is placed on the Windows PC and does not require any further setup. In addition, all source code is included under a source-available freeware license. Personal and non-commercial use is allowed. Commercial use or distribution of modified versions requires permission from the author.

## More Than Just Screens

A usable controller environment requires multiple layers:

### 1. Screens

The screens show information that makes operation clear and fast:

- parameters
- values
- menus
- mixer information
- names of functions
- status information

Without screens, a controller quickly becomes abstract and hard to read. When parts change function, it is often difficult to see which mode is active.

### 2. LEDs

The LEDs form a single whole together with the screens.

With a hardware controller, for example, you expect:

- active functions that light up
- mute/solo status
- step-sequencer feedback
- selection indication
- menu status
- performance feedback

For that reason, this project also supports direct LED control.

### 3. Controller Events

A screen interface has little value if the hardware input is not available.

For that reason, all relevant signals from the Maschine MK3 are intercepted:

- buttons
- encoders
- touch encoders
- touch strip
- pads
- navigation controls

These events can then be used by external software.

### 4. A Description Language for the Interface

Drawing only individual pixels is not workable for larger projects.

For that reason, this project contains a system with which:

- screen space is divided
- widgets are placed
- behaviour is linked to hardware controls
- values and appearance can be adjusted dynamically

The interface consists of widgets such as:

- buttons
- toggles
- menus
- dials
- sliders
- scroll elements
- text fields

The screens are therefore not “hardcoded” pixel by pixel, but are built from reusable UI elements.

### 5. Communication With External Software

A hardware controller is only useful when it can communicate with other software.

For that reason, this project uses:

- OSC (Open Sound Control)
- over UDP

OSC offers:

- high speed
- low overhead
- flexible data structures
- good support within computer music software

Many platforms support OSC directly:

- Max/MSP and MaxForLive
- PureData
- TouchDesigner
- Reaper
- SuperCollider
- Python frameworks
- custom software

In this version, MIDI communication was deliberately not chosen.

MIDI is excellent for music data, but less suitable for complex UI descriptions, dynamic layouts, and rich parameter structures. In addition, it is very complex to implement MIDI ports that can work out of the box on all Windows 10/11 machines.

## Driver Architecture

An important part of the project is the handling of the Maschine MK3 drivers.

When the original Native Instruments driver is active:

- the NI software has exclusive control over the screens
- user screens cannot be displayed

When the user driver is active:

- this project gets direct access to the screen interface
- the NI software temporarily loses access to the screens

This conversion is:

- controllable
- reversible
- safe

The user driver used is:

- WinUSB
- this is a standard Windows 10/11 driver from Microsoft

This project therefore does not use an experimental kernel driver or custom USB driver.

The hardware and software of the Maschine MK3 are not modified.

However, switching drivers does require:

- a restart of the Maschine MK3
- occasionally a reboot of Windows

## Structure of the Project

The project ultimately became fairly extensive because many necessary parts have been integrated.

The basis consists of a C++ application.

### The C++ Application

The C++ application handles:

- USB communication
- taking over the screens
- LED control
- controller events
- driver switching
- OSC transport
- starting the JS environment

The application itself has deliberately been kept simple:

- a console application
- with a small menu
- focused on stability and debugging

### The Screen Interface

For the screens, the project uses:

- WinUSB
- not the dedicated NI driver

This creates direct access to the display interface.

### Controller Events

The controller events use a different USB interface.

Important:

- the NI software still receives these events
- this interface is not “taken over”
- we only read along

These controller events are also part of the OSC protocol.

### LED Control

The LEDs also use a separate interface.

This project can directly control almost all LEDs, with the exception of the pads and the touch strip. These parts use a different internal architecture. The LEDs can also still be controlled by the Native Instruments software. For that reason, all buttons must be set to ‘off’ in the NI Controller Editor.

### Low-Level Demo

The project also contains a simple low-level demonstration:

- direct screen takeover
- without UI system
- purely focused on USB/display communication

This makes debugging and reverse engineering easier.

### The Javascript / Sciter Environment

The actual UI functionality is located in a Javascript environment.

For this, the following are used:

- Sciter: a compact embedded HTML/CSS/JS engine for native Windows applications. This project uses the free Windows version of Sciter, where the fixed `sciter.dll` is shipped directly with the application. Sciter provides the embedded browser environment in which the HTML layouts and the Javascript application are executed.
- an embedded HTML/CSS/JS environment hosted by Sciter

The C++ application starts this environment automatically.

## HTML as Layout Description

The C++ application loads an `.htm` file in which:

- the screen structure
- the layout
- the division of the screen space

are described.

This layout is then processed by Javascript.

## Widgets and Screen Structure

In Javascript, the HTML is converted into:

- screen structures
- containers
- widgets

These widgets form the core of the controller environment.

The available screen space is divided over:

- vertical and horizontal regions and sub-regions
- widgets (control elements)

After that, the layout is fixed and is not dynamically rearranged.

## Dynamic Appearance via OSC

Although the layout is fixed, almost all properties of widgets can be adjusted dynamically via OSC:

- colors
- borders
- texts
- values
- menu contents
- labels

As a result, the same layout can be used for very different applications.

## Max / MaxForLive Demo

As a demonstration, the project also contains a Max/MaxForLive patch (`.AMXD`). In it, all parts of the system are used:

- OSC communication
- widget control
- LED feedback
- controller events
- dynamic widget display

The demo is intended as:

- reference
- starting point
- development environment
- example project

for your own projects and your own screen interfaces.

## Goal of the Project

This project tries to turn the Maschine MK3 into an open experimentation environment with:

- direct hardware access
- flexible UI construction
- integration with existing music software
- development of custom instruments and controllers

The emphasis is therefore on:

- flexibility
- speed of development
- experimental possibilities
- integration with existing music workflows
