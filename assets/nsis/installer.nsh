; Equalizer APO, installed and removed alongside FluidEQ.
;
; FluidEQ writes Equalizer APO's configuration file; APO is the thing that
; actually processes the audio. Without it the app opens and does nothing, so
; the installer carries APO with it. Nobody is sent to a website to hunt for a
; download.
;
; APO's own installer is run, visibly and unmodified. That is deliberate and it
; is not laziness:
;
;   - APO attaches itself to individual audio endpoints, and its Device
;     Selector is where you say which ones. Installed silently it would attach
;     to nothing and the equaliser would appear broken.
;   - It needs a restart to take effect, and its installer is what says so.
;   - Modifying somebody else's GPL installer makes us a modifier with
;     obligations to mark the changes. Running it with no arguments is not
;     modification.
;
; Equalizer APO is GPL-2.0-or-later, copyright Jonas Thedering. Its licence is
; installed beside ours in resources/licenses, and the corresponding source is
; published with every FluidEQ release — see CLAUDE.md, which lists it as a
; required asset.

; Write a line to the install log.
;
; DetailPrint is useless here: a one-click installer hides its detail pane, so
; every message about what happened during setup went nowhere. When somebody
; reports "it did not offer to install Equalizer APO" on a machine nobody can
; attach a debugger to, this file is the only evidence there is.
;
; Beside the app's own logs, so there is one place to ask for.
!macro ApoLog Text
  CreateDirectory "$APPDATA\FluidEQ\logs"
  FileOpen $9 "$APPDATA\FluidEQ\logs\install.log" a
  FileSeek $9 0 END
  FileWrite $9 "${Text}$\r$\n"
  FileClose $9
!macroend

; Is Equalizer APO installed? Answer in $0, empty if not.
;
; SetRegView 64 is the entire point of this being a macro rather than two
; lines. NSIS is a 32-bit process, so HKLM\Software\... is silently redirected
; into WOW6432Node — and Equalizer APO x64 registers in the native view, where
; a redirected read can never see it. Without this the check always says "not
; installed": setup would re-run APO over a working installation, and the
; uninstaller could never find the uninstall string it needs.
!macro ReadApoUninstallString
  SetRegView 64
  ReadRegStr $0 HKLM \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\EqualizerAPO" \
    "UninstallString"
  ${If} $0 == ""
    ; A 32-bit APO on a 32-bit Windows, or an older build that registered in
    ; the redirected view.
    SetRegView 32
    ReadRegStr $0 HKLM \
      "Software\Microsoft\Windows\CurrentVersion\Uninstall\EqualizerAPO" \
      "UninstallString"
  ${EndIf}
  SetRegView Default
!macroend

