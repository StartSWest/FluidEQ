/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// First of all, and that order is load-bearing: the engine's configuration
// names a filter type `NO` (a notch), and Objective-C defines `NO` as a macro
// — which even `<CoreAudio/CoreAudio.h>` brings in when compiled as
// Objective-C++. Parsed before any of them, the engine's headers never see it.
#include "engine.h"

#include "system_tap.h"

#include <algorithm>

#include "output_devices.h"

#import <CoreAudio/AudioHardwareTapping.h>
#import <CoreAudio/CATapDescription.h>
#import <Foundation/Foundation.h>

namespace fluideq_mac {

namespace {

/**
 * The scratch the I/O thread may use, in frames per channel. A device's own
 * range is asked for first; these bound what it says, because the scratch is
 * allocated before the first cycle and never after.
 */
constexpr uint32_t kMinCapacity = 512;
constexpr uint32_t kMaxCapacity = 16384;

/** -90 dBFS, the Windows effect's line between sound and an idle stream. */
constexpr float kSilenceFloor = 3.2e-5f;

std::string status_text(OSStatus status) {
  return std::to_string(static_cast<long>(status));
}

}  // namespace

SystemTap::SystemTap(Engine& engine, std::function<void()> first_sound)
    : engine_(engine), first_sound_(std::move(first_sound)) {}

SystemTap::~SystemTap() { stop(); }

double SystemTap::sample_rate() const noexcept {
  return aggregate_ == kAudioObjectUnknown ? 0.0
                                           : nominal_sample_rate(aggregate_);
}

bool SystemTap::start(AudioObjectID output, std::string& error) {
  stop();
  @autoreleasepool {
    // Left out of the tap, or the engine's own output would be tapped, played
    // again, tapped again: a feedback loop at full volume. Refused outright
    // rather than started without it.
    const AudioObjectID self = own_process_object();
    if (self == kAudioObjectUnknown) {
      error = "this process could not be identified to Core Audio, so it "
              "could not be left out of its own tap";
      return false;
    }

    CATapDescription* description = [[CATapDescription alloc]
        initStereoGlobalTapButExcludeProcesses:@[ @(self) ]];
    description.name = @"FluidEQ Engine";
    description.UUID = [NSUUID UUID];
    // Private: the tap is this process's alone, invisible to every other app.
    description.privateTap = YES;
    // Silenced only while read. If this process stops reading — it quit, it
    // crashed, it was told to stop — the originals are heard again at once.
    description.muteBehavior = CATapMutedWhenTapped;

    OSStatus status = AudioHardwareCreateProcessTap(description, &tap_);
    if (status != noErr || tap_ == kAudioObjectUnknown) {
      tap_ = kAudioObjectUnknown;
      error = "the system audio tap could not be created (status " +
              status_text(status) + ")";
      return false;
    }

    const std::string output_uid = device_uid(output);
    if (output_uid.empty()) {
      AudioHardwareDestroyProcessTap(tap_);
      tap_ = kAudioObjectUnknown;
      error = "the output device has no identifier";
      return false;
    }
    NSString* output_id = [NSString stringWithUTF8String:output_uid.c_str()];
    NSString* aggregate_id = [NSString
        stringWithFormat:@"com.gigabytz.fluideq.engine.%@",
                         [[NSUUID UUID] UUIDString]];
    NSDictionary* composition = @{
      @(kAudioAggregateDeviceNameKey) : @"FluidEQ Engine",
      @(kAudioAggregateDeviceUIDKey) : aggregate_id,
      @(kAudioAggregateDeviceMainSubDeviceKey) : output_id,
      @(kAudioAggregateDeviceIsPrivateKey) : @YES,
      @(kAudioAggregateDeviceIsStackedKey) : @NO,
      @(kAudioAggregateDeviceTapAutoStartKey) : @YES,
      @(kAudioAggregateDeviceSubDeviceListKey) :
          @[ @{@(kAudioSubDeviceUIDKey) : output_id} ],
      @(kAudioAggregateDeviceTapListKey) : @[ @{
        @(kAudioSubTapUIDKey) : description.UUID.UUIDString,
        // The tap runs on the output's clock rather than its own, so the two
        // cannot drift apart over an evening of listening.
        @(kAudioSubTapDriftCompensationKey) : @YES,
      } ],
    };
    status = AudioHardwareCreateAggregateDevice(
        (__bridge CFDictionaryRef)composition, &aggregate_);
    if (status != noErr || aggregate_ == kAudioObjectUnknown) {
      aggregate_ = kAudioObjectUnknown;
      AudioHardwareDestroyProcessTap(tap_);
      tap_ = kAudioObjectUnknown;
      error = "the engine's audio device could not be created (status " +
              status_text(status) + ")";
      return false;
    }
  }

  const uint32_t range = max_buffer_frames(aggregate_);
  capacity_ = std::clamp(range == 0 ? 4096u : range, kMinCapacity,
                         kMaxCapacity);
  left_.assign(capacity_, 0.0f);
  right_.assign(capacity_, 0.0f);
  carried_.store(false, std::memory_order_relaxed);

  const OSStatus status =
      AudioDeviceCreateIOProcID(aggregate_, &SystemTap::io_proc, this, &proc_);
  if (status != noErr || proc_ == nullptr) {
    proc_ = nullptr;
    stop();
    error = "the engine's audio callback could not be installed (status " +
            status_text(status) + ")";
    return false;
  }
  output_ = output;
  return true;
}

bool SystemTap::resume(std::string& error) {
  if (playing_ || aggregate_ == kAudioObjectUnknown || proc_ == nullptr) {
    return playing_;
  }
  const OSStatus status = AudioDeviceStart(aggregate_, proc_);
  if (status != noErr) {
    error = "the engine's audio device would not start (status " +
            status_text(status) + ")";
    return false;
  }
  playing_ = true;
  return true;
}

void SystemTap::pause() noexcept {
  if (!playing_) {
    return;
  }
  // Returns only once the I/O thread is out of the callback.
  AudioDeviceStop(aggregate_, proc_);
  playing_ = false;
}

void SystemTap::stop() noexcept {
  if (aggregate_ != kAudioObjectUnknown) {
    if (proc_ != nullptr) {
      // Both return only once the I/O thread is out of the callback, which is
      // what lets the caller free the graphs the callback was running.
      pause();
      AudioDeviceDestroyIOProcID(aggregate_, proc_);
      proc_ = nullptr;
    }
    // The device before the tap it is built on.
    AudioHardwareDestroyAggregateDevice(aggregate_);
    aggregate_ = kAudioObjectUnknown;
  }
  if (tap_ != kAudioObjectUnknown) {
    AudioHardwareDestroyProcessTap(tap_);
    tap_ = kAudioObjectUnknown;
  }
  output_ = kAudioObjectUnknown;
}

OSStatus SystemTap::io_proc(AudioObjectID device, const AudioTimeStamp* now,
                            const AudioBufferList* input,
                            const AudioTimeStamp* input_time,
                            AudioBufferList* output,
                            const AudioTimeStamp* output_time,
                            void* context) {
  (void)device;
  (void)now;
  (void)input_time;
  (void)output_time;
  static_cast<SystemTap*>(context)->render(input, output);
  return noErr;
}

void SystemTap::render(const AudioBufferList* input,
                       AudioBufferList* output) noexcept {
  if (output == nullptr || output->mNumberBuffers == 0) {
    return;
  }
  // The cycle's length, from the first output stream. The HAL's I/O buffers
  // are 32-bit float in every stream, interleaved within a stream.
  const AudioBuffer& first = output->mBuffers[0];
  const uint32_t first_channels =
      first.mNumberChannels == 0 ? 1 : first.mNumberChannels;
  uint32_t frames = first.mDataByteSize /
                    static_cast<uint32_t>(first_channels * sizeof(float));
  frames = std::min(frames, capacity_);

  float* planar[kEngineChannels] = {left_.data(), right_.data()};
  std::fill_n(left_.data(), frames, 0.0f);
  std::fill_n(right_.data(), frames, 0.0f);

  // The tap, whatever streams it arrived in, into left and right.
  uint32_t tapped = 0;
  if (input != nullptr) {
    for (UInt32 index = 0; index < input->mNumberBuffers; ++index) {
      const AudioBuffer& buffer = input->mBuffers[index];
      const uint32_t channels =
          buffer.mNumberChannels == 0 ? 1 : buffer.mNumberChannels;
      const auto* samples = static_cast<const float*>(buffer.mData);
      if (samples != nullptr) {
        const uint32_t available = std::min(
            frames, buffer.mDataByteSize /
                        static_cast<uint32_t>(channels * sizeof(float)));
        for (uint32_t channel = 0; channel < channels; ++channel) {
          const uint32_t target = tapped + channel;
          if (target >= kEngineChannels) {
            break;
          }
          for (uint32_t frame = 0; frame < available; ++frame) {
            planar[target][frame] = samples[frame * channels + channel];
          }
        }
      }
      tapped += channels;
    }
  }
  if (tapped == 1) {
    // A mono tap feeds both sides rather than leaving the right one silent.
    std::copy_n(left_.data(), frames, right_.data());
  }

  // Once per start, and the scan stops at the first sample that settles it,
  // so the cost falls away as soon as music starts.
  if (!carried_.load(std::memory_order_relaxed)) {
    for (uint32_t frame = 0; frame < frames; ++frame) {
      const float left = left_[frame];
      const float right = right_[frame];
      if (left > kSilenceFloor || left < -kSilenceFloor ||
          right > kSilenceFloor || right < -kSilenceFloor) {
        carried_.store(true, std::memory_order_relaxed);
        if (first_sound_) {
          first_sound_();
        }
        break;
      }
    }
  }

  engine_.process(planar, frames);

  uint32_t outputs = 0;
  for (UInt32 index = 0; index < output->mNumberBuffers; ++index) {
    outputs += output->mBuffers[index].mNumberChannels == 0
                   ? 1
                   : output->mBuffers[index].mNumberChannels;
  }

  // Every output sample is written, so no stream plays whatever the buffer
  // held before: the result on the first two channels, silence on the rest,
  // and both sides folded together on a mono output.
  uint32_t base = 0;
  for (UInt32 index = 0; index < output->mNumberBuffers; ++index) {
    AudioBuffer& buffer = output->mBuffers[index];
    const uint32_t channels =
        buffer.mNumberChannels == 0 ? 1 : buffer.mNumberChannels;
    auto* samples = static_cast<float*>(buffer.mData);
    if (samples == nullptr) {
      base += channels;
      continue;
    }
    const uint32_t length = buffer.mDataByteSize /
                            static_cast<uint32_t>(channels * sizeof(float));
    for (uint32_t frame = 0; frame < length; ++frame) {
      for (uint32_t channel = 0; channel < channels; ++channel) {
        const uint32_t global = base + channel;
        float value = 0.0f;
        if (frame < frames) {
          if (outputs == 1) {
            value = 0.5f * (left_[frame] + right_[frame]);
          } else if (global < kEngineChannels) {
            value = planar[global][frame];
          }
        }
        samples[frame * channels + channel] = value;
      }
    }
    base += channels;
  }
}

}  // namespace fluideq_mac
