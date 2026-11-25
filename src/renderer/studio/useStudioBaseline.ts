/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { ISceneSettings } from 'common/sceneSettings';
import type { TGalleryAnswer } from './versionLine';

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

/**
 * The baseline, and what the gallery answered for the bar's version line:
 * an empty baseline means three different things — still asking, could not
 * ask, nothing published — and only the last may ever be said as "not in the
 * gallery". Saying it for the second told a member offline that a published
 * scene was unpublished.
 */
export interface IStudioBaselineAnswer extends IStudioBaseline {
  gallery: TGalleryAnswer;
}

const ASKING: IStudioBaselineAnswer = { gallery: { state: 'asking' } };
const UNKNOWN: IStudioBaselineAnswer = { gallery: { state: 'unknown' } };

export default function useStudioBaseline(
  /** The open project: another starts from nothing again. */
  project: string | undefined,
  /**
   * Raised by a publication, so the scene just published becomes the thing
   * Reset goes back to without the project being reopened.
   */
  publications: number,
): IStudioBaselineAnswer {
  // Kept with the project it answers for: another project reads as being
  // asked from its first render, while a new publication of the same one
  // keeps the old answer until the new one lands, so the line never blinks.
  const [answer, setAnswer] = useState<{
    project: string | undefined;
    baseline: IStudioBaselineAnswer;
  }>({ project: undefined, baseline: ASKING });

  useEffect(() => {
    const ask = window.electron?.ipcRenderer?.publishedStudioSettings;
    if (!project || !ask) {
      setAnswer({ project, baseline: UNKNOWN });
      return undefined;
    }
    // Only the answer to the project that is still open may land: the request
    // is answered for whichever folder main has when it runs, and a member
    // switching projects while it is in flight must not be handed the other
    // one's published settings.
    let mine = true;
    ask()
      .then((outcome) => {
        if (!mine) {
          return undefined;
        }
        if (!outcome.ok) {
          setAnswer({ project, baseline: UNKNOWN });
        } else if (outcome.published) {
          setAnswer({
            project,
            baseline: {
              settings: outcome.published.settings,
              version: outcome.published.version,
              gallery: { state: 'live', version: outcome.published.version },
            },
          });
        } else if (outcome.listed) {
          // Published, with no settings for Reset to go back to: one of
          // FluidEQ's own scenes, opened by the account that publishes them.
          setAnswer({
            project,
            baseline: {
              gallery: { state: 'live', version: outcome.listed.version },
            },
          });
        } else {
          setAnswer({ project, baseline: { gallery: { state: 'none' } } });
        }
        return undefined;
      })
      .catch(() => {
        if (mine) {
          setAnswer({ project, baseline: UNKNOWN });
        }
      });
    return () => {
      mine = false;
    };
  }, [project, publications]);

  return answer.project === project ? answer.baseline : ASKING;
}
