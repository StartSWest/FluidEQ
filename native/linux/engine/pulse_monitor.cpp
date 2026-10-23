/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "FluidEQ Monitor" on PulseAudio: what the chosen output plays, offered as
 * an input.
 *
 * The window draws its live graph, top wave and output meter from a capture
 * of what the output plays, and Chromium lists no sink monitors among its
 * inputs (`pw_monitor.cpp` says the same for PipeWire). A remapped source
 * over the chosen output's monitor is an ordinary source, so Chromium lists
 * it; and with FluidEQ as the default, what that output plays is what came
 * through the engine. It follows the output, and the window opens it by its
 * description (`src/renderer/graph/linuxOutputCapture.ts`).
 */

#include <string>

#include "pulse_router.h"

namespace fluideq_linux {

namespace {

constexpr uint32_t kInvalidIndex = UINT32_MAX;

}  // namespace

void PulseRouter::follow_monitor() {
  // One load in flight at a time: its answer calls back here, and the
  // output chosen meanwhile is followed then.
  if (shut_ || monitor_loading_ || monitor_master_ == target_name_) return;
  if (monitor_module_ != kInvalidIndex) {
    release(api_.context_unload_module(context_, monitor_module_, nullptr,
                                       nullptr));
    monitor_module_ = kInvalidIndex;
  }
  monitor_master_ = target_name_;
  if (target_name_.empty()) return;
  // Named after its output: PulseAudio unloads a module after answering the
  // request, so the next one's load arrives while the last one's name is
  // still taken, and a shared name came back as "<name>.2" (PulseAudio 15).
  // The window looks for the description, which stays the same.
  // Quoted twice: the module's arguments end a value at a space unless it
  // is quoted, and the property list parses the inner quotes.
  const std::string args =
      "source_name=" + options_.sink_name + "_monitor." + target_name_ +
      " master=" + target_name_ +
      ".monitor source_properties=\"device.description='FluidEQ Monitor'\"";
  monitor_loading_ = true;
  release(api_.context_load_module(context_, "module-remap-source",
                                   args.c_str(),
                                   &PulseRouter::on_monitor_loaded, this));
}

void PulseRouter::on_monitor_loaded(pa::context* context, uint32_t index,
                                    void* data) {
  (void)context;
  auto* self = static_cast<PulseRouter*>(data);
  self->monitor_loading_ = false;
  self->api_.mainloop_signal(self->loop_, 0);
  if (index == kInvalidIndex) {
    self->log_->write("PulseAudio refused the FluidEQ Monitor "
                      "(module-remap-source); the window's live displays "
                      "will not move");
    return;
  }
  if (self->shut_) {
    self->release(self->api_.context_unload_module(context, index, nullptr,
                                                   nullptr));
    return;
  }
  self->monitor_module_ = index;
  self->follow_monitor();
}

void PulseRouter::unload_monitor() noexcept {
  if (monitor_module_ == kInvalidIndex) return;
  wait(api_.context_unload_module(context_, monitor_module_,
                                  &PulseRouter::on_done, this));
  monitor_module_ = kInvalidIndex;
  monitor_master_.clear();
}

}  // namespace fluideq_linux
