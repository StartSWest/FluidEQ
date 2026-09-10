/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "com_paths.h"

namespace fluideq_engine::setup {

const wchar_t kEngineClsid[] = L"{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}";

namespace {

const wchar_t kClassesPath[] = L"SOFTWARE\\Classes\\CLSID";
const wchar_t kApoPath[] =
    L"SOFTWARE\\Classes\\AudioEngine\\AudioProcessingObjects";
const wchar_t kMisplacedApoPath[] =
    L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Audio"
    L"\\AudioProcessingObjects";

}  // namespace

std::wstring clsid_registration_path() {
  return std::wstring(kClassesPath) + L"\\" + kEngineClsid;
}

std::wstring apo_registration_path() {
  return std::wstring(kApoPath) + L"\\" + kEngineClsid;
}

std::wstring misplaced_apo_record_path() {
  return std::wstring(kMisplacedApoPath) + L"\\" + kEngineClsid;
}

}  // namespace fluideq_engine::setup
