/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "links.h"

#include <algorithm>

namespace feq::tray {

std::variant<std::shared_ptr<OwnerPipe>, io::Failure> OwnerPipe::serve(
    const std::wstring& name) {
  auto listening = io::PipeServer::listen(name);
  if (listening.index() == 1) {
    return std::get<1>(listening);
  }
  auto pipe = std::make_shared<OwnerPipe>(std::get<0>(listening));
  std::weak_ptr<OwnerPipe> weak = pipe;
  pipe->server_->start([weak](std::shared_ptr<io::PipeStream> connection) {
    if (const auto self = weak.lock()) {
      self->connected(connection);
    } else {
      connection->destroy();
    }
  });
  return pipe;
}

OwnerPipe::OwnerPipe(std::shared_ptr<io::PipeServer> server)
    : server_(std::move(server)) {}

void OwnerPipe::connected(const std::shared_ptr<io::PipeStream>& connection) {
  connections_.insert(connection);
  std::weak_ptr<OwnerPipe> weak = shared_from_this();
  std::weak_ptr<io::PipeStream> weak_connection = connection;
  // The engine never writes; whatever arrives is dropped. A connection that
  // ends — an engine unloading mid-read — ends alone.
  connection->start(io::PipeStream::Events{
      [](std::span<const std::uint8_t>) {},
      {},
      [weak, weak_connection](const std::optional<io::Failure>&) {
        const auto self = weak.lock();
        const auto gone = weak_connection.lock();
        if (self && gone) {
          self->connections_.erase(gone);
        }
      }});
}

void OwnerPipe::close() {
  server_->close();
  auto connections = std::move(connections_);
  connections_.clear();
  for (const auto& connection : connections) {
    connection->destroy();
  }
}

std::variant<std::shared_ptr<AppLink>, io::Failure> AppLink::serve(
    const std::wstring& name, Events events) {
  auto listening = io::PipeServer::listen(name);
  if (listening.index() == 1) {
    return std::get<1>(listening);
  }
  auto link = std::make_shared<AppLink>(std::get<0>(listening), std::move(events));
  std::weak_ptr<AppLink> weak = link;
  link->server_->start([weak](std::shared_ptr<io::PipeStream> connection) {
    if (const auto self = weak.lock()) {
      self->accepted(connection);
    } else {
      connection->destroy();
    }
  });
  return link;
}

AppLink::AppLink(std::shared_ptr<io::PipeServer> server, Events events)
    : server_(std::move(server)), events_(std::move(events)) {}

void AppLink::accepted(const std::shared_ptr<io::PipeStream>& connection) {
  // The newest is main: a main that restarted comes back on a new
  // connection while the old one may not have been seen to end yet.
  if (main_) {
    const auto old = std::move(main_);
    old->replace_events(io::PipeStream::Events{});
    old->destroy();
  }
  main_ = connection;
  pending_.clear();
  std::weak_ptr<AppLink> weak = shared_from_this();
  std::weak_ptr<io::PipeStream> weak_connection = connection;
  connection->start(io::PipeStream::Events{
      [weak, weak_connection](std::span<const std::uint8_t> data) {
        const auto self = weak.lock();
        const auto open = weak_connection.lock();
        if (self && open) {
          self->heard(open, data);
        }
      },
      {},
      [weak, weak_connection](const std::optional<io::Failure>&) {
        const auto self = weak.lock();
        const auto closed = weak_connection.lock();
        if (self && closed && self->main_ == closed) {
          self->main_.reset();
          self->pending_.clear();
          if (self->events_.gone) {
            self->events_.gone();
          }
        }
      }});
  if (events_.arrived) {
    events_.arrived();
  }
}

void AppLink::heard(const std::shared_ptr<io::PipeStream>& connection,
                    std::span<const std::uint8_t> data) {
  if (connection != main_) {
    return;
  }
  pending_.append(data.begin(), data.end());
  std::size_t start = 0;
  for (;;) {
    const std::size_t end = pending_.find('\n', start);
    if (end == std::string::npos) {
      break;
    }
    const auto message =
        share::json::parse(std::string_view(pending_).substr(start, end - start));
    start = end + 1;
    if (message && message->is_object() && events_.message) {
      events_.message(*message);
    }
    if (connection != main_) {
      // A message that ended the link takes what followed it along.
      return;
    }
  }
  pending_.erase(0, start);
  if (pending_.size() > kMaxLineBytes) {
    connection->destroy();
  }
}

void AppLink::send(const share::json::Value& message) {
  if (!main_) {
    return;
  }
  std::string line = share::json::stringify(message);
  line.push_back('\n');
  main_->write(io::Bytes(line.begin(), line.end()));
}

void AppLink::close() {
  server_->close();
  if (main_) {
    const auto old = std::move(main_);
    old->replace_events(io::PipeStream::Events{});
    old->destroy();
  }
}

}  // namespace feq::tray
