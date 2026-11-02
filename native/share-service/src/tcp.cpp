/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "tcp.h"

#include <mswsock.h>
#include <ws2tcpip.h>

#include <array>

namespace feq::share::service {
namespace {

LPFN_ACCEPTEX accept_ex = nullptr;
LPFN_CONNECTEX connect_ex = nullptr;
LPFN_GETACCEPTEXSOCKADDRS accept_ex_addresses = nullptr;

/** A read's buffer: what libuv reads into is 64 KiB, and so is this. */
constexpr std::size_t kReadBytes = 64 * 1024;
/** Node's listen backlog when none is given. */
constexpr int kBacklog = 511;
/** AcceptEx's room for each address: the address plus sixteen bytes. */
constexpr DWORD kAddressRoom = sizeof(sockaddr_in) + 16;

SOCKET new_stream_socket() {
  return WSASocketW(AF_INET, SOCK_STREAM, IPPROTO_TCP, nullptr, 0,
                    WSA_FLAG_OVERLAPPED | WSA_FLAG_NO_HANDLE_INHERIT);
}

/** What `ws` sets on every socket it takes: no Nagle delay. */
void no_delay(SOCKET socket) {
  const BOOL on = TRUE;
  setsockopt(socket, IPPROTO_TCP, TCP_NODELAY,
             reinterpret_cast<const char*>(&on), sizeof on);
}

template <class T>
bool extension(SOCKET socket, GUID id, T& out) {
  DWORD bytes = 0;
  return WSAIoctl(socket, SIO_GET_EXTENSION_FUNCTION_POINTER, &id, sizeof id,
                  &out, sizeof out, &bytes, nullptr, nullptr) == 0;
}

struct ReadOperation : Operation {
  using Operation::Operation;
  std::array<std::uint8_t, kReadBytes> buffer{};
};

struct WriteOperation : Operation {
  using Operation::Operation;
  Bytes bytes;
};

struct AcceptOperation : Operation {
  using Operation::Operation;
  SOCKET accepted = INVALID_SOCKET;
  std::array<std::uint8_t, 2 * kAddressRoom> addresses{};
};

}  // namespace

bool load_socket_extensions() {
  const SOCKET probe = new_stream_socket();
  if (probe == INVALID_SOCKET) {
    return false;
  }
  const bool loaded =
      extension(probe, WSAID_ACCEPTEX, accept_ex) &&
      extension(probe, WSAID_CONNECTEX, connect_ex) &&
      extension(probe, WSAID_GETACCEPTEXSOCKADDRS, accept_ex_addresses);
  closesocket(probe);
  return loaded;
}

std::string ipv4_text(const in_addr& address) {
  std::array<char, INET_ADDRSTRLEN> text{};
  return inet_ntop(AF_INET, &address, text.data(), text.size()) != nullptr
             ? std::string(text.data())
             : std::string();
}

TcpSocket::TcpSocket(SOCKET socket, std::string remote_address,
                     int remote_port)
    : socket_(socket),
      remote_address_(std::move(remote_address)),
      remote_port_(remote_port) {}

TcpSocket::~TcpSocket() {
  if (!closed_socket_) {
    closesocket(socket_);
  }
}

void TcpSocket::connect(
    const std::string& address, int port,
    std::function<void(std::shared_ptr<TcpSocket>, std::optional<Failure>)>
        done) {
  sockaddr_in target{};
  target.sin_family = AF_INET;
  target.sin_port = htons(static_cast<u_short>(port));
  if (inet_pton(AF_INET, address.c_str(), &target.sin_addr) != 1) {
    loop().post([done] {
      done(nullptr, system_failure(WSAEINVAL, "connect"));
    });
    return;
  }
  const SOCKET socket = new_stream_socket();
  sockaddr_in any{};
  any.sin_family = AF_INET;
  if (socket == INVALID_SOCKET ||
      bind(socket, reinterpret_cast<const sockaddr*>(&any), sizeof any) != 0 ||
      !loop().attach(reinterpret_cast<HANDLE>(socket))) {
    const DWORD error = WSAGetLastError();
    if (socket != INVALID_SOCKET) {
      closesocket(socket);
    }
    loop().post([done, error] {
      done(nullptr, system_failure(error, "connect"));
    });
    return;
  }
  auto* operation = new Operation(
      [socket, address, port, done](DWORD error, DWORD) {
        if (error != ERROR_SUCCESS ||
            setsockopt(socket, SOL_SOCKET, SO_UPDATE_CONNECT_CONTEXT, nullptr,
                       0) != 0) {
          closesocket(socket);
          done(nullptr, system_failure(
                            error != ERROR_SUCCESS ? error : WSAGetLastError(),
                            "connect"));
          return;
        }
        no_delay(socket);
        done(std::make_shared<TcpSocket>(socket, address, port), std::nullopt);
      });
  const BOOL started =
      connect_ex(socket, reinterpret_cast<const sockaddr*>(&target),
                 sizeof target, nullptr, 0, nullptr, operation);
  if (started == FALSE && WSAGetLastError() != ERROR_IO_PENDING) {
    // The failure is the operation's: it closes the socket it was given.
    loop().issued(operation, false);
  }
}

void TcpSocket::start(Events events) {
  events_ = std::move(events);
  read();
}

void TcpSocket::read() {
  if (reading_ || read_ended_ || closed_socket_) {
    return;
  }
  reading_ = true;
  auto self = shared_from_this();
  auto* operation = new ReadOperation(nullptr);
  operation->done = [self, operation](DWORD error, DWORD bytes) {
    self->reading_ = false;
    if (self->closed_socket_) {
      return;
    }
    if (error != ERROR_SUCCESS) {
      self->close_with(system_failure(error, "read"));
      return;
    }
    // Each handler is copied before it runs: a handler may hand the socket
    // to a new owner, which replaces the handlers while one is running.
    if (bytes == 0) {
      self->read_ended_ = true;
      if (const auto ended = self->events_.end) {
        ended();
      }
      self->finish_if_done();
      return;
    }
    // Copied out: the buffer goes with the operation once this returns.
    const Bytes data(operation->buffer.begin(),
                     operation->buffer.begin() + bytes);
    if (const auto heard = self->events_.data) {
      heard(data);
    }
    self->read();
  };
  WSABUF buffer{static_cast<ULONG>(operation->buffer.size()),
                reinterpret_cast<char*>(operation->buffer.data())};
  DWORD flags = 0;
  const int result =
      WSARecv(socket_, &buffer, 1, nullptr, &flags, operation, nullptr);
  loop().issued(operation, result == 0);
}

void TcpSocket::write(
    Bytes bytes, std::function<void(const std::optional<Failure>&)> done) {
  if (closed_socket_ || ending_) {
    if (done) {
      loop().post([done] {
        done(system_failure(WSAESHUTDOWN, "write"));
      });
    }
    return;
  }
  const std::size_t size = bytes.size();
  buffered_ += size;
  writes_in_flight_ += 1;
  auto self = shared_from_this();
  auto* operation = new WriteOperation(nullptr);
  operation->bytes = std::move(bytes);
  operation->done = [self, size, done](DWORD error, DWORD) {
    self->wrote(size, error, done);
  };
  WSABUF buffer{static_cast<ULONG>(operation->bytes.size()),
                reinterpret_cast<char*>(operation->bytes.data())};
  const int result =
      WSASend(socket_, &buffer, 1, nullptr, 0, operation, nullptr);
  loop().issued(operation, result == 0);
}

void TcpSocket::wrote(
    std::size_t size, DWORD error,
    const std::function<void(const std::optional<Failure>&)>& done) {
  buffered_ -= size;
  writes_in_flight_ -= 1;
  const std::optional<Failure> failure =
      error == ERROR_SUCCESS ? std::nullopt
                             : std::optional(system_failure(error, "write"));
  if (done) {
    done(failure);
  }
  if (failure && !closed_socket_) {
    close_with(failure);
    return;
  }
  shut_down_when_written();
}

void TcpSocket::keep_alive(int idle_seconds) {
  const BOOL on = TRUE;
  const DWORD idle = static_cast<DWORD>(idle_seconds);
  const DWORD interval = 1;
  const DWORD probes = 10;
  setsockopt(socket_, SOL_SOCKET, SO_KEEPALIVE,
             reinterpret_cast<const char*>(&on), sizeof on);
  setsockopt(socket_, IPPROTO_TCP, TCP_KEEPIDLE,
             reinterpret_cast<const char*>(&idle), sizeof idle);
  setsockopt(socket_, IPPROTO_TCP, TCP_KEEPINTVL,
             reinterpret_cast<const char*>(&interval), sizeof interval);
  setsockopt(socket_, IPPROTO_TCP, TCP_KEEPCNT,
             reinterpret_cast<const char*>(&probes), sizeof probes);
}

void TcpSocket::end() {
  if (ending_ || closed_socket_) {
    return;
  }
  ending_ = true;
  shut_down_when_written();
}

void TcpSocket::shut_down_when_written() {
  if (!ending_ || write_ended_ || closed_socket_ || writes_in_flight_ > 0) {
    return;
  }
  write_ended_ = true;
  shutdown(socket_, SD_SEND);
  finish_if_done();
}

void TcpSocket::finish_if_done() {
  // Node's sockets do not stay half open: the other side finishing ends
  // this one's writing too, once what it queued has gone.
  if (read_ended_ && !ending_) {
    end();
    return;
  }
  if (read_ended_ && write_ended_) {
    close_with(std::nullopt);
  }
}

void TcpSocket::destroy() {
  if (!closed_socket_) {
    close_with(std::nullopt);
  }
}

void TcpSocket::close_with(std::optional<Failure> failure) {
  if (closed_socket_) {
    return;
  }
  closed_socket_ = true;
  // Anything still in flight completes as cancelled and finds this closed.
  closesocket(socket_);
  if (announced_) {
    return;
  }
  announced_ = true;
  auto self = shared_from_this();
  loop().post([self, failure = std::move(failure)] {
    if (const auto closed = self->events_.closed) {
      closed(failure);
    }
    // Nothing more can happen to it: what its owner gave it goes, and with
    // that any owner the handlers kept alive.
    self->events_ = Events{};
  });
}

std::variant<std::shared_ptr<TcpListener>, Failure> TcpListener::listen(
    const std::string& host, int port) {
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_port = htons(static_cast<u_short>(port));
  if (inet_pton(AF_INET, host.c_str(), &address.sin_addr) != 1) {
    return system_failure(WSAEINVAL, "listen");
  }
  const SOCKET socket = new_stream_socket();
  if (socket == INVALID_SOCKET) {
    return system_failure(WSAGetLastError(), "listen");
  }
  // Nobody else may take the port from under the listener with
  // SO_REUSEADDR while it listens.
  const BOOL exclusive = TRUE;
  setsockopt(socket, SOL_SOCKET, SO_EXCLUSIVEADDRUSE,
             reinterpret_cast<const char*>(&exclusive), sizeof exclusive);
  if (bind(socket, reinterpret_cast<const sockaddr*>(&address),
           sizeof address) != 0 ||
      ::listen(socket, kBacklog) != 0 ||
      !loop().attach(reinterpret_cast<HANDLE>(socket))) {
    const DWORD error = WSAGetLastError();
    closesocket(socket);
    return system_failure(error, "listen");
  }
  sockaddr_in bound{};
  int length = sizeof bound;
  if (getsockname(socket, reinterpret_cast<sockaddr*>(&bound), &length) != 0) {
    const DWORD error = WSAGetLastError();
    closesocket(socket);
    return system_failure(error, "listen");
  }
  return std::make_shared<TcpListener>(socket, ntohs(bound.sin_port));
}

TcpListener::TcpListener(SOCKET socket, int port)
    : socket_(socket), port_(port) {}

TcpListener::~TcpListener() {
  if (!closed_) {
    closesocket(socket_);
  }
}

void TcpListener::start(Accepted accepted,
                        std::function<void(const Failure&)> failed) {
  accepted_ = std::move(accepted);
  failed_ = std::move(failed);
  accept_next();
}

void TcpListener::accept_next() {
  if (closed_) {
    return;
  }
  const SOCKET accepted = new_stream_socket();
  if (accepted == INVALID_SOCKET) {
    const Failure failure = system_failure(WSAGetLastError(), "accept");
    loop().post([self = shared_from_this(), failure] {
      if (!self->closed_ && self->failed_) {
        self->failed_(failure);
      }
    });
    return;
  }
  auto self = shared_from_this();
  auto* operation = new AcceptOperation(nullptr);
  operation->accepted = accepted;
  operation->done = [self, operation](DWORD error, DWORD) {
    const SOCKET socket = operation->accepted;
    if (self->closed_) {
      closesocket(socket);
      return;
    }
    const SOCKET listening = self->socket_;
    // An error that belongs to the arriving connection leaves the listener
    // as it was, as libuv's does: that connection is dropped and the next
    // one is waited for.
    if (error != ERROR_SUCCESS ||
        setsockopt(socket, SOL_SOCKET, SO_UPDATE_ACCEPT_CONTEXT,
                   reinterpret_cast<const char*>(&listening),
                   sizeof listening) != 0 ||
        !loop().attach(reinterpret_cast<HANDLE>(socket))) {
      closesocket(socket);
      self->accept_next();
      return;
    }
    sockaddr* local = nullptr;
    sockaddr* remote = nullptr;
    int local_length = 0;
    int remote_length = 0;
    accept_ex_addresses(operation->addresses.data(), 0, kAddressRoom,
                        kAddressRoom, &local, &local_length, &remote,
                        &remote_length);
    std::string address;
    int port = 0;
    if (remote != nullptr && remote->sa_family == AF_INET) {
      const auto* from = reinterpret_cast<const sockaddr_in*>(remote);
      address = ipv4_text(from->sin_addr);
      port = ntohs(from->sin_port);
    }
    no_delay(socket);
    auto connection = std::make_shared<TcpSocket>(socket, address, port);
    self->accept_next();
    if (self->accepted_) {
      self->accepted_(connection);
    }
  };
  DWORD bytes = 0;
  const BOOL started =
      accept_ex(socket_, accepted, operation->addresses.data(), 0,
                kAddressRoom, kAddressRoom, &bytes, operation);
  if (started == FALSE && WSAGetLastError() != ERROR_IO_PENDING) {
    const Failure failure = system_failure(WSAGetLastError(), "accept");
    closesocket(accepted);
    delete operation;
    loop().post([self, failure] {
      if (!self->closed_ && self->failed_) {
        self->failed_(failure);
      }
    });
  }
}

void TcpListener::close() {
  if (closed_) {
    return;
  }
  closed_ = true;
  closesocket(socket_);
}

}  // namespace feq::share::service