!macro customInstall
  ; Nothing identifying goes in this file. Ever.
  ;
  ; It exists to be sent to somebody when setup misbehaves, so it must be safe
  ; to send without reading it first. `$INSTDIR` used to be written here and it
  ; should not have been: a per-user install puts it under C:\Users\<name>,
  ; which is the account name and very often a real one.
  ;
  ; Nothing is lost. What matters for diagnosis is whether the pieces were
  ; where they should be, not the absolute path they were at — and the layout
  ; under the install directory is fixed and already known from the build.
  !insertmacro ApoLog "--- FluidEQ ${VERSION} install ---"

  ; Already there? Leave it entirely alone. Plenty of people arrive at FluidEQ
  ; because they already use Equalizer APO, quite possibly a newer build than
  ; the one bundled here, and with devices already configured. Running the
  ; installer over that would be an unasked-for downgrade.
  !insertmacro ReadApoUninstallString
  ${If} $0 != ""
    !insertmacro ApoLog "Equalizer APO already installed - leaving it alone."
    Goto apoDone
  ${EndIf}
  !insertmacro ApoLog "Equalizer APO not found in the registry."

  ; The bundled installer has to actually be on disk. It is placed by
  ; extraResources and extracted before this macro runs, but a filter typo or a
  ; build that skipped the fetch would leave it missing — and silently doing
  ; nothing is exactly the failure that is impossible to diagnose remotely.
  ${IfNot} ${FileExists} "$INSTDIR\resources\equalizer-apo\equalizer-apo-setup.exe"
    !insertmacro ApoLog "MISSING: resources\equalizer-apo\equalizer-apo-setup.exe"
    MessageBox MB_OK|MB_ICONEXCLAMATION \
      "This build of FluidEQ is missing its copy of the Equalizer APO \
installer. FluidEQ will install, but it cannot process audio until Equalizer \
APO is installed separately."
    Goto apoDone
  ${EndIf}

  ; A silent FluidEQ install is an unattended one, and APO's installer needs
  ; someone present to choose devices. The bundled copy stays in the install
  ; directory either way, so it can still be run by hand afterwards from the
  ; resources\equalizer-apo folder.
  ${If} ${Silent}
    !insertmacro ApoLog "Silent install - skipping Equalizer APO."
    Goto apoDone
  ${EndIf}

  MessageBox MB_YESNO|MB_ICONQUESTION \
    "FluidEQ needs Equalizer APO to process audio. It is included with this \
installer - nothing will be downloaded.$\r$\n$\r$\nIts setup will now open so \
you can choose which audio devices to equalise. Your computer will need to \
restart afterwards.$\r$\n$\r$\nInstall Equalizer APO now?" \
    /SD IDYES IDNO apoDeclined

  !insertmacro ApoLog "Running the Equalizer APO installer..."

  ; ExecShellWait, NOT ExecWait. This is the whole reason the first attempt
  ; silently did nothing.
  ;
  ; FluidEQ installs per-user and therefore runs unelevated. Equalizer APO's
  ; installer is manifested `requireAdministrator`. `ExecWait` calls
  ; CreateProcess, which does not elevate and cannot: it simply fails with
  ; ERROR_ELEVATION_REQUIRED (740) and returns immediately. The prompt appeared,
  ; the user said yes, nothing opened, and FluidEQ launched over the top of it.
  ;
  ; Only ShellExecute honours the manifest and raises the UAC dialog, and
  ; ExecShellWait is how NSIS reaches it. The `runas` verb asks for elevation
  ; explicitly rather than relying on the manifest being read.
  ;
  ; It reports failure through the error flag rather than an exit code, so
  ; there is no code to record — declining UAC and failing to launch look the
  ; same from here. Both mean APO did not get installed, which is what the app
  ; needs to know.
  ClearErrors
  ExecShellWait "runas" \
    "$INSTDIR\resources\equalizer-apo\equalizer-apo-setup.exe" "" SW_SHOWNORMAL
  ${If} ${Errors}
    !insertmacro ApoLog "Could not start the Equalizer APO installer (UAC declined, or launch failed)."
    MessageBox MB_OK|MB_ICONINFORMATION \
      "Equalizer APO was not installed - administrator permission is \
required.$\r$\n$\r$\nFluidEQ will still install. You can install Equalizer APO \
at any time from the button inside the app."
  ${Else}
    !insertmacro ApoLog "Equalizer APO setup finished."
  ${EndIf}
  Goto apoDone

  apoDeclined:
    !insertmacro ApoLog "Equalizer APO declined by the user."

  apoDone:
!macroend

!macro customUnInstall
  ; An update runs the old version's uninstaller before installing the new
  ; one. Asking whether to tear out the audio engine in the middle of that is
  ; both alarming and wrong, so this only runs on a real uninstall.
  ${IfNot} ${isUpdated}
    !insertmacro ReadApoUninstallString
    ${If} $0 != ""
      ; Defaults to NO, and says why. Equalizer APO is a system-wide audio
      ; component: Peace, its own Configuration Editor, and anything else
      ; built on it stop working the moment it goes. Removing somebody's audio
      ; stack because they uninstalled one front end would be a nasty
      ; surprise, so the safe answer is the one they get by pressing Enter.
      MessageBox MB_YESNO|MB_ICONQUESTION \
        "Also uninstall Equalizer APO?$\r$\n$\r$\nIt is a system-wide audio \
component, and other applications - such as Peace - may be using it. If you \
are unsure, choose No.$\r$\n$\r$\nYour equaliser settings will be removed \
either way." \
        /SD IDNO IDNO apoKept

      !insertmacro ApoLog "Running the Equalizer APO uninstaller."
      ; ExecShellWait for the same reason as the install side: APO's
      ; uninstaller needs administrator and this uninstaller does not have it,
      ; so CreateProcess would fail with ERROR_ELEVATION_REQUIRED and leave
      ; APO installed while appearing to have removed it.
      ;
      ; The registry value is a full command line and may carry arguments, so
      ; quotes around it are stripped and it is handed over as written.
      ClearErrors
      ExecShellWait "runas" "$0" "" SW_SHOWNORMAL
      ${If} ${Errors}
        !insertmacro ApoLog "Could not start the Equalizer APO uninstaller."
        MessageBox MB_OK|MB_ICONINFORMATION \
          "Equalizer APO could not be removed - administrator permission is \
required. You can uninstall it from Windows Settings at any time."
      ${EndIf}
      Goto apoRemoved

      apoKept:
        !insertmacro ApoLog "Leaving Equalizer APO installed."

      apoRemoved:
    ${EndIf}
  ${EndIf}
!macroend
