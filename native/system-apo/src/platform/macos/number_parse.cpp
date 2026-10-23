/* FluidEQ — GPL-3.0-or-later */
#include "../../config_internal.h"

#include <xlocale.h>

#include <cerrno>
#include <cmath>
#include <cstdlib>
#include <string>

namespace fluideq_engine::detail {
namespace {

struct DecimalLocale {
  locale_t value = ::newlocale(LC_NUMERIC_MASK, "C", nullptr);
  ~DecimalLocale() {
    if (value != nullptr) ::freelocale(value);
  }
};

bool digit(char value) { return value >= '0' && value <= '9'; }

// strtod_l also accepts a leading +, whitespace and hexadecimal floats.
// None is from_chars' general decimal grammar, which the engine already used.
bool decimal_token(std::string_view token) {
  size_t at = 0;
  if (at < token.size() && token[at] == '-') ++at;
  size_t digits = 0;
  while (at < token.size() && digit(token[at])) { ++at; ++digits; }
  if (at < token.size() && token[at] == '.') {
    ++at;
    while (at < token.size() && digit(token[at])) { ++at; ++digits; }
  }
  if (digits == 0) return false;
  if (at < token.size() && (token[at] == 'e' || token[at] == 'E')) {
    ++at;
    if (at < token.size() && (token[at] == '+' || token[at] == '-')) ++at;
    const size_t start = at;
    while (at < token.size() && digit(token[at])) ++at;
    if (at == start) return false;
  }
  return at == token.size();
}

}  // namespace

bool parse_double(std::string_view token, double& out) {
  // Floating from_chars was introduced in macOS 26's libc++. An explicit
  // locale keeps older supported Macs independent of the listener's locale,
  // without changing the locale of the audio thread or of the whole process.
  if (!decimal_token(token)) return false;
  static const DecimalLocale locale;
  if (locale.value == nullptr) return false;
  const std::string terminated(token);
  char* end = nullptr;
  errno = 0;
  const double parsed = ::strtod_l(terminated.c_str(), &end, locale.value);
  // strtod_l sets ERANGE for representable subnormals too; from_chars accepts
  // them. Only an underflow rounded all the way to zero is out of range.
  if ((errno == ERANGE && parsed == 0.0) ||
      end != terminated.c_str() + terminated.size() ||
      !std::isfinite(parsed)) return false;
  out = parsed;
  return true;
}

}  // namespace fluideq_engine::detail
