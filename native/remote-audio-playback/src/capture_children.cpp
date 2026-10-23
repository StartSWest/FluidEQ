/* FluidEQ — GPL-3.0-or-later */
#include "capture_children.h"

#include <string>

namespace {

constexpr std::string_view kPipePrefix = "\\\\.\\pipe\\FluidEQ-LAN-";
/** Three are ever wanted (the network's, the second output's and the
 * FluidEQ Engine's hold); the rest of the room keeps one wait within
 * WaitForMultipleObjects' 64 handles. */
constexpr std::size_t kMaxChildren = 16;

bool hex_digits(std::string_view text, std::size_t count) {
  if (text.size() != count) return false;
  for (const char c : text) {
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
  }
  return true;
}

struct Request {
  std::string_view pipe, token, mode;
};

bool split(std::string_view request, Request* out) {
  const auto first = request.find(' ');
  if (first == std::string_view::npos) return false;
  const auto second = request.find(' ', first + 1);
  if (second == std::string_view::npos) return false;
  out->pipe = request.substr(0, first);
  out->token = request.substr(first + 1, second - first - 1);
  out->mode = request.substr(second + 1);
  return out->pipe.starts_with(kPipePrefix) &&
         hex_digits(out->pipe.substr(kPipePrefix.size()), 32) &&
         hex_digits(out->token, 64) &&
         (out->mode == "local" || out->mode == "lan" || out->mode == "hold");
}

std::wstring capture_path() {
  std::wstring path(MAX_PATH, L'\0');
  for (;;) {
    const DWORD length =
        GetModuleFileNameW(nullptr, path.data(), static_cast<DWORD>(path.size()));
    if (length == 0) return {};
    if (length < path.size()) {
      path.resize(length);
      break;
    }
    path.resize(path.size() * 2);
  }
  const auto slash = path.find_last_of(L"\\/");
  if (slash == std::wstring::npos) return {};
  path.resize(slash + 1);
  return path + L"FluidEQ-LAN-Capture.exe";
}

}  // namespace

bool capture_request_valid(std::string_view request) {
  Request parts;
  return split(request, &parts);
}

CaptureChildren::CaptureChildren(DWORD app_pid, Exited exited)
    : app_pid_(app_pid), exited_(exited) {
  job_ = CreateJobObjectW(nullptr, nullptr);
  if (job_ != nullptr) {
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if (!SetInformationJobObject(job_, JobObjectExtendedLimitInformation, &limits,
                                 sizeof(limits))) {
      CloseHandle(job_);
      job_ = nullptr;
    }
  }
  changed_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  stop_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (changed_ != nullptr && stop_ != nullptr) {
    watcher_ = std::thread([this] { watch(); });
  }
}

CaptureChildren::~CaptureChildren() {
  if (stop_ != nullptr) SetEvent(stop_);
  if (watcher_.joinable()) watcher_.join();
  for (const auto& child : children_) CloseHandle(child.process);
  // Closing the job ends every capture still running: none outlives this tree.
  if (job_ != nullptr) CloseHandle(job_);
  if (changed_ != nullptr) CloseHandle(changed_);
  if (stop_ != nullptr) CloseHandle(stop_);
}

HRESULT CaptureChildren::spawn(std::string_view request, std::uint32_t id) {
  Request parts;
  if (!split(request, &parts)) return E_INVALIDARG;
  if (job_ == nullptr || !watcher_.joinable()) return E_UNEXPECTED;
  {
    const std::lock_guard guard(mutex_);
    if (children_.size() >= kMaxChildren) return E_OUTOFMEMORY;
  }
  // Beside this executable, never a path from the wire: the request names a
  // pipe and a token, not a program.
  const std::wstring path = capture_path();
  if (path.empty()) return HRESULT_FROM_WIN32(GetLastError());
  const auto widen = [](std::string_view text) {
    return std::wstring(text.begin(), text.end());
  };
  std::wstring command = L"\"" + path + L"\" --parent-pid " +
                         std::to_wstring(app_pid_) + L" --pipe " +
                         widen(parts.pipe) + L" --token " + widen(parts.token);
  if (parts.mode == "lan") {
    command += L" --exclude-tree-pid " + std::to_wstring(GetCurrentProcessId());
  } else if (parts.mode == "hold") {
    // Captures nothing: holds second outputs open for the FluidEQ Engine.
    command += L" --hold-only";
  }
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION process{};
  // Suspended until it is in the job: a child that ran first and crashed or
  // lingered outside it would be a capture the job does not end.
  if (!CreateProcessW(path.c_str(), command.data(), nullptr, nullptr, FALSE,
                      CREATE_SUSPENDED | CREATE_NO_WINDOW, nullptr, nullptr,
                      &startup, &process)) {
    return HRESULT_FROM_WIN32(GetLastError());
  }
  HRESULT result = S_OK;
  if (!AssignProcessToJobObject(job_, process.hProcess) ||
      ResumeThread(process.hThread) == static_cast<DWORD>(-1)) {
    result = HRESULT_FROM_WIN32(GetLastError());
    TerminateProcess(process.hProcess, 1);
  }
  CloseHandle(process.hThread);
  if (FAILED(result)) {
    CloseHandle(process.hProcess);
    return result;
  }
  {
    const std::lock_guard guard(mutex_);
    children_.push_back({process.hProcess, id});
  }
  SetEvent(changed_);
  return S_OK;
}

void CaptureChildren::watch() {
  for (;;) {
    std::vector<HANDLE> waits{stop_, changed_};
    std::vector<std::uint32_t> ids;
    {
      const std::lock_guard guard(mutex_);
      for (const auto& child : children_) {
        waits.push_back(child.process);
        ids.push_back(child.id);
      }
    }
    const DWORD result = WaitForMultipleObjects(static_cast<DWORD>(waits.size()),
                                                waits.data(), FALSE, INFINITE);
    if (result == WAIT_OBJECT_0 || result == WAIT_FAILED) return;
    if (result == WAIT_OBJECT_0 + 1) continue;
    const std::size_t at = result - WAIT_OBJECT_0;
    if (at < 2 || at >= waits.size()) return;
    const HANDLE ended = waits[at];
    DWORD code = 0;
    GetExitCodeProcess(ended, &code);
    {
      const std::lock_guard guard(mutex_);
      std::erase_if(children_, [ended](const Child& child) { return child.process == ended; });
    }
    CloseHandle(ended);
    exited_(ids[at - 2], code);
  }
}
