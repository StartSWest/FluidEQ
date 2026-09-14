# Windows desktop visualizer host

`FluidEQ-Wallpaper.exe <decimal HWND> <decimal owner PID>` receives a dedicated,
hidden Electron window. Electron must create it on the selected display and call
`setIgnoreMouseEvents(true)` before starting the helper. Do not pass the main
application window. Keep stdin piped and open for the wallpaper lifetime. One
helper runs per monitor, each with its own window.

The window's own rectangle only names the monitor: the helper places it over
that monitor's whole physical rectangle. Windows clamps a top-level window to
the work area, and Chromium's frame styles add invisible insets, so placing it
where it stood left the taskbar strip showing the ordinary wallpaper.
Write exactly `show\n` or `hide\n` to change native visibility; closing stdin
requests shutdown. Commands are bounded, case-sensitive ASCII records. Invalid
records fail closed. The latest policy wins when several commands arrive together.

The executable uses the Windows GUI subsystem (no console flash), but writes
newline-delimited UTF-8/ASCII records to inherited stdout:

- `ready`: the hidden window was attached and positioned. It stays hidden until `show\n`.
- `active` / `paused`: initial fullscreen policy after ready, then changes only.
- `error:<reason>`: fatal failure; close/destroy the Electron window and offer retry.

Exit code zero means ordinary lifetime termination. Nonzero means failure.
Always destroy the Electron window when the helper exits, including unexpected
helper termination. The helper cannot clean up after its own forced termination.

Call Electron's `showInactive()` exactly once, after `ready` and the first
`active`, together with the first `show\n`. Chromium marks a window's compositor
visible only through its own show path (`DesktopWindowTreeHostWin::Show` is the
one caller of `OnAcceleratedWidgetMadeVisible`); shown natively by this helper
alone, the desktop received the window's background colour and nothing else,
and the page's animation frames starved. Measured on Windows 11 25H2 with a
test pattern: native show alone composited only the background colour on every
run; `showInactive()` after attachment composited the page, kept the window
between the icons and the wallpaper, and took no focus. After that first show,
use helper commands for visibility, and never call `hide()`, `setBounds()` or
reparent while attached. Set `paintWhenInitiallyHidden: true` and
`backgroundThrottling: false` so the initial scene can draw before attachment.
Display changes require destroying this window and creating a fresh one.

Stable error reasons: `invalid-arguments`, `owner-mismatch`, `owner-unavailable`,
`dpi-unavailable`, `invalid-bounds`, `display-unavailable`, `desktop-unavailable`,
`lifetime-unavailable`, `input-unavailable`, `events-unavailable`,
`desktop-request-failed`, `style-failed`, `attach-failed`, `composition-failed`,
`coordinates-failed`, `position-failed`, `desktop-changed`, `display-changed`,
`desktop-destroyed`, `wait-failed`, `invalid-command`, `visibility-failed`.

Integrate with `add_subdirectory(wallpaper)` in the Windows native CMake build.
The target is `fluideq-wallpaper`; output is `bin/FluidEQ-Wallpaper.exe` under the
build directory (multi-config generators add the configuration). Package that
executable with the native resources and resolve it through main's packaged/dev
resource policy. No additional DLLs are shipped for this helper.

Standalone compiler check: configure this folder with CMake/MSVC and build the
`fluideq-wallpaper` target. It enforces C++20, `/W4 /WX /permissive-` and `/Brepro`.
Build-only verification never starts the helper or changes the desktop.

## Shell behavior and limits

Explorer's wallpaper attachment message is undocumented. This helper inspects
actual window topology instead of guessing from the OS version. A conventional
desktop hosts the child in the WorkerW behind the icon host. A raised 24H2 desktop
hosts a layered child of Progman below DefView and above its native wallpaper
WorkerW. With a helper per monitor several wallpapers share that span, so each
helper only restores its own window to somewhere between the two; demanding the
slot directly under DefView made two helpers take it from each other forever. It never hides or restyles shell-owned windows. Unsupported
topology, parent destruction, or changed display bounds is a fatal stop, not an
automatic retry. Explorer's asynchronous message completion drives discovery;
stdin EOF, process handles, and WinEvent callbacks drive all lifetime waits.

Cross-process parenting can change Windows DPI behavior. Physical bounds are
captured before attachment and checked after it; mixed DPI monitors still need
real desktop verification. Fullscreen means the foreground application's DWM
frame covers the chosen physical monitor. Desktop, tool, minimized, hidden, and
cloaked windows do not pause playback. Main handles screen lock, suspend, battery,
entitlement and renderer lifetime independently.

Normal shutdown hides only the PID-validated supplied HWND and reparents it to
the message-only tree; it never promotes the wallpaper to a top-level window.
Electron then destroys its dedicated BrowserWindow. A shell crash or malicious
force-kill still needs real Windows QA: out-of-context shell events are queued,
and no cross-process API provides an atomic lifetime guarantee.

After preview acceptance, regression coverage should exercise strict decimal
overflow/rejection, monitor containment including negative coordinates, and
positive/negative fullscreen controls. An isolated mock shell/native-window
harness should cover PID mismatch without any mutation, EOF/owner exit while
waiting for shell completion, attach errors, conventional/raised ordering,
shell destruction, and no surviving top-level surface. Do not run that against
the user's actual desktop as an automated test.

Primary implementation references:

- [Lively maintainer's raised-desktop explanation](https://github.com/rocksdanister/lively/discussions/3004)
- [Lively topology implementation at d27589c](https://github.com/rocksdanister/lively/blob/d27589c/src/Lively/Lively/Core/WinDesktopCore.cs)
- [Microsoft SetParent style and DPI rules](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent)
- [Microsoft WinEvent delivery and message-loop requirements](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwineventhook)
- [Electron initial hidden painting](https://www.electronjs.org/docs/latest/api/browser-window#showing-the-window-gracefully)
- [Chromium Show placement and focus behavior](https://github.com/chromium/chromium/blob/main/ui/views/win/hwnd_message_handler.cc)
