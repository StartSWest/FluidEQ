; The audio engine, chosen at installation and removed at uninstallation.
;
; FluidEQ writes an equaliser configuration file; something inside Windows'
; audio pipeline has to read it and process the sound. Two things can:
;
;   - The FluidEQ Audio Processing Engine, built in this repository and shipped
;     in resources\native. It sits after the sound card's own effects, so
;     vendor panels keep working, and it needs no reboot.
;   - Equalizer APO, the classic third-party engine, carried in
;     resources\equalizer-apo. It runs custom commands, Peace and VST plugins,
;     takes over the sound card's effect slot, and needs a restart.
;
; Only one of them is ever installed here, because only one of them can own the
; configuration the app writes. The choice is a page rather than a yes/no box:
; a question with two real answers and a consequence each is not a question a
; message box can ask.
;
; Both installers are run visibly-elevated with ExecShellWait "runas". APO's
; own installer is run unmodified, and that is deliberate rather than laziness:
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
; installed beside ours in resources/assets/licenses — the assets directory
; keeps its own name on the way in, so it is not resources/licenses — and the
; corresponding source archive is published alongside every FluidEQ release.
; That archive is a licence obligation rather than a courtesy; fetch the one
; matching the pinned version with `pnpm fetch-apo:source`.

; The engine page, declared here at file scope rather than through
; electron-builder's `customPageAfterChangeDir` hook.
;
; That hook is the documented place for a page after the directory page, and it
; is the wrong one for this installer: app-builder-lib only inserts it from
; `templates/nsis/assistedInstaller.nsh`, which is included when `ONE_CLICK` is
; NOT defined. FluidEQ is a one-click installer (`build.nsis.oneClick` is left
; at its default of true), so `oneClick.nsh` is included instead and
; `customPageAfterChangeDir` is never reached. Defining it would have compiled
; cleanly and shown nothing — the silent kind of wrong.
;
; What the one-click template does give us is position: this file is included
; as the shared header, ahead of `installer.nsi` and therefore ahead of every
; `MUI_PAGE_*` macro. A `Page` declared here is the first page in the list, so
; the engine question comes before the licence page and before the files are
; extracted, which is when it still has to be answered. The functions it names
; are defined further down in `customHeader`, where MUI2 and nsDialogs have
; been included; NSIS resolves function references at the end of compilation,
; so naming them here is fine.
;
; Guarded because `installer.nsi` is compiled a second time with
; BUILD_UNINSTALLER to produce the uninstaller, and that build must not grow an
; installer page.
!ifndef BUILD_UNINSTALLER
  Page custom EnginePageCreate EnginePageLeave
!endif

; Write a line to the install log.
;
; DetailPrint is useless here: a one-click installer hides its detail pane, so
; every message about what happened during setup went nowhere. When somebody
; reports "it did not offer to install an audio engine" on a machine nobody can
; attach a debugger to, this file is the only evidence there is.
;
; Beside the app's own logs, so there is one place to ask for.
!macro InstallLog Text
  CreateDirectory "$APPDATA\FluidEQ\logs"
  FileOpen $9 "$APPDATA\FluidEQ\logs\install.log" a
  FileSeek $9 0 END
  FileWrite $9 "${Text}$\r$\n"
  FileClose $9
!macroend

; Record the engine the user chose, where the app reads it on every launch.
;
; The shape is `IAudioEnginePreference` from src/common/audioEngine.ts and it
; is parsed by `loadAudioEnginePreference`, which answers "never chosen" for
; anything it cannot read — so a file written wrong here is indistinguishable
; from no file at all, and the app would ask again on first launch.
;
; FileWrite is safe for this despite the installer being Unicode: measured on
; NSIS 3.0.4.1, a Unicode installer's FileWrite emits the string as bytes in
; the system code page, not UTF-16, and this document is pure ASCII, which
; every Windows code page agrees on. Hence no BOM and no UTF-16, which is what
; `fs.readFileSync(path, 'utf8')` needs.
!macro WriteEngineChoice Engine
  CreateDirectory "$APPDATA\FluidEQ"
  ClearErrors
  FileOpen $9 "$APPDATA\FluidEQ\audio-engine.json" w
  ${If} ${Errors}
    !insertmacro InstallLog "Could not write audio-engine.json; the app will ask instead."
  ${Else}
    FileWrite $9 '{"version":1,"engine":"${Engine}"}'
    FileClose $9
    !insertmacro InstallLog "Engine preference written: ${Engine}."
  ${EndIf}
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
  ; Default, not 64, and that is safe here: FluidEQ installs per-user, so
  ; `SHELL_CONTEXT` is HKCU for the rest of this run, and HKCU is not
  ; WOW64-redirected — there is no 64-bit view of it to get back to.
  SetRegView Default
