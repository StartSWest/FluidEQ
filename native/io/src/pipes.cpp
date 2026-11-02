/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/io/pipes.h"

#include <bcrypt.h>

#include <algorithm>
#include <array>
#include <cstdlib>

namespace feq::io {
namespace {

constexpr DWORD kPipeBytes = 64 * 1024;
/** Instances kept waiting, as libuv keeps them: a client that connects
 * while the last one is being replaced finds another, never none. */
constexpr std::size_t kWaitingInstances = 4;

struct ReadOperation : Operation {
  using Operation::Operation;
  std::array<std::uint8_t, kPipeBytes> buffer{};
};

struct WriteOperation : Operation {
  using Operation::Operation;
  Bytes bytes;
};

/** Windows' own rules for one argument on a command line. */
std::wstring quoted(const std::wstring& argument) {
  if (!argument.empty() &&
      argument.find_first_of(L" \t\n\v\"") == std::wstring::npos) {
    return argument;
  }
  std::wstring out = L"\"";
  std::size_t backslashes = 0;
  for (const wchar_t c : argument) {
    if (c == L'\\') {
      backslashes += 1;
      continue;
    }
    if (c == L'"') {
      out.append(backslashes * 2 + 1, L'\\');
    } else {
      out.append(backslashes, L'\\');
    }
    backslashes = 0;
    out.push_back(c);
  }
  out.append(backslashes * 2, L'\\');
  out.push_back(L'"');
  return out;
}

HANDLE new_instance(const std::wstring& name, bool first) {
  return CreateNamedPipeW(
      name.c_str(),
      PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED |
          (first ? FILE_FLAG_FIRST_PIPE_INSTANCE : 0),
      PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT |
          PIPE_REJECT_REMOTE_CLIENTS,
      PIPE_UNLIMITED_INSTANCES, kPipeBytes, kPipeBytes, 0, nullptr);
}

}  // namespace

std::wstring unique_pipe_name(const std::wstring& prefix) {
  std::array<std::uint8_t, 16> bytes{};
  if (BCryptGenRandom(nullptr, bytes.data(), static_cast<ULONG>(bytes.size()),
                      BCRYPT_USE_SYSTEM_PREFERRED_RNG) < 0) {
    // A name nobody can guess is the pipe's whole lock; without the
    // system's randomness there is no safe name to give.
    std::abort();
  }
  constexpr std::wstring_view kHex = L"0123456789abcdef";
  std::wstring name = L"\\\\.\\pipe\\" + prefix;
  for (const std::uint8_t byte : bytes) {
    name.push_back(kHex[byte >> 4]);
    name.push_back(kHex[byte & 0x0F]);
  }
  return name;
}

PipeStream::PipeStream(HANDLE handle) : handle_(handle) {}

PipeStream::~PipeStream() {
  if (!closed_handle_) {
    CloseHandle(handle_);
  }
}

void PipeStream::start(Events events) {
  events_ = std::move(events);
  read();
}

void PipeStream::read() {
  if (reading_ || closed_handle_) {
    return;
  }
  reading_ = true;
  auto self = shared_from_this();
  auto* operation = new ReadOperation(nullptr);
  operation->done = [self, operation](DWORD error, DWORD bytes) {
    self->reading_ = false;
    if (self->closed_handle_) {
      return;
    }
    if (error == ERROR_BROKEN_PIPE || error == ERROR_PIPE_NOT_CONNECTED ||
        error == ERROR_NO_DATA) {
      if (const auto ended = self->events_.end) {
        ended();
      }
      self->close_with(std::nullopt);
      return;
    }
    if (error != ERROR_SUCCESS) {
      self->close_with(system_failure(error, "read"));
      return;
    }
    if (bytes > 0) {
      const Bytes data(operation->buffer.begin(),
                       operation->buffer.begin() + bytes);
      if (const auto heard = self->events_.data) {
        heard(data);
      }
    }
    self->read();
  };
  loop().issued(operation,
                ReadFile(handle_, operation->buffer.data(),
                         static_cast<DWORD>(operation->buffer.size()), nullptr,
                         operation) != FALSE);
}

void PipeStream::write(
    Bytes bytes, std::function<void(const std::optional<Failure>&)> done) {
  if (closed_handle_ || ending_) {
    if (done) {
      loop().post([done] { done(system_failure(ERROR_NO_DATA, "write")); });
    }
    return;
  }
  const std::size_t size = bytes.size();
  pending_bytes_ += size;
  writes_in_flight_ += 1;
  auto self = shared_from_this();
  auto* operation = new WriteOperation(nullptr);
  operation->bytes = std::move(bytes);
  operation->done = [self, size, done](DWORD error, DWORD) {
    self->pending_bytes_ -= size;
    self->writes_in_flight_ -= 1;
    const std::optional<Failure> failure =
        error == ERROR_SUCCESS ? std::nullopt
                               : std::optional(system_failure(error, "write"));
    if (done) {
      done(failure);
    }
    if (failure) {
      self->close_with(failure);
      return;
    }
    self->close_when_written();
  };
  loop().issued(operation,
                WriteFile(handle_, operation->bytes.data(),
                          static_cast<DWORD>(operation->bytes.size()), nullptr,
                          operation) != FALSE);
}

void PipeStream::end(Bytes last) {
  if (ending_ || closed_handle_) {
    return;
  }
  if (!last.empty()) {
    write(std::move(last));
  }
  ending_ = true;
  close_when_written();
}

void PipeStream::close_when_written() {
  if (ending_ && writes_in_flight_ == 0 && !closed_handle_) {
    close_with(std::nullopt);
  }
}

void PipeStream::destroy() { close_with(std::nullopt); }

void PipeStream::close_with(std::optional<Failure> failure) {
  if (closed_handle_) {
    return;
  }
  closed_handle_ = true;
  CancelIoEx(handle_, nullptr);
  CloseHandle(handle_);
  if (announced_) {
    return;
  }
  announced_ = true;
  auto self = shared_from_this();
  loop().post([self, failure = std::move(failure)] {
    if (const auto closed = self->events_.closed) {
      closed(failure);
    }
    self->events_ = Events{};
  });
}

std::optional<ChildPipe> child_pipe(bool child_writes) {
  const std::wstring name = unique_pipe_name(L"FluidEQ-Share-stdio-");
  const HANDLE ours = CreateNamedPipeW(
      name.c_str(),
      (child_writes ? PIPE_ACCESS_INBOUND : PIPE_ACCESS_OUTBOUND) |
          FILE_FLAG_OVERLAPPED | FILE_FLAG_FIRST_PIPE_INSTANCE,
      PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT |
          PIPE_REJECT_REMOTE_CLIENTS,
      1, kPipeBytes, kPipeBytes, 0, nullptr);
  if (ours == INVALID_HANDLE_VALUE) {
    return std::nullopt;
  }
  SECURITY_ATTRIBUTES inherit{sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE};
  const HANDLE theirs = CreateFileW(
      name.c_str(),
      child_writes ? (GENERIC_WRITE | FILE_READ_ATTRIBUTES) : GENERIC_READ, 0,
      &inherit, OPEN_EXISTING, 0, nullptr);
  if (theirs == INVALID_HANDLE_VALUE || !loop().attach(ours)) {
    if (theirs != INVALID_HANDLE_VALUE) {
      CloseHandle(theirs);
    }
    CloseHandle(ours);
    return std::nullopt;
  }
  return ChildPipe{std::make_shared<PipeStream>(ours), theirs};
}

struct ChildProcess::Watch {
  Loop* loop = nullptr;
  HANDLE process = nullptr;
  std::function<void(DWORD)> exited;
};

namespace {

void CALLBACK process_ended(PVOID context, BOOLEAN) {
  const auto* weak = static_cast<std::weak_ptr<ChildProcess::Watch>*>(context);
  const auto watch = weak->lock();
  if (!watch) {
    return;
  }
  DWORD code = 0;
  GetExitCodeProcess(watch->process, &code);
  std::weak_ptr<ChildProcess::Watch> later = watch;
  // Heard on a pool thread; told on the loop, like everything else.
  watch->loop->post([later, code] {
    if (const auto alive = later.lock()) {
      if (alive->exited) {
        alive->exited(code);
      }
    }
  });
}

}  // namespace

std::variant<std::shared_ptr<ChildProcess>, Failure> ChildProcess::spawn(
    const std::wstring& executable, const std::vector<std::wstring>& arguments,
    HANDLE input, HANDLE output, HANDLE error,
    std::function<void(DWORD code)> exited) {
  std::vector<HANDLE> inherited{input};
  for (const HANDLE handle : {output, error}) {
    if (std::find(inherited.begin(), inherited.end(), handle) ==
        inherited.end()) {
      inherited.push_back(handle);
    }
  }
  SIZE_T size = 0;
  InitializeProcThreadAttributeList(nullptr, 1, 0, &size);
  std::vector<std::uint8_t> storage(size);
  auto* attributes =
      reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(storage.data());
  if (InitializeProcThreadAttributeList(attributes, 1, 0, &size) == FALSE) {
    return system_failure(GetLastError(), "spawn");
  }
  if (UpdateProcThreadAttribute(attributes, 0,
                                PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                                inherited.data(),
                                inherited.size() * sizeof(HANDLE), nullptr,
                                nullptr) == FALSE) {
    const DWORD failed = GetLastError();
    DeleteProcThreadAttributeList(attributes);
    return system_failure(failed, "spawn");
  }
  STARTUPINFOEXW startup{};
  startup.StartupInfo.cb = sizeof startup;
  startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
  startup.StartupInfo.wShowWindow = SW_HIDE;
  startup.StartupInfo.hStdInput = input;
  startup.StartupInfo.hStdOutput = output;
  startup.StartupInfo.hStdError = error;
  startup.lpAttributeList = attributes;
  std::wstring command = quoted(executable);
  for (const auto& argument : arguments) {
    command += L" " + quoted(argument);
  }
  PROCESS_INFORMATION process{};
  const BOOL started = CreateProcessW(
      executable.c_str(), command.data(), nullptr, nullptr, TRUE,
      CREATE_NO_WINDOW | EXTENDED_STARTUPINFO_PRESENT |
          CREATE_UNICODE_ENVIRONMENT,
      nullptr, nullptr, &startup.StartupInfo, &process);
  const DWORD failed = GetLastError();
  DeleteProcThreadAttributeList(attributes);
  if (started == FALSE) {
    return system_failure(failed, "spawn");
  }
  CloseHandle(process.hThread);
  auto child = std::make_shared<ChildProcess>(process.hProcess,
                                              process.dwProcessId);
  child->watch_ = std::make_shared<Watch>();
  child->watch_->loop = &loop();
  child->watch_->process = process.hProcess;
  child->watch_->exited = std::move(exited);
  auto* context = new std::weak_ptr<Watch>(child->watch_);
  if (RegisterWaitForSingleObject(&child->wait_, process.hProcess,
                                  process_ended, context, INFINITE,
                                  WT_EXECUTEONLYONCE) == FALSE) {
    delete context;
    child->wait_ = nullptr;
    child->kill();
    return system_failure(GetLastError(), "spawn");
  }
  child->context_ = context;
  return child;
}

ChildProcess::ChildProcess(HANDLE process, DWORD pid)
    : process_(process), pid_(pid) {}

ChildProcess::~ChildProcess() {
  if (wait_ != nullptr) {
    // Waits for a callback already running, so its context can go.
    UnregisterWaitEx(wait_, INVALID_HANDLE_VALUE);
  }
  delete context_;
  CloseHandle(process_);
}

void ChildProcess::kill() { TerminateProcess(process_, 1); }

std::variant<std::shared_ptr<PipeServer>, Failure> PipeServer::listen(
    const std::wstring& name) {
  std::vector<HANDLE> waiting;
  for (std::size_t made = 0; made < kWaitingInstances; made += 1) {
    const HANDLE instance = new_instance(name, made == 0);
    if (instance == INVALID_HANDLE_VALUE || !loop().attach(instance)) {
      const DWORD error = GetLastError();
      if (instance != INVALID_HANDLE_VALUE) {
        CloseHandle(instance);
      }
      for (const HANDLE made_instance : waiting) {
        CloseHandle(made_instance);
      }
      return system_failure(error, "listen");
    }
    waiting.push_back(instance);
  }
  return std::make_shared<PipeServer>(name, std::move(waiting));
}

PipeServer::PipeServer(std::wstring name, std::vector<HANDLE> waiting)
    : name_(std::move(name)), waiting_(std::move(waiting)) {}

PipeServer::~PipeServer() { close(); }

void PipeServer::start(Connected connected) {
  connected_ = std::move(connected);
  const auto instances = waiting_;
  for (const HANDLE instance : instances) {
    wait_on(instance);
  }
}

void PipeServer::wait_on(HANDLE instance) {
  std::weak_ptr<PipeServer> weak = shared_from_this();
  auto* operation = new Operation([weak, instance](DWORD error, DWORD) {
    const auto self = weak.lock();
    if (!self || self->closed_) {
      return;
    }
    std::erase(self->waiting_, instance);
    if (error != ERROR_SUCCESS && error != ERROR_PIPE_CONNECTED) {
      CloseHandle(instance);
      self->replenish();
      return;
    }
    self->replenish();
    if (self->connected_) {
      self->connected_(std::make_shared<PipeStream>(instance));
    } else {
      CloseHandle(instance);
    }
  });
  loop().issued(operation, ConnectNamedPipe(instance, operation) != FALSE);
}

void PipeServer::replenish() {
  if (closed_) {
    return;
  }
  const HANDLE instance = new_instance(name_, false);
  if (instance == INVALID_HANDLE_VALUE || !loop().attach(instance)) {
    if (instance != INVALID_HANDLE_VALUE) {
      CloseHandle(instance);
    }
    return;
  }
  waiting_.push_back(instance);
  wait_on(instance);
}

void PipeServer::close() {
  if (closed_) {
    return;
  }
  closed_ = true;
  for (const HANDLE instance : waiting_) {
    CancelIoEx(instance, nullptr);
    CloseHandle(instance);
  }
  waiting_.clear();
}

}  // namespace feq::io
