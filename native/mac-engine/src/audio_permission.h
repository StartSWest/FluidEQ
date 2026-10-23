/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether macOS lets this process hear what the Mac plays.
 *
 * A process tap is allowed by macOS's privacy settings, under Screen & System
 * Audio Recording — either list there: the whole screen and its sound, or the
 * sound alone. coreaudiod asks on behalf of the app responsible for this
 * process (FluidEQ once installed, whatever started `pnpm dev` in
 * development), so that is whose answer this reads.
 *
 * There is no public question for it. `TCCAccessPreflight` is the privacy
 * service's own, the one Mac audio tools read: looked up at runtime, read
 * only, and a macOS without it answers `unknown`, which changes nothing — the
 * engine taps as it always did and macOS asks the listener itself.
 */
#ifndef FLUIDEQ_MAC_ENGINE_AUDIO_PERMISSION_H
#define FLUIDEQ_MAC_ENGINE_AUDIO_PERMISSION_H

namespace fluideq_mac {

enum class AudioPermission {
  /** Allowed, in either list. */
  granted,
  /** The listener said no to the sound, and has not allowed the screen. */
  denied,
  /** Not asked yet, or not answerable here: the first tap makes macOS ask. */
  unknown,
};

AudioPermission audio_permission() noexcept;

/** `granted`, `denied` or `unknown`: what `--audio-permission` prints. */
const char* audio_permission_word(AudioPermission permission) noexcept;

}  // namespace fluideq_mac

#endif  // FLUIDEQ_MAC_ENGINE_AUDIO_PERMISSION_H
