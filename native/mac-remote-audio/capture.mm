/* FluidEQ — GPL-3.0-or-later */
#include "lan.h"
#include "capture_queue.h"
#include "audio_permission.h"
#include "output_devices.h"
#include "monitor_source.h"
#include "fluideq/doorbell.h"
#include <algorithm>
#include <atomic>
#include <filesystem>
#include <libproc.h>
#include <thread>
#include <unistd.h>
#import <CoreAudio/AudioHardwareTapping.h>
#import <CoreAudio/CATapDescription.h>
#import <Foundation/Foundation.h>

namespace feq::maclan {
namespace {
constexpr uint32_t kCapacity = 16384;
AudioObjectPropertyAddress address(AudioObjectPropertySelector selector) {
  return {selector, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain};
}
std::string process_path(pid_t pid) {
  char path[PROC_PIDPATHINFO_MAXSIZE]{};
  return proc_pidpath(pid, path, sizeof(path)) > 0 ? path : "";
}
}

struct Capture::State {
  State(Replies& out, Wake& changes, CapturePurpose purpose)
      : replies(out), wake(changes), purpose(purpose) {
    helper_path = process_path(getpid());
    engine_path = (std::filesystem::path(helper_path).parent_path() /
                   "FluidEQ-Engine").string();
    for (const auto selector : selectors) {
      const auto property = address(selector);
      AudioObjectAddPropertyListener(kAudioObjectSystemObject, &property, changed, this);
    }
  }
  ~State() {
    stop();
    const auto running = address(kAudioProcessPropertyIsRunningOutput);
    for (const auto process : watched_engines)
      AudioObjectRemovePropertyListener(process, &running, changed, this);
    for (const auto selector : selectors) {
      const auto property = address(selector);
      AudioObjectRemovePropertyListener(kAudioObjectSystemObject, &property, changed, this);
    }
  }

  std::vector<AudioObjectID> tap_processes() {
    std::vector<AudioObjectID> result;
    std::vector<AudioObjectID> engines;
    const auto own = fluideq_mac::own_process_object();
    if (purpose == CapturePurpose::network && own != kAudioObjectUnknown) result.push_back(own);
    for (const auto process : fluideq_mac::process_objects()) {
      pid_t pid = 0;
      UInt32 size = sizeof(pid);
      const auto property = address(kAudioProcessPropertyPID);
      if (AudioObjectGetPropertyData(process, &property, 0, nullptr, &size, &pid) == noErr) {
        const auto path = process_path(pid);
        if (purpose == CapturePurpose::monitor && path == engine_path) {
          engines.push_back(process);
          if (fluideq_mac::is_running_output(process)) result.push_back(process);
        }
        // Replaced LAN helpers can overlap while closing; neither helper's
        // received sound belongs in the outgoing stream.
        if (purpose == CapturePurpose::network &&
            (path == engine_path || pid == getpid() || path == helper_path))
          result.push_back(process);
      }
    }
    std::sort(result.begin(), result.end());
    result.erase(std::unique(result.begin(), result.end()), result.end());
    const auto running = address(kAudioProcessPropertyIsRunningOutput);
    for (const auto process : watched_engines)
      if (std::find(engines.begin(), engines.end(), process) == engines.end())
        AudioObjectRemovePropertyListener(process, &running, changed, this);
    for (const auto process : engines)
      if (std::find(watched_engines.begin(), watched_engines.end(), process) == watched_engines.end())
        AudioObjectAddPropertyListener(process, &running, changed, this);
    watched_engines = std::move(engines);
    return result;
  }
  NSArray<NSNumber*>* numbers(const std::vector<AudioObjectID>& ids) {
    NSMutableArray<NSNumber*>* result = [NSMutableArray array];
    for (const auto id : ids) [result addObject:@(id)];
    return result;
  }

