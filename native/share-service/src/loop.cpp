/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "loop.h"

#include <winsock2.h>
#include <winternl.h>

#include <array>
#include <cstdio>
#include <exception>

namespace feq::share::service {
namespace {

Loop* current_loop = nullptr;

struct Named {
  DWORD error;
  const char* name;
};

/**
 * libuv's own table (`uv_translate_sys_error`), for the errors a socket, a
 * pipe or a child process can end with. Node puts these names on its
 * errors as `code`, and main reads them: EADDRINUSE sends a taken port to a
 * fresh one.
 */
constexpr std::array kNames = {
    Named{ERROR_NOACCESS, "EACCES"},
    Named{WSAEACCES, "EACCES"},
    Named{ERROR_ELEVATION_REQUIRED, "EACCES"},
    Named{ERROR_ADDRESS_ALREADY_ASSOCIATED, "EADDRINUSE"},
    Named{WSAEADDRINUSE, "EADDRINUSE"},
    Named{WSAEADDRNOTAVAIL, "EADDRNOTAVAIL"},
    Named{WSAEAFNOSUPPORT, "EAFNOSUPPORT"},
    Named{WSAEWOULDBLOCK, "EAGAIN"},
    Named{WSAEALREADY, "EALREADY"},
    Named{ERROR_INVALID_FLAGS, "EBADF"},
    Named{ERROR_INVALID_HANDLE, "EBADF"},
    Named{ERROR_LOCK_VIOLATION, "EBUSY"},
    Named{ERROR_PIPE_BUSY, "EBUSY"},
    Named{ERROR_SHARING_VIOLATION, "EBUSY"},
    Named{ERROR_OPERATION_ABORTED, "ECANCELED"},
    Named{WSAEINTR, "ECANCELED"},
    Named{ERROR_CONNECTION_ABORTED, "ECONNABORTED"},
    Named{WSAECONNABORTED, "ECONNABORTED"},
    Named{ERROR_CONNECTION_REFUSED, "ECONNREFUSED"},
    Named{WSAECONNREFUSED, "ECONNREFUSED"},
    Named{ERROR_NETNAME_DELETED, "ECONNRESET"},
    Named{WSAECONNRESET, "ECONNRESET"},
    Named{ERROR_ALREADY_EXISTS, "EEXIST"},
    Named{ERROR_FILE_EXISTS, "EEXIST"},
    Named{ERROR_BUFFER_OVERFLOW, "EFAULT"},
    Named{WSAEFAULT, "EFAULT"},
    Named{ERROR_HOST_UNREACHABLE, "EHOSTUNREACH"},
    Named{WSAEHOSTUNREACH, "EHOSTUNREACH"},
    Named{ERROR_INSUFFICIENT_BUFFER, "EINVAL"},
    Named{ERROR_INVALID_DATA, "EINVAL"},
    Named{ERROR_INVALID_PARAMETER, "EINVAL"},
    Named{WSAEINVAL, "EINVAL"},
    Named{WSAEPFNOSUPPORT, "EINVAL"},
    Named{WSAEISCONN, "EISCONN"},
    Named{ERROR_TOO_MANY_OPEN_FILES, "EMFILE"},
    Named{WSAEMFILE, "EMFILE"},
    Named{WSAEMSGSIZE, "EMSGSIZE"},
    Named{ERROR_NETWORK_UNREACHABLE, "ENETUNREACH"},
    Named{WSAENETUNREACH, "ENETUNREACH"},
    Named{WSAENOBUFS, "ENOBUFS"},
    Named{ERROR_FILE_NOT_FOUND, "ENOENT"},
    Named{ERROR_PATH_NOT_FOUND, "ENOENT"},
    Named{ERROR_INVALID_NAME, "ENOENT"},
    Named{ERROR_MOD_NOT_FOUND, "ENOENT"},
    Named{WSAHOST_NOT_FOUND, "ENOENT"},
    Named{WSANO_DATA, "ENOENT"},
    Named{ERROR_NOT_ENOUGH_MEMORY, "ENOMEM"},
    Named{ERROR_OUTOFMEMORY, "ENOMEM"},
    Named{ERROR_NOT_CONNECTED, "ENOTCONN"},
    Named{WSAENOTCONN, "ENOTCONN"},
    Named{WSAENOTSOCK, "ENOTSOCK"},
    Named{ERROR_NOT_SUPPORTED, "ENOTSUP"},
    Named{ERROR_BROKEN_PIPE, "EOF"},
    Named{ERROR_ACCESS_DENIED, "EPERM"},
    Named{ERROR_PRIVILEGE_NOT_HELD, "EPERM"},
    Named{ERROR_BAD_PIPE, "EPIPE"},
    Named{ERROR_NO_DATA, "EPIPE"},
    Named{ERROR_PIPE_NOT_CONNECTED, "EPIPE"},
    Named{WSAESHUTDOWN, "EPIPE"},
    Named{WSAEPROTONOSUPPORT, "EPROTONOSUPPORT"},
    Named{ERROR_SEM_TIMEOUT, "ETIMEDOUT"},
    Named{WSAETIMEDOUT, "ETIMEDOUT"},
};

/** What an overlapped operation ended with, as a Windows error. */
DWORD error_of(const OVERLAPPED_ENTRY& entry) {
  const auto status = static_cast<NTSTATUS>(entry.lpOverlapped->Internal);
  return status == 0 ? ERROR_SUCCESS : RtlNtStatusToDosError(status);
}

}  // namespace

std::string error_name(DWORD error) {
  for (const Named& named : kNames) {
    if (named.error == error) {
      return named.name;
    }
  }
  return "UNKNOWN";
}

Failure system_failure(DWORD error, std::string syscall) {
  Failure failure;
  failure.code = error_name(error);
  failure.message = syscall + " " + failure.code;
  failure.syscall = std::move(syscall);
  return failure;
}

Failure failure_with(std::string message) {
  Failure failure;
  failure.message = std::move(message);
  return failure;
}

Loop& loop() { return *current_loop; }
void set_loop(Loop* next) { current_loop = next; }

Loop::Loop()
    : port_(CreateIoCompletionPort(INVALID_HANDLE_VALUE, nullptr, 0, 1)) {}

Loop::~Loop() {
  if (port_ != nullptr) {
    CloseHandle(port_);
  }
}

bool Loop::attach(HANDLE handle) {
  return CreateIoCompletionPort(handle, port_, 0, 0) == port_;
}

void Loop::defer(std::function<void()> task) {
  deferred_.push_back(std::move(task));
}

void Loop::post(std::function<void()> task) {
  auto* operation = new Operation(
      [task = std::move(task)](DWORD, DWORD) { task(); });
  if (PostQueuedCompletionStatus(port_, 0, 0, operation) == FALSE) {
    // The port is gone, which only happens as the service ends.
    delete operation;
  }
}

void Loop::issued(Operation* operation, bool succeeded) {
  if (succeeded) {
    return;
  }
  const DWORD error = GetLastError();
  if (error == ERROR_IO_PENDING) {
    return;
  }
  post([operation, error] {
    operation->done(error, 0);
    delete operation;
  });
}

void Loop::drain_deferred() {
  while (!deferred_.empty()) {
    auto task = std::move(deferred_.front());
    deferred_.pop_front();
    task();
  }
}

int Loop::run() {
  std::array<OVERLAPPED_ENTRY, 64> entries{};
  // An exception nothing caught ends the service, as an uncaught one ended
  // the Node service: main sees it exit and fails what it was waiting on.
  try {
    drain_deferred();
    while (!stopping_) {
      ULONG count = 0;
      if (GetQueuedCompletionStatusEx(port_, entries.data(),
                                      static_cast<ULONG>(entries.size()),
                                      &count, INFINITE, FALSE) == FALSE) {
        return 1;
      }
      for (ULONG at = 0; at < count && !stopping_; at += 1) {
        std::unique_ptr<Operation> operation(
            static_cast<Operation*>(entries[at].lpOverlapped));
        operation->done(error_of(entries[at]),
                        entries[at].dwNumberOfBytesTransferred);
        operation.reset();
        drain_deferred();
      }
    }
  } catch (const std::exception& error) {
    std::fprintf(stderr, "Share Audio service stopped: %s\n", error.what());
    return 1;
  }
  return code_;
}

void Loop::stop(int code) {
  stopping_ = true;
  code_ = code;
}

}  // namespace feq::share::service
