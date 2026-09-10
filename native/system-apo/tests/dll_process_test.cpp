/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the effect DLL does to audio: `LockForProcess`, real blocks through
 * `APOProcess`, `UnlockForProcess`, and a configuration rewritten while the
 * stream runs.
 *
 * `FLUIDEQ_ENGINE_ROOT` points the DLL at an empty temporary directory, so
 * "no configuration present" is a state this test can create rather than one
 * it has to hope for — and the pass-through path it selects is the one thing
 * a user hears if the engine is attached with nothing to apply.
 *
 * The positive control at the end is the point of the file. Every check above
 * it passes just as well if the effect does nothing at all: "output equals
 * input" is what a DLL that never read a configuration produces, and what one
 * that read the wrong one produces too. Only a chain that has to change the
 * audio tells them apart — and the live rewrite after it exercises the change
 * notification, the re-resolve, the graph rebuild and the handover onto the
 * audio thread, which is the one piece of this engine where getting it wrong
 * silences every output on the machine rather than one.
 *
 * What the module and the object say about themselves is
 * `dll_smoke_test.cpp`.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

// Before every header that names a GUID: this is the one translation unit in
// this binary that defines them.
#include <initguid.h>

#include <cstdint>
#include <cstdio>
#include <string>

#include "dll_test_support.h"

using fluideq_engine_test::create_apo;
using fluideq_engine_test::create_factory;
using fluideq_engine_test::EngineModule;
using fluideq_engine_test::float_format;
using fluideq_engine_test::kChannels;
using fluideq_engine_test::kEngineClsid;
using fluideq_engine_test::kFrames;
using fluideq_engine_test::kRate;
using fluideq_engine_test::load_engine;
using fluideq_engine_test::run_dll_test;
using fluideq_engine_test::ScopeGuard;
using fluideq_engine_test::unload_engine;
using fluideq_engine_test::write_text_file;

