/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "output_devices.h"

#include <CommonCrypto/CommonDigest.h>
#include <unistd.h>

#include <vector>

namespace fluideq_mac {

namespace {

AudioObjectPropertyAddress address(AudioObjectPropertySelector selector,
                                   AudioObjectPropertyScope scope =
                                       kAudioObjectPropertyScopeGlobal) {
  AudioObjectPropertyAddress out{};
  out.mSelector = selector;
  out.mScope = scope;
  out.mElement = kAudioObjectPropertyElementMain;
  return out;
}

std::string utf8(CFStringRef text) {
  if (text == nullptr) {
    return std::string();
  }
  const CFIndex length = CFStringGetLength(text);
  const CFIndex capacity =
      CFStringGetMaximumSizeForEncoding(length, kCFStringEncodingUTF8) + 1;
  std::vector<char> buffer(static_cast<size_t>(capacity), '\0');
  if (!CFStringGetCString(text, buffer.data(), capacity,
                          kCFStringEncodingUTF8)) {
    return std::string();
  }
  return std::string(buffer.data());
}

std::string string_property(AudioObjectID object,
                            AudioObjectPropertySelector selector) {
  AudioObjectPropertyAddress where = address(selector);
  CFStringRef value = nullptr;
  UInt32 size = sizeof(value);
  if (AudioObjectGetPropertyData(object, &where, 0, nullptr, &size, &value) !=
          noErr ||
      value == nullptr) {
    return std::string();
  }
  std::string out = utf8(value);
  CFRelease(value);
  return out;
}

bool has_output_streams(AudioObjectID device) {
  AudioObjectPropertyAddress where =
      address(kAudioDevicePropertyStreams, kAudioObjectPropertyScopeOutput);
  UInt32 size = 0;
  return AudioObjectGetPropertyDataSize(device, &where, 0, nullptr, &size) ==
             noErr &&
         size >= sizeof(AudioStreamID);
}

bool is_hidden(AudioObjectID device) {
  AudioObjectPropertyAddress where = address(kAudioDevicePropertyIsHidden);
  UInt32 hidden = 0;
  UInt32 size = sizeof(hidden);
  return AudioObjectGetPropertyData(device, &where, 0, nullptr, &size,
                                    &hidden) == noErr &&
         hidden != 0;
}

void append_json_string(std::string& out, const std::string& text) {
  out.push_back('"');
  for (const char character : text) {
    const auto byte = static_cast<unsigned char>(character);
    if (character == '"' || character == '\\') {
      out.push_back('\\');
      out.push_back(character);
    } else if (byte < 0x20) {
      static const char kHex[] = "0123456789abcdef";
      out += "\\u00";
      out.push_back(kHex[byte >> 4]);
      out.push_back(kHex[byte & 0x0F]);
    } else {
      out.push_back(character);
    }
  }
  out.push_back('"');
}

}  // namespace

AudioObjectID default_output_device() noexcept {
  AudioObjectPropertyAddress where =
      address(kAudioHardwarePropertyDefaultOutputDevice);
  AudioObjectID device = kAudioObjectUnknown;
  UInt32 size = sizeof(device);
  const OSStatus status = AudioObjectGetPropertyData(
      kAudioObjectSystemObject, &where, 0, nullptr, &size, &device);
  return status == noErr ? device : kAudioObjectUnknown;
}

bool set_default_output(const std::string& uid, std::string& error) {
  CFStringRef wanted = CFStringCreateWithCString(
      kCFAllocatorDefault, uid.c_str(), kCFStringEncodingUTF8);
  if (wanted == nullptr) {
    error = "the output's identifier could not be read";
    return false;
  }
  AudioObjectPropertyAddress translate =
      address(kAudioHardwarePropertyTranslateUIDToDevice);
  AudioObjectID device = kAudioObjectUnknown;
  UInt32 size = sizeof(device);
  const OSStatus found = AudioObjectGetPropertyData(
      kAudioObjectSystemObject, &translate, sizeof(wanted), &wanted, &size,
      &device);
  CFRelease(wanted);
  if (found != noErr || device == kAudioObjectUnknown ||
      !has_output_streams(device)) {
    error = "no output has that identifier";
    return false;
  }
  AudioObjectPropertyAddress where =
      address(kAudioHardwarePropertyDefaultOutputDevice);
  const OSStatus status = AudioObjectSetPropertyData(
      kAudioObjectSystemObject, &where, 0, nullptr, sizeof(device), &device);
  if (status != noErr) {
    error = "macOS refused the change (status " +
            std::to_string(static_cast<long>(status)) + ")";
    return false;
  }
  return true;
}

std::string device_uid(AudioObjectID device) {
  return string_property(device, kAudioDevicePropertyDeviceUID);
}

std::string device_name(AudioObjectID device) {
  return string_property(device, kAudioObjectPropertyName);
}

std::string endpoint_guid(const std::string& uid) {
  unsigned char digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(uid.data(), static_cast<CC_LONG>(uid.size()), digest);
  static const char kHex[] = "0123456789ABCDEF";
  std::string out = "{";
  for (size_t at = 0; at < 16; ++at) {
    if (at == 4 || at == 6 || at == 8 || at == 10) {
      out.push_back('-');
    }
    out.push_back(kHex[digest[at] >> 4]);
    out.push_back(kHex[digest[at] & 0x0F]);
  }
  out.push_back('}');
  return out;
}

double nominal_sample_rate(AudioObjectID device) noexcept {
  AudioObjectPropertyAddress where =
      address(kAudioDevicePropertyNominalSampleRate);
  Float64 rate = 0.0;
  UInt32 size = sizeof(rate);
  if (AudioObjectGetPropertyData(device, &where, 0, nullptr, &size, &rate) !=
      noErr) {
    return 0.0;
  }
  return rate;
}

uint32_t max_buffer_frames(AudioObjectID device) noexcept {
  AudioObjectPropertyAddress where =
      address(kAudioDevicePropertyBufferFrameSizeRange);
  AudioValueRange range{};
  UInt32 size = sizeof(range);
  if (AudioObjectGetPropertyData(device, &where, 0, nullptr, &size, &range) !=
          noErr ||
      range.mMaximum <= 0.0) {
    return 0;
  }
  return static_cast<uint32_t>(range.mMaximum);
}

AudioObjectID own_process_object() noexcept {
  AudioObjectPropertyAddress where =
      address(kAudioHardwarePropertyTranslatePIDToProcessObject);
  pid_t self = ::getpid();
  AudioObjectID process = kAudioObjectUnknown;
  UInt32 size = sizeof(process);
  if (AudioObjectGetPropertyData(kAudioObjectSystemObject, &where,
                                 sizeof(self), &self, &size,
                                 &process) != noErr) {
    return kAudioObjectUnknown;
  }
  return process;
}

std::vector<AudioObjectID> process_objects() {
  AudioObjectPropertyAddress where =
      address(kAudioHardwarePropertyProcessObjectList);
  UInt32 size = 0;
  std::vector<AudioObjectID> processes;
  if (AudioObjectGetPropertyDataSize(kAudioObjectSystemObject, &where, 0,
                                     nullptr, &size) != noErr ||
      size == 0) {
    return processes;
  }
  processes.resize(size / sizeof(AudioObjectID));
  if (AudioObjectGetPropertyData(kAudioObjectSystemObject, &where, 0, nullptr,
                                 &size, processes.data()) != noErr) {
    processes.clear();
    return processes;
  }
  processes.resize(size / sizeof(AudioObjectID));
  return processes;
}

bool is_running_output(AudioObjectID process) noexcept {
  AudioObjectPropertyAddress where =
      address(kAudioProcessPropertyIsRunningOutput);
  UInt32 running = 0;
  UInt32 size = sizeof(running);
  return AudioObjectGetPropertyData(process, &where, 0, nullptr, &size,
                                    &running) == noErr &&
         running != 0;
}

std::string list_outputs_json() {
  AudioObjectPropertyAddress where = address(kAudioHardwarePropertyDevices);
  UInt32 size = 0;
  std::vector<AudioObjectID> devices;
  if (AudioObjectGetPropertyDataSize(kAudioObjectSystemObject, &where, 0,
                                     nullptr, &size) == noErr &&
      size > 0) {
    devices.resize(size / sizeof(AudioObjectID));
    if (AudioObjectGetPropertyData(kAudioObjectSystemObject, &where, 0,
                                   nullptr, &size, devices.data()) != noErr) {
      devices.clear();
    }
    devices.resize(size / sizeof(AudioObjectID));
  }
  const AudioObjectID current = default_output_device();

  std::string out = "[";
  bool first = true;
  for (const AudioObjectID device : devices) {
    if (!has_output_streams(device) || is_hidden(device)) {
      continue;
    }
    const std::string uid = device_uid(device);
    if (uid.empty()) {
      continue;
    }
    if (!first) {
      out.push_back(',');
    }
    first = false;
    out += "{\"uid\":";
    append_json_string(out, uid);
    out += ",\"name\":";
    append_json_string(out, device_name(device));
    out += ",\"isDefault\":";
    out += device == current ? "true" : "false";
    out.push_back('}');
  }
  out.push_back(']');
  return out;
}

}  // namespace fluideq_mac
