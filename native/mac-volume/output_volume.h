/* FluidEQ — GPL-3.0-or-later */
#pragma once
#include <CoreAudio/CoreAudio.h>
#include <optional>
#include <string>
#include <vector>

namespace feq::macvolume {
struct Reading {
  AudioObjectID device = kAudioObjectUnknown;
  std::optional<float> level;
  std::optional<bool> muted;
  bool can_set = false;
  bool can_mute = false;
  std::string line(bool applied) const;
};

// Only Core Audio's real output controls. No application/player gain or
// remembered "mute" stands in for a missing hardware capability.
class OutputVolume {
 public:
  OutputVolume(AudioObjectPropertyListenerProc changed, void* context);
  ~OutputVolume();
  Reading read();
  void set(float level, AudioObjectID expected);
  void mute(bool muted, AudioObjectID expected);
 private:
  struct Control { AudioObjectPropertyAddress address; bool writable; };
  void refresh();
  void unwatch();
  std::vector<Control> controls(AudioObjectPropertySelector selector, UInt32 channels);
  AudioObjectPropertyListenerProc changed_;
  void* context_;
  AudioObjectID device_ = kAudioObjectUnknown;
  std::vector<Control> levels_, mutes_;
  std::vector<AudioObjectPropertyAddress> watching_;
  std::vector<AudioObjectPropertyAddress> wanted_;
  std::vector<float> balance_;
};
}  // namespace feq::macvolume
