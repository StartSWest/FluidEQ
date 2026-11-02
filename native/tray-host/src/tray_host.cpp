/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "tray_host.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

namespace feq::tray {

namespace json = feq::share::json;

void QuitDuty::set(std::optional<QuitRecipe> recipe) {
  const std::lock_guard<std::mutex> hold(lock_);
  recipe_ = std::move(recipe);
}

void QuitDuty::carry_out(const std::function<void(const QuitRecipe&)>& apply) {
  std::optional<QuitRecipe> recipe;
  {
    const std::lock_guard<std::mutex> hold(lock_);
    if (done_) {
      return;
    }
    done_ = true;
    recipe = recipe_;
  }
  if (recipe) {
    apply(*recipe);
  }
}

std::variant<std::shared_ptr<TrayHost>, io::Failure> TrayHost::start(
    const std::wstring& link_pipe, const std::wstring& owner_pipe,
    std::shared_ptr<QuitDuty> duty, HostParts parts) {
  auto host = std::make_shared<TrayHost>(std::move(duty), std::move(parts));
  std::weak_ptr<TrayHost> weak = host;
  auto link = AppLink::serve(
      link_pipe,
      AppLink::Events{
          [weak] {
            if (const auto self = weak.lock()) {
              self->arrived();
            }
          },
          [weak](const json::Value& message) {
            if (const auto self = weak.lock()) {
              self->heard(message);
            }
          },
          [weak] {
            if (const auto self = weak.lock()) {
              self->main_gone();
            }
          }});
  if (link.index() == 1) {
    return std::get<1>(link);
  }
  host->link_ = std::get<0>(link);
  if (!owner_pipe.empty()) {
    auto owner = OwnerPipe::serve(owner_pipe);
    if (owner.index() == 0) {
      host->owner_ = std::get<0>(owner);
    }
  }
  return host;
}

TrayHost::TrayHost(std::shared_ptr<QuitDuty> duty, HostParts parts)
    : duty_(std::move(duty)), parts_(std::move(parts)) {}

void TrayHost::arrived() {
  // A FluidEQ that came back, from the tray's Open or any other way: the
  // tray is its again, and nothing asked of the one before is still due.
  main_here_ = true;
  leaving_.reset();
  // It takes its own song job back.
  stop_songs();
  songs_.reset();
  launching_ = false;
  open_wanted_ = false;
  quit_wanted_ = false;
  link_->send(json::Value::object({
      {"type", json::Value::string("hello")},
      {"pid", json::Value::number(static_cast<double>(GetCurrentProcessId()))},
      {"ownerPipe", json::Value::boolean(owner_ != nullptr)},
  }));
}

void TrayHost::heard(const json::Value& message) {
  if (ending_) {
    return;
  }
  if (auto state = parse_state(message)) {
    parts_.show(std::move(*state));
    return;
  }
  if (auto recipe = parse_recipe(message)) {
    duty_->set(std::move(recipe->recipe));
    return;
  }
  if (auto leaving = parse_leaving(message)) {
    leaving_ = std::move(*leaving);
    songs_ = parse_leaving_songs(message);
  }
}

void TrayHost::pressed(const std::string& id) {
  if (ending_) {
    return;
  }
  if (main_here_ && !leaving_) {
    link_->send(json::Value::object({
        {"type", json::Value::string("pressed")},
        {"id", json::Value::string(id)},
    }));
    return;
  }
  // Main is gone or going: the menu it left holds Open and Quit, and every
  // press but Quit opens FluidEQ.
  if (id == "quit") {
    if (main_here_) {
      quit_wanted_ = true;
    } else {
      finish();
    }
    return;
  }
  if (main_here_) {
    open_wanted_ = true;
  } else {
    open_fluideq();
  }
}

void TrayHost::main_gone() {
  if (ending_) {
    return;
  }
  main_here_ = false;
  if (leaving_ && !quit_wanted_) {
    // FluidEQ goes on without it, the engine still told the song.
    if (songs_ && parts_.start_songs && !stop_songs_) {
      stop_songs_ = parts_.start_songs(*songs_);
    }
    if (open_wanted_) {
      open_wanted_ = false;
      open_fluideq();
    }
    return;
  }
  finish();
}

void TrayHost::open_fluideq() {
  if (launching_ || !leaving_ || !parts_.launch) {
    return;
  }
  std::weak_ptr<TrayHost> weak = shared_from_this();
  launching_ = parts_.launch(*leaving_, [weak] {
    if (const auto self = weak.lock()) {
      self->launching_ = false;
    }
  });
}

void TrayHost::stop_songs() {
  if (stop_songs_) {
    const auto stop = std::move(stop_songs_);
    stop_songs_ = nullptr;
    stop();
  }
}

void TrayHost::finish() {
  ending_ = true;
  stop_songs();
  // First, so a FluidEQ starting this instant starts a tray of its own
  // instead of connecting to this one on its way out.
  parts_.stop_answering();
  duty_->carry_out(parts_.apply);
  if (owner_) {
    owner_->close();
  }
  link_->close();
  parts_.close();
}

}  // namespace feq::tray
