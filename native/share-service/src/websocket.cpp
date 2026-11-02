/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "websocket.h"

#include "fluideq/share/crypto.h"

namespace feq::share::service {
namespace {

constexpr std::string_view kAbortedEarly =
    "WebSocket was closed before the connection was established";

const char* state_name(WebSocket::State state) {
  switch (state) {
    case WebSocket::State::kConnecting:
      return "CONNECTING";
    case WebSocket::State::kOpen:
      return "OPEN";
    case WebSocket::State::kClosing:
      return "CLOSING";
    default:
      return "CLOSED";
  }
}

}  // namespace

std::shared_ptr<WebSocket> WebSocket::connect(const std::string& address,
                                              int port, const std::string& path,
                                              std::size_t max_payload) {
  auto socket = std::make_shared<WebSocket>(false, max_payload);
  socket->remote_address_ = address;
  socket->key_ = ws::new_key();
  std::weak_ptr<WebSocket> weak = socket;
  TcpSocket::connect(
      address, port,
      [weak, address, port, path](std::shared_ptr<TcpSocket> tcp,
                                  std::optional<Failure> failure) {
        const auto self = weak.lock();
        if (!self || self->state_ != State::kConnecting) {
          if (tcp) {
            tcp->destroy();
          }
          return;
        }
        if (failure) {
          self->emit_error_and_close(*failure);
          return;
        }
        self->begin_handshake(std::move(tcp), address, port, path);
      });
  return socket;
}

WebSocket::WebSocket(bool server, std::size_t max_payload)
    : server_(server), reader_(server, max_payload) {}

void WebSocket::begin_handshake(std::shared_ptr<TcpSocket> tcp,
                                const std::string& host, int port,
                                const std::string& path) {
  tcp_ = std::move(tcp);
  std::weak_ptr<WebSocket> weak = shared_from_this();
  tcp_->start(TcpSocket::Events{
      [weak](std::span<const std::uint8_t> data) {
        if (const auto self = weak.lock()) {
          if (self->state_ == State::kConnecting) {
            self->handshake_data(data);
          } else {
            self->read_frames(data);
          }
        }
      },
      [weak] {
        if (const auto self = weak.lock()) {
          self->socket_ended();
        }
      },
      [weak](const std::optional<Failure>& failure) {
        const auto self = weak.lock();
        if (!self) {
          return;
        }
        if (self->state_ == State::kConnecting) {
          // The listener hung up before it answered: Node calls that a
          // socket hang up, ECONNRESET.
          Failure hung_up = failure.value_or(failure_with("socket hang up"));
          if (hung_up.code.empty()) {
            hung_up.code = "ECONNRESET";
          }
          self->emit_error_and_close(hung_up);
          return;
        }
        self->socket_closed();
      }});
  const std::string request = ws::client_request(host, port, path, key_);
  tcp_->write(Bytes(request.begin(), request.end()));
}

void WebSocket::handshake_data(std::span<const std::uint8_t> data) {
  response_.insert(response_.end(), data.begin(), data.end());
  const auto end = ws::head_end(response_);
  if (!end) {
    if (response_.size() > ws::kMaxHeadBytes) {
      abort_handshake("Parse Error: Header overflow", "HPE_HEADER_OVERFLOW");
    }
    return;
  }
  const std::string head(response_.begin(),
                         response_.begin() + static_cast<std::ptrdiff_t>(*end));
  const auto response = ws::parse_response(head);
  if (!response) {
    abort_handshake("Parse Error", "HPE_INVALID_CONSTANT");
    return;
  }
  if (const auto refused = ws::check_response(*response, key_)) {
    abort_handshake(*refused);
    return;
  }
  Bytes rest(response_.begin() + static_cast<std::ptrdiff_t>(*end),
             response_.end());
  response_.clear();
  state_ = State::kOpen;
  on_open.emit();
  if (!rest.empty()) {
    // `ws` unshifts what followed the head; it is read after the open.
    auto self = shared_from_this();
    loop().post([self, rest = std::move(rest)] { self->read_frames(rest); });
  }
}

void WebSocket::adopt(std::shared_ptr<TcpSocket> tcp, Bytes head) {
  tcp_ = std::move(tcp);
  remote_address_ = tcp_->remote_address();
  state_ = State::kOpen;
  std::weak_ptr<WebSocket> weak = shared_from_this();
  tcp_->replace_events(TcpSocket::Events{
      [weak](std::span<const std::uint8_t> data) {
        if (const auto self = weak.lock()) {
          self->read_frames(data);
        }
      },
      [weak] {
        if (const auto self = weak.lock()) {
          self->socket_ended();
        }
      },
      [weak](const std::optional<Failure>&) {
        if (const auto self = weak.lock()) {
          self->socket_closed();
        }
      }});
  if (!head.empty()) {
    auto self = shared_from_this();
    loop().post([self, head = std::move(head)] { self->read_frames(head); });
  }
}

void WebSocket::read_frames(std::span<const std::uint8_t> data) {
  if (state_ == State::kClosed) {
    return;
  }
  std::vector<ws::FrameReader::Event> events;
  reader_.push(data, events);
  for (auto& event : events) {
    handle(event);
  }
}

void WebSocket::handle(ws::FrameReader::Event& event) {
  using Kind = ws::FrameReader::Event::Kind;
  switch (event.kind) {
    case Kind::kMessage:
      if (state_ != State::kClosed) {
        on_message.emit(event.data);
      }
      return;
    case Kind::kPing:
      if (state_ == State::kOpen) {
        tcp_->write(ws::frame(ws::kPong, event.data, mask()));
      }
      return;
    case Kind::kPong:
      return;
    case Kind::kClose:
      close_frame_received_ = true;
      close_code_ = event.code;
      if (event.code == 1005) {
        close();
      } else {
        close(event.code, event.text);
      }
      return;
    case Kind::kError: {
      receiver_errored_ = true;
      if (tcp_ && !tcp_->destroyed()) {
        close(event.code);
      }
      if (!error_emitted_) {
        error_emitted_ = true;
        on_error.emit(failure_with(event.text));
      }
      return;
    }
  }
}

void WebSocket::send(Bytes payload,
                     std::function<void(const std::optional<Failure>&)> done) {
  if (state_ != State::kOpen) {
    if (done) {
      const Failure failure = failure_with(
          std::string("WebSocket is not open: readyState ") +
          std::to_string(static_cast<int>(state_)) + " (" +
          state_name(state_) + ")");
      loop().post([done, failure] { done(failure); });
    }
    return;
  }
  tcp_->write(ws::frame(ws::kBinary, payload, mask()), std::move(done));
}

void WebSocket::close(std::optional<int> code, const std::string& reason) {
  if (state_ == State::kClosed) {
    return;
  }
  if (state_ == State::kConnecting) {
    abort_handshake(std::string(kAbortedEarly));
    return;
  }
  if (state_ == State::kClosing) {
    if (close_frame_sent_ && (close_frame_received_ || receiver_errored_)) {
      tcp_->end();
    }
    return;
  }
  state_ = State::kClosing;
  std::weak_ptr<WebSocket> weak = shared_from_this();
  tcp_->write(ws::frame(ws::kClose, ws::close_payload(code, reason), mask()),
              [weak](const std::optional<Failure>& failure) {
                const auto self = weak.lock();
                if (!self || failure) {
                  return;
                }
                self->close_frame_sent_ = true;
                if (self->close_frame_received_ || self->receiver_errored_) {
                  self->tcp_->end();
                }
              });
}

void WebSocket::terminate() {
  if (state_ == State::kClosed) {
    return;
  }
  if (state_ == State::kConnecting) {
    abort_handshake(std::string(kAbortedEarly));
    return;
  }
  state_ = State::kClosing;
  tcp_->destroy();
}

void WebSocket::abort_handshake(std::string message, std::string code) {
  state_ = State::kClosing;
  if (tcp_) {
    // The socket's own close says nothing here: `ws` wires a socket to the
    // connection only once it is upgraded, so an abort is the error and the
    // close below and nothing else.
    tcp_->replace_events(TcpSocket::Events{});
    tcp_->destroy();
  }
  Failure failure = failure_with(std::move(message));
  failure.code = std::move(code);
  auto self = shared_from_this();
  loop().post([self, failure] { self->emit_error_and_close(failure); });
}

void WebSocket::emit_error_and_close(const Failure& failure) {
  if (close_emitted_) {
    return;
  }
  state_ = State::kClosing;
  error_emitted_ = true;
  on_error.emit(failure);
  emit_close();
}

void WebSocket::socket_ended() {
  state_ = State::kClosing;
}

void WebSocket::socket_closed() {
  state_ = State::kClosing;
  emit_close();
}

void WebSocket::emit_close() {
  if (close_emitted_) {
    return;
  }
  close_emitted_ = true;
  state_ = State::kClosed;
  on_close.emit(close_code_);
  // Nothing is emitted after the close; listeners that hold this
  // connection would otherwise keep it alive through itself.
  remove_all_listeners();
}

std::size_t WebSocket::buffered_amount() const {
  return tcp_ ? tcp_->buffered() : 0;
}

void WebSocket::keep_alive(int idle_seconds) {
  if (tcp_) {
    tcp_->keep_alive(idle_seconds);
  }
}

void WebSocket::remove_all_listeners() {
  on_open.clear();
  on_message.clear();
  on_error.clear();
  on_close.clear();
}

std::optional<std::array<std::uint8_t, 4>> WebSocket::mask() const {
  if (server_) {
    return std::nullopt;
  }
  std::array<std::uint8_t, 4> key{};
  crypto::random_bytes(key);
  return key;
}

}  // namespace feq::share::service
