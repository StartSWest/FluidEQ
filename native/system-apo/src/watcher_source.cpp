/* FluidEQ — GPL-3.0-or-later */
#include "watcher.h"

#include <knownfolders.h>
#include <shlobj_core.h>
#include <bcrypt.h>

#include <array>

#include "config_file.h"
#include "source_analysis.h"

namespace fluideq_engine {
namespace {

bool same_model_path(const std::string& utf8, const std::wstring& expected) {
  if (utf8.empty()) return false;
  const int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS,
      utf8.data(), static_cast<int>(utf8.size()), nullptr, 0);
  if (count <= 0) return false;
  std::wstring path(static_cast<size_t>(count), L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, utf8.data(),
      static_cast<int>(utf8.size()), path.data(), count) != count) return false;
  for (wchar_t& c : path) if (c == L'/') c = L'\\';
  return CompareStringOrdinal(path.c_str(), -1, expected.c_str(), -1, TRUE) == CSTR_EQUAL;
}

/** A file's size and last write time, or nothing for a file not there. */
std::optional<std::pair<uint64_t, uint64_t>> file_stamp(const std::wstring& path) {
  WIN32_FILE_ATTRIBUTE_DATA data{};
  if (!GetFileAttributesExW(path.c_str(), GetFileExInfoStandard, &data)) {
    return std::nullopt;
  }
  return std::make_pair(
      (static_cast<uint64_t>(data.nFileSizeHigh) << 32) | data.nFileSizeLow,
      (static_cast<uint64_t>(data.ftLastWriteTime.dwHighDateTime) << 32) |
          data.ftLastWriteTime.dwLowDateTime);
}

std::shared_ptr<void> verified_voice_model(const std::wstring& path) {
  // Keep this exact file open through ONNX's model load. Hashing and then
  // reopening an unpinned writable path would permit a different model to
  // replace the one checked here between those operations.
  const HANDLE raw = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ,
      nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_SEQUENTIAL_SCAN, nullptr);
  if (raw == INVALID_HANDLE_VALUE) return {};
  // Closed through a function pointer, never a lambda: the shared pointer
  // keeps its deleter's type descriptor, and a lambda in here is named after
  // this file's anonymous namespace, which MSVC hashes from the file's path.
  // The engine then built to different bytes in every folder, and every
  // release would have offered an engine update (`repro_test.cpp`).
  std::shared_ptr<void> file(raw, &CloseHandle);
  LARGE_INTEGER size{};
  if (!GetFileSizeEx(raw, &size) || size.QuadPart != 10596848) return {};
  struct Hash {
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    BCRYPT_HASH_HANDLE value = nullptr;
    ~Hash() {
      if (value != nullptr) BCryptDestroyHash(value);
      if (algorithm != nullptr) BCryptCloseAlgorithmProvider(algorithm, 0);
    }
  } hash;
  if (BCryptOpenAlgorithmProvider(&hash.algorithm, BCRYPT_SHA256_ALGORITHM,
                                  nullptr, 0) < 0 ||
      BCryptCreateHash(hash.algorithm, &hash.value, nullptr, 0, nullptr, 0, 0) < 0) return {};
  std::array<unsigned char, 65536> bytes{};
  for (;;) {
    DWORD count = 0;
    if (!ReadFile(raw, bytes.data(), static_cast<DWORD>(bytes.size()), &count, nullptr)) return {};
    if (count == 0) break;
    if (BCryptHashData(hash.value, bytes.data(), count, 0) < 0) return {};
  }
  std::array<unsigned char, 32> digest{};
  if (BCryptFinishHash(hash.value, digest.data(), static_cast<ULONG>(digest.size()), 0) < 0) return {};
  constexpr char kHex[] = "0123456789abcdef";
  std::string encoded(64, '0');
  for (size_t at = 0; at < digest.size(); ++at) {
    encoded[2 * at] = kHex[digest[at] >> 4];
    encoded[2 * at + 1] = kHex[digest[at] & 15];
  }
  return encoded == "0b399f8a58dc4d70d8cd97541f5c39869406145193b957d00a03b66070944928"
      ? file : std::shared_ptr<void>();
}