  bool start(std::string& error) {
    stop();
    if (fluideq_mac::audio_permission() == fluideq_mac::AudioPermission::denied) {
      error = "System Audio Recording permission was refused";
      return false;
    }
    output = fluideq_mac::default_output_device();
    const auto self = fluideq_mac::own_process_object();
    if (output == kAudioObjectUnknown ||
        (purpose == CapturePurpose::network && self == kAudioObjectUnknown)) {
      error = output == kAudioObjectUnknown ? "No default audio output device"
                                           : "The capture process could not be identified";
      return false;
    }
    selected_processes = tap_processes();
    // The playback and capture live in THIS process. Excluding it is the
    // no-feedback guarantee, independent of which computer pasted the code.
    if (purpose == CapturePurpose::network &&
        !std::binary_search(selected_processes.begin(), selected_processes.end(), self)) selected_processes.push_back(self);
    std::sort(selected_processes.begin(), selected_processes.end());
    // A process tap captures source PCM before the playback device's volume
    // and mute. Keep this off the device-output/processed-engine path: local
    // silence must never silence the outgoing stream or send received audio.
    NSString* uid = [NSString stringWithUTF8String:fluideq_mac::device_uid(output).c_str()];
    // A process tap still includes the originals silenced by another tap.
    // Reading every process added those originals to the engine's protected
    // copy: the meter reached +1.57 dB with Auto normalize on. While the
    // engine plays, read its final copy alone; otherwise read the direct mix.
    // Scoped to this output so a second-output mirror cannot feed itself.
    description = purpose == CapturePurpose::network
        ? [[CATapDescription alloc] initStereoGlobalTapButExcludeProcesses:numbers(selected_processes)]
        : monitor_source(numbers(selected_processes), uid);
    description.name = purpose == CapturePurpose::network ? @"FluidEQ Share Audio" : @"FluidEQ Live Output";
    description.UUID = [NSUUID UUID];
    description.privateTap = YES;
    description.muteBehavior = CATapUnmuted;
    OSStatus status = AudioHardwareCreateProcessTap(description, &tap);
    if (status != noErr || tap == kAudioObjectUnknown) {
      error = "The Share Audio tap could not open: " + std::to_string(status);
      stop(); return false;
    }
    AudioStreamBasicDescription format{};
    UInt32 size = sizeof(format);
    const auto format_property = address(kAudioTapPropertyFormat);
    if (AudioObjectGetPropertyData(tap, &format_property, 0, nullptr, &size, &format) != noErr ||
        format.mFormatID != kAudioFormatLinearPCM || format.mBitsPerChannel != 32 ||
        (format.mFormatFlags & kAudioFormatFlagIsFloat) == 0) {
      error = "The Share Audio tap is not Float32 PCM";
      stop(); return false;
    }
    NSDictionary* composition = @{
      @(kAudioAggregateDeviceNameKey): @"FluidEQ Share Audio",
      @(kAudioAggregateDeviceUIDKey): [[NSUUID UUID] UUIDString],
      @(kAudioAggregateDeviceMainSubDeviceKey): uid,
      @(kAudioAggregateDeviceIsPrivateKey): @YES,
      @(kAudioAggregateDeviceIsStackedKey): @NO,
      @(kAudioAggregateDeviceTapAutoStartKey): @YES,
      @(kAudioAggregateDeviceSubDeviceListKey): @[@{@(kAudioSubDeviceUIDKey): uid}],
      @(kAudioAggregateDeviceTapListKey): @[@{
        @(kAudioSubTapUIDKey): description.UUID.UUIDString,
        @(kAudioSubTapDriftCompensationKey): @YES,
      }],
    };
    status = AudioHardwareCreateAggregateDevice((__bridge CFDictionaryRef)composition, &aggregate);
    const double actual_rate = status == noErr ? fluideq_mac::nominal_sample_rate(aggregate) : 0;
    if (actual_rate < 8000 || actual_rate > 384000) {
      error = "The Share Audio device could not open: " + std::to_string(status);
      stop(); return false;
    }
    rate = static_cast<uint32_t>(actual_rate);
    output_rate = fluideq_mac::nominal_sample_rate(output);
    queue = std::make_unique<CaptureQueue>(rate, 2);
    scratch.assign(kCapacity * 2, 0.0f);
    status = AudioDeviceCreateIOProcID(aggregate, io, this, &proc);
    if (status != noErr || proc == nullptr) {
      error = "The Share Audio callback could not open: " + std::to_string(status);
      stop(); return false;
    }
    live.store(true);
    writer = std::thread([this] {
      CapturePacket packet;
      while (live.load()) {
        const auto seen = bell.rung();
        while (queue->pop(packet)) {
          const auto& h = packet.header;
          if (!replies.send(purpose == CapturePurpose::network ? 10 : 11,
                            h.sequence, h.sample_rate, packet.samples.data(),
                            h.payload_bytes, h.channels, h.frames)) {
            live.store(false); wake.notify(); return;
          }
        }
        if (live.load()) bell.wait(seen);
      }
    });
    status = AudioDeviceStart(aggregate, proc);
    if (status != noErr) {
      error = "The Share Audio tap would not start: " + std::to_string(status);
      stop(); return false;
    }
    started = true;
    const auto rate_property = address(kAudioDevicePropertyNominalSampleRate);
    AudioObjectAddPropertyListener(output, &rate_property, changed, this);
    listening_rate = true;
    return true;
  }

  void stop() {
    if (listening_rate) {
      const auto property = address(kAudioDevicePropertyNominalSampleRate);
      AudioObjectRemovePropertyListener(output, &property, changed, this);
      listening_rate = false;
    }
    if (proc != nullptr) {
      if (started) AudioDeviceStop(aggregate, proc);
      AudioDeviceDestroyIOProcID(aggregate, proc); proc = nullptr;
    }
    started = false;
    live.store(false);
    if (queue) queue->stop();
    bell.ring();
    if (writer.joinable()) writer.join();
    queue.reset();
    if (aggregate != kAudioObjectUnknown) AudioHardwareDestroyAggregateDevice(aggregate);
    if (tap != kAudioObjectUnknown) AudioHardwareDestroyProcessTap(tap);
    aggregate = tap = kAudioObjectUnknown;
    description = nil;
  }

