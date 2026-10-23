/* FluidEQ — GPL-3.0-or-later */
#pragma once

#include <Windows.h>

#include <string>

/**
 * How the capture helper was started, read from its command line.
 *
 * Two ways in. The app starts it directly with its stdio as the wire
 * (`--pipe-overlapped`), or the playback helper starts it as its own child
 * (`--pipe`), and then the wire is a named pipe the app serves, because the
 * playback helper has no stdio of the app's to hand down. The second way
 * exists for one reason: Share Audio both ways. A capture that goes to the
 * network must not hear the sound received from that network, or it travels
 * back where it came from. Windows can leave one process tree out of a
 * process loopback, so the capture for the network leaves out the playback
 * helper's (`--exclude-tree-pid`), which holds the received sound and, as
 * its children, this helper's mirrors of the second output.
 */
struct CaptureArgs {
  DWORD parent_pid = 0;
  /** Empty: stdio is the wire. */
  std::wstring pipe_name;
  /** 64 hex digits, sent first on each connection; the app drops any
   * connection that does not open with it. */
  std::string token;
  /** The process whose tree this capture leaves out; 0 means its own. */
  DWORD exclude_tree_pid = 0;
  /**
   * Capture nothing: only hold second outputs in silence for the FluidEQ
   * Engine to play into (`--hold-only`, `hold_output.h`). A process loopback
   * nobody listens to would cost its pipe and its device all the same.
   */
  bool hold_only = false;
};

/** Every malformed or unknown argument is a refusal, never a default. */
[[nodiscard]] bool parse_capture_args(int argc, const char* const* argv,
                                      CaptureArgs* args);
