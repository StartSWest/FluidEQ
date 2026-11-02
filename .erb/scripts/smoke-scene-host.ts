/* FluidEQ — GPL-3.0-or-later */

/**
 * `FluidEQ-Scenes.exe` as main runs it for the desk lights
 * (`lighting/lampSceneHost.ts`), live: a scene shown, linked, and drawn into
 * grids from what the default output plays — or from its silence, which is
 * the scenes' clock when nothing plays — and the program ending when its
 * input does. Draws off screen and plays nothing but silence.
 *
 * Every wait is on an event; a step that never comes is the run failing.
 */
import assert from 'assert/strict';
import { spawn } from 'child_process';
import path from 'path';
import {
  createSceneHostReader,
  encodeShow,
  type ISceneHostGrid,
} from '../../src/main/lighting/sceneHostWire';

const executable = path.resolve(
  process.argv[2] ?? 'native/.build/bin/FluidEQ-Scenes.exe',
);
const angleDir = path.resolve(
  process.argv[3] ?? 'node_modules/electron/dist',
);

const VERTEX = `#version 300 es
uniform vec4 uView;
out vec2 vUv;
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = (corner - uView.xy) / uView.zw;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;
// Green as the slider says: the grid is the scene's, not its swatch.
const FRAGMENT = `#version 300 es
precision highp float;
uniform float uParam_glow;
out vec4 fragColor;
void main() { fragColor = vec4(0.0, uParam_glow, 0.0, 1.0); }
`;

const main = async () => {
  const child = spawn(
    executable,
    ['--parent-pid', String(process.pid), '--angle-dir', angleDir],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
  );
  let said = '';
  child.stderr.on('data', (bytes: Buffer) => {
    said += bytes.toString('utf8');
  });
  const ended = new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? -1));
  });
  let onLoaded: (id: number) => void = () => undefined;
  let onGrid: (grid: ISceneHostGrid) => void = () => undefined;
  let onBroken: (error: Error) => void = () => undefined;
  const broken = new Promise<never>((_resolve, reject) => {
    onBroken = reject;
  });
  const loaded = Promise.race([
    new Promise<number>((resolve) => {
      onLoaded = resolve;
    }),
    broken,
  ]);
  const drawn = Promise.race([
    new Promise<ISceneHostGrid>((resolve) => {
      onGrid = resolve;
    }),
    broken,
  ]);
  const read = createSceneHostReader({
    grid: (grid) => {
      if (grid.drawn) {
        onGrid(grid);
      }
    },
    picture: () => undefined,
    loaded: (id) => onLoaded(id),
    failed: (id, reason, words) =>
      onBroken(new Error(`scene ${id} failed: ${reason} ${words}`)),
    invalid: (why) => onBroken(new Error(`the stream broke: ${why}`)),
  });
  child.stdout.on('data', (bytes: Buffer) => read(bytes));
  child.stdin.write(
    encodeShow(7, [[10, 20, 30]], {
      guarded: false,
      response: { sensitivity: 1, threshold: 0, attack: 0, release: 0 },
      params: [{ id: 'glow', value: 0.5, min: 0, max: 1 }],
      vertexSource: VERTEX,
      fragmentSource: FRAGMENT,
      view: [0, 0, 1, 1],
      spectrumRect: [0, 0, 1, 1],
    }),
  );
  assert.equal(await loaded, 7, 'the scene shown is the one linked');
  const grid = await drawn;
  const middle = (13 * grid.width + 24) * 3;
  assert.ok(
    Math.abs(grid.rgb[middle + 1] - 128) <= 2 && grid.rgb[middle] === 0,
    `the grid is the scene drawn (got ${grid.rgb.slice(middle, middle + 3)})`,
  );
  child.stdin.end();
  assert.equal(await ended, 0, `the program ends with its input (${said})`);
  console.log('scene host: shown, linked, drawn from the output, ended with main');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
