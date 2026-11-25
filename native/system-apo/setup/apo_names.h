/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What an audio effect is called, who made it and what file it is, from
 * everything Windows keeps about its class id.
 *
 * The status named every effect from `HKCR\CLSID\{…}` alone, and the Mic
 * tab listed Ivan's laptop array and his Razer headsets as "Unnamed effect"
 * (2026-11-25). Both effects are installed the Windows 11 way, as an audio
 * effects *component*: a software device of the AudioProcessingObject class
 * whose driver registers the class in its own key,
 * `HKLM\SYSTEM\CurrentControlSet\Control\Class\{5989fce8-…}\NNNN`, with
 * `AudioEngine\AudioProcessingObjects\{…}` (FriendlyName, Copyright) and
 * `Classes\CLSID\{…}` beside it — nothing under `HKLM\SOFTWARE\Classes` at
 * all. On that machine: "Elevoc Audio UAPO MFX" by Elevoc Technology on the
 * array, "THX Spatial Audio Mic APO (endpoint effect)" by THX on the
 * headsets. An effect installed the older way keeps its name in the same
 * two keys under `HKLM\SOFTWARE\Classes` ("CRtkRecEFX", Realtek).
 *
 * Pure: the sources come from `read_apo_sources` (`apo_lookup.h`), so the
 * order of preference is tested on fixtures.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_APO_NAMES_H
#define FLUIDEQ_ENGINE_SETUP_APO_NAMES_H

#include <string>
#include <string_view>

namespace fluideq_engine::setup {

/** Everything read about one class id; any of it may be empty. */
struct ApoSources {
  /** `AudioEngine\AudioProcessingObjects\{…}`'s FriendlyName. */
  std::wstring friendly_name;
  /** The same key's Copyright, which is often the only maker on record. */
  std::wstring copyright;
  /** `CLSID\{…}`'s default value: the COM class's own name. */
  std::wstring class_name;
  /** `CLSID\{…}\InprocServer32`'s default value, environment expanded. */
  std::wstring dll_path;
  /** The DLL's version resource: FileDescription, CompanyName, version. */
  std::wstring file_description;
  std::wstring company;
  std::wstring file_version;
  /** The effects component's driver, when the class came from one. */
  std::wstring component;
  std::wstring provider;
};

/** What the Mic tab shows for one effect. */
struct ApoInfo {
  /** Empty only when Windows has no name for it anywhere. */
  std::wstring name;
  std::wstring maker;
  /** A second description, when one says something the name does not. */
  std::wstring description;
  /** The DLL's file name, without its folder. */
  std::wstring file;
  std::wstring version;
  /** Part of Windows: Microsoft made it. */
  bool windows = false;
};

/**
 * The name: FriendlyName, then the class's own name without " Class", then
 * the DLL's description, then the component's — the first of them made of
 * words, so Realtek's "CRtkRecEFX" gives way to "Realtek(r) LFX/GFX DSP
 * component" and becomes the description instead; an identifier only when
 * nothing else is on record. The maker: the component driver's provider,
 * then the DLL's CompanyName unless the driver kit's template wrote it, then
 * the Copyright line without its "Copyright (c) 2021" and "All Rights
 * Reserved". Blank-only values count as absent; nothing is ever made up.
 */
ApoInfo resolve_apo(const ApoSources& sources);

/** Where an effect runs, by the slot Windows reads it from. */
enum class EffectKind {
  /** SFX, or the pre-8.1 LFX: on each app's stream. */
  Stream,
  /** MFX: on one processing mode, such as calls. */
  Mode,
  /** EFX, or the pre-8.1 GFX: on everything the endpoint carries. */
  Endpoint,
};

const wchar_t* effect_kind_name(EffectKind kind);

/**
 * One effect as the status lists it, braces included:
 * `{"clsid":…,"name":…,"maker":…,"description":…,"file":…,"version":…,
 * "windows":false,"kind":"mode"}`.
 */
std::wstring effect_json(std::wstring_view clsid, EffectKind kind,
                         const ApoInfo& info);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_APO_NAMES_H
