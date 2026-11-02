/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * The two pipes the tray serves, on its loop thread.
 *
 * The engine's: `\\.\pipe\FluidEQ-Engine-Owner`, the line the FluidEQ
 * Engine holds to know FluidEQ is running (`engineOwnerPipe.ts`,
 * `owner_link.h`). Nothing is sent either way; the connection existing is
 * the whole message, and the tray ending — however it ends — is the engine
 * hearing FluidEQ gone.
 *
 * Main's: the tray's own pipe, where main hands over what to show and the
 * tray says what was pressed. One JSON message a line each way.
 */

#include <functional>
#include <memory>
#include <optional>
#include <set>
#include <span>
#include <string>
#include <variant>

#include "fluideq/io/pipes.h"
#include "fluideq/share/json.h"

namespace feq::tray {

namespace io = feq::io;

class OwnerPipe : public std::enable_shared_from_this<OwnerPipe> {
 public:
  /** Serving `name`, or the failure that stopped it (another serves it). */
  static std::variant<std::shared_ptr<OwnerPipe>, io::Failure> serve(
      const std::wstring& name);

  explicit OwnerPipe(std::shared_ptr<io::PipeServer> server);
  void close();
  std::size_t connections() const { return connections_.size(); }

 private:
  void connected(const std::shared_ptr<io::PipeStream>& connection);

  std::shared_ptr<io::PipeServer> server_;
  std::set<std::shared_ptr<io::PipeStream>> connections_;
};

class AppLink : public std::enable_shared_from_this<AppLink> {
 public:
  struct Events {
    /** Main connected; what it is told first goes here. */
    std::function<void()> arrived;
    /** A message from main, parsed. */
    std::function<void(const share::json::Value& message)> message;
    /** Main's connection ended, whatever it said before. */
    std::function<void()> gone;
  };

  static std::variant<std::shared_ptr<AppLink>, io::Failure> serve(
      const std::wstring& name, Events events);

  AppLink(std::shared_ptr<io::PipeServer> server, Events events);

  bool connected() const { return main_ != nullptr; }
  /** One message to main; nothing when main is not there. */
  void send(const share::json::Value& message);
  void close();

 private:
  void accepted(const std::shared_ptr<io::PipeStream>& connection);
  void heard(const std::shared_ptr<io::PipeStream>& connection,
             std::span<const std::uint8_t> data);

  std::shared_ptr<io::PipeServer> server_;
  Events events_;
  std::shared_ptr<io::PipeStream> main_;
  std::string pending_;
};

/** A line longer than this is not main's; the connection is dropped. */
inline constexpr std::size_t kMaxLineBytes = 1024 * 1024;

}  // namespace feq::tray
