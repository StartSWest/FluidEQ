/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The effect DLL, exercised the way audiodg.exe drives it.
 *
 * Everything here goes through `LoadLibraryW` and the COM entry points rather
 * than linking the objects directly, because the failures this test exists to
 * catch all live in the boundary: an export missing from `engine.def`, a
 * vtable the class factory hands back for an interface the object does not
 * actually implement, a registration property Windows reads before it will
 * load the effect at all. A test that constructed the class in-process would
 * pass with every one of those broken.
 *
 * `FLUIDEQ_ENGINE_ROOT` points the DLL at an empty temporary directory, so
 * "no configuration present" is a state this test can create rather than one
 * it has to hope for — and the pass-through path it selects is the one thing
 * a user hears if the engine is attached with nothing to apply.
 *
 * The DLL's path arrives as argv[1]: CMake knows where it put it and this
 * test does not have to guess at a generator's directory layout.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

// Before every header that names a GUID: this is the one translation unit in
// the test that defines them, so `KSDATAFORMAT_SUBTYPE_IEEE_FLOAT` and the
// interface ids resolve without an import library that may not carry them.
#include <initguid.h>

#include <audioenginebaseapo.h>
#include <audiomediatype.h>
#include <mmreg.h>
#include <unknwn.h>

#include <cstdio>
#include <cstring>
#include <string>

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

// The published contract, spelled out here rather than included from the
// DLL's own header: this is the number the helper writes into the registry
// and Windows looks up, so a test that took it from the same source it is
// checking would follow the value if it ever moved.
constexpr GUID kEngineClsid = {0xB7E2C4D1,
                               0x5A8F,
                               0x4C3E,
                               {0x9D, 0x2B, 0x6F, 0x1A, 0x0C, 0x8E, 0x7D,
                                0x34}};

constexpr GUID kEffectId = {0x6E2B7F3C,
                            0x1A9D,
                            0x4C5E,
                            {0x8B, 0x7A, 0x2F, 0x4D, 0x6C, 0x8E, 0x1B, 0x39}};

constexpr uint32_t kChannels = 2;
constexpr uint32_t kFrames = 480;
constexpr uint32_t kRate = 48000;

using DllGetClassObjectFn = HRESULT(__stdcall*)(REFCLSID, REFIID, LPVOID*);
using DllCanUnloadNowFn = HRESULT(__stdcall*)();

/** A float32 mix format, the only shape this effect accepts. */
WAVEFORMATEXTENSIBLE float_format(WORD channels, DWORD rate) {
  WAVEFORMATEXTENSIBLE format = {};
  format.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
  format.Format.nChannels = channels;
  format.Format.nSamplesPerSec = rate;
  format.Format.wBitsPerSample = 32;
  format.Format.nBlockAlign =
      static_cast<WORD>(channels * format.Format.wBitsPerSample / 8);
  format.Format.nAvgBytesPerSec = rate * format.Format.nBlockAlign;
  format.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
  format.Samples.wValidBitsPerSample = 32;
  format.dwChannelMask = SPEAKER_FRONT_LEFT | SPEAKER_FRONT_RIGHT;
  format.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;
  return format;
}

/** 16-bit PCM: the format this effect must refuse and answer with float. */
WAVEFORMATEX pcm16_format(WORD channels, DWORD rate) {
  WAVEFORMATEX format = {};
  format.wFormatTag = WAVE_FORMAT_PCM;
  format.nChannels = channels;
  format.nSamplesPerSec = rate;
  format.wBitsPerSample = 16;
  format.nBlockAlign = static_cast<WORD>(channels * 2);
  format.nAvgBytesPerSec = rate * format.nBlockAlign;
  format.cbSize = 0;
  return format;
}

bool is_float32(const WAVEFORMATEX* format) {
  if (format == nullptr || format->wBitsPerSample != 32) {
    return false;
  }
  if (format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) {
    return true;
  }
  if (format->wFormatTag != WAVE_FORMAT_EXTENSIBLE ||
      format->cbSize < sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX)) {
    return false;
  }
  const auto* extensible =
      reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(format);
  return IsEqualGUID(extensible->SubFormat, KSDATAFORMAT_SUBTYPE_IEEE_FLOAT);
}

/**
 * An empty directory for `FLUIDEQ_ENGINE_ROOT`, unique to this process.
 *
 * A test that pointed the DLL at the real `%ProgramData%\FluidEQ\engine`
 * would pass or fail depending on what the developer's own machine has
 * installed, and would append to the log a running installation writes.
 */
std::wstring make_temp_root() {
  wchar_t temp[MAX_PATH + 1] = {};
  const DWORD length = GetTempPathW(MAX_PATH, temp);
  if (length == 0 || length > MAX_PATH) {
    return std::wstring();
  }
  std::wstring root(temp, length);
  root += L"fluideq-engine-smoke-";
  root += std::to_wstring(GetCurrentProcessId());
  if (!CreateDirectoryW(root.c_str(), nullptr) &&
      GetLastError() != ERROR_ALREADY_EXISTS) {
    return std::wstring();
  }
  return root;
}

