/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the engine shows the app while it plays: the DSP page's meters, the
 * automatic preamp the EQ's "Auto normalize" settled on, and what this
 * process costs.
 *
 * The Windows effect's analysis link (`analysis_link.h`), over a Unix socket
 * the app serves instead of a named pipe, with the same handshake, the same
 * one-byte requests and the same frames — so the app's reader
 * (`engineAnalysisPipe.ts`) takes a Mac engine exactly as it takes the
 * effect. The frame itself is built by the effect's own
 * `analysis_snapshot.cpp`, compiled here unchanged (see this program's
 * CMakeLists.txt), which is why this class carries its name and the two
 * members that file reads: a meter main adds to the frame reaches a Mac
 * without anybody touching this side.
 *
 * Nothing here waits on a clock. The worker sleeps until asked to connect —
 * at every reload, as the effect does — and then on the socket, answering
 * the app's requests one at a time, until the app goes or the output
 * changes.
 */
#ifndef FLUIDEQ_MAC_ENGINE_MAC_ANALYSIS_LINK_H
#define FLUIDEQ_MAC_ENGINE_MAC_ANALYSIS_LINK_H

#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "fluideq/meters.h"

namespace fluideq_engine {

class AnalysisLink {
 public:
  /** `socket_path` is where the app listens; the worker starts idle. */
  explicit AnalysisLink(std::string socket_path);
  ~AnalysisLink();
  AnalysisLink(const AnalysisLink&) = delete;
  AnalysisLink& operator=(const AnalysisLink&) = delete;

  /** Written by the audio thread through the graph; outlive every graph. */
  FeqMeters* meters() const noexcept { return meters_; }
  std::atomic<bool>* activity() noexcept { return &active_; }
  std::atomic<float> output_gain{0};
  std::atomic<bool> output_enabled{false};
  std::atomic<bool> output_active{false};

  /**
   * Control thread, while the audio thread is stopped: which output the
   * frames are about and at what rate. A change ends the connection, so the
   * next one says hello with the new pair.
   */
  void follow(const std::string& endpoint, uint32_t rate);

  /** Control thread: connect, if not connected — the effect's `retry`. */
  void retry() noexcept;

  /** Control thread, as the audio thread stops: no frame claims sound. */
  void quiet() noexcept;

 private:
  void run();
  void serve(int socket, const std::string& endpoint, uint32_t rate);
  /** Defined in the Windows effect's `analysis_snapshot.cpp`, shared. */
  std::vector<unsigned char> snapshot();

  FeqMeters* meters_ = nullptr;
  std::atomic<bool> active_{false};
  uint32_t sequence_ = 0;

  std::string path_;
  std::mutex mutex_;
  std::condition_variable wake_;
  std::string endpoint_;
  uint32_t rate_ = 0;
  bool wanted_ = false;
  bool stopping_ = false;
  /** The connection being served, so `follow` and the destructor can end it. */
  int socket_ = -1;
  std::thread worker_;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_MAC_ENGINE_MAC_ANALYSIS_LINK_H