  bool refresh(std::string& error) {
    if (!started) return true;
    if (!live.load()) { error = "The Share Audio capture pipe stopped"; return false; }
    const auto current = fluideq_mac::default_output_device();
    if (current != output || fluideq_mac::nominal_sample_rate(current) != output_rate) return start(error);
    auto next = tap_processes();
    const auto own = fluideq_mac::own_process_object();
    if (purpose == CapturePurpose::network &&
        (own == kAudioObjectUnknown || !std::binary_search(next.begin(), next.end(), own))) {
      error = "Share Audio cannot safely exclude its own playback";
      return false;
    }
    if (next == selected_processes) return true;
    if (purpose == CapturePurpose::monitor) {
      update_monitor_source(description, numbers(next));
    } else {
      description.processes = numbers(next);
    }
    CATapDescription* updated = description;
    const auto property = address(kAudioTapPropertyDescription);
    const auto status = AudioObjectSetPropertyData(tap, &property, 0, nullptr, sizeof(updated), &updated);
    if (status != noErr) { error = "Could not update Share Audio's process exclusions"; return false; }
    selected_processes = std::move(next);
    return true;
  }

  static OSStatus changed(AudioObjectID, UInt32, const AudioObjectPropertyAddress*, void* context) {
    static_cast<State*>(context)->wake.notify(); return noErr;
  }
  // The sample-producing part never allocates, locks or touches a pipe.
  void render(const AudioBufferList* input, AudioBufferList* output_buffers) noexcept {
    if (output_buffers) for (UInt32 b = 0; b < output_buffers->mNumberBuffers; ++b) {
      auto& buffer = output_buffers->mBuffers[b];
      if (buffer.mData) std::fill_n(static_cast<float*>(buffer.mData), buffer.mDataByteSize / sizeof(float), 0.0f);
    }
    if (!input || input->mNumberBuffers == 0 || !queue) return;
    const auto& first = input->mBuffers[0];
    const uint32_t available = first.mDataByteSize / (std::max(1u, first.mNumberChannels) * sizeof(float));
    const auto frames = std::min(kCapacity, available);
    std::fill_n(scratch.data(), frames * 2, 0.0f);
    uint32_t base = 0;
    for (UInt32 b = 0; b < input->mNumberBuffers; ++b) {
      const auto& buffer = input->mBuffers[b];
      const auto channels = std::max(1u, buffer.mNumberChannels);
      const auto count = std::min<uint32_t>(frames, buffer.mDataByteSize / (channels * sizeof(float)));
      const auto* samples = static_cast<const float*>(buffer.mData);
      if (samples) for (uint32_t c = 0; c < channels && base + c < 2; ++c)
        for (uint32_t f = 0; f < count; ++f) scratch[f * 2 + base + c] = samples[f * channels + c];
      base += channels;
    }
    if (base == 1) for (uint32_t f = 0; f < frames; ++f) scratch[f * 2 + 1] = scratch[f * 2];
    queue->push(scratch.data(), frames, false, available > kCapacity);
    bell.arm();
  }
  static OSStatus io(AudioObjectID, const AudioTimeStamp*, const AudioBufferList* input,
                     const AudioTimeStamp*, AudioBufferList* output,
                     const AudioTimeStamp*, void* context) {
    auto& self = *static_cast<State*>(context);
    self.render(input, output);
    // The owner rings after producing the period, just like the DSP host's
    // backend period_done hook. No pipe write or mutex on the audio path.
    self.bell.ring_if_armed();
    return noErr;
  }

  static constexpr AudioObjectPropertySelector selectors[]{
    kAudioHardwarePropertyProcessObjectList, kAudioHardwarePropertyDefaultOutputDevice,
    kAudioHardwarePropertyDevices};
  Replies& replies; Wake& wake;
  const CapturePurpose purpose;
  AudioObjectID tap = kAudioObjectUnknown, aggregate = kAudioObjectUnknown, output = kAudioObjectUnknown;
  AudioDeviceIOProcID proc = nullptr;
  CATapDescription* description = nil;
  uint32_t rate = 0;
  double output_rate = 0;
  bool started = false, listening_rate = false;
  std::atomic<bool> live{false};
  std::unique_ptr<CaptureQueue> queue;
  std::vector<float> scratch;
  std::vector<AudioObjectID> selected_processes;
  std::vector<AudioObjectID> watched_engines;
  std::string engine_path, helper_path;
  FeqDoorbell bell;
  std::thread writer;
};

Capture::Capture(Replies& replies, Wake& wake, CapturePurpose purpose)
    : state_(std::make_unique<State>(replies, wake, purpose)) {}
Capture::~Capture() = default;
bool Capture::start(std::string& error) { @autoreleasepool { return state_->start(error); } }
void Capture::stop() { state_->stop(); }
bool Capture::refresh(std::string& error) { @autoreleasepool { return state_->refresh(error); } }
bool Capture::active() const { return state_->started; }
}  // namespace feq::maclan
