/* FluidEQ — GPL-3.0-or-later */
#include "output_volume.h"
#include "output_devices.h"
#include <algorithm>
#include <cmath>
#include <cstdio>

namespace feq::macvolume {
namespace {
AudioObjectPropertyAddress address(AudioObjectPropertySelector selector,
                                  UInt32 channel = 0,
                                  AudioObjectPropertyScope scope = kAudioObjectPropertyScopeOutput) {
  return {selector, scope, channel};
}
template <class T>
std::optional<T> property(AudioObjectID device, const AudioObjectPropertyAddress& where) {
  T value{};
  UInt32 size = sizeof(value);
  if (AudioObjectGetPropertyData(device, &where, 0, nullptr, &size, &value) != noErr ||
      size != sizeof(value)) return std::nullopt;
  return value;
}
UInt32 channel_count(AudioObjectID device) {
  const auto where = address(kAudioDevicePropertyStreamConfiguration);
  UInt32 size = 0;
  if (AudioObjectGetPropertyDataSize(device, &where, 0, nullptr, &size) != noErr ||
      size < sizeof(AudioBufferList) || size > 65536) return 0;
  std::vector<uint8_t> bytes(size);
  auto* list = reinterpret_cast<AudioBufferList*>(bytes.data());
  if (AudioObjectGetPropertyData(device, &where, 0, nullptr, &size, list) != noErr) return 0;
  UInt32 count = 0;
  for (UInt32 i = 0; i < list->mNumberBuffers; ++i) count += list->mBuffers[i].mNumberChannels;
  return std::min(count, 64u);
}
bool same(const AudioObjectPropertyAddress& a, const AudioObjectPropertyAddress& b) {
  return a.mSelector == b.mSelector && a.mScope == b.mScope && a.mElement == b.mElement;
}
}

std::string Reading::line(bool applied) const {
  if (device == kAudioObjectUnknown) return "none";
  char value[32]{};
  if (level) std::snprintf(value, sizeof(value), "%.4f", static_cast<double>(*level));
  return std::string(applied ? "applied\t" : "volume\t") + (level ? value : "-") +
    "\t" + (muted ? (*muted ? "1" : "0") : "-") +
    "\t" + (can_set ? "1" : "0") + "\t" + (can_mute ? "1" : "0") +
    "\t" + std::to_string(device);
}
OutputVolume::OutputVolume(AudioObjectPropertyListenerProc changed, void* context)
  : changed_(changed), context_(context) {}
OutputVolume::~OutputVolume() { unwatch(); }
void OutputVolume::unwatch() {
  for (const auto& where : watching_)
    AudioObjectRemovePropertyListener(device_, &where, changed_, context_);
  watching_.clear();
}
std::vector<OutputVolume::Control> OutputVolume::controls(
    AudioObjectPropertySelector selector, UInt32 channels) {
  std::vector<Control> result;
  for (UInt32 channel = 0; channel <= channels; ++channel) {
    const auto where = address(selector, channel);
    UInt32 size = sizeof(Float32);
    UInt32 bits = 0;
    if (!AudioObjectHasProperty(device_, &where) ||
        AudioObjectGetPropertyData(device_, &where, 0, nullptr, &size, &bits) != noErr) continue;
    Boolean writable = false;
    const bool can_write = AudioObjectIsPropertySettable(device_, &where, &writable) == noErr && writable;
    result.push_back({where, can_write});
    if (channel == 0) break; // A main control already covers the output.
  }
  return result;
}
void OutputVolume::refresh() {
  const auto current = fluideq_mac::default_output_device();
  if (current != device_) { unwatch(); wanted_.clear(); balance_.clear(); device_ = current; }
  levels_.clear(); mutes_.clear();
  if (device_ == kAudioObjectUnknown) return;
  const auto channels = channel_count(device_);
  levels_ = controls(kAudioDevicePropertyVolumeScalar, channels);
  mutes_ = controls(kAudioDevicePropertyMute, channels);
  std::vector<AudioObjectPropertyAddress> wanted{
    address(kAudioObjectPropertyControlList, 0, kAudioObjectPropertyScopeGlobal),
    address(kAudioDevicePropertyDeviceIsAlive, 0, kAudioObjectPropertyScopeGlobal),
    address(kAudioDevicePropertyStreamConfiguration),
  };
  for (const auto& control : levels_) wanted.push_back(control.address);
  for (const auto& control : mutes_) wanted.push_back(control.address);
  if (changed_ == nullptr) return;
  wanted.erase(std::remove_if(wanted.begin(), wanted.end(), [this](const auto& where) {
    return !AudioObjectHasProperty(device_, &where);
  }), wanted.end());
  if (wanted.size() == wanted_.size() && std::equal(wanted.begin(), wanted.end(), wanted_.begin(), same)) return;
  unwatch();
  wanted_ = wanted;
  for (const auto& where : wanted) {
    if (AudioObjectAddPropertyListener(device_, &where, changed_, context_) == noErr)
      watching_.push_back(where);
  }
}
Reading OutputVolume::read() {
  refresh();
  Reading out;
  out.device = device_;
  out.can_set = !levels_.empty();
  for (const auto& control : levels_) {
    const auto value = property<Float32>(device_, control.address);
    if (!value || !std::isfinite(*value) || *value < 0 || *value > 1) {
      out.level.reset(); out.can_set = false; break;
    }
    out.level = std::max(out.level.value_or(0), *value);
    out.can_set = out.can_set && control.writable && (changed_ == nullptr ||
      std::any_of(watching_.begin(), watching_.end(), [&](const auto& where) { return same(where, control.address); }));
  }
  out.can_mute = !mutes_.empty();
  for (const auto& control : mutes_) {
    const auto value = property<UInt32>(device_, control.address);
    if (!value) { out.muted.reset(); out.can_mute = false; break; }
    out.muted = out.muted.value_or(true) && *value != 0;
    out.can_mute = out.can_mute && control.writable && (changed_ == nullptr ||
      std::any_of(watching_.begin(), watching_.end(), [&](const auto& where) { return same(where, control.address); }));
  }
  if (out.level && *out.level > 0) {
    balance_.clear();
    for (const auto& control : levels_)
      balance_.push_back(property<Float32>(device_, control.address).value_or(0) / *out.level);
  }
  return out;
}
void OutputVolume::set(float level, AudioObjectID expected) {
  const auto before = read();
  if (!before.can_set || before.device != expected || !std::isfinite(level) || level < 0 || level > 1) return;
  // Scale channel controls together, preserving the output's existing balance.
  for (size_t index = 0; index < levels_.size(); ++index) {
    const auto& control = levels_[index];
    const Float32 value = level * (balance_.size() == levels_.size() ? balance_[index] : 1);
    if (AudioObjectSetPropertyData(device_, &control.address, 0, nullptr, sizeof(value), &value) != noErr) return;
  }
}
void OutputVolume::mute(bool muted, AudioObjectID expected) {
  const auto before = read();
  if (!before.can_mute || before.device != expected) return;
  const UInt32 value = muted ? 1 : 0;
  for (const auto& control : mutes_)
    if (AudioObjectSetPropertyData(device_, &control.address, 0, nullptr, sizeof(value), &value) != noErr) return;
}
}  // namespace feq::macvolume
