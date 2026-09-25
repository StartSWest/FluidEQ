/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/*
 * What the rest of the machine is playing: Windows' media sessions, the same
 * surface the volume flyout's now-playing card is built on, for the app's
 * transport bar (src/main/systemMedia.ts).
 *
 * TOLD BY WINDOWS, NOT POLLED. This was a PowerShell loop reading the session
 * manager every 700 ms, because Windows PowerShell cannot subscribe to WinRT
 * events — `Register-ObjectEvent` answers "Windows PowerShell cannot subscribe
 * to Windows RT events". A program can. The manager says when sessions come
 * and go (`SessionsChanged`) and when its own pick moves
 * (`CurrentSessionChanged`), and every session says when its song, its
 * playback state or its timeline changes (`MediaPropertiesChanged`,
 * `PlaybackInfoChanged`, `TimelinePropertiesChanged`). The poll could never
 * see anything sooner than those — a player's position is whatever it last
 * published, which is what the timeline event announces — and it woke a
 * PowerShell every 700 ms for as long as the bar wanted it, to find nothing
 * new almost every time.
 *
 * Windows' threads only record what they were told and wake the loop. The
 * loop alone reads the sessions, builds the line and writes it, so two lines
 * never interleave on the pipe. Every WinRT answer that takes time — a
 * session's media properties, a cover's stream and its bytes — is asked for
 * with a completion handler and never waited on, so a player that never
 * answers leaves the one question open instead of stopping the helper.
 *
 *   FluidEQ-Media.exe <app id>   the app's own AppUserModelId, whose sessions
 *                                are not "the rest of the machine"
 *
 * The output is the watch script's, line for line, so the app's parser did
 * not change (media_line.h holds the text):
 *
 *   null                          nothing playing that is not the app's own
 *   {"app":...,"title":...}       what the session on the bar is doing
 *   {"cover":{"id","type","data"}}  a new picture, before the first reading
 *                                 that names it
 *
 * A line goes out only when what the bar would draw has changed, the position
 * counted in whole seconds. Nothing is read from the input; the helper exits
 * when it closes, which is also what happens when FluidEQ ends however it
 * ends.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <bcrypt.h>
#include <unknwn.h>

#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Media.Control.h>
#include <winrt/Windows.Storage.Streams.h>

#include <algorithm>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <exception>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "media_line.h"

namespace {

namespace wf = winrt::Windows::Foundation;
namespace wmc = winrt::Windows::Media::Control;
namespace wss = winrt::Windows::Storage::Streams;

using Manager = wmc::GlobalSystemMediaTransportControlsSessionManager;
using Session = wmc::GlobalSystemMediaTransportControlsSession;
using Properties =
    wmc::GlobalSystemMediaTransportControlsSessionMediaProperties;
using PlaybackInfo = wmc::GlobalSystemMediaTransportControlsSessionPlaybackInfo;
using PlaybackStatus =
    wmc::GlobalSystemMediaTransportControlsSessionPlaybackStatus;
using fluideq_media::Cover;
using fluideq_media::Reading;

/**
 * Something Windows said, or an answer that came back: the loop looks again.
 * Auto-reset, so any number of callbacks between two looks cost one look.
 */
HANDLE wake_event = nullptr;
/** The app closed this helper's input. Manual-reset. */
HANDLE input_closed = nullptr;
/** The manager said sessions came or went; the loop reads the list again. */
std::atomic<bool> sessions_changed{true};

void wake() { SetEvent(wake_event); }

/** One line to the app; only the loop thread calls this. */
void say(const std::string& line) {
  std::string out = line;
  out.push_back('\n');
  const HANDLE handle = GetStdHandle(STD_OUTPUT_HANDLE);
  const char* at = out.data();
  std::size_t left = out.size();
  while (left > 0) {
    DWORD written = 0;
    const DWORD chunk =
        left > 0x100000u ? DWORD{0x100000u} : static_cast<DWORD>(left);
    if (!WriteFile(handle, at, chunk, &written, nullptr) || written == 0) {
      // The app has gone. Its end closes this helper's input too, and that is
      // what ends the loop.
      return;
    }
    at += written;
    left -= written;
  }
}

