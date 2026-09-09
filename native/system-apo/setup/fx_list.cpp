/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fx_list.h"

#include <algorithm>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "json.h"

namespace fluideq_engine::setup {

const wchar_t kDefaultProcessingMode[] =
    L"{C18E2F7E-933D-4965-B7D1-1EEF228D2AF3}";

namespace {

/**
 * Case-insensitive over ASCII only, which is all a class id can contain.
 *
 * `CompareStringOrdinal` would be the Windows answer and is deliberately not
 * used: this translation unit is the one part of the helper with no platform
 * behind it, so it can be reasoned about and tested without one.
 */
wchar_t fold(wchar_t symbol) {
  if (symbol >= L'a' && symbol <= L'z') {
    return static_cast<wchar_t>(symbol - L'a' + L'A');
  }
  return symbol;
}

bool equal_ci(std::wstring_view left, std::wstring_view right) {
  if (left.size() != right.size()) {
    return false;
  }
  for (size_t at = 0; at < left.size(); ++at) {
    if (fold(left[at]) != fold(right[at])) {
      return false;
    }
  }
  return true;
}

bool contains_ci(const std::vector<std::wstring>& list,
                 std::wstring_view value) {
  return std::any_of(list.begin(), list.end(),
                     [value](const std::wstring& entry) {
                       return equal_ci(entry, value);
                     });
}

/** Whether any of pids 5, 6, 7, 13, 14 or 15 is in the key at all. */
bool has_modern_values(const FxValues& values) {
  for (int slot = 0; slot < kSlotCount; ++slot) {
    if (values.single[slot].has_value() || values.composite[slot].has_value()) {
      return true;
    }
  }
  return false;
}

int index_of(Slot slot) { return slot == Slot::Mfx ? kMfx : kEfx; }

// ---------------------------------------------------------------------------
// JSON, in the one shape a backup file is ever written in.

void append_optional_string(std::wstring& out,
                            const std::optional<std::wstring>& value) {
  if (!value.has_value()) {
    out += L"null";
    return;
  }
  out += L'"';
  out += json_escape(*value);
  out += L'"';
}

void append_optional_list(
    std::wstring& out,
    const std::optional<std::vector<std::wstring>>& value) {
  if (!value.has_value()) {
    out += L"null";
    return;
  }
  out += L'[';
  for (size_t at = 0; at < value->size(); ++at) {
    if (at != 0) {
      out += L',';
    }
    out += L'"';
    out += json_escape((*value)[at]);
    out += L'"';
  }
  out += L']';
}

bool read_string_slots(JsonScanner& scanner, std::optional<std::wstring>* out,
                       int count) {
  if (!scanner.consume(L'[')) {
    return false;
  }
  for (int at = 0; at < count; ++at) {
    if (at != 0 && !scanner.consume(L',')) {
      return false;
    }
    if (scanner.read_null()) {
      out[at].reset();
      continue;
    }
    std::wstring value;
    if (!scanner.read_string(value)) {
      return false;
    }
    out[at] = std::move(value);
  }
  return scanner.consume(L']');
}

bool read_list_slots(JsonScanner& scanner,
                     std::optional<std::vector<std::wstring>>* out, int count) {
  if (!scanner.consume(L'[')) {
    return false;
  }
  for (int at = 0; at < count; ++at) {
    if (at != 0 && !scanner.consume(L',')) {
      return false;
    }
    if (scanner.read_null()) {
      out[at].reset();
      continue;
    }
    if (!scanner.consume(L'[')) {
      return false;
    }
    std::vector<std::wstring> entries;
    if (!scanner.consume(L']')) {
      while (true) {
        std::wstring entry;
        if (!scanner.read_string(entry)) {
          return false;
        }
        entries.push_back(std::move(entry));
        if (scanner.consume(L',')) {
          continue;
        }
        if (!scanner.consume(L']')) {
          return false;
        }
        break;
      }
    }
    out[at] = std::move(entries);
  }
  return scanner.consume(L']');
}

}  // namespace

bool operator==(const FxValues& left, const FxValues& right) {
  for (int slot = 0; slot < kSlotCount; ++slot) {
    if (left.single[slot] != right.single[slot] ||
        left.composite[slot] != right.composite[slot] ||
        left.modes[slot] != right.modes[slot]) {
      return false;
    }
  }
  for (int slot = 0; slot < kLegacyCount; ++slot) {
    if (left.legacy[slot] != right.legacy[slot]) {
      return false;
    }
  }
  return true;
}

FxPlan plan_attach(const FxValues& before, std::wstring_view clsid, Slot slot) {
  FxPlan plan;
  plan.after = before;
  FxValues& after = plan.after;
  const int index = index_of(slot);

  // 1. Mirror the singles into the composites. Windows reads the composite
  //    list in preference to the single, so a list created without the
  //    vendor's own class id in it turns that vendor's effect off. An empty
  //    single means "nothing registered here" and is not mirrored: a list
  //    holding an empty string is a class id the audio engine would try to
  //    create.
  for (int at = 0; at < kSlotCount; ++at) {
    if (!after.composite[at].has_value() && before.single[at].has_value() &&
        !before.single[at]->empty()) {
      after.composite[at] = std::vector<std::wstring>{*before.single[at]};
    }
  }

  // 2. An endpoint registered the pre-8.1 way has neither generation of the
  //    modern values, only LFX and GFX. Those carry forward into the SFX and
  //    MFX lists; pids 1 and 2 themselves are left exactly as found, because
  //    a machine that still reads them has to keep working.
  if (!has_modern_values(before)) {
    for (int at = 0; at < kLegacyCount; ++at) {
      if (before.legacy[at].has_value() && !before.legacy[at]->empty()) {
        after.composite[at] = std::vector<std::wstring>{*before.legacy[at]};
      }
    }
  }

  // 3. Ours goes on the end of the chosen list, once.
  if (!after.composite[index].has_value()) {
    after.composite[index] = std::vector<std::wstring>();
  }
  if (!contains_ci(*after.composite[index], clsid)) {
    after.composite[index]->emplace_back(clsid);
  }

  // 4. A list with no processing modes beside it is never reached: the engine
  //    matches the stream's mode against that list and an absent one matches
  //    nothing. An existing list is never touched — the vendor decided which
  //    modes its effects run in, and DEFAULT is only what we need for
  //    ordinary playback.
  if (!after.modes[index].has_value()) {
    after.modes[index] =
        std::vector<std::wstring>{std::wstring(kDefaultProcessingMode)};
  }

  plan.changed = after != before;
  return plan;
}

FxPlan plan_detach(const FxValues& current, const FxValues& backup,
                   std::wstring_view clsid) {
  FxPlan plan;
  plan.after = current;
  FxValues& after = plan.after;

  // Every list rather than only the EFX one: `--slot mfx` puts the effect in
  // pid 14, and a detach that only looked at pid 15 would leave it attached
  // with its backup deleted.
  for (int at = 0; at < kSlotCount; ++at) {
    if (!after.composite[at].has_value()) {
      continue;
    }
    std::vector<std::wstring>& entries = *after.composite[at];
    const size_t was = entries.size();
    entries.erase(std::remove_if(entries.begin(), entries.end(),
                                 [clsid](const std::wstring& entry) {
                                   return equal_ci(entry, clsid);
                                 }),
                  entries.end());
    if (entries.size() == was) {
      continue;
    }
    // Only the keys the attach created come back out. An empty list that was
    // already there stays empty rather than being deleted, and the mirrored
    // lists stay because they only repeat what pids 5 and 6 still say.
    if (entries.empty() && !backup.composite[at].has_value()) {
      after.composite[at].reset();
    }
    if (!backup.modes[at].has_value()) {
      after.modes[at].reset();
    }
  }

  plan.changed = after != current;
  return plan;
}

bool is_attached(const FxValues& values, std::wstring_view clsid) {
  for (int at = 0; at < kSlotCount; ++at) {
    if (values.composite[at].has_value() &&
        contains_ci(*values.composite[at], clsid)) {
      return true;
    }
  }
  return false;
}

std::wstring to_json(const FxValues& values) {
  std::wstring out = L"{\"single\":[";
  for (int at = 0; at < kSlotCount; ++at) {
    if (at != 0) {
      out += L',';
    }
    append_optional_string(out, values.single[at]);
  }
  out += L"],\"composite\":[";
  for (int at = 0; at < kSlotCount; ++at) {
    if (at != 0) {
      out += L',';
    }
    append_optional_list(out, values.composite[at]);
  }
  out += L"],\"legacy\":[";
  for (int at = 0; at < kLegacyCount; ++at) {
    if (at != 0) {
      out += L',';
    }
    append_optional_string(out, values.legacy[at]);
  }
  out += L"],\"modes\":[";
  for (int at = 0; at < kSlotCount; ++at) {
    if (at != 0) {
      out += L',';
    }
    append_optional_list(out, values.modes[at]);
  }
  out += L"]}";
  return out;
}

std::optional<FxValues> from_json(std::wstring_view text) {
  JsonScanner scanner(text);
  if (!scanner.consume(L'{')) {
    return std::nullopt;
  }
  FxValues values;
  bool seen_single = false;
  bool seen_composite = false;
  bool seen_legacy = false;
  bool seen_modes = false;
  if (!scanner.consume(L'}')) {
    while (true) {
      std::wstring key;
      if (!scanner.read_string(key) || !scanner.consume(L':')) {
        return std::nullopt;
      }
      // Unknown keys are refused rather than skipped. The only writer of this
      // file is this program, so a key we do not know means the file is not
      // the one we wrote and nothing in it should be put back on an endpoint.
      if (key == L"single" && !seen_single) {
        seen_single = true;
        if (!read_string_slots(scanner, values.single, kSlotCount)) {
          return std::nullopt;
        }
      } else if (key == L"composite" && !seen_composite) {
        seen_composite = true;
        if (!read_list_slots(scanner, values.composite, kSlotCount)) {
          return std::nullopt;
        }
      } else if (key == L"legacy" && !seen_legacy) {
        seen_legacy = true;
        if (!read_string_slots(scanner, values.legacy, kLegacyCount)) {
          return std::nullopt;
        }
      } else if (key == L"modes" && !seen_modes) {
        seen_modes = true;
        if (!read_list_slots(scanner, values.modes, kSlotCount)) {
          return std::nullopt;
        }
      } else {
        return std::nullopt;
      }
      if (scanner.consume(L',')) {
        continue;
      }
      if (!scanner.consume(L'}')) {
        return std::nullopt;
      }
      break;
    }
  }
  if (!scanner.at_end() || !seen_single || !seen_composite || !seen_legacy ||
      !seen_modes) {
    return std::nullopt;
  }
  return values;
}

}  // namespace fluideq_engine::setup
