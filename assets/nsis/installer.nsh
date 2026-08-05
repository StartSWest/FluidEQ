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

!macro customInstall
  ; Already there? Leave it entirely alone. Plenty of people arrive at FluidEQ
  ; because they already use Equalizer APO, quite possibly a newer build than
  ; the one bundled here, and with devices already configured. Running the
  ; installer over that would be an unasked-for downgrade.
  ReadRegStr $0 HKLM \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\EqualizerAPO" \
    "UninstallString"
  ${If} $0 != ""
    DetailPrint "Equalizer APO is already installed - leaving it as it is."
    Goto apoDone
  ${EndIf}

  ; A silent FluidEQ install is an unattended one, and APO's installer needs
  ; someone present to choose devices. The bundled copy stays in the install
  ; directory either way, so it can still be run by hand afterwards from the
  ; resources\equalizer-apo folder.
  ${If} ${Silent}
    DetailPrint "Silent install - skipping Equalizer APO."
    Goto apoDone
  ${EndIf}

  MessageBox MB_YESNO|MB_ICONQUESTION \
    "FluidEQ needs Equalizer APO to process audio. It is included with this \
installer - nothing will be downloaded.$\r$\n$\r$\nIts setup will now open so \
you can choose which audio devices to equalise. Your computer will need to \
restart afterwards.$\r$\n$\r$\nInstall Equalizer APO now?" \
    /SD IDYES IDNO apoDeclined

  DetailPrint "Running the Equalizer APO installer..."
  ; Waits, so FluidEQ does not launch into a machine where APO is half
  ; installed. $0 receives APO's exit code; it is not treated as fatal, since
  ; a user who cancels APO's setup still wants FluidEQ installed and can be
  ; offered the install again from inside the app.
  ExecWait '"$INSTDIR\resources\equalizer-apo\equalizer-apo-setup.exe"' $0
  ${If} $0 != 0
    DetailPrint "Equalizer APO setup did not complete (code $0)."
  ${EndIf}
  Goto apoDone

  apoDeclined:
    DetailPrint "Equalizer APO declined - FluidEQ can offer it again later."

  apoDone:
!macroend

!macro customUnInstall
  ; An update runs the old version's uninstaller before installing the new
  ; one. Asking whether to tear out the audio engine in the middle of that is
  ; both alarming and wrong, so this only runs on a real uninstall.
  ${IfNot} ${isUpdated}
    ReadRegStr $0 HKLM \
      "Software\Microsoft\Windows\CurrentVersion\Uninstall\EqualizerAPO" \
      "UninstallString"
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

      DetailPrint "Running the Equalizer APO uninstaller..."
      ; The registry value is a full command line, already quoted where it
      ; needs to be, so it is executed as written rather than re-quoted.
      ExecWait '$0'
      Goto apoRemoved

      apoKept:
        DetailPrint "Leaving Equalizer APO installed."

      apoRemoved:
    ${EndIf}
  ${EndIf}
!macroend
