/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "network_capture.h"

#include <algorithm>
#include <array>
#include <cstdio>
#include <map>
#include <string>
#include <vector>

#include "audio_helper.h"
#include "fluideq/share/crypto.h"
#include "link_error.h"
#include "io.h"

namespace feq::share::service {
namespace {

constexpr std::size_t kMaxHelloBytes = 256;

std::string hex_of(std::span<const std::uint8_t> bytes) {
  constexpr std::string_view kHex = "0123456789abcdef";
  std::string out;
  for (const std::uint8_t byte : bytes) {
    out.push_back(kHex[byte >> 4]);
    out.push_back(kHex[byte & 0x0F]);
  }
  return out;
}

std::vector<std::string> split_spaces(const std::string& line) {
  std::vector<std::string> parts;
  std::size_t at = 0;
  for (;;) {
    const std::size_t space = line.find(' ', at);
    parts.push_back(line.substr(at, space - at));
    if (space == std::string::npos) {
      return parts;
    }
    at = space + 1;
  }
}

/** One capture helper's process and its two pipe connections. */
struct CaptureProcess : std::enable_shared_from_this<CaptureProcess> {
  std::string token;
  std::wstring pipe_name;
  std::shared_ptr<PipeServer> server;
  std::shared_ptr<PipeStream> commands;
  std::shared_ptr<PipeStream> frames;
  std::shared_ptr<HelperLease> lease;
  std::uint32_t spawn_id = 0;
  bool ready = false;
  bool frame_ready = false;
  bool stopped = false;
  bool failure_reported = false;
  /** Settles once both pipes are in and the helper said it is ready; the
   * process itself is handed out by whoever made it, so this future never
   * holds the process that holds it. */
  Future<Nothing> started;
  std::function<void(const share::lan::AudioChunk&)> on_audio;
  std::function<void()> on_failure;
  std::function<void(std::uint32_t, std::uint32_t, std::uint32_t)> on_reply;
  std::unique_ptr<CaptureFrameReader> reader;

  void clean_up() {
    if (server) {
      server->close();
    }
    if (commands) {
      commands->destroy();
    }
    if (frames) {
      frames->destroy();
    }
    if (lease) {
      lease->release();
    }
  }

  void failure(const Failure& error) {
    if (failure_reported || stopped) {
      return;
    }
    failure_reported = true;
    clean_up();
    if (!ready) {
      started.reject(error);
    } else {
      on_failure();
    }
  }

  void close() {
    if (stopped) {
      return;
    }
    stopped = true;
    // The helper ends on its own when its command pipe closes.
    clean_up();
  }

  void complete_ready() {
    // The two pipe connections arrive independently. A ready audio frame
    // alone used to expose a handle before its command pipe had connected.
    if (!ready && !stopped && !failure_reported && frame_ready && commands &&
        frames) {
      ready = true;
      started.resolve(Nothing{});
    }
  }

  void introduced(const std::shared_ptr<PipeStream>& socket,
                  const std::string& line, std::vector<std::uint8_t> rest) {
    const auto parts = split_spaces(line);
    const std::string role = parts.size() > 2 ? parts[2] : std::string();
    const bool taken = role == "commands" ? commands != nullptr
                                          : frames != nullptr;
    const bool token_ok =
        parts.size() > 1 &&
        share::crypto::timing_safe_equal(share::crypto::bytes_of(parts[1]),
                                         share::crypto::bytes_of(token));
    if (parts[0] != "FLUIDEQ-CAPTURE" || !token_ok ||
        (role != "commands" && role != "frames") || taken) {
      socket->destroy();
      return;
    }
    std::weak_ptr<CaptureProcess> weak = shared_from_this();
    const auto gone = [weak](const std::optional<Failure>& broke) {
      if (const auto self = weak.lock()) {
        self->failure(failure_with(broke ? "The capture pipe broke."
                                       : "The system audio capture stopped."));
      }
    };
    if (role == "commands") {
      commands = socket;
      // Commands flow one way; anything written back is not a frame.
      socket->replace_events(PipeStream::Events{
          [](std::span<const std::uint8_t>) {}, {}, gone});
    } else {
      frames = socket;
      socket->replace_events(PipeStream::Events{
          [weak](std::span<const std::uint8_t> data) {
            if (const auto self = weak.lock()) {
              self->reader->push(data);
            }
          },
          {},
          gone});
      if (!rest.empty()) {
        reader->push(rest);
      }
    }
    if (commands && frames) {
      // Both are in: nobody else is let near this pipe.
      server->close();
      complete_ready();
    }
  }

