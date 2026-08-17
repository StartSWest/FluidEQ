/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ChangeEvent, Dispatch, SetStateAction } from 'react';
import {
  IKaraokeMakerProject,
  importLyricsIntoKaraokeMakerProject,
  parseKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import {
  TKaraokeMakerExportFormat,
  exportKaraokeMaker,
  karaokeMakerExportFileName,
} from '../../common/karaoke/makerExport';
import {
  karaokeFileExtension,
  parseKaraokeText,
  readKaraokeTextFile,
} from '../../common/karaoke/files';
import { useTranslation } from '../utils/I18nContext';
import { useKaraokeMakerProject } from './useKaraokeMakerProject';
import { TSelection } from './useKaraokeMakerSelection';
import {
  IKaraokeMakerEditorView,
  readKaraokeMakerEditorView,
} from './karaokeEditorPersistence';
import { plainLyrics } from './useKaraokeMakerLyricsDraft';
import {
  DEFAULT_PREVIEW_HEIGHT,
  DEFAULT_VIEW_MS,
  initialPreviewOpen,
} from './useKaraokeMakerEditorView';

/**
 * Whole projects and whole files: out to disk, and back in.
 *
 * Exporting, opening a saved project, and picking a cleaner vocal stem to
 * analyse. All three are the same shape — a file crosses the boundary and
 * either the project or what we analyse is replaced wholesale — which is what
 * separates them from the edits, where something already open is changed.
 *
 * Opening restores the view as well as the project: where the editor was
 * looking, how tall the preview was, what the timing nudge applied to. A
 * project that reopened at the first bar with the preview shut would be
 * technically correct and feel like it had lost the session.
 */
export interface IMakerProjectFilesParams extends Pick<
  ReturnType<typeof useKaraokeMakerProject>,
  'project' | 'setProject' | 'clearHistory'
> {
  t: ReturnType<typeof useTranslation>['t'];
  setNotice: (message?: string) => void;
  localizeMakerError: (
    error: unknown,
    context: 'analysis' | 'export' | 'import' | 'whisper',
  ) => string;

  /** The audio the models run against — the song, or a stem chosen for it. */
  setAnalysisFile: Dispatch<SetStateAction<File>>;
  setLyricsDraft: Dispatch<SetStateAction<string>>;
  setExportOpen: Dispatch<SetStateAction<boolean>>;
  setSelection: Dispatch<SetStateAction<TSelection>>;

  /** The view a reopened project is restored into. */
  setViewStartMs: Dispatch<SetStateAction<number>>;
  setViewDurationMs: Dispatch<SetStateAction<number>>;
  setFollowViewport: Dispatch<SetStateAction<boolean>>;
  setPreviewOpen: Dispatch<SetStateAction<boolean>>;
  setPreviewHeight: Dispatch<SetStateAction<number>>;
  setPreviewTextSize: Dispatch<SetStateAction<number>>;
  setTimingScope: Dispatch<
    SetStateAction<IKaraokeMakerEditorView['timingScope']>
  >;
}

export const useMakerProjectFiles = ({
  clearHistory,
  localizeMakerError,
  project,
  setAnalysisFile,
  setExportOpen,
  setFollowViewport,
  setLyricsDraft,
  setNotice,
  setPreviewHeight,
  setPreviewOpen,
  setPreviewTextSize,
  setProject,
  setSelection,
  setTimingScope,
  setViewDurationMs,
  setViewStartMs,
  t,
}: IMakerProjectFilesParams) => {
  const exportProject = async (format: TKaraokeMakerExportFormat) => {
    setExportOpen(false);
    if (format !== 'project' && !project.meta.rightsConfirmed) {
      setNotice(t('karaoke.maker.rightsRequired'));
      return;
    }
    try {
      const output = exportKaraokeMaker(project, format);
      let formatName = t('karaoke.maker.exportLrc');
      if (format === 'project') {
        formatName = t('karaoke.maker.exportProject');
      } else if (format === 'ultrastar') {
        formatName = t('karaoke.maker.exportUltraStar');
      } else if (format === 'elrc') {
        formatName = t('karaoke.maker.exportElrc');
      }
      const result = await window.electron.ipcRenderer.exportKaraokeMakerFile({
        fileName: karaokeMakerExportFileName(project, format),
        contents: output.contents,
        formatName,
        extensions: [output.extension],
      });
      if (!result.canceled) {
        setNotice(
          t('karaoke.maker.exported', {
            file: result.filePath ?? t('karaoke.maker.exportFallback'),
          }),
        );
      }
    } catch (error) {
      setNotice(localizeMakerError(error, 'export'));
    }
  };

  const selectVocalStem = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    setAnalysisFile(file);
    setNotice(t('karaoke.maker.analysisSource', { file: file.name }));
  };

  const openProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      if (file.size > 16 * 1024 * 1024) {
        setNotice(t('karaoke.maker.projectTooLarge'));
        return;
      }
      const contents = await readKaraokeTextFile(file);
      const extension = karaokeFileExtension(file.name);
      const isProjectFile =
        extension === 'json' || contents.trimStart().startsWith('{');
      let imported: IKaraokeMakerProject;
      if (isProjectFile) {
        const restored = parseKaraokeMakerProject(contents);
        imported = {
          ...restored,
          title:
            restored.title === 'Untitled karaoke'
              ? t('karaoke.maker.untitled')
              : restored.title,
          audio: { ...restored.audio, ...project.audio },
        };
      } else {
        imported = importLyricsIntoKaraokeMakerProject(
          project,
          parseKaraokeText(file.name, contents),
        );
      }
      setProject(imported);
      clearHistory();
      const importedView = readKaraokeMakerEditorView(imported.id);
      setSelection(importedView?.selection);
      setViewStartMs(importedView?.viewStartMs ?? 0);
      setViewDurationMs(importedView?.viewDurationMs ?? DEFAULT_VIEW_MS);
      setFollowViewport(importedView?.followViewport ?? true);
      setPreviewOpen(importedView?.previewOpen ?? initialPreviewOpen());
      setPreviewTextSize(importedView?.previewTextSize ?? 100);
      setPreviewHeight(importedView?.previewHeight ?? DEFAULT_PREVIEW_HEIGHT);
      setTimingScope(importedView?.timingScope ?? 'all');
      setLyricsDraft(plainLyrics(imported));
      setNotice(
        isProjectFile
          ? t('karaoke.maker.projectLoaded')
          : t('karaoke.maker.karaokeImported'),
      );
    } catch (error) {
      setNotice(localizeMakerError(error, 'import'));
    }
  };

  return { exportProject, openProject, selectVocalStem };
};
