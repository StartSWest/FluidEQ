/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "display_beat.h"

#include <dwmapi.h>
#include <dxgi.h>

namespace feq::scene {

DisplayBeat::~DisplayBeat() { release(); }

void DisplayBeat::release() {
  if (output_ != nullptr) {
    output_->Release();
    output_ = nullptr;
  }
}

void DisplayBeat::follow(HWND window) {
  release();
  const HMONITOR monitor = MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST);
  IDXGIFactory1* factory = nullptr;
  if (FAILED(CreateDXGIFactory1(__uuidof(IDXGIFactory1),
                                reinterpret_cast<void**>(&factory)))) {
    return;
  }
  IDXGIAdapter1* adapter = nullptr;
  for (UINT a = 0; output_ == nullptr &&
                   factory->EnumAdapters1(a, &adapter) != DXGI_ERROR_NOT_FOUND;
       ++a) {
    IDXGIOutput* output = nullptr;
    for (UINT o = 0; output_ == nullptr &&
                     adapter->EnumOutputs(o, &output) != DXGI_ERROR_NOT_FOUND;
         ++o) {
      DXGI_OUTPUT_DESC desc{};
      if (SUCCEEDED(output->GetDesc(&desc)) && desc.Monitor == monitor) {
        output_ = output;
      } else {
        output->Release();
      }
    }
    adapter->Release();
  }
  factory->Release();
}

bool DisplayBeat::wait() {
  if (output_ != nullptr && SUCCEEDED(output_->WaitForVBlank())) {
    return true;
  }
  // No output of its own found: the desktop's composition, which runs on
  // the displays' beat, is the next best thing to wait for.
  return SUCCEEDED(DwmFlush());
}

}  // namespace feq::scene
