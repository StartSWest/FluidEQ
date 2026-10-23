/* FluidEQ — GPL-3.0-or-later */
#include "fluideq_engine/config.h"

#include <clocale>
#include <cmath>
#include <cstdio>
#include <string>

namespace {
int failures = 0;
void check(bool ok, const char* message) {
  if (!ok) { std::printf("FAIL: %s\n", message); ++failures; }
}
void decimals() {
  const auto values = fluideq_engine::parse_dsp_values("1.41 -.5 1. 1e-3 -2E+2 -0");
  check(values.size() == 6, "all supported decimal spellings are read");
  if (values.size() == 6) {
    check(values[0] == 1.41 && values[1] == -0.5 && values[2] == 1 &&
          values[3] == 0.001 && values[4] == -200 && std::signbit(values[5]),
          "decimal values do not depend on the locale");
  }
  const auto tiny = fluideq_engine::parse_dsp_values("1e-310");
  check(tiny.size() == 1 && tiny[0] > 0 && tiny[0] < 1e-308,
        "representable subnormal doubles are retained");
  for (const char* text : {"nan", "inf", "1,41", "1e", "+1", "0x1p2",
                          "1e999", "1e-999", "--1", "1.2.3"}) {
    check(fluideq_engine::parse_dsp_values(text).empty(), text);
  }
}
}  // namespace

int main() {
  const char* current = std::setlocale(LC_NUMERIC, nullptr);
  const std::string saved = current == nullptr ? "C" : current;
  decimals();
  bool comma = false;
  for (const char* name : {"de_DE.UTF-8", "fr_FR.UTF-8", "German_Germany.1252"}) {
    if (std::setlocale(LC_NUMERIC, name) != nullptr) {
      comma = true;
      decimals();
      break;
    }
  }
  std::setlocale(LC_NUMERIC, saved.c_str());
  std::printf("comma-decimal locale %s; %d failures\n",
              comma ? "checked" : "not installed (C locale checked)", failures);
  return failures == 0 ? 0 : 1;
}
