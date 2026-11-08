/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * What was last published from each project's folder, and whether the
 * folder still holds exactly that (`publishedRecords.ts`): any change to the
 * scene's files is seen, a tool's dot-folder is not, and the record outlives
 * a restart of FluidEQ.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createPublishedRecords } from '../../../main/memberScenes/publishedRecords';

let root: string;
let project: string;
let userData: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'published-records-'));
  project = path.join(root, 'Lake');
  userData = path.join(root, 'user');
  fs.mkdirSync(path.join(project, 'art'), { recursive: true });
  fs.mkdirSync(userData);
  fs.writeFileSync(path.join(project, 'pack.json'), '{"id":"lake"}');
  fs.writeFileSync(path.join(project, 'scene.glsl'), 'void main(){}');
  fs.writeFileSync(path.join(project, 'art', 'fish.png'), 'png');
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** Bumps a file's time a second on, as a later save would. */
const touch = (file: string, text?: string) => {
  if (text !== undefined) {
    fs.writeFileSync(file, text);
  }
  const later = new Date(Date.now() + 1000);
  fs.utimesSync(file, later, later);
};

it('says nothing for a folder never published from here', () => {
  expect(createPublishedRecords(userData).stateOf(project)).toBeUndefined();
});

it('is unchanged right after publishing, and across a restart', () => {
  createPublishedRecords(userData).record(project, 'lake', 3);
  // A new instance reads what the last one kept, the path spelled otherwise.
  const again = createPublishedRecords(userData);
  const spelled =
    process.platform === 'win32' ? project.toUpperCase() : project;
  expect(again.stateOf(spelled)).toEqual({
    sceneId: 'lake',
    version: 3,
    unchanged: true,
  });
});

it('sees an edit, a new picture and a removed file as changes', () => {
  const records = createPublishedRecords(userData);
  records.record(project, 'lake', 3);
  touch(path.join(project, 'scene.glsl'), 'void main(){ /* edited */ }');
  expect(records.stateOf(project)?.unchanged).toBe(false);

  records.record(project, 'lake', 4);
  fs.writeFileSync(path.join(project, 'art', 'reef.png'), 'png');
  expect(records.stateOf(project)?.unchanged).toBe(false);

  records.record(project, 'lake', 5);
  fs.rmSync(path.join(project, 'art', 'reef.png'));
  expect(records.stateOf(project)?.unchanged).toBe(false);
});

it('ignores what a tool keeps in a dot-folder', () => {
  const records = createPublishedRecords(userData);
  records.record(project, 'lake', 3);
  fs.mkdirSync(path.join(project, '.claude'));
  fs.writeFileSync(path.join(project, '.claude', 'settings.local.json'), '{}');
  expect(records.stateOf(project)?.unchanged).toBe(true);
  // The control: the same file outside a dot-folder is a change.
  fs.writeFileSync(path.join(project, 'notes.json'), '{}');
  expect(records.stateOf(project)?.unchanged).toBe(false);
});
