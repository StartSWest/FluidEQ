/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "../../audio_backend.h"

#include <AudioUnit/AudioUnit.h>
#include <CoreAudio/CoreAudio.h>

#include <atomic>
#include <cstring>
#include <string>
#include <vector>

namespace {

/** The engine is stereo; a wider device is fed its first two channels. */
constexpr uint32_t kEngineChannels = 2;

AudioObjectPropertyAddress global_address(AudioObjectPropertySelector what) {
  AudioObjectPropertyAddress address{};
  address.mSelector = what;
  address.mScope = kAudioObjectPropertyScopeGlobal;
  address.mElement = kAudioObjectPropertyElementMain;
  return address;
}

/** The system's current default output, or `kAudioObjectUnknown`. */
AudioDeviceID default_output_device() {
  AudioObjectPropertyAddress address =
      global_address(kAudioHardwarePropertyDefaultOutputDevice);
  AudioDeviceID device = kAudioObjectUnknown;
  UInt32 size = sizeof(device);
  const OSStatus status = AudioObjectGetPropertyData(
      kAudioObjectSystemObject, &address, 0, nullptr, &size, &device);
  return status == noErr ? device : kAudioObjectUnknown;
}

/**
 * What the device is actually clocked at.
 *
 * Asked rather than assumed for the same reason the Windows backend asks: a
 * machine set to 44.1 will not open at 48 because the engine would prefer it,
 * and the engine is rebuilt around the answer.
 */
double device_sample_rate(AudioDeviceID device) {
  AudioObjectPropertyAddress address =
      global_address(kAudioDevicePropertyNominalSampleRate);
  Float64 rate = 0.0;
  UInt32 size = sizeof(rate);
  if (AudioObjectGetPropertyData(device, &address, 0, nullptr, &size, &rate) !=
      noErr) {
    return 0.0;
  }
  return static_cast<double>(rate);
}

/**
 * The device period, in frames, which is how long a callback has to return.
 *
 * This is the denominator `FeqBackendStats::buffer_frames` exists to carry: a
 * figure in microseconds says nothing about whether the work fit.
 */
uint32_t device_buffer_frames(AudioDeviceID device) {
  AudioObjectPropertyAddress address =
      global_address(kAudioDevicePropertyBufferFrameSize);
  UInt32 frames = 0;
  UInt32 size = sizeof(frames);
  if (AudioObjectGetPropertyData(device, &address, 0, nullptr, &size,
                                 &frames) != noErr) {
    return 0;
  }
  return static_cast<uint32_t>(frames);
}

/**
 * AUHAL, which is a pull model with a render callback — the shape
 * `FeqRenderFn` already has.
 *
 * `kAudioFormatFlagIsNonInterleaved` is the reason this file is shorter than
 * its Windows counterpart. CoreAudio then hands the callback an
 * `AudioBufferList` holding one buffer per channel, which IS `float* const*
 * planar`: no scratch buffer, and no per-frame interleave loop.
 */
class CoreAudioBackend final : public IAudioOutputBackend {
 public:
  CoreAudioBackend(FeqRenderFn render, void* context)
      : render_(render), context_(context) {}

  ~CoreAudioBackend() override { close(); }