!macroend

; The ten translations. The charset is named at the include because this file
; is read in the machine's ANSI code page otherwise; engine-strings.nsh says
; the rest.
!include /CHARSET=UTF8 "${__FILEDIR__}\engine-strings.nsh"

; Everything that belongs to the page, and the strings behind it.
;
; `customHeader` is where `installer.nsi` lets a script add its own top-level
; declarations, and it is inserted immediately after `addLangs` — the earliest
; point at which every language table exists. A LangString for a language that
; has not been loaded is a warning, and electron-builder runs makensis with
; -WX, so a warning is a failed build.
;
; It is also inserted in the BUILD_UNINSTALLER pass, which is what the
; uninstaller needs for `$(EngineNotRemoved)`. The page itself is fenced out of
; that pass: an uninstaller has no use for a Var, a dialog or a function that
; asks which engine to install.
!macro customHeader
  !insertmacro EngineLangStrings

  !ifndef BUILD_UNINSTALLER
    !include nsDialogs.nsh

    ; "fluid", "apo", or "keep" — nothing was asked, so nothing is changed.
    Var EngineChoice
    Var EngineDialog
    Var EngineRadioFluid
    Var EngineRadioApo

    ; The page. Coordinates are dialog units, which is what makes the same
    ; layout hold under Japanese and Simplified Chinese: those language files
    ; ask for a 9pt font, every dialog unit grows with it, and so does the
    ; 300x140 unit area nsDialogs is given.
    ;
    ; The label heights are measured rather than guessed. At 288 units wide the
    ; longest translation of each hint wraps to four lines (Spanish, French,
    ; Russian and German for Equalizer APO), and Devanagari needs 15px a line
    ; where Latin needs 13 — so 34 units (55px) is three Hindi lines or four
    ; Latin ones with room left, and the "why" line needs 28. The whole column
    ; ends at 134 of the 140 available.
    Function EnginePageCreate
      ; A silent install is an unattended one and there is nobody to ask; an
      ; update is not the moment to ask, because FluidEQ applies updates by
      ; closing itself and running this installer with no window and often
      ; nobody at the machine. Both leave the choice at "keep", so the engine
      ; already on the machine is left exactly as it is.
      ${If} ${Silent}
      ${OrIf} ${isUpdated}
        Abort
      ${EndIf}

      ; The app has already answered this question — either from its own engine
      ; dialog or from a previous installation. Asking again would let a
      ; re-install silently move somebody's audio to the other engine.
      ${If} ${FileExists} "$APPDATA\FluidEQ\audio-engine.json"
        Abort
      ${EndIf}

      !insertmacro MUI_HEADER_TEXT "$(EngineTitle)" "$(EngineSubtitle)"

      nsDialogs::Create 1018
      Pop $EngineDialog
      ${If} $EngineDialog == error
        ; No dialog means no answer, and the choice stays at "keep": neither
        ; engine is installed and the app asks on first launch, which is
        ; better than picking one on somebody's behalf.
        Abort
      ${EndIf}

      ${NSD_CreateRadioButton} 0u 0u 300u 12u "$(EngineFluid)"
      Pop $EngineRadioFluid
      ; WS_GROUP opens the radio group here. The hint labels sit between the
      ; two buttons in z-order, and without a group boundary of our own the
      ; auto-radio walk would be free to run into whatever the dialog holds.
      ${NSD_AddStyle} $EngineRadioFluid ${WS_GROUP}
      ${NSD_Check} $EngineRadioFluid

      ${NSD_CreateLabel} 12u 14u 288u 34u "$(EngineFluidHint)"
      Pop $0

      ${NSD_CreateRadioButton} 0u 52u 300u 12u "$(EngineApo)"
      Pop $EngineRadioApo

      ${NSD_CreateLabel} 12u 66u 288u 34u "$(EngineApoHint)"
      Pop $0

      ; Closes the radio group, and says why the consent prompt is coming.
      ${NSD_CreateLabel} 0u 106u 300u 28u "$(EngineWhy)"
      Pop $0
      ${NSD_AddStyle} $0 ${WS_GROUP}

      nsDialogs::Show
    FunctionEnd

    Function EnginePageLeave
      ${NSD_GetState} $EngineRadioApo $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $EngineChoice "apo"
      ${Else}
        StrCpy $EngineChoice "fluid"
      ${EndIf}
    FunctionEnd
  !endif