std::string trusted_voice_runtime() {
  // Never accept an executable path from the all-users-writable config.
  // Setup checks this DLL's shipped SHA-256 before copying it beside the
  // effect into Program Files, whose ordinary users have read access only.
  static const wchar_t kModuleAddress = 0;
  HMODULE module = nullptr;
  if (!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
                             GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                         &kModuleAddress, &module)) return {};
  std::wstring path(32768, L'\0');
  const DWORD length = GetModuleFileNameW(module, path.data(),
                                         static_cast<DWORD>(path.size()));
  if (length == 0 || length >= path.size()) return {};
  path.resize(length);
  PWSTR folder = nullptr;
  const HRESULT found = SHGetKnownFolderPath(FOLDERID_ProgramFilesX64, 0,
                                            nullptr, &folder);
  if (FAILED(found) || folder == nullptr) {
    CoTaskMemFree(folder);
    return {};
  }
  const std::wstring directory = std::wstring(folder) + L"\\FluidEQ Engine";
  CoTaskMemFree(folder);
  const std::wstring expected = directory + L"\\FluidEQ-Engine.dll";
  if (CompareStringOrdinal(path.c_str(), -1, expected.c_str(), -1, TRUE) !=
      CSTR_EQUAL) return {};
  const std::wstring runtime = directory + L"\\onnxruntime.dll";
  const DWORD attributes = GetFileAttributesW(runtime.c_str());
  if (attributes == INVALID_FILE_ATTRIBUTES ||
      (attributes & FILE_ATTRIBUTE_DIRECTORY) != 0) return {};
  return to_utf8(runtime);
}

}  // namespace

SourceAnalysis Watcher::read_source(bool owner) {
  const auto text = owner
      ? read_config_file(config_dir_ + L"\\" + kSourceAnalysisFile) : std::nullopt;
  std::optional<SourceAnalysis> parsed = text ? parse_source_analysis(*text)
                                            : std::nullopt;
  source_invalid_ = text.has_value() && !parsed.has_value();
  if (parsed && parsed->voice_available) {
    parsed->voice_runtime = trusted_voice_runtime();
    const std::wstring model = config_dir_ + L"\\fluideq-voice.onnx";
    // There is one versioned, pinned model; this sidecar cannot select an
    // arbitrary file for a privileged process to parse.
    if (same_model_path(parsed->voice_model, model)) {
      parsed->voice_model = to_utf8(model);
      // Hashed once, then held (`voice_guard_`): the open handle shares no
      // write or delete, so the bytes checked are the bytes for as long as it
      // is held. A file that failed is not hashed again until it changes.
      if (!voice_guard_) {
        const auto stamp = file_stamp(model);
        if (!stamp || stamp != voice_refused_) {
          voice_guard_ = verified_voice_model(model);
          voice_refused_ = voice_guard_ ? std::nullopt : stamp;
        }
      }
      parsed->voice_model_guard = voice_guard_;
    }
  } else {
    // No model offered: let go of the file, so the app can replace it.
    voice_guard_.reset();
    voice_refused_.reset();
  }
  const auto split = split_ ? split_->report() : std::nullopt;
  SourceAnalysis source = source_for_endpoint(parsed, endpoint_,
      split ? split->from : std::wstring(), default_mode_);
  // Runtime availability is installation state, not part of the untrusted
  // wire. It still changes what a fresh graph can prepare.
  if (source.library) source.identity += "|runtime=" + source.voice_runtime +
      (source.voice_model_guard ? "|verified=1" : "|verified=0");
  return source;
}

void Watcher::graph_adopted() noexcept {
  // One notification per published graph actually adopted, at callback end.
  // This is the existing coalesced status wake; no file write on that thread.
  if (carried_event_ != nullptr) SetEvent(carried_event_);
}

}  // namespace fluideq_engine
