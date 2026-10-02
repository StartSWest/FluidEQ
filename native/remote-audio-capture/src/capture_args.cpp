/* FluidEQ — GPL-3.0-or-later */
#include "capture_args.h"

#include <charconv>
#include <string_view>

namespace {

constexpr std::string_view kPipePrefix = "\\\\.\\pipe\\FluidEQ-LAN-";
constexpr std::size_t kPipeHexDigits = 32;
constexpr std::size_t kTokenHexDigits = 64;

[[nodiscard]] bool hex_digits(std::string_view text, std::size_t count) {
  if (text.size() != count) {
    return false;
  }
  for (const char c : text) {
    const bool digit = c >= '0' && c <= '9';
    const bool lower = c >= 'a' && c <= 'f';
    if (!digit && !lower) {
      return false;
    }
  }
  return true;
}

[[nodiscard]] bool parse_pid(std::string_view text, DWORD* pid) {
  DWORD value = 0;
  const auto parsed = std::from_chars(text.data(), text.data() + text.size(), value);
  if (parsed.ec != std::errc() || parsed.ptr != text.data() + text.size() ||
      value == 0) {
    return false;
  }
  *pid = value;
  return true;
}

}  // namespace

bool parse_capture_args(int argc, const char* const* argv, CaptureArgs* args) {
  if (argc < 3 || std::string_view(argv[1]) != "--parent-pid" ||
      !parse_pid(argv[2], &args->parent_pid)) {
    return false;
  }
  if (argc == 4) {
    return std::string_view(argv[3]) == "--pipe-overlapped";
  }
  if (argc != 7 && argc != 9) {
    return false;
  }
  if (std::string_view(argv[3]) != "--pipe" ||
      std::string_view(argv[5]) != "--token") {
    return false;
  }
  const std::string_view pipe(argv[4]);
  if (!pipe.starts_with(kPipePrefix) ||
      !hex_digits(pipe.substr(kPipePrefix.size()), kPipeHexDigits)) {
    return false;
  }
  if (!hex_digits(argv[6], kTokenHexDigits)) {
    return false;
  }
  if (argc == 9 && (std::string_view(argv[7]) != "--exclude-tree-pid" ||
                    !parse_pid(argv[8], &args->exclude_tree_pid))) {
    return false;
  }
  // The name is ASCII by the checks above, so widening is exact.
  args->pipe_name.assign(pipe.begin(), pipe.end());
  args->token = argv[6];
  return true;
}
