/* FluidEQ — GPL-3.0-or-later */
#include "playback_runtime.h"
#include <algorithm>

PlaybackRuntime::PlaybackRuntime(HANDLE parent) : output_(parent, render, this) {}
PlaybackRuntime::~PlaybackRuntime() { output_.close(); }
HRESULT PlaybackRuntime::open(const std::wstring& guid) {
  const HRESULT result = output_.open(guid);
  retired_.clear(); // open has stopped and joined the former render thread.
  // A half-opened device is no device: is_open() must not answer yes to it.
  if (FAILED(result)) { output_.close(); return result; }
  for (const auto& peer : peers_) if (peer) {
    if (!peer->output_format(output_.rate(), output_.channels(), output_.mask())) {
      output_.close();
      return E_INVALIDARG;
    }
    peer->reset();
  }
  const HRESULT started = output_.start();
  if (FAILED(started)) output_.close();
  return started;
}
void PlaybackRuntime::close() {
  output_.close();
  retired_.clear(); // close has stopped and joined the render thread.
}
bool PlaybackRuntime::push(unsigned id, std::uint32_t rate, std::uint16_t channels,
                           std::uint32_t frames, std::uint32_t sequence, const float* pcm) {
  if (id == 0 || id > feq::remote::kMaxPeers || rate < 8000 || rate > 384000 || channels == 0 || channels > feq::remote::kMaxChannels ||
      frames == 0 || frames > feq::remote::kMaxPacketFrames || output_.rate() == 0) return false;
  reclaim();
  // Bound objects awaiting the render thread if an input changes format
  // repeatedly while the endpoint is stalled.
  if (retired_.size() >= 64) return false;
  auto& peer = peers_[id - 1];
  if (!peer || peer->source_rate() != rate || peer->source_channels() != channels) {
    auto next = std::make_unique<feq::remote::PeerPlayback>(rate, channels);
    if (!next->output_format(output_.rate(), output_.channels(), output_.mask())) return false;
    audible_[id - 1].store(next.get());
    if (peer) retired_.push_back({std::move(peer), blocks_.load()});
    peer = std::move(next);
  }
  // Overflow is a stream discontinuity handled by the bounded mixer, not a
  // reason to kill every other source connected to this receiver.
  peer->push(pcm, frames, sequence);
  return true;
}
void PlaybackRuntime::remove(unsigned id) {
  if (id == 0 || id > feq::remote::kMaxPeers) return;
  audible_[id - 1].store(nullptr);
  if (peers_[id - 1]) retired_.push_back({std::move(peers_[id - 1]), blocks_.load()});
  reclaim();
}
void PlaybackRuntime::reset() { for (unsigned id = 1; id <= feq::remote::kMaxPeers; ++id) remove(id); }
void PlaybackRuntime::reclaim() {
  const auto block = blocks_.load();
  std::erase_if(retired_, [block](const Retired& old) { return block - old.block >= 2; });
}
feq::remote::PlaybackStats PlaybackRuntime::stats(unsigned id) const {
  return id > 0 && id <= feq::remote::kMaxPeers && peers_[id - 1] ? peers_[id - 1]->stats() : feq::remote::PlaybackStats{};
}
void PlaybackRuntime::render(void* context, float* pcm, std::uint32_t frames) {
  auto& self = *static_cast<PlaybackRuntime*>(context);
  for (const auto& entry : self.audible_) {
    auto* peer = entry.load();
    if (peer) peer->mix(pcm, frames);
  }
  const float to = self.volume_.load();
  const auto channels = self.output_.channels();
  const float step = frames == 0 ? 0 : (to - self.volume_now_) / frames;
  for (std::uint32_t f = 0; f < frames; ++f) {
    self.volume_now_ += step;
    for (unsigned c = 0; c < channels; ++c) pcm[static_cast<size_t>(f) * channels + c] *= self.volume_now_;
  }
  self.volume_now_ = to;
  self.blocks_.fetch_add(1);
}
