/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "apo_names.h"

#include <cwctype>
#include <initializer_list>

#include "fx_list.h"
#include "json.h"

namespace fluideq_engine::setup {

namespace {

// Spelled as numbers: a literal sign in the source depends on the code page
// the compiler reads it in.
constexpr wchar_t kCopyrightSign[] = {static_cast<wchar_t>(0x00A9), 0};
constexpr wchar_t kEnDash = static_cast<wchar_t>(0x2013);

bool blank(wchar_t symbol) { return std::iswspace(symbol) != 0; }

std::wstring trimmed(std::wstring_view text) {
  size_t first = 0;
  while (first < text.size() && blank(text[first])) {
    ++first;
  }
  size_t last = text.size();
  while (last > first && blank(text[last - 1])) {
    --last;
  }
  return std::wstring(text.substr(first, last - first));
}

/** The first value with something in it, trimmed. */
std::wstring first_of(std::initializer_list<std::wstring_view> values) {
  for (const std::wstring_view value : values) {
    std::wstring text = trimmed(value);
    if (!text.empty()) {
      return text;
    }
  }
  return std::wstring();
}

bool starts_with_ci(std::wstring_view text, std::wstring_view prefix) {
  return text.size() >= prefix.size() &&
         equal_ci(text.substr(0, prefix.size()), prefix);
}

/** Where `needle` first stands in `text`, ignoring case, or npos. */
size_t find_ci(std::wstring_view text, std::wstring_view needle) {
  if (needle.size() > text.size()) {
    return std::wstring_view::npos;
  }
  for (size_t at = 0; at + needle.size() <= text.size(); ++at) {
    if (equal_ci(text.substr(at, needle.size()), needle)) {
      return at;
    }
  }
  return std::wstring_view::npos;
}

/**
 * "Copyright (c) 2021 THX Inc. All Rights Reserved" as "THX Inc.": the
 * holder, which is the maker, without the words and years around it.
 */
std::wstring holder_of(std::wstring_view copyright) {
  std::wstring text = trimmed(copyright);
  const size_t reserved = find_ci(text, L"all rights reserved");
  if (reserved != std::wstring::npos) {
    text = trimmed(std::wstring_view(text).substr(0, reserved));
  }
  bool stripped = true;
  while (stripped && !text.empty()) {
    stripped = false;
    for (const std::wstring_view word :
         {std::wstring_view(L"copyright"), std::wstring_view(L"(c)"),
          std::wstring_view(kCopyrightSign, 1)}) {
      if (starts_with_ci(text, word)) {
        text = trimmed(std::wstring_view(text).substr(word.size()));
        stripped = true;
      }
    }
    // The years, alone or as a range or a list: "2019-2024, ".
    size_t year = 0;
    while (year < text.size() &&
           (std::iswdigit(text[year]) != 0 || text[year] == L'-' ||
            text[year] == L',' || text[year] == kEnDash ||
            blank(text[year]))) {
      ++year;
    }
    if (year > 0) {
      text = trimmed(std::wstring_view(text).substr(year));
      stripped = true;
    }
  }
  while (!text.empty() && (text.back() == L',' || text.back() == L';')) {
    text.pop_back();
    text = trimmed(text);
  }
  return text;
}

std::wstring file_name_of(std::wstring_view path) {
  const size_t slash = path.find_last_of(L"\\/");
  return trimmed(slash == std::wstring_view::npos ? path
                                                  : path.substr(slash + 1));
}

/** "ElevocUAPO.dll" as "ElevocUAPO". */
std::wstring stem_of(std::wstring_view file) {
  const size_t dot = file.find_last_of(L'.');
  return std::wstring(dot == std::wstring_view::npos ? file
                                                     : file.substr(0, dot));
}

/** "RtkRecEFX Class" as "RtkRecEFX": the word every COM class ends in. */
std::wstring without_class_word(std::wstring_view name) {
  std::wstring text = trimmed(name);
  constexpr std::wstring_view kWord = L" Class";
  if (text.size() > kWord.size() &&
      equal_ci(std::wstring_view(text).substr(text.size() - kWord.size()),
               kWord)) {
    text = trimmed(std::wstring_view(text).substr(0, text.size() - kWord.size()));
  }
  return text;
}

/**
 * A company the driver kit's template wrote and nobody changed: THX's mic
 * effect says "Windows (R) Win 7 DDK provider" (2026-11-25). Not a maker.
 */
bool is_template_company(std::wstring_view company) {
  return find_ci(company, L"DDK provider") != std::wstring_view::npos;
}

}  // namespace

ApoInfo resolve_apo(const ApoSources& sources) {
  ApoInfo info;
  info.file = file_name_of(sources.dll_path);
  const std::wstring stem = stem_of(info.file);
  // A file description that only repeats the file's name ("ElevocUAPO",
  // "MsApoFxProxy" on that machine) describes nothing.
  std::wstring file_description = trimmed(sources.file_description);
  if (!stem.empty() && equal_ci(file_description, stem)) {
    file_description.clear();
  }
  const std::wstring candidates[] = {
      trimmed(sources.friendly_name), without_class_word(sources.class_name),
      file_description, trimmed(sources.component)};
  // The first in that order made of words; an identifier ("CRtkRecEFX",
  // Realtek's FriendlyName) only where nothing else is on record.
  for (const std::wstring& candidate : candidates) {
    if (candidate.find(L' ') != std::wstring::npos) {
      info.name = candidate;
      break;
    }
  }
  if (info.name.empty()) {
    info.name = first_of({candidates[0], candidates[1], candidates[2],
                          candidates[3]});
  }
  // What else Windows calls it, once, words first: the component it came in
  // over THX's "THXMicAPO"; the identifier passed over where nothing else
  // is said. Never the COM class's own name, which is the FriendlyName or an
  // identifier with " Class" after it.
  const std::wstring* others[] = {&candidates[0], &candidates[2],
                                  &candidates[3]};
  for (const bool words : {true, false}) {
    for (const std::wstring* other : others) {
      if (info.description.empty() && !other->empty() &&
          !equal_ci(*other, info.name) &&
          (!words || other->find(L' ') != std::wstring::npos)) {
        info.description = *other;
      }
    }
  }
  // The driver package's provider is who signed for it; a company in the
  // version resource is whatever the DLL's author typed, template or not.
  info.maker = trimmed(sources.provider);
  if (info.maker.empty() && !is_template_company(sources.company)) {
    info.maker = trimmed(sources.company);
  }
  if (info.maker.empty()) {
    info.maker = holder_of(sources.copyright);
  }
  info.version = trimmed(sources.file_version);
  info.windows = starts_with_ci(info.maker, L"Microsoft");
  return info;
}

const wchar_t* effect_kind_name(EffectKind kind) {
  switch (kind) {
    case EffectKind::Stream:
      return L"stream";
    case EffectKind::Mode:
      return L"mode";
    case EffectKind::Endpoint:
    default:
      return L"endpoint";
  }
}

std::wstring effect_json(std::wstring_view clsid, EffectKind kind,
                         const ApoInfo& info) {
  std::wstring out = L"{\"clsid\":\"";
  out += json_escape(clsid);
  out += L"\",\"name\":\"";
  out += json_escape(info.name);
  out += L"\",\"maker\":\"";
  out += json_escape(info.maker);
  out += L"\",\"description\":\"";
  out += json_escape(info.description);
  out += L"\",\"file\":\"";
  out += json_escape(info.file);
  out += L"\",\"version\":\"";
  out += json_escape(info.version);
  out += L"\",\"windows\":";
  out += info.windows ? L"true" : L"false";
  out += L",\"kind\":\"";
  out += effect_kind_name(kind);
  out += L"\"}";
  return out;
}

}  // namespace fluideq_engine::setup
