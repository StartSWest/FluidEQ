/* FluidEQ — GPL-3.0-or-later */
// The one command that starts a program: the app names a pipe, a token and
// which capture, and nothing else gets through — never a path, never an
// extra argument, never a third kind of capture.
#include "capture_children.h"

#include <cstdio>
#include <string>

namespace {
int failures = 0;
void check(bool condition, const char* what) {
  if (!condition) {
    std::printf("FAILED: %s\n", what);
    ++failures;
  }
}
const std::string kPipe = "\\\\.\\pipe\\FluidEQ-LAN-0123456789abcdef0123456789abcdef";
const std::string kToken =
    "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
}  // namespace

int main() {
  check(capture_request_valid(kPipe + " " + kToken + " local"), "the second output's capture");
  check(capture_request_valid(kPipe + " " + kToken + " lan"), "the network's capture");
  check(capture_request_valid(kPipe + " " + kToken + " hold"),
        "the FluidEQ Engine's hold on a second output");
  check(!capture_request_valid(kPipe + " " + kToken + " hold --hold-only"),
        "the hold's flag smuggled after it");
  check(!capture_request_valid(kPipe + " " + kToken + " both"), "an unknown capture");
  check(!capture_request_valid(kPipe + " " + kToken), "no capture named");
  check(!capture_request_valid(kPipe + " " + kToken + " lan --exclude-tree-pid 4"),
        "an argument smuggled after the mode");
  check(!capture_request_valid(kPipe + "  " + kToken + " lan"), "a doubled space");
  check(!capture_request_valid("C:\\Windows\\notepad.exe " + kToken + " lan"), "a program for a pipe");
  check(!capture_request_valid("\\\\.\\pipe\\other-0123456789abcdef0123456789abcdef " + kToken + " lan"),
        "somebody else's pipe");
  check(!capture_request_valid(kPipe + " " + kToken.substr(2) + " lan"), "a short token");
  check(!capture_request_valid(kPipe + " " + kToken + "\"&calc lan"), "a token with quotes");
  check(!capture_request_valid(""), "nothing");
  if (failures == 0) std::printf("capture request: all checks passed\n");
  return failures == 0 ? 0 : 1;
}
