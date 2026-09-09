/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The object Windows creates inside audiodg.exe, once per attached output.
 *
 * Everything about this class is shaped by where it runs. audiodg.exe is a
 * protected process that feeds every speaker on the machine: an exception
 * that escapes takes the system's audio down, a lock taken on the wrong
 * thread is a dropout, and there is no user interface to report anything to.
 * So the COM surface is hand-written rather than inherited from the SDK's
 * base class — there is nothing here that this code does not own — and the
 * split across two translation units is along the line that matters: this
 * file is everything Windows asks before audio starts, `apo_process.cpp` is
 * everything it asks while audio is running.
 */
#ifndef FLUIDEQ_ENGINE_APO_H
#define FLUIDEQ_ENGINE_APO_H

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <audioenginebaseapo.h>
// Where `APOInitSystemEffects3` lives — the shape Windows 11 hands this
// object, and the one whose size tells it apart from the two older ones.
#include <audioengineextensionapo.h>
#include <audiomediatype.h>
#include <mmdeviceapi.h>

#include <atomic>
#include <cstdint>
#include <memory>
#include <vector>

#include "fluideq_engine/config.h"
#include "log.h"
#include "watcher.h"

namespace fluideq_engine {

/**
 * `{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}` — the effect's class id.
 *
 * The helper writes this into `HKCR\CLSID` and into the audio stack's own
 * registration, and every attached endpoint's `FxProperties` names it. It is
 * part of the installed shape of the product: changing it strands every
 * machine that already has the old one attached.
 */
extern const CLSID kEngineClsid;

/** The single effect id reported through `IAudioSystemEffects2`. */
extern const GUID kEffectId;

/** The number of live objects, which is what `DllCanUnloadNow` answers with. */
extern std::atomic<long> g_object_count;

/** The only shape of audio this effect will take. */
struct ConnectionFormat {
  bool acceptable = false;
  uint32_t channels = 0;
  uint32_t rate = 0;
};

/**
 * Float32, 1 to 8 channels, any sample rate.
 *
 * Nothing else, and deliberately: the graph is float end to end, and an
 * effect that accepted 16-bit integers would have to convert both ways
 * around a chain whose whole point is that it does not quantise.
 */
ConnectionFormat describe_format(const WAVEFORMATEX* format);

class Apo final : public IAudioProcessingObject,
                  public IAudioProcessingObjectRT,
                  public IAudioProcessingObjectConfiguration,
                  public IAudioSystemEffects2 {
 public:
  Apo();
  ~Apo();

  Apo(const Apo&) = delete;
  Apo& operator=(const Apo&) = delete;

  // IUnknown, shared by all four interfaces.
  STDMETHODIMP QueryInterface(REFIID riid, void** object) override;
  STDMETHODIMP_(ULONG) AddRef() override;
  STDMETHODIMP_(ULONG) Release() override;

  // IAudioProcessingObject
  STDMETHODIMP Reset() override;
  STDMETHODIMP GetLatency(HNSTIME* time) override;
  STDMETHODIMP GetRegistrationProperties(APO_REG_PROPERTIES** properties)
      override;
  STDMETHODIMP Initialize(UINT32 size, BYTE* data) override;
  STDMETHODIMP IsInputFormatSupported(IAudioMediaType* opposite,
                                      IAudioMediaType* requested,
                                      IAudioMediaType** supported) override;
  STDMETHODIMP IsOutputFormatSupported(IAudioMediaType* opposite,
                                       IAudioMediaType* requested,
                                       IAudioMediaType** supported) override;
  STDMETHODIMP GetInputChannelCount(UINT32* channels) override;

  // IAudioProcessingObjectRT — the audio thread, and nothing else.
  STDMETHODIMP_(void)
  APOProcess(UINT32 input_count, APO_CONNECTION_PROPERTY** inputs,
             UINT32 output_count, APO_CONNECTION_PROPERTY** outputs) override;
  STDMETHODIMP_(UINT32) CalcInputFrames(UINT32 output_frames) override;
  STDMETHODIMP_(UINT32) CalcOutputFrames(UINT32 input_frames) override;

  // IAudioProcessingObjectConfiguration
  STDMETHODIMP LockForProcess(UINT32 input_count,
                              APO_CONNECTION_DESCRIPTOR** inputs,
                              UINT32 output_count,
                              APO_CONNECTION_DESCRIPTOR** outputs) override;
  STDMETHODIMP UnlockForProcess() override;

  // IAudioSystemEffects2 (IAudioSystemEffects itself is a marker).
  STDMETHODIMP GetEffectsList(LPGUID* effects, UINT* count,
                              HANDLE event) override;

 private:
  /** Reads the endpoint's guid and friendly name out of a device collection. */
  void read_endpoint(IMMDeviceCollection* collection, UINT index);
  /**
   * Whether this instance was created for ordinary playback.
   *
   * Windows creates a separate instance per signal-processing mode, and only
   * the default one carries what the user is listening to. An endpoint that
   * put this effect in communications or movie mode is worth a log line: it
   * is the difference between "the EQ does nothing" and "the EQ does nothing
   * while you are on a call".
   */
  bool is_default_processing_mode() const;
  /** Frees the locked resources. Never called while the audio thread runs. */
  void release_locked_state() noexcept;

  std::atomic<ULONG> references_{1};

  // Set once by `Initialize`, read by `LockForProcess`. Empty when Windows
  // gave this instance no device collection to look in, which the resolver
  // reads as "only configuration blocks with no `Device:` guard apply".
  Endpoint endpoint_;
  // All-zero until an init structure that carries one arrives, which is what
  // `is_default_processing_mode` reads as "the host never said".
  GUID processing_mode_ = {};
  bool initialized_ = false;

  // Locked state. `locked_` is only ever changed with the audio thread
  // stopped: Windows does not call `APOProcess` outside a lock.
  bool locked_ = false;
  uint32_t channels_ = 0;
  uint32_t sample_rate_ = 0;
  uint32_t max_frames_ = 0;

  // `channels_ * max_frames_` samples, and one pointer into it per channel.
  // Both are allocated in `LockForProcess` because the audio thread may not.
  std::vector<float> scratch_;
  std::vector<float*> planes_;

  GraphSlot slot_;
  std::unique_ptr<Log> log_;
  std::unique_ptr<Watcher> watcher_;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_APO_H
