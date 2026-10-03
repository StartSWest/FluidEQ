/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq_engine/config.h"

namespace fluideq_engine {

std::optional<std::wstring> endpoint_config_name(
    std::wstring_view stem, const Endpoint& endpoint) {
  std::wstring_view guid = endpoint.guid;
  if (guid.size() == 38 && guid.front() == L'{' && guid.back() == L'}') {
    guid.remove_prefix(1);
    guid.remove_suffix(1);
  }
  if (guid.size() != 36) return std::nullopt;

  std::wstring canonical;
  canonical.reserve(36);
  for (size_t at = 0; at < guid.size(); ++at) {
    wchar_t c = guid[at];
    if (at == 8 || at == 13 || at == 18 || at == 23) {
      if (c != L'-') return std::nullopt;
    } else {
      if (c >= L'A' && c <= L'F') c = static_cast<wchar_t>(c - L'A' + L'a');
      if (!((c >= L'0' && c <= L'9') || (c >= L'a' && c <= L'f'))) {
        return std::nullopt;
      }
    }
    canonical.push_back(c);
  }
  // The GUID is the only endpoint-provided part of a path. In particular,
  // an opaque Windows device id or malformed id cannot name another file.
  return std::wstring(stem) + L"-" + canonical + L".txt";
}

}  // namespace fluideq_engine
