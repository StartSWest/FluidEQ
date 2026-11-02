/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The listener's half of `websocket.h`: connections upgraded as `ws`'s
// server upgrades them, and those still upgrading kept in bounds.

#include <algorithm>

#include "websocket.h"

namespace feq::share::service {
namespace {

/**
 * Connections still upgrading, over all and from one address. Node's HTTP
 * server lets a connection that never finishes its request go after a
 * minute (`headersTimeout`); this side has no clock, so these are bounded
 * the way `registerLanPeers` bounds the ones still authenticating: a
 * connection arriving to a full room makes room by ending the one that has
 * waited longest. An honest peer sends its request in its first packet.
 */
constexpr std::size_t kMaxUpgrading = 64;
constexpr std::size_t kMaxUpgradingPerAddress = 8;

}  // namespace

std::variant<std::shared_ptr<WebSocketServer>, Failure> WebSocketServer::listen(
    const std::string& host, int port, std::size_t max_payload) {
  auto listening = TcpListener::listen(host, port);
  if (listening.index() == 1) {
    return std::get<1>(listening);
  }
  return std::make_shared<WebSocketServer>(std::get<0>(listening), max_payload);
}

WebSocketServer::WebSocketServer(std::shared_ptr<TcpListener> listener,
                                 std::size_t max_payload)
    : listener_(std::move(listener)), max_payload_(max_payload) {}

void WebSocketServer::start() {
  std::weak_ptr<WebSocketServer> weak = shared_from_this();
  listener_->start(
      [weak](std::shared_ptr<TcpSocket> tcp) {
        if (const auto self = weak.lock()) {
          self->accepted(tcp);
        } else {
          tcp->destroy();
        }
      },
      [weak](const Failure& failure) {
        if (const auto self = weak.lock()) {
          self->on_error.emit(failure);
        }
      });
}

void WebSocketServer::make_room(const std::string& address) {
  const auto from = static_cast<std::size_t>(std::count_if(
      upgrading_.begin(), upgrading_.end(), [&address](const Upgrading& item) {
        return item.tcp->remote_address() == address;
      }));
  if (from >= kMaxUpgradingPerAddress) {
    const auto oldest = std::find_if(
        upgrading_.begin(), upgrading_.end(), [&address](const Upgrading& item) {
          return item.tcp->remote_address() == address;
        });
    const auto tcp = oldest->tcp;
    upgrading_.erase(oldest);
    tcp->destroy();
  }
  if (upgrading_.size() >= kMaxUpgrading) {
    const auto tcp = upgrading_.front().tcp;
    upgrading_.pop_front();
    tcp->destroy();
  }
}

void WebSocketServer::accepted(const std::shared_ptr<TcpSocket>& tcp) {
  if (closed_) {
    tcp->destroy();
    return;
  }
  make_room(tcp->remote_address());
  upgrading_.push_back(Upgrading{tcp, {}});
  std::weak_ptr<WebSocketServer> weak = shared_from_this();
  std::weak_ptr<TcpSocket> weak_tcp = tcp;
  tcp->start(TcpSocket::Events{
      [weak, weak_tcp](std::span<const std::uint8_t> data) {
        const auto self = weak.lock();
        const auto socket = weak_tcp.lock();
        if (!self || !socket) {
          return;
        }
        const auto found = std::find_if(
            self->upgrading_.begin(), self->upgrading_.end(),
            [&socket](const Upgrading& item) { return item.tcp == socket; });
        if (found != self->upgrading_.end()) {
          self->upgrading_data(found, data);
        }
      },
      [] {},
      [weak, weak_tcp](const std::optional<Failure>&) {
        const auto self = weak.lock();
        const auto socket = weak_tcp.lock();
        if (self && socket) {
          self->forget(socket);
        }
      }});
}

void WebSocketServer::forget(const std::shared_ptr<TcpSocket>& tcp) {
  upgrading_.remove_if(
      [&tcp](const Upgrading& item) { return item.tcp == tcp; });
}

void WebSocketServer::upgrading_data(std::list<Upgrading>::iterator at,
                                     std::span<const std::uint8_t> data) {
  at->head.insert(at->head.end(), data.begin(), data.end());
  const auto tcp = at->tcp;
  const auto refuse = [this, &tcp](std::string response) {
    forget(tcp);
    tcp->write(Bytes(response.begin(), response.end()),
               [tcp](const std::optional<Failure>&) { tcp->destroy(); });
  };
  const auto end = ws::head_end(at->head);
  if (!end) {
    if (at->head.size() > ws::kMaxHeadBytes) {
      refuse(ws::refusal(431));
    }
    return;
  }
  const std::string head(at->head.begin(),
                         at->head.begin() + static_cast<std::ptrdiff_t>(*end));
  Bytes rest(at->head.begin() + static_cast<std::ptrdiff_t>(*end),
             at->head.end());
  const auto request = ws::parse_request(head);
  if (!request) {
    refuse(ws::refusal(400));
    return;
  }
  const ws::UpgradeAnswer answer = ws::answer_upgrade(*request);
  if (!answer.accepted) {
    refuse(answer.response);
    return;
  }
  forget(tcp);
  tcp->write(Bytes(answer.response.begin(), answer.response.end()));
  auto socket = std::make_shared<WebSocket>(true, max_payload_);
  socket->adopt(tcp, std::move(rest));
  clients_.push_back(socket);
  std::weak_ptr<WebSocketServer> weak = shared_from_this();
  std::weak_ptr<WebSocket> weak_socket = socket;
  socket->on_close.once([weak, weak_socket](int) {
    const auto self = weak.lock();
    const auto closed = weak_socket.lock();
    if (self && closed) {
      self->clients_.remove(closed);
    }
  });
  on_connection.emit(socket, UpgradeRequest{request->target,
                                            tcp->remote_address()});
}

std::vector<std::shared_ptr<WebSocket>> WebSocketServer::clients() const {
  return {clients_.begin(), clients_.end()};
}

void WebSocketServer::close() {
  if (closed_) {
    return;
  }
  closed_ = true;
  listener_->close();
  auto upgrading = std::move(upgrading_);
  upgrading_.clear();
  for (auto& item : upgrading) {
    item.tcp->destroy();
  }
}

}  // namespace feq::share::service
