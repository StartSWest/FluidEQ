/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * A scene needs no fallback look, and every pack this app writes still
 * carries one for older FluidEQ (Ivan, 2026-11-14: "we cannot have
 * fallbacks, so remove all related to that"). His Alpine named "canyon",
 * the Studio refused it, and taking the field out refused it too: "fallbackStyle
 * is not one of the looks FluidEQ has". FluidEQ 2.5.2 and before, and the
 * gallery's publish check, still require a style name, so the app writes the
 * same one into every pack it builds, whatever the project says.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { GRAPH_STYLES } from '../../../common/graphStyles';
import { checkMemberScene } from '../../../common/memberScenes';
import {
  LEGACY_FALLBACK_STYLE,
  normalizeScenePack,
} from '../../../common/scenePacks';
import storedScenePack from '../../../common/sceneStoredPack';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import { readProject } from '../../../main/memberScenes/project';
import { daylightControl } from '../../utils/memberSceneFixtures';

const SOURCE = `vec4 sceneColour(vec2 uv) {
  return vec4(uAccent * texture(uSpectrumSlow, vec2(uv.x, 0.5)).r, 1.0);
}
`;

const manifest = (over: Record<string, unknown> = {}) => ({
  id: 'alpine-test',
  version: 1,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: 'Alpine Test' },
  swatch: ['#000000', '#00e5cf'],
  sourceFile: 'scene.frag',
  params: [daylightControl()],
  ...over,
});

let root: string;
let project: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-fallback-'));
  project = path.join(root, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'scene.frag'), SOURCE);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const build = async (pack: Record<string, unknown>) => {
  fs.writeFileSync(path.join(project, 'pack.json'), JSON.stringify(pack));
  return readProject(project);
};

describe('a scene with no fallback', () => {
  it('passes the Studio’s own check, as a pack', () => {
    const raw = {
      schema: 1,
      id: 'alpine-test',
      version: 1,
      names: { en: 'Alpine Test' },
      swatch: ['#000000', '#00e5cf'],
      source: SOURCE,
    };
    expect(checkMemberScene(raw).ok).toBe(true);
    // The control: the check still refuses what is really wrong.
    expect(checkMemberScene({ ...raw, swatch: ['#000000'] }).ok).toBe(false);
  });

  it('builds from a project whose pack.json names none', async () => {
    const built = await build(manifest());
    expect(built.ok).toBe(true);
  });

  it('builds from one naming a look FluidEQ has not got, as Alpine did', async () => {
    const built = await build(manifest({ fallbackStyle: 'canyon' }));
    expect(built.ok).toBe(true);
  });
});

describe('what an older FluidEQ is given', () => {
  it('carries the app’s fallback in every pack a project builds, whatever it said', async () => {
    const without = await build(manifest());
    const named = await build(manifest({ fallbackStyle: 'skyline' }));
    if (!without.ok || !named.ok) {
      throw new Error('both build');
    }
    // What is published and shared is the stored layout of the built pack.
    expect(storedScenePack(without.pack).fallbackStyle).toBe(
      LEGACY_FALLBACK_STYLE,
    );
    expect(storedScenePack(named.pack).fallbackStyle).toBe(
      LEGACY_FALLBACK_STYLE,
    );
  });

  it('is a look every FluidEQ has, so 2.5.2’s check and the gallery’s accept it', () => {
    expect(GRAPH_STYLES).toContain(LEGACY_FALLBACK_STYLE);
    // The gallery's publish check asks for a lowercase style name.
    expect(LEGACY_FALLBACK_STYLE).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('is what this version reads, whatever a pack names: nothing of it is used', () => {
    const pack = normalizeScenePack({
      schema: 1,
      id: 'alpine-test',
      version: 1,
      names: { en: 'Alpine Test' },
      fallbackStyle: 'skyline',
      swatch: ['#000000', '#00e5cf'],
      source: SOURCE,
    });
    expect(pack?.fallbackStyle).toBe(LEGACY_FALLBACK_STYLE);
  });
});
