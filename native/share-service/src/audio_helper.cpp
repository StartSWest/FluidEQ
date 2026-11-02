/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "audio_helper.h"

#include <algorithm>
#include <cstdio>
#include <map>

#include "fluideq/share/json.h"
#include "link_error.h"
#include "pipes.h"

namespace feq::share::service {
namespace {

constexpr std::size_t kMaxReplyBytes = 4096;
constexpr std::size_t kMaxQueuedBytes = 1'048'576;
constexpr std::size_t kMaxStderrBytes = 4096;

std::uint32_t u32_at(const Bytes& bytes, std::size_t at) {
  return static_cast<std::uint32_t>(bytes[at]) |
         (static_cast<std::uint32_t>(bytes[at + 1]) << 8) |
         (static_cast<std::uint32_t>(bytes[at + 2]) << 16) |
         (static_cast<std::uint32_t>(bytes[at + 3]) << 24);
}

std::uint16_t u16_at(const Bytes& bytes, std::size_t at) {
  return static_cast<std::uint16_t>(bytes[at] | (bytes[at + 1] << 8));
}

void put_u32(Bytes& bytes, std::size_t at, std::uint32_t value) {
  for (int shift = 0; shift < 4; shift += 1) {
    bytes[at + static_cast<std::size_t>(shift)] =
        static_cast<std::uint8_t>(value >> (8 * shift));
  }
}

void put_u16(Bytes& bytes, std::size_t at, std::uint16_t value) {
  bytes[at] = static_cast<std::uint8_t>(value);
  bytes[at + 1] = static_cast<std::uint8_t>(value >> 8);
}

std::wstring& helper_path() {
  static std::wstring path;
  return path;
}

std::wstring beside_this_service() {
  std::wstring path(MAX_PATH, L'\0');
  for (;;) {
    const DWORD length = GetModuleFileNameW(
        nullptr, path.data(), static_cast<DWORD>(path.size()));
    if (length == 0) {
      return {};
    }
    if (length < path.size()) {
      path.resize(length);
      break;
    }
    path.resize(path.size() * 2);
  }
  const std::size_t slash = path.find_last_of(L"\\/");
  return path.substr(0, slash + 1) + L"FluidEQ-LAN-Playback.exe";
}

}  // namespace

Bytes playback_command(std::uint32_t kind, std::uint32_t id,
                       std::span<const std::uint8_t> payload,
                       std::uint32_t rate, std::uint16_t channels,
                       std::uint16_t frames) {
  Bytes packet(kPlaybackHeaderBytes);
  put_u32(packet, 0, kPlaybackMagic);
  put_u32(packet, 4, kind);
  put_u32(packet, 8, id);
  put_u32(packet, 12, rate);
  put_u16(packet, 16, channels);
  put_u16(packet, 18, frames);
  put_u32(packet, 20, static_cast<std::uint32_t>(payload.size()));
  packet.insert(packet.end(), payload.begin(), payload.end());
  return packet;
}

void PlaybackReplyReader::push(
    std::span<const std::uint8_t> bytes,
    const std::function<void(const PlaybackReply&)>& accept) {
  pending_.insert(pending_.end(), bytes.begin(), bytes.end());
  while (pending_.size() >= kPlaybackHeaderBytes) {
    const std::uint32_t size = u32_at(pending_, 20);
    const std::uint32_t kind = u32_at(pending_, 4);
    const std::uint32_t rate = u32_at(pending_, 12);
    const std::uint16_t channels = u16_at(pending_, 16);
    const std::uint16_t frames = u16_at(pending_, 18);
    const bool valid_capture =
        channels >= 1 && channels <= 8 && frames >= 1 && frames <= 8192 &&
        rate >= 8000 && rate <= 384000 &&
        size == static_cast<std::uint32_t>(frames) * channels * 4;
    if (u32_at(pending_, 0) != kPlaybackMagic ||
        (kind == 10 ? !valid_capture : size > kMaxReplyBytes)) {
      throw LinkError("Invalid native playback reply.");
    }
    const std::size_t total = kPlaybackHeaderBytes + size;
    if (pending_.size() < total) {
      return;
    }
    PlaybackReply reply;
    reply.kind = kind;
    reply.id = u32_at(pending_, 8);
    reply.rate = rate;
    reply.frames = frames;
    if (kind == 10) {
      reply.channels = channels;
    }
    reply.payload.assign(pending_.begin() + kPlaybackHeaderBytes,
                         pending_.begin() + static_cast<std::ptrdiff_t>(total));
    pending_.erase(pending_.begin(),
                   pending_.begin() + static_cast<std::ptrdiff_t>(total));
    accept(reply);
  }
}

struct Helper : std::enable_shared_from_this<Helper> {
  std::shared_ptr<ChildProcess> child;
  std::shared_ptr<PipeStream> input;
  std::shared_ptr<PipeStream> output;
  std::shared_ptr<PipeStream> errors;
  std::vector<std::shared_ptr<AudioClient>> clients;
  Future<Nothing> ready;
  std::map<std::uint32_t, Future<Nothing>> requests;
  std::uint32_t next_id = 0;
  std::uint32_t version = 0;
  bool ended = false;
  bool is_ready = false;
  bool exited = false;
  bool output_closed = false;
  bool errors_closed = false;
  std::string stderr_text;
  PlaybackReplyReader reader;

