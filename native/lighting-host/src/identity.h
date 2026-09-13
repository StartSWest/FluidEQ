/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

// The helper's Windows package identity: what lets it light devices while
// FluidEQ is behind other windows.
//
// Windows' Dynamic Lighting gives a background app the lamps only when the app
// has package identity and declares the lighting extension. FluidEQ is not a
// packaged app, so it borrows identity the way Razer Synapse does on the same
// machines: a small signed package that contains no files of its own
// ("packaging with external location") names this exe, in the folder it was
// installed to, as its application. Registered per user, without elevation,
// by the app when lighting is first switched on; removed by the uninstaller.
//
//   identity status   <package name>                 one JSON line, exit 0
//   identity register <package.msix> <install folder> exit 0 / 3
//   identity remove   <package name>                 exit 0 / 3
//
// The exe carries the other half — an `<msix>` element in its embedded
// manifest naming the same package, publisher and application — which is why
// the publisher is fixed when the exe is built (`lighting-host.manifest.in`).

namespace fluideq_lighting {

// Shared with the app (`lightingIdentity.ts`) and the uninstaller
// (`installer.nsh`); the same meanings as the engine's setup helper.
inline constexpr int kExitOk = 0;
inline constexpr int kExitUsage = 1;
inline constexpr int kExitFailed = 3;

// This process runs with the identity described above.
bool has_package_identity();

int identity_command(int argc, wchar_t** argv);

}  // namespace fluideq_lighting
