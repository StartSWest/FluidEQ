/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "slot_memory.h"

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
    case Slot::Gfx:
      return L"gfx";
    case Slot::Lfx:
      return L"lfx";
    default:
      return L"efx";
  }
}

std::optional<Slot> slot_from_name(std::wstring_view name) {
  const Slot all[] = {Slot::Efx, Slot::Mfx, Slot::Sfx, Slot::Gfx, Slot::Lfx};
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
  const std::optional<std::wstring> text = read_utf8(path);
  if (!text.has_value()) {
    return std::nullopt;
  }
  // Anything but a slot's name is a file this program did not write, and no
  // memory.
  return slot_from_name(*text);
}

void remember_slot(const std::wstring& guid, Slot slot) {
  const std::wstring path = slot_memory_path(guid);
  if (path.empty() || !ensure_directory(slots_dir())) {
    return;
  }
  write_utf8(path, slot_name(slot));
}

}  // namespace fluideq_engine::setup
