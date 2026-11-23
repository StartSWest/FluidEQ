/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The voice cleaner's model, shared by every chain that runs it, and the
 * scheduling class its worker runs in.
 *
 * One session per model, not one per chain. The engine builds a new chain for
 * every rack edit, and each build used to load the runtime library, create an
 * environment and compile the model again on the watcher thread — while the
 * previous chain's worker was still racing its own one-hop deadline next to
 * it. The network's recurrent state is an explicit tensor each runtime keeps
 * for itself, so the session holds nothing per stream and ONNX Runtime allows
 * `Run` on one session from several threads at once.
 *
 * The types here are in a named namespace on purpose: MSVC names an anonymous
 * namespace after the source file's path, and a type that reaches a type
 * descriptor would carry that path into the DLL (`repro_test.cpp`).
 */

#ifndef FLUIDEQ_DENOISE_VOICE_MODEL_H
#define FLUIDEQ_DENOISE_VOICE_MODEL_H

#include <cstdint>
#include <string>
#include <vector>

#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
// windows.h defines `min` and `max` as macros, which turns every `std::min`
// into a syntax error rather than into anything a reader would suspect.
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

#include "onnxruntime_c_api.h"

namespace fluideq_voice {

/**
 * True when an ONNX Runtime call succeeded, releasing its status either way.
 *
 * A failed call hands back an `OrtStatus` the caller owns. Dropped on the
 * floor it is a small leak per failure, and GCC refuses to build the tree at
 * all over it (the header marks each of these results must-use; MSVC reads
 * the same mark as an annotation and says nothing).
 */
inline bool ort_ok(const OrtApi* api, OrtStatus* status) {
  if (status == nullptr) {
    return true;
  }
  api->ReleaseStatus(status);
  return false;
}

/** One loaded model: its runtime library, environment and session. */
struct VoiceModel {
  /** The model and runtime paths it was loaded from, joined. */
  std::string key;
#if defined(_WIN32)
  HMODULE library = nullptr;
#else
  void* library = nullptr;
#endif
  const OrtApi* api = nullptr;
  OrtEnv* env = nullptr;
  OrtSessionOptions* options = nullptr;
  OrtSession* session = nullptr;
  OrtMemoryInfo* memory = nullptr;
  /** The recurrent state a stream starts from, read out of the model. */
  std::vector<float> initial_state;
  /** Runtimes holding it; guarded by the cache's lock. */
  uint32_t users = 0;
};

/**
 * The model at these paths, loaded on first use and shared after. Null when
 * the library or the model will not load. Control thread only: it may
 * compile a model, which takes tens of milliseconds.
 */
VoiceModel* acquire_voice_model(const char* model_path,
                                const char* runtime_path);

/** One holder fewer; the last one frees the session and the library. */
void release_voice_model(VoiceModel* model);

/**
 * The calling thread in Windows' audio scheduling class (MMCSS, "Audio" at
 * its normal priority) for as long as this object lives.
 *
 * The worker has one 10 ms hop to deliver each block in low lag. At normal
 * priority inside audiodg it competed with every game thread for that, and a
 * late hop used to play the raw room. "Audio" at normal priority sits above
 * every ordinary thread and below the audio engine's own threads, which stay
 * the most important on the machine. `avrt.dll` is loaded by name, as the
 * runtime library is, so neither the engine nor the Library host links
 * anything new. Elsewhere, and where Windows refuses, it does nothing.
 */
class AudioWorkerPriority {
 public:
  AudioWorkerPriority();
  ~AudioWorkerPriority();
  AudioWorkerPriority(const AudioWorkerPriority&) = delete;
  AudioWorkerPriority& operator=(const AudioWorkerPriority&) = delete;
  /** Whether the thread is in the class, for the bench and the tests. */
  bool joined() const { return task_ != nullptr; }

 private:
  void* task_ = nullptr;
#if defined(_WIN32)
  HMODULE avrt_ = nullptr;
#endif
};

}  // namespace fluideq_voice

#endif /* FLUIDEQ_DENOISE_VOICE_MODEL_H */