  bool has(const std::shared_ptr<AudioClient>& client) const {
    return std::find(clients.begin(), clients.end(), client) != clients.end();
  }
  bool forget(const std::shared_ptr<AudioClient>& client) {
    const auto found = std::find(clients.begin(), clients.end(), client);
    if (found == clients.end()) {
      return false;
    }
    clients.erase(found);
    return true;
  }
};

namespace {

std::shared_ptr<Helper>& current() {
  static std::shared_ptr<Helper> helper;
  return helper;
}

void end(const std::shared_ptr<Helper>& helper, const Failure& error) {
  if (helper->ended) {
    return;
  }
  helper->ended = true;
  if (current() == helper) {
    current().reset();
  }
  auto requests = std::move(helper->requests);
  helper->requests.clear();
  for (auto& [id, request] : requests) {
    request.reject(error);
  }
  auto clients = std::move(helper->clients);
  helper->clients.clear();
  for (const auto& client : clients) {
    client->stopped(error);
  }
  if (helper->child) {
    helper->child->kill();
  }
}

void stop(const std::shared_ptr<Helper>& helper, const Failure& error) {
  if (!helper->is_ready) {
    helper->ready.reject(error);
  }
  end(helper, error);
}

void write(const std::shared_ptr<Helper>& helper, const Bytes& packet) {
  if (helper->ended) {
    throw LinkError("The LAN audio helper has stopped.");
  }
  // A stalled helper must not turn a short network burst into minutes of
  // stale sound; its own audio thread reads a separate bounded queue.
  if (helper->input->writable_length() + packet.size() > kMaxQueuedBytes) {
    const Failure error = failure_with("The LAN audio helper is overloaded.");
    end(helper, error);
    throw LinkError(error);
  }
  helper->input->write(packet);
}

/** Node's `close`: the process has exited and both of its streams ended. */
void maybe_closed(const std::shared_ptr<Helper>& helper) {
  if (!helper->exited || !helper->output_closed || !helper->errors_closed) {
    return;
  }
  const std::string said = share::json::trim(helper->stderr_text);
  stop(helper,
       failure_with(said.empty() ? "The LAN audio helper stopped." : said));
}

void replied(const std::shared_ptr<Helper>& helper,
             const PlaybackReply& reply) {
  if (reply.kind == 1 && !helper->is_ready && reply.payload.empty()) {
    helper->is_ready = true;
    helper->version = reply.rate;
    helper->ready.resolve(Nothing{});
    return;
  }
  if (!helper->is_ready) {
    throw LinkError("The LAN audio helper answered before it was ready.");
  }
  if (reply.kind == 3 && reply.payload.empty()) {
    const auto found = helper->requests.find(reply.id);
    if (found != helper->requests.end()) {
      const Future<Nothing> request = found->second;
      helper->requests.erase(found);
      if (reply.rate >= 0x80000000u) {
        char code[16];
        std::snprintf(code, sizeof code, "%x", reply.rate);
        request.reject(failure_with(
            std::string("The LAN audio helper refused (0x") + code + ")."));
      } else {
        request.resolve(Nothing{});
      }
    }
    return;
  }
  if (reply.kind == 4 && reply.id != 0) {
    // A command it could not take: the helper ends after this reply.
    throw LinkError("The LAN audio helper refused a command.");
  }
  const auto clients = helper->clients;
  for (const auto& client : clients) {
    if (client->reply) {
      client->reply(reply);
    }
  }
}

std::shared_ptr<Helper> start() {
  const std::wstring executable =
      helper_path().empty() ? beside_this_service() : helper_path();
  if (executable.empty() ||
      GetFileAttributesW(executable.c_str()) == INVALID_FILE_ATTRIBUTES) {
    throw LinkError("The LAN audio helper is unavailable.");
  }
  auto helper = std::make_shared<Helper>();
  // Settled either way before anyone awaits it; a refusal is also an end.
  helper->ready.then([](const Future<Nothing>::Result&) {});
  const auto input = child_pipe(false);
  const auto output = child_pipe(true);
  const auto errors = child_pipe(true);
  if (!input || !output || !errors) {
    for (const auto& pipe : {input, output, errors}) {
      if (pipe) {
        CloseHandle(pipe->theirs);
        pipe->ours->destroy();
      }
    }
    throw LinkError("The LAN audio helper could not start.");
  }
  helper->input = input->ours;
  helper->output = output->ours;
  helper->errors = errors->ours;
  std::weak_ptr<Helper> weak = helper;
  auto spawned = ChildProcess::spawn(
      executable,
      {L"--parent-pid", std::to_wstring(GetCurrentProcessId())},
      input->theirs, output->theirs, errors->theirs, [weak](DWORD) {
        if (const auto alive = weak.lock()) {
          alive->exited = true;
          maybe_closed(alive);
        }
      });
  CloseHandle(input->theirs);
  CloseHandle(output->theirs);
  CloseHandle(errors->theirs);
  if (spawned.index() == 1) {
    // Node reports a child that could not start as an event, not a throw.
    const Failure failure = std::get<1>(spawned);
    loop().post([helper, failure] {
      helper->input->destroy();
      helper->output->destroy();
      helper->errors->destroy();
      stop(helper, failure);
    });
    return helper;
  }
  helper->child = std::get<0>(spawned);
  helper->input->watch_closed([weak](const std::optional<Failure>& failure) {
    const auto alive = weak.lock();
    if (alive && failure) {
      stop(alive, *failure);
    }
  });
  helper->errors->start(PipeStream::Events{
      [weak](std::span<const std::uint8_t> data) {
        if (const auto alive = weak.lock()) {
          alive->stderr_text.append(data.begin(), data.end());
          if (alive->stderr_text.size() > kMaxStderrBytes) {
            alive->stderr_text.erase(
                0, alive->stderr_text.size() - kMaxStderrBytes);
          }
        }
      },
      {},
      [weak](const std::optional<Failure>&) {
        if (const auto alive = weak.lock()) {
          alive->errors_closed = true;
          maybe_closed(alive);
        }
      }});
  helper->output->start(PipeStream::Events{
      [weak](std::span<const std::uint8_t> data) {
        const auto alive = weak.lock();
        if (!alive || alive->ended) {
          return;
        }
        try {
          alive->reader.push(data, [&alive](const PlaybackReply& reply) {
            replied(alive, reply);
          });
        } catch (const LinkError& error) {
          stop(alive, error.failure());
        }
      },
      {},
      [weak](const std::optional<Failure>&) {
        if (const auto alive = weak.lock()) {
          alive->output_closed = true;
          maybe_closed(alive);
        }
      }});
  return helper;
}

void release(const std::shared_ptr<Helper>& helper,
             const std::shared_ptr<AudioClient>& client) {
  if (!helper->forget(client) || !helper->clients.empty()) {
    return;
  }
  // The last lease: let the helper finish on its own end of the pipe. A
  // lease taken from here on starts a new one, and this one's captures end
  // with it.
  helper->ended = true;
  if (current() == helper) {
    current().reset();
  }
  auto requests = std::move(helper->requests);
  helper->requests.clear();
  for (auto& [id, request] : requests) {
    request.reject(failure_with("The LAN audio helper was released."));
  }
  helper->input->end(playback_command(6));
}

}  // namespace

AudioLease::AudioLease(std::shared_ptr<Helper> helper,
                       std::shared_ptr<AudioClient> client)
    : helper_(std::move(helper)),
      client_(std::move(client)),
      version_(helper_->version) {}

HelperLease::Request AudioLease::request(std::uint32_t kind,
                                         const std::optional<Bytes>& payload) {
  helper_->next_id = helper_->next_id == 0xFFFFFFFFu ? 1 : helper_->next_id + 1;
  const std::uint32_t id = helper_->next_id;
  Future<Nothing> answered;
  helper_->requests[id] = answered;
  try {
    write(helper_, playback_command(kind, id,
                                    payload ? std::span<const std::uint8_t>(*payload)
                                            : std::span<const std::uint8_t>()));
  } catch (const LinkError& error) {
    helper_->requests.erase(id);
    answered.reject(error.failure());
  }
  return Request{id, answered};
}

void AudioLease::send(const Bytes& packet) { write(helper_, packet); }

void AudioLease::release() {
  if (!released_) {
    released_ = true;
    service::release(helper_, client_);
  }
}

void set_audio_helper_path(std::wstring path) { helper_path() = std::move(path); }

Future<std::shared_ptr<AudioLease>> lease_audio_helper(
    std::shared_ptr<AudioClient> client) {
  try {
    if (!current()) {
      current() = start();
    }
  } catch (const LinkError& error) {
    return Future<std::shared_ptr<AudioLease>>::rejected(error.failure());
  }
  const auto helper = current();
  helper->clients.push_back(client);
  Future<std::shared_ptr<AudioLease>> leased;
  helper->ready.then([helper, client, leased](const Future<Nothing>::Result& ready) {
    if (ready.index() == 1) {
      helper->forget(client);
      leased.reject(std::get<1>(ready));
      return;
    }
    if (helper->ended || !helper->has(client)) {
      leased.reject(failure_with("The LAN audio helper has stopped."));
      return;
    }
    leased.resolve(std::make_shared<AudioLease>(helper, client));
  });
  return leased;
}

std::optional<std::uint32_t> audio_helper_pid() {
  const auto& helper = current();
  if (helper && !helper->ended && helper->child) {
    return helper->child->pid();
  }
  return std::nullopt;
}

}  // namespace feq::share::service