DWORD WINAPI read_input(void*) {
  char buffer[256];
  DWORD count = 0;
  while (ReadFile(GetStdHandle(STD_INPUT_HANDLE), buffer, sizeof(buffer),
                  &count, nullptr) &&
         count != 0) {
    // The app writes nothing: this pipe exists to be closed.
  }
  SetEvent(input_closed);
  return 0;
}

/** MD5 through BCrypt, for a cover's id. */
class Md5 {
 public:
  Md5() {
    if (!BCRYPT_SUCCESS(BCryptOpenAlgorithmProvider(
            &algorithm_, BCRYPT_MD5_ALGORITHM, nullptr, 0))) {
      algorithm_ = nullptr;
    }
  }
  ~Md5() {
    if (algorithm_ != nullptr) {
      BCryptCloseAlgorithmProvider(algorithm_, 0);
    }
  }
  Md5(const Md5&) = delete;
  Md5& operator=(const Md5&) = delete;

  /** False where BCrypt would not, which leaves the song without a cover. */
  bool digest(const std::uint8_t* bytes, std::size_t size,
              std::uint8_t (&out)[16]) const {
    return algorithm_ != nullptr &&
           BCRYPT_SUCCESS(BCryptHash(
               algorithm_, nullptr, 0, const_cast<PUCHAR>(bytes),
               static_cast<ULONG>(size), out, static_cast<ULONG>(sizeof(out))));
  }

 private:
  BCRYPT_ALG_HANDLE algorithm_ = nullptr;
};

/**
 * What a session's events and its property reads leave for the loop. Held by
 * the handlers through a shared pointer, so an answer landing after the
 * session stopped being watched writes into memory that still exists.
 */
struct SessionMail {
  /** The player published new media properties: ask for them again. */
  std::atomic<bool> changed{true};
  std::mutex lock;
  /** Which read the properties below answered, by the number it was asked under. */
  std::uint64_t answered = 0;
  Properties properties{nullptr};
};

/** A session being watched, and what the loop knows of it. */
struct Tracked {
  Session session{nullptr};
  std::string app;
  std::shared_ptr<SessionMail> mail;
  winrt::event_token media{};
  winrt::event_token playback{};
  winrt::event_token timeline{};
  /** Reads asked for, and the newest one whose answer has been taken. */
  std::uint64_t asked = 0;
  std::uint64_t seen = 0;
  /** An answer has come back at least once; until then there is no title. */
  bool known = false;
  std::string title;
  std::string artist;
  wss::IRandomAccessStreamReference thumbnail{nullptr};
};

void untrack(Tracked& entry) {
  if (!entry.session) {
    return;
  }
  // Removing a handler cannot fail from here: C++/WinRT's remove is noexcept
  // and a session that has already gone took its handlers with it.
  entry.session.MediaPropertiesChanged(entry.media);
  entry.session.PlaybackInfoChanged(entry.playback);
  entry.session.TimelinePropertiesChanged(entry.timeline);
  entry.session = nullptr;
}

Tracked track(const Session& session) {
  Tracked entry;
  entry.session = session;
  entry.app = winrt::to_string(session.SourceAppUserModelId());
  entry.mail = std::make_shared<SessionMail>();
  try {
    const std::shared_ptr<SessionMail> mail = entry.mail;
    entry.media = session.MediaPropertiesChanged(
        [mail](const Session&, const wmc::MediaPropertiesChangedEventArgs&) {
          mail->changed.store(true);
          wake();
        });
    entry.playback = session.PlaybackInfoChanged(
        [](const Session&, const wmc::PlaybackInfoChangedEventArgs&) {
          wake();
        });
    entry.timeline = session.TimelinePropertiesChanged(
        [](const Session&, const wmc::TimelinePropertiesChangedEventArgs&) {
          wake();
        });
  } catch (...) {
    untrack(entry);
    throw;
  }
  return entry;
}

/** A picture read's progress: the opened stream, then its bytes. */
struct CoverArrival {
  /** Which song it was read for (`Watcher::song_`). */
  std::uint64_t song = 0;
  wss::IRandomAccessStreamWithContentType stream{nullptr};
  wss::IBuffer bytes{nullptr};
};

struct CoverMail {
  std::mutex lock;
  std::vector<CoverArrival> arrivals;
};

