/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "pulse_router.h"

#include <sys/eventfd.h>
#include <unistd.h>

#include <algorithm>
#include <cmath>
#include <cstring>
#include <exception>

#include "../compat/wide_path.h"

namespace fluideq_linux {

namespace {

constexpr uint32_t kMaxFrames = 8192;
constexpr uint32_t kInvalidIndex = UINT32_MAX;
constexpr int kStreamDontMove = 0x200;
// The record side hands over 10 ms at a time; the playback keeps 80 ms in
// hand, enough to ride out a busy desktop through a userspace server.
constexpr uint32_t kFragmentMs = 10;
constexpr uint32_t kPlaybackMs = 80;
// The drift between the null sink's clock and the card's is tens of parts
// per million — a few samples a second, a few milliseconds a minute — and
// left alone it either empties the playback (a gap every half hour) or
// grows it without end (the picture drifting off the sound for hours). It
// is corrected with the playback's rate, which is not free: a change of rate
// cost a gap on real PulseAudio 15 as well as on PipeWire's PulseAudio layer
// (measured over 60 s tones: a gap with changes, none without). And a single
// latency reading jitters by a whole server period (21 ms at 1024 frames).
// So changes are made as rarely as the drift allows: the readings are
// averaged (1/64 of each new one), the backlog is held to where it settled
// once sound had flowed for 100 fragments (it includes the card's own delay,
// which only the server knows), and the rate is either the stream's own or
// 0.05% to one side — nudged once the backlog is 20 ms off, back once it has
// crossed the mark. A 50 ppm drift costs a pair of changes every 7 minutes.
constexpr uint32_t kSettleFragments = 100;
constexpr double kAverageWeight = 1.0 / 64.0;
constexpr double kNudgeAtMs = 20.0;
constexpr double kNudge = 0.0005;
constexpr double kOutlierMs = 50.0;
constexpr double kPlayingMs = 1.0;

struct SpeakerName {
  Speaker bit;
  int position;
  const char* name;
};

constexpr SpeakerName kSpeakers[] = {
    {0x1, pa::kFrontLeft, "front-left"},
    {0x2, pa::kFrontRight, "front-right"},
    {0x4, pa::kFrontCenter, "front-center"},
    {0x8, pa::kLfe, "lfe"},
    {0x10, pa::kRearLeft, "rear-left"},
    {0x20, pa::kRearRight, "rear-right"},
    {0x40, pa::kFrontLeftOfCenter, "front-left-of-center"},
    {0x80, pa::kFrontRightOfCenter, "front-right-of-center"},
    {0x100, pa::kRearCenter, "rear-center"},
    {0x200, pa::kSideLeft, "side-left"},
    {0x400, pa::kSideRight, "side-right"},
    {0x800, pa::kTopCenter, "top-center"},
    {0x1000, pa::kTopFrontLeft, "top-front-left"},
    {0x2000, pa::kTopFrontCenter, "top-front-center"},
    {0x4000, pa::kTopFrontRight, "top-front-right"},
    {0x8000, pa::kTopRearLeft, "top-rear-left"},
    {0x10000, pa::kTopRearCenter, "top-rear-center"},
    {0x20000, pa::kTopRearRight, "top-rear-right"},
};

Speaker speaker_of(int position) {
  if (position == pa::kMono) return 0x4;
  for (const SpeakerName& one : kSpeakers) {
    if (one.position == position) return one.bit;
  }
  return 0;
}

/** The position for channel `index` of `layout`, as PulseAudio numbers it. */
int position_of(const ChannelLayout& layout, uint32_t index) {
  for (const SpeakerName& one : kSpeakers) {
    if (one.bit == layout.speakers[index]) return one.position;
  }
  return pa::kAux0 + static_cast<int>(index);
}

std::string position_name(const ChannelLayout& layout, uint32_t index) {
  for (const SpeakerName& one : kSpeakers) {
    if (one.bit == layout.speakers[index]) return one.name;
  }
  return "aux" + std::to_string(index);
}

pa::channel_map map_of(const ChannelLayout& layout) {
  pa::channel_map map{};
  map.channels = static_cast<uint8_t>(layout.channels);
  for (uint32_t at = 0; at < layout.channels; ++at) {
    map.map[at] = position_of(layout, at);
  }
  return map;
}

uint32_t bytes_for(uint32_t rate, uint32_t channels, uint32_t ms) {
  return rate * ms / 1000 * channels * static_cast<uint32_t>(sizeof(float));
}

}  // namespace

std::unique_ptr<PulseRouter> PulseRouter::create(const RouterOptions& options,
                                                 std::string& error) {
  const pa::Api* api = pa::api(error);
  if (api == nullptr) return nullptr;
  std::unique_ptr<PulseRouter> router(new PulseRouter(*api, options));
  if (!router->connect(error)) return nullptr;
  return router;
}

PulseRouter::PulseRouter(const pa::Api& api, RouterOptions options)
    : api_(api), options_(std::move(options)) {
  log_ = std::make_unique<fluideq_engine::Log>(fluideq_engine::no_endpoint());
}

PulseRouter::~PulseRouter() {
  shutdown();
  if (loop_ != nullptr) {
    api_.mainloop_stop(loop_);
    if (context_ != nullptr) {
      api_.context_disconnect(context_);
      api_.context_unref(context_);
    }
    api_.mainloop_free(loop_);
  }
  if (lost_fd_ >= 0) ::close(lost_fd_);
}

bool PulseRouter::connect(std::string& error) {
  lost_fd_ = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
  loop_ = api_.mainloop_new();
  if (loop_ == nullptr || lost_fd_ < 0) {
    error = "could not create PulseAudio's loop";
    return false;
  }
  context_ = api_.context_new(api_.mainloop_get_api(loop_), "FluidEQ Engine");
  if (context_ == nullptr) {
    error = "could not create a PulseAudio context";
    return false;
  }
  api_.context_set_state_callback(context_, &PulseRouter::on_context_state,
                                  this);
  if (api_.context_connect(context_, nullptr, pa::kNoAutospawn, nullptr) < 0 ||
      api_.mainloop_start(loop_) < 0) {
    error = "PulseAudio is not running for this user";
    return false;
  }
  api_.mainloop_lock(loop_);
  for (;;) {
    const int state = api_.context_get_state(context_);
    if (state == pa::kContextReady) break;
    if (state == pa::kContextFailed || state == pa::kContextTerminated) {
      api_.mainloop_unlock(loop_);
      error = "PulseAudio is not running for this user";
      return false;
    }
    api_.mainloop_wait(loop_);
  }
  ready_ = true;
  log_->write("PulseAudio: connected");
  api_.context_set_subscribe_callback(context_, &PulseRouter::on_event, this);
  release(api_.context_subscribe(context_,
                                 pa::kSubscribeSink | pa::kSubscribeServer,
                                 nullptr, nullptr));
  refresh();
  api_.mainloop_unlock(loop_);
  return true;
}

void PulseRouter::release(pa::operation* op) {
  if (op != nullptr) api_.operation_unref(op);
}

void PulseRouter::wait(pa::operation* op) {
  if (op == nullptr) return;
  while (api_.operation_get_state(op) == pa::kOperationRunning &&
         api_.context_get_state(context_) == pa::kContextReady) {
    api_.mainloop_wait(loop_);
  }
  api_.operation_unref(op);
}

void PulseRouter::on_done(pa::context* context, int success, void* data) {
  (void)context;
  (void)success;
  auto* self = static_cast<PulseRouter*>(data);
  self->api_.mainloop_signal(self->loop_, 0);
}

void PulseRouter::on_context_state(pa::context* context, void* data) {
  auto* self = static_cast<PulseRouter*>(data);
  const int state = self->api_.context_get_state(context);
  if ((state == pa::kContextFailed || state == pa::kContextTerminated) &&
      self->ready_ && !self->shut_) {
    self->log_->write("PulseAudio went away");
    const uint64_t one = 1;
    const ssize_t wrote = ::write(self->lost_fd_, &one, sizeof(one));
    (void)wrote;
  }
  self->api_.mainloop_signal(self->loop_, 0);
}

void PulseRouter::on_event(pa::context* context, int event, uint32_t index,
                           void* data) {
  (void)context;
  (void)index;
  auto* self = static_cast<PulseRouter*>(data);
  const int facility = event & pa::kEventFacilityMask;
  if (facility == pa::kEventSink || facility == pa::kEventServer) self->refresh();
}

void PulseRouter::refresh() {
  if (shut_) return;
  if (refreshing_) {
    refresh_again_ = true;
    return;
  }
  refreshing_ = true;
  own_seen_ = false;
  collecting_.clear();
  release(api_.context_get_server_info(context_, &PulseRouter::on_server_info,
                                       this));
}

void PulseRouter::on_server_info(pa::context* context,
                                 const pa::server_info* info, void* data) {
  auto* self = static_cast<PulseRouter*>(data);
  self->default_sink_ = info != nullptr && info->default_sink_name != nullptr
                            ? info->default_sink_name
                            : "";
  self->release(self->api_.context_get_sink_info_list(
      context, &PulseRouter::on_sink_info, self));
  self->api_.mainloop_signal(self->loop_, 0);
}

void PulseRouter::on_sink_info(pa::context* context, const pa::sink_info* info,
                               int eol, void* data) {
  (void)context;
  auto* self = static_cast<PulseRouter*>(data);
  if (eol == 0 && info != nullptr) {
    if (self->options_.sink_name == info->name) {
      self->own_sink_index_ = info->index;
      self->own_seen_ = true;
      return;
    }
    if (std::string(info->name) == kShareSinkName) return;
    Sink sink;
    sink.index = info->index;
    sink.name = info->name;
    sink.description = info->description != nullptr ? info->description : info->name;
    sink.rate = info->spec.rate;
    std::vector<Speaker> speakers;
    for (uint8_t at = 0; at < info->map.channels && at < pa::kChannelsMax; ++at) {
      speakers.push_back(speaker_of(info->map.map[at]));
    }
    sink.layout = layout_for(info->spec.channels, speakers);
    self->collecting_.push_back(std::move(sink));
    return;
  }
  // The end of the list (or an error, which ends it too).
  self->sinks_.swap(self->collecting_);
  self->collecting_.clear();
  if (!self->own_seen_) self->own_sink_index_ = kInvalidIndex;
  self->refreshing_ = false;
  if (self->refresh_again_) {
    self->refresh_again_ = false;
    self->refresh();
    return;
  }
  self->choose_target();
  self->write_outputs();
  self->api_.mainloop_signal(self->loop_, 0);
}

const PulseRouter::Sink* PulseRouter::sink_named(const std::string& name) const {
  if (name.empty()) return nullptr;
  for (const Sink& sink : sinks_) {
    if (sink.name == name) return &sink;
  }
  return nullptr;
}

void PulseRouter::choose_target() {
  if (shut_ || loading_) return;
  const Sink* chosen = nullptr;
  if (!options_.target.empty()) {
    chosen = sink_named(options_.target);
  } else {
    chosen = sink_named(default_sink_);
    if (chosen == nullptr) chosen = sink_named(target_name_);
    if (chosen == nullptr && !sinks_.empty()) chosen = &sinks_.front();
  }
  if (chosen == nullptr) {
    if (!target_name_.empty()) {
      log_->write("no output to play to; waiting for one");
      close_streams();
      target_name_.clear();
      follow_monitor();
    }
    return;
  }
  const bool moved = chosen->name != target_name_ ||
                     !(chosen->layout == layout_) || chosen->rate != rate_ ||
                     playback_ == nullptr || record_ == nullptr;
  if (moved) {
    retarget(*chosen);
    return;  // The streams open once the sink is loaded; the claim after.
  }
  claim_default();
}

void PulseRouter::retarget(const Sink& sink) {
  log_->write("playing to \"" + sink.description + "\" (" + sink.name + "), " +
              std::to_string(sink.layout.channels) + " ch, " +
              std::to_string(sink.rate) + " Hz");
  close_streams();
  target_name_ = sink.name;
  target_index_ = sink.index;
  follow_monitor();
  layout_ = sink.layout;
  rate_ = sink.rate;
  const bool reuse = module_index_ != kInvalidIndex &&
                     module_layout_ == layout_ && module_rate_ == rate_;
  if (!reuse) {
    unload_sink();
    load_sink(sink);
    return;
  }
  open_record();
  load_share();
  open_playback(sink);
  ensure_engine();
  claim_default();
}

std::string PulseRouter::null_sink_args(const std::string& name,
                                        const std::string& properties,
                                        uint32_t rate) const {
  std::string map;
  for (uint32_t at = 0; at < layout_.channels; ++at) {
    if (at > 0) map += ',';
    map += position_name(layout_, at);
  }
  // At the real output's own rate and layout, so the server converts
  // nothing between them.
  return "sink_name=" + name + " sink_properties=" + properties +
         " format=float32le rate=" + std::to_string(rate) +
         " channels=" + std::to_string(layout_.channels) + " channel_map=" + map;
}

void PulseRouter::load_sink(const Sink& sink) {
  const std::string args =
      null_sink_args(options_.sink_name,
                     "device.description=" + options_.sink_description,
                     sink.rate);
  loading_ = true;
  release(api_.context_load_module(context_, "module-null-sink", args.c_str(),
                                   &PulseRouter::on_module_loaded, this));
}

void PulseRouter::on_module_loaded(pa::context* context, uint32_t index,
                                   void* data) {
  (void)context;
  auto* self = static_cast<PulseRouter*>(data);
  self->loading_ = false;
  self->api_.mainloop_signal(self->loop_, 0);
  if (index == kInvalidIndex) {
    self->log_->write("PulseAudio refused the FluidEQ output (module-null-sink)");
    return;
  }
  self->module_index_ = index;
  self->module_layout_ = self->layout_;
  self->module_rate_ = self->rate_;
  if (self->shut_) return;
  // Its sink index arrives with the refresh its creation triggers; the
  // claim of the default waits for that.
  self->open_record();
  self->load_share();
  if (const Sink* sink = self->sink_named(self->target_name_)) {
    self->open_playback(*sink);
  }
  self->ensure_engine();
  self->refresh();
}

void PulseRouter::unload_sink() noexcept {
  unload_share();
  if (module_index_ == kInvalidIndex) return;
  release(api_.context_unload_module(context_, module_index_, nullptr, nullptr));
  module_index_ = kInvalidIndex;
  own_sink_index_ = kInvalidIndex;
}

pa::stream* PulseRouter::record_monitor(const std::string& monitor,
                                        const char* name,
                                        pa::stream_request_cb on_read) {
  pa::sample_spec spec{pa::kSampleFloat32Le, rate_,
                       static_cast<uint8_t>(layout_.channels)};
  const pa::channel_map map = map_of(layout_);
  pa::stream* stream = api_.stream_new(context_, name, &spec, &map);
  if (stream == nullptr) {
    log_->write(std::string("could not create ") + name);
    return nullptr;
  }
  api_.stream_set_read_callback(stream, on_read, this);
  api_.stream_set_state_callback(stream, &PulseRouter::on_record_state, this);
  pa::buffer_attr attr{UINT32_MAX, UINT32_MAX, UINT32_MAX, UINT32_MAX,
                       bytes_for(rate_, layout_.channels, kFragmentMs)};
  if (api_.stream_connect_record(stream, monitor.c_str(), &attr,
                                 pa::kStreamAdjustLatency) < 0) {
    log_->write(std::string("could not record for ") + name);
    api_.stream_unref(stream);
    return nullptr;
  }
  return stream;
}

void PulseRouter::open_record() {
  record_ = record_monitor(options_.sink_name + ".monitor", "FluidEQ capture",
                           &PulseRouter::on_read);
}

bool PulseRouter::open_playback(const Sink& sink) {
  pa::sample_spec spec{pa::kSampleFloat32Le, rate_,
                       static_cast<uint8_t>(layout_.channels)};
  const pa::channel_map map = map_of(layout_);
  playback_ = api_.stream_new(context_, "FluidEQ Engine", &spec, &map);
  if (playback_ == nullptr) {
    log_->write("could not create the playback to " + sink.name);
    return false;
  }
  api_.stream_set_state_callback(playback_, &PulseRouter::on_playback_state,
                                 this);
  api_.stream_set_underflow_callback(
      playback_,
      [](pa::stream*, void* data) {
        // Ran dry: nothing was playing into FluidEQ (the null sink idles and
        // its monitor stops), or the backlog was let go too far. Either way
        // the backlog starts again from the server's prebuffer, so the mark
        // the rate holds it to is measured again once sound flows — a mark
        // taken over silence drained the music into a gap 0.4 s in.
        auto* self = static_cast<PulseRouter*>(data);
        ++self->underflows_;
        self->settle_count_ = 0;
      },
      this);
  pa::buffer_attr attr{UINT32_MAX,
                       bytes_for(rate_, layout_.channels, kPlaybackMs),
                       UINT32_MAX, UINT32_MAX, UINT32_MAX};
  // Never moved by the server: a playback moved to the default would land
  // in the FluidEQ sink itself, a loop. If its output goes, it fails, and
  // the next refresh opens one to wherever the listener is now.
  const int flags = pa::kStreamVariableRate | pa::kStreamAdjustLatency |
                    pa::kStreamAutoTimingUpdate | pa::kStreamInterpolateTiming |
                    kStreamDontMove;
  if (api_.stream_connect_playback(playback_, sink.name.c_str(), &attr, flags,
                                   nullptr, nullptr) < 0) {
    log_->write("could not play to " + sink.name);
    api_.stream_unref(playback_);
    playback_ = nullptr;
    return false;
  }
  playback_rate_ = rate_;
  rate_pending_ = false;
  settle_count_ = 0;
  return true;
}

void PulseRouter::close_streams() noexcept {
  // What the two clocks cost while they ran, once, for a bug report: the
  // playback running dry, and stretches the server lost before we read them.
  if ((underflows_ > 0 || hole_frames_ > 0) && log_) {
    log_->write("the PulseAudio route ran dry " + std::to_string(underflows_) +
                " time(s) and lost " + std::to_string(hole_frames_) +
                " frame(s) before the engine");
  }
  underflows_ = 0;
  pending_frames_ = 0;
  hole_frames_ = 0;
  share_fifo_.clear();
  for (pa::stream** stream : {&record_, &share_record_, &playback_}) {
    if (*stream == nullptr) continue;
    api_.stream_set_state_callback(*stream, nullptr, nullptr);
    api_.stream_set_underflow_callback(*stream, nullptr, nullptr);
    api_.stream_set_read_callback(*stream, nullptr, nullptr);
    api_.stream_disconnect(*stream);
    api_.stream_unref(*stream);
    *stream = nullptr;
  }
  if (engine_) {
    engine_->retire();
    engine_.reset();
  }
}

void PulseRouter::on_record_state(pa::stream* stream, void* data) {
  auto* self = static_cast<PulseRouter*>(data);
  const int state = self->api_.stream_get_state(stream);
  if (state == pa::kStreamFailed) {
    self->log_->write("the FluidEQ capture failed");
  }
}

void PulseRouter::on_playback_state(pa::stream* stream, void* data) {
  auto* self = static_cast<PulseRouter*>(data);
  const int state = self->api_.stream_get_state(stream);
  if (state == pa::kStreamFailed && !self->shut_) {
    // Its output went (it is never moved). Start again from what is there.
    self->log_->write("the playback to " + self->target_name_ + " ended");
    self->api_.stream_set_state_callback(stream, nullptr, nullptr);
    self->api_.stream_unref(stream);
    if (self->playback_ == stream) self->playback_ = nullptr;
    self->refresh();
  }
}

void PulseRouter::ensure_engine() {
  if (shut_ || target_name_.empty() || rate_ == 0) return;
  const Sink* sink = sink_named(target_name_);
  if (sink == nullptr) return;
  fluideq_engine::Endpoint endpoint{widen(endpoint_id_for(sink->name)),
                                    widen(sink->description)};
  const OutputFormat format{rate_, layout_.channels, layout_.mask, kMaxFrames};
  if (engine_ && engine_->endpoint().guid == endpoint.guid &&
      engine_->format().rate == format.rate &&
      engine_->format().channels == format.channels &&
      engine_->format().channel_mask == format.channel_mask) {
    return;
  }
  if (engine_) {
    engine_->retire();
    engine_.reset();
  }
  try {
    planes_.assign(static_cast<size_t>(format.channels) * kMaxFrames, 0.0f);
    interleaved_.assign(static_cast<size_t>(format.channels) * kMaxFrames, 0.0f);
    engine_ = std::make_unique<OutputEngine>(endpoint, format);
  } catch (const std::exception& error) {
    log_->write(std::string("could not start the engine: ") + error.what() +
                "; passing the sound through");
    engine_.reset();
  }
}

void PulseRouter::on_read(pa::stream* stream, size_t bytes, void* data) {
  (void)bytes;
  auto* self = static_cast<PulseRouter*>(data);
  const uint32_t channels = self->layout_.channels;
  if (channels == 0) return;
  const size_t frame_bytes = channels * sizeof(float);
  for (;;) {
    const void* chunk = nullptr;
    size_t size = 0;
    if (self->api_.stream_peek(stream, &chunk, &size) < 0 || size == 0) break;
    // A hole (no data where data was expected) is played as silence.
    const auto frames = static_cast<uint32_t>(size / frame_bytes);
    if (chunk == nullptr) self->hole_frames_ += frames;
    self->main_read_ = true;
    self->process(static_cast<const float*>(chunk), frames);
    self->api_.stream_drop(stream);
  }
  self->follow_drift();
}

void PulseRouter::process(const float* interleaved, uint32_t frames) {
  if (playback_ == nullptr ||
      api_.stream_get_state(playback_) != pa::kStreamReady) {
    pending_frames_ = 0;
    return;
  }
  const uint32_t channels = layout_.channels;
  if (planes_.size() < static_cast<size_t>(channels) * kMaxFrames) {
    planes_.assign(static_cast<size_t>(channels) * kMaxFrames, 0.0f);
    interleaved_.assign(static_cast<size_t>(channels) * kMaxFrames, 0.0f);
  }
  // PulseAudio hands the monitor over in whatever pieces it has — single
  // frames among them — and a block of one frame is all overhead: the
  // engine's load reading said 105% of a 0.02 ms block. So the music is
  // gathered into blocks of one fragment, 10 ms, and processed as those.
  const uint32_t block = std::clamp(rate_ * kFragmentMs / 1000, 1u, kMaxFrames);
  float* planes[8] = {};
  for (uint32_t c = 0; c < channels; ++c) planes[c] = planes_.data() + c * kMaxFrames;
  for (uint32_t done = 0; done < frames;) {
    const uint32_t take = std::min(frames - done, block - pending_frames_);
    for (uint32_t f = 0; f < take; ++f) {
      for (uint32_t c = 0; c < channels; ++c) {
        planes[c][pending_frames_ + f] =
            interleaved != nullptr
                ? interleaved[(static_cast<size_t>(done) + f) * channels + c]
                : 0.0f;
      }
    }
    pending_frames_ += take;
    done += take;
    if (pending_frames_ < block) continue;
    // "FluidEQ" as applications played it is what "FluidEQ Send" carries
    // (a remap of its monitor); other computers' sound joins it here.
    mix_share(planes, channels, block);
    if (engine_) engine_->process(planes, block);
    for (uint32_t f = 0; f < block; ++f) {
      for (uint32_t c = 0; c < channels; ++c) {
        interleaved_[static_cast<size_t>(f) * channels + c] = planes[c][f];
      }
    }
    api_.stream_write(playback_, interleaved_.data(),
                      static_cast<size_t>(block) * channels * sizeof(float),
                      nullptr, 0, pa::kSeekRelative);
    pending_frames_ = 0;
  }
}

void PulseRouter::follow_drift() {
  if (playback_ == nullptr || rate_pending_ ||
      api_.stream_get_state(playback_) != pa::kStreamReady) {
    return;
  }
  pa::usec_t latency = 0;
  int negative = 0;
  if (api_.stream_get_latency(playback_, &latency, &negative) < 0) return;
  const double measured_ms =
      (negative != 0 ? -1.0 : 1.0) * static_cast<double>(latency) / 1000.0;
  // Nothing held yet: the playback is still filling its prebuffer. A mark
  // taken there was 0 ms, and the first real backlog then read as 10 ms of
  // drift and nudged a rate on the second the music started.
  if (measured_ms < kPlayingMs) return;
  // A reading far off the average is the server's timing being rebuilt (300
  // and 550 ms were read in the middle of a steady 20 ms), not the backlog.
  if (settle_count_ > 0 &&
      std::abs(measured_ms - average_ms_) > std::max(kOutlierMs, average_ms_)) {
    return;
  }
  average_ms_ = settle_count_ == 0
                    ? measured_ms
                    : average_ms_ + (measured_ms - average_ms_) * kAverageWeight;
  // While the mark is being measured, the playback runs at its own rate.
  if (settle_count_ < kSettleFragments) {
    ++settle_count_;
    mark_ms_ = average_ms_;
    nudge_ = 0;
  } else {
    // A larger backlog drains with the playback a little fast, a smaller
    // one fills with it a little slow.
    const double error = average_ms_ - mark_ms_;
    if (nudge_ == 0 && error > kNudgeAtMs) nudge_ = 1;
    if (nudge_ == 0 && error < -kNudgeAtMs) nudge_ = -1;
    if ((nudge_ > 0 && error <= 0.0) || (nudge_ < 0 && error >= 0.0)) nudge_ = 0;
  }
  const auto wanted = static_cast<uint32_t>(std::lround(
      static_cast<double>(rate_) * (1.0 + kNudge * static_cast<double>(nudge_))));
  if (wanted == playback_rate_) return;
  pa::operation* op = api_.stream_update_sample_rate(
      playback_, wanted, &PulseRouter::on_rate_set, this);
  if (op == nullptr) return;
  // A few lines an hour at most, and the one thing a report of a slowly
  // growing delay on a PulseAudio machine needs.
  log_->write("playback rate " + std::to_string(wanted) + " Hz (backlog " +
              fluideq_engine::decibels(average_ms_) + " ms, held at " +
              fluideq_engine::decibels(mark_ms_) + " ms)");
  playback_rate_ = wanted;
  rate_pending_ = true;
  api_.operation_unref(op);
}

void PulseRouter::on_rate_set(pa::stream* stream, int success, void* data) {
  (void)stream;
  (void)success;
  auto* self = static_cast<PulseRouter*>(data);
  self->rate_pending_ = false;
  self->api_.mainloop_signal(self->loop_, 0);
}

void PulseRouter::claim_default() {
  if (!options_.take_default || shut_ || own_sink_index_ == kInvalidIndex ||
      playback_ == nullptr) {
    return;
  }
  if (default_sink_ == options_.sink_name) {
    default_taken_ = true;
    return;
  }
  const Sink* previous = sink_named(default_sink_);
  release(api_.context_set_default_sink(context_, options_.sink_name.c_str(),
                                        nullptr, nullptr));
  default_sink_ = options_.sink_name;
  default_taken_ = true;
  // What was playing on the old default follows it here, as PipeWire's
  // session manager does on its own.
  if (previous != nullptr) move_inputs(previous->index, options_.sink_name);
}

void PulseRouter::move_inputs(uint32_t from_sink, const std::string& to) {
  move_from_ = from_sink;
  move_to_ = to;
  move_skip_ = playback_ != nullptr ? api_.stream_get_index(playback_)
                                    : kInvalidIndex;
  release(api_.context_get_sink_input_info_list(
      context_,
      [](pa::context* context, const pa::sink_input_info* info, int eol,
         void* data) {
        auto* self = static_cast<PulseRouter*>(data);
        if (eol != 0 || info == nullptr) {
          self->api_.mainloop_signal(self->loop_, 0);
          return;
        }
        if (info->sink != self->move_from_ || info->index == self->move_skip_) {
          return;
        }
        self->release(self->api_.context_move_sink_input_by_name(
            context, info->index, self->move_to_.c_str(), nullptr, nullptr));
      },
      this));
}

void PulseRouter::write_outputs() noexcept {
  try {
    std::vector<OutputEntry> outputs;
    for (const Sink& sink : sinks_) {
      outputs.push_back(OutputEntry{endpoint_id_for(sink.name), sink.name,
                                    sink.description, sink.layout.channels,
                                    sink.name == target_name_});
    }
    std::string why;
    if (!write_outputs_file("pulseaudio", options_.sink_name, outputs, &why)) {
      log_->write("could not write outputs.json (" + why + ")");
    }
  } catch (...) {
    // The app then lists what it last read; the audio is unaffected.
  }
}

void PulseRouter::shutdown() noexcept {
  if (loop_ == nullptr || shut_) return;
  api_.mainloop_lock(loop_);
  shut_ = true;
  if (ready_ && api_.context_get_state(context_) == pa::kContextReady) {
    // The chosen output becomes the default again, and what plays through
    // FluidEQ goes back to it, before the FluidEQ sink is unloaded.
    if (default_taken_ && !target_name_.empty()) {
      wait(api_.context_set_default_sink(context_, target_name_.c_str(),
                                         &PulseRouter::on_done, this));
      if (own_sink_index_ != kInvalidIndex) {
        move_inputs(own_sink_index_, target_name_);
        // A round trip: every move asked for above has been answered.
        wait(api_.context_get_server_info(
            context_,
            [](pa::context*, const pa::server_info*, void* data) {
              auto* self = static_cast<PulseRouter*>(data);
              self->api_.mainloop_signal(self->loop_, 0);
            },
            this));
      }
    }
    close_streams();
    unload_monitor();
    unload_share();
    if (module_index_ != kInvalidIndex) {
      wait(api_.context_unload_module(context_, module_index_,
                                      &PulseRouter::on_done, this));
      module_index_ = kInvalidIndex;
    }
  }
  close_streams();
  api_.mainloop_unlock(loop_);
}

}  // namespace fluideq_linux

namespace fluideq_linux {

void PulseRouter::select_output(const std::string& name) noexcept {
  if (!options_.target.empty() || loop_ == nullptr) return;
  api_.mainloop_lock(loop_);
  // As the desktop would: the server's default moves, its event comes back,
  // `choose_target` follows and `claim_default` takes the default again.
  if (!shut_ && ready_ && sink_named(name) != nullptr) {
    release(api_.context_set_default_sink(context_, name.c_str(), nullptr,
                                          nullptr));
  }
  api_.mainloop_unlock(loop_);
}

}  // namespace fluideq_linux
