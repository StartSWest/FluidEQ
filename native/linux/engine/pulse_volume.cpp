/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "pulse_router.h"

#include <algorithm>

namespace fluideq_linux {

void PulseRouter::on_origin_loaded(pa::context* context, uint32_t index,
                                   void* data) {
  auto* self = static_cast<PulseRouter*>(data);
  if (index == UINT32_MAX || self->shut_) {
    self->loading_ = false;
    if (index != UINT32_MAX) {
      self->release(
          self->api_.context_unload_module(context, index, nullptr, nullptr));
    }
    if (!self->shut_) {
      self->log_->write("PulseAudio could not open the pre-volume capture clock");
    }
    self->api_.mainloop_signal(self->loop_, 0);
    return;
  }
  self->origin_module_ = index;
  // Disable flat volume: the OS master must never rewrite applications'
  // own volume. Direct per-input monitors, not this sink's muted monitor,
  // capture origins on real PulseAudio. pipewire-pulse uses raw monitor
  // ports instead. Its loopback module also needs an explicit capture node
  // name, or it prefixes "input." and our default/capture target won't exist.
  // The discarded downstream clock is never played.
  const std::string args = "sink_name=" + self->options_.sink_name +
      " master=" + self->options_.sink_name + ".origin" +
      " use_volume_sharing=no force_flat_volume=no sink_properties=\"device.description='" +
      self->options_.sink_description + "' node.name=" +
      self->options_.sink_name + " monitor.channel-volumes=false\"";
  self->release(self->api_.context_load_module(context, "module-virtual-sink",
      args.c_str(), &PulseRouter::on_module_loaded, self));
}

void PulseRouter::follow_master_volume(const pa::sink_info& info) {
  if (info.volume.channels == 0 || info.volume.channels > pa::kChannelsMax) return;
  const bool muted = info.mute != 0;
  if (master_volume_.channels == info.volume.channels && muted == master_muted_ &&
      std::equal(info.volume.values, info.volume.values + info.volume.channels,
                 master_volume_.values)) return;
  master_volume_ = info.volume;
  master_muted_ = muted;
  apply_playback_volume();
}

void PulseRouter::apply_playback_volume() {
  if (playback_ == nullptr || master_volume_.channels == 0 ||
      api_.stream_get_state(playback_) != pa::kStreamReady) return;
  const uint32_t index = api_.stream_get_index(playback_);
  if (index == UINT32_MAX) return;
  release(api_.context_set_sink_input_volume(context_, index,
      &master_volume_, nullptr, nullptr));
  release(api_.context_set_sink_input_mute(context_, index,
      master_muted_ ? 1 : 0, nullptr, nullptr));
}

}  // namespace fluideq_linux
