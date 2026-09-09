/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "registry.h"

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "fs.h"
#include "multi_sz.h"
#include "reg_key.h"

namespace fluideq_engine::setup {

namespace {

const wchar_t kRenderPath[] =
    L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render";

/** The FX property set, whose members are the effect values themselves. */
const wchar_t kFxProperty[] = L"{d04e05a6-594b-4fb6-a80d-01af5eed7d1d}";
/** The signal-processing-mode property set that sits beside them. */
const wchar_t kModeProperty[] = L"{d3993a3f-99c2-4402-b5ec-a92a0367664b}";

const int kSinglePid[kSlotCount] = {5, 6, 7};
const int kCompositePid[kSlotCount] = {13, 14, 15};
const int kLegacyPid[kLegacyCount] = {1, 2};
const int kModePid[kSlotCount] = {5, 6, 7};

std::wstring value_name(const wchar_t* property_set, int pid) {
  return std::wstring(property_set) + L"," + std::to_wstring(pid);
}

bool read_single(HKEY key, const std::wstring& name,
                 std::optional<std::wstring>& out, std::wstring& error) {
  DWORD type = 0;
  std::vector<BYTE> bytes;
  bool present = false;
  if (!query_value(key, name, type, bytes, present)) {
    error = L"could not read " + name;
    return false;
  }
  if (!present) {
    out.reset();
    return true;
  }
  if (type != REG_SZ && type != REG_EXPAND_SZ) {
    error = name + L" is not a string";
    return false;
  }
  out = decode_sz(bytes.data(), bytes.size());
  return true;
}

/**
 * One list value, with a vendor's single string read as a one-entry list.
 *
 * A non-null `was_sz` means the caller has to be able to put the value type
 * back — which is true of the composite slots and not of the mode lists,
 * because no plan ever rewrites a mode list it did not create.
 */
bool read_list(HKEY key, const std::wstring& name,
               std::optional<std::vector<std::wstring>>& out, bool* was_sz,
               std::wstring& error) {
  DWORD type = 0;
  std::vector<BYTE> bytes;
  bool present = false;
  if (was_sz != nullptr) {
    *was_sz = false;
  }
  if (!query_value(key, name, type, bytes, present)) {
    error = L"could not read " + name;
    return false;
  }
  if (!present) {
    out.reset();
    return true;
  }
  if (type == REG_MULTI_SZ) {
    out = decode_multi_sz(bytes.data(), bytes.size());
    return true;
  }
  // A vendor that wrote a single string into a list value still registered an
  // effect there, and it has to survive the edit. Reading it as a one-entry
  // list keeps it; refusing the whole endpoint would be safe but would also
  // make FluidEQ unusable on that machine for no reason the user could act
  // on. `was_sz` is what carries the type into the backup so that a detach can
  // put a `REG_SZ` back rather than leaving a list the vendor never wrote.
  // A `REG_EXPAND_SZ` where the type has to survive is refused rather than
  // read. There is nothing to expand in a class id, so this shape does not
  // occur — and if it ever did, restoring it as a plain `REG_SZ` would be a
  // silent conversion of exactly the kind this flag exists to undo. Not
  // touching the endpoint at all is the honest answer.
  if (type == REG_EXPAND_SZ && was_sz != nullptr) {
    error = name + L" holds an expandable string, which this program will not "
                   L"convert";
    return false;
  }
  if (type == REG_SZ || type == REG_EXPAND_SZ) {
    const std::wstring only = decode_sz(bytes.data(), bytes.size());
    out = only.empty() ? std::vector<std::wstring>()
                       : std::vector<std::wstring>{only};
    if (was_sz != nullptr) {
      *was_sz = true;
    }
    return true;
  }
  error = name + L" is neither a string nor a list";
  return false;
}

/**
 * Sets `name` from `value`, or deletes it when `value` is absent.
 *
 * `as_sz` writes it back the way the vendor had it: a value of at most one
 * entry that was found as a `REG_SZ` goes back as one. Anything longer cannot
 * be a `REG_SZ`, which is why the caller checks the length rather than
 * trusting the flag.
 */
LSTATUS apply_list(HKEY key, const std::wstring& name,
                   const std::optional<std::vector<std::wstring>>& value,
                   bool as_sz) {
  if (!value.has_value()) {
    const LSTATUS deleted = RegDeleteValueW(key, name.c_str());
    return deleted == ERROR_FILE_NOT_FOUND ? ERROR_SUCCESS : deleted;
  }
  if (as_sz) {
    return set_string(key, name.c_str(),
                      value->empty() ? std::wstring() : value->front());
  }
  const std::vector<wchar_t> block = encode_multi_sz(*value);
  return RegSetValueExW(key, name.c_str(), 0, REG_MULTI_SZ,
                        reinterpret_cast<const BYTE*>(block.data()),
                        static_cast<DWORD>(block.size() * sizeof(wchar_t)));
}

std::wstring endpoint_path(const std::wstring& guid) {
  return std::wstring(kRenderPath) + L"\\" + guid;
}

std::wstring fx_path(const std::wstring& guid) {
  return endpoint_path(guid) + L"\\FxProperties";
}

/** Whether the plan asks for this composite slot to go back as a `REG_SZ`. */
bool wants_sz(const FxValues& after, int slot) {
  return after.composite_was_sz[slot] && after.composite[slot].has_value() &&
         after.composite[slot]->size() <= 1;
}

}  // namespace

bool is_valid_endpoint_guid(std::wstring_view guid) {
  // {8-4-4-4-12}, and nothing else. Length first so the index below is safe.
  if (guid.size() != 38 || guid.front() != L'{' || guid.back() != L'}') {
    return false;
  }
  const size_t dashes[] = {9, 14, 19, 24};
  for (size_t at = 1; at + 1 < guid.size(); ++at) {
    const bool is_dash = at == dashes[0] || at == dashes[1] ||
                         at == dashes[2] || at == dashes[3];
    const wchar_t symbol = guid[at];
    if (is_dash) {
      if (symbol != L'-') {
        return false;
      }
      continue;
    }
    const bool hex = (symbol >= L'0' && symbol <= L'9') ||
                     (symbol >= L'a' && symbol <= L'f') ||
                     (symbol >= L'A' && symbol <= L'F');
    if (!hex) {
      return false;
    }
  }
  return true;
}

bool endpoint_key_exists(const std::wstring& guid) {
  if (!is_valid_endpoint_guid(guid)) {
    return false;
  }
  RegKey key;
  return open_read(endpoint_path(guid), key) == ERROR_SUCCESS;
}

bool read_fx_values(const std::wstring& guid, FxValues& out,
                    std::wstring& error) {
  if (!is_valid_endpoint_guid(guid)) {
    error = L"not an endpoint id: " + guid;
    return false;
  }
  out = FxValues();
  RegKey key;
  const LSTATUS opened = open_read(fx_path(guid), key);
  if (opened == ERROR_FILE_NOT_FOUND) {
    // An endpoint with no effects registered at all. Every value is absent,
    // which is exactly what the caller was told.
    return true;
  }
  if (opened != ERROR_SUCCESS) {
    error = L"could not open the effect properties of " + guid + L": " +
            describe_error(static_cast<unsigned long>(opened));
    return false;
  }
  for (int slot = 0; slot < kSlotCount; ++slot) {
    if (!read_single(key.get(), value_name(kFxProperty, kSinglePid[slot]),
                     out.single[slot], error) ||
        !read_list(key.get(), value_name(kFxProperty, kCompositePid[slot]),
                   out.composite[slot], &out.composite_was_sz[slot], error) ||
        !read_list(key.get(), value_name(kModeProperty, kModePid[slot]),
                   out.modes[slot], nullptr, error)) {
      return false;
    }
  }
  for (int slot = 0; slot < kLegacyCount; ++slot) {
    if (!read_single(key.get(), value_name(kFxProperty, kLegacyPid[slot]),
                     out.legacy[slot], error)) {
      return false;
    }
  }
  return true;
}

bool write_fx_values(const std::wstring& guid, const FxValues& before,
                     const FxValues& after, std::wstring& error) {
  if (!is_valid_endpoint_guid(guid)) {
    error = L"not an endpoint id: " + guid;
    return false;
  }
  // The guarantee, checked rather than assumed. If a plan ever proposes an
  // edit to the vendor's own single or legacy values, nothing is written at
  // all — a partial write to an endpoint's effect chain is worse than none.
  for (int slot = 0; slot < kSlotCount; ++slot) {
    if (before.single[slot] != after.single[slot]) {
      error = L"refusing to change the single effect values of " + guid;
      return false;
    }
  }
  for (int slot = 0; slot < kLegacyCount; ++slot) {
    if (before.legacy[slot] != after.legacy[slot]) {
      error = L"refusing to change the legacy effect values of " + guid;
      return false;
    }
  }

  RegKey key;
  const LSTATUS opened = create_write(fx_path(guid), key);
  if (opened != ERROR_SUCCESS) {
    error = L"could not open the effect properties of " + guid + L": " +
            describe_error(static_cast<unsigned long>(opened));
    return false;
  }
  for (int slot = 0; slot < kSlotCount; ++slot) {
    // The value type is part of the value: a slot whose content is unchanged
    // but which has to go back from `REG_MULTI_SZ` to `REG_SZ` is a slot this
    // program still owes the vendor a write for.
    const bool as_sz = wants_sz(after, slot);
    if (before.composite[slot] != after.composite[slot] ||
        as_sz != wants_sz(before, slot)) {
      const std::wstring name = value_name(kFxProperty, kCompositePid[slot]);
      const LSTATUS written =
          apply_list(key.get(), name, after.composite[slot], as_sz);
      if (written != ERROR_SUCCESS) {
        error = L"could not write " + name + L": " +
                describe_error(static_cast<unsigned long>(written));
        return false;
      }
    }
    if (before.modes[slot] != after.modes[slot]) {
      const std::wstring name = value_name(kModeProperty, kModePid[slot]);
      const LSTATUS written =
          apply_list(key.get(), name, after.modes[slot], false);
      if (written != ERROR_SUCCESS) {
        error = L"could not write " + name + L": " +
                describe_error(static_cast<unsigned long>(written));
        return false;
      }
    }
  }
  return true;
}

}  // namespace fluideq_engine::setup
