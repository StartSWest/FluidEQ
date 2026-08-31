/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The output device, behind an interface, so the engine never learns which OS
 * it is running on.
 *
 * Declared before any backend exists for macOS or Linux precisely so that the
 * Windows one cannot quietly become the shape of the abstraction. Everything
 * platform-specific lives under `platform/`; nothing above this line includes
 * a system header.
 */
#ifndef FLUIDEQ_HOST_AUDIO_BACKEND_H
#define FLUIDEQ_HOST_AUDIO_BACKEND_H

#include <cstdint>
#include <memory>
#include <string>

/**
 * What the device actually agreed to, which is rarely what was asked for.
 *
 * Shared-mode endpoints impose their own rate: a machine set to 44.1 kHz will
 * not open at 48 because the engine would prefer it. The engine is rebuilt
 * around this rather than the other way round, which is also why the whole
 * struct comes back out of `open` instead of going only in.
 */
struct FeqBackendFormat {
  uint32_t sample_rate = 0;
  uint32_t channels = 0;
  /** The largest block the device will ever ask for in one callback. */
  uint32_t max_block_frames = 0;
};

/**
 * Called on the real-time thread, once per device period.
 *
 * A plain function pointer and a context, not a `std::function`: constructing
 * one allocates, and copying one may. The callback contract from dsp.h applies
 * in full to whatever this points at — no allocation, no lock, no logging, no
 * system call.
 *
 * `planar` holds `channels` pointers, each with room for `frames`. It is
 * pre-zeroed; a source that writes nothing produces silence rather than the
 * previous period repeated.
 */
using FeqRenderFn = void (*)(void* context, float* const* planar,
                             uint32_t frames);

/** Counters the device thread keeps, read by the control thread. */
struct FeqBackendStats {
  uint64_t underruns = 0;
  uint64_t periods = 0;
  /**
   * The endpoint buffer, in frames, which is how long a callback has to return.
   *
   * Reported rather than assumed because it is the denominator of the only
   * question that matters for a dropout: not how long the callback took, but
   * what share of its budget it used. Ten milliseconds is the usual shared-mode
   * answer on Windows and it is not a guarantee — a device with a 3 ms period
   * gives the same work a third of the time, and a figure in microseconds says
   * nothing about which of those a machine is.
   *
   * Zero when no device is open. It reached the telemetry frame as a literal
   * zero for the life of the host before this, so anything downstream that drew
   * a latency figure was drawing one.
   */
  uint32_t buffer_frames = 0;
};

class IAudioOutputBackend {
 public:
  virtual ~IAudioOutputBackend() = default;

  /**
   * Claim the endpoint and report what it agreed to. No thread runs yet.
   *
   * Opening is what wakes the hardware — a DAC leaves its low-power state and
   * its noise floor becomes audible — so this is called when something is
   * about to be heard and at no other time. Idle means closed, not paused.
   *
   * Separate from `start` because the negotiated rate is not known until the
   * device has been asked, and the engine has to be rebuilt around it before
   * a single callback arrives. Fused into one call, the first period would
   * run against an engine still sized for whatever the last device wanted.
   */
  virtual bool open(FeqBackendFormat& negotiated, std::string& error) = 0;

  /** Begin the real-time thread. The engine must already match the format. */
  virtual bool start(std::string& error) = 0;

  /** Stop the thread and release the endpoint. Safe to call when not open. */
  virtual void close() = 0;

  /** The endpoint is claimed and its format is known. */
  virtual bool is_open() const = 0;

  /** The real-time thread is running and periods are being served. */
  virtual bool is_running() const = 0;

  virtual FeqBackendStats stats() const = 0;

  /**
   * Should this endpoint be closed and reopened?
   *
   * True once the system has changed which device is the default, or once the
   * render thread has stopped for a reason nobody asked for. Both leave a
   * stream that is technically healthy and inaudible: the old endpoint stays
   * valid, so WASAPI reports nothing and the audio simply goes where the
   * listener is not.
   *
   * Answered false by a backend that cannot tell, which is the honest default —
   * a platform with no notification API should not claim its device never
   * changes.
   */
  virtual bool needs_reopen() const { return false; }

  /** Acknowledge a reopen, so it is acted on once. */
  virtual void clear_reopen() {}

  /**
   * Ask for another attempt, because the last one did not succeed.
   *
   * A reopen is acknowledged BEFORE it is tried, so a change arriving during
   * the attempt is not lost. That leaves nothing holding the request when the
   * attempt itself fails — and an endpoint that has just gone away is exactly
   * when opening fails, so the one case this whole mechanism exists for was
   * also the one it gave up on: closed, silent, and nothing scheduled to try
   * again. Putting the request back is what makes it wait for the device to
   * come back rather than for the user to restart the app.
   */
  virtual void request_reopen() {}

  /** A human-readable name for the handshake and for support reports. */
  virtual const char* name() const = 0;
};

/**
 * The backend for this platform, or a stub that refuses to open with a reason.
 *
 * A stub rather than a null pointer, so that every caller has one code path and
 * an unsupported platform reports itself through the same channel a broken
 * device would.
 */
std::unique_ptr<IAudioOutputBackend> create_audio_backend(FeqRenderFn render,
                                                          void* context);

#endif /* FLUIDEQ_HOST_AUDIO_BACKEND_H */
