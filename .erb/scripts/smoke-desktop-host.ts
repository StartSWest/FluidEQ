/* FluidEQ — GPL-3.0-or-later */

/**
 * `FluidEQ-Scenes --mode desktop`, live, as main drives it for the desktop
 * backgrounds (`wallpaper/desktopHostWire.ts`): a monitor opened and its
 * window told, a scene shown on it, linked and drawn, a scene that does not
 * compile reported while the one drawn stays, paused, closed, and the
 * program ending with its input.
 *
 * Its windows are never shown — nothing here starts the desktop helper that
 * would place one behind the icons — and it plays nothing but silence.
 * Every wait is on an event; a step that never comes is the run failing.
 */
import assert from 'assert/strict';
import { spawn } from 'child_process';
import path from 'path';
import {
  createDesktopHostReader,
  encodeMonitorChoice,
  encodeMonitorClose,
  encodeMonitorOpen,
  encodeMonitorPause,
  encodeMonitorShow,
} from '../../src/main/wallpaper/desktopHostWire';
import type { ISceneHostScene } from '../../src/main/lighting/sceneHostWire';

const executable = path.resolve(
  process.argv[2] ?? 'native/.build/bin/FluidEQ-Scenes.exe',
);
const angleDir = path.resolve(
  process.argv[3] ?? 'node_modules/electron/dist',
);

const scene = (fragmentSource: string): ISceneHostScene => ({
  guarded: false,
  response: { sensitivity: 1, threshold: 0, attack: 0, release: 0 },
  params: [],
  vertexSource: `#version 300 es
uniform vec4 uView;
out vec2 vUv;
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = (corner - uView.xy) / uView.zw;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`,
  fragmentSource,
  view: [0, 0, 1, 1],
  spectrumRect: [0, 0, 1, 1],
});

/** Every message heard, and a wait for the first that matches. */
const createLog = () => {
  const items: string[] = [];
  const waits: { test: (item: string) => boolean; resolve: () => void }[] = [];
  return {
    items,
    push(item: string) {
      items.push(item);
      waits
        .filter((wait) => wait.test(item))
        .forEach((wait) => {
          waits.splice(waits.indexOf(wait), 1);
          wait.resolve();
        });
    },
    until(item: string) {
      return items.includes(item)
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            waits.push({ test: (seen) => seen === item, resolve });
          });
    },
  };
};

const main = async () => {
  const child = spawn(
    executable,
    [
      '--parent-pid',
      String(process.pid),
      '--angle-dir',
      angleDir,
      '--mode',
      'desktop',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
  );
  let said = '';
  child.stderr.on('data', (bytes: Buffer) => {
    said += bytes.toString('utf8');
  });
  const ended = new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? -1));
  });
  const log = createLog();
  let window = BigInt(0);
  child.stdout.on(
    'data',
    createDesktopHostReader({
      window: (monitor, hwnd) => {
        window = hwnd;
        log.push(`window ${monitor}`);
      },
      loaded: (monitor, id) => log.push(`loaded ${monitor} ${id}`),
      drawn: (monitor, id) => log.push(`drawn ${monitor} ${id}`),
      failed: (monitor, id, reason) => log.push(`failed ${monitor} ${id} ${reason}`),
      invalid: (why) => log.push(`invalid ${why}`),
    }),
  );

  child.stdin.write(
    encodeMonitorOpen(
      3,
      { x: -320, y: 0, width: 320, height: 180 },
      { pinned: 0.5, autoFloor: 0.35, fsr: true, smoothing: 'best', paceMs: 0 },
    ),
  );
  await log.until('window 3');
  assert.notEqual(window, BigInt(0), 'the monitor has a window');
  child.stdin.write(
    encodeMonitorShow(
      3,
      11,
      scene(`#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(0.1, 0.6, 0.9, 1.0); }
`),
      true,
    ),
  );
  await log.until('drawn 3 11');
  // The ladder's own choice, held to thirty: a message the host reads, or the
  // broken scene below would never be answered.
  child.stdin.write(
    encodeMonitorChoice(3, {
      autoFloor: 0.35,
      fsr: true,
      smoothing: 'fast',
      paceMs: 1000 / 30,
    }),
  );
  child.stdin.write(
    encodeMonitorShow(
      3,
      12,
      scene(`#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = notDeclaredAnywhere; }
`),
      false,
    ),
  );
  await log.until('failed 3 12 compile');
  child.stdin.write(encodeMonitorPause(3, true));
  child.stdin.write(encodeMonitorClose(3));
  child.stdin.end();
  assert.equal(await ended, 0, `the program ends with its input (${said})`);
  assert.deepEqual(log.items, [
    'window 3',
    'loaded 3 11',
    'drawn 3 11',
    'failed 3 12 compile',
  ]);
  console.log(
    'desktop host: opened, told its window, drawn, a broken scene refused, closed',
  );
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