  void connected(const std::shared_ptr<PipeStream>& socket) {
    auto hello = std::make_shared<std::vector<std::uint8_t>>();
    std::weak_ptr<CaptureProcess> weak = shared_from_this();
    std::weak_ptr<PipeStream> weak_socket = socket;
    socket->start(PipeStream::Events{
        [weak, weak_socket, hello](std::span<const std::uint8_t> data) {
          const auto self = weak.lock();
          const auto open = weak_socket.lock();
          if (!self || !open) {
            return;
          }
          hello->insert(hello->end(), data.begin(), data.end());
          const auto end = std::find(hello->begin(), hello->end(), '\n');
          if (end == hello->end()) {
            if (hello->size() > kMaxHelloBytes) {
              open->destroy();
            }
            return;
          }
          const std::string line(hello->begin(), end);
          std::vector<std::uint8_t> rest(end + 1, hello->end());
          hello->clear();
          // From here the connection belongs to its role, or is dropped.
          open->replace_events(PipeStream::Events{});
          self->introduced(open, line, std::move(rest));
        },
        {},
        {}});
  }
};

/** One capture helper shared by everything that asked for that mode. */
struct Session {
  std::string mode;
  std::vector<std::shared_ptr<std::pair<
      std::function<void(const share::lan::AudioChunk&)>, std::function<void()>>>>
      clients;
  std::map<std::uint32_t, Future<Nothing>> requests;
  std::optional<Future<std::shared_ptr<CaptureProcess>>> opening;
  std::shared_ptr<CaptureProcess> process;
};

std::map<std::string, std::shared_ptr<Session>>& sessions() {
  static std::map<std::string, std::shared_ptr<Session>> all;
  return all;
}

void fail_session(const std::shared_ptr<Session>& current) {
  const auto found = sessions().find(current->mode);
  if (found != sessions().end() && found->second == current) {
    sessions().erase(found);
  }
  if (current->process) {
    current->process->close();
  }
  const Failure error = failure_with("The system audio capture stopped.");
  auto requests = std::move(current->requests);
  current->requests.clear();
  for (auto& [id, request] : requests) {
    request.reject(error);
  }
  auto clients = std::move(current->clients);
  current->clients.clear();
  for (const auto& client : clients) {
    client->second();
  }
}

Future<std::shared_ptr<CaptureProcess>> start_capture_process(
    const std::string& mode, const std::shared_ptr<Session>& session) {
  auto process = std::make_shared<CaptureProcess>();
  std::array<std::uint8_t, 32> token{};
  share::crypto::random_bytes(token);
  process->token = hex_of(token);
  process->pipe_name = unique_pipe_name(L"FluidEQ-LAN-");
  std::weak_ptr<Session> weak_session = session;
  process->on_audio = [weak_session](const share::lan::AudioChunk& chunk) {
    if (const auto current = weak_session.lock()) {
      const auto clients = current->clients;
      for (const auto& client : clients) {
        if (client->first) {
          client->first(chunk);
        }
      }
    }
  };
  process->on_failure = [weak_session] {
    if (const auto current = weak_session.lock()) {
      fail_session(current);
    }
  };
  process->on_reply = [weak_session](std::uint32_t, std::uint32_t id,
                                     std::uint32_t result) {
    // The network's capture renders no mirror: only answers can come.
    const auto current = weak_session.lock();
    if (!current) {
      return;
    }
    const auto found = current->requests.find(id);
    if (found == current->requests.end()) {
      return;
    }
    const Future<Nothing> request = found->second;
    current->requests.erase(found);
    if (result >= 0x80000000u) {
      request.reject(failure_with("Windows could not open or update the second output."));
    } else {
      request.resolve(Nothing{});
    }
  };
  std::weak_ptr<CaptureProcess> weak = process;
  process->reader = std::make_unique<CaptureFrameReader>(CaptureFrameReader::Handlers{
      [weak] {
        if (const auto self = weak.lock()) {
          self->frame_ready = true;
          self->complete_ready();
        }
      },
      [weak](std::uint32_t kind, std::uint32_t id, std::uint32_t result) {
        if (const auto self = weak.lock()) {
          self->on_reply(kind, id, result);
        }
      },
      [weak](const share::lan::AudioChunk& chunk) {
        if (const auto self = weak.lock()) {
          self->on_audio(chunk);
        }
      },
      [weak](const Failure& failure) {
        if (const auto self = weak.lock()) {
          self->failure(failure);
        }
      }});
  // Held here until it is ready or has failed: the pipes and the helper
  // only know it weakly, and nothing else has it while it starts.
  Future<std::shared_ptr<CaptureProcess>> started;
  process->started.then([started, process](const Future<Nothing>::Result& result) {
    if (result.index() == 0) {
      started.resolve(process);
    } else {
      started.reject(std::get<1>(result));
    }
  });
  auto listening = PipeServer::listen(process->pipe_name);
  if (listening.index() == 1) {
    process->failure(std::get<1>(listening));
    return started;
  }
  process->server = std::get<0>(listening);
  process->server->start([weak](std::shared_ptr<PipeStream> socket) {
    if (const auto self = weak.lock()) {
      self->connected(socket);
    } else {
      socket->destroy();
    }
  });
  auto client = std::make_shared<AudioClient>(AudioClient{
      [weak](const PlaybackReply& reply) {
        const auto self = weak.lock();
        // The helper reports a capture that ended under the id it was
        // started with: before it ever reached this pipe, that is the only
        // word of it.
        if (self && reply.kind == 9 && reply.id == self->spawn_id) {
          char code[16];
          std::snprintf(code, sizeof code, "%x", reply.rate);
          self->failure(failure_with(
              std::string("The system audio capture ended (0x") + code + ")."));
        }
      },
      [weak](const Failure& failure) {
        if (const auto self = weak.lock()) {
          self->failure(failure);
        }
      }});
  // The name is ASCII by construction (`unique_pipe_name`).
  std::string pipe_text;
  for (const wchar_t c : process->pipe_name) {
    pipe_text.push_back(static_cast<char>(c));
  }
  const std::string request_text = pipe_text + " " + process->token + " " + mode;
  lease_audio_helper(client).then(
      [process, request_text](
          const Future<std::shared_ptr<AudioLease>>::Result& leased) {
        if (leased.index() == 1) {
          process->failure(std::get<1>(leased));
          return;
        }
        process->lease = std::get<0>(leased);
        if (process->stopped || process->failure_reported) {
          process->lease->release();
          return;
        }
        const auto request = process->lease->request(
            8, std::vector<std::uint8_t>(request_text.begin(), request_text.end()));
        process->spawn_id = request.id;
        request.answered.then([process](const Future<Nothing>::Result& answer) {
          if (answer.index() == 1) {
            process->failure(std::get<1>(answer));
          }
        });
      });
  return started;
}

class SessionLease : public NetworkCapture {
 public:
  SessionLease(std::shared_ptr<Session> session,
               std::shared_ptr<std::pair<std::function<void(const share::lan::AudioChunk&)>,
                                         std::function<void()>>>
                   client)
      : session_(std::move(session)), client_(std::move(client)) {}

