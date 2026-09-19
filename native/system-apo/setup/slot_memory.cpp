/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "slot_memory.h"

#include <vector>

#include <optional>
#include <string>
#include <string_view>

#include "fs.h"
#include "registry.h"

namespace fluideq_engine::setup {

namespace {

std::wstring slots_dir() {
  const std::wstring root = engine_root();
  return root.empty() ? root : root + L"\\slots";
}

}  // namespace

const wchar_t* slot_name(Slot slot) {
  switch (slot) {
    case Slot::Mfx:
      return L"mfx";
    case Slot::Sfx:
      return L"sfx";
    case Slot::EfxSingle:
      return L"efx-single";
    case Slot::MfxSingle:
      return L"mfx-single";
    case Slot::SfxSingle:
      return L"sfx-single";
    case Slot::Gfx:
      return L"gfx";
    case Slot::Lfx:
      return L"lfx";
    default:
      return L"efx";
  }
}

std::optional<Slot> slot_from_name(std::wstring_view name) {
  const Slot all[] = {Slot::Efx,       Slot::Mfx,       Slot::Sfx,
                      Slot::EfxSingle, Slot::MfxSingle, Slot::SfxSingle,
                      Slot::Gfx,       Slot::Lfx};
  for (const Slot slot : all) {
    if (name == slot_name(slot)) {
      return slot;
    }
  }
  return std::nullopt;
}

std::wstring slot_memory_path(const std::wstring& guid) {
  // The guid check keeps this a file name: it is concatenated onto a
  // directory this program, running elevated, can write anywhere in.
  if (!is_valid_endpoint_guid(guid)) {
    return std::wstring();
  }
  const std::wstring directory = slots_dir();
  return directory.empty() ? directory : directory + L"\\" + guid + L".txt";
}

std::optional<Slot> remembered_slot(const std::wstring& guid) {
  const std::wstring path = slot_memory_path(guid);
  if (path.empty()) {
    return std::nullopt;
  }
  const std::vector<Slot> all = remembered_slots(guid);
  if (all.empty()) {
    return std::nullopt;
  }
  return all.back();
}

std::vector<Slot> remembered_slots(const std::wstring& guid) {
  std::vector<Slot> all;
  const std::wstring path = slot_memory_path(guid);
  if (path.empty()) {
    return all;
  }
  const std::optional<std::wstring> text = read_utf8(path);
  if (!text.has_value()) {
    return all;
  }
  // One name per line, and a file from an older helper is one line with no
  // newline at all. Anything that is not a slot's name is a line this
  // program did not write, and is passed over rather than ending the read.
  size_t at = 0;
  while (at <= text->size()) {
    size_t end = text->find_first_of(L"\r\n", at);
    if (end == std::wstring::npos) {
      end = text->size();
    }
    const std::wstring line = text->substr(at, end - at);
    if (!line.empty()) {
      const std::optional<Slot> slot = slot_from_name(line);
      if (slot.has_value()) {
        all.push_back(*slot);
      }
    }
    if (end == text->size()) {
      break;
    }
    at = end + 1;
  }
  return all;
}

void remember_slot(const std::wstring& guid, Slot slot) {
  const std::wstring path = slot_memory_path(guid);
  if (path.empty() || !ensure_directory(slots_dir())) {
    return;
  }
  std::vector<Slot> all = remembered_slots(guid);
  if (!all.empty() && all.back() == slot) {
    return;
  }
  all.push_back(slot);
  std::wstring text;
  for (const Slot one : all) {
    if (!text.empty()) {
      text += L'\n';
    }
    text += slot_name(one);
  }
  write_utf8(path, text);
}

}  // namespace fluideq_engine::setup
