/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The voice cleaner's shared model and its worker's scheduling class
 * (`denoise_voice_model.h`).
 *
 * The runtime is loaded at RUNTIME rather than linked: `onnxruntime.dll`
 * already ships with the app for karaoke separation, so the library is asked
 * for by path and reached through `OrtGetApiBase`. A missing runtime is an
 * ordinary answer — no model, audio passes untouched — rather than a host
 * that will not start.
 */

#include "denoise_voice_model.h"

#include <cstddef>
#include <mutex>
#include <new>
#include <string>
#include <vector>

#if !defined(_WIN32)
#include <dlfcn.h>
#endif

namespace fluideq_voice {
namespace {

/** Every model loaded in this process, and the lock that guards the list. */
struct ModelCache {
  std::mutex lock;
  std::vector<VoiceModel*> models;
};

ModelCache& cache() {
  static ModelCache instance;
  return instance;
}

void* load_symbol(VoiceModel& model, const char* name) {
#if defined(_WIN32)
  return reinterpret_cast<void*>(GetProcAddress(model.library, name));
#else
  return dlsym(model.library, name);
#endif
}

void close_library(VoiceModel& model) {
  if (model.library == nullptr) {
    return;
  }
#if defined(_WIN32)
  FreeLibrary(model.library);
#else
  dlclose(model.library);
#endif
  model.library = nullptr;
}

void destroy_model(VoiceModel* model) {
  if (model == nullptr) {
    return;
  }
  const OrtApi* api = model->api;
  if (api != nullptr) {
    if (model->memory != nullptr) api->ReleaseMemoryInfo(model->memory);
    if (model->session != nullptr) api->ReleaseSession(model->session);
    if (model->options != nullptr) api->ReleaseSessionOptions(model->options);
    if (model->env != nullptr) api->ReleaseEnv(model->env);
  }
  close_library(*model);
  delete model;
}

/**
 * The state the network starts a stream from, read out of the model itself.
 *
 * Not zeros. The first two spans of the state vector are running normalisation
 * estimates, and the export embeds the values they must begin at; starting
 * them at zero makes the first seconds of every track come out wrong while the
 * estimates climb. Reading them from the model rather than baking them in
 * means a re-exported model brings its own.
 */
bool read_initial_state(VoiceModel& model) {
  const OrtApi* api = model.api;
  OrtModelMetadata* metadata = nullptr;
  if (!ort_ok(api, api->SessionGetModelMetadata(model.session, &metadata))) {
    return false;
  }
  OrtAllocator* allocator = nullptr;
  if (!ort_ok(api, api->GetAllocatorWithDefaultOptions(&allocator))) {
    api->ReleaseModelMetadata(metadata);
    return false;
  }

  auto lookup = [&](const char* key, std::string& out) -> bool {
    char* value = nullptr;
    if (!ort_ok(api, api->ModelMetadataLookupCustomMetadataMap(
                         metadata, allocator, key, &value)) ||
        value == nullptr) {
      return false;
    }
    out.assign(value);
    // The value is already copied out; a refused free is not a failed read.
    ort_ok(api, api->AllocatorFree(allocator, value));
    return true;
  };

  std::string size_text;
  std::string erb_size_text;
  std::string spec_size_text;
  std::string erb_init;
  std::string spec_init;
  const bool complete = lookup("state_size", size_text) &&
                        lookup("erb_norm_state_size", erb_size_text) &&
                        lookup("spec_norm_state_size", spec_size_text) &&
                        lookup("erb_norm_init", erb_init) &&
                        lookup("spec_norm_init", spec_init);
  api->ReleaseModelMetadata(metadata);
  if (!complete) {
    return false;
  }

  const size_t total = static_cast<size_t>(std::stol(size_text));
  const size_t erb = static_cast<size_t>(std::stol(erb_size_text));
  const size_t spec = static_cast<size_t>(std::stol(spec_size_text));
  if (total == 0 || erb + spec > total) {
    return false;
  }

  model.initial_state.assign(total, 0.0f);
  auto fill = [&](const std::string& csv, size_t at, size_t limit) {
    size_t index = 0;
    size_t from = 0;
    while (from <= csv.size() && index < limit) {
      const size_t comma = csv.find(',', from);
      const std::string piece = csv.substr(
          from, comma == std::string::npos ? std::string::npos : comma - from);
      if (!piece.empty()) {
        model.initial_state[at + index] = std::stof(piece);
        index += 1;
      }
      if (comma == std::string::npos) {
        break;
      }
      from = comma + 1;
    }
  };
  fill(erb_init, 0, erb);
  fill(spec_init, erb, spec);
  return true;
}

/** A model loaded fresh from these paths, or null. */
VoiceModel* load_model(const char* model_path, const char* runtime_path) {
  auto* model = new (std::nothrow) VoiceModel();
  if (model == nullptr) {
    return nullptr;
  }
#if defined(_WIN32)
  model->library = LoadLibraryA(runtime_path);
#else
  model->library = dlopen(runtime_path, RTLD_NOW | RTLD_LOCAL);
#endif
  if (model->library == nullptr) {
    delete model;
    return nullptr;
  }

  using GetApiBase = const OrtApiBase*(ORT_API_CALL*)();
  auto base =
      reinterpret_cast<GetApiBase>(load_symbol(*model, "OrtGetApiBase"));
  if (base == nullptr) {
    destroy_model(model);
    return nullptr;
  }
  model->api = base()->GetApi(ORT_API_VERSION);
  if (model->api == nullptr) {
    destroy_model(model);
    return nullptr;
  }

  const OrtApi* api = model->api;
  bool ok =
      ort_ok(api, api->CreateEnv(ORT_LOGGING_LEVEL_ERROR, "fluideq", &model->env));
  ok = ok && ort_ok(api, api->CreateSessionOptions(&model->options));
  if (ok) {
    // One thread each. Every `Run` happens on a worker that is already off
    // the audio thread, and ORT spawning its own pool would put unpredictable
    // scheduling next to a real-time callback for no throughput this needs.
    // A refusal here leaves ORT's default pool, which still runs the model,
    // so it is released and not treated as a failed load.
    ort_ok(api, api->SetIntraOpNumThreads(model->options, 1));
    ort_ok(api, api->SetInterOpNumThreads(model->options, 1));
  }
#if defined(_WIN32)
  if (ok) {
    std::wstring wide;
    const int needed =
        MultiByteToWideChar(CP_UTF8, 0, model_path, -1, nullptr, 0);
    wide.resize(needed > 0 ? static_cast<size_t>(needed) : 0);
    MultiByteToWideChar(CP_UTF8, 0, model_path, -1, wide.data(), needed);
    ok = ort_ok(api, api->CreateSession(model->env, wide.c_str(),
                                        model->options, &model->session));
  }
#else
  ok = ok && ort_ok(api, api->CreateSession(model->env, model_path,
                                            model->options, &model->session));
#endif
  ok = ok && ort_ok(api, api->CreateCpuMemoryInfo(OrtArenaAllocator,
                                                  OrtMemTypeDefault,
                                                  &model->memory));
  ok = ok && read_initial_state(*model);
  if (!ok) {
    destroy_model(model);
    return nullptr;
  }
  return model;
}

}  // namespace

VoiceModel* acquire_voice_model(const char* model_path,
                                const char* runtime_path) {
  if (model_path == nullptr || runtime_path == nullptr) {
    return nullptr;
  }
  std::string key = model_path;
  key += '\n';
  key += runtime_path;
  ModelCache& shared = cache();
  // Held across a load too: two chains asking for the same model at once must
  // end up with one session, not two that each think they are the only one.
  std::lock_guard<std::mutex> hold(shared.lock);
  for (VoiceModel* model : shared.models) {
    if (model->key == key) {
      model->users += 1;
      return model;
    }
  }
  VoiceModel* model = load_model(model_path, runtime_path);
  if (model == nullptr) {
    return nullptr;
  }
  model->key = std::move(key);
  model->users = 1;
  shared.models.push_back(model);
  return model;
}

void release_voice_model(VoiceModel* model) {
  if (model == nullptr) {
    return;
  }
  ModelCache& shared = cache();
  std::lock_guard<std::mutex> hold(shared.lock);
  if (model->users > 1) {
    model->users -= 1;
    return;
  }
  for (size_t index = 0; index < shared.models.size(); index += 1) {
    if (shared.models[index] == model) {
      shared.models.erase(shared.models.begin() +
                          static_cast<std::ptrdiff_t>(index));
      break;
    }
  }
  destroy_model(model);
}

#if defined(_WIN32)
namespace {
using SetCharacteristics = HANDLE(WINAPI*)(LPCWSTR, LPDWORD);
using RevertCharacteristics = BOOL(WINAPI*)(HANDLE);
}  // namespace

AudioWorkerPriority::AudioWorkerPriority() {
  avrt_ = LoadLibraryW(L"avrt.dll");
  if (avrt_ == nullptr) {
    return;
  }
  auto join = reinterpret_cast<SetCharacteristics>(
      GetProcAddress(avrt_, "AvSetMmThreadCharacteristicsW"));
  if (join == nullptr) {
    return;
  }
  DWORD index = 0;
  HANDLE task = join(L"Audio", &index);
  task_ = task;
}

AudioWorkerPriority::~AudioWorkerPriority() {
  if (avrt_ == nullptr) {
    return;
  }
  if (task_ != nullptr) {
    auto leave = reinterpret_cast<RevertCharacteristics>(
        GetProcAddress(avrt_, "AvRevertMmThreadCharacteristics"));
    if (leave != nullptr) {
      leave(static_cast<HANDLE>(task_));
    }
  }
  FreeLibrary(avrt_);
}
#else
AudioWorkerPriority::AudioWorkerPriority() = default;
AudioWorkerPriority::~AudioWorkerPriority() = default;
#endif

}  // namespace fluideq_voice