void post_cover(const std::shared_ptr<CoverMail>& mail, CoverArrival arrival) {
  {
    const std::lock_guard<std::mutex> guard(mail->lock);
    mail->arrivals.push_back(std::move(arrival));
  }
  wake();
}

/**
 * Ask for a picture's stream. A read that fails records nothing: the next
 * properties event for the song asks again, which is when a player that
 * published its title before its picture has a picture to give.
 */
void open_cover(const wss::IRandomAccessStreamReference& thumbnail,
                std::uint64_t song, const std::shared_ptr<CoverMail>& mail) {
  thumbnail.OpenReadAsync().Completed(
      [mail, song](
          const wf::IAsyncOperation<wss::IRandomAccessStreamWithContentType>&
              operation,
          wf::AsyncStatus status) {
        if (status != wf::AsyncStatus::Completed) {
          return;
        }
        CoverArrival arrival;
        arrival.song = song;
        try {
          arrival.stream = operation.GetResults();
        } catch (const winrt::hresult_error&) {
          return;  // As a failed status: nothing to record.
        }
        post_cover(mail, std::move(arrival));
      });
}

/** Ask for the whole picture, once the stream says how big it is. */
void read_cover(const wss::IRandomAccessStreamWithContentType& stream,
                std::uint64_t song, const std::shared_ptr<CoverMail>& mail) {
  const std::uint64_t size = stream.Size();
  if (size < fluideq_media::kCoverMinBytes ||
      size > fluideq_media::kCoverMaxBytes) {
    return;
  }
  const auto count = static_cast<std::uint32_t>(size);
  const wss::Buffer buffer(count);
  // The stream rides in the handler, so it lives until its bytes are in.
  stream.ReadAsync(buffer, count, wss::InputStreamOptions::None)
      .Completed([mail, song, stream](
                     const wf::IAsyncOperationWithProgress<wss::IBuffer,
                                                           std::uint32_t>&
                         operation,
                     wf::AsyncStatus status) {
        if (status != wf::AsyncStatus::Completed) {
          return;
        }
        CoverArrival arrival;
        arrival.song = song;
        try {
          arrival.bytes = operation.GetResults();
        } catch (const winrt::hresult_error&) {
          return;  // As a failed status: nothing to record.
        }
        post_cover(mail, std::move(arrival));
      });
}

std::optional<Cover> make_cover(const wss::IBuffer& bytes, const Md5& md5) {
  const std::size_t size = bytes.Length();
  const std::uint8_t* data = size > 0 ? bytes.data() : nullptr;
  const char* type = fluideq_media::image_type(data, size);
  std::uint8_t digest[16]{};
  if (type == nullptr || !md5.digest(data, size, digest)) {
    return std::nullopt;
  }
  Cover cover;
  cover.id = fluideq_media::cover_id(digest);
  cover.type = type;
  cover.data = fluideq_media::base64(data, size);
  return cover;
}

/** Everything the loop keeps between looks. */
class Watcher {
 public:
  Watcher(Manager manager, std::wstring self)
      : manager_(std::move(manager)), self_(std::move(self)) {}
  Watcher(const Watcher&) = delete;
  Watcher& operator=(const Watcher&) = delete;
  ~Watcher() {
    for (Tracked& entry : tracked_) {
      untrack(entry);
    }
  }

  /** One look, after anything at all was said. */
  void look() {
    if (sessions_changed.exchange(false)) {
      read_sessions();
    }
    for (Tracked& entry : tracked_) {
      if (entry.mail->changed.exchange(false)) {
        ask_properties(entry);
      }
    }
    take_properties();
    take_covers();
    report();
  }

 private:
  bool is_self(const winrt::hstring& app) const {
    return CompareStringOrdinal(app.c_str(), static_cast<int>(app.size()),
                                self_.c_str(), static_cast<int>(self_.size()),
                                TRUE) == CSTR_EQUAL;
  }

