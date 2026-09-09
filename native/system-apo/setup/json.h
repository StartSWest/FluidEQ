/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Just enough JSON for the three documents the helper produces and the one it
 * reads back.
 *
 * A library would be the obvious answer and is the wrong one here: this
 * executable is copied next to an audio driver's DLL and run elevated, so
 * every dependency it takes is one more thing to audit and to ship. The
 * documents are ours, their shape is fixed, and the only untrusted input is a
 * backup file somebody could have edited by hand — which is exactly what the
 * scanner below refuses rather than guesses at.
 *
 * Escaping is not decoration. An endpoint's friendly name is chosen by
 * whoever named the device and routinely contains a quote or a backslash; a
 * class id read out of a vendor's registry value is not guaranteed to be a
 * class id at all. Either one written unescaped produces a document the
 * TypeScript side cannot parse, and the failure surfaces as "the helper did
 * nothing".
 */
#ifndef FLUIDEQ_ENGINE_SETUP_JSON_H
#define FLUIDEQ_ENGINE_SETUP_JSON_H

#include <string>
#include <string_view>

namespace fluideq_engine::setup {

/**
 * `text` with everything JSON forbids inside a string replaced.
 *
 * Quotes and backslashes by name, the five short control escapes, and
 * anything else below U+0020 as `\u00XX`. Characters above ASCII are left
 * alone: the documents are written as UTF-8, where they are already legal.
 */
std::wstring json_escape(std::wstring_view text);

/**
 * A reader over one JSON document, which fails rather than recovers.
 *
 * There is no error position and no partial result on purpose. The only
 * caller is a backup file that this program wrote, so anything it cannot read
 * is a file that has been damaged or replaced — and continuing on a guess
 * would put a guessed registry value back on somebody's speakers.
 */
class JsonScanner {
 public:
  explicit JsonScanner(std::wstring_view text) : text_(text) {}

  /** Skips whitespace, then consumes `symbol` if that is what comes next. */
  bool consume(wchar_t symbol);

  /** Skips whitespace, then reads a quoted string with its escapes undone. */
  bool read_string(std::wstring& out);

  /** Skips whitespace, then consumes the literal `null`. */
  bool read_null();

  /** Skips whitespace, then consumes `true` or `false` into `out`. */
  bool read_bool(bool& out);

  /** Whether only whitespace is left. */
  bool at_end();

 private:
  void skip_space();

  /** Consumes `literal` if that is exactly what comes next. */
  bool read_literal(std::wstring_view literal);

  std::wstring_view text_;
  size_t at_ = 0;
};

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_JSON_H
