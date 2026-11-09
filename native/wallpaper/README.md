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
Write exactly `show\n` or `hide\n` to change native visibility, `touch\n` or
`still\n` to start or stop passing the mouse on, and `camera-key <name>\n` to
name the key that turns the camera (`ctrl`, `alt`, `shift`, or `vk:0x01` to
`vk:0xFE`; Ctrl until told); closing stdin requests shutdown. Commands are
bounded (32 bytes), case-sensitive ASCII records. Any line the helper does not
know — a newer main's command, a key it cannot read, a line too long — is
ignored with `unknown-command` on stderr and never fails the background: a
helper refusing them stopped every background the day main first sent
`touch`. The latest policy wins when several commands arrive together.

## The mouse (`pointer.h`, `icons.h`)

Windows never delivers input to the background, so while main has said
`touch` AND the window is shown AND some of the monitor's desktop is in sight,
the helper registers Raw Input for the mouse (`RIDEV_INPUTSINK`, delivered to a
message-only window of its own) and writes what happened over its monitor's
bare desktop. The rest of the time it is not registered and receives nothing.
Raw Input only observes: Explorer still gets every click, drag and right click,
and nothing here can hold the mouse up for the rest of the machine the way a
`WH_MOUSE_LL` hook stalls every mouse event when its thread does. No timer, no
cursor poll: each record answers one mouse report.

Bare desktop means: inside this monitor, `WindowFromPoint` names the desktop
itself (the icons' list view, the shell windows round it, or this background),
and the point is on no icon. The icons' rectangles come from Explorer's own
`IFolderView` of the desktop on a thread of their own, read again whenever the
list view reports a change and after every release over the desktop; never
`LVM_HITTEST`, which would need memory written into Explorer. Unknown icons
pass nothing on over a visible list view. A press begun on the bare desktop is
followed until it is let go, wherever it goes; a press begun anywhere else
(dragging an icon or a window across the desktop) keeps everything back until
it is released. Of the keyboard only the camera key is read — the one
`camera-key` named, Ctrl unless told — with `GetAsyncKeyState` at the moment
of a report that is passed on; no keyboard Raw Input, no key code on stdout.

Records, in the monitor's physical pixels from its top-left corner:

- `pointer:move X Y C B`, `pointer:down X Y C B N`, `pointer:up X Y C B N`,
  `pointer:wheel X Y C B D`, `pointer:leave`
- `C` the camera key down (0/1; still the Ctrl bit to main); `B` buttons held as a page's `PointerEvent.buttons`
  (1 left, 2 right, 4 middle); `N` the button (0 left, 1 middle, 2 right); `D`
  the wheel in Windows' units (120 a notch, positive away from the hand).
- Stopping mid-press says `pointer:leave`, never a release, which a page would
  read as a tap.

Main never logs these. `touch-unavailable`, `touch-stop-failed` and
`icons-unavailable` go to stderr; the background plays on without the mouse.

The executable uses the Windows GUI subsystem (no console flash), but writes
newline-delimited UTF-8/ASCII records to inherited stdout:

- `ready`: the hidden window was attached and positioned. It stays hidden until `show\n`.
- `active` / `paused` / `paused-owner`: initial fullscreen policy after ready,
  then changes only. `paused-owner` is a pause whose cover rests on the owner
  PID's own windows: without them, some of the desktop would be in sight.
  FluidEQ keeps listening to the music through that pause, because minimising
  its window is what ends it.
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
`desktop-destroyed`, `wait-failed`, `visibility-failed`.

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
