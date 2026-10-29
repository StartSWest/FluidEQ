/* FluidEQ — GPL-3.0-or-later */
#include "pw_router.h"

#include <spa/param/props.h>
#include <spa/pod/builder.h>
#include <spa/pod/iter.h>

#include <algorithm>
#include <cmath>

namespace fluideq_linux {

void PipeWireRouter::volume_synced(int seq) {
  if (volume_source_seq_ != 0 && seq == volume_source_seq_) {
    volume_source_seq_ = 0;
    if (source_echo_seen_ && source_changed_) {
      volume_initialised_ = true;
      source_changed_ = false;
      source_volume_changed();
      apply_playback_volume();
    } else {
      sync_source_volume();
    }
  }
  if (volume_write_seq_ != 0 && seq == volume_write_seq_) {
    volume_write_seq_ = 0;
    sync_source_volume();
  }
}

void PipeWireRouter::on_sink_param(void* data, int seq, uint32_t id,
                                  uint32_t index, uint32_t next,
                                  const spa_pod* param) {
  (void)seq;
  (void)index;
  (void)next;
  if (id != SPA_PARAM_Props || param == nullptr) return;
  auto* sink = static_cast<Sink*>(data);
  if (const auto* volume = spa_pod_find_prop(param, nullptr,
                                            SPA_PROP_channelVolumes)) {
    float values[8]{};
    const uint32_t count = spa_pod_copy_array(&volume->value, SPA_TYPE_Float,
                                             values, 8);
    if (count > 0 && std::all_of(values, values + count, [](float value) {
          return std::isfinite(value) && value >= 0;
        })) {
      sink->volumes.assign(values, values + count);
    }
  }
  if (const auto* mute = spa_pod_find_prop(param, nullptr, SPA_PROP_mute)) {
    bool value = false;
    if (spa_pod_get_bool(&mute->value, &value) == 0) sink->muted = value;
  }
  if (sink->name == sink->router->options_.sink_name) {
    sink->router->source_volume_changed();
  } else if (sink->router->target_name_ == sink->name) {
    sink->router->sync_source_volume();
  }
}

void PipeWireRouter::sync_source_volume() {
  // These virtual controls follow the real output. Their node opts out of
  // WirePlumber's independent saved-volume restore, which could overwrite
  // this initial mirror with 100% after the real output had reported zero.
  if (shut_ || capture_.stream == nullptr || volume_source_ == nullptr ||
      volume_source_->proxy == nullptr ||
      volume_write_seq_ != 0 || volume_source_seq_ != 0) return;
  const Sink* sink = sink_named(target_name_);
  if (sink == nullptr || sink->volumes.empty()) return;
  const bool same = source_volume_seen_ && source_mute_seen_ &&
      master_channels_ == sink->volumes.size() &&
      std::equal(sink->volumes.begin(), sink->volumes.end(), master_volumes_) &&
      (master_mute_ != 0) == sink->muted;
  if (same) {
    const bool first = !volume_initialised_;
    volume_initialised_ = true;
    if (first) apply_playback_volume();
    return;
  }
  // The real output is the sole audible master. Its saved zero/mute must
  // appear in the default sink too, rather than a second fader saying 100%.
  // Mirroring controls changes no samples in the pre-master Send capture.
  mirrored_volumes_ = sink->volumes;
  mirrored_muted_ = sink->muted;
  source_echo_seen_ = false;
  source_changed_ = false;
  float muted = sink->muted ? 1.0f : 0.0f;
  // This node belongs to our own client. Apply its controls locally rather
  // than sending a server request back into the client that is awaiting it.
  volume_syncing_ = true;
  const int changed = api_.stream_set_control(capture_.stream, SPA_PROP_channelVolumes,
      static_cast<uint32_t>(mirrored_volumes_.size()), mirrored_volumes_.data(),
      SPA_PROP_mute, 1u, &muted, 0u);
  volume_syncing_ = false;
  if (changed < 0) {
    log_->write("could not mirror the selected output's system volume");
    return;
  }
  source_echo_seen_ = volume_source_->volumes == mirrored_volumes_ &&
      volume_source_->muted == mirrored_muted_;
  volume_source_seq_ = pw_core_sync(core_, PW_ID_CORE, 0);
}

void PipeWireRouter::source_volume_changed() {
  const Sink* source = volume_source_.get();
  if (source == nullptr || source->volumes.empty()) return;
  master_channels_ = static_cast<uint32_t>(source->volumes.size());
  std::copy(source->volumes.begin(), source->volumes.end(), master_volumes_);
  master_mute_ = source->muted ? 1.0f : 0.0f;
  source_volume_seen_ = true;
  source_mute_seen_ = true;
  if (volume_syncing_) return;
  // Stream control-info can contain a queued initial 100% after our mirror
  // write. Read the server node's Props instead, and wait for the write's
  // ordered acknowledgement before treating any source value as a gesture.
  if (volume_source_seq_ != 0) {
    if (source->volumes == mirrored_volumes_ && source->muted == mirrored_muted_) {
      source_echo_seen_ = true;
    } else if (source_echo_seen_) {
      // A real gesture can follow the mirrored value before the core's
      // acknowledgement. Keep it instead of restoring the startup value.
      source_changed_ = true;
    }
    return;
  }
  const Sink* sink = sink_named(target_name_);
  if (sink == nullptr || sink->proxy == nullptr || sink->volumes.empty()) return;
  if (!volume_initialised_) {
    sync_source_volume();
    return;
  }
  if (master_channels_ == sink->volumes.size() &&
      std::equal(sink->volumes.begin(), sink->volumes.end(),
                 master_volumes_) &&
      (master_mute_ != 0) == sink->muted) return;
  write_target_volume();
}

void PipeWireRouter::write_target_volume() {
  const Sink* sink = sink_named(target_name_);
  if (sink == nullptr || sink->proxy == nullptr || master_channels_ == 0) return;
  float values[8]{};
  const uint32_t channels = std::min<uint32_t>(layout_.channels, 8);
  if (channels == master_channels_) {
    std::copy_n(master_volumes_, channels, values);
  } else {
    std::fill_n(values, channels,
        *std::max_element(master_volumes_, master_volumes_ + master_channels_));
  }
  uint8_t bytes[512];
  spa_pod_builder builder = SPA_POD_BUILDER_INIT(bytes, sizeof(bytes));
  const auto* props = static_cast<const spa_pod*>(spa_pod_builder_add_object(
      &builder, SPA_TYPE_OBJECT_Props, SPA_PARAM_Props,
      SPA_PROP_channelVolumes, SPA_POD_Array(sizeof(float), SPA_TYPE_Float,
          channels, values),
      SPA_PROP_mute, SPA_POD_Bool(master_mute_ != 0)));
  if (pw_node_set_param(reinterpret_cast<pw_node*>(sink->proxy),
                         SPA_PARAM_Props, 0, props) < 0) {
    log_->write("could not set the selected output's system volume");
    sync_source_volume();
    return;
  }
  // Ignore intermediate device notifications during a drag. The core's
  // acknowledgement follows the actual accepted controls, including hardware
  // quantisation, which then becomes the default sink's displayed value.
  volume_write_seq_ = pw_core_sync(core_, PW_ID_CORE, 0);
}

void PipeWireRouter::apply_playback_volume() {
  if (playback_.stream == nullptr) return;
  float unity[8] = {1, 1, 1, 1, 1, 1, 1, 1};
  float muted = volume_initialised_ ? 0.0f : 1.0f;
  api_.stream_set_control(playback_.stream, SPA_PROP_channelVolumes,
      layout_.channels, unity, SPA_PROP_mute, 1u, &muted, 0u);
}

void PipeWireRouter::on_playback_state(void* data, pw_stream_state old,
                                      pw_stream_state state,
                                      const char* error) {
  on_stream_state(data, old, state, error);
  if (state == PW_STREAM_STATE_PAUSED || state == PW_STREAM_STATE_STREAMING) {
    static_cast<PipeWireRouter*>(data)->apply_playback_volume();
  }
}

}  // namespace fluideq_linux
