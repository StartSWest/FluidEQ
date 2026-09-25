/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow, dialog } from 'electron';
import type { IMemberSceneStore } from '../memberScenes/store';
import type { IStoredProject } from '../memberScenes/studioProjects';
import { registerStudioNotesIpc } from './studioNotes';
import { registerStudioPicturesIpc } from './studioPictures';
import { registerStudioPreviewIpc } from './studioPreview';
import { registerStudioSettingsIpc } from './studioSettings';

/**
 * The panes beside the Studio's bench: the notes, the Pictures card, the
 * picture of the scene for the member's AI, and the scene's settings.
 *
 * Each is asked about the project it is about, the way the projects' own
 * channels ask (`studioProjectsIpc.ts`): one the page names only while the
 * member may use it, the open one only while it may be used. Which projects
 * those are is `projectAccess.ts`, never decided here.
 */

export interface IStudioProjectPanesDeps {
  getMainWindow: () => BrowserWindow | null;
  /** The project the page names, when the member may use it. */
  usableProject: (id: string) => IStoredProject | undefined;
  /** Whether the open project may be worked on, asked fresh on every call. */
  mayUseActive: () => boolean;
  activeFolder: () => string | undefined;
  /** Whether a settings save may refresh the member's look of the project. */
  mayUpdateLook: () => boolean;
  accountId: () => string | undefined;
  store: IMemberSceneStore;
  announceScenes: () => void;
  dialogImpl: Pick<typeof dialog, 'showOpenDialog'>;
  logger?: { warn(message: string): void };
}

/** Registers every pane's channels; the returned function takes them away. */
export const registerStudioProjectPanes = ({
  getMainWindow,
  usableProject,
  mayUseActive,
  activeFolder,
  mayUpdateLook,
  accountId,
  store,
  announceScenes,
  dialogImpl,
  logger,
}: IStudioProjectPanesDeps): (() => void) => {
  const disposeNotes = registerStudioNotesIpc({
    // The folder of the project named, when that project may be used: the
    // notes are about one project, whichever is on the bench.
    folderFor: (id) => usableProject(id)?.folder,
  });
  const disposePictures = registerStudioPicturesIpc({
    getMainWindow,
    mayEdit: mayUseActive,
    activeFolder,
    dialogImpl,
    ...(logger ? { logger } : {}),
  });
  // A picture of the scene beside its files, for the member's AI to look at.
  // Only into a project that may be edited: one of FluidEQ's own, opened to
  // look inside, gains no file from being watched.
  const disposePreview = registerStudioPreviewIpc({
    // Decided about the project NAMED, never about the open one: asking
    // whether the OPEN project is an inspection would answer for the wrong
    // folder the moment the page names another, which is the same mistake
    // the notes reader carries a comment about.
    folderFor: (id) => {
      const project = usableProject(id);
      return project?.official === undefined ? project?.folder : undefined;
    },
    ...(logger ? { logger } : {}),
  });
  const disposeSettings = registerStudioSettingsIpc({
    mayEdit: mayUseActive,
    mayUpdateLook,
    activeFolder,
    accountId,
    store,
    announceScenes,
    ...(logger ? { logger } : {}),
  });
  return () => {
    disposeNotes();
    disposePictures();
    disposePreview();
    disposeSettings();
  };
};
