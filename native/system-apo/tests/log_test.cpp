/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "../src/log.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <string>

namespace {
int failures = 0;

void check(bool condition, const char* expression, int line) {
  if (!condition) {
    std::printf("FAIL log_test.cpp:%d: %s\n", line, expression);
    ++failures;
  }
}

#define CHECK(...) check((__VA_ARGS__), #__VA_ARGS__, __LINE__)
}  // namespace

int main() {
  using fluideq_engine::decibels;
  CHECK(decibels(0.0) == "0.0");
  CHECK(decibels(-6.24) == "-6.2");
  CHECK(decibels(12.34) == "12.3");
  CHECK(decibels(std::numeric_limits<double>::min()) == "0.0");

  // These finite values can arrive in Preamp config text. No required-size
  // result from snprintf may turn into a read beyond its 32-byte destination.
  const double extremes[] = {
      1e29, -1e29, 1e30, -1e30, 1e308, -1e308,
      std::numeric_limits<double>::max(),
      -std::numeric_limits<double>::max()};
  for (double value : extremes) {
    const std::string text = decibels(value);
    CHECK(!text.empty() && text.size() < 32);
    CHECK(text.find('\0') == std::string::npos);
    char* end = nullptr;
    const double parsed = std::strtod(text.c_str(), &end);
    CHECK(end == text.c_str() + text.size());
    CHECK(std::isfinite(parsed));
    CHECK(std::abs(parsed / value - 1.0) < 1e-5);
  }

  std::printf("engine-log: %d failures\n", failures);
  return failures == 0 ? 0 : 1;
}
