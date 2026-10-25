#!/usr/bin/gjs -m
/* FluidEQ — GPL-3.0-or-later */
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GioUnix from 'gi://GioUnix';
import {
  BUS_NAME,
  INTERFACE,
  OBJECT_PATH,
} from './gnome-extension/protocol.js';

const loop = new GLib.MainLoop(null, false);
const cancel = new Gio.Cancellable();
const Proxy = Gio.DBusProxy.makeProxyWrapper(INTERFACE);
let proxy;
let inputGuard;
let stopped = false;
let failed = false;
const finish = (reason) => {
  if (stopped) {
    return;
  }
  stopped = true;
  if (reason) {
    failed = true;
    print(`error:${reason}`);
  }
  cancel.cancel();
  inputGuard?.get_stdin_pipe()?.close(null);
  if (proxy?.g_name_owner) {
    proxy.DetachRemote();
  }
  loop.quit();
};

let command = '';
const readCommand = (input) => {
  input.read_bytes_async(
    64,
    GLib.PRIORITY_DEFAULT,
    cancel,
    (stream, result) => {
      if (stopped) {
        return;
      }
      try {
        const bytes = stream.read_bytes_finish(result).get_data();
        if (bytes.length === 0) {
          finish();
          return;
        }
        for (const byte of bytes) {
          if (byte === 10) {
            if (command !== 'show' && command !== 'hide') {
              finish('invalid-command');
              return;
            }
            proxy.SetVisibleRemote(command === 'show', (_reply, error) => {
              if (error) {
                finish('visibility-failed');
              }
            });
            command = '';
          } else {
            command += String.fromCharCode(byte);
            if (command.length > 4) {
              finish('invalid-command');
              return;
            }
          }
        }
        readCommand(input);
      } catch (error) {
        printerr(String(error));
        finish('input-unavailable');
      }
    },
  );
};

try {
  if (
    ARGV.length !== 2 ||
    !ARGV.every(
      (value) => /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 0xffffffff,
    )
  ) {
    throw new Error('invalid-arguments');
  }
  proxy = new Proxy(Gio.DBus.session, BUS_NAME, OBJECT_PATH);
  if (!proxy.g_name_owner) {
    throw new Error('desktop-unavailable');
  }
  proxy.connect('notify::g-name-owner', () => {
    if (!proxy.g_name_owner) {
      finish('desktop-unavailable');
    }
  });
  proxy.connectSignal('Report', (_proxy, _sender, [report]) => {
    if (report.startsWith('error:')) {
      finish(report.slice(6));
    } else if (['ready', 'active', 'paused', 'paused-owner'].includes(report)) {
      print(report);
    } else {
      finish('invalid-report');
    }
  });
  // Electron's X11 ignore-mouse setting is overwritten by Chromium's native
  // frame-hint updates. Establish an empty input region before allowing the
  // source's first map, then keep it empty on actual native shape changes.
  const directory = Gio.File.new_for_uri(import.meta.url).get_parent();
  const guardPath = [
    directory.get_parent().get_child('FluidEQ-Wallpaper'),
    directory
      .get_parent()
      .get_parent()
      .get_child('.build/bin/FluidEQ-Wallpaper'),
  ]
    .find((file) => file.query_exists(null))
    ?.get_path();
  if (!guardPath) {
    throw new Error('input-guard-unavailable');
  }
  inputGuard = Gio.Subprocess.new(
    [guardPath, ...ARGV],
    // eslint-disable-next-line no-bitwise -- Gio combines independent subprocess pipe flags
    Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE,
  );
  const reports = new Gio.DataInputStream({
    base_stream: inputGuard.get_stdout_pipe(),
  });
  let guarded = false;
  const readGuard = () => {
    reports.read_line_async(GLib.PRIORITY_DEFAULT, cancel, (stream, result) => {
      if (stopped) {
        return;
      }
      try {
        const [line] = stream.read_line_finish_utf8(result);
        if (guarded || line !== 'ready') {
          finish('input-guard-failed');
          return;
        }
        guarded = true;
        proxy.AttachRemote(
          Number(ARGV[0]),
          Number(ARGV[1]),
          (_reply, error) => {
            if (stopped) {
              return;
            }
            if (error) {
              printerr(String(error));
              finish('attach-failed');
              return;
            }
            // Only an input-free source registered with Shell may be mapped.
            print('registered');
            readCommand(new GioUnix.InputStream({ fd: 0 }));
          },
        );
        readGuard();
      } catch (error) {
        printerr(String(error));
        finish('input-guard-failed');
      }
    });
  };
  readGuard();
  loop.run();
} catch (error) {
  finish(String(error));
}
if (failed) {
  imports.system.exit(1);
}
