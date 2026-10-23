/* FluidEQ — GPL-3.0-or-later */
// The capture helper's command line. The playback helper builds it from what
// the app sends over a pipe, so every shape it does not expect is a refusal.
#include "capture_args.h"

#include <cstdio>
#include <string>
#include <vector>

namespace {

int failures = 0;

void check(bool condition, const char* what) {
  if (!condition) {
    std::printf("FAILED: %s\n", what);
    ++failures;
  }
}

bool parse(std::vector<std::string> words, CaptureArgs* args) {
  std::vector<const char*> argv;
  argv.reserve(words.size());
  for (const auto& word : words) {
    argv.push_back(word.c_str());
  }
  return parse_capture_args(static_cast<int>(argv.size()), argv.data(), args);
}

const std::string kPipe = "\\\\.\\pipe\\FluidEQ-LAN-0123456789abcdef0123456789abcdef";
const std::string kToken =
    "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

}  // namespace

int main() {
  {
    CaptureArgs args;
    check(parse({"x", "--parent-pid", "42", "--pipe-overlapped"}, &args),
          "the app's own stdio launch");
    check(args.parent_pid == 42 && args.pipe_name.empty() &&
              args.exclude_tree_pid == 0,
          "stdio launch carries no pipe and leaves out only itself");
  }
  {
    CaptureArgs args;
    check(parse({"x", "--parent-pid", "42", "--pipe", kPipe, "--token", kToken},
                &args),
          "a piped launch for the second output");
    check(args.pipe_name == std::wstring(kPipe.begin(), kPipe.end()) &&
              args.token == kToken && args.exclude_tree_pid == 0,
          "the piped launch keeps its pipe and token");
  }
  {
    CaptureArgs args;
    check(parse({"x", "--parent-pid", "42", "--pipe", kPipe, "--token", kToken,
                 "--exclude-tree-pid", "77"},
                &args),
          "a piped launch for the network");
    check(args.exclude_tree_pid == 77 && !args.hold_only,
          "the network's capture leaves out the playback helper's tree");
  }
  {
    CaptureArgs args;
    check(parse({"x", "--parent-pid", "42", "--pipe", kPipe, "--token", kToken,
                 "--hold-only"},
                &args),
          "a piped launch that only holds second outputs");
    check(args.hold_only && args.exclude_tree_pid == 0,
          "the hold captures nothing and leaves nothing out");
  }
  CaptureArgs refused;
  check(!parse({"x", "--parent-pid", "42", "--pipe", kPipe, "--token", kToken,
                "--hold"},
               &refused),
        "a hold flag misspelled");
  check(!parse({"x", "--parent-pid", "42", "--pipe-overlapped", "--hold-only"},
               &refused),
        "a hold on the stdio launch");
  check(!parse({"x"}, &refused), "nothing");
  check(!parse({"x", "--parent-pid", "0", "--pipe-overlapped"}, &refused),
        "a zero parent");
  check(!parse({"x", "--parent-pid", "4x2", "--pipe-overlapped"}, &refused),
        "a parent that is not a number");
  check(!parse({"x", "--parent-pid", "42", "--pipe", "\\\\.\\pipe\\other", "--token", kToken},
               &refused),
        "a pipe of somebody else's");
  check(!parse({"x", "--parent-pid", "42", "--pipe",
                "\\\\.\\pipe\\FluidEQ-LAN-0123456789ABCDEF0123456789ABCDEF",
                "--token", kToken},
               &refused),
        "a pipe name in capitals");
  check(!parse({"x", "--parent-pid", "42", "--pipe", kPipe + "0", "--token", kToken},
               &refused),
        "a pipe name one digit too long");
  check(!parse({"x", "--parent-pid", "42", "--pipe", kPipe, "--token", "abc"},
               &refused),
        "a short token");
  check(!parse({"x", "--parent-pid", "42", "--pipe", kPipe, "--token",
                kToken.substr(1) + "g"},
               &refused),
        "a token that is not hex");
  check(!parse({"x", "--parent-pid", "42", "--pipe", kPipe, "--token", kToken,
                "--exclude-tree-pid", "0"},
               &refused),
        "a zero tree");
  check(!parse({"x", "--parent-pid", "42", "--pipe", kPipe, "--token", kToken,
                "--exclude", "77"},
               &refused),
        "an unknown flag");
  check(!parse({"x", "--parent-pid", "42", "--pipe", kPipe, "--token", kToken,
                "--exclude-tree-pid"},
               &refused),
        "a flag without its value");
  if (failures == 0) {
    std::printf("capture args: all checks passed\n");
  }
  return failures == 0 ? 0 : 1;
}
