/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "udp.h"

#include <mstcpip.h>
#include <ws2tcpip.h>

#include <array>

#include "tcp.h"

// mstcpip.h names it only for some targets; its value is Winsock's own.
#ifndef SIO_UDP_CONNRESET
#define SIO_UDP_CONNRESET _WSAIOW(IOC_VENDOR, 12)
#endif

namespace feq::share::service {
namespace {

/** The largest datagram IPv4 carries. */
constexpr std::size_t kDatagramBytes = 64 * 1024;

struct ReceiveOperation : Operation {
  using Operation::Operation;
  std::array<std::uint8_t, kDatagramBytes> buffer{};
  sockaddr_in from{};
  INT from_length = sizeof(sockaddr_in);
  DWORD flags = 0;
};

struct SendOperation : Operation {
  using Operation::Operation;
  std::vector<std::uint8_t> data;
  sockaddr_in to{};
};

}  // namespace

std::variant<std::shared_ptr<UdpSocket>, Failure> UdpSocket::bind(int port) {
  const SOCKET socket =
      WSASocketW(AF_INET, SOCK_DGRAM, IPPROTO_UDP, nullptr, 0,
                 WSA_FLAG_OVERLAPPED | WSA_FLAG_NO_HANDLE_INHERIT);
  if (socket == INVALID_SOCKET) {
    return system_failure(WSAGetLastError(), "bind");
  }
  const BOOL reuse = TRUE;
  setsockopt(socket, SOL_SOCKET, SO_REUSEADDR,
             reinterpret_cast<const char*>(&reuse), sizeof reuse);
  // An ICMP "port unreachable" for an earlier datagram would otherwise come
  // back as a failed receive; nothing here is a connection to reset.
  BOOL report_reset = FALSE;
  DWORD bytes = 0;
  WSAIoctl(socket, SIO_UDP_CONNRESET, &report_reset, sizeof report_reset,
           nullptr, 0, &bytes, nullptr, nullptr);
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_port = htons(static_cast<u_short>(port));
  if (::bind(socket, reinterpret_cast<const sockaddr*>(&address),
             sizeof address) != 0 ||
      !loop().attach(reinterpret_cast<HANDLE>(socket))) {
    const DWORD error = WSAGetLastError();
    closesocket(socket);
    return system_failure(error, "bind");
  }
  return std::make_shared<UdpSocket>(socket);
}

UdpSocket::UdpSocket(SOCKET socket) : socket_(socket) {}

UdpSocket::~UdpSocket() {
  if (!closed_) {
    closesocket(socket_);
  }
}

void UdpSocket::set_broadcast(bool on) {
  const BOOL value = on ? TRUE : FALSE;
  setsockopt(socket_, SOL_SOCKET, SO_BROADCAST,
             reinterpret_cast<const char*>(&value), sizeof value);
}

void UdpSocket::start(Heard heard) {
  heard_ = std::move(heard);
  receive();
}

void UdpSocket::receive() {
  if (closed_) {
    return;
  }
  auto self = shared_from_this();
  auto* operation = new ReceiveOperation(nullptr);
  operation->done = [self, operation](DWORD error, DWORD bytes) {
    if (self->closed_) {
      return;
    }
    if (error == ERROR_SUCCESS && self->heard_) {
      const std::vector<std::uint8_t> data(operation->buffer.begin(),
                                           operation->buffer.begin() + bytes);
      self->heard_(data, ipv4_text(operation->from.sin_addr),
                   ntohs(operation->from.sin_port));
    }
    // A receive that failed changes nothing about the socket: the next
    // datagram is waited for all the same.
    self->receive();
  };
  WSABUF buffer{static_cast<ULONG>(operation->buffer.size()),
                reinterpret_cast<char*>(operation->buffer.data())};
  const int result = WSARecvFrom(
      socket_, &buffer, 1, nullptr, &operation->flags,
      reinterpret_cast<sockaddr*>(&operation->from), &operation->from_length,
      operation, nullptr);
  loop().issued(operation, result == 0);
}

void UdpSocket::send(std::vector<std::uint8_t> data, int port,
                     const std::string& address, std::function<void()> done) {
  if (closed_) {
    return;
  }
  auto* operation = new SendOperation(nullptr);
  operation->data = std::move(data);
  operation->to.sin_family = AF_INET;
  operation->to.sin_port = htons(static_cast<u_short>(port));
  if (inet_pton(AF_INET, address.c_str(), &operation->to.sin_addr) != 1) {
    delete operation;
    if (done) {
      loop().post(done);
    }
    return;
  }
  auto self = shared_from_this();
  operation->done = [self, done](DWORD, DWORD) {
    if (done && !self->closed_) {
      done();
    }
  };
  WSABUF buffer{static_cast<ULONG>(operation->data.size()),
                reinterpret_cast<char*>(operation->data.data())};
  const int result = WSASendTo(
      socket_, &buffer, 1, nullptr, 0,
      reinterpret_cast<const sockaddr*>(&operation->to), sizeof operation->to,
      operation, nullptr);
  loop().issued(operation, result == 0);
}

void UdpSocket::close() {
  if (closed_) {
    return;
  }
  closed_ = true;
  closesocket(socket_);
}

}  // namespace feq::share::service
