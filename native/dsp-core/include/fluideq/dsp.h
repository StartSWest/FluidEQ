/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The DSP core's entire public surface, as C rather than C++.
 *
 * C because this header is consumed by more than one kind of caller: the host
 * executable, the native unit tests, an offline renderer, and — if the
 * differential harness ever needs it — a WebAssembly build. A C++ interface
 * would tie every one of them to one compiler's ABI for no gain, since nothing
 * crossing this boundary is more complicated than a struct of numbers.
 *
 * No platform headers appear here or anywhere in dsp-core. The core must
 * compile with nothing but a standard library available.
 */
#ifndef FLUIDEQ_DSP_H
#define FLUIDEQ_DSP_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Bumped when a struct changes meaning or a field is removed.
 *
 * Checked by the host against the protocol version it speaks before a single
 * sample is processed. Adding a function does not bump it; changing what an
 * existing field means does.
 */
#define FEQ_ABI_VERSION 1

typedef struct FeqEngine FeqEngine;

typedef enum FeqStatus {
  FEQ_OK = 0,
  FEQ_ERR_INVALID_ARGUMENT = 1,
  FEQ_ERR_OUT_OF_MEMORY = 2,
  FEQ_ERR_UNSUPPORTED = 3,
  /** A parameter id this build does not know. Never coerced to a default. */
  FEQ_ERR_UNKNOWN_PARAMETER = 4,
  FEQ_ERR_NOT_PREPARED = 5
} FeqStatus;

typedef enum FeqResetReason {
  FEQ_RESET_STREAM_START = 0,
  FEQ_RESET_SEEK = 1,
  FEQ_RESET_DEVICE_CHANGE = 2,
  FEQ_RESET_PANIC = 3
} FeqResetReason;

/**
 * One fully resolved, already-clamped chain.
 *
 * "Already clamped" is a promise the renderer keeps by running every snapshot
 * through `clampDspSettings` before it is sent. The core does not re-derive
 * bounds: a second authority on what a value may be is a second answer, and
 * the two would drift the first time a range moved.
 *
 * `parameter_values` is indexed by the dense slot a parameter id maps to, not
 * by the id itself — see `feq_parameter_slot` in parameters.h. Ids are sparse
 * and permanent; slots are contiguous and may be renumbered by a rebuild,
 * which is exactly why nothing outside this process may use one.
 */
typedef struct FeqConfigV1 {
  uint32_t abi_version;
  uint32_t settings_revision;
  uint32_t parameter_count;
  const double* parameter_values;
} FeqConfigV1;

/**
 * What one block cost and what it contained.
 *
 * Accumulated by the audio thread into preallocated storage and drained by
 * whoever asks. Nothing in here is formatted, allocated or logged on the audio
 * thread; that is the telemetry thread's work.
 */
typedef struct FeqTelemetryV1 {
  uint32_t abi_version;
  uint64_t sequence;
  uint64_t frames_processed;
  uint32_t applied_revision;
  uint32_t latency_frames;
  /** Per channel, linear magnitude, peak over the reporting window. */
  float peak[2];
  /** Wall time the callback spent, in microseconds, over the window. */
  double callback_p50_us;
  double callback_p99_us;
  /** Blocks the host could not deliver on time. */
  uint64_t xruns;
  /** Telemetry records dropped because the ring was full. */
  uint64_t drops;
  /** Samples repaired because they arrived non-finite. */
  uint64_t repaired_samples;
} FeqTelemetryV1;

typedef struct FeqDiagnosticV1 {
  uint32_t abi_version;
  /** Matches `DSP_DIAGNOSTIC_CODES` in src/common/dsp/diagnostics.ts. */
  uint32_t code;
  uint32_t severity;
  uint64_t sample_frame;
  double value;
} FeqDiagnosticV1;

/**
 * Build an engine sized for the worst block the device may ever hand over.
 *
 * Every buffer the callback touches is allocated here, because the callback
 * may not allocate. `maximum_block_frames` is a ceiling and not a promise:
 * a block may arrive smaller, and often does.
 */
FeqEngine* feq_engine_create(uint32_t sample_rate,
                             uint32_t channels,
                             uint32_t maximum_block_frames);

void feq_engine_destroy(FeqEngine* engine);

/**
 * Build the next chain off the audio thread. May allocate; may take its time.
 *
 * Prepared and committed as two calls rather than one so that a long build —
 * a linear-phase kernel and its partitions — never happens between two blocks
 * of audio. Preparing twice without committing discards the first.
 */
FeqStatus feq_engine_prepare_config(FeqEngine* engine,
                                    const FeqConfigV1* config);

/**
 * Publish the prepared chain for the audio thread to adopt at a block edge.
 *
 * Cheap and non-blocking. The retired snapshot is released here, on the
 * calling thread, and never inside the callback.
 */
FeqStatus feq_engine_commit_prepared_config(FeqEngine* engine);

/**
 * One control's new value, for a drag rather than a preset.
 *
 * The newest value per (id, index) wins; nothing is queued. A gesture that has
 * already ended must not be replayed into the audio.
 */
FeqStatus feq_engine_set_parameter(FeqEngine* engine,
                                   uint32_t parameter_id,
                                   int32_t index,
                                   double value,
                                   uint32_t settings_revision);

void feq_engine_reset(FeqEngine* engine, FeqResetReason reason);

/**
 * The real-time entry point. Planar, non-interleaved, `channels` pointers.
 *
 * In-place is permitted: `input` and `output` may be the same pointers.
 *
 * This function allocates nothing, frees nothing, takes no lock another thread
 * can hold, waits on nothing, logs nothing, throws nothing and makes no OS
 * call. Everything it needs was built by `create` or by `prepare`.
 */
void feq_engine_process_planar(FeqEngine* engine,
                               const float* const* input,
                               float* const* output,
                               uint32_t frames);

uint32_t feq_engine_latency_frames(const FeqEngine* engine);

/** Drains one accumulated record. False when there is nothing new. */
bool feq_engine_try_read_telemetry(FeqEngine* engine, FeqTelemetryV1* out);

bool feq_engine_try_read_diagnostic(FeqEngine* engine, FeqDiagnosticV1* out);

/** Build identity, for the handshake and for support reports. */
const char* feq_core_version(void);
uint32_t feq_core_abi_version(void);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_DSP_H */