!macroend

; NSIS variables start empty, and empty is not one of the three answers.
; Silent installs never run a page at all, so this is the only place the
; default can be set for them.
!macro customInit
  StrCpy $EngineChoice "keep"
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
  !insertmacro InstallLog "--- FluidEQ ${VERSION} install ---"

  ${If} $EngineChoice == "keep"
    ; A silent install, an update, or a machine that has already answered.
    ; Neither engine is touched and no preference is written, so whatever is
    ; installed keeps processing the audio and the app keeps its own answer.
    !insertmacro InstallLog "No engine question was asked - leaving the audio engine as it is."

  ${ElseIf} $EngineChoice == "fluid"
    ; The engine has to actually be on disk. It is placed by extraResources
    ; and extracted before this macro runs, but a filter typo or a build that
    ; skipped `build:native-dsp` would leave it missing — and silently doing
    ; nothing is exactly the failure that is impossible to diagnose remotely.
    ${IfNot} ${FileExists} "$INSTDIR\resources\native\FluidEQ-Engine-Setup.exe"
      !insertmacro InstallLog "MISSING: resources\native\FluidEQ-Engine-Setup.exe"
      ; Said out loud in the log because the next line records a preference of
      ; "fluid" for an engine this build could not install, and the two
      ; together look like a contradiction to whoever reads it.
      !insertmacro InstallLog "Preference written as fluid despite the missing bundle - the app will offer the engine."
      MessageBox MB_OK|MB_ICONEXCLAMATION "$(EngineBundleMissing)"
    ${Else}
      !insertmacro InstallLog "Running the FluidEQ Engine setup..."

      ; ShellExecute, NOT CreateProcess. This is the whole reason the first
      ; attempt at the Equalizer APO side silently did nothing, and it applies
      ; unchanged here.
      ;
      ; FluidEQ installs per-user and therefore runs unelevated. Placing an APO
      ; inside Windows' audio stack needs administrator. `ExecWait` calls
      ; CreateProcess, which does not elevate and cannot: it fails with
      ; ERROR_ELEVATION_REQUIRED (740) and returns immediately, so nothing
      ; opens and setup carries on as though it had worked.
      ;
      ; Only ShellExecute honours the manifest and raises the UAC dialog. The
      ; `runas` verb asks for elevation explicitly rather than relying on the
      ; manifest being read.
      ;
      ; StdUtils rather than NSIS's own ExecShellWait, because ExecShellWait
      ; reports through the error flag alone: a helper that ran and failed and
      ; a helper that never started are the same event from there, and the
      ; install log could not tell them apart. The helper answers in its exit
      ; code — 0 done, 1 bad command line, 2 consent declined, 3 ran and failed
      ; (native/system-apo/setup/main.cpp) — and this is how that code is read.
      ; StdUtils.nsh is included by electron-builder's own shared header, ahead
      ; of this file, so the plug-in is already there for both passes.
      ;
      ; StdUtils hard-codes SW_SHOWNORMAL, which used to flash the helper's
      ; console window for the seconds it took. The helper is now a
      ; windowed-subsystem executable, so SW_SHOWNORMAL shows nothing at all -
      ; there is no window to normal-show.
      ${StdUtils.ExecShellWaitEx} $0 $1 \
        "$INSTDIR\resources\native\FluidEQ-Engine-Setup.exe" "runas" \
        "install --attach-all --restart-audio"
      ${If} $0 == "ok"
        ; Only "ok" carries a process handle; passing anything else to
        ; WaitForProcEx is undefined behaviour by its own documentation.
        ${StdUtils.WaitForProcEx} $2 $1
        ${If} $2 == "error"
          !insertmacro InstallLog "FluidEQ Engine setup ran, but its exit code could not be read."
        ${Else}
          !insertmacro InstallLog "FluidEQ Engine setup exited with code $2."
          ${If} $2 == 0
            !insertmacro InstallLog "FluidEQ Engine installed."
          ${ElseIf} $2 == 2
            !insertmacro InstallLog "The consent prompt was declined - the engine was not installed."
            MessageBox MB_OK|MB_ICONINFORMATION "$(EngineDeclined)"
          ${Else}
            !insertmacro InstallLog "The FluidEQ Engine setup ran and failed."
            MessageBox MB_OK|MB_ICONEXCLAMATION "$(EngineFailed)"
          ${EndIf}
        ${EndIf}
      ${ElseIf} $0 == "no_wait"
        ; ShellExecuteEx handed the file to a running instance instead of
        ; starting a process. Not reachable for an .exe, and recorded rather
        ; than assumed away.
        !insertmacro InstallLog "FluidEQ Engine setup started, but could not be waited for."
      ${Else}
        !insertmacro InstallLog "Engine setup could not start (UAC declined, or launch failed) - Win32 error $1."
        MessageBox MB_OK|MB_ICONINFORMATION "$(EngineDeclined)"
      ${EndIf}
    ${EndIf}

    ; Written even when the engine did not get installed. The preference is
    ; the answer to "which engine does this machine use", not to "did it work"
    ; — and it is what makes the app show its install button rather than ask
    ; the question all over again.
    !insertmacro WriteEngineChoice "fluid"

  ${ElseIf} $EngineChoice == "apo"
    ; Already there? Leave it entirely alone. Plenty of people arrive at
    ; FluidEQ because they already use Equalizer APO, quite possibly a newer
    ; build than the one bundled here, and with devices already configured.
    ; Running the installer over that would be an unasked-for downgrade.
    !insertmacro ReadApoUninstallString
    ${If} $0 != ""
      !insertmacro InstallLog "Equalizer APO already installed - leaving it alone."
    ${Else}
      !insertmacro InstallLog "Equalizer APO not found in the registry."

      ; Same reasoning as the engine above: the bundled installer has to be on
      ; disk, and a build that lost it must say so rather than do nothing.
      ${IfNot} ${FileExists} "$INSTDIR\resources\equalizer-apo\equalizer-apo-setup.exe"
        !insertmacro InstallLog "MISSING: resources\equalizer-apo\equalizer-apo-setup.exe"
        MessageBox MB_OK|MB_ICONEXCLAMATION \
          "This build of FluidEQ is missing its copy of the Equalizer APO \
installer. FluidEQ will install, but it cannot process audio until Equalizer \
APO is installed separately."
      ${Else}
        ; No yes/no box in front of this one any more: the page already asked,
        ; and asking the same question twice reads as setup not having heard
        ; the first answer.
        !insertmacro InstallLog "Running the Equalizer APO installer..."
        ClearErrors
        ExecShellWait "runas" \
          "$INSTDIR\resources\equalizer-apo\equalizer-apo-setup.exe" "" SW_SHOWNORMAL
        ${If} ${Errors}
          !insertmacro InstallLog "Could not start the Equalizer APO installer (UAC declined, or launch failed)."
          MessageBox MB_OK|MB_ICONINFORMATION \
            "Equalizer APO was not installed - administrator permission is \
required.$\r$\n$\r$\nFluidEQ will still install. You can install Equalizer APO \
at any time from the button inside the app."
        ${Else}
          !insertmacro InstallLog "Equalizer APO setup finished."
        ${EndIf}
      ${EndIf}
    ${EndIf}

    !insertmacro WriteEngineChoice "apo"
  ${EndIf}