  /**
   * Follow the manager's list: handlers on every session that arrived, off
   * every one that left. The app's own sessions are not watched — nothing
   * they do changes what this helper reports.
   */
  void read_sessions() {
    std::vector<Tracked> next;
    bool whole = true;
    try {
      for (const Session& session : manager_.GetSessions()) {
        try {
          if (is_self(session.SourceAppUserModelId())) {
            continue;
          }
          const auto found = std::find_if(
              tracked_.begin(), tracked_.end(), [&session](const Tracked& entry) {
                return entry.session && entry.session == session;
              });
          if (found != tracked_.end()) {
            next.push_back(std::move(*found));
            found->session = nullptr;
            continue;
          }
          next.push_back(track(session));
        } catch (const winrt::hresult_error&) {
          // A session going away as it is read is left out; the manager's
          // SessionsChanged for its going is on its way.
        }
      }
    } catch (const winrt::hresult_error&) {
      // The list itself could not be read. Everything known is kept and the
      // list is read again on the next wake — not re-signalled from here,
      // because a list that failed every time would spin this loop.
      whole = false;
      sessions_changed.store(true);
    }
    for (Tracked& entry : tracked_) {
      if (!entry.session) {
        continue;
      }
      if (whole) {
        untrack(entry);
      } else {
        next.push_back(std::move(entry));
      }
    }
    tracked_ = std::move(next);
  }

  /**
   * Ask a session for its title, artist and picture. Numbered, because a
   * player publishing twice in a row puts two reads in flight and they can
   * finish in either order: only a newer answer may replace an older one.
   */
  static void ask_properties(Tracked& entry) {
    const std::uint64_t number = ++entry.asked;
    const std::shared_ptr<SessionMail> mail = entry.mail;
    try {
      entry.session.TryGetMediaPropertiesAsync().Completed(
          [mail, number](const wf::IAsyncOperation<Properties>& operation,
                         wf::AsyncStatus status) {
            Properties properties{nullptr};
            if (status == wf::AsyncStatus::Completed) {
              try {
                properties = operation.GetResults();
              } catch (const winrt::hresult_error&) {
                // Recorded as an answer with nothing in it: no title, which
                // the app reads as nothing playing, as the script's did.
                properties = nullptr;
              }
            }
            {
              const std::lock_guard<std::mutex> guard(mail->lock);
              if (number <= mail->answered) {
                return;
              }
              mail->answered = number;
              mail->properties = properties;
            }
            wake();
          });
    } catch (const winrt::hresult_error&) {
      // A session going away as it is asked. Asked again on its next event,
      // and a session that has gone is removed by the manager's.
      entry.mail->changed.store(true);
    }
  }

  void take_properties() {
    for (Tracked& entry : tracked_) {
      Properties properties{nullptr};
      std::uint64_t answered = 0;
      {
        const std::lock_guard<std::mutex> guard(entry.mail->lock);
        answered = entry.mail->answered;
        properties = entry.mail->properties;
      }
      if (answered == entry.seen) {
        continue;
      }
      entry.seen = answered;
      entry.known = true;
      entry.title.clear();
      entry.artist.clear();
      entry.thumbnail = nullptr;
      if (!properties) {
        continue;
      }
      try {
        entry.title = winrt::to_string(properties.Title());
        entry.artist = winrt::to_string(properties.Artist());
        entry.thumbnail = properties.Thumbnail();
      } catch (const winrt::hresult_error&) {
        // A snapshot that cannot be read is one with nothing in it.
        entry.title.clear();
        entry.artist.clear();
        entry.thumbnail = nullptr;
      }
    }
  }

  void take_covers() {
    std::vector<CoverArrival> arrivals;
    {
      const std::lock_guard<std::mutex> guard(covers_->lock);
      arrivals.swap(covers_->arrivals);
    }
    for (const CoverArrival& arrival : arrivals) {
      // Another song's picture, or one arriving after this song's already
      // did: the first good picture of a song is its picture.
      if (arrival.song != song_ || cover_) {
        continue;
      }
      try {
        if (arrival.bytes) {
          cover_ = make_cover(arrival.bytes, md5_);
        } else if (arrival.stream) {
          read_cover(arrival.stream, arrival.song, covers_);
        }
      } catch (const winrt::hresult_error&) {
        // A stream that failed as it was read. The next properties event
        // for the song asks again.
        continue;
      }
    }
  }

