/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "audio_permission.h"

#include <CoreFoundation/CoreFoundation.h>
#include <dlfcn.h>

namespace fluideq_mac {

namespace {

/** The privacy service's answers: 0 allowed, 1 refused, anything else not yet. */
constexpr int kAllowed = 0;
constexpr int kRefused = 1;
constexpr int kNoAnswer = -1;

using Preflight = int (*)(CFStringRef service, CFDictionaryRef options);

/** Looked up once; null where this macOS does not have it. */
Preflight preflight_function() noexcept {
  static const Preflight found = []() -> Preflight {
    void* framework = dlopen(
        "/System/Library/PrivateFrameworks/TCC.framework/Versions/A/TCC",
        RTLD_NOW);
    if (framework == nullptr) {
      return nullptr;
    }
    return reinterpret_cast<Preflight>(
        dlsym(framework, "TCCAccessPreflight"));
  }();
  return found;
}

int ask(Preflight preflight, const char* service) noexcept {
  CFStringRef name =
      CFStringCreateWithCString(nullptr, service, kCFStringEncodingUTF8);
  if (name == nullptr) {
    return kNoAnswer;
  }
  const int answer = preflight(name, nullptr);
  CFRelease(name);
  return answer;
}

}  // namespace

AudioPermission audio_permission() noexcept {
  const Preflight preflight = preflight_function();
  if (preflight == nullptr) {
    return AudioPermission::unknown;
  }
  // The sound alone first, the list macOS adds an app to when it asks; the
  // screen's list allows the sound as well, and it is the one that allowed
  // the engine in development (coreaudiod checked it for Terminal,
  // 2026-09-21).
  const int sound = ask(preflight, "kTCCServiceAudioCapture");
  if (sound == kAllowed ||
      ask(preflight, "kTCCServiceScreenCapture") == kAllowed) {
    return AudioPermission::granted;
  }
  return sound == kRefused ? AudioPermission::denied
                           : AudioPermission::unknown;
}

const char* audio_permission_word(AudioPermission permission) noexcept {
  switch (permission) {
    case AudioPermission::granted:
      return "granted";
    case AudioPermission::denied:
      return "denied";
    case AudioPermission::unknown:
      return "unknown";
  }
  return "unknown";
}

}  // namespace fluideq_mac
