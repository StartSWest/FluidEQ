import { ipcMain } from 'electron';
import {
  isSceneRefusal,
  readRefusedSource,
  type ISceneRefusals,
} from '../sceneRefusals';

/**
 * Where the window says a scene's code would not run, from wherever it ran it:
 * the gallery's preview, the lamps' worker, the worker that draws pictures.
 * The graph's own failures come in by look id instead (`scene-packs-report-
 * failure`, `member-scenes-report-failure`) and are recorded by source there.
 *
 * Every look list is announced afresh when a refusal is new, so a picker
 * holding an installed copy of the same scene stops offering it at once
 * rather than at the next change.
 */

export interface ISceneRefusalsIpcDeps {
  refusals: ISceneRefusals;
  /** Sends every look list to the window again. */
  announce: () => void;
}

const CHANNEL = 'scene-source-refused';

export const registerSceneRefusalsIpc = ({
  refusals,
  announce,
}: ISceneRefusalsIpcDeps): { dispose(): void } => {
  ipcMain.handle(CHANNEL, (_event, rawSource: unknown, reason: unknown) => {
    const source = readRefusedSource(rawSource);
    if (source === undefined || !isSceneRefusal(reason)) {
      return;
    }
    if (refusals.refuse(source, reason)) {
      announce();
    }
  });
  return {
    dispose: () => ipcMain.removeHandler(CHANNEL),
  };
};
