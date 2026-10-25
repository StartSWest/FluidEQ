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
let colour;
let stopped = false;
const finish = () => {
  if (stopped) {
    return;
  }
  stopped = true;
  cancel.cancel();
  if (proxy?.g_name_owner) {
    proxy.DetachRemote();
  }
  loop.quit();
};
const publish = () => {
  if (!stopped && colour && proxy.g_name_owner) {
    proxy.SetColourRemote(Number(ARGV[0]), colour, (_reply, error) => {
      if (error && !stopped) {
        printerr(`FluidEQ desktop colours: ${error}`);
        finish();
      }
    });
  }
};
const input = new Gio.DataInputStream({
  base_stream: new GioUnix.InputStream({ fd: 0 }),
});
const read = () => {
  input.read_line_async(GLib.PRIORITY_DEFAULT, cancel, (stream, result) => {
    if (stopped) {
      return;
    }
    try {
      const [line] = stream.read_line_finish_utf8(result);
      if (line === null) {
        finish();
        return;
      }
      if (!/^#[0-9a-f]{6}$/i.test(line)) {
        throw new Error('invalid-colour');
      }
      colour = line;
      publish();
      read();
    } catch (error) {
      printerr(`FluidEQ desktop colours: ${error}`);
      finish();
    }
  });
};

try {
  if (
    ARGV.length !== 1 ||
    !/^[1-9]\d{0,9}$/.test(ARGV[0]) ||
    Number(ARGV[0]) > 0xffffffff
  ) {
    throw new Error('invalid-owner');
  }
  proxy = new Proxy(Gio.DBus.session, BUS_NAME, OBJECT_PATH);
  proxy.connect('notify::g-name-owner', publish);
  read();
  loop.run();
} catch (error) {
  printerr(`FluidEQ desktop colours: ${error}`);
  finish();
}
