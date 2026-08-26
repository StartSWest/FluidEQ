/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The backend for a platform that has not got one yet.
 *
 * It exists so that macOS and Linux still configure, compile and run the host
 * and its tests while only Windows can open a device. A missing backend that
 * fails at link time would mean the whole tree stops building on two of the
 * three platforms FluidEQ ships on, and a tree that does not build is a tree
 * nobody notices breaking further.
 *
 * It refuses through the same channel a real device failure uses, so the
 * supervisor above has one path rather than a special case.
 */

#include "../audio_backend.h"

namespace {

class UnsupportedBackend final : public IAudioOutputBackend {
 public:
  bool open(FeqBackendFormat& negotiated, std::string& error) override {
    (void)negotiated;
    error = "no audio backend is implemented for this platform yet";
    return false;
  }

  bool start(std::string& error) override {
    error = "no audio backend is implemented for this platform yet";
    return false;
  }

  void close() override {}

  bool is_open() const override { return false; }

  bool is_running() const override { return false; }

  FeqBackendStats stats() const override { return {}; }

  const char* name() const override { return "unsupported"; }
};

}  // namespace

std::unique_ptr<IAudioOutputBackend> create_audio_backend(FeqRenderFn render,
                                                          void* context) {
  (void)render;
  (void)context;
  return std::make_unique<UnsupportedBackend>();
}
