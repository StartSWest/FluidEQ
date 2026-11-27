/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ivan, 2026-11-27: "when deleting a custom look, please jump back to the
 * previous one instead of jumping to Analyzer always". Deleting the look on
 * the graph used to put the Analyzer on whatever had been playing before. It
 * now goes back to the look played before it, through a short list of the
 * looks played kept beside the selection (`lookHistory.ts`), and lands on
 * the Analyzer only when nothing played before can go back on.
 */

import {
  DEFAULT_GRAPH_LOOK_ID,
  GRAPH_FORM_LOOKS,
  type IGraphLook,
} from 'common/graphStyles';
import { createDraftLook, type ICustomLook } from 'common/customLooks';
import type { IScenePacksListing } from '../../../main/ipc/scenePacks';

type TGraphStyle = typeof import('../../../renderer/utils/graphStyle');
type TCustomLooks = typeof import('../../../renderer/utils/customLooks');
type THistory = typeof import('../../../renderer/utils/lookHistory');
type TPacks = typeof import('../../../renderer/utils/scenePacks');

const HISTORY_KEY = 'fluideq-graph-look-history';

const formAt = (index: number): IGraphLook => {
  const form = GRAPH_FORM_LOOKS[index];
  if (!form) {
    throw new Error(`no form at ${index}`);
  }
  return form;
};

// Two standard looks that are not the Analyzer, so a return to one of them
// cannot pass because the fallback happens to be the same look.
const BARS = formAt(1).id;
const CIRCLE = formAt(2).id;

const pack = (id: string) =>
  ({
    id,
    version: 3,
    revision: 'rev-a',
    names: { en: id },
    swatch: ['#00e5cf', '#ff3cac'],
  }) as IScenePacksListing['packs'][number];

interface ILoaded {
  graphStyle: TGraphStyle;
  customLooks: TCustomLooks;
  history: THistory;
  packs: TPacks;
}

/**
 * The look store as a launch builds it, from whatever storage holds: a
 * fresh install unless `restart` keeps what the last run wrote.
 */
const load = ({ restart = false } = {}): ILoaded => {
  if (!restart) {
    window.localStorage.clear();
  }
  let loaded: ILoaded | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require, @typescript-eslint/no-var-requires */
    const health = require('../../../renderer/graph/sceneHealth');
    health.setSceneRenderingAvailableForTesting(true);
    const packs: TPacks = require('../../../renderer/utils/scenePacks');
    const customLooks: TCustomLooks = require('../../../renderer/utils/customLooks');
    const history: THistory = require('../../../renderer/utils/lookHistory');
    const graphStyle: TGraphStyle = require('../../../renderer/utils/graphStyle');
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */
    loaded = { graphStyle, customLooks, history, packs };
  });
  if (!loaded) {
    throw new Error('modules did not load');
  }
  return loaded;
};

/** A look of the listener's own, saved, under another form than BARS. */
const ownLook = ({ customLooks }: ILoaded, index = 3): ICustomLook => {
  const look = createDraftLook(formAt(index).style, 'rainbow', 'Mine');
  customLooks.saveCustomLook(look);
  return look;
};

const storedHistory = (): unknown =>
  JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? 'null');

