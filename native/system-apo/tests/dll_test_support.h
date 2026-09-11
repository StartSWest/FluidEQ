/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Getting the effect DLL loaded and an object out of it, for the two test
 * binaries that drive it.
 *
 * `dll_smoke_test.cpp` asks what the module and the object say about
 * themselves — exports, class factory, interfaces, registration properties,
 * formats, `Initialize`. `dll_process_test.cpp` asks what they do to audio —
 * lock, process, unlock, and a live configuration change. Two binaries
 * because one file was past the 500-line limit, and because a failure in the
 * COM surface and a failure on the audio path are different bugs with
 * different owners.
 *
 * Everything goes through `LoadLibraryW` and the COM entry points rather than
 * linking the objects directly: an export missing from `engine.def`, a vtable
 * handed back for an interface the object does not implement, a registration
 * property Windows reads before it will load the effect at all — a test that
 * constructed the class in-process would pass with every one of those broken.
 *
 * The including translation unit must define the GUIDs, i.e. `#include
 * <initguid.h>` above this header and below `<windows.h>`.
 */
#ifndef FLUIDEQ_ENGINE_TESTS_DLL_TEST_SUPPORT_H
#define FLUIDEQ_ENGINE_TESTS_DLL_TEST_SUPPORT_H

#include <audioenginebaseapo.h>
// Where `APOInitSystemEffects3` lives — the shape Windows 11 hands the
// object, and one of the three the effect has to tell apart.
#include <audioengineextensionapo.h>
#include <audiomediatype.h>
#include <mmreg.h>
#include <unknwn.h>

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace fluideq_engine_test {

inline int g_failures = 0;

inline void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

}  // namespace fluideq_engine_test

#define CHECK(...)                                               \
  ::fluideq_engine_test::check_impl((__VA_ARGS__), #__VA_ARGS__, \
                                    __FILE__, __LINE__)

namespace fluideq_engine_test {

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

/**
 * Runs `body` on the way out of a scope, however the scope is left.
 *
 * Every early return in these tests used to skip its own cleanup, which is
 * how a failing check turned into a leaked module handle and a COM object
 * that outlived the DLL it came from.
 */
template <typename Fn>
class ScopeGuard {
 public:
  explicit ScopeGuard(Fn body) : body_(body) {}
  ~ScopeGuard() { body_(); }
  ScopeGuard(const ScopeGuard&) = delete;
  ScopeGuard& operator=(const ScopeGuard&) = delete;

 private:
  Fn body_;
};

// ---------------------------------------------------------------------------
// The module and the objects it makes.

struct EngineModule {
  HMODULE module = nullptr;
  DllGetClassObjectFn get_class_object = nullptr;
  DllCanUnloadNowFn can_unload_now = nullptr;

