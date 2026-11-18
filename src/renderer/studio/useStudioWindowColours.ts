/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type {
  ISceneWindowColours,
  TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import { measureStudioSky } from '../graph/sceneSky';
import {
  isWornAsNamed,
  timeKeyOf,
  WINDOW_TIMES,
  type TWindowTime,
} from '../utils/sceneDayColours';
import { sceneWindowColours } from '../utils/sceneOwnColours';
import { recallSceneSky, studioSkyKey } from '../utils/sceneTintStore';
import { followPickedSurface } from '../utils/theme';
import useEditedTime from '../utils/useEditedTime';
import type { IStudioBaseline } from './useStudioBaseline';
import useStudioDayColours from './useStudioDayColours';

/** Who a time's colours on the card are by. */
export type TWindowColoursSource = 'ai' | 'member' | 'palette' | 'auto';

/** Where each time's colours are kept in `pack.json`. */
const KEY = {
  night: 'windowColours',
  day: 'windowColoursDay',
} as const satisfies Record<TWindowTime, string>;

type TColourWrite = Partial<
  Record<(typeof KEY)[TWindowTime], ISceneWindowColours | null>
>;

const same = (left?: ISceneWindowColours, right?: ISceneWindowColours) =>
  left === right ||
  (left !== undefined &&
    right !== undefined &&
    left.surface === right.surface &&
    left.accent === right.accent &&
    left.glow === right.glow);

const otherTime = (time: TWindowTime): TWindowTime =>
  time === 'night' ? 'day' : 'night';

/**
 * The colours the open scene lends the window, on the Studio's Tune tab
 * (Ivan, 2026-11-14: "implement that", the tuning mockup), for its night and
 * its day (2026-11-18: "allow users to pick two colours too, and the app
 * preselects colours automatically"): what its AI chose for each, the
 * member's changes written into the scene as every setting is, "Back to
 * automatic" for the open time, and "Undo my changes" back to the scene as
 * it was published, else as the project was opened. A time the scene names
 * nothing for shows the colours the app works out for it - its palette's,
 * or its picture's measured at that hour for `build` - which is what it
 * plays in until the member or the AI chooses some.
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
    night?: ISceneWindowColours;
    day?: ISceneWindowColours;
  }>({});
  const opened =
    pack && kept.project !== project
      ? { project, night: pack.windowColours, day: pack.windowColoursDay }
      : kept;
  if (opened !== kept) {
    setKept(opened);
  }
  const [editing, setEditing] = useEditedTime();
  // The colours the picker shows while it moves, before they are written.
  const [draft, setDraft] = useState<ISceneWindowColours>();
  const [saving, setSaving] = useState<'saving' | 'saved' | 'failed'>();
  // A new build carries what was written; the draft has done its job.
  useEffect(() => setDraft(undefined), [pack, project, editing]);

  const palette = useMemo(
    () =>
      pack
        ? sceneWindowColours({ ...pack, windowColours: undefined })
        : undefined,
    [pack],
  );
  const resolved = useStudioDayColours(project, pack, palette);

  // The times only the scene's picture can give colours for, drawn at that
  // hour for this build, so the card shows the automatic colours even while
  // the Studio's tint is off and nothing else is measuring.
  const measuredKey = resolved.measured.join(' ');
  useEffect(() => {
    if (!pack || !project || !build) {
      return;
    }
    WINDOW_TIMES.forEach((time) => {
      if (
        measuredKey.includes(time) &&
        recallSceneSky(timeKeyOf(studioSkyKey(project), time))?.version !==
          build
      ) {
        measureStudioSky(project, build, pack, time);
      }
    });
  }, [pack, project, build, measuredKey]);

  const named = useMemo(
    () => ({ night: pack?.windowColours, day: pack?.windowColoursDay }),
    [pack],
  );
  const atUndo = baseline.settings
    ? {
        night: baseline.settings.windowColours,
        day: baseline.settings.windowColoursDay,
      }
    : { night: opened.night, day: opened.day };
  const sourceOf = (time: TWindowTime): TWindowColoursSource => {
    const colours = named[time];
    const automatic = resolved.automatic[time];
    // Written by publishing for a time left to the app, they are still the
    // app's: automatic, not the AI's or the member's.
    if (!colours || same(colours, automatic?.colours)) {
      return automatic?.source === 'palette' ? 'palette' : 'auto';
    }
    return same(colours, atUndo[time]) ? 'ai' : 'member';
  };

  const wearing =
    resolved.sides[editing]?.colours ??
    resolved.sides[otherTime(editing)]?.colours;
  const colours = draft ?? wearing;

  const write = useCallback((next: TColourWrite) => {
    const send = window.electron?.ipcRenderer?.writeStudioSettings;
    if (!send) {
      return;
    }
    setSaving('saving');
    send(next)
      .then((outcome) => {
        setSaving(outcome.written === 'failed' ? 'failed' : 'saved');
        return undefined;
      })
      .catch(() => setSaving('failed'));
  }, []);

  const change = useCallback(
    (role: TSceneWindowColourRole, value: string) => {
      if (colours) {
        setDraft({ ...colours, [role]: value });
      }
    },
    [colours],
  );
  // Against what the scene holds for the open time, never the draft: by the
  // time the picker settles, the draft already shows the colour it settled
  // on. Changing one colour names the whole set, the other two as shown.
  const commit = useCallback(
    (role: TSceneWindowColourRole, value: string) => {
      if (wearing && wearing[role] !== value) {
        write({ [KEY[editing]]: { ...wearing, [role]: value } });
        if (role === 'surface') {
          followPickedSurface(value);
        }
      }
    },
    [wearing, editing, write],
  );
  const automatic = useCallback(
    () => write({ [KEY[editing]]: null }),
    [editing, write],
  );
  // A time the member left to the app is written into the scene, as the app
  // works it out, before it is published (Ivan, 2026-11-18: "si el usuario
  // no lo hace, el programa lo hace ... en la escena como tal siempre están
  // ahí"): the published scene carries both, and every listener's window
  // wears exactly what the maker saw, never a measurement of its own.
  const fillAutomatic = useCallback(() => {
    const next: TColourWrite = {};
    WINDOW_TIMES.forEach((time) => {
      const automaticColours = resolved.automatic[time]?.colours;
      if (!named[time] && automaticColours) {
        next[KEY[time]] = automaticColours;
      }
    });
    if (Object.keys(next).length > 0) {
      write(next);
    }
  }, [named, resolved.automatic, write]);
  // Reset, like every other block on the Tune tab, and for the open time
  // alone (Ivan, 2026-11-18: "any changes I do on night or in day separated
  // ... reset it to the previous thing"): back to what the scene had at that
  // time when it was published, else when it was opened.
  const resetTime = atUndo[editing];
  const reset = useCallback(
    () => write({ [KEY[editing]]: resetTime ?? null }),
    [editing, resetTime, write],
  );

  // The strip follows the picker on the open time.
  const night =
    editing === 'night' ? colours : (resolved.sides.night?.colours ?? colours);
  const day =
    editing === 'day' ? colours : (resolved.sides.day?.colours ?? night);

  return {
    colours,
    sides: resolved.sides,
    night,
    day,
    editing,
    setEditing,
    sourceOf,
    /** What a dot on a swatch is measured against. */
    own: atUndo[editing] ?? resolved.own[editing]?.colours,
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
     * either time's, or the member is moving one, which names them the
     * moment it lands. Worked out by the app, they only lend their hue.
     */
    isNamed: draft !== undefined || isWornAsNamed(resolved.sides),
  };
}
