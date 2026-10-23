/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What macOS says about its outputs, in the words the rest of FluidEQ uses.
 *
 * A device's UID is what macOS keeps stable — a name changes with the user's
 * language and a device ID with every reconnect — but it is free text
 * ("AppleUSBAudioEngine:Generic:USB Audio:14100000:1,2"), and everything in
 * FluidEQ that names an output to the engine was written for Windows'
 * `{GUID}`: the `Device:` line, the status file, the display connection's
 * handshake, and the app's checks on all three. So each output is named by a
 * GUID made from its UID (`endpoint_guid`), which the app makes the same way
 * from the UID `--list-outputs` prints (`macOutputs.ts`, where a test holds
 * the two to the same answer).
 */
#ifndef FLUIDEQ_MAC_ENGINE_OUTPUT_DEVICES_H
#define FLUIDEQ_MAC_ENGINE_OUTPUT_DEVICES_H

#include <CoreAudio/CoreAudio.h>

#include <cstdint>
#include <string>
#include <vector>

namespace fluideq_mac {

/** The output everything plays to, or `kAudioObjectUnknown`. */
AudioObjectID default_output_device() noexcept;

/**
 * Makes the output with this UID the one everything plays to — what choosing
 * it in System Settings does. False, with why, when there is no such output
 * or macOS refused.
 */
bool set_default_output(const std::string& uid, std::string& error);

std::string device_uid(AudioObjectID device);
std::string device_name(AudioObjectID device);

/**
 * `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`, upper-case, from the first half
 * of the UID's SHA-256: the same output always gets the same one, and two
 * outputs get the same one only by a collision in 128 bits.
 */
std::string endpoint_guid(const std::string& uid);

/** The device's clock, in Hz; 0 when it would not say. */
double nominal_sample_rate(AudioObjectID device) noexcept;

/** The largest I/O buffer the device will use, in frames; 0 when unknown. */
uint32_t max_buffer_frames(AudioObjectID device) noexcept;

/** This process, as Core Audio knows it, for leaving it out of the tap. */
AudioObjectID own_process_object() noexcept;

/** Every process Core Audio knows as a client, this one included. */
std::vector<AudioObjectID> process_objects();

/** The process is playing: it has output running on some device. */
bool is_running_output(AudioObjectID process) noexcept;

/**
 * Every visible output as a JSON array of `{uid, name, isDefault}`, for the
 * app's output list. Input-only devices are left out: offering somebody a
 * microphone to send music to is not a choice.
 */
std::string list_outputs_json();

}  // namespace fluideq_mac

#endif  // FLUIDEQ_MAC_ENGINE_OUTPUT_DEVICES_H
