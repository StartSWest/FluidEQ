/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// FluidEQ-Share: Share Audio's link, out of Node. Main starts it, speaks to
// it on its standard input and output (`main_wire.h`), and reads its log
// lines on its standard error. Everything it decides runs on one thread, an
// I/O completion port (`loop.h`), which joins Windows' "Audio" scheduling as
// the Node service's thread did: a 60 ms stall there once exceeded the
// receiver's 30 ms reservoir. Two more threads only move bytes: one reads
// main's frames, one writes the service's, so a slow reader of either never
// holds up the link. Standard input ending is main ending: the service ends
// with it, and the LAN audio helper, watching this process, ends after it.

#include <winsock2.h>
#include <avrt.h>

#include <condition_variable>
#include <cstdio>
#include <deque>
#include <mutex>
#include <string>
#include <thread>

#include "audio_helper.h"
#include "io.h"
#include "main_wire.h"
#include "share_runtime.h"
#include "tcp.h"

namespace {

namespace service = feq::share::service;

/** The service's frames to main, written on a thread of its own. */
class Mouth {
 public:
  explicit Mouth(service::Loop& loop) : loop_(loop), thread_([this] { run(); }) {}
  ~Mouth() {
    {
      const std::lock_guard<std::mutex> lock(mutex_);
      closing_ = true;
    }
    ready_.notify_one();
    thread_.join();
  }
  Mouth(const Mouth&) = delete;
  Mouth& operator=(const Mouth&) = delete;

  void say(service::Bytes frame) {
    {
      const std::lock_guard<std::mutex> lock(mutex_);
      queue_.push_back(std::move(frame));
    }
    ready_.notify_one();
  }

 private:
  void run() {
    const HANDLE out = GetStdHandle(STD_OUTPUT_HANDLE);
    for (;;) {
      service::Bytes next;
      {
        std::unique_lock<std::mutex> lock(mutex_);
        ready_.wait(lock, [this] { return closing_ || !queue_.empty(); });
        if (queue_.empty()) {
          return;
        }
        next = std::move(queue_.front());
        queue_.pop_front();
      }
      std::size_t sent = 0;
      while (sent < next.size()) {
        DWORD written = 0;
        if (WriteFile(out, next.data() + sent,
                      static_cast<DWORD>(next.size() - sent), &written,
                      nullptr) == FALSE) {
          // Main is gone; so is the reason to run.
          loop_.post([this] { loop_.stop(0); });
          return;
        }
        sent += written;
      }
    }
  }

  service::Loop& loop_;
  std::mutex mutex_;
  std::condition_variable ready_;
  std::deque<service::Bytes> queue_;
  bool closing_ = false;
  std::thread thread_;
};

/** Main's frames, read on a thread of their own and handed to the loop. */
void read_main(service::Loop& loop, service::FrameAssembler& assembler,
               service::ShareRuntime& runtime) {
  const HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  std::vector<std::uint8_t> chunk(64 * 1024);
  for (;;) {
    DWORD read = 0;
    if (ReadFile(input, chunk.data(), static_cast<DWORD>(chunk.size()), &read,
                 nullptr) == FALSE ||
        read == 0) {
      loop.post([&loop] { loop.stop(0); });
      return;
    }
    service::Bytes bytes(chunk.begin(), chunk.begin() + read);
    loop.post([&loop, &assembler, &runtime, bytes = std::move(bytes)] {
      const bool readable =
          assembler.push(bytes, [&runtime](service::WireMessage message) {
            runtime.handle(message);
          });
      if (!readable) {
        std::fprintf(stderr, "Share Audio service: main sent a frame it could not read\n");
        loop.stop(1);
      }
    });
  }
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  for (int at = 1; at + 1 < argc; at += 1) {
    if (std::wstring(argv[at]) == L"--helper") {
      service::set_audio_helper_path(argv[at + 1]);
    }
  }
  WSADATA winsock;
  if (WSAStartup(MAKEWORD(2, 2), &winsock) != 0 ||
      !service::load_socket_extensions()) {
    std::fprintf(stderr, "Share Audio service: Winsock did not start\n");
    return 1;
  }
  service::Loop loop;
  service::set_loop(&loop);
  // Only this thread joins MMCSS Audio: no process priority, no registry,
  // nothing else of the machine changed. Unavailable on a locked-down
  // machine, where the link runs at normal priority as before.
  DWORD task_index = 0;
  const HANDLE task = AvSetMmThreadCharacteristicsW(L"Audio", &task_index);
  int code = 0;
  {
    Mouth mouth(loop);
    service::FrameAssembler assembler;
    service::ShareRuntime runtime(service::ShareRuntime::Deps{
        [&mouth](service::WireMessage message) {
          mouth.say(service::encode_frame(message));
        },
        [&loop] { loop.stop(1); },
        task != nullptr,
        service::system_ports()});
    std::thread(read_main, std::ref(loop), std::ref(assembler),
                std::ref(runtime))
        .detach();
    code = loop.run();
  }
  if (task != nullptr) {
    AvRevertMmThreadCharacteristics(task);
  }
  // The reader may still be blocked on standard input; ending the process
  // ends it, and nothing it holds outlives the process.
  std::fflush(stderr);
  ExitProcess(static_cast<UINT>(code));
}
