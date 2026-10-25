/* FluidEQ — GPL-3.0-or-later */
#include "output_devices.h"
#include <CoreAudio/CoreAudio.h>
#include <CoreFoundation/CoreFoundation.h>
#include <condition_variable>
#include <cstdio>
#include <iostream>
#include <mutex>
#include <string>

namespace {
const AudioObjectPropertyAddress kDefault{
  kAudioHardwarePropertyDefaultOutputDevice, kAudioObjectPropertyScopeGlobal,
  kAudioObjectPropertyElementMain};
struct Change {
  std::mutex mutex;
  std::condition_variable condition;
  bool dirty = false;
  static OSStatus changed(AudioObjectID, UInt32, const AudioObjectPropertyAddress*, void* context) {
    auto& self = *static_cast<Change*>(context);
    { std::lock_guard lock(self.mutex); self.dirty = true; }
    self.condition.notify_one(); return noErr;
  }
  bool select(AudioObjectID target) {
    if (fluideq_mac::default_output_device() == target) return true;
    std::string error;
    if (!fluideq_mac::set_default_output(fluideq_mac::device_uid(target), error)) return false;
    std::unique_lock lock(mutex);
    // HAL writes can be asynchronous. Only its notification and actual new
    // identity acknowledge a switch; no sleep or deadline guesses at routing.
    while (fluideq_mac::default_output_device() != target) {
      condition.wait(lock, [&] { return dirty; });
      dirty = false;
    }
    return true;
  }
};
AudioObjectID aggregate(const std::string& output_uid) {
  const auto uuid = CFUUIDCreate(nullptr);
  const auto uid = CFUUIDCreateString(nullptr, uuid);
  const auto output = CFStringCreateWithCString(nullptr, output_uid.c_str(), kCFStringEncodingUTF8);
  const void* sub_keys[]{CFSTR(kAudioSubDeviceUIDKey)};
  const void* sub_values[]{output};
  const auto sub = CFDictionaryCreate(nullptr, sub_keys, sub_values, 1,
    &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
  const void* subs[]{sub};
  const auto list = CFArrayCreate(nullptr, subs, 1, &kCFTypeArrayCallBacks);
  const void* keys[]{CFSTR(kAudioAggregateDeviceNameKey), CFSTR(kAudioAggregateDeviceUIDKey),
    CFSTR(kAudioAggregateDeviceMainSubDeviceKey), CFSTR(kAudioAggregateDeviceSubDeviceListKey),
    CFSTR(kAudioAggregateDeviceIsPrivateKey)};
  const void* values[]{CFSTR("FluidEQ Volume Test"), uid, output, list, kCFBooleanFalse};
  const auto description = CFDictionaryCreate(nullptr, keys, values, 5,
    &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
  AudioObjectID device = kAudioObjectUnknown;
  const auto status = AudioHardwareCreateAggregateDevice(description, &device);
  CFRelease(description); CFRelease(list); CFRelease(sub);
  CFRelease(output); CFRelease(uid); CFRelease(uuid);
  return status == noErr ? device : kAudioObjectUnknown;
}
}
int main() {
  const auto original = fluideq_mac::default_output_device();
  if (original == kAudioObjectUnknown) return 77;
  Change changes;
  if (AudioObjectAddPropertyListener(kAudioObjectSystemObject, &kDefault,
                                    Change::changed, &changes) != noErr) return 1;
  const auto alternate = aggregate(fluideq_mac::device_uid(original));
  if (alternate == kAudioObjectUnknown) {
    AudioObjectRemovePropertyListener(kAudioObjectSystemObject, &kDefault, Change::changed, &changes);
    return 1;
  }
  std::printf("ready\t%u\t%u\n", alternate, original); std::fflush(stdout);
  int result = 0;
  for (std::string line; std::getline(std::cin, line);) {
    const auto target = line == "alternate" ? alternate : original;
    if ((line != "alternate" && line != "original") || !changes.select(target)) { result = 1; break; }
    std::printf("applied\t%u\n", target); std::fflush(stdout);
  }
  // This fixture owns only its temporary device. It never writes audio or
  // volume, and restores the original route before deleting that device.
  if (!changes.select(original)) result = 1;
  if (AudioHardwareDestroyAggregateDevice(alternate) != noErr) result = 1;
  AudioObjectRemovePropertyListener(kAudioObjectSystemObject, &kDefault, Change::changed, &changes);
  return result;
}
