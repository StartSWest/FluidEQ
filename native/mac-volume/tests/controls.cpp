/* FluidEQ — GPL-3.0-or-later */
#include "output_volume.h"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <map>
#include <tuple>
#include <vector>

namespace {
using Key = std::tuple<AudioObjectID, AudioObjectPropertySelector, UInt32>;
struct Value { UInt32 bits; bool writable; };
std::map<Key, Value> values;
AudioObjectID device = 1;
int writes = 0;
std::vector<Key> listeners;
bool listener_failed = false;
Key key(AudioObjectID id, const AudioObjectPropertyAddress* where) {
  return {id, where->mSelector, where->mElement};
}
void volume(AudioObjectID id, UInt32 channel, float level, bool writable = true) {
  UInt32 bits; std::memcpy(&bits, &level, sizeof(bits));
  values[{id, kAudioDevicePropertyVolumeScalar, channel}] = {bits, writable};
}
void require(bool good) { if (!good) { std::fputs("Volume capability assertion failed\n", stderr); std::exit(1); } }
OSStatus changed(AudioObjectID, UInt32, const AudioObjectPropertyAddress*, void*) { return noErr; }
}
namespace fluideq_mac { AudioObjectID default_output_device() noexcept { return device; } }
extern "C" {
Boolean AudioObjectHasProperty(AudioObjectID id, const AudioObjectPropertyAddress* where) {
  return values.contains(key(id, where));
}
OSStatus AudioObjectIsPropertySettable(AudioObjectID id, const AudioObjectPropertyAddress* where, Boolean* result) {
  const auto found = values.find(key(id, where));
  if (found == values.end()) return kAudioHardwareUnknownPropertyError;
  *result = found->second.writable; return noErr;
}
OSStatus AudioObjectGetPropertyDataSize(AudioObjectID, const AudioObjectPropertyAddress* where, UInt32, const void*, UInt32* size) {
  if (where->mSelector != kAudioDevicePropertyStreamConfiguration) return kAudioHardwareUnknownPropertyError;
  *size = sizeof(AudioBufferList); return noErr;
}
OSStatus AudioObjectGetPropertyData(AudioObjectID id, const AudioObjectPropertyAddress* where, UInt32, const void*, UInt32* size, void* data) {
  if (where->mSelector == kAudioDevicePropertyStreamConfiguration) {
    auto* list = static_cast<AudioBufferList*>(data);
    list->mNumberBuffers = 1; list->mBuffers[0] = {2, 0, nullptr}; return noErr;
  }
  const auto found = values.find(key(id, where));
  if (found == values.end() || *size < sizeof(UInt32)) return kAudioHardwareUnknownPropertyError;
  *size = sizeof(UInt32); std::memcpy(data, &found->second.bits, sizeof(UInt32)); return noErr;
}
OSStatus AudioObjectSetPropertyData(AudioObjectID id, const AudioObjectPropertyAddress* where, UInt32, const void*, UInt32 size, const void* data) {
  const auto found = values.find(key(id, where));
  if (found == values.end() || !found->second.writable || size != sizeof(UInt32)) return kAudioHardwareIllegalOperationError;
  std::memcpy(&found->second.bits, data, sizeof(UInt32)); ++writes; return noErr;
}
OSStatus AudioObjectAddPropertyListener(AudioObjectID id, const AudioObjectPropertyAddress* where, AudioObjectPropertyListenerProc, void*) {
  if (listener_failed) return kAudioHardwareIllegalOperationError;
  listeners.push_back(key(id, where)); return noErr;
}
OSStatus AudioObjectRemovePropertyListener(AudioObjectID id, const AudioObjectPropertyAddress* where, AudioObjectPropertyListenerProc, void*) {
  const auto target = key(id, where);
  for (auto item = listeners.begin(); item != listeners.end(); ++item)
    if (*item == target) { listeners.erase(item); break; }
  return noErr;
}
}
int main() {
  feq::macvolume::OutputVolume output(nullptr, nullptr);
  volume(1, 0, 0.7f);
  values[{1, kAudioDevicePropertyMute, 0}] = {0, true};
  auto reading = output.read();
  require(reading.can_set && reading.can_mute && !*reading.muted);
  output.set(0.5f, 1); require(std::abs(*output.read().level - 0.5f) < 0.001f);
  output.mute(true, 1); require(*output.read().muted && *output.read().level == 0.5f);
  output.mute(false, 1); require(!*output.read().muted);
  // Fixed-level HDMI/virtual outputs must not acquire a fake player gain.
  device = 2; reading = output.read();
  require(!reading.level && !reading.muted && !reading.can_set && !reading.can_mute);
  const int before = writes;
  output.set(0.9f, 1); output.mute(true, 1); require(writes == before);
  volume(2, 0, 0.4f, false); reading = output.read();
  require(reading.level && !reading.can_set);
  output.set(0.9f, 2); require(writes == before);
  // Channel-only controls preserve balance, including zero then back up.
  device = 3; volume(3, 1, 0.25f); volume(3, 2, 0.5f);
  require(output.read().can_set && !output.read().can_mute);
  output.set(0, 3); output.set(0.8f, 3);
  require(std::abs(*output.read().level - 0.8f) < 0.001f);
  Float32 left; const auto bits = values[{3, kAudioDevicePropertyVolumeScalar, 1}].bits;
  std::memcpy(&left, &bits, sizeof(left)); require(std::abs(left - 0.4f) < 0.001f);
  // A command for the previous output cannot affect its replacement.
  const int after = writes; output.set(1, 1); require(writes == after);
  device = kAudioObjectUnknown; require(output.read().line(false) == "none");
  // Real watches follow native output identity and remove the old listeners.
  {
    device = 1;
    feq::macvolume::OutputVolume watched(changed, nullptr);
    require(watched.read().can_set && watched.read().can_mute && listeners.size() == 2);
    device = 2; reading = watched.read();
    require(reading.device == 2 && !reading.can_set && !reading.can_mute);
    require(listeners.size() == 1 && std::get<0>(listeners.front()) == 2);
    device = 1; require(watched.read().can_set && listeners.size() == 2);
  }
  require(listeners.empty());
  // A readable control whose live notifications cannot be followed is not
  // advertised as usable by the shared fader.
  listener_failed = true;
  feq::macvolume::OutputVolume unwatched(changed, nullptr);
  reading = unwatched.read();
  require(reading.level && reading.muted && !reading.can_set && !reading.can_mute);
  std::puts("Mac output controls, unsupported capabilities, balance and stale writes: PASS");
}
