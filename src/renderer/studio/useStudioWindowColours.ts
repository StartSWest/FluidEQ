/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IScenePack } from 'common/scenePacks';
import {
  sameWindowColourSet,
  type ISceneWindowColours,
  type ISceneWindowColourStops,
  type TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import { measureStudioSky } from '../graph/sceneSky';
import {
  hourOfStop,
  isWornAsNamed,
  MEASURED_STOPS,
  stopColoursAt,
  stopKeyOf,
  withChosenStop,
  type TWindowColourStop,
} from '../utils/sceneDayColours';
import { sceneWindowColours } from '../utils/sceneOwnColours';
import { recallSceneSky, studioSkyKey } from '../utils/sceneTintStore';
import { withinLimits } from '../utils/useColourLimits';
import useEditedStop from '../utils/useEditedStop';
import {
  dropWindowColourDraft,
  showWindowColourDraft,
  studioDraftOwner,
} from '../utils/windowColourDraft';
import type { IStudioBaseline } from './useStudioBaseline';
import useStudioDayColours from './useStudioDayColours';

/** Who a point's colours on the card are by. */
export type TWindowColoursSource = 'ai' | 'member' | 'palette' | 'auto';

/** What a write changes, point by point: `null` gives a point back to the app. */
type TStopWrite = Partial<
  Record<TWindowColourStop, ISceneWindowColours | null>
>;

const same = (left?: ISceneWindowColours, right?: ISceneWindowColours) =>
  left === right || (left !== undefined && sameWindowColourSet(left, right));

const NO_STOPS: ISceneWindowColourStops = {};

/**
 * The colours the open scene lends the window, on the Studio's Tune tab
 * (Ivan, 2026-11-14: "implement that", the tuning mockup), at its five
 * points through the day (2026-11-18: "we need 4 breakpoints plus 100% which
 * is the white one"): what its AI chose for each, the member's changes
 * written into the scene as every setting is, "Automatic" for the open
 * point, and Reset back to the scene as it was published, else as the
 * project was opened. The day's two ends the scene names nothing for show
 * the colours the app works out for them - its palette's, or its picture's
 * measured at that hour for `build` - and a middle point with nothing named
 * the blend of its neighbours, which is what the scene plays in until the
 * member or the AI chooses some. While the picker moves, the whole window
 * wears it at the open point (`windowColourDraft.ts`).
 */
export default function useStudioWindowColours(
  pack: IScenePack | undefined,
  project: string | undefined,
  baseline: IStudioBaseline,
  build: string | undefined,
) {
  // The colours the project had when it was opened, taken in the render that
  // first sees it: taken in an effect, the first frame had none, and called
  // the AI's own colours the member's.
  const [kept, setKept] = useState<{
    project?: string;
    stops?: ISceneWindowColourStops;
  }>({});
  const opened =
    pack && kept.project !== project
      ? { project, stops: pack.windowColourStops }
      : kept;
  if (opened !== kept) {
    setKept(opened);
  }
  const [editing, setEditing] = useEditedStop();
  // The colours the picker shows while it moves, before they are written.
  const [draft, setDraft] = useState<ISceneWindowColours>();
  const [saving, setSaving] = useState<'saving' | 'saved' | 'failed'>();
  // A new build carries what was written; the draft has done its job.
  useEffect(() => setDraft(undefined), [pack, project, editing]);
  const owner = project ? studioDraftOwner(project) : '';
  useEffect(() => {
    if (!owner) {
      return;
    }
    if (draft) {
      showWindowColourDraft({ owner, stop: editing, colours: draft });
    } else {
      dropWindowColourDraft(owner);
    }
  }, [owner, draft, editing]);
  // Leaving the project mid-pick is a Cancel: the window wears what is kept.
  useEffect(() => () => dropWindowColourDraft(owner), [owner]);

  const palette = useMemo(
    () =>
      pack
        ? sceneWindowColours({ ...pack, windowColours: undefined })
        : undefined,
    [pack],
  );
  const resolved = useStudioDayColours(project, pack, palette);

  // The ends only the scene's picture can give colours for, drawn at that
  // hour for this build, so the card shows the automatic colours even while
  // the Studio's tint is off and nothing else is measuring.
  const measuredKey = resolved.measured.join(' ');
  useEffect(() => {
    if (!pack || !project || !build) {
      return;
    }
    MEASURED_STOPS.forEach((stop) => {
      if (
        measuredKey.split(' ').includes(stop) &&
        recallSceneSky(stopKeyOf(studioSkyKey(project), stop))?.version !==
          build
      ) {
        measureStudioSky(project, build, pack, stop);
      }
    });
  }, [pack, project, build, measuredKey]);

  const named = pack?.windowColourStops ?? NO_STOPS;
  const atUndo: ISceneWindowColourStops = baseline.settings
    ? (baseline.settings.windowColourStops ?? NO_STOPS)
    : (opened.stops ?? NO_STOPS);
  const sourceOf = (stop: TWindowColourStop): TWindowColoursSource => {
    const colours = named[stop];
    const automatic = resolved.automatic[stop];
    // Written by publishing for an end left to the app, they are still the
    // app's: automatic, not the AI's or the member's.
    if (!colours || same(colours, automatic?.colours)) {
      return automatic?.source === 'palette' ? 'palette' : 'auto';
    }
    return same(colours, atUndo[stop]) ? 'ai' : 'member';
  };

  // A point with no set of its own starts from the blend it shows, inside
  // that point's limits: the points either side are each inside their own,
  // and their blend need not be.
  const blend = stopColoursAt(resolved.sides, hourOfStop(editing));
  const wearing =
    resolved.sides[editing]?.colours ?? (blend && withinLimits(blend, editing));
  const colours = draft ?? wearing;

  const write = useCallback((next: TStopWrite) => {
    const send = window.electron?.ipcRenderer?.writeStudioSettings;
    if (!send) {
      return;
    }
    setSaving('saving');
    send({ windowColourStops: next })
      .then((outcome) => {
        setSaving(outcome.written === 'failed' ? 'failed' : 'saved');
        return undefined;
      })
      .catch(() => setSaving('failed'));
  }, []);

  const change = useCallback(
    (role: TSceneWindowColourRole, value: string) => {
      if (colours && wearing) {
        // Back at what the point wears - a Cancel - is no draft at all:
        // kept as one, it would still count the point as chosen and change
        // how the window walks.
        const next = { ...colours, [role]: value };
        setDraft(same(next, wearing) ? undefined : next);
      }
    },
    [colours, wearing],
  );
  // Against what the scene holds at the open point, never the draft: by the
  // time the picker settles, the draft already shows the colour it settled
  // on. Changing one colour names the whole set, the other two as shown.
  const commit = useCallback(
    (role: TSceneWindowColourRole, value: string) => {
      if (wearing && wearing[role] !== value) {
        write({ [editing]: { ...wearing, [role]: value } });
        // The Brightness stays where it is: a surface picked never moves it
        // (Ivan, 2026-11-18: "why if I accept here does it jump to 100%
        // brightness").
      }
    },
    [wearing, editing, write],
  );
  const automatic = useCallback(
    () => write({ [editing]: null }),
    [editing, write],
  );
  // An end the member left to the app is written into the scene, as the app
  // works it out, before it is published (Ivan, 2026-11-18: "si el usuario
  // no lo hace, el programa lo hace ... en la escena como tal siempre están
  // ahí"): the published scene carries both ends, and every listener's
  // window wears exactly what the maker saw, never a measurement of its own.
  // A middle point left to the app is the blend of the points either side
  // of it, the same on every machine, and is not written.
  const fillAutomatic = useCallback(() => {
    const next: TStopWrite = {};
    MEASURED_STOPS.forEach((stop) => {
      const automaticColours = resolved.automatic[stop]?.colours;
      if (!named[stop] && automaticColours) {
        next[stop] = automaticColours;
      }
    });
    if (Object.keys(next).length > 0) {
      write(next);
    }
  }, [named, resolved.automatic, write]);
  // Reset, like every other block on the Tune tab, and for the open point
  // alone (Ivan, 2026-11-18: "any changes I do on night or in day separated
  // ... reset it to the previous thing"): back to what the scene had there
  // when it was published, else when it was opened.
  const resetStop = atUndo[editing];
  const reset = useCallback(
    () => write({ [editing]: resetStop ?? null }),
    [editing, resetStop, write],
  );

  // The cards, the strip and the small window follow the picker at the open
  // point.
  const sides = draft
    ? withChosenStop(resolved.sides, editing, draft)
    : resolved.sides;

  return {
    colours,
    sides,
    editing,
    setEditing,
    sourceOf,
    /** What a dot on a swatch is measured against. */
    own:
      atUndo[editing] ??
      resolved.own[editing]?.colours ??
      stopColoursAt(resolved.own, hourOfStop(editing)),
    saving,
    change,
    commit,
    automatic,
    canAutomatic: sourceOf(editing) === 'ai' || sourceOf(editing) === 'member',
    fillAutomatic,
    reset,
    canReset: !same(named[editing], atUndo[editing]),
    /**
     * Whether `colours` are worn as named (`pickedWindow.ts`): the pack names
     * any point's, or the member is moving one, which names them the moment
     * it lands. Worked out by the app, they only lend their hue.
     */
    isNamed: draft !== undefined || isWornAsNamed(resolved.sides),
  };
}
