/* FluidEQ — GPL-3.0-or-later */
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { BUS_NAME, INTERFACE, OBJECT_PATH } from './protocol.js';
import DesktopColours from './colours.js';

const belongsTo = (sender, pid) => {
  const [helperPid] = Gio.DBus.session
    .call_sync(
      'org.freedesktop.DBus',
      '/org/freedesktop/DBus',
      'org.freedesktop.DBus',
      'GetConnectionUnixProcessID',
      new GLib.Variant('(s)', [sender]),
      new GLib.VariantType('(u)'),
      Gio.DBusCallFlags.NONE,
      -1,
      null,
    )
    .deep_unpack();
  const [, bytes] = Gio.File.new_for_path(
    `/proc/${helperPid}/status`,
  ).load_contents(null);
  const parent = /^PPid:\s+(\d+)$/m.exec(new TextDecoder().decode(bytes));
  return pid > 0 && Number(parent?.[1]) === pid;
};

/** Only the dedicated wallpaper window may become a background, never the amp. */
const matches = (window, entry) =>
  window.get_pid() === entry.pid &&
  window.get_window_type() === Meta.WindowType.DESKTOP &&
  window.title === 'FluidEQ Desktop' &&
  Number.parseInt(window.get_description().split(' ')[0], 16) === entry.xid;

export default class FluidEQDesktop extends Extension {
  enable() {
    this.entries = new Map();
    this.colourClients = new Map();
    this.colours = new DesktopColours(Main.panel, Main.uiGroup);
    this.signals = [];
    this.exported = Gio.DBusExportedObject.wrapJSObject(INTERFACE, this);
    this.exported.export(Gio.DBus.session, OBJECT_PATH);
    this.bus = Gio.bus_own_name_on_connection(
      Gio.DBus.session,
      BUS_NAME,
      Gio.BusNameOwnerFlags.NONE,
      null,
      null,
    );
    const listen = (object, signal, callback) => {
      this.signals.push([object, object.connect(signal, callback)]);
    };
    // Map is the first moment a hidden Electron window has a compositor actor.
    // Register first, then let main show it; discovery never guesses a delay.
    listen(global.window_manager, 'map', (_manager, actor) => {
      for (const entry of this.entries.values()) {
        if (!entry.actor && matches(actor.meta_window, entry)) {
          this.attachSafely(entry, actor);
        }
      }
    });
    listen(global.display, 'restacked', () => this.policy());
    listen(global.display, 'in-fullscreen-changed', () => this.policy());
    listen(global.workspace_manager, 'active-workspace-changed', () =>
      this.policy(),
    );
    listen(Main.sessionMode, 'updated', () => this.policy());
    // Main replaces surfaces when a display changes. Remove the old clones
    // first, including any whose owning process has not heard the event yet.
    listen(Main.layoutManager, 'monitors-changed', () => {
      for (const sender of [...this.entries.keys()]) {
        this.report(sender, 'error:display-changed');
        this.remove(sender);
      }
    });
  }

  report(sender, value) {
    // A report is private to the helper that registered this surface.
    this.exported
      .get_connection()
      .emit_signal(
        sender,
        OBJECT_PATH,
        BUS_NAME,
        'Report',
        new GLib.Variant('(s)', [value]),
      );
  }

  AttachAsync([xid, pid], invocation) {
    const sender = invocation.get_sender();
    try {
      if (!xid || !belongsTo(sender, pid) || this.entries.has(sender)) {
        throw new Error('The helper does not belong to the window owner.');
      }
      const entry = {
        xid,
        pid,
        actor: null,
        clone: null,
        visible: false,
        cover: null,
        signals: [],
      };
      this.entries.set(sender, entry);
      entry.watch = Gio.bus_watch_name_on_connection(
        Gio.DBus.session,
        sender,
        Gio.BusNameWatcherFlags.NONE,
        null,
        () => this.remove(sender),
      );
      entry.sender = sender;
      invocation.return_value(null);
      const actor = global
        .get_window_actors()
        .find((candidate) => matches(candidate.meta_window, entry));
      if (actor) {
        this.attachSafely(entry, actor);
      }
    } catch (error) {
      invocation.return_dbus_error(`${BUS_NAME}.InvalidWindow`, String(error));
    }
  }

  attachSafely(entry, actor) {
    try {
      this.attachActor(entry, actor);
    } catch (error) {
      // eslint-disable-next-line no-console -- preserve the native compositor error in GNOME's log
      console.error(`FluidEQ Desktop: ${error}`);
      this.report(entry.sender, 'error:attach-failed');
      this.remove(entry.sender);
    }
  }

