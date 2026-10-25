# GNOME desktop adapter

This Linux-only companion places the existing FluidEQ wallpaper renderer behind
GNOME's desktop icons. It introduces no scenes, alternate renderer, account gate,
audio capture or wallpaper settings. Windows keeps its existing native helper.

Currently supported: GNOME Shell 50 with XWayland and the GJS command-line
runtime with GioUnix. FluidEQ's normal Linux launcher selects X11 before Electron initializes;
an explicit native-Wayland override does not expose wallpaper controls. Other
desktops need their own host integration and remain unsupported.

From this checkout, install for the current user with:

```sh
bash native/linux/wallpaper/install.sh
```

Sign out and back in once: GNOME discovers newly installed local extensions at
login. The installer preserves every other extension selection. Updates also
need a new login because GNOME 50 cannot reload extension modules. The packaged
copy is under `resources/native/linux-wallpaper/` beside the native helpers.
Nothing installs or enables itself when FluidEQ starts.

With the companion enabled, the GNOME top panel and Ubuntu/Dash to Dock
backgrounds follow the current FluidEQ window colour, including Brightness and
app/amp theme switches. A separate, parent-validated colour connection keeps
this working when wallpaper is stopped. It changes only existing actors' inline
background styles: no windows, input regions or persistent desktop preferences.
Their previous styles return on app exit, helper disconnect or extension disable;
unrelated style changes made while FluidEQ runs are retained.

The shared wallpaper surface starts `gjs -m host.js <decimal XID> <owner PID>`.
The stdin/stdout protocol is the Windows host's (`native/wallpaper/README.md`),
plus `registered` before the first map. Main maps the dedicated window only once
Shell has registered its id. Shell validates the helper's parent PID through
D-Bus credentials and `/proc`, then the exact XID, PID, desktop window type and
title before touching an actor. It clones that window's hidden actor into the
background group. The original cannot receive input, focus or a taskbar entry.
Source rendering stays in Electron's existing isolated wallpaper session.

Before registering or mapping the source, the GJS host starts the Linux
`FluidEQ-Wallpaper` input helper. It validates the exact source's PID, desktop
type and title, installs an empty X11 input region, and keeps it empty on native
shape/configure events. Chromium replaces Electron's initial ignore-mouse
region when it updates frame hints; a hidden clone source must not become an
invisible input barrier. The host stops on a lost input helper, and EOF releases
the helper without restoring input to the source. No other window is modified.

The native regression target is `fluideq-linux-wallpaper-input-test`. Run it
with the helper path as its argument only inside a private X server, setting
`FLUIDEQ_WALLPAPER_TEST_DISPLAY` to that private `DISPLAY`. Without that explicit
match it refuses to run. It creates its own source and app windows, verifies
rejection of app/wrong-owner windows, overwrites the source input region after
mapping/resizing, and checks repair and stdin-EOF cleanup using native events.

Reports are directed to the registering helper. Foreground/fullscreen, workspace,
lock and monitor changes are event-driven. Stdin EOF, a helper disconnect, a lost
extension, the window closing or a monitor changing removes the clone. Stopping
the wallpaper exposes the user's unchanged ordinary background. The extension
never changes desktop wallpaper settings, patches shell functions, fetches media
or launches FluidEQ. Disable it in Extensions to remove the integration.

Owner desktop verification is still required; automated checks use a private
D-Bus, PipeWire and headless GNOME with a disposable extension/profile. Source
page captures do not establish the appearance of the entire desktop. GNOME's
screenshot service restrictions must not be bypassed for that check.

Primary references for the adapter boundary and compositor API:

- [Electron's Linux positioning restrictions](https://www.electronjs.org/docs/latest/api/browser-window#platform-notices)
- [GNOME Shell background group](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/50.1/js/ui/layout.js)
- [Mutter window actors](https://mutter.gnome.org/meta/class.WindowActor.html)
- [Clutter clone visibility](https://mutter.gnome.org/clutter/class.Clone.html)
- [GNOME extension lifecycle](https://gjs.guide/extensions/topics/extension.html)

Hanabi's [renderer/window split](https://github.com/jeffshee/gnome-ext-hanabi)
also demonstrates why GNOME needs a shell companion. FluidEQ retains its own
shared renderer and event protocol; it does not depend on Hanabi.
