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
  }
}

void TrayHost::pressed(const std::string& id) {
  link_->send(json::Value::object({
      {"type", json::Value::string("pressed")},
      {"id", json::Value::string(id)},
  }));
}

void TrayHost::main_gone() {
  if (ending_) {
    return;
  }
  ending_ = true;
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