namespace {

/** Every sample within `tolerance` of `expected`. */
bool all_close(const float* buffer, uint32_t count, float expected,
               float tolerance) {
  for (uint32_t at = 0; at < count; ++at) {
    const float difference = buffer[at] - expected;
    if (difference > tolerance || difference < -tolerance) {
      return false;
    }
  }
  return true;
}

/**
 * One block of ones through the effect, in place.
 *
 * The whole buffer is refilled every time, so a check that follows this one
 * measures what this block did rather than what every block before it did.
 */
void process_ones(IAudioProcessingObjectRT* rt, float* buffer,
                  uint32_t channels, uint32_t frames) {
  for (uint32_t at = 0; at < channels * frames; ++at) {
    buffer[at] = 1.0f;
  }
  APO_CONNECTION_PROPERTY in = {};
  in.pBuffer = reinterpret_cast<UINT_PTR>(buffer);
  in.u32ValidFrameCount = frames;
  in.u32BufferFlags = BUFFER_VALID;
  in.u32Signature = APO_CONNECTION_PROPERTY_SIGNATURE;
  APO_CONNECTION_PROPERTY out = in;
  out.u32BufferFlags = BUFFER_INVALID;
  APO_CONNECTION_PROPERTY* inputs[1] = {&in};
  APO_CONNECTION_PROPERTY* outputs[1] = {&out};
  rt->APOProcess(1, inputs, 1, outputs);
}

void run(const wchar_t* dll_path, const std::wstring& root) {
  EngineModule engine = load_engine(dll_path);
  const ScopeGuard unload([&engine] { unload_engine(engine); });
  if (!engine.usable()) {
    return;
  }

  // Declared before the guards that free them, so every early return below
  // goes out through the same cleanup — and in this order: the buffer, then
  // the COM objects, then the module, because a COM object released after
  // its DLL is unmapped is a call into memory that is no longer there.
  IClassFactory* factory = nullptr;
  IAudioProcessingObject* apo = nullptr;
  IAudioProcessingObjectRT* rt = nullptr;
  IAudioProcessingObjectConfiguration* config = nullptr;
  IAudioMediaType* float_type = nullptr;
  float* buffer = nullptr;
  const ScopeGuard release([&] {
    _aligned_free(buffer);
    if (float_type != nullptr) {
      float_type->Release();
    }
    if (config != nullptr) {
      config->Release();
    }
    if (rt != nullptr) {
      rt->Release();
    }
    if (apo != nullptr) {
      apo->Release();
    }
    if (factory != nullptr) {
      factory->Release();
    }
    CHECK(engine.can_unload_now() == S_OK);
  });

  factory = create_factory(engine);
  if (factory == nullptr) {
    return;
  }
  apo = create_apo(factory);
  if (apo == nullptr) {
    return;
  }
  CHECK(apo->QueryInterface(__uuidof(IAudioProcessingObjectRT),
                            reinterpret_cast<void**>(&rt)) == S_OK);
  CHECK(apo->QueryInterface(__uuidof(IAudioProcessingObjectConfiguration),
                            reinterpret_cast<void**>(&config)) == S_OK);
  if (rt == nullptr || config == nullptr) {
    std::printf("  a required interface is missing; stopping\n");
    return;
  }

  APOInitSystemEffects init = {};
  init.APOInit.cbSize = sizeof(APOInitSystemEffects);
  init.APOInit.clsid = kEngineClsid;
  CHECK(apo->Initialize(sizeof(APOInitSystemEffects),
                        reinterpret_cast<BYTE*>(&init)) == S_OK);

  const WAVEFORMATEXTENSIBLE wanted =
      float_format(static_cast<WORD>(kChannels), kRate);
  CHECK(CreateAudioMediaType(&wanted.Format, sizeof(WAVEFORMATEXTENSIBLE),
                             &float_type) == S_OK);
  if (float_type == nullptr) {
    std::printf("  CreateAudioMediaType failed; stopping\n");
    return;
  }

  // --- Lock, process, unlock ---------------------------------------------
  // 128-bit aligned, as the connection buffer contract requires.
  buffer = static_cast<float*>(
      _aligned_malloc(sizeof(float) * kChannels * kFrames, 16));
  CHECK(buffer != nullptr);
  if (buffer == nullptr) {
    return;
  }

  APO_CONNECTION_DESCRIPTOR input = {};
  input.Type = APO_CONNECTION_BUFFER_TYPE_EXTERNAL;
  input.pBuffer = reinterpret_cast<UINT_PTR>(buffer);
  input.u32MaxFrameCount = kFrames;
  input.pFormat = float_type;
  input.u32Signature = APO_CONNECTION_DESCRIPTOR_SIGNATURE;
  // In place: audiodg hands the same buffer both ways for an APO that
  // declared APO_FLAG_INPLACE, so that is the case worth testing.
  APO_CONNECTION_DESCRIPTOR output = input;

  APO_CONNECTION_DESCRIPTOR* inputs[1] = {&input};
  APO_CONNECTION_DESCRIPTOR* outputs[1] = {&output};
  CHECK(config->LockForProcess(1, inputs, 1, outputs) == S_OK);

  UINT32 channel_count = 0;
  CHECK(apo->GetInputChannelCount(&channel_count) == S_OK);
  CHECK(channel_count == kChannels);

  // No configuration on disk, so no latency to report.
  HNSTIME latency = -1;
  CHECK(apo->GetLatency(&latency) == S_OK);
  CHECK(latency == 0);

  CHECK(rt->CalcInputFrames(kFrames) == kFrames);
  CHECK(rt->CalcOutputFrames(kFrames) == kFrames);

  for (uint32_t at = 0; at < kChannels * kFrames; ++at) {
    buffer[at] = 1.0f;
  }
  APO_CONNECTION_PROPERTY in_property = {};
  in_property.pBuffer = reinterpret_cast<UINT_PTR>(buffer);
  in_property.u32ValidFrameCount = kFrames;
  in_property.u32BufferFlags = BUFFER_VALID;
  in_property.u32Signature = APO_CONNECTION_PROPERTY_SIGNATURE;
  APO_CONNECTION_PROPERTY out_property = in_property;
  out_property.u32ValidFrameCount = 0;
  out_property.u32BufferFlags = BUFFER_INVALID;

  APO_CONNECTION_PROPERTY* in_properties[1] = {&in_property};
  APO_CONNECTION_PROPERTY* out_properties[1] = {&out_property};
  rt->APOProcess(1, in_properties, 1, out_properties);

  CHECK(out_property.u32ValidFrameCount == kFrames);
  CHECK(out_property.u32BufferFlags == BUFFER_VALID);
  bool untouched = true;
  for (uint32_t at = 0; at < kChannels * kFrames; ++at) {
    untouched = untouched && buffer[at] == 1.0f;
  }
  CHECK(untouched);

  // Silence in, silence out, and the effect must not have written the buffer.
  in_property.u32BufferFlags = BUFFER_SILENT;
  out_property.u32BufferFlags = BUFFER_INVALID;
  rt->APOProcess(1, in_properties, 1, out_properties);
  CHECK(out_property.u32BufferFlags == BUFFER_SILENT);
  CHECK(out_property.u32ValidFrameCount == kFrames);

  // A block larger than the connection was locked for is refused rather than
  // written past.
  in_property.u32BufferFlags = BUFFER_VALID;
  in_property.u32ValidFrameCount = kFrames + 1;
  out_property.u32BufferFlags = BUFFER_VALID;
  out_property.u32ValidFrameCount = kFrames + 1;
  rt->APOProcess(1, in_properties, 1, out_properties);
  CHECK(out_property.u32ValidFrameCount == 0);
  CHECK(out_property.u32BufferFlags == BUFFER_SILENT);

  CHECK(config->UnlockForProcess() == S_OK);
  CHECK(config->UnlockForProcess() == APOERR_ALREADY_UNLOCKED);

  // --- The positive control ----------------------------------------------
  const std::wstring config_dir = root + L"\\config";
  CHECK(CreateDirectoryW(config_dir.c_str(), nullptr) != 0);
  CHECK(write_text_file(config_dir + L"\\config.txt", "Preamp: -6 dB\r\n"));

  CHECK(config->LockForProcess(1, inputs, 1, outputs) == S_OK);
  process_ones(rt, buffer, kChannels, kFrames);
  // 10^(-6/20). The tolerance is wide enough for a float multiply and far
  // too narrow for the wrong preamp or none at all.
  CHECK(all_close(buffer, kChannels * kFrames, 0.501187f, 1.0e-4f));

  // --- A configuration change while the audio runs ------------------------
  // The watcher thread has to notice the rewrite, resolve it, build a second
  // graph and hand it over at a block boundary. Blocks are what drive the
  // handover and the reclaiming of the graph it replaced, so the wait is a
  // loop of real blocks rather than a sleep — and it is bounded, because a
  // change that is never picked up must fail rather than hang.
  CHECK(write_text_file(config_dir + L"\\config.txt", "Preamp: -12 dB\r\n"));
  constexpr uint32_t kMaxBlocks = 400000;
  bool swapped = false;
  for (uint32_t block = 0; block < kMaxBlocks && !swapped; ++block) {
    process_ones(rt, buffer, kChannels, kFrames);
    // 10^(-12/20).
    swapped = all_close(buffer, kChannels * kFrames, 0.251189f, 1.0e-4f);
    SwitchToThread();
  }
  CHECK(swapped);
  // And it keeps running the new one rather than flickering between the two.
  process_ones(rt, buffer, kChannels, kFrames);
  CHECK(all_close(buffer, kChannels * kFrames, 0.251189f, 1.0e-4f));

  // The app now replaces files atomically. A watcher that observes only
  // writes to the original file can miss this final rename and stay stale.
  const std::wstring temporary = config_dir + L"\\config.pending";
  const ScopeGuard cleanup([&] { DeleteFileW(temporary.c_str()); });
  CHECK(write_text_file(temporary, "Preamp: -18 dB\r\n"));
  CHECK(MoveFileExW(temporary.c_str(), (config_dir + L"\\config.txt").c_str(),
                     MOVEFILE_REPLACE_EXISTING) != 0);
  swapped = false;
  for (uint32_t block = 0; block < kMaxBlocks && !swapped; ++block) {
    process_ones(rt, buffer, kChannels, kFrames);
    swapped = all_close(buffer, kChannels * kFrames, 0.125893f, 1.0e-4f);
    SwitchToThread();
  }
  CHECK(swapped);

  CHECK(config->UnlockForProcess() == S_OK);

  // The watcher thread wrote why it is passing audio through untouched;
  // without that line an engine doing nothing looks the same as one that
  // crashed.
  const std::wstring log = root + L"\\engine.log";
  const HANDLE log_file =
      CreateFileW(log.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
                  nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  CHECK(log_file != INVALID_HANDLE_VALUE);
  if (log_file != INVALID_HANDLE_VALUE) {
    LARGE_INTEGER size = {};
    CHECK(GetFileSizeEx(log_file, &size) != 0);
    CHECK(size.QuadPart > 0);
    CloseHandle(log_file);
  }
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  return run_dll_test(argc, argv, "fluideq engine dll processing",
                      L"fluideq-engine-process-", &run);
}
