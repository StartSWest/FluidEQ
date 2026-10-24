/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Run after building fluideq-linux-volume. Every sound server and setting
// belongs to this scratch session: this test never connects to the desktop.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
const root = fs.mkdtempSync('/tmp/fluideq-volume-');
const env = { ...process.env };
for (const [key, name] of Object.entries({
  XDG_RUNTIME_DIR: 'run',
  XDG_CONFIG_HOME: 'config',
  XDG_DATA_HOME: 'data',
  XDG_STATE_HOME: 'state',
  XDG_CACHE_HOME: 'cache',
})) {
  env[key] = `${root}/${name}`;
  fs.mkdirSync(env[key], { mode: 0o700 });
}
for (const key of [
  'PIPEWIRE_REMOTE',
  'PIPEWIRE_RUNTIME_DIR',
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'PULSE_SERVER',
  'PULSE_RUNTIME_PATH',
  'DBUS_SESSION_BUS_ADDRESS',
])
  delete env[key];
const config = `${env.XDG_CONFIG_HOME}/wireplumber/wireplumber.conf.d`;
fs.mkdirSync(config, { recursive: true });
fs.writeFileSync(
  `${config}/90-isolated.conf`,
  'wireplumber.profiles = { main = { monitor.alsa = disabled monitor.alsa-midi = disabled monitor.bluez = disabled monitor.bluez-midi = disabled monitor.v4l2 = disabled monitor.libcamera = disabled support.logind = disabled support.reserve-device = disabled } }\n',
);
process.stdout.write(`Isolated audio test: ${root}\n`);
const session = fileURLToPath(new URL('./volume_session.mjs', import.meta.url));
const child = spawn('dbus-run-session', ['--', process.execPath, session], {
  env,
  stdio: 'inherit',
  detached: true,
});
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => process.kill(-child.pid, signal));
const [code] = await once(child, 'exit');
process.exitCode = code ?? 1;
