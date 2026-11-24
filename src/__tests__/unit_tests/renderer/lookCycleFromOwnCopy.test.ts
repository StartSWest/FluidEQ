/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ivan, 2026-11-24: "when I turn on auto ... the next one should be the next
 * one in the list, because I'm noticing that it's starting from the
 * beginning ... sometimes it doesn't". The account that publishes FluidEQ's
 * own scenes also holds each one as its own copy, and the lists leave the copy
 * out (`withoutOfficialCopies`). A graph playing the copy was then in no list,
 * so the cycle found the selection nowhere and started from the first look.
 * It now walks on from FluidEQ's row for that scene.
 */

import { memberLookId } from 'common/memberScenes';
import type { IScenePacksListing } from '../../../main/ipc/scenePacks';
import type { IMemberSceneSummary } from '../../../main/memberScenes/store';
import { listedLookOf } from '../../../renderer/utils/memberScenes';

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

const copy = (authorId: string, packId: string, own: boolean) =>
  ({
    lookId: memberLookId(authorId, packId),
    authorId,
    packId,
    version: 3,
    names: { en: packId },
    swatch: ['#050a1a', '#00e5cf'],
    own,
  }) as IMemberSceneSummary;

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
  return { graphStyle, members };
};

describe('the look a selection stands for', () => {
  const officials = [
    { id: 'alpine', lookId: 'premium:alpine' },
    { id: 'borealis', lookId: 'premium:borealis' },
  ];

  it('is FluidEQ’s row for its publisher’s own copy', () => {
    const own = copy(ME, 'alpine', true);
    expect(listedLookOf(own.lookId, [own], officials)).toBe('premium:alpine');
  });

  it('is the selection itself for anything else', () => {
    const theirs = copy(OTHER, 'alpine', false);
    const mine = copy(ME, 'balloon-dawn', true);
    // Somebody else's scene under the same pack name stays itself.
    expect(listedLookOf(theirs.lookId, [theirs], officials)).toBe(
      theirs.lookId,
    );
    // An own scene FluidEQ does not publish stays itself.
    expect(listedLookOf(mine.lookId, [mine], officials)).toBe(mine.lookId);
    expect(listedLookOf('premium:alpine', [], officials)).toBe(
      'premium:alpine',
    );
  });
});

describe('the cycle from a publisher’s own copy', () => {
  it('walks on from FluidEQ’s row, never from the first look', () => {
    const { graphStyle, members } = load();
    const own = copy(ME, 'alpine', true);
    members.adoptMemberSceneListingForTesting({ scenes: [own], locked: [] });
    const ids = graphStyle.getSelectableLooks().map((look) => look.id);
    const at = ids.indexOf('premium:alpine');
    expect(at).toBeGreaterThan(0);
    // The copy itself is not listed: this is the state that lost the place.
    expect(ids).not.toContain(own.lookId);

    graphStyle.setGraphLook(own.lookId);
    expect(graphStyle.getGraphLookId()).toBe(own.lookId);
    graphStyle.cycleGraphLookUnattended(1);

    expect(graphStyle.getGraphLookId()).toBe(ids[at + 1]);
    // The control: from the first look the walk lands somewhere else.
    expect(ids[at + 1]).not.toBe(ids[1]);
  });

  it('walks on from a listed look exactly as before', () => {
    const { graphStyle } = load();
    const ids = graphStyle.getSelectableLooks().map((look) => look.id);
    graphStyle.setGraphLook('premium:alpine');
    graphStyle.cycleGraphLookUnattended(1);
    expect(graphStyle.getGraphLookId()).toBe(
      ids[ids.indexOf('premium:alpine') + 1],
    );
  });
});