describe('deleting the look on the graph', () => {
  it('goes back to the look played before it', () => {
    const loaded = load();
    const { graphStyle, customLooks } = loaded;
    expect(BARS).not.toBe(DEFAULT_GRAPH_LOOK_ID);
    graphStyle.setGraphLook(BARS);
    const mine = ownLook(loaded);
    graphStyle.setGraphLook(mine.id);
    expect(graphStyle.getGraphLookId()).toBe(mine.id);

    customLooks.deleteCustomLook(mine.id);

    expect(graphStyle.getGraphLookId()).toBe(BARS);
    expect(graphStyle.getResolvedLook().id).toBe(BARS);
    // The one it went back to is on the graph, so no longer behind it.
    expect(loaded.history.getLookHistory()).not.toContain(BARS);
  });

  it('goes back one look at a time through several deleted in a row', () => {
    const loaded = load();
    const { graphStyle, customLooks } = loaded;
    graphStyle.setGraphLook(BARS);
    const first = ownLook(loaded, 3);
    const second = ownLook(loaded, 4);
    graphStyle.setGraphLook(first.id);
    graphStyle.setGraphLook(second.id);

    customLooks.deleteCustomLook(second.id);
    expect(graphStyle.getGraphLookId()).toBe(first.id);
    customLooks.deleteCustomLook(first.id);
    expect(graphStyle.getGraphLookId()).toBe(BARS);
  });

  it('still goes back after a restart', () => {
    const before = load();
    before.graphStyle.setGraphLook(BARS);
    const mine = ownLook(before);
    before.graphStyle.setGraphLook(mine.id);
    expect(storedHistory()).toEqual([BARS, DEFAULT_GRAPH_LOOK_ID]);

    const after = load({ restart: true });
    expect(after.graphStyle.getGraphLookId()).toBe(mine.id);
    after.customLooks.deleteCustomLook(mine.id);
    expect(after.graphStyle.getGraphLookId()).toBe(BARS);
  });

  it('lands on the Analyzer after a restart that kept no list', () => {
    // The control for the case above: the stored list is what it went back
    // through, not anything else the launch remembers.
    const before = load();
    before.graphStyle.setGraphLook(BARS);
    const mine = ownLook(before);
    before.graphStyle.setGraphLook(mine.id);
    window.localStorage.removeItem(HISTORY_KEY);

    const after = load({ restart: true });
    after.customLooks.deleteCustomLook(mine.id);
    expect(after.graphStyle.getGraphLookId()).toBe(DEFAULT_GRAPH_LOOK_ID);
  });
});

describe('a look played before that is gone', () => {
  it('is passed over for the Analyzer when nothing else was played', () => {
    const loaded = load();
    const { graphStyle, customLooks } = loaded;
    const earlier = ownLook(loaded, 3);
    const mine = ownLook(loaded, 4);
    graphStyle.setGraphLook(earlier.id);
    graphStyle.setGraphLook(mine.id);

    customLooks.deleteCustomLook(earlier.id);
    customLooks.deleteCustomLook(mine.id);

    expect(graphStyle.getGraphLookId()).toBe(DEFAULT_GRAPH_LOOK_ID);
  });

  it('comes back when it is still there (the control)', () => {
    const loaded = load();
    const { graphStyle, customLooks } = loaded;
    const earlier = ownLook(loaded, 3);
    const mine = ownLook(loaded, 4);
    graphStyle.setGraphLook(earlier.id);
    graphStyle.setGraphLook(mine.id);

    customLooks.deleteCustomLook(mine.id);

    expect(graphStyle.getGraphLookId()).toBe(earlier.id);
  });

  it('is passed over for the one played before it', () => {
    const loaded = load();
    const { graphStyle, customLooks } = loaded;
    graphStyle.setGraphLook(BARS);
    const earlier = ownLook(loaded, 3);
    const mine = ownLook(loaded, 4);
    graphStyle.setGraphLook(earlier.id);
    graphStyle.setGraphLook(mine.id);

    customLooks.deleteCustomLook(earlier.id);
    customLooks.deleteCustomLook(mine.id);

    expect(graphStyle.getGraphLookId()).toBe(BARS);
  });

  it('is passed over when it is a scene that can no longer play', () => {
    const loaded = load();
    const { graphStyle, customLooks, packs } = loaded;
    packs.adoptScenePackListingForTesting({
      packs: [pack('alpine')],
      locked: [],
    });
    graphStyle.setGraphLook(CIRCLE);
    graphStyle.setGraphLook('premium:alpine');
    const mine = ownLook(loaded);
    graphStyle.setGraphLook(mine.id);
    // Removed from the account.
    packs.adoptScenePackListingForTesting({ packs: [], locked: [] });

    customLooks.deleteCustomLook(mine.id);

    expect(graphStyle.getGraphLookId()).toBe(CIRCLE);
  });

  it('comes back when it is a scene that can still play (the control)', () => {
    const loaded = load();
    const { graphStyle, customLooks, packs } = loaded;
    packs.adoptScenePackListingForTesting({
      packs: [pack('alpine')],
      locked: [],
    });
    graphStyle.setGraphLook(CIRCLE);
    graphStyle.setGraphLook('premium:alpine');
    const mine = ownLook(loaded);
    graphStyle.setGraphLook(mine.id);

    customLooks.deleteCustomLook(mine.id);

    expect(graphStyle.getGraphLookId()).toBe('premium:alpine');
  });

  it('is passed over when it is a standard look this version no longer has', () => {
    const loaded = load();
    const mine = ownLook(loaded);
    loaded.graphStyle.setGraphLook(mine.id);
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(['retired-look-signal', BARS]),
    );
    const restarted = load({ restart: true });

    restarted.customLooks.deleteCustomLook(mine.id);

    expect(restarted.graphStyle.getGraphLookId()).toBe(BARS);
  });
});