void remove_temp_root(const std::wstring& root) {
  DeleteFileW((root + L"\\config\\config.txt").c_str());
  RemoveDirectoryW((root + L"\\config").c_str());
  DeleteFileW((root + L"\\engine.log").c_str());
  RemoveDirectoryW(root.c_str());
}

bool write_text_file(const std::wstring& path, const char* text) {
  const HANDLE file = CreateFileW(path.c_str(), GENERIC_WRITE,
                                  FILE_SHARE_READ, nullptr, CREATE_ALWAYS,
                                  FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return false;
  }
  DWORD written = 0;
  const BOOL ok = WriteFile(file, text,
                            static_cast<DWORD>(std::strlen(text)), &written,
                            nullptr);
  CloseHandle(file);
  return ok != 0;
}

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

// ---------------------------------------------------------------------------

void run(const wchar_t* dll_path, const std::wstring& root) {
  const HMODULE module = LoadLibraryW(dll_path);
  CHECK(module != nullptr);
  if (module == nullptr) {
    std::printf("  LoadLibraryW failed: %lu\n", GetLastError());
    return;
  }

  const auto get_class_object = reinterpret_cast<DllGetClassObjectFn>(
      reinterpret_cast<void*>(GetProcAddress(module, "DllGetClassObject")));
  const auto can_unload_now = reinterpret_cast<DllCanUnloadNowFn>(
      reinterpret_cast<void*>(GetProcAddress(module, "DllCanUnloadNow")));
  CHECK(get_class_object != nullptr);
  CHECK(can_unload_now != nullptr);
  // No `DllRegisterServer`: registration is the helper's job, and an effect
  // that can register itself is an effect a stray `regsvr32` can attach.
  CHECK(GetProcAddress(module, "DllRegisterServer") == nullptr);
  if (get_class_object == nullptr || can_unload_now == nullptr) {
    FreeLibrary(module);
    return;
  }

  // Nothing is created yet, so the module must be unloadable.
  CHECK(can_unload_now() == S_OK);

  IClassFactory* factory = nullptr;
  CHECK(get_class_object(kEngineClsid, __uuidof(IClassFactory),
                         reinterpret_cast<LPVOID*>(&factory)) == S_OK);
  CHECK(factory != nullptr);
  if (factory == nullptr) {
    FreeLibrary(module);
    return;
  }
  // A CLSID this DLL does not serve must be refused rather than answered
  // with the one it does.
  IClassFactory* wrong = nullptr;
  CHECK(get_class_object(__uuidof(IUnknown), __uuidof(IClassFactory),
                         reinterpret_cast<LPVOID*>(&wrong)) ==
        CLASS_E_CLASSNOTAVAILABLE);
  CHECK(wrong == nullptr);

  IAudioProcessingObject* apo = nullptr;
  CHECK(factory->CreateInstance(nullptr, __uuidof(IAudioProcessingObject),
                                reinterpret_cast<void**>(&apo)) == S_OK);
  CHECK(apo != nullptr);
  if (apo == nullptr) {
    factory->Release();
    FreeLibrary(module);
    return;
  }
  // One live object: the module must now refuse to unload.
  CHECK(can_unload_now() == S_FALSE);

  // --- Registration properties -------------------------------------------
  APO_REG_PROPERTIES* props = nullptr;
  CHECK(apo->GetRegistrationProperties(&props) == S_OK);
  CHECK(props != nullptr);
  if (props != nullptr) {
    CHECK(IsEqualGUID(props->clsid, kEngineClsid));
    CHECK((props->Flags & APO_FLAG_INPLACE) != 0);
    CHECK((props->Flags & APO_FLAG_SAMPLESPERFRAME_MUST_MATCH) != 0);
    CHECK((props->Flags & APO_FLAG_FRAMESPERSECOND_MUST_MATCH) != 0);
    CHECK((props->Flags & APO_FLAG_BITSPERSAMPLE_MUST_MATCH) != 0);
    CHECK(props->u32MinInputConnections == 1);
    CHECK(props->u32MaxInputConnections == 1);
    CHECK(props->u32MinOutputConnections == 1);
    CHECK(props->u32MaxOutputConnections == 1);
    CHECK(props->u32NumAPOInterfaces >= 1);
    CHECK(wcscmp(props->szFriendlyName, L"FluidEQ Engine") == 0);
    CoTaskMemFree(props);
  }

  // --- Every interface Windows asks for ----------------------------------
  IAudioProcessingObjectRT* rt = nullptr;
  IAudioProcessingObjectConfiguration* config = nullptr;
  IAudioSystemEffects* effects = nullptr;
  IAudioSystemEffects2* effects2 = nullptr;
  IUnknown* unknown = nullptr;
  CHECK(apo->QueryInterface(__uuidof(IAudioProcessingObjectRT),
                            reinterpret_cast<void**>(&rt)) == S_OK);
  CHECK(apo->QueryInterface(__uuidof(IAudioProcessingObjectConfiguration),
                            reinterpret_cast<void**>(&config)) == S_OK);
  CHECK(apo->QueryInterface(__uuidof(IAudioSystemEffects),
                            reinterpret_cast<void**>(&effects)) == S_OK);
  CHECK(apo->QueryInterface(__uuidof(IAudioSystemEffects2),
                            reinterpret_cast<void**>(&effects2)) == S_OK);
  CHECK(apo->QueryInterface(__uuidof(IUnknown),
                            reinterpret_cast<void**>(&unknown)) == S_OK);
  IUnknown* absent = nullptr;
  CHECK(apo->QueryInterface(kEffectId, reinterpret_cast<void**>(&absent)) ==
        E_NOINTERFACE);
  CHECK(absent == nullptr);
  if (rt == nullptr || config == nullptr || effects2 == nullptr) {
    std::printf("  a required interface is missing; stopping\n");
    return;
  }

  // --- The effect this object reports to the audio stack ------------------
  GUID* ids = nullptr;
  UINT count = 0;
  CHECK(effects2->GetEffectsList(&ids, &count, nullptr) == S_OK);
  CHECK(count == 1);
  CHECK(ids != nullptr);
  if (ids != nullptr && count == 1) {
    CHECK(IsEqualGUID(ids[0], kEffectId));
  }
  CoTaskMemFree(ids);

  // --- Formats ------------------------------------------------------------
  const WAVEFORMATEXTENSIBLE wanted = float_format(kChannels, kRate);
  IAudioMediaType* float_type = nullptr;
  CHECK(CreateAudioMediaType(&wanted.Format, sizeof(WAVEFORMATEXTENSIBLE),
                             &float_type) == S_OK);
  const WAVEFORMATEX pcm = pcm16_format(kChannels, kRate);
  IAudioMediaType* pcm_type = nullptr;
  CHECK(CreateAudioMediaType(&pcm, sizeof(WAVEFORMATEX), &pcm_type) == S_OK);
  if (float_type == nullptr || pcm_type == nullptr) {
    std::printf("  CreateAudioMediaType failed; stopping\n");
    return;
  }

  IAudioMediaType* supported = nullptr;
  CHECK(apo->IsInputFormatSupported(nullptr, float_type, &supported) == S_OK);
  if (supported != nullptr) {
    supported->Release();
    supported = nullptr;
  }
  CHECK(apo->IsOutputFormatSupported(nullptr, float_type, &supported) == S_OK);
  if (supported != nullptr) {
    supported->Release();
    supported = nullptr;
  }

  CHECK(apo->IsInputFormatSupported(nullptr, pcm_type, &supported) == S_FALSE);
  CHECK(supported != nullptr);
  if (supported != nullptr) {
    const WAVEFORMATEX* suggestion = supported->GetAudioFormat();
    CHECK(is_float32(suggestion));
    CHECK(suggestion != nullptr && suggestion->nChannels == kChannels);
    CHECK(suggestion != nullptr && suggestion->nSamplesPerSec == kRate);
    supported->Release();
    supported = nullptr;
  }

  // --- Initialize ---------------------------------------------------------
  APOInitSystemEffects init = {};
  init.APOInit.cbSize = sizeof(APOInitSystemEffects);
  init.APOInit.clsid = kEngineClsid;
  CHECK(apo->Initialize(sizeof(APOInitSystemEffects),
                        reinterpret_cast<BYTE*>(&init)) == S_OK);

  // --- Lock, process, unlock ---------------------------------------------
  // 128-bit aligned, as the connection buffer contract requires.
  float* buffer = static_cast<float*>(
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
  // Everything above passes just as well if the effect does nothing at all:
  // "output equals input" is what a DLL that never read a configuration
  // produces, and what one that read the wrong one produces too. A chain
  // that has to change the audio is the only check that tells them apart.
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

  CHECK(config->UnlockForProcess() == S_OK);

  _aligned_free(buffer);

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

  // --- Release, and the module goes quiet ---------------------------------
  float_type->Release();
  pcm_type->Release();
  if (unknown != nullptr) {
    unknown->Release();
  }
  if (effects != nullptr) {
    effects->Release();
  }
  effects2->Release();
  config->Release();
  rt->Release();
  apo->Release();
  factory->Release();

  CHECK(can_unload_now() == S_OK);
  FreeLibrary(module);
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  std::printf("fluideq engine dll smoke\n");
  if (argc < 2) {
    std::printf("  usage: fluideq-engine-dll-smoke-test <FluidEQ-Engine.dll>\n");
    return 1;
  }

  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(com)) {
    std::printf("  CoInitializeEx failed: 0x%08lX\n",
                static_cast<unsigned long>(com));
    return 1;
  }

  const std::wstring root = make_temp_root();
  if (root.empty()) {
    std::printf("  could not create a temporary engine root\n");
    CoUninitialize();
    return 1;
  }
  SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", root.c_str());

  run(argv[1], root);

  SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", nullptr);
  remove_temp_root(root);
  CoUninitialize();

  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

