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
import { sceneWindowColours } from '../utils/sceneOwnColours';
import type { IStudioBaseline } from './useStudioBaseline';

/** Who the colours on the card are by. */
export type TWindowColoursSource = 'ai' | 'palette' | 'member';

const same = (left?: ISceneWindowColours, right?: ISceneWindowColours) =>
  left === right ||
  (left !== undefined &&
    right !== undefined &&
    left.surface === right.surface &&
    left.accent === right.accent &&
    left.glow === right.glow);

/**
 * The colours the open scene lends the window, on the Studio's Tune tab
 * (Ivan, 2026-11-14: "implement that", the tuning mockup): what its AI chose,
 * the member's changes to them written into the scene as every setting is,
 * "Choose them from the palette" for the colours FluidEQ works out by itself,
 * and "Undo my changes" back to the scene as it was published, else as the
 * project was opened. A scene that names none shows the palette's colours,
 * which is what it plays in, until the member or the AI chooses some.
 */
export default function useStudioWindowColours(
  pack: IScenePack | undefined,
  project: string | undefined,
  baseline: IStudioBaseline,
) {
  // The colours the project had when it was opened, taken in the render that
  // first sees it: taken in an effect, the first frame had none, and called
  // the AI's own colours the member's.
  const [kept, setKept] = useState<{
    project?: string;
    colours?: ISceneWindowColours;
  }>({});
  const opened =
    pack && kept.project !== project
      ? { project, colours: pack.windowColours }
      : kept;
  if (opened !== kept) {
    setKept(opened);
  }
  // The colours the picker shows while it moves, before they are written.
  const [draft, setDraft] = useState<ISceneWindowColours>();
  const [saving, setSaving] = useState<'saving' | 'saved' | 'failed'>();
  // A new build carries what was written; the draft has done its job.
  useEffect(() => setDraft(undefined), [pack, project]);

  const fromPalette = useMemo(
    () =>
      pack
        ? sceneWindowColours({ ...pack, windowColours: undefined })
        : undefined,
    [pack],
  );
  const named = pack?.windowColours;
  const colours = draft ?? named ?? fromPalette;
  const atUndo = baseline.settings
    ? baseline.settings.windowColours
    : opened.colours;
  let source: TWindowColoursSource = 'ai';
  if (!named) {
    source = 'palette';
  } else if (!same(named, atUndo)) {
    source = 'member';
  }

  const write = useCallback((next: ISceneWindowColours | null) => {
    const send = window.electron?.ipcRenderer?.writeStudioSettings;
    if (!send) {
      return;
    }
    setSaving('saving');
    send({ windowColours: next })
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
  // Against what the scene holds, never the draft: by the time the picker
  // settles, the draft already shows the colour it settled on.
  const saved = named ?? fromPalette;
  const commit = useCallback(
    (role: TSceneWindowColourRole, value: string) => {
      if (saved && saved[role] !== value) {
        write({ ...saved, [role]: value });
      }
    },
    [saved, write],
  );
  // Only over colours the scene names: one that names none already plays in
  // its palette's.
  const canChoosePalette =
    fromPalette !== undefined &&
    named !== undefined &&
    !same(fromPalette, named);
  const choosePalette = useCallback(() => {
    if (canChoosePalette && fromPalette) {
      write(fromPalette);
    }
  }, [canChoosePalette, fromPalette, write]);
  const undo = useCallback(() => write(atUndo ?? null), [atUndo, write]);

  return {
    colours,
    /** What a dot on a swatch is measured against. */
    own: atUndo ?? fromPalette,
    source,
    saving,
    change,
    commit,
    choosePalette,
    canChoosePalette,
    undo,
    canUndo: !same(named, atUndo),
  };
}