  /**
   * Which session the bar shows: anything playing wins; failing that, what
   * Windows calls the current session, as long as it is not the app's own;
   * failing that, the first one. The same rule as `SELF_SKIP` in
   * systemMedia.ts, which the next, previous and seek commands choose their
   * session by — a button must act on the session the card above it names,
   * so change the two together.
   */
  std::optional<std::size_t> choose(const std::vector<bool>& playing) const {
    for (std::size_t at = 0; at < tracked_.size(); ++at) {
      if (playing[at]) {
        return at;
      }
    }
    const Session current = manager_.GetCurrentSession();
    if (current && !is_self(current.SourceAppUserModelId())) {
      for (std::size_t at = 0; at < tracked_.size(); ++at) {
        if (tracked_[at].session == current) {
          return at;
        }
      }
      // The same player, should Windows hand back another object for it.
      const std::string app = winrt::to_string(current.SourceAppUserModelId());
      for (std::size_t at = 0; at < tracked_.size(); ++at) {
        if (tracked_[at].app == app) {
          return at;
        }
      }
    }
    if (!tracked_.empty()) {
      return std::size_t{0};
    }
    return std::nullopt;
  }

  /**
   * The cover follows the song it was read for. A player publishes the title
   * a moment before the picture, so a song with no picture yet is read again
   * on each properties answer until one arrives — the script tried on its
   * next eight rounds, 700 ms apart, a count of time where this counts what
   * the player actually published.
   */
  void follow_cover(const Tracked& chosen, Reading& reading) {
    if (reading.app != song_app_ || reading.title != song_title_ ||
        reading.artist != song_artist_) {
      song_app_ = reading.app;
      song_title_ = reading.title;
      song_artist_ = reading.artist;
      ++song_;
      cover_.reset();
      tried_session_ = nullptr;
      tried_answer_ = 0;
    }
    if (!cover_ && chosen.thumbnail &&
        (tried_answer_ != chosen.seen || !(tried_session_ == chosen.session))) {
      tried_session_ = chosen.session;
      tried_answer_ = chosen.seen;
      try {
        open_cover(chosen.thumbnail, song_, covers_);
      } catch (const winrt::hresult_error&) {
        // The picture could not even be asked for; the next answer tries.
        tried_answer_ = 0;
      }
    }
    if (cover_) {
      reading.cover_id = cover_->id;
    }
  }

  void report() {
    std::optional<Reading> reading;
    try {
      std::vector<PlaybackInfo> infos;
      std::vector<bool> playing;
      infos.reserve(tracked_.size());
      playing.reserve(tracked_.size());
      // Every session's state in one pass, so the choice and the list of who
      // is playing are answers to the same moment.
      for (const Tracked& entry : tracked_) {
        infos.push_back(entry.session.GetPlaybackInfo());
        playing.push_back(infos.back().PlaybackStatus() ==
                          PlaybackStatus::Playing);
      }
      const std::optional<std::size_t> chosen = choose(playing);
      if (chosen) {
        const Tracked& entry = tracked_[*chosen];
        if (!entry.known) {
          // Its properties are on their way, and their answer wakes this
          // loop. A line now would be a song with no title — "nothing
          // playing" for the moment between two players.
          return;
        }
        Reading found;
        found.app = entry.app;
        found.title = entry.title;
        found.artist = entry.artist;
        found.is_playing = playing[*chosen];
        const auto timeline = entry.session.GetTimelineProperties();
        found.position_ms = fluideq_media::ticks_to_ms(timeline.Position().count());
        found.duration_ms = fluideq_media::ticks_to_ms(timeline.EndTime().count());
        const auto controls = infos[*chosen].Controls();
        found.can_next = controls.IsNextEnabled();
        found.can_previous = controls.IsPreviousEnabled();
        found.can_seek = controls.IsPlaybackPositionEnabled();
        for (std::size_t at = 0; at < tracked_.size(); ++at) {
          if (playing[at]) {
            found.playing.push_back(tracked_[at].app);
          }
        }
        follow_cover(entry, found);
        reading = std::move(found);
      }
    } catch (const winrt::hresult_error&) {
      // As the script's catch: a session that could not be read is nothing
      // playing, until the next thing Windows says.
      reading.reset();
    }

    const std::string shape = reading ? fluideq_media::reading_shape(*reading)
                                      : fluideq_media::kNothingLine;
    if (said_anything_ && shape == last_shape_) {
      return;
    }
    said_anything_ = true;
    last_shape_ = shape;
    // The picture goes out once per cover and BEFORE the reading naming it:
    // the window asks main for a cover by the id a reading carries, so main
    // has to be holding it by then.
    if (reading && cover_ && cover_->id != last_cover_id_) {
      last_cover_id_ = cover_->id;
      say(fluideq_media::cover_line(*cover_));
    }
    say(reading ? fluideq_media::reading_line(*reading)
                : fluideq_media::kNothingLine);
  }