  attachActor(entry, actor) {
    const window = actor.meta_window;
    const monitorIndex = () => {
      const frame = window.get_client_content_rect();
      const x = frame.x + frame.width / 2;
      const y = frame.y + frame.height / 2;
      // get_monitor() still names the primary output during the first map of
      // a window on another output. Native geometry already names its place.
      return Main.layoutManager.monitors.findIndex(
        (monitor) =>
          x >= monitor.x &&
          x < monitor.x + monitor.width &&
          y >= monitor.y &&
          y < monitor.y + monitor.height,
      );
    };
    const monitor = Main.layoutManager.monitors[monitorIndex()];
    if (!monitor) {
      this.report(entry.sender, 'error:display-unavailable');
      this.remove(entry.sender);
      return;
    }
    entry.actor = actor;
    entry.monitor = monitorIndex();
    // A clone can paint a hidden source. The original stays mapped to produce
    // frames but can never cover icons, windows, the overview or the lock.
    actor.hide();
    entry.clone = new Clutter.Clone({
      source: actor,
      reactive: false,
      visible: false,
    });
    entry.container = new Clutter.Actor({
      x: monitor.x,
      y: monitor.y,
      width: monitor.width,
      height: monitor.height,
      reactive: false,
      clip_to_allocation: true,
      visible: false,
    });
    entry.clone.visible = true;
    entry.container.add_child(entry.clone);
    Main.layoutManager._backgroundGroup.add_child(entry.container);
    // Fit the native content rectangle after every configure. The transparent
    // Linux host avoids GTK's invisible CSD margins around this source; the
    // container clips the clone to this monitor while geometry changes.
    const fit = () => {
      const frame = window.get_client_content_rect();
      const index = monitorIndex();
      const target = Main.layoutManager.monitors[index];
      if (!target || !frame.width || !frame.height) {
        return;
      }
      entry.monitor = index;
      entry.container.set_position(target.x, target.y);
      entry.container.set_size(target.width, target.height);
      const sx = target.width / frame.width;
      const sy = target.height / frame.height;
      entry.clone.set_position(
        (actor.x - frame.x) * sx,
        (actor.y - frame.y) * sy,
      );
      entry.clone.set_size(actor.width * sx, actor.height * sy);
    };
    fit();
    for (const signal of ['size-changed', 'position-changed']) {
      entry.signals.push([window, window.connect(signal, fit)]);
    }
    entry.signals.push([actor, actor.connect('notify::allocation', fit)]);
    entry.signals.push([
      actor,
      actor.connect('notify::visible', () => {
        if (actor.visible) {
          actor.hide();
        }
      }),
    ]);
    entry.signals.push([
      window,
      window.connect('unmanaged', () => {
        this.report(entry.sender, 'error:window-destroyed');
        this.remove(entry.sender);
      }),
    ]);
    this.report(entry.sender, 'ready');
    this.policy();
  }

  SetVisibleAsync([visible], invocation) {
    const entry = this.entries.get(invocation.get_sender());
    if (entry) {
      entry.visible = visible;
      if (entry.container) {
        entry.container.visible = visible && !Main.sessionMode.isLocked;
      }
    }
    invocation.return_value(null);
  }

  DetachAsync(_args, invocation) {
    this.remove(invocation.get_sender());
    this.removeColour(invocation.get_sender());
    invocation.return_value(null);
  }

  SetColourAsync([pid, colour], invocation) {
    const sender = invocation.get_sender();
    try {
      if (!/^#[0-9a-f]{6}$/i.test(colour) || !belongsTo(sender, pid)) {
        throw new Error('Invalid desktop colour owner.');
      }
      const previous = this.colourClients.get(sender);
      const watch =
        previous?.watch ??
        Gio.bus_watch_name_on_connection(
          Gio.DBus.session,
          sender,
          Gio.BusNameWatcherFlags.NONE,
          null,
          () => this.removeColour(sender),
        );
      this.colourClients.delete(sender);
      this.colourClients.set(sender, { colour, watch });
      this.colours.set(colour);
      invocation.return_value(null);
    } catch (error) {
      invocation.return_dbus_error(`${BUS_NAME}.InvalidColour`, String(error));
    }
  }

  removeColour(sender) {
    const client = this.colourClients.get(sender);
    if (!client) {
      return;
    }
    this.colourClients.delete(sender);
    Gio.bus_unwatch_name(client.watch);
    const latest = [...this.colourClients.values()].pop();
    if (latest) {
      this.colours.set(latest.colour);
    } else {
      this.colours.stop();
    }
  }

  policy() {
    const workspace = global.workspace_manager.get_active_workspace();
    const windows = global.display.get_tab_list(
      Meta.TabList.NORMAL_ALL,
      workspace,
    );
    for (const entry of [...this.entries.values()].filter(
      (value) => value.actor,
    )) {
      const monitor = Main.layoutManager.monitors[entry.monitor];
      const covers = windows.filter((window) => {
        if (window.minimized || !window.showing_on_its_workspace()) {
          return false;
        }
        const rect = window.get_frame_rect();
        return (
          rect.x <= monitor.x &&
          rect.y <= monitor.y &&
          rect.x + rect.width >= monitor.x + monitor.width &&
          rect.y + rect.height >= monitor.y + monitor.height
        );
      });
      let cover = 'active';
      if (
        Main.sessionMode.isLocked ||
        covers.some((window) => window.get_pid() !== entry.pid)
      ) {
        cover = 'paused';
      } else if (covers.length > 0) {
        cover = 'paused-owner';
      }
      entry.container.visible = entry.visible && !Main.sessionMode.isLocked;
      if (entry.cover !== cover) {
        entry.cover = cover;
        this.report(entry.sender, cover);
      }
    }
  }

  remove(sender) {
    const entry = this.entries.get(sender);
    if (!entry) {
      return;
    }
    this.entries.delete(sender);
    Gio.bus_unwatch_name(entry.watch);
    for (const [object, signal] of entry.signals) {
      object.disconnect(signal);
    }
    entry.container?.destroy();
    // Keep the source hidden until Electron destroys it. Showing it on
    // extension shutdown would briefly put the canvas over desktop icons.
  }

  disable() {
    for (const sender of [...this.colourClients.keys()]) {
      this.removeColour(sender);
    }
    this.colours.stop();
    for (const [object, signal] of this.signals) {
      object.disconnect(signal);
    }
    for (const sender of [...this.entries.keys()]) {
      this.report(sender, 'error:desktop-unavailable');
      this.remove(sender);
    }
    Gio.bus_unown_name(this.bus);
    this.exported.unexport();
    this.entries = null;
    this.signals = null;
    this.exported = null;
  }
}
