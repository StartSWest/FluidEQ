/* FluidEQ — GPL-3.0-or-later */
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

let helper: ChildProcessWithoutNullStreams | undefined;
let lastColour: string | undefined;
let quitting = false;
let failed = false;
let followsQuit = false;

/** GNOME's companion owns desktop chrome; Electron never creates an overlay. */
const setLinuxDesktopColour = (colour: unknown) => {
  if (
    process.platform !== 'linux' ||
    quitting ||
    failed ||
    !(process.env.XDG_CURRENT_DESKTOP ?? '').split(':').includes('GNOME') ||
    typeof colour !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(colour) ||
    colour === lastColour
  ) {
    return;
  }
  if (!helper) {
    const script = [
      path.join(
        process.resourcesPath ?? '',
        'native/linux-wallpaper/colours.js',
      ),
      path.join(app.getAppPath(), 'native/linux/wallpaper/colours.js'),
      path.join(__dirname, '../../../native/linux/wallpaper/colours.js'),
    ].find((candidate) => existsSync(candidate));
    if (!script) {
      return;
    }
    const child = spawn('gjs', ['-m', script, String(process.pid)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    helper = child;
    child.stdout.resume();
    child.stderr.on('data', (chunk: Buffer) =>
      log.warn(`Desktop colours: ${chunk.toString('utf8').slice(0, 2048)}`),
    );
    child.on('error', (error) => {
      failed = true;
      log.warn(`Desktop colours: ${error.message}`);
    });
    child.stdin.on('error', (error) =>
      log.warn(`Desktop colours: ${error.message}`),
    );
    child.once('close', () => {
      if (helper === child) {
        helper = undefined;
        lastColour = undefined;
        failed = !quitting;
      }
    });
    if (!followsQuit) {
      followsQuit = true;
      // A cancelled quit leaves the app alive; restore desktop colours only
      // once the quit is definitive, as for the shared app services.
      app.once('will-quit', () => {
        quitting = true;
        helper?.stdin.end();
      });
    }
  }
  lastColour = colour;
  helper.stdin.write(`${colour}\n`);
};

export default setLinuxDesktopColour;
