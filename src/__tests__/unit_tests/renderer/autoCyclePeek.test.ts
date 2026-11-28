/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What Auto builds ahead is what Auto then puts on (Ivan, 2026-11-24: "On
 * the auto, can we preload the next plus visualizer before showing it?").
 * The look prepared comes from `peekGraphLookUnattended`, and a peek that
 * walked a list of its own, or skipped by other rules, would build one scene
 * while the step put on another: the work thrown away and the loading ring
 * back. Held from every place in the list, from a publisher's own copy, and
 * past a stranger's scene the unattended walk passes over.
 */

import { memberLookId } from 'common/memberScenes';
import type { IScenePacksListing } from '../../../main/ipc/scenePacks';
import type { IMemberSceneSummary } from '../../../main/memberScenes/store';

type TGraphStyleModule = typeof import('../../../renderer/utils/graphStyle');
type TMemberModule = typeof import('../../../renderer/utils/memberScenes');
type TPacksModule = typeof import('../../../renderer/utils/scenePacks');

const ME = 'faaed582-d6f4-4e70-999b-86e8518a7dc4';
const OTHER = '40000000-0000-4000-8000-0000000000bb';

const pack = (id: string) =>
  ({
    id,
    version: 3,
    revision: 'rev-a',
    names: { en: id },
    swatch: ['#00e5cf', '#ff3cac'],
  }) as IScenePacksListing['packs'][number];

const memberScene = (authorId: string, packId: string, own: boolean) =>
  ({
    lookId: memberLookId(authorId, packId),
    authorId,
    packId,
    version: 3,
    names: { en: packId },
    swatch: ['#050a1a', '#00e5cf'],
    own,
  }) as IMemberSceneSummary;

const STRANGER = memberScene(OTHER, 'neon-rain', false);
const MINE = memberScene(ME, 'balloon-dawn', true);
const OWN_COPY = memberScene(ME, 'alpine', true);

const load = () => {
  window.localStorage.clear();
  let graphStyle: TGraphStyleModule | undefined;
  let members: TMemberModule | undefined;
  let packs: TPacksModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    const health = require('../../../renderer/graph/sceneHealth');
    health.setSceneRenderingAvailableForTesting(true);
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    packs = require('../../../renderer/utils/scenePacks');
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    members = require('../../../renderer/utils/memberScenes');
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    graphStyle = require('../../../renderer/utils/graphStyle');
  });
  if (!graphStyle || !members || !packs) {
    throw new Error('modules did not load');
  }
  packs.adoptScenePackListingForTesting({
    packs: [pack('alpine'), pack('borealis')],
    locked: [],
  });
  members.adoptMemberSceneListingForTesting({
    scenes: [STRANGER, MINE, OWN_COPY],
    locked: [],
  });
  return graphStyle;
};

/** Peeks from `from`, then steps from it, and says both. */
const peekThenStep = (graphStyle: TGraphStyleModule, from: string) => {
  graphStyle.setGraphLook(from);
  const peeked = graphStyle.peekGraphLookUnattended(1);
  // The peek moves nothing.
  expect(graphStyle.getGraphLookId()).toBe(from);
  graphStyle.cycleGraphLookUnattended(1);
  return { peeked, stepped: graphStyle.getGraphLookId() };
};

describe('the look Auto prepares', () => {
  it('is the one the step puts on, from every look in the list', () => {
    const graphStyle = load();
    const ids = graphStyle.getLookWalk().map((look) => look.id);
    expect(ids).toEqual(
      expect.arrayContaining(['premium:alpine', 'premium:borealis']),
    );
    ids.forEach((from) => {
      const { peeked, stepped } = peekThenStep(graphStyle, from);
      expect(peeked).toBe(stepped);
    });
  });

  it('passes over a stranger’s scene as the step does', () => {
    const graphStyle = load();
    const ids = graphStyle.getLookWalk().map((look) => look.id);
    const at = ids.indexOf(STRANGER.lookId);
    expect(at).toBeGreaterThan(0);
    const before = ids[at - 1];
    // The control: a press walks onto the stranger's scene from here, so a
    // peek by the press's rules would name a look Auto never puts on.
    graphStyle.setGraphLook(before);
    graphStyle.cycleGraphLook(1);
    expect(graphStyle.getGraphLookId()).toBe(STRANGER.lookId);

    const { peeked, stepped } = peekThenStep(graphStyle, before);
    expect(peeked).toBe(stepped);
    expect(peeked).not.toBe(STRANGER.lookId);
  });

  it('walks on from FluidEQ’s row while its publisher’s own copy plays', () => {
    const graphStyle = load();
    const ids = graphStyle.getLookWalk().map((look) => look.id);
    const { peeked, stepped } = peekThenStep(graphStyle, OWN_COPY.lookId);
    expect(peeked).toBe(stepped);
    expect(peeked).toBe(ids[ids.indexOf('premium:alpine') + 1]);
  });
});