  bool open(FeqBackendFormat& negotiated, std::string& error) override {
    close();
    const AudioDeviceID device = default_output_device();
    if (device == kAudioObjectUnknown) {
      // A fact about the machine, not a defect. A build agent with no output
      // fails here forever and correctly, and reporting that as a refused
      // format would make a green tree indistinguishable from a broken one.
      endpoint_absent_ = true;
      error = "this machine has no default audio output device";
      return false;
    }
    endpoint_absent_ = false;

    const double rate = device_sample_rate(device);
    if (rate <= 0.0) {
      error = "the default output device did not report a sample rate";
      return false;
    }

    AudioComponentDescription wanted{};
    wanted.componentType = kAudioUnitType_Output;
    wanted.componentSubType = kAudioUnitSubType_HALOutput;
    wanted.componentManufacturer = kAudioUnitManufacturer_Apple;
    AudioComponent component = AudioComponentFindNext(nullptr, &wanted);
    if (component == nullptr) {
      error = "the HAL output audio unit is not available";
      return false;
    }
    if (AudioComponentInstanceNew(component, &unit_) != noErr ||
        unit_ == nullptr) {
      error = "the HAL output audio unit could not be created";
      return false;
    }

    if (AudioUnitSetProperty(unit_, kAudioOutputUnitProperty_CurrentDevice,
                             kAudioUnitScope_Global, 0, &device,
                             sizeof(device)) != noErr) {
      error = "the audio unit refused the default output device";
      close();
      return false;
    }

    const uint32_t period = device_buffer_frames(device);
    UInt32 slice = period > 0 ? period : 512;
    if (AudioUnitSetProperty(unit_, kAudioUnitProperty_MaximumFramesPerSlice,
                             kAudioUnitScope_Global, 0, &slice,
                             sizeof(slice)) != noErr) {
      error = "the audio unit refused the maximum block size";
      close();
      return false;
    }

    // Non-interleaved float32: one buffer per channel, which is the planar
    // contract exactly. `mBytesPerFrame` and `mBytesPerPacket` are ONE
    // sample's width in this layout, not the frame's — an interleaved-shaped
    // value here is accepted and then renders one channel of noise.
    AudioStreamBasicDescription format{};
    format.mSampleRate = rate;
    format.mFormatID = kAudioFormatLinearPCM;
    format.mFormatFlags =
        kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked |
        kAudioFormatFlagIsNonInterleaved;
    format.mFramesPerPacket = 1;
    format.mChannelsPerFrame = kEngineChannels;
    format.mBitsPerChannel = 32;
    format.mBytesPerFrame = sizeof(float);
    format.mBytesPerPacket = sizeof(float);
    if (AudioUnitSetProperty(unit_, kAudioUnitProperty_StreamFormat,
                             kAudioUnitScope_Input, 0, &format,
                             sizeof(format)) != noErr) {
      error = "the device refused non-interleaved 32-bit float stereo";
      close();
      return false;
    }

    AURenderCallbackStruct callback{};
    callback.inputProc = &CoreAudioBackend::render_trampoline;
    callback.inputProcRefCon = this;
    if (AudioUnitSetProperty(unit_, kAudioUnitProperty_SetRenderCallback,
                             kAudioUnitScope_Input, 0, &callback,
                             sizeof(callback)) != noErr) {
      error = "the audio unit refused the render callback";
      close();
      return false;
    }

    if (AudioUnitInitialize(unit_) != noErr) {
      error = "the audio unit failed to initialise";
      close();
      return false;
    }

    // Everything the callback touches is sized here, because it may not
    // allocate. `silence_` backs any channel the device does not give us.
    planar_pointers_.assign(kEngineChannels, nullptr);
    silence_.assign(slice, 0.0f);

    device_ = device;
    buffer_frames_ = slice;
    underruns_.store(0, std::memory_order_relaxed);
    periods_.store(0, std::memory_order_relaxed);
    add_listeners();

    negotiated.sample_rate = static_cast<uint32_t>(rate);
    negotiated.channels = kEngineChannels;
    negotiated.max_block_frames = slice;
    open_ = true;
    return true;
  }

  bool endpoint_absent() const override { return endpoint_absent_; }

  bool start(std::string& error) override {
    if (!open_) {
      error = "the device is not open";
      return false;
    }
    if (AudioOutputUnitStart(unit_) != noErr) {
      error = "the audio unit would not start";
      return false;
    }
    running_ = true;
    return true;
  }

  void close() override {
    remove_listeners();
    if (unit_ != nullptr) {
      if (running_) {
        AudioOutputUnitStop(unit_);
      }
      AudioUnitUninitialize(unit_);
      AudioComponentInstanceDispose(unit_);
      unit_ = nullptr;
    }
    running_ = false;
    open_ = false;
    device_ = kAudioObjectUnknown;
    buffer_frames_ = 0;
  }

  bool is_open() const override { return open_; }

  bool is_running() const override { return running_; }

  FeqBackendStats stats() const override {
    FeqBackendStats out{};
    out.underruns = underruns_.load(std::memory_order_relaxed);
    out.periods = periods_.load(std::memory_order_relaxed);
    out.buffer_frames = buffer_frames_;
    return out;
  }

  bool needs_reopen() const override {
    return reopen_.load(std::memory_order_relaxed);
  }

  void clear_reopen() override {
    reopen_.store(false, std::memory_order_relaxed);
  }

