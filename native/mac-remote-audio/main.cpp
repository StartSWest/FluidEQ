/* FluidEQ — GPL-3.0-or-later */
#include "lan.h"
#include "parent_watch.h"
#include "playback_core.h"
#include <array>
#include <cerrno>
#include <charconv>
#include <cmath>
#include <csignal>
#include <cstdio>
#include <cstring>
#include <poll.h>
#include <string_view>
#include <unistd.h>
#include <vector>

namespace feq::maclan {
namespace {
constexpr uint32_t kFailure = 0x80004005;
constexpr size_t kMaxPayload = remote::kMaxPacketFrames * remote::kMaxChannels * sizeof(float) + sizeof(uint32_t);
bool command(const Header& h, const void* payload, Playback& playback,
             Capture& capture, Capture& monitor, Replies& replies, bool& quit,
             uint32_t& capture_id, uint32_t& monitor_id) {
  const auto* bytes = static_cast<const char*>(payload);
  std::string error;
  switch (h.kind) {
    case 1: {
      if (h.bytes != 0 && h.bytes != 38) return false;
      const std::string guid(bytes, h.bytes);
      for (const unsigned char c : guid) if (c < 32 || c > 126) return false;
      const bool opened = playback.open(guid, error);
      if (!opened) std::fprintf(stderr, "Share Audio playback: %s\n", error.c_str());
      return replies.send(3, h.id, opened ? 0 : kFailure);
    }
    case 2: {
      if (h.bytes != sizeof(uint32_t) + static_cast<uint32_t>(h.frames) * h.channels * sizeof(float)) return false;
      uint32_t sequence = 0;
      std::memcpy(&sequence, payload, sizeof(sequence));
      std::vector<float> samples(static_cast<size_t>(h.frames) * h.channels);
      std::memcpy(samples.data(), bytes + sizeof(sequence), samples.size() * sizeof(float));
      return playback.push(h, samples.data(), sequence);
    }
    case 3: if (h.bytes || h.id == 0 || h.id > remote::kMaxPeers) return false; playback.remove(h.id); return true;
    case 4: {
      float value = 0;
      if (h.bytes != sizeof(value)) return false;
      std::memcpy(&value, payload, sizeof(value));
      if (!std::isfinite(value) || value < 0 || value > 1) return false;
      playback.volume(value); return true;
    }
    case 5: if (h.bytes) return false; playback.reset(); return true;
    case 6: if (h.bytes) return false; quit = true; return true;
    case 7: if (h.bytes) return false; playback.close(); return replies.send(3, h.id);
    case 8: {
      if (std::string_view(bytes, h.bytes) != "lan" || capture.active()) return false;
      capture_id = h.id;
      const bool opened = capture.start(error);
      if (!opened) std::fprintf(stderr, "Share Audio capture: %s\n", error.c_str());
      return replies.send(3, h.id, opened ? 0 : kFailure);
    }
    case 9: if (h.bytes) return false; capture.stop(); return replies.send(3, h.id);
    case 11: {
      if (h.bytes || monitor.active()) return false;
      monitor_id = h.id;
      const bool opened = monitor.start(error);
      if (!opened) std::fprintf(stderr, "Live output capture: %s\n", error.c_str());
      return replies.send(3, h.id, opened ? 0 : kFailure);
    }
    case 12: if (h.bytes) return false; monitor.stop(); return replies.send(3, h.id);
    default: return false;
  }
}
}

int run(uint32_t parent_pid) {
  // A dead parent must release the tap and output even if a pipe is blocked.
  feq_watch_parent(parent_pid, nullptr);
  std::signal(SIGPIPE, SIG_IGN);
  Wake wake;
  Replies replies;
  Playback playback(replies, wake);
  Capture capture(replies, wake);
  Capture monitor(replies, wake, CapturePurpose::monitor);
  if (!replies.send(1)) return 1;
  bool quit = false;
  uint32_t capture_id = 0;
  uint32_t monitor_id = 0;
  std::vector<char> pending;
  pending.reserve(kMaxPayload + sizeof(Header));
  std::array<char, 16384> input{};
  while (!quit) {
    pollfd descriptors[]{{STDIN_FILENO, POLLIN, 0}, {wake.descriptor(), POLLIN, 0}};
    if (::poll(descriptors, 2, -1) < 0) { if (errno == EINTR) continue; return 1; }
    if (descriptors[1].revents & POLLIN) {
      wake.drain();
      playback.service();
      std::string error;
      if (!capture.refresh(error)) {
        capture.stop();
        std::fprintf(stderr, "Share Audio capture stopped: %s\n", error.c_str());
        if (!replies.send(9, capture_id, kFailure)) return 1;
      }
      if (!monitor.refresh(error)) {
        monitor.stop();
        std::fprintf(stderr, "Live output capture stopped: %s\n", error.c_str());
        if (!replies.send(12, monitor_id, kFailure)) return 1;
      }
    }
    if (descriptors[0].revents & (POLLIN | POLLHUP | POLLERR)) {
      const auto count = ::read(STDIN_FILENO, input.data(), input.size());
      if (count == 0) break;
      if (count < 0) { if (errno == EINTR) continue; return 1; }
      pending.insert(pending.end(), input.begin(), input.begin() + count);
      while (pending.size() >= sizeof(Header)) {
        Header header;
        std::memcpy(&header, pending.data(), sizeof(header));
        if (header.magic != 0x31504c46 || header.bytes > kMaxPayload) return 1;
        const size_t total = sizeof(Header) + header.bytes;
        if (pending.size() < total) break;
        if (!command(header, pending.data() + sizeof(Header), playback, capture,
                     monitor, replies, quit, capture_id, monitor_id)) {
          replies.send(4, header.id, kFailure); return 1;
        }
        pending.erase(pending.begin(), pending.begin() + static_cast<std::ptrdiff_t>(total));
        if (quit) break;
      }
    }
  }
  return 0;
}
}  // namespace feq::maclan

int main(int argc, char** argv) {
  uint32_t pid = 0;
  if (argc != 3 || std::string_view(argv[1]) != "--parent-pid") return 2;
  const std::string_view value(argv[2]);
  const auto parsed = std::from_chars(value.data(), value.data() + value.size(), pid);
  if (parsed.ec != std::errc() || parsed.ptr != value.data() + value.size() || pid == 0) return 2;
  try { return feq::maclan::run(pid); }
  catch (const std::exception& error) { std::fprintf(stderr, "Share Audio: %s\n", error.what()); return 1; }
}
