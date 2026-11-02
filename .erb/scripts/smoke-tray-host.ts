/* FluidEQ — GPL-3.0-or-later */

/**
 * FluidEQ-Tray as main drives it (`nativeTray/trayHostProcess.ts`), live:
 * started and greeted; a second start finding it already serving and handing
 * main to it; the engine's line held; the quit recipe carried out in a folder
 * of its own the moment main's end of the line goes, before the engine's line
 * breaks; the next start serving again once it has gone; and a main that
 * leaves it with FluidEQ going on, the tray keeping everything as it was
 * until the next FluidEQ comes back to it and quits.
 *
 * Shows no icon (no state names one), serves its engine line under a name no
 * engine knows, and touches nothing outside its temporary folder. Every wait
 * is on an event; a step that never comes is the run failing.
 */
import assert from 'assert/strict';
import { randomBytes } from 'crypto';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { songIdentity } from '../../src/main/songProgramme';
import {
  startTrayHost,
  type ITrayHost,
} from '../../src/main/nativeTray/trayHostProcess';

const executable = path.resolve(
  process.argv[2] ?? 'native/.build/bin/FluidEQ-Tray.exe',
);
const key = randomBytes(16).toString('hex');
const ownerPipe = `\\\\.\\pipe\\FluidEQ-Smoke-Owner-${randomBytes(8).toString('hex')}`;
const GUID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

const started = async (): Promise<ITrayHost> => {
  const host = await startTrayHost({ executable, key, ownerPipe });
  assert.ok(host, 'FluidEQ-Tray starts and says hello');
  return host;
};

/** An engine's connection to the line, and the moment it breaks. */
const engineLine = () =>
  new Promise<{ broken: Promise<void> }>((resolve, reject) => {
    const socket = net.connect(ownerPipe);
    const broken = new Promise<void>((settle) => {
      socket.on('close', () => settle());
    });
    socket.on('error', () => undefined);
    socket.once('connect', () => resolve({ broken }));
    socket.once('error', reject);
  });

/** `name` in `dir` once it says what `says` wants, told by the folder. */
const whenFile = (dir: string, name: string, says: (text: string) => boolean) =>
  new Promise<string>((resolve) => {
    let watcher: fs.FSWatcher | undefined;
    const check = () => {
      let text = '';
      try {
        text = fs.readFileSync(path.join(dir, name), 'utf8');
      } catch {
        return;
      }
      if (says(text)) {
        watcher?.close();
        resolve(text);
      }
    };
    watcher = fs.watch(dir, check);
    check();
  });

