/* FluidEQ — GPL-3.0-or-later */
#include "../../config_internal.h"

#include <charconv>
#include <cmath>

namespace fluideq_engine::detail {

bool parse_double(std::string_view token, double& out) {
  const auto result =
      std::from_chars(token.data(), token.data() + token.size(), out);
  // NaN and infinity would poison the filter history and every later sample.
  return result.ec == std::errc() &&
         result.ptr == token.data() + token.size() && std::isfinite(out);
}

}  // namespace fluideq_engine::detail
