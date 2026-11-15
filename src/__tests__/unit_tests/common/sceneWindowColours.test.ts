/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The colours a scene names for the window around it (Ivan, 2026-11-14: "we
 * want the agent to give those colours"): read whole or not at all, by the
 * same bytes the server signs with, checked strictly for their author and
 * kept through the pack's own reader.
 */

import { checkMemberScene } from 'common/memberScenes';
import { normalizeScenePack } from 'common/scenePacks';
import {
  readSceneWindowColours,
  windowColoursProblem,
} from 'common/sceneWindowColours';
import { memberPack } from '../../utils/memberSceneFixtures';

const NAMED = { surface: '#1d2b4f', accent: '#5fd4ff', glow: '#ff8fd0' };

describe('reading them', () => {
  it('keeps all three, in lower case, and nothing else', () => {
    expect(
      readSceneWindowColours({
        surface: '#1D2B4F',
        accent: '#5fd4ff',
        glow: '#FF8FD0',
        extra: '#000000',
      }),
    ).toEqual(NAMED);
  });

  it('keeps none when any one is missing or is not #rrggbb', () => {
    expect(
      readSceneWindowColours({ ...NAMED, glow: undefined }),
    ).toBeUndefined();
    expect(
      readSceneWindowColours({ ...NAMED, accent: 'blue' }),
    ).toBeUndefined();
    expect(
      readSceneWindowColours({ ...NAMED, surface: '#123' }),
    ).toBeUndefined();
    expect(readSceneWindowColours(['#1d2b4f'])).toBeUndefined();
    expect(readSceneWindowColours(undefined)).toBeUndefined();
  });

  it('says missing, bad or fine for an author', () => {
    expect(windowColoursProblem(undefined)).toBe('missing');
    expect(windowColoursProblem({ surface: '#1d2b4f' })).toBe('bad');
    expect(windowColoursProblem(NAMED)).toBeUndefined();
  });
});

describe('in a pack', () => {
  it('is kept by the pack reader, and a broken set is dropped, never refused', () => {
    const named = normalizeScenePack({ ...memberPack(), windowColours: NAMED });
    expect(named?.windowColours).toEqual(NAMED);
    const broken = normalizeScenePack({
      ...memberPack(),
      windowColours: { ...NAMED, accent: 'nope' },
    });
    expect(broken).toBeDefined();
    expect(broken?.windowColours).toBeUndefined();
  });

  it('is checked for its author: a broken set is named, an absent one is not', () => {
    expect(checkMemberScene({ ...memberPack(), windowColours: NAMED }).ok).toBe(
      true,
    );
    // Absent plays: the window takes colours from the scene's palette.
    expect(checkMemberScene(memberPack()).ok).toBe(true);
    const broken = checkMemberScene({
      ...memberPack(),
      windowColours: { surface: '#1d2b4f', accent: '#5fd4ff' },
    });
    expect(broken).toEqual({
      ok: false,
      problems: expect.arrayContaining([
        { code: 'bad-window-colours', file: 'pack.json' },
      ]),
    });
  });
});
