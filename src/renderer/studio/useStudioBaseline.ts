/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { ISceneSettings } from 'common/sceneSettings';

/**
 * What the Studio's Reset goes back to.
 *
 * The scene as it was last published, when it has been. Tuning a new version
 * is tuning away from the one people already have, so "undo my tuning" means
 * the released settings and not wherever the sliders happened to stand when
 * the folder was opened this morning.
 *
 * Asked once when a project opens and again after a publication, never while
 * a slider moves: Reset is a press that must answer at once, so the answer is
 * already here before it is pressed. A scene that has never been published,
 * one whose member is signed out or offline, and a FluidEQ scene opened to
 * look inside all come back with nothing, and Reset then goes back to the
 * scene's own settings as the project was opened — its defaults, as its
 * author left them.
 */
export interface IStudioBaseline {
  /** The published settings, when there are any to go back to. */
  settings?: ISceneSettings;
  /** The published version those settings belong to, for the line under them. */
  version?: number;
}

const NOTHING: IStudioBaseline = {};

export default function useStudioBaseline(
  /** The open project: another starts from nothing again. */
  project: string | undefined,
  /**
   * Raised by a publication, so the scene just published becomes the thing
   * Reset goes back to without the project being reopened.
   */
  publications: number,
): IStudioBaseline {
  const [baseline, setBaseline] = useState<IStudioBaseline>(NOTHING);

  useEffect(() => {
    setBaseline(NOTHING);
    const ask = window.electron?.ipcRenderer?.publishedStudioSettings;
    if (!project || !ask) {
      return undefined;
    }
    // Only the answer to the project that is still open may land: the request
    // is answered for whichever folder main has when it runs, and a member
    // switching projects while it is in flight must not be handed the other
    // one's published settings.
    let mine = true;
    ask()
      .then((outcome) => {
        if (mine && outcome.ok && outcome.published) {
          setBaseline({
            settings: outcome.published.settings,
            version: outcome.published.version,
          });
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      mine = false;
    };
  }, [project, publications]);

  return baseline;
}