  void close() override {
    auto& clients = session_->clients;
    std::erase(clients, client_);
    if (clients.empty()) {
      if (session_->process) {
        session_->process->close();
      }
      const auto found = sessions().find(session_->mode);
      if (found != sessions().end() && found->second == session_) {
        sessions().erase(found);
      }
    }
  }

 private:
  std::shared_ptr<Session> session_;
  std::shared_ptr<std::pair<std::function<void(const share::lan::AudioChunk&)>,
                            std::function<void()>>>
      client_;
};

}  // namespace

Future<std::shared_ptr<NetworkCapture>> start_network_capture(
    std::function<void(const share::lan::AudioChunk&)> on_audio,
    std::function<void()> on_failure) {
  const std::string mode = "lan";
  auto& found = sessions()[mode];
  if (!found) {
    found = std::make_shared<Session>();
    found->mode = mode;
  }
  const auto session = found;
  auto client = std::make_shared<std::pair<
      std::function<void(const share::lan::AudioChunk&)>, std::function<void()>>>(
      std::move(on_audio), std::move(on_failure));
  session->clients.push_back(client);
  if (!session->opening) {
    Future<std::shared_ptr<CaptureProcess>> opened;
    start_capture_process(mode, session)
        .then([session, opened](
                  const Future<std::shared_ptr<CaptureProcess>>::Result& result) {
          if (result.index() == 0) {
            const auto process = std::get<0>(result);
            session->process = process;
            if (session->clients.empty()) {
              process->close();
            }
            opened.resolve(process);
          } else {
            opened.reject(std::get<1>(result));
          }
        });
    session->opening = opened;
  }
  auto lease = std::make_shared<SessionLease>(session, client);
  Future<std::shared_ptr<NetworkCapture>> started;
  session->opening->then(
      [lease, started](const Future<std::shared_ptr<CaptureProcess>>::Result& result) {
        if (result.index() == 1) {
          lease->close();
          started.reject(std::get<1>(result));
          return;
        }
        started.resolve(lease);
      });
  return started;
}

}  // namespace feq::share::service
