/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePacksListing } from '../../../main/ipc/scenePacks';

type TGraphStyleModule = typeof import('../../../renderer/utils/graphStyle');
type TScenePacksModule = typeof import('../../../renderer/utils/scenePacks');
type THealthModule = typeof import('../../../renderer/graph/sceneHealth');

const AURORA = {
  id: 'aurora',
  version: 1,
  names: { en: 'Aurora', es: 'Aurora boreal' },
  fallbackStyle: 'area' as const,
  swatch: ['#00e5cf', '#ff3cac'],
};

const listing = (
  entitled: boolean,
  packs: IScenePacksListing['packs'] = [AURORA],
): IScenePacksListing => ({ entitled, packs, locked: [] });

/**
 * The look store is module state, so each case gets a fresh module registry
 * with the GPU declared present and whatever is in storage already there.
 */
const load = (storedLookId?: string) => {
  window.localStorage.clear();
  if (storedLookId) {
    window.localStorage.setItem('fluideq-graph-style', storedLookId);
  }
  let graphStyle: TGraphStyleModule | undefined;
  let scenePacks: TScenePacksModule | undefined;
  let health: THealthModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    health = require('../../../renderer/graph/sceneHealth');
    health?.setSceneRenderingAvailableForTesting(true);
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    scenePacks = require('../../../renderer/utils/scenePacks');
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    graphStyle = require('../../../renderer/utils/graphStyle');
  });
  if (!graphStyle || !scenePacks || !health) {
    throw new Error('modules did not load');
  }
  return { graphStyle, scenePacks, health };
};