  bool usable() const noexcept {
    return module != nullptr && get_class_object != nullptr &&
           can_unload_now != nullptr;
  }
};

inline EngineModule load_engine(const wchar_t* dll_path) {
  EngineModule engine;
  engine.module = LoadLibraryW(dll_path);
  CHECK(engine.module != nullptr);
  if (engine.module == nullptr) {
    std::printf("  LoadLibraryW failed: %lu\n", GetLastError());
    return engine;
  }
  engine.get_class_object = reinterpret_cast<DllGetClassObjectFn>(
      reinterpret_cast<void*>(
          GetProcAddress(engine.module, "DllGetClassObject")));
  engine.can_unload_now = reinterpret_cast<DllCanUnloadNowFn>(
      reinterpret_cast<void*>(
          GetProcAddress(engine.module, "DllCanUnloadNow")));
  CHECK(engine.get_class_object != nullptr);
  CHECK(engine.can_unload_now != nullptr);
  // No `DllRegisterServer`: registration is the helper's job, and an effect
  // that can register itself is an effect a stray `regsvr32` can attach.
  CHECK(GetProcAddress(engine.module, "DllRegisterServer") == nullptr);
  return engine;
}

inline void unload_engine(EngineModule& engine) noexcept {
  if (engine.module != nullptr) {
    FreeLibrary(engine.module);
    engine.module = nullptr;
  }
}

inline IClassFactory* create_factory(const EngineModule& engine) {
  IClassFactory* factory = nullptr;
  CHECK(engine.get_class_object(kEngineClsid, __uuidof(IClassFactory),
                                reinterpret_cast<LPVOID*>(&factory)) == S_OK);
  CHECK(factory != nullptr);
  return factory;
}

inline IAudioProcessingObject* create_apo(IClassFactory* factory) {
  IAudioProcessingObject* apo = nullptr;
  CHECK(factory->CreateInstance(nullptr, __uuidof(IAudioProcessingObject),
                                reinterpret_cast<void**>(&apo)) == S_OK);
  CHECK(apo != nullptr);
  return apo;
}

// ---------------------------------------------------------------------------
// Formats.

/** A float32 mix format, the only shape this effect accepts. */
inline WAVEFORMATEXTENSIBLE float_format(WORD channels, DWORD rate) {
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
inline WAVEFORMATEX pcm16_format(WORD channels, DWORD rate) {
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

inline bool is_float32(const WAVEFORMATEX* format) {
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

// ---------------------------------------------------------------------------
// The engine root these tests point the DLL at.

/**
 * An empty directory for `FLUIDEQ_ENGINE_ROOT`, unique to this process.
 *
 * A test that pointed the DLL at the real `%ProgramData%\FluidEQ\engine`
 * would pass or fail depending on what the developer's own machine has
 * installed, and would append to the log a running installation writes.
 */
inline std::wstring make_temp_root(const wchar_t* tag) {
  wchar_t temp[MAX_PATH + 1] = {};
  const DWORD length = GetTempPathW(MAX_PATH, temp);
  if (length == 0 || length > MAX_PATH) {
    return std::wstring();
  }
  std::wstring root(temp, length);
  root += tag;
  root += std::to_wstring(GetCurrentProcessId());
  if (!CreateDirectoryW(root.c_str(), nullptr) &&
      GetLastError() != ERROR_ALREADY_EXISTS) {
    return std::wstring();
  }
  return root;
}

inline void remove_temp_root(const std::wstring& root) {
  DeleteFileW((root + L"\\config\\config.txt").c_str());
  RemoveDirectoryW((root + L"\\config").c_str());
  DeleteFileW((root + L"\\engine.log").c_str());
  // The status file the effect writes for each output it locks for.
  WIN32_FIND_DATAW found = {};
  const HANDLE search =
      FindFirstFileW((root + L"\\status-*.json").c_str(), &found);
  if (search != INVALID_HANDLE_VALUE) {
    do {
      DeleteFileW((root + L"\\" + found.cFileName).c_str());
    } while (FindNextFileW(search, &found) != 0);
    FindClose(search);
  }
  RemoveDirectoryW(root.c_str());
}

/** A whole text file, or empty when it cannot be read. */
inline std::string read_text_file(const std::wstring& path) {
  const HANDLE file = CreateFileW(
      path.c_str(), GENERIC_READ,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr,
      OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return std::string();
  }
  std::string text(64 * 1024, '\0');
  DWORD read = 0;
  const BOOL ok = ReadFile(file, text.data(), static_cast<DWORD>(text.size()),
                           &read, nullptr);
  CloseHandle(file);
  text.resize(ok != 0 ? read : 0);
  return text;
}

inline bool write_text_file(const std::wstring& path, const char* text) {
  const HANDLE file = CreateFileW(path.c_str(), GENERIC_WRITE, FILE_SHARE_READ,
                                  nullptr, CREATE_ALWAYS,
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

/**
 * FluidEQ's pipe, served by the test binary itself.
 *
 * Without it the effect passes every endpoint through untouched, which is
 * what it does when FluidEQ is not running — so every check that expects the
 * configuration to be applied needs one, and the checks for FluidEQ going
 * away close it. A private name through `FLUIDEQ_ENGINE_OWNER_PIPE`, so the
 * result never depends on whether FluidEQ is running on the machine.
 */
class OwnerPipe {
 public:
  ~OwnerPipe() { close(); }

  void set_name(std::wstring name) { name_ = std::move(name); }

  /**
   * Opens `instances` of it. Every lock takes one — the effect's link holds
   * a connection while any endpoint is locked — and an instance a link has
   * let go of cannot be connected to again, so a binary that locks many
   * times needs one per lock.
   */
  bool open(size_t instances = 128) {
    close();
    for (size_t at = 0; at < instances; ++at) {
      const HANDLE instance = CreateNamedPipeW(
          name_.c_str(), PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED,
          PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
          PIPE_UNLIMITED_INSTANCES, 4096, 4096, 0, nullptr);
      if (instance == INVALID_HANDLE_VALUE) {
        return false;
      }
      instances_.push_back(instance);
    }
    return true;
  }

  /** FluidEQ ending, as the effect sees it. */
  void close() noexcept {
    for (const HANDLE instance : instances_) {
      CloseHandle(instance);
    }
    instances_.clear();
  }

 private:
  std::wstring name_;
  std::vector<HANDLE> instances_;
};

inline OwnerPipe g_owner_pipe;

/**
 * The whole of both binaries' `wmain`: COM, a private engine root, FluidEQ's
 * pipe, the body, and the verdict.
 */
inline int run_dll_test(int argc, wchar_t** argv, const char* banner,
                        const wchar_t* tag,
                        void (*body)(const wchar_t*, const std::wstring&)) {
  std::printf("%s\n", banner);
  if (argc < 2) {
    std::printf("  usage: <test> <FluidEQ-Engine.dll>\n");
    return 1;
  }

  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(com)) {
    std::printf("  CoInitializeEx failed: 0x%08lX\n",
                static_cast<unsigned long>(com));
    return 1;
  }
  const ScopeGuard uninitialize([] { CoUninitialize(); });

  const std::wstring root = make_temp_root(tag);
  if (root.empty()) {
    std::printf("  could not create a temporary engine root\n");
    return 1;
  }
  SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", root.c_str());
  const ScopeGuard clean_root([&root] {
    SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", nullptr);
    remove_temp_root(root);
  });

  const std::wstring pipe = L"\\\\.\\pipe\\fluideq-engine-test-owner-" +
                            std::to_wstring(GetCurrentProcessId());
  g_owner_pipe.set_name(pipe);
  if (!g_owner_pipe.open()) {
    std::printf("  could not serve a FluidEQ pipe for the effect to find\n");
    return 1;
  }
  SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_OWNER_PIPE", pipe.c_str());
  const ScopeGuard close_pipe([] {
    SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_OWNER_PIPE", nullptr);
    g_owner_pipe.close();
  });

  body(argv[1], root);

  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

}  // namespace fluideq_engine_test

#endif  // FLUIDEQ_ENGINE_TESTS_DLL_TEST_SUPPORT_H
