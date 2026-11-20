/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IScenePack } from 'common/scenePacks';
import {
  firstSceneWindowColourStop,
  sameWindowColourSet,
  type ISceneWindowColours,
  type ISceneWindowColourStops,
  type TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import { measureStudioSky, scanStudioSky } from '../graph/sceneSky';
import {
  isWornAsNamed,
  MEASURED_STOPS,
  SCENE_COLOURS_STOP,
  stopKeyOf,
  type TWindowColourStop,
} from '../utils/sceneDayColours';
import { sceneWindowColours } from '../utils/sceneOwnColours';
import { recallSceneSky, studioSkyKey } from '../utils/sceneTintStore';
import useColourFinder from '../utils/useColourFinder';
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
  // The scene's one set (Ivan, 2026-11-19: "we are kind of overcomplicating the scene ... pick one colour for the scene, and then during the day just light up"; "the night usually doesn't have a colour, so we pick the colour from the day, and that's the colour for the whole scene, and when it darks, it simply darks").
  const editing = SCENE_COLOURS_STOP;
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
  // The scene's one set as the window wears it (`resolveStopColours`): the
  // day's, else the first point named. Read point by point, a project naming
  // only its "0" - written before the points, or by an AI that set only
  // `windowColours` - wore those colours on the card while this called them
  // the palette, and publishing wrote the app's own at "100", which then won
  // as the scene's set: it went out in colours the member never saw.
  const oneSetOf = (stops: ISceneWindowColourStops) =>
    stops[SCENE_COLOURS_STOP] ?? firstSceneWindowColourStop(stops);
  const sourceOf = (stop: TWindowColourStop): TWindowColoursSource => {
    const colours = stop === SCENE_COLOURS_STOP ? oneSetOf(named) : named[stop];
    const automatic = resolved.automatic[stop];
    // Written by publishing for an end left to the app, they are still the
    // app's: automatic, not the AI's or the member's.
    if (!colours || same(colours, automatic?.colours)) {
      return automatic?.source === 'palette' ? 'palette' : 'auto';
    }
    const undone =
      stop === SCENE_COLOURS_STOP ? oneSetOf(atUndo) : atUndo[stop];
    return same(colours, undone) ? 'ai' : 'member';
  };

  const wearing = resolved.sides[editing]?.colours;
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
        // Only a new build lets a draft go (`setDraft` above); a write
        // that failed, or changed nothing, brings none, and a draft kept
        // would show colours the scene does not hold.
        if (outcome.written !== 'written') {
          setDraft(undefined);
        }
        return undefined;
      })
      .catch(() => {
        setSaving('failed');
        setDraft(undefined);
      });
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
  // Automatic finds the scene's colours at the open point and writes them
  // there, as often as it is pressed (`useColourFinder`); shown on the
  // whole window at once, before the build that carries them is made.
  const applyFound = useCallback(
    (found: ISceneWindowColours) => {
      setDraft(found);
      write({ [editing]: found });
    },
    [editing, write],
  );
  const scan = useMemo(
    () =>
      pack && build ? () => scanStudioSky(build, pack, editing) : undefined,
    [pack, build, editing],
  );
  const finder = useColourFinder({
    // The project, not the build: the build the colours found bring is
    // the same scene, and what was found stays said over it.
    subject: project ?? '',
    stop: editing,
    current: colours,
    scan,
    apply: applyFound,
  });
  // An end the member left to the app is written into the scene, as the app
  // works it out, before it is published (Ivan, 2026-11-18: "si el usuario
  // no lo hace, el programa lo hace ... en la escena como tal siempre están
  // ahí"): the published scene carries both ends, and every listener's
  // window wears exactly what the maker saw, never a measurement of its own.
  // A middle point left to the app is the blend of the points either side
  // of it, the same on every machine, and is not written.
  // With one set per scene, only a scene that names none is filled, at the
  // day point: any set it names is already the one it wears and publishes.
  const fillAutomatic = useCallback(() => {
    const automaticColours = resolved.automatic[SCENE_COLOURS_STOP]?.colours;
    const namesASet =
      (named[SCENE_COLOURS_STOP] ?? firstSceneWindowColourStop(named)) !==
      undefined;
    if (!namesASet && automaticColours) {
      write({ [SCENE_COLOURS_STOP]: automaticColours });
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

  return {
    colours,
    editing,
    sourceOf,
    /** What a dot on a swatch is measured against. */
    own: atUndo[editing] ?? resolved.own[editing]?.colours,
    saving,
    change,
    commit,
    finder,
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