describe('premium looks in the look store', () => {
  it('offers no premium rows before any pack has arrived', () => {
    const { graphStyle } = load();
    expect(
      graphStyle
        .getSelectableLooks([])
        .some((look) => look.id.startsWith('premium:')),
    ).toBe(false);
  });

  it('adds usable scenes to the one list everything reads, after the free and custom looks', () => {
    const { graphStyle, scenePacks } = load();
    scenePacks.adoptScenePackListingForTesting(listing(true));

    const ids = graphStyle.getSelectableLooks([]).map((look) => look.id);
    expect(ids[ids.length - 1]).toBe('premium:aurora');
    expect(ids.filter((id) => id.startsWith('premium:'))).toHaveLength(1);
  });

  /**
   * The locked rows: what the free app shows instead of hiding Plus. They
   * carry their own prefix so nothing that selects, cycles or remembers a
   * look can ever land on one.
   */
  it('shows the catalogue as locked rows without a subscription, and never as selectable looks', () => {
    const { graphStyle, scenePacks } = load();
    scenePacks.adoptScenePackListingForTesting({
      entitled: false,
      packs: [],
      locked: [AURORA],
    });
    const locked = scenePacks.getLockedScenes();
    expect(locked.map((scene) => scene.lookId)).toEqual(['locked:aurora']);
    expect(locked[0].names.es).toBe('Aurora boreal');
    expect(scenePacks.getUsableScenes()).toHaveLength(0);
    expect(
      graphStyle
        .getSelectableLooks([])
        .some((look) => look.id.startsWith('locked:')),
    ).toBe(false);
  });

  it('drops the locked rows once the subscription is on, and never shows them without a GPU', () => {
    const entitled = load();
    entitled.scenePacks.adoptScenePackListingForTesting({
      entitled: true,
      packs: [AURORA],
      locked: [],
    });
    expect(entitled.scenePacks.getLockedScenes()).toHaveLength(0);
    expect(entitled.scenePacks.getUsableScenes()).toHaveLength(1);

    const noGpu = load();
    noGpu.health.setSceneRenderingAvailableForTesting(false);
    noGpu.scenePacks.adoptScenePackListingForTesting({
      entitled: false,
      packs: [],
      locked: [AURORA],
    });
    expect(noGpu.scenePacks.getLockedScenes()).toHaveLength(0);
  });

  it('offers nothing premium without a subscription, or without a GPU, or when quarantined', () => {
    const noSub = load();
    noSub.scenePacks.adoptScenePackListingForTesting(listing(false));
    expect(noSub.scenePacks.getUsableScenes()).toHaveLength(0);

    const noGpu = load();
    noGpu.health.setSceneRenderingAvailableForTesting(false);
    noGpu.scenePacks.adoptScenePackListingForTesting(listing(true));
    expect(noGpu.scenePacks.getUsableScenes()).toHaveLength(0);

    const quarantined = load();
    quarantined.scenePacks.adoptScenePackListingForTesting(
      listing(true, [{ ...AURORA, quarantined: 'compile' }]),
    );
    expect(quarantined.scenePacks.getUsableScenes()).toHaveLength(0);
  });

  /**
   * The quiet one. An unrecognised id used to fall through to the default, so a
   * premium selection was rewritten to Fluid on every launch and nothing
   * failed anywhere.
   */
  it('keeps a premium selection across a restart, even before the packs arrive', () => {
    const { graphStyle } = load('premium:aurora');
    expect(graphStyle.getGraphLookId()).toBe('premium:aurora');
  });

  it('draws a premium selection as its fallback form while the scene is not running', () => {
    const { graphStyle, scenePacks } = load('premium:aurora');
    scenePacks.adoptScenePackListingForTesting(listing(true));
    const resolved = graphStyle.getResolvedLook();
    expect(resolved.style).toBe('area');
    // The chart is told which canvas to mount separately, and this is the
    // answer that says "the GPU one".
    const scene = graphStyle.useSceneLook;
    expect(typeof scene).toBe('function');
  });

  it('cycles through premium rows and wraps back to the first free form', () => {
    const { graphStyle, scenePacks } = load();
    scenePacks.adoptScenePackListingForTesting(listing(true));
    const ids = graphStyle.getSelectableLooks([]).map((look) => look.id);

    graphStyle.setGraphLook(ids[ids.length - 2]);
    graphStyle.cycleGraphLook(1);
    expect(graphStyle.getGraphLookId()).toBe('premium:aurora');
    graphStyle.cycleGraphLook(1);
    expect(graphStyle.getGraphLookId()).toBe(ids[0]);
  });

  /**
   * Somebody who chose an aurora should land on the nearest free form when
   * it goes away — not on Fluid.
   */
  it('lands on the scene’s own fallback when the subscription lapses', () => {
    const { graphStyle, scenePacks } = load('premium:aurora');
    scenePacks.adoptScenePackListingForTesting(listing(true));
    expect(graphStyle.getGraphLookId()).toBe('premium:aurora');

    scenePacks.adoptScenePackListingForTesting(listing(false));
    expect(graphStyle.getGraphLookId()).toBe('area-auto');
    expect(window.localStorage.getItem('fluideq-graph-style')).toBe(
      'area-auto',
    );
  });

  it('does not re-point a premium selection on a listing that has not loaded yet', () => {
    const { graphStyle } = load('premium:aurora');
    // No listing adopted: the store has heard nothing from the main process.
    expect(graphStyle.getGraphLookId()).toBe('premium:aurora');
  });

  it('has no palette to toggle', () => {
    const { graphStyle, scenePacks } = load('premium:aurora');
    scenePacks.adoptScenePackListingForTesting(listing(true));
    expect(graphStyle.getGraphPalette()).toBe('auto');
    graphStyle.setGraphPalette('rainbow');
    expect(graphStyle.getGraphLookId()).toBe('premium:aurora');
  });

  it('stops offering a scene the renderer reported as failed, at once', async () => {
    const { scenePacks } = load();
    scenePacks.adoptScenePackListingForTesting(listing(true));
    expect(scenePacks.getUsableScenes()).toHaveLength(1);

    await scenePacks.reportSceneFailure('aurora', 'compile');
    expect(scenePacks.getUsableScenes()).toHaveLength(0);

    scenePacks.unblockScene('aurora');
    expect(scenePacks.getUsableScenes()).toHaveLength(1);
  });
});