!macroend

!macro customUnInstall
  ; An update runs the old version's uninstaller before installing the new
  ; one. Asking whether to tear out the audio engine in the middle of that is
  ; both alarming and wrong, so this only runs on a real uninstall.
  ${IfNot} ${isUpdated}
    ; Ours goes first, and without a question. The engine is a FluidEQ
    ; component that nothing else uses, and `uninstall` puts every output's
    ; effect list back to the backup it took before attaching — so leaving it
    ; behind would leave a DLL inside Windows' audio stack with nothing left
    ; to configure it.
    ;
    ; What decides is whether the engine is INSTALLED, not whether the helper
    ; that installs it is on disk. The helper ships in every build, so gating
    ; on it raised a consent prompt on every single uninstall — including for
    ; the people who chose Equalizer APO and the people the question was never
    ; put to — and, when they said no to a prompt for something they had never
    ; installed, told them to go and hand-run its uninstaller.
    ;
    ; `$PROGRAMFILES64` is where the DLL lands: `install_dir()` in
    ; native/system-apo/setup/fs.cpp resolves FOLDERID_ProgramFiles from a
    ; 64-bit process, and Program Files — unlike System32 — is not part of the
    ; WOW64 file redirection, so this 32-bit uninstaller reads the real
    ; directory without a `${DisableX64FSRedirection}` around it.
    ${IfNot} ${FileExists} "$PROGRAMFILES64\FluidEQ Engine\FluidEQ-Engine.dll"
      !insertmacro InstallLog "Engine not installed - nothing to remove."
    ${ElseIfNot} ${FileExists} "$INSTDIR\resources\native\FluidEQ-Engine-Setup.exe"
      ; The engine is in, and the only thing that can take it out again is
      ; missing from this installation. Logged and no more: it takes a broken
      ; build to reach, and the message that would fit here is one telling the
      ; user to run a file that is not there.
      !insertmacro InstallLog "Engine installed, but MISSING: resources\native\FluidEQ-Engine-Setup.exe - it cannot be removed from here."
    ${Else}
      !insertmacro InstallLog "Removing FluidEQ Engine..."
      ; ShellExecute for the same reason as the install side: detaching an APO
      ; needs administrator and this uninstaller does not have it, so
      ; CreateProcess would fail with ERROR_ELEVATION_REQUIRED and leave the
      ; engine installed while appearing to have removed it. StdUtils for the
      ; same reason too — the exit code is the only thing that distinguishes a
      ; declined prompt from a removal that ran and failed.
      ${StdUtils.ExecShellWaitEx} $0 $1 \
        "$INSTDIR\resources\native\FluidEQ-Engine-Setup.exe" "runas" "uninstall"
      ${If} $0 == "ok"
        ${StdUtils.WaitForProcEx} $2 $1
        ${If} $2 == "error"
          !insertmacro InstallLog "FluidEQ Engine setup ran, but its exit code could not be read."
        ${Else}
          !insertmacro InstallLog "FluidEQ Engine setup exited with code $2."
          ${If} $2 == 0
            !insertmacro InstallLog "FluidEQ Engine removed."
          ${ElseIf} $2 == 2
            !insertmacro InstallLog "The consent prompt was declined - the engine is still installed."
            MessageBox MB_OK|MB_ICONINFORMATION "$(EngineNotRemoved)"
          ${Else}
            !insertmacro InstallLog "The removal ran and failed - the engine is still installed."
            MessageBox MB_OK|MB_ICONEXCLAMATION "$(EngineRemoveFailed)"
          ${EndIf}
        ${EndIf}
      ${ElseIf} $0 == "no_wait"
        !insertmacro InstallLog "FluidEQ Engine setup started, but could not be waited for."
      ${Else}
        !insertmacro InstallLog "The FluidEQ Engine could not be removed (UAC declined, or launch failed) - Win32 error $1."
        MessageBox MB_OK|MB_ICONINFORMATION "$(EngineNotRemoved)"
      ${EndIf}
    ${EndIf}

    !insertmacro ReadApoUninstallString
    ${If} $0 != ""
      ; No /SD, deliberately, and that is the only reason this question is ever
      ; seen. electron-builder's own `un.onInit` asks "are you sure you want to
      ; uninstall" and then runs `SetSilent silent` for the rest of the
      ; uninstall, so by the time this line executes ${Silent} is true on every
      ; ordinary one-click uninstall. A /SD default is exactly what NSIS
      ; answers with in that state — `my_MessageBox` in Source/exehead/util.c
      ; returns the default and never shows the box — so `/SD IDNO` meant the
      ; user was silently told No and APO was silently kept, every time.
      ; Without /SD the same code falls through to "no silent or no default,
      ; just show".
      ;
      ; What it costs: an uninstall genuinely run with /S, from a script or a
      ; management tool, now stops on this box. That is the price of ever
      ; asking at all, and it is the smaller of the two failures — a silent
      ; uninstall is rare here, and a question nobody can answer is a question
      ; that should not have been written.
      ;
      ; Defaults to NO, and says why. Equalizer APO is a system-wide audio
      ; component: Peace, its own Configuration Editor, and anything else
      ; built on it stop working the moment it goes. Removing somebody's audio
      ; stack because they uninstalled one front end would be a nasty
      ; surprise, so the safe answer is the one they get by pressing Enter.
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
        "Also uninstall Equalizer APO?$\r$\n$\r$\nIt is a system-wide audio \
component, and other applications - such as Peace - may be using it. If you \
are unsure, choose No.$\r$\n$\r$\nYour equaliser settings will be removed \
either way." \
        IDNO apoKept

      !insertmacro InstallLog "Running the Equalizer APO uninstaller."
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
        !insertmacro InstallLog "Could not start the Equalizer APO uninstaller."
        MessageBox MB_OK|MB_ICONINFORMATION \
          "Equalizer APO could not be removed - administrator permission is \
required. You can uninstall it from Windows Settings at any time."
      ${EndIf}
      Goto apoRemoved

      apoKept:
        !insertmacro InstallLog "Leaving Equalizer APO installed."

      apoRemoved:
    ${EndIf}
  ${EndIf}
!macroend
