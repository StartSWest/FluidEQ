/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Reading Equalizer APO's own config layout back, for one output device.
 *
 * FluidEQ writes `config.txt -> Include: fluideq.txt`, and fluideq.txt is a
 * tree of `Device:`-gated blocks that each `Include:` a handful of
 * feature files (see `apoConfigReader.ts`, which reads the same tree from the
 * app process). The system-wide effect has no app process to ask, so it has
 * to walk that tree itself, from inside audiodg.exe, every time Windows
 * creates it for an endpoint. This header is that walk, isolated from
 * anything Windows-specific so it can be unit tested off-target: no COM, no
 * registry, no file system — a caller hands it bytes through `FileProvider`
 * and gets back the chain that applies to one endpoint.
 *
 * Deliberately never throws: `resolve_chain` runs on a load path a broken or
 * hand-edited config must not be able to bring down, so every failure mode
 * (a missing file, a malformed line, a config that loops) is a value in
 * `Chain`, never an exception.
 */
#ifndef FLUIDEQ_ENGINE_CONFIG_H
#define FLUIDEQ_ENGINE_CONFIG_H

#include <functional>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace fluideq_engine {

// The seven band shapes Equalizer APO's `Filter:` line can name, after
// folding its type aliases (PEQ/MODAL -> PK, LS/LSQ -> LSC, and so on) the
// way `apoText.ts`'s TYPE_ALIASES table does.
enum class FilterType { PK, NO, LSC, HSC, LPQ, HPQ, BP };

struct Band {
  FilterType type;
  double frequency;
  double gain_db;
  double quality;
};

struct GraphicPoint {
  double frequency;
  double gain_db;
};

/** Everything Equalizer APO would apply to one endpoint, once resolved. */
struct Chain {
  // Empty when no `Convolution:` line applied. Absolute: a relative one on
  // disk has already been joined to the config directory.
  std::wstring convolution_path;
  // Empty when no `GraphicEQ:` line applied.
  std::vector<GraphicPoint> graphic;
  std::vector<Band> bands;
  double preamp_db = 0.0;
  /**
   * The DSP rack, exactly as `encodeChainSettings` wrote it.
   *
   * Read from `<config_dir>\fluideq-dsp.txt`, which is not part of the
   * Equalizer APO include tree above and is never named by an `Include:`
   * line: it is one flat array of doubles the app rewrites on every rack
   * change, and `feq_chain_settings_decode` on the other side is the only
   * thing that knows what the numbers mean. Empty whenever the file is
   * absent, empty, or carries a token that is not a plain decimal — all of
   * which mean the rack is bypassed and the EQ below still runs.
   *
   * Deliberately NOT reflected in `matched`: the rack is system-wide and has
   * no `Device:` guard, so it applies to an endpoint the EQ configuration
   * never names.
   */
  std::vector<double> dsp_values;
  // The first token of every line whose command this resolver does not
  // recognise, deduplicated in the order first seen — the log needs to say
  // what a hand-edited config carried that FluidEQ silently walked past.
  std::vector<std::string> ignored;
  // Every file actually opened while resolving this chain, in open order, as
  // absolute paths. A file behind a `Device:` guard that never matched is
  // never opened and so never appears here.
  std::vector<std::wstring> files_read;
  // True once some `Filter:`, `Preamp:`, `GraphicEQ:` or `Convolution:` line
  // actually took effect for this endpoint. A config that only comments or
  // only guards other devices leaves this false, which is the difference
  // between "no work to do" and "a config that has nothing to say" — both
  // return an otherwise-empty Chain.
  bool matched = false;
};

struct Endpoint {
  std::wstring guid;
  std::wstring friendly_name;
};

/** Returns the file's bytes, or nullopt when unreadable. Paths are absolute. */
using FileProvider =
    std::function<std::optional<std::string>(const std::wstring& path)>;

/**
 * Resolve the chain Equalizer APO would apply to `endpoint`.
 *
 * Starts at `<config_dir>\config.txt` and follows every `Include:` a
 * `Device:` guard currently allows, the same tree `apoConfigReader.ts` walks
 * from the app side. Never throws: an absent config, a cycle, an escaping
 * include, or a malformed line are all just a `Chain` with less in it, never
 * a signal a caller has to catch.
 *
 * Include depth is capped at 8 open frames, the root `config.txt` counted as
 * the first: an `Include:` line encountered while 8 frames are already open
 * is skipped rather than followed, so the 8th frame (root + 7 levels of
 * Include) is the deepest file this resolver ever opens.
 */
Chain resolve_chain(const std::wstring& config_dir, const Endpoint& endpoint,
                    const FileProvider& read);

/** One logical line of an APO config file: the label before `:`, and the rest. */
struct Line {
  std::string command;
  std::string body;
};

/**
 * Split one file's text into its command lines.
 *
 * Handles what `apoConfigReader.ts` never has to, because Node always hands
 * it a decoded string: a UTF-16LE or UTF-8 byte-order mark, and `\r` in
 * either position a line ending can put it (`\r\n`, or the legacy `\n\r`
 * some generators still emit). Comments and blank lines are dropped here so
 * every other function in this header only ever sees a real command.
 */
std::vector<Line> tokenize(std::string_view text);

/**
 * Parse a `Filter:` body: `ON <type> Fc <f> Hz [Gain <g> dB] (Q <q> | BW Oct <o>)`.
 *
 * Mirrors the `FILTER_LINE` regex in `apoText.ts`, including its type
 * aliases, except `Q` and `BW Oct` are both accepted here rather than either
 * being implied by omission, since Equalizer APO writes both forms in the
 * wild. Rejects `OFF` bands, unknown types, non-positive frequency or
 * quality, and any trailing token the grammar has no place for.
 */
std::optional<Band> parse_filter(std::string_view body);

/**
 * Parse a `GraphicEQ:` body: semicolon-separated `<frequency> <gain>` pairs.
 *
 * All-or-nothing, unlike the importer in `apoText.ts`, which keeps whatever
 * points parse and drops the rest: a system-wide effect that silently plays
 * back half the curve a user exported is a worse failure than one that
 * refuses the whole line and leaves the previous chain in place.
 */
std::vector<GraphicPoint> parse_graphic(std::string_view body);

/**
 * Parse `fluideq-dsp.txt`: a `#` header line, then one line of doubles.
 *
 * All-or-nothing, for the same reason `parse_graphic` is: half a rack is a
 * chain of stages the user never asked for, and a file this resolver could
 * not read whole is one the app is in the middle of rewriting. Every token
 * goes through `std::from_chars`, which is locale-free by construction —
 * `strtod` on a machine whose locale uses a comma decimal separator reads
 * `0.45` as `0`, silently, and the rack would simply sound wrong.
 */
std::vector<double> parse_dsp_values(std::string_view text);

/**
 * Whether a `Device:` pattern names `endpoint`.
 *
 * `all` always matches; otherwise the pattern matches the endpoint's GUID
 * exactly (case-insensitive) or appears anywhere in its friendly name
 * (case-insensitive, ASCII-only folding — the same rule Equalizer APO's own
 * Device Selector applies).
 */
bool device_matches(std::string_view pattern, const Endpoint& endpoint);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_CONFIG_H
