/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "pulse_router.h"

#include <algorithm>

namespace fluideq_linux {

namespace {
bool same_volume(const pa::cvolume& left, const pa::cvolume& right) {
  return left.channels == right.channels &&
      std::equal(left.values, left.values + left.channels, right.values);
}
}  // namespace

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
      self->options_.sink_name +
      " monitor.channel-volumes=false state.restore-props=false\"";
  self->release(self->api_.context_load_module(context, "module-virtual-sink",
      args.c_str(), &PulseRouter::on_module_loaded, self));
}

void PulseRouter::follow_master_volume(const pa::sink_info& info) {
  if (info.volume.channels == 0 || info.volume.channels > pa::kChannelsMax) return;
  const bool muted = info.mute != 0;
  const bool echo = source_echo_pending_ && muted == mirrored_mute_ &&
      same_volume(info.volume, mirrored_volume_);
  if (echo) {
    source_echo_pending_ = false;
    source_echo_seen_ = true;
  } else if (source_echo_pending_ && source_echo_seen_) {
    source_echo_pending_ = false;
  }
  if (muted == master_muted_ && same_volume(master_volume_, info.volume)) return;
  master_volume_ = info.volume;
  master_muted_ = muted;
  if (!echo) master_changed_ = true;
}

void PulseRouter::apply_playback_volume() {
  if (playback_ == nullptr ||
      api_.stream_get_state(playback_) != pa::kStreamReady) return;
  const uint32_t index = api_.stream_get_index(playback_);
  if (index == UINT32_MAX) return;
  pa::cvolume unity{};
  unity.channels = static_cast<uint8_t>(layout_.channels);
  std::fill_n(unity.values, unity.channels, 0x10000u);
  release(api_.context_set_sink_input_volume(context_, index,
      &unity, nullptr, nullptr));
  release(api_.context_set_sink_input_mute(context_, index,
      volume_initialised_ ? 0 : 1, nullptr, nullptr));
}

void PulseRouter::sync_system_volume() {
  if (shut_ || volume_failed_ || volume_writes_ != 0) return;
  const Sink* sink = sink_named(target_name_);
  if (sink == nullptr || sink->volume.channels == 0) return;
  if (retarget_volume_.channels > 0) {
    pa::cvolume volume = retarget_volume_;
    if (volume.channels != sink->volume.channels) {
      const uint32_t maximum = *std::max_element(volume.values,
                                                volume.values + volume.channels);
      volume.channels = sink->volume.channels;
      std::fill_n(volume.values, volume.channels, maximum);
    }
    retarget_volume_.channels = 0;
    write_system_volume(sink->index, volume, retarget_mute_, true);
    return;
  }
  if (own_sink_index_ == UINT32_MAX || master_volume_.channels == 0) return;
  if (master_muted_ == sink->muted && same_volume(master_volume_, sink->volume)) {
    const bool first = !volume_initialised_;
    volume_initialised_ = true;
    master_changed_ = false;
    if (first) apply_playback_volume();
    return;
  }
  // The previous route had two masters: a default sink reporting 100% and
  // the physical output still at zero. Keep the physical output as the sole
  // gain, and mirror its controls to/from the default sink. Send stays raw.
  const bool to_output = (volume_initialised_ || source_echo_seen_) && master_changed_;
  if (to_output && !volume_initialised_) {
    volume_initialised_ = true;
    apply_playback_volume();
  }
  master_changed_ = false;
  const uint32_t index = to_output ? sink->index : own_sink_index_;
  const pa::cvolume volume = to_output ? master_volume_ : sink->volume;
  const bool muted = to_output ? master_muted_ : sink->muted;
  write_system_volume(index, volume, muted, to_output);
}

void PulseRouter::write_system_volume(uint32_t index, const pa::cvolume& volume,
                                      bool muted, bool to_output) {
  volume_write_to_output_ = to_output;
  volume_write_generation_ = volume_generation_;
  if (!to_output) {
    mirrored_volume_ = volume;
    mirrored_mute_ = muted;
    source_echo_pending_ = true;
    source_echo_seen_ = false;
  }
  volume_writes_ = 2;
  auto* set_volume = api_.context_set_sink_volume_by_index(context_, index,
      &volume, &PulseRouter::on_volume_written, this);
  if (set_volume == nullptr) on_volume_written(context_, 0, this);
  release(set_volume);
  auto* set_mute = api_.context_set_sink_mute_by_index(context_, index,
      muted ? 1 : 0, &PulseRouter::on_volume_written, this);
  if (set_mute == nullptr) on_volume_written(context_, 0, this);
  release(set_mute);
}

void PulseRouter::on_volume_written(pa::context*, int success, void* data) {
  auto* self = static_cast<PulseRouter*>(data);
  const bool current = self->volume_write_generation_ == self->volume_generation_;
  if (success == 0 && current && !self->volume_failed_) {
    self->volume_failed_ = true;
    self->log_->write("could not synchronise the selected output's system volume");
  }
  if (self->volume_writes_ > 0) --self->volume_writes_;
  if (self->volume_writes_ == 0) {
    if (current && !self->volume_failed_ && !self->volume_write_to_output_) {
      // A fresh snapshot may skip our mirrored value when the user moves
      // the fader immediately after seeing it. The server's write replies
      // already acknowledged that value: use it as the comparison baseline
      // so the following gesture is forwarded instead of restored away.
      self->source_echo_seen_ = true;
      self->master_volume_ = self->mirrored_volume_;
      self->master_muted_ = self->mirrored_mute_;
    }
    self->refresh();
  }
}

}  // namespace fluideq_linux