  Manager manager_;
  std::wstring self_;
  std::vector<Tracked> tracked_;
  Md5 md5_;
  std::shared_ptr<CoverMail> covers_ = std::make_shared<CoverMail>();
  /** The song on the bar, and a number that changes with it. */
  std::string song_app_;
  std::string song_title_;
  std::string song_artist_;
  std::uint64_t song_ = 0;
  std::optional<Cover> cover_;
  /** Which properties answer the last picture read was started from. */
  Session tried_session_{nullptr};
  std::uint64_t tried_answer_ = 0;
  bool said_anything_ = false;
  std::string last_shape_;
  std::string last_cover_id_;
};

struct ManagerMail {
  std::mutex lock;
  bool answered = false;
  Manager manager{nullptr};
};

/**
 * The session manager, or nothing when Windows would not give one (the
 * script exited 1 there too) or the app closed the input first.
 */
Manager request_manager() {
  const auto mail = std::make_shared<ManagerMail>();
  Manager::RequestAsync().Completed(
      [mail](const wf::IAsyncOperation<Manager>& operation,
             wf::AsyncStatus status) {
        Manager manager{nullptr};
        if (status == wf::AsyncStatus::Completed) {
          try {
            manager = operation.GetResults();
          } catch (const winrt::hresult_error&) {
            // Recorded as no manager, which ends the helper.
            manager = nullptr;
          }
        }
        {
          const std::lock_guard<std::mutex> guard(mail->lock);
          mail->answered = true;
          mail->manager = manager;
        }
        wake();
      });
  for (;;) {
    {
      const std::lock_guard<std::mutex> guard(mail->lock);
      if (mail->answered) {
        return mail->manager;
      }
    }
    HANDLE handles[]{input_closed, wake_event};
    if (WaitForMultipleObjects(2, handles, FALSE, INFINITE) !=
        WAIT_OBJECT_0 + 1) {
      return nullptr;
    }
  }
}

int run(const wchar_t* self) {
  winrt::init_apartment(winrt::apartment_type::multi_threaded);
  wake_event = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  input_closed = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (wake_event == nullptr || input_closed == nullptr) {
    return 1;
  }
  const HANDLE reader =
      CreateThread(nullptr, 0, read_input, nullptr, 0, nullptr);
  if (reader == nullptr) {
    return 1;
  }
  CloseHandle(reader);

  const Manager manager = request_manager();
  if (!manager) {
    return WaitForSingleObject(input_closed, 0) == WAIT_OBJECT_0 ? 0 : 1;
  }
  const winrt::event_token sessions_token = manager.SessionsChanged(
      [](const Manager&, const wmc::SessionsChangedEventArgs&) {
        sessions_changed.store(true);
        wake();
      });
  const winrt::event_token current_token = manager.CurrentSessionChanged(
      [](const Manager&, const wmc::CurrentSessionChangedEventArgs&) {
        wake();
      });
  {
    Watcher watcher(manager, self);
    // The first look, with `sessions_changed` still set from the start: the
    // app hears where things stand without waiting for anything to change.
    watcher.look();
    for (;;) {
      HANDLE handles[]{input_closed, wake_event};
      if (WaitForMultipleObjects(2, handles, FALSE, INFINITE) !=
          WAIT_OBJECT_0 + 1) {
        break;
      }
      watcher.look();
    }
  }
  manager.SessionsChanged(sessions_token);
  manager.CurrentSessionChanged(current_token);
  // No uninit_apartment: a completion still in flight on the thread pool
  // would land in a torn-down apartment, and the process ends here anyway.
  return 0;
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  // The app names itself; without that every one of its own sessions would
  // come back as somebody else's.
  if (argc != 2 || argv[1][0] == L'\0') {
    return 2;
  }
  try {
    return run(argv[1]);
  } catch (const winrt::hresult_error&) {
    // Windows refused the media session API itself (the script exited 1).
    return 1;
  } catch (const std::exception&) {
    return 1;
  }
}
