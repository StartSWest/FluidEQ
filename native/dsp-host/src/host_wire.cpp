/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The control pipe in and the frames out: stdin read exactly, every length
 * that arrives on it judged before anything is sized from it, and stdout
 * written one whole frame at a time.
 */
#include "host.h"

#include <cmath>
#include <cstdio>
#include <mutex>

namespace feq_host {

namespace {

/** Held for one whole frame: the control and telemetry threads both write. */
std::mutex g_stdout_mutex;

}  // namespace

bool read_exact(void* into, size_t bytes) {
  auto* cursor = static_cast<unsigned char*>(into);
  size_t remaining = bytes;
  while (remaining > 0) {
    // `fread` may return short on a pipe with nothing wrong — the writer has
    // simply not finished. Treating that as end-of-stream is how a transport
    // develops a rare, unreproducible desync under load.
    const size_t got = std::fread(cursor, 1, remaining, stdin);
    if (got == 0) {
      return false;
    }
    cursor += got;
    remaining -= got;
  }
  return true;
}

/**
 * Whether a length that arrived from the pipe is one this build can hold.
 *
 * Every variable-length command states its own count, and that count is read
 * from the wire before anything is allocated for it. Sizing an allocation
 * straight from it is how a desynchronised stream — a host built before a
 * layout change, a frame read at the wrong offset — becomes a 34 GB
 * `std::vector`, and there is no `catch` between that and `std::terminate`
 * anywhere on this path. The engine would disappear mid-playback and the log
 * would say nothing about why.
 *
 * REFUSED RATHER THAN CLAMPED, AND FATAL RATHER THAN SKIPPED. A length outside
 * its range means the reader and the writer disagree about where this frame
 * ends. `wire.h` already states the rule for that case and it applies whole:
 * there is no safe number of bytes to skip, so the stream is not recoverable
 * and the loop stops rather than guessing at the next frame boundary.
 *
 * The ceilings are the encoder's own maxima, so a legitimate frame is never
 * refused — see `kMaxPathBytes` and `kMaxChainParams`.
 */
bool payload_within(uint32_t count, uint32_t ceiling, const char* what) {
  if (count <= ceiling) {
    return true;
  }
  std::fprintf(stderr,
               "FluidEQ-DSP: %s declares %u, ceiling is %u; the control "
               "stream has desynchronised\n",
               what, count, ceiling);
  return false;
}

/**
 * A `double` from the wire read back as a byte length.
 *
 * `RENDER_TO_FILE` carries its path length in `value`, which is a `double`
 * because the frame has no second integer field free. A negative or NaN double
 * cast to `size_t` is undefined behaviour BEFORE any allocation is attempted —
 * on x86-64 it lands on 0x8000000000000000, which `std::string` answers with a
 * `length_error` and this process answers with `std::terminate`. So the value
 * is judged as a double, while it still is one.
 */
bool wire_length_from_double(double value, uint32_t ceiling, uint32_t* out) {
  if (!std::isfinite(value) || value < 0.0 ||
      value > static_cast<double>(ceiling)) {
    std::fprintf(stderr,
                 "FluidEQ-DSP: path length %f is not a length; the control "
                 "stream has desynchronised\n",
                 value);
    return false;
  }
  *out = static_cast<uint32_t>(value);
  return true;
}

bool write_frame(const void* from, size_t bytes) {
  const std::lock_guard<std::mutex> held(g_stdout_mutex);
  const auto* cursor = static_cast<const unsigned char*>(from);
  size_t remaining = bytes;
  while (remaining > 0) {
    const size_t put = std::fwrite(cursor, 1, remaining, stdout);
    if (put == 0) {
      return false;
    }
    cursor += put;
    remaining -= put;
  }
  return std::fflush(stdout) == 0;
}

void send_handshake(const char* backend_name) {
  FeqWireHandshake handshake{};
  handshake.magic = FEQ_MAGIC_HANDSHAKE;
  handshake.protocol_version = FEQ_WIRE_PROTOCOL_VERSION;
  handshake.parameter_schema_version = FEQ_PARAMETER_SCHEMA_VERSION;
  handshake.abi_version = feq_core_abi_version();
  handshake.parameter_count = static_cast<uint32_t>(FEQ_PARAMETER_COUNT);
  handshake.analysis_frame_bytes =
      static_cast<uint32_t>(sizeof(FeqWireAnalysisFrame));
  std::snprintf(handshake.core_version, sizeof(handshake.core_version), "%s",
                feq_core_version());
#if defined(_M_X64) || defined(__x86_64__)
  std::snprintf(handshake.architecture, sizeof(handshake.architecture), "x64");
#elif defined(_M_ARM64) || defined(__aarch64__)
  std::snprintf(handshake.architecture, sizeof(handshake.architecture), "arm64");
#else
  std::snprintf(handshake.architecture, sizeof(handshake.architecture),
                "unknown");
#endif
  std::snprintf(handshake.build_revision, sizeof(handshake.build_revision), "%s",
                FEQ_BUILD_REVISION);
  std::snprintf(handshake.backend, sizeof(handshake.backend), "%s",
                backend_name);
  write_frame(&handshake, sizeof(handshake));
}

/** Takes the enum; the narrowing to the wire's width happens once, here. */
void send_ack(uint32_t request_id,
              FeqWireStatus status,
              uint32_t revision,
              uint64_t applied_at,
              double sanitized) {
  FeqWireAckFrame ack{};
  ack.magic = FEQ_MAGIC_ACK;
  ack.protocol_version = FEQ_WIRE_PROTOCOL_VERSION;
  ack.status = static_cast<uint16_t>(status);
  ack.request_id = request_id;
  ack.accepted_revision = revision;
  ack.applied_at_sample_frame = applied_at;
  ack.sanitized_value = sanitized;
  write_frame(&ack, sizeof(ack));
}

}  // namespace feq_host
