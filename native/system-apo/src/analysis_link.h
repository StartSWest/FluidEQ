/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#ifndef FLUIDEQ_ENGINE_ANALYSIS_LINK_H
#define FLUIDEQ_ENGINE_ANALYSIS_LINK_H

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <atomic>
#include <cstdint>
#include <string>
#include <vector>
#include "fluideq/meters.h"

namespace fluideq_engine {

// One producer (the endpoint's audio thread), one reader (this pipe worker).
// The meters outlive every graph, including graphs retired during a reload.
class AnalysisLink {
 public:
  AnalysisLink(const std::wstring& endpoint, uint32_t rate, uint32_t channels);
  ~AnalysisLink();
  AnalysisLink(const AnalysisLink&) = delete;
  AnalysisLink& operator=(const AnalysisLink&) = delete;
  FeqMeters* meters() const noexcept { return meters_; }
  std::atomic<bool>* activity() noexcept { return &active_; }
  void retry() noexcept;
  std::atomic<float> output_gain{0};
  std::atomic<bool> output_enabled{false};
  std::atomic<bool> output_active{false};

 private:
  static unsigned __stdcall entry(void* self);
  void run();
  bool transfer(HANDLE pipe, void* data, DWORD size, bool writing);
  std::vector<unsigned char> snapshot();
  FeqMeters* meters_ = nullptr;
  std::atomic<bool> active_{false};
  std::string endpoint_;
  uint32_t rate_;
  uint32_t sequence_ = 0;
  HANDLE stop_ = nullptr;
  HANDLE retry_ = nullptr;
  HANDLE ready_ = nullptr;
  HANDLE thread_ = nullptr;
};
}  // namespace fluideq_engine
#endif