const main = async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tray-smoke-'));
  const at = (name: string) => path.join(folder, name);
  [
    'fluideq.txt',
    'fluideq-dsp.txt',
    `fluideq-dsp-${GUID}.txt`,
    'fluideq-owner.txt',
    'config.txt',
  ].forEach((name) => fs.writeFileSync(at(name), 'live'));

  const first = await started();
  assert.equal(first.servesOwnerPipe, true, 'it serves the engine line');
  const engine = await engineLine();

  // A second start while it serves: the program it starts says ready for the
  // running one and ends, and the running one takes the newest main.
  const firstLost = new Promise<void>((resolve) => first.onLost(resolve));
  const second = await started();
  assert.equal(second.pid, first.pid, 'the second start reaches the same tray');
  await firstLost;

  second.setRecipe({
    configDir: folder,
    rootName: 'fluideq.txt',
    rootText: '# nothing to do\r\n',
    removeNames: ['fluideq-dsp.txt', 'fluideq-split.txt'],
    removePrefixes: ['fluideq-dsp-'],
  });
  second.show({ tooltip: 'smoke', icon: '', menu: [] });
  // Main quitting: its end of the line goes, and the tray ends after it.
  second.close();
  await engine.broken;

  assert.equal(fs.readFileSync(at('fluideq.txt'), 'utf8'), '# nothing to do\r\n');
  assert.equal(fs.existsSync(at('fluideq-dsp.txt')), false);
  assert.equal(fs.existsSync(at(`fluideq-dsp-${GUID}.txt`)), false);
  assert.equal(fs.existsSync(at('fluideq-owner.txt')), true);
  assert.equal(fs.existsSync(at('config.txt')), true);
  assert.deepEqual(
    fs.readdirSync(folder).filter((name) => name.endsWith('.tmp')),
    [],
    'nothing half-written is left',
  );

  // Gone, and the next start serves in its place.
  const third = await started();
  assert.notEqual(third.pid, first.pid, 'a fresh tray serves after it');
  const again = await engineLine();

  // Main leaves with FluidEQ going on: the tray stays, holding the line,
  // and undoes nothing.
  [`fluideq-dsp-${GUID}.txt`, 'fluideq.txt'].forEach((name) =>
    fs.writeFileSync(at(name), 'live'),
  );
  third.setRecipe({
    configDir: folder,
    rootName: 'fluideq.txt',
    rootText: '# nothing to do\r\n',
    removeNames: [],
    removePrefixes: ['fluideq-dsp-'],
  });
  // The song job goes with it: a stand-in media helper naming one song, the
  // engine's folder and its statuses in the smoke's own folder.
  const engineRoot = at('engine');
  const engineConfig = path.join(engineRoot, 'config');
  fs.mkdirSync(engineConfig, { recursive: true });
  const media = at('media.js');
  const song = { app: 'Spotify.exe', title: 'Smoke Song', artist: 'Band' };
  fs.writeFileSync(
    media,
    `process.stdout.write(${JSON.stringify(JSON.stringify({ ...song, isPlaying: true }))} + '\\n');\nprocess.stdin.resume();\n`,
  );
  const id = songIdentity(song);
  const told = await third.leave(
    { file: process.execPath, args: ['--version'], cwd: folder },
    {
      mediaExe: process.execPath,
      selfId: media,
      configDir: engineConfig,
      statusDir: engineRoot,
      levelsFile: at('song-levels.json'),
      rootName: 'fluideq-programme.txt',
      perOutputPrefix: 'fluideq-programme-',
      mainEndpoint: `{${GUID.toUpperCase()}}`,
    },
  );
  assert.equal(told, true, 'the tray is told main leaves');
  // With main gone, the tray tells the engine the song main would have.
  await whenFile(engineConfig, 'fluideq-programme.txt', (text) =>
    text.includes(`song=${id}`),
  );
  // The engine finishes learning it: the tray remembers the level and tells
  // that output's file, as main would.
  fs.writeFileSync(
    path.join(engineRoot, `status-{${GUID.toUpperCase()}}.json`),
    JSON.stringify({
      version: 1,
      endpoint: `{${GUID.toUpperCase()}}`,
      pid: process.pid,
      locked: true,
      processing: true,
      owner: true,
      problems: [],
      lastSong: { id, level: -11.5, peak: -1, seconds: 120 },
    }),
  );
  await whenFile(engineConfig, `fluideq-programme-${GUID}.txt`, (text) =>
    text.includes('level=-11.50'),
  );
  const levels = JSON.parse(fs.readFileSync(at('song-levels.json'), 'utf8')) as {
    songs: Record<string, { levelLufs: number }>;
  };
  assert.equal(levels.songs[`${GUID}:${id}`]?.levelLufs, -11.5);
  // The next FluidEQ finds the same tray, which kept everything as it was.
  const fourth = await started();
  assert.equal(fourth.pid, third.pid, 'the tray main left is still there');
  assert.equal(fs.readFileSync(at('fluideq.txt'), 'utf8'), 'live');
  assert.equal(fs.existsSync(at(`fluideq-dsp-${GUID}.txt`)), true);

  // And a quit from there is FluidEQ's end, sound and all.
  fourth.close();
  await again.broken;
  assert.equal(fs.readFileSync(at('fluideq.txt'), 'utf8'), '# nothing to do\r\n');
  assert.equal(fs.existsSync(at(`fluideq-dsp-${GUID}.txt`)), false);
  fs.rmSync(folder, { recursive: true, force: true });
  console.log(
    'tray host: started, shared, held the line, undid the quit, served again, outlived main telling the engine the song, and came back to it',
  );
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
