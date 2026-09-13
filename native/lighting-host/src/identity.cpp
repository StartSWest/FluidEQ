/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "identity.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <appmodel.h>
#include <unknwn.h>
#include <winrt/Windows.ApplicationModel.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Foundation.Metadata.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Management.Deployment.h>

#include <cwchar>
#include <string>

#include "event_sink.h"
#include "json_text.h"

namespace fluideq_lighting {

namespace {

using winrt::Windows::ApplicationModel::Package;
using winrt::Windows::Foundation::Uri;
using winrt::Windows::Management::Deployment::AddPackageOptions;
using winrt::Windows::Management::Deployment::DeploymentResult;
using winrt::Windows::Management::Deployment::PackageManager;
using winrt::Windows::Management::Deployment::RegisterPackageOptions;

// Settings > System > For developers > Developer Mode. The only way Windows
// registers an identity package that nobody signed, which is what a
// development or unsigned copy of FluidEQ has.
bool developer_mode_on() {
  DWORD value = 0;
  DWORD size = sizeof(value);
  return RegGetValueW(
             HKEY_LOCAL_MACHINE,
             L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock",
             L"AllowDevelopmentWithoutDevLicense", RRF_RT_REG_DWORD, nullptr,
             &value, &size) == ERROR_SUCCESS &&
         value != 0;
}

std::string version_text(const Package& package) {
  const auto version = package.Id().Version();
  return std::to_string(version.Major) + "." + std::to_string(version.Minor) +
         "." + std::to_string(version.Build) + "." +
         std::to_string(version.Revision);
}

// Where Windows expects the exe to run from. The property arrived with the
// external-location feature itself (Windows 10 2004); on anything older the
// package could not have been registered in the first place.
std::string external_path(const Package& package) {
  if (!winrt::Windows::Foundation::Metadata::ApiInformation::IsPropertyPresent(
          L"Windows.ApplicationModel.Package", L"EffectiveExternalPath")) {
    return {};
  }
  return winrt::to_string(package.EffectiveExternalPath());
}

void report_failure(EventSink& sink, std::string_view what,
                    const DeploymentResult& result) {
  sink.write(JsonLine("identity-failed")
                 .text("step", what)
                 .integer("code", result.ExtendedErrorCode().value)
                 .text("detail", winrt::to_string(result.ErrorText()))
                 .finish());
}

void report_failure(EventSink& sink, std::string_view what,
                    const winrt::hresult_error& error) {
  sink.write(JsonLine("identity-failed")
                 .text("step", what)
                 .integer("code", error.code().value)
                 .text("detail", winrt::to_string(error.message()))
                 .finish());
}

int status(EventSink& sink, const wchar_t* name) {
  try {
    for (const auto& package : PackageManager().FindPackagesForUser(L"")) {
      if (package.Id().Name() != name) {
        continue;
      }
      sink.write(JsonLine("identity")
                     .boolean("registered", true)
                     .text("fullName", winrt::to_string(package.Id().FullName()))
                     .text("familyName",
                           winrt::to_string(package.Id().FamilyName()))
                     .text("version", version_text(package))
                     .text("location", external_path(package))
                     .boolean("developerMode", developer_mode_on())
                     .finish());
      return kExitOk;
    }
    sink.write(JsonLine("identity")
                   .boolean("registered", false)
                   .boolean("developerMode", developer_mode_on())
                   .finish());
    return kExitOk;
  } catch (const winrt::hresult_error& error) {
    report_failure(sink, "status", error);
    return kExitFailed;
  }
}

int register_package(EventSink& sink, const wchar_t* msix,
                     const wchar_t* folder) {
  try {
    AddPackageOptions options;
    options.ExternalLocationUri(Uri(folder));
    // The same version again (a repair) and an older one (a downgraded app)
    // both replace what is there: the package must always describe the exe
    // that is installed, not the newest one that ever was.
    options.ForceUpdateFromAnyVersion(true);
    // A lighting helper still running under the old registration is this
    // app's own, and the app restarts it after this returns.
    options.ForceTargetAppShutdown(true);
    const DeploymentResult result =
        PackageManager().AddPackageByUriAsync(Uri(msix), options).get();
    if (FAILED(result.ExtendedErrorCode().value)) {
      report_failure(sink, "register", result);
      return kExitFailed;
    }
    sink.write(JsonLine("identity-registered").finish());
    return kExitOk;
  } catch (const winrt::hresult_error& error) {
    report_failure(sink, "register", error);
    return kExitFailed;
  }
}

// A development or unsigned copy: the identity manifest registered straight
// from its folder, as Windows allows only with Developer Mode on — the route
// Microsoft's own `winapp create-debug-identity` takes. The same identity as
// the signed package, so the helper's embedded manifest matches either.
int register_development(EventSink& sink, const wchar_t* manifest,
                         const wchar_t* folder) {
  if (!developer_mode_on()) {
    sink.write(JsonLine("identity-failed")
                   .text("step", "register-dev")
                   .text("detail", "Developer Mode is off")
                   .finish());
    return kExitFailed;
  }
  try {
    RegisterPackageOptions options;
    options.ExternalLocationUri(Uri(folder));
    options.DeveloperMode(true);
    options.ForceUpdateFromAnyVersion(true);
    options.ForceTargetAppShutdown(true);
    const DeploymentResult result =
        PackageManager().RegisterPackageByUriAsync(Uri(manifest), options).get();
    if (FAILED(result.ExtendedErrorCode().value)) {
      report_failure(sink, "register-dev", result);
      return kExitFailed;
    }
    sink.write(JsonLine("identity-registered").finish());
    return kExitOk;
  } catch (const winrt::hresult_error& error) {
    report_failure(sink, "register-dev", error);
    return kExitFailed;
  }
}

int remove_package(EventSink& sink, const wchar_t* name) {
  try {
    PackageManager manager;
    int failures = 0;
    for (const auto& package : manager.FindPackagesForUser(L"")) {
      if (package.Id().Name() != name) {
        continue;
      }
      const DeploymentResult result =
          manager.RemovePackageAsync(package.Id().FullName()).get();
      if (FAILED(result.ExtendedErrorCode().value)) {
        report_failure(sink, "remove", result);
        ++failures;
      }
    }
    if (failures > 0) {
      return kExitFailed;
    }
    sink.write(JsonLine("identity-removed").finish());
    return kExitOk;
  } catch (const winrt::hresult_error& error) {
    report_failure(sink, "remove", error);
    return kExitFailed;
  }
}

}  // namespace

bool has_package_identity() {
  UINT32 length = 0;
  return GetCurrentPackageFullName(&length, nullptr) ==
         ERROR_INSUFFICIENT_BUFFER;
}

std::string package_family_name() {
  UINT32 length = 0;
  if (GetCurrentPackageFamilyName(&length, nullptr) !=
          ERROR_INSUFFICIENT_BUFFER ||
      length == 0) {
    return {};
  }
  std::wstring name(length, L'\0');
  if (GetCurrentPackageFamilyName(&length, name.data()) != ERROR_SUCCESS) {
    return {};
  }
  // The length counts the terminating null.
  name.resize(length > 0 ? length - 1 : 0);
  return winrt::to_string(name);
}

int identity_command(int argc, wchar_t** argv) {
  EventSink sink;
  if (argc == 2 && std::wcscmp(argv[0], L"status") == 0) {
    return status(sink, argv[1]);
  }
  if (argc == 3 && std::wcscmp(argv[0], L"register") == 0) {
    return register_package(sink, argv[1], argv[2]);
  }
  if (argc == 3 && std::wcscmp(argv[0], L"register-dev") == 0) {
    return register_development(sink, argv[1], argv[2]);
  }
  if (argc == 2 && std::wcscmp(argv[0], L"remove") == 0) {
    return remove_package(sink, argv[1]);
  }
  return kExitUsage;
}

}  // namespace fluideq_lighting
