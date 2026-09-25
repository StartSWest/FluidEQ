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

/**
 * Called on the device thread once a period has been handed to the device.
 *
 * The render callback may not make a system call, so the threads its block
 * gave work to — the decoder, the voice worker, telemetry — are only ARMED
 * inside it (`fluideq/doorbell.h`). This is where they are rung: between two
 * periods, the one just produced already the device's. A wake here is a
 * system call and costs no deadline; it must still not block, allocate or
 * take a lock, because the next period is coming.
 */
using FeqPeriodDoneFn = void (*)(void* context);

/**
 * Called from any thread — a Windows notification, the device thread on its
 * way out — when `needs_reopen()` has just become true. Wakes whoever acts on
 * it, and nothing more: it must not block.
 */
using FeqReopenWantedFn = void (*)(void* context);

/** What the backend calls back, all with the same context. */
struct FeqBackendHooks {
  FeqRenderFn render = nullptr;
  FeqPeriodDoneFn period_done = nullptr;
  FeqReopenWantedFn reopen_wanted = nullptr;
  void* context = nullptr;
};

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

  /**
   * Did the last `open` fail because this machine has no output at all?
   *
   * The distinction the caller needs is between a defect and a fact about the
   * hardware. A build agent has no sound card, so opening an endpoint there
   * fails forever and correctly, and reporting that the same way as "the
   * device refused the format" makes a green tree indistinguishable from a
   * broken one — which is what happened to the weekly cold build.
   *
   * False by default and by design. A stub that refuses everything has not
   * discovered that a machine is silent; it has declined to look, and claiming
   * otherwise would turn every unimplemented platform into a skipped test.
   */
  virtual bool endpoint_absent() const { return false; }

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
   * The open about to be tried is a reopen: until one succeeds, any change to
   * the outputs is a reason to try again.
   *
   * A reopen is acknowledged BEFORE it is tried, so a change arriving during
   * the attempt is not lost. That leaves nothing holding the request when the
   * attempt itself fails — and an endpoint that has just gone away is exactly
   * when opening fails, so the one case this whole mechanism exists for was
   * also the one it gave up on: closed, silent, and nothing scheduled to try
   * again. The fix put the request straight back, and the telemetry thread's
   * 25 ms tick retried it forty times a second for the length of the outage.
   * The tick is gone: from this call until an open succeeds, a device
   * arriving, leaving or changing state, the default moving, or the audio
   * service coming back raises `needs_reopen` and calls `reopen_wanted` —
   * which is what makes the host wait for the device rather than for a clock,
   * and never for the user to restart the app. Called before the attempt, so
   * a device that arrives while it is failing is not missed either.
   *
   * A backend with no notifications ignores it: it never reopens at all.
   */
  virtual void await_endpoint() {}

  /** A human-readable name for the handshake and for support reports. */
  virtual const char* name() const = 0;
  /** Canonical Windows endpoint GUID; empty where unavailable. Control thread. */
  virtual std::string endpoint_guid() const { return {}; }
};

/**
 * The backend for this platform, or a stub that refuses to open with a reason.
 *
 * A stub rather than a null pointer, so that every caller has one code path and
 * an unsupported platform reports itself through the same channel a broken
 * device would.
 */
std::unique_ptr<IAudioOutputBackend> create_audio_backend(
    const FeqBackendHooks& hooks);

#endif /* FLUIDEQ_HOST_AUDIO_BACKEND_H */
