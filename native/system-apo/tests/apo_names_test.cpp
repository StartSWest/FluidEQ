/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What an effect is called and who made it (`apo_names.h`), against what
 * Ivan's machine held on 2026-11-25, read back from its registry: the
 * Elevoc effect on the laptop's array and THX's on his Razer headsets, both
 * Windows 11 effects components with nothing under `HKLM\SOFTWARE\Classes`,
 * which the Mic tab listed as "Unnamed effect"; Realtek's machine-wide one;
 * Windows' own proxy on a Bluetooth headset. Each order of preference is
 * held beside the case one step down, so a resolver that skipped a source
 * fails on the step it skipped.
 */
#include "../setup/apo_names.h"

#include <cstdio>
#include <string>

using fluideq_engine::setup::ApoInfo;
using fluideq_engine::setup::ApoSources;
using fluideq_engine::setup::EffectKind;
using fluideq_engine::setup::effect_json;
using fluideq_engine::setup::resolve_apo;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

/** The Elevoc mode effect, read from its component's driver key. */
ApoSources elevoc() {
  ApoSources sources;
  sources.friendly_name = L"Elevoc Audio UAPO MFX";
  sources.copyright = L"Copyright (c) Elevoc Technology Co.,Ltd.";
  sources.class_name = L"ElevocUAPO MFX Class";
  sources.dll_path = L"C:\\Windows\\System32\\ElevocInstallDriver\\ElevocUAPO.dll";
  // The DLL's own description is only its file name again.
  sources.file_description = L"ElevocUAPO";
  sources.company = L"Elevoc Technology Co.,Ltd.";
  sources.file_version = L"1.0.1.984";
  sources.component = L"Elevoc Audio Effects Component";
  sources.provider = L"Elevoc Technology Co.,Ltd";
  return sources;
}

void the_friendly_name_comes_first() {
  std::printf("FriendlyName first, the component's provider as maker\n");
  const ApoInfo info = resolve_apo(elevoc());
  CHECK(info.name == L"Elevoc Audio UAPO MFX");
  // The provider outranks the version resource's company.
  CHECK(info.maker == L"Elevoc Technology Co.,Ltd");
  // Not "ElevocUAPO", which says nothing the file name does not: the
  // component it came in.
  CHECK(info.description == L"Elevoc Audio Effects Component");
  CHECK(info.file == L"ElevocUAPO.dll");
  CHECK(info.version == L"1.0.1.984");
  CHECK(!info.windows);
  // Control: with no provider, the company.
  ApoSources sources = elevoc();
  sources.provider.clear();
  CHECK(resolve_apo(sources).maker == L"Elevoc Technology Co.,Ltd.");
}

void the_class_name_stands_in() {
  std::printf("no FriendlyName: the class's own name, without \"Class\"\n");
  ApoSources sources = elevoc();
  // Blank counts as absent: a value of spaces is no name.
  sources.friendly_name = L"   ";
  CHECK(resolve_apo(sources).name == L"ElevocUAPO MFX");
}

void an_identifier_gives_way_to_words() {
  std::printf("Realtek's identifier gives way to its description\n");
  ApoSources sources;
  sources.friendly_name = L"CRtkRecEFX";
  sources.copyright = L"Copyright (c) Realtek Semiconductor Corp.";
  sources.class_name = L"RtkRecEFX Class";
  sources.dll_path =
      L"C:\\Windows\\System32\\DriverStore\\FileRepository\\RltkAPOU64.dll";
  sources.file_description = L"Realtek(r) LFX/GFX DSP component";
  sources.company = L"Realtek Semiconductor Corp.";
  const ApoInfo info = resolve_apo(sources);
  CHECK(info.name == L"Realtek(r) LFX/GFX DSP component");
  // Still said, as what Windows registered it under.
  CHECK(info.description == L"CRtkRecEFX");
  CHECK(info.maker == L"Realtek Semiconductor Corp.");
  // Control: with nothing made of words, the identifier is the name.
  sources.file_description.clear();
  const ApoInfo bare = resolve_apo(sources);
  CHECK(bare.name == L"CRtkRecEFX");
  CHECK(bare.description.empty());
}

void the_description_prefers_words() {
  std::printf("THX: the component over the DLL's bare module name\n");
  ApoSources sources;
  sources.friendly_name = L"THX Spatial Audio Mic APO (endpoint effect) for SSE2";
  sources.dll_path = L"C:\\Windows\\System32\\THXMicAPO-SSE2-v3.dll";
  sources.file_description = L"THXMicAPO";
  sources.company = L"Windows (R) Win 7 DDK provider";
  sources.component =
      L"THX Audio Processing Object Component for x64 SSE2 Architecture";
  sources.provider = L"THX";
  const ApoInfo info = resolve_apo(sources);
  CHECK(info.description == sources.component);
  CHECK(info.maker == L"THX");
  // Control: with no component, the module name is all there is to add.
  sources.component.clear();
  CHECK(resolve_apo(sources).description == L"THXMicAPO");
}

