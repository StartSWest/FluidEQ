/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IMemberScenesListing } from '../../../main/ipc/memberScenes';
import type { IMemberSceneSummary } from '../../../main/memberScenes/store';

type TGraphStyleModule = typeof import('../../../renderer/utils/graphStyle');
type TMemberModule = typeof import('../../../renderer/utils/memberScenes');

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const LOOK_ID = `member:${ME}:neon-city`;

const NEON: IMemberSceneSummary = {
  lookId: LOOK_ID,
  authorId: ME,
  packId: 'neon-city',
  version: 1,
  names: { en: 'Neon City', es: 'Ciudad de neón' },
  fallbackStyle: 'skyline',
  swatch: ['#050a1a', '#00e5cf'],
  own: true,
};

const listing = (
  entitled: boolean,
  scenes: IMemberSceneSummary[] = [NEON],
): IMemberScenesListing =>
  entitled
    ? { entitled, scenes, locked: [] }
    : { entitled, scenes: [], locked: scenes };

/** Module state: a fresh registry per case, GPU declared present. */
const load = (storedLookId?: string) => {
  window.localStorage.clear();
  if (storedLookId) {
    window.localStorage.setItem('fluideq-graph-style', storedLookId);
  }
  let graphStyle: TGraphStyleModule | undefined;
  let members: TMemberModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    const health = require('../../../renderer/graph/sceneHealth');
    health.setSceneRenderingAvailableForTesting(true);
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    members = require('../../../renderer/utils/memberScenes');
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    graphStyle = require('../../../renderer/utils/graphStyle');
  });
  if (!graphStyle || !members) {
    throw new Error('modules did not load');
  }
  return { graphStyle, members };
};

describe("a member's scenes in the look store", () => {
  // The control for every case below.
  it('adds a scene the member made to the one list everything reads', () => {
    const { graphStyle, members } = load();
    members.adoptMemberSceneListingForTesting(listing(true));
    const ids = graphStyle.getSelectableLooks([]).map((look) => look.id);
    expect(ids[ids.length - 1]).toBe(LOOK_ID);
  });

  it('draws the selected scene, and keeps the selection across a restart', () => {
    const first = load();
    first.members.adoptMemberSceneListingForTesting(listing(true));
    first.graphStyle.setGraphLook(LOOK_ID);
    expect(first.graphStyle.getGraphLookId()).toBe(LOOK_ID);
    expect(first.graphStyle.getGraphPalette()).toBe('auto');

    const again = load(LOOK_ID);
    expect(again.graphStyle.getGraphLookId()).toBe(LOOK_ID);
  });

  it('never offers a scene without Plus, and lands on its own fallback form', () => {
    const { graphStyle, members } = load(LOOK_ID);
    members.adoptMemberSceneListingForTesting(listing(false));
    expect(
      graphStyle
        .getSelectableLooks([])
        .some((look) => look.id.startsWith('member:')),
    ).toBe(false);
    // The locked row exists, under the locked prefix nothing can select.
    expect(
      members.getLockedMemberScenes().map((scene) => scene.lookId),
    ).toEqual([`locked:${LOOK_ID}`]);
    // Neon City's own fallback form in its own colouring, not the first form.
    expect(graphStyle.getGraphLookId()).toBe('skyline-auto');
  });

  it('keeps the selection until the list has actually arrived', () => {
    const { graphStyle } = load(LOOK_ID);
    expect(graphStyle.getGraphLookId()).toBe(LOOK_ID);
  });

  it('keeps who sent a scene, whether it can be drawn or is locked', () => {
    const SENT: IMemberSceneSummary = {
      ...NEON,
      lookId: 'member:9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d:harbour',
      authorId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      packId: 'harbour',
      own: false,
      authorName: 'Mei Tanaka',
    };
    const { members } = load();
    members.adoptMemberSceneListingForTesting(listing(true, [NEON, SENT]));
    expect(
      members.getUsableMemberScenes().map(({ own, authorName }) => ({
        own,
        authorName,
      })),
    ).toEqual([
      { own: true, authorName: undefined },
      { own: false, authorName: 'Mei Tanaka' },
    ]);
    // Without Plus both are locked, and the one sent by somebody still says
    // so — it must not be listed as the member's own.
    members.adoptMemberSceneListingForTesting(listing(false, [NEON, SENT]));
    expect(
      members.getLockedMemberScenes().map(({ own, authorName }) => ({
        own,
        authorName,
      })),
    ).toEqual([
      { own: true, authorName: undefined },
      { own: false, authorName: 'Mei Tanaka' },
    ]);
  });

  it('stops offering a scene that failed here', () => {
    const { graphStyle, members } = load();
    members.adoptMemberSceneListingForTesting(listing(true));
    members.blockMemberScene(LOOK_ID);
    expect(
      graphStyle.getSelectableLooks([]).map((look) => look.id),
    ).not.toContain(LOOK_ID);
  });
});