  void request_reopen() override {
    reopen_.store(true, std::memory_order_relaxed);
  }

  const char* name() const override { return "coreaudio"; }

 private:
  static OSStatus render_trampoline(void* refcon,
                                    AudioUnitRenderActionFlags* flags,
                                    const AudioTimeStamp* timestamp,
                                    UInt32 bus, UInt32 frames,
                                    AudioBufferList* data) {
    (void)flags;
    (void)timestamp;
    (void)bus;
    return static_cast<CoreAudioBackend*>(refcon)->render_period(frames, data);
  }

  /** The real-time thread. No allocation, no lock, no logging, no syscall. */
  OSStatus render_period(UInt32 frames, AudioBufferList* data) {
    const uint32_t supplied = data->mNumberBuffers;
    for (uint32_t buffer = 0; buffer < supplied; buffer += 1) {
      std::memset(data->mBuffers[buffer].mData, 0,
                  data->mBuffers[buffer].mDataByteSize);
    }
    const uint32_t channels = static_cast<uint32_t>(planar_pointers_.size());
    for (uint32_t channel = 0; channel < channels; channel += 1) {
      planar_pointers_[channel] =
          channel < supplied
              ? static_cast<float*>(data->mBuffers[channel].mData)
              : silence_.data();
    }
    render_(context_, planar_pointers_.data(), frames);
    periods_.fetch_add(1, std::memory_order_relaxed);
    return noErr;
  }

  /**
   * The default output changed, or this device overloaded.
   *
   * Both are answered rather than defaulted, because macOS has the
   * notification `audio_backend.h` says a platform should not pretend to
   * lack: a stream whose device is no longer the default stays technically
   * healthy and completely inaudible.
   */
  static OSStatus property_changed(AudioObjectID object, UInt32 count,
                                   const AudioObjectPropertyAddress* addresses,
                                   void* context) {
    (void)object;
    auto* self = static_cast<CoreAudioBackend*>(context);
    for (UInt32 index = 0; index < count; index += 1) {
      if (addresses[index].mSelector ==
          kAudioHardwarePropertyDefaultOutputDevice) {
        self->reopen_.store(true, std::memory_order_relaxed);
      }
      if (addresses[index].mSelector == kAudioDeviceProcessorOverload) {
        self->underruns_.fetch_add(1, std::memory_order_relaxed);
      }
    }
    return noErr;
  }

  void add_listeners() {
    AudioObjectPropertyAddress def =
        global_address(kAudioHardwarePropertyDefaultOutputDevice);
    AudioObjectAddPropertyListener(kAudioObjectSystemObject, &def,
                                   &CoreAudioBackend::property_changed, this);
    AudioObjectPropertyAddress overload =
        global_address(kAudioDeviceProcessorOverload);
    AudioObjectAddPropertyListener(device_, &overload,
                                   &CoreAudioBackend::property_changed, this);
    listening_ = true;
  }

  void remove_listeners() {
    if (!listening_) {
      return;
    }
    AudioObjectPropertyAddress def =
        global_address(kAudioHardwarePropertyDefaultOutputDevice);
    AudioObjectRemovePropertyListener(kAudioObjectSystemObject, &def,
                                      &CoreAudioBackend::property_changed,
                                      this);
    AudioObjectPropertyAddress overload =
        global_address(kAudioDeviceProcessorOverload);
    AudioObjectRemovePropertyListener(device_, &overload,
                                      &CoreAudioBackend::property_changed,
                                      this);
    listening_ = false;
  }

  FeqRenderFn render_ = nullptr;
  void* context_ = nullptr;
  AudioUnit unit_ = nullptr;
  AudioDeviceID device_ = kAudioObjectUnknown;
  bool open_ = false;
  bool running_ = false;
  bool listening_ = false;
  bool endpoint_absent_ = false;
  uint32_t buffer_frames_ = 0;
  std::atomic<uint64_t> underruns_{0};
  std::atomic<uint64_t> periods_{0};
  std::atomic<bool> reopen_{false};
  std::vector<float*> planar_pointers_;
  std::vector<float> silence_;
};

}  // namespace

std::unique_ptr<IAudioOutputBackend> create_audio_backend(FeqRenderFn render,
                                                          void* context) {
  return std::make_unique<CoreAudioBackend>(render, context);
}