void the_version_resource_stands_in() {
  std::printf("no registry name: the DLL's description, its company\n");
  ApoSources sources;
  sources.dll_path = L"C:\\Windows\\System32\\THXMicAPO-SSE2-v3.dll";
  sources.file_description = L"THX Spatial Audio Mic APO";
  sources.company = L"THX Ltd.";
  sources.file_version = L"3.0.12.0";
  sources.copyright = L"Copyright (c) 2021 THX Inc. All Rights Reserved";
  const ApoInfo info = resolve_apo(sources);
  CHECK(info.name == L"THX Spatial Audio Mic APO");
  // The company outranks the copyright holder.
  CHECK(info.maker == L"THX Ltd.");
  // Already the name: not said twice.
  CHECK(info.description.empty());
  CHECK(info.file == L"THXMicAPO-SSE2-v3.dll");
  CHECK(info.version == L"3.0.12.0");
  // The driver kit's template company is nobody: the copyright's holder.
  sources.company = L"Windows (R) Win 7 DDK provider";
  CHECK(resolve_apo(sources).maker == L"THX Inc.");
  CHECK(!resolve_apo(sources).windows);
  // Control: with no description either, the component's name is last.
  sources.file_description.clear();
  sources.component = L"THX Spatial Audio Effects Component";
  CHECK(resolve_apo(sources).name == L"THX Spatial Audio Effects Component");
}

void nothing_on_record_is_no_name() {
  std::printf("nothing on record: no name, no maker, nothing made up\n");
  const ApoInfo info = resolve_apo(ApoSources{});
  CHECK(info.name.empty());
  CHECK(info.maker.empty());
  CHECK(info.description.empty());
  CHECK(info.file.empty());
  CHECK(!info.windows);
}

void the_copyright_names_the_maker_last() {
  std::printf("the copyright holder, without its words and years\n");
  ApoSources sources;
  sources.friendly_name = L"THX Spatial Audio Mic APO (endpoint effect) for SSE2";
  sources.copyright = L"Copyright (c) 2021 THX Inc. All Rights Reserved";
  CHECK(resolve_apo(sources).maker == L"THX Inc.");
  sources.copyright = L"Copyright (c) Realtek Semiconductor Corp.";
  CHECK(resolve_apo(sources).maker == L"Realtek Semiconductor Corp.");
  sources.copyright = L"(C) 2019-2024, Contoso Audio. All rights reserved.";
  CHECK(resolve_apo(sources).maker == L"Contoso Audio.");
  // Control: the provider outranks it.
  sources.provider = L"Contoso";
  CHECK(resolve_apo(sources).maker == L"Contoso");
}

void microsoft_is_windows() {
  std::printf("Microsoft's own effects are part of Windows\n");
  ApoSources sources;
  sources.friendly_name = L"Microsoft Audio Proxy Discover Effects APO";
  sources.copyright = L"Copyright Microsoft";
  sources.dll_path = L"C:\\Windows\\System32\\MsApoFxProxy.dll";
  sources.company = L"Microsoft Corporation";
  CHECK(resolve_apo(sources).windows);
  // From the copyright alone too.
  sources.company.clear();
  CHECK(resolve_apo(sources).maker == L"Microsoft");
  CHECK(resolve_apo(sources).windows);
  // Control: Realtek's is not.
  sources.company = L"Realtek Semiconductor Corp.";
  CHECK(!resolve_apo(sources).windows);
}

void the_json_carries_everything() {
  std::printf("one effect's JSON: every field, escaped, with its kind\n");
  ApoInfo info;
  info.name = L"Quote \" and \\ back";
  info.maker = L"Realtek";
  info.file = L"RltkAPOU64.dll";
  info.version = L"13.0.6000.1";
  CHECK(effect_json(L"{AB3B404A-B18F-4b4f-B91F-77F2DE95EB18}",
                    EffectKind::Endpoint, info) ==
        L"{\"clsid\":\"{AB3B404A-B18F-4b4f-B91F-77F2DE95EB18}\","
        L"\"name\":\"Quote \\\" and \\\\ back\",\"maker\":\"Realtek\","
        L"\"description\":\"\",\"file\":\"RltkAPOU64.dll\","
        L"\"version\":\"13.0.6000.1\",\"windows\":false,\"kind\":\"endpoint\"}");
  info.windows = true;
  const std::wstring stream = effect_json(L"{X}", EffectKind::Stream, info);
  CHECK(stream.find(L"\"windows\":true,\"kind\":\"stream\"}") !=
        std::wstring::npos);
  CHECK(effect_json(L"{X}", EffectKind::Mode, info).find(L"\"kind\":\"mode\"") !=
        std::wstring::npos);
}

}  // namespace

int main() {
  the_friendly_name_comes_first();
  the_class_name_stands_in();
  an_identifier_gives_way_to_words();
  the_description_prefers_words();
  the_version_resource_stands_in();
  nothing_on_record_is_no_name();
  the_copyright_names_the_maker_last();
  microsoft_is_windows();
  the_json_carries_everything();
  if (g_failures != 0) {
    std::printf("%d failure(s)\n", g_failures);
    return 1;
  }
  std::printf("all passed\n");
  return 0;
}
