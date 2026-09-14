/**
 * Scene code this computer will not run again, kept by what ran rather than
 * by which look carried it. What is held here: a reset the scene is blamed
 * for outlives an app update and nothing else does; the record is the same
 * one for every place that runs the code; and the window cannot grow it or
 * shorten it by reporting.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { MAX_SHADER_BYTES } from '../../../common/scenePacks';
import {
  MAX_SCENE_REFUSALS,
  createSceneRefusals,
  isSceneRefusal,
  readRefusedSource,
} from '../../../main/sceneRefusals';

const STORM = 'vec4 sceneColour(vec2 uv) { return vec4(uv, 1.0, 1.0); }';
const CALM = 'vec4 sceneColour(vec2 uv) { return vec4(0.0); }';

let userDataDir: string;

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-refusals-'));
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

const build = (appVersion = '1.0.0') =>
  createSceneRefusals({ userDataDir, appVersion });

it('refuses the code wherever it came from, and only that code', () => {
  const refusals = build();
  expect(refusals.refuse(STORM, 'gpu-reset')).toBe(true);
  expect(refusals.refusalOf(STORM)).toBe('gpu-reset');
  // The control: other code is untouched.
  expect(refusals.refusalOf(CALM)).toBeUndefined();
  // Kept by content, not by the text of a name or an id.
  const file = fs.readFileSync(
    path.join(userDataDir, 'scene-refusals.json'),
    'utf8',
  );
  expect(file).not.toContain('sceneColour');
  expect(Object.keys(JSON.parse(file))[0]).toMatch(/^[0-9a-f]{64}$/);
});

it('keeps a reset the scene is blamed for across builds, and nothing else', () => {
  const first = build('1.0.0');
  first.refuse(STORM, 'gpu-reset');
  first.refuse('// compile', 'compile');
  first.refuse('// lost', 'context-lost');
  first.refuse('// heavy', 'too-heavy');

  const same = build('1.0.0');
  expect(same.refusalOf(STORM)).toBe('gpu-reset');
  expect(same.refusalOf('// compile')).toBe('compile');
  expect(same.refusalOf('// lost')).toBe('context-lost');
  expect(same.refusalOf('// heavy')).toBe('too-heavy');

  // An update: sleep, a driver update or another program lose every context
  // too, and a timing or a compile may come out differently now.
  const next = build('1.0.1');
  expect(next.refusalOf(STORM)).toBe('gpu-reset');
  expect(next.refusalOf('// compile')).toBeUndefined();
  expect(next.refusalOf('// lost')).toBeUndefined();
  expect(next.refusalOf('// heavy')).toBeUndefined();
});

it('never lets a lesser report shorten a blamed reset', () => {
  const refusals = build();
  refusals.refuse(STORM, 'gpu-reset');
  expect(refusals.refuse(STORM, 'compile')).toBe(false);
  expect(refusals.refuse(STORM, 'context-lost')).toBe(false);
  expect(refusals.refuse(STORM, 'gpu-reset')).toBe(false);
  expect(build('2.0.0').refusalOf(STORM)).toBe('gpu-reset');
  // The other way round, a reset does replace a lesser refusal.
  refusals.refuse(CALM, 'compile');
  expect(refusals.refuse(CALM, 'gpu-reset')).toBe(true);
  expect(build('2.0.0').refusalOf(CALM)).toBe('gpu-reset');
});

it('holds a bounded number, letting go of the oldest first', () => {
  const refusals = build();
  for (let index = 0; index <= MAX_SCENE_REFUSALS; index += 1) {
    refusals.refuse(`// scene ${index}`, 'gpu-reset');
  }
  const again = build();
  expect(again.refusalOf('// scene 0')).toBeUndefined();
  expect(again.refusalOf('// scene 1')).toBe('gpu-reset');
  expect(again.refusalOf(`// scene ${MAX_SCENE_REFUSALS}`)).toBe('gpu-reset');
});

it('reads a damaged or edited file as nothing refused, not as a crash', () => {
  const file = path.join(userDataDir, 'scene-refusals.json');
  fs.writeFileSync(file, '{ not json');
  expect(build().refusalOf(STORM)).toBeUndefined();
  fs.writeFileSync(
    file,
    JSON.stringify({ 'not-a-hash': 'gpu-reset@1.0.0', ['a'.repeat(64)]: 7 }),
  );
  const refusals = build();
  expect(refusals.refusalOf(STORM)).toBeUndefined();
  // Still writable afterwards.
  expect(refusals.refuse(STORM, 'gpu-reset')).toBe(true);
  expect(build().refusalOf(STORM)).toBe('gpu-reset');
});

it('takes from the window only a source a scene could carry, and a known reason', () => {
  expect(readRefusedSource(STORM)).toBe(STORM);
  expect(readRefusedSource('')).toBeUndefined();
  expect(readRefusedSource(42)).toBeUndefined();
  expect(readRefusedSource('x'.repeat(MAX_SHADER_BYTES + 1))).toBeUndefined();
  expect(readRefusedSource('x'.repeat(MAX_SHADER_BYTES))).toBeDefined();
  expect(isSceneRefusal('gpu-reset')).toBe(true);
  expect(isSceneRefusal('too-heavy')).toBe(true);
  expect(isSceneRefusal('everything')).toBe(false);
  expect(isSceneRefusal(undefined)).toBe(false);
});
