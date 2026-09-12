/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `device_matches` and `resolve_chain`. The lexer and the two band grammars
 * (`tokenize`, `parse_filter`, `parse_graphic`) are in config_grammar.cpp,
 * split out so this file stays under the project's 500-line limit.
 */

#include "fluideq_engine/config.h"

#include <set>

#include "config_internal.h"

namespace fluideq_engine {

namespace {

// ---------------------------------------------------------------------------
// Wide-string ASCII folding, for comparing a friendly name (UTF-16, from
// Windows) against a Device: pattern (UTF-8, from the config file).

wchar_t ascii_lower(wchar_t c) {
  return (c >= L'A' && c <= L'Z') ? static_cast<wchar_t>(c - L'A' + L'a') : c;
}

bool wide_iequals(const std::wstring& a, const std::wstring& b) {
  if (a.size() != b.size()) {
    return false;
  }
  for (size_t i = 0; i < a.size(); ++i) {
    if (ascii_lower(a[i]) != ascii_lower(b[i])) {
      return false;
    }
  }
  return true;
}

bool wide_contains_ci(const std::wstring& haystack, const std::wstring& needle) {
  if (needle.empty() || needle.size() > haystack.size()) {
    return needle.empty();
  }
  for (size_t at = 0; at + needle.size() <= haystack.size(); ++at) {
    bool match = true;
    for (size_t i = 0; i < needle.size() && match; ++i) {
      match = ascii_lower(haystack[at + i]) == ascii_lower(needle[i]);
    }
    if (match) {
      return true;
    }
  }
  return false;
}

// UTF-8 -> UTF-16 conversion, hand-rolled because this library must build
// with no Windows headers: `MultiByteToWideChar` is off the table, and this
// is Windows-only code so `wchar_t` being a 16-bit UTF-16 unit is a safe
// assumption rather than a portability gap.
std::wstring utf8_to_wide(std::string_view utf8) {
  std::wstring out;
  size_t i = 0;
  while (i < utf8.size()) {
    const unsigned char lead = static_cast<unsigned char>(utf8[i]);
    char32_t code_point = 0;
    size_t extra = 0;
    if ((lead & 0x80) == 0x00) {
      code_point = lead;
    } else if ((lead & 0xE0) == 0xC0) {
      code_point = lead & 0x1F;
      extra = 1;
    } else if ((lead & 0xF0) == 0xE0) {
      code_point = lead & 0x0F;
      extra = 2;
    } else if ((lead & 0xF8) == 0xF0) {
      code_point = lead & 0x07;
      extra = 3;
    } else {
      ++i;  // Not a valid lead byte; drop it and resynchronise.
      continue;
    }
    if (i + extra >= utf8.size()) {
      break;  // Truncated sequence at end of input.
    }
    bool valid = true;
    for (size_t k = 1; k <= extra; ++k) {
      const unsigned char cont = static_cast<unsigned char>(utf8[i + k]);
      if ((cont & 0xC0) != 0x80) {
        valid = false;
        break;
      }
      code_point = (code_point << 6) | (cont & 0x3F);
    }
    if (!valid) {
      ++i;
      continue;
    }
    i += extra + 1;
    if (code_point <= 0xFFFF) {
      out.push_back(static_cast<wchar_t>(code_point));
    } else {
      code_point -= 0x10000;
      out.push_back(static_cast<wchar_t>(0xD800 + (code_point >> 10)));
      out.push_back(static_cast<wchar_t>(0xDC00 + (code_point & 0x3FF)));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Include/Convolution path safety.
//
// There is no `PathCchCanonicalizeEx` here by construction (no Windows
// headers), so escaping the config directory is refused by string rule
// instead: no ".." segment, no drive letter, no UNC or rooted prefix. Those
// two checks are the entire escape protection — no canonicalisation of the
// joined path is done, so a body that defeats both (there is none known
// today, since `has_dotdot_segment` already splits on both `\` and `/`) would
// not be caught by anything downstream.

bool has_dotdot_segment(const std::wstring& path) {
  size_t i = 0;
  while (i <= path.size()) {
    const size_t next = path.find_first_of(L"\\/", i);
    const bool last = next == std::wstring::npos;
    const size_t end = last ? path.size() : next;
    if (path.compare(i, end - i, L"..") == 0) {
      return true;
    }
    if (last) {
      break;
    }
    i = next + 1;
  }
  return false;
}

bool has_drive_or_unc_prefix(const std::wstring& path) {
  if (path.size() >= 2 && path[1] == L':') {
    return true;  // "C:\..." or "C:relative", both a drive reference.
  }
  if (!path.empty() && (path[0] == L'\\' || path[0] == L'/')) {
    return true;  // UNC ("\\server\share") or simply rooted ("\dir").
  }
  return false;
}

// Joins `body` under `config_dir`, refusing anything that would land outside
// it. Used for `Include:` always, and for `Convolution:` when its body is
// not already absolute.
std::optional<std::wstring> resolve_relative(const std::wstring& config_dir,
                                             const std::wstring& body) {
  if (body.empty() || has_drive_or_unc_prefix(body) ||
      has_dotdot_segment(body)) {
    return std::nullopt;
  }
  return config_dir + L"\\" + body;
}

// `Preamp:` allows an optional trailing unit the way `PREAMP_LINE` in
// apoText.ts does: "Preamp: -6" and "Preamp: -6 dB" are the same command.
std::optional<double> parse_preamp(std::string_view body) {
  const std::vector<std::string_view> tokens = detail::split_ws(body);
  if (tokens.empty() || tokens.size() > 2) {
    return std::nullopt;
  }
  double value = 0.0;
  if (!detail::parse_double(tokens[0], value)) {
    return std::nullopt;
  }
  if (tokens.size() == 2 && !detail::iequals(tokens[1], "dB")) {
    return std::nullopt;
  }
  return value;
}

void add_ignored(std::vector<std::string>& ignored, std::string_view command) {
  for (const auto& existing : ignored) {
    if (existing == command) {
      return;
    }
  }
  ignored.emplace_back(command);
}

// One file's lines and how far the walk has gotten through them. Kept on an
// explicit stack (in `resolve_chain` below), not the call stack, so the depth
// guard is a size check on `std::vector` rather than a recursion limit that
// only fails once the real stack has already been spent.
struct Frame {
  std::wstring path;
  std::vector<Line> lines;
  size_t index = 0;
  // Whether the endpoint has matched the innermost `Device:` guard covering
  // this frame. A child Include starts with its parent's value, since a
  // `Device:` line only takes effect for the lines that follow it in its own
  // file — exactly Equalizer APO's own scoping.
  bool matching = true;
  bool curve_layer = false;
  bool eq_layer = false;
};

}  // namespace

bool device_matches(std::string_view pattern, const Endpoint& endpoint) {
  if (detail::iequals(pattern, "all")) {
    return true;
  }
  const std::wstring wide_pattern = utf8_to_wide(pattern);
  if (wide_iequals(wide_pattern, endpoint.guid)) {
    return true;
  }
  return wide_contains_ci(endpoint.friendly_name, wide_pattern);
}

Chain resolve_chain(const std::wstring& config_dir, const Endpoint& endpoint,
                    const FileProvider& read) {
  Chain chain;
  constexpr size_t kMaxDepth = 8;
  if (const auto comparison = read(config_dir + L"\\fluideq-curve-phase.txt")) {
    const size_t first = comparison->find_first_not_of(" \t\r\n");
    if (first != std::string::npos &&
        ((*comparison)[first] == 'A' || (*comparison)[first] == 'B') &&
        comparison->find_first_not_of(" \t\r\n", first + 1) == std::string::npos) {
      chain.minimum_curve_phase = (*comparison)[first] == 'B';
    }
  }

  if (const auto phase = read(config_dir + L"\\fluideq-eq-phase.txt")) {
    const size_t first = phase->find_first_not_of(" \t\r\n");
    chain.minimum_eq_phase = !(first != std::string::npos &&
        (*phase)[first] == 'A' &&
        phase->find_first_not_of(" \t\r\n", first + 1) == std::string::npos);
  }

  // Before the config tree, and outside it. `SET_SYSTEM_DSP_CHAIN` writes
  // this file whether or not the user has ever configured the EQ, and the
  // rack has no `Device:` guard to be excluded by — so an endpoint with no
  // config.txt at all still gets it, which is why this sits above the early
  // return below rather than inside the walk.
  //
  // Not added to `files_read`: that list is the Equalizer APO include tree,
  // and the watcher reads its emptiness as "there is no config.txt". A rack
  // file counted there would report a machine with no EQ configuration as
  // having one. `signature_of` covers this file's contents instead.
  if (const std::optional<std::string> dsp_text =
          read(config_dir + L"\\fluideq-dsp.txt")) {
    chain.dsp_values = parse_dsp_values(*dsp_text);
  }

  const std::wstring root_path = config_dir + L"\\config.txt";
  const std::optional<std::string> root_text = read(root_path);
  if (!root_text) {
    return chain;  // No Equalizer APO config at all: the rack alone, if any.
  }

  std::set<std::wstring> opened;
  opened.insert(root_path);
  chain.files_read.push_back(root_path);

  std::vector<Frame> stack;
  stack.push_back(Frame{root_path, tokenize(*root_text), 0, true});

  while (!stack.empty()) {
    if (stack.back().index >= stack.back().lines.size()) {
      stack.pop_back();
      continue;
    }
    // Copied rather than referenced: a push below can reallocate `stack`,
    // and a `Frame&` held across that point would dangle.
    const Line line = stack.back().lines[stack.back().index];
    ++stack.back().index;
    const bool matching = stack.back().matching;

    if (detail::iequals(line.command, "Device")) {
      stack.back().matching = device_matches(line.body, endpoint);
      continue;
    }
    if (detail::iequals(line.command, "Channel")) {
      continue;  // Recognised, never fatal, never part of this resolver's job.
    }
    if (!matching) {
      continue;  // Nothing else applies to an endpoint this block does not name.
    }

    if (detail::iequals(line.command, "Include")) {
      if (stack.size() >= kMaxDepth) {
        continue;  // Depth guard: never fatal, just stop following deeper.
      }
      const std::optional<std::wstring> resolved =
          resolve_relative(config_dir, utf8_to_wide(line.body));
      if (!resolved || opened.count(*resolved) != 0) {
        continue;  // Escaping path, or a file already open somewhere on the
                   // stack — the cycle guard, not an optimisation.
      }
      const std::optional<std::string> contents = read(*resolved);
      if (!contents) {
        continue;
      }
      opened.insert(*resolved);
      chain.files_read.push_back(*resolved);
      const bool curve_layer = stack.back().curve_layer;
      const bool eq_layer = stack.back().eq_layer;
      stack.push_back(Frame{*resolved, tokenize(*contents), 0, matching, curve_layer, eq_layer});
      continue;
    }

    if (detail::iequals(line.command, "Convolution")) {
      const std::wstring wide_body = utf8_to_wide(line.body);
      const std::optional<std::wstring> resolved =
          has_drive_or_unc_prefix(wide_body)
              ? std::optional<std::wstring>(wide_body)
              : resolve_relative(config_dir, wide_body);
      if (resolved) {
        chain.convolution_passes = chain.convolution_path == *resolved
            ? std::min(chain.convolution_passes + 1u, 8u) : 1u;
        chain.convolution_path = *resolved;
        chain.matched = true;
      }
      continue;
    }

    if (detail::iequals(line.command, "FluidEQAutoPreamp")) {
      if (line.body == "ON" || line.body == "OFF") {
        chain.output_guard = true;
        chain.auto_preamp = line.body == "ON";
        if (chain.auto_preamp) chain.preamp_db = 0.0;
      }
      continue;
    }
    if (detail::iequals(line.command, "FluidEQCurveStage")) {
      chain.stable_graphic = line.body == "ON";
      continue;
    }
    if (detail::iequals(line.command, "FluidEQCurveLayer")) {
      stack.back().curve_layer = line.body == "ON";
      if (stack.back().curve_layer) stack.back().eq_layer = false;
      continue;
    }
    if (detail::iequals(line.command, "FluidEQEqLayer")) {
      stack.back().eq_layer = line.body == "ON";
      if (stack.back().eq_layer) stack.back().curve_layer = false;
      continue;
    }
    if (detail::iequals(line.command, "Preamp")) {
      if (const std::optional<double> value = parse_preamp(line.body)) {
        chain.preamp_db = *value;
        chain.matched = true;
      }
      continue;
    }

    if (detail::iequals(line.command, "Filter")) {
      if (const std::optional<Band> band = parse_filter(line.body)) {
        chain.bands.push_back(*band);
        chain.bands.back().user_eq = stack.back().eq_layer;
        chain.bands.back().curve_layer = stack.back().curve_layer;
        chain.matched = true;
      }
      continue;
    }

    if (detail::iequals(line.command, "GraphicEQ")) {
      std::vector<GraphicPoint> points = parse_graphic(line.body);
      if (!points.empty()) {
        if (stack.back().curve_layer) {
          chain.comparison_curves.push_back(points);
        }
        if (stack.back().eq_layer) {
          chain.eq_graphic_curves.push_back(points);
        }
        chain.graphic_curves.push_back(std::move(points));
        chain.matched = true;
      }
      continue;
    }

    add_ignored(chain.ignored, line.command);
  }

  return chain;
}

}  // namespace fluideq_engine