describe('deleting a look that is not on the graph', () => {
  it('leaves the look on the graph alone', () => {
    const loaded = load();
    const { graphStyle, customLooks } = loaded;
    const other = ownLook(loaded, 3);
    graphStyle.setGraphLook(BARS);
    graphStyle.setGraphLook(CIRCLE);

    customLooks.deleteCustomLook(other.id);

    expect(graphStyle.getGraphLookId()).toBe(CIRCLE);
    expect(customLooks.getCustomLook(other.id)).toBeUndefined();
    expect(loaded.history.getLookHistory()[0]).toBe(BARS);
  });

  it('takes it off the looks to go back to', () => {
    const loaded = load();
    const { graphStyle, customLooks } = loaded;
    const other = ownLook(loaded, 3);
    graphStyle.setGraphLook(other.id);
    graphStyle.setGraphLook(CIRCLE);
    expect(loaded.history.getLookHistory()[0]).toBe(other.id);

    customLooks.deleteCustomLook(other.id);

    expect(graphStyle.getGraphLookId()).toBe(CIRCLE);
    expect(loaded.history.getLookHistory()).not.toContain(other.id);
    expect(storedHistory()).not.toContain(other.id);
  });

  it('is the only kind that leaves the selection where it was (the control)', () => {
    const loaded = load();
    const { graphStyle, customLooks } = loaded;
    graphStyle.setGraphLook(BARS);
    const mine = ownLook(loaded, 3);
    graphStyle.setGraphLook(mine.id);

    customLooks.deleteCustomLook(mine.id);

    expect(graphStyle.getGraphLookId()).not.toBe(mine.id);
  });
});

describe('the looks played before', () => {
  it('are the last few, each once, never the look on the graph', () => {
    const { graphStyle, history } = load();
    const forms = GRAPH_FORM_LOOKS.slice(
      1,
      1 + history.LOOK_HISTORY_LENGTH * 2,
    );
    expect(forms.length).toBeGreaterThan(history.LOOK_HISTORY_LENGTH + 1);
    // Back and forth, so every look is played more than once.
    [...forms, ...forms].forEach((form) => graphStyle.setGraphLook(form.id));

    const kept = history.getLookHistory();
    expect(kept).toHaveLength(history.LOOK_HISTORY_LENGTH);
    expect(new Set(kept).size).toBe(kept.length);
    expect(kept).not.toContain(graphStyle.getGraphLookId());
    // Newest first: the look played just before the one on the graph.
    expect(kept[0]).toBe(forms[forms.length - 2]?.id);
    expect(storedHistory()).toEqual(kept);
  });

  it('read nothing they would not have written', () => {
    window.localStorage.clear();
    const long = 'x'.repeat(129);
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([BARS, 7, '', long, BARS, CIRCLE, ...Array(40).fill('a')]),
    );
    const { history } = load({ restart: true });
    expect(history.getLookHistory()).toEqual([BARS, CIRCLE, 'a']);

    window.localStorage.setItem(HISTORY_KEY, '{not json');
    expect(load({ restart: true }).history.getLookHistory()).toEqual([]);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ 0: BARS }));
    expect(load({ restart: true }).history.getLookHistory()).toEqual([]);
  });
});
