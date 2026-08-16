/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useEffect, useRef, useState } from 'react';
import {
  IKaraokeMakerEditorView,
  writeKaraokeMakerEditorView,
} from './karaokeEditorPersistence';

/** Where the editor was looking, and how big the preview was. */
export const DEFAULT_VIEW_MS = 12_000;
export const DEFAULT_PREVIEW_HEIGHT = 150;

/**
 * Kept apart from the rest of the view state on purpose.
 *
 * Everything else here is remembered per project — where you were looking in
 * *this* song. Whether the preview pane is open at all is a preference about
 * the editor, so it is one key for the app rather than one per karaoke file.
 */
const MAKER_PREVIEW_OPEN_KEY = 'fluideq.karaoke.maker-preview-open';

export const initialPreviewOpen = (): boolean => {
  try {
    return window.localStorage.getItem(MAKER_PREVIEW_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
};

/**
 * Where the editor was looking when you last closed it.
 *
 * Seven values that are one thing: they are written together, read together at
 * mount, and persisted by the same two effects. In the component they were
 * seven `useState` calls in a row, three effects four hundred lines below them,
 * and a module-level storage key three hundred lines above — related only by
 * a reader noticing.
 *
 * `editorViewRef` is filled by the caller rather than here, because the
 * snapshot that gets written also carries the current selection and a viewport
 * duration clamped against the song length, and neither of those belongs to
 * this hook. So the hook owns the state and the writing; the component owns
 * what goes in the envelope.
 *
 * The unmount write reads `editorProjectIdRef` rather than the current project
 * id: a playlist can advance while the editor is closing, and the view being
 * saved belongs to the song it was recorded for.
 */
export const useKaraokeMakerEditorView = (
  projectId: string,
  selection: IKaraokeMakerEditorView['selection'],
  /**
   * Read by the caller, not here.
   *
   * The selection is part of the persisted view and is also what the caller
   * seeds its own selection state from, so whoever reads storage has to do it
   * before both. Passing the result in keeps that one read instead of two that
   * have to agree.
   */
  initialEditorView: IKaraokeMakerEditorView | undefined,
) => {
  const editorViewRef = useRef<IKaraokeMakerEditorView | undefined>(undefined);
  const editorProjectIdRef = useRef(projectId);
  editorProjectIdRef.current = projectId;

  const [viewStartMs, setViewStartMs] = useState(
    initialEditorView?.viewStartMs ?? 0,
  );
  const [viewDurationMs, setViewDurationMs] = useState(
    initialEditorView?.viewDurationMs ?? DEFAULT_VIEW_MS,
  );
  const [followViewport, setFollowViewport] = useState(
    initialEditorView?.followViewport ?? true,
  );
  const [timingScope, setTimingScope] = useState<
    IKaraokeMakerEditorView['timingScope']
  >(initialEditorView?.timingScope ?? 'all');
  const [previewOpen, setPreviewOpen] = useState(
    initialEditorView?.previewOpen ?? initialPreviewOpen,
  );
  const [previewTextSize, setPreviewTextSize] = useState(
    initialEditorView?.previewTextSize ?? 100,
  );
  const [previewHeight, setPreviewHeight] = useState(
    initialEditorView?.previewHeight ?? DEFAULT_PREVIEW_HEIGHT,
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(MAKER_PREVIEW_OPEN_KEY, String(previewOpen));
    } catch {
      // A blocked storage partition should not disable the editor preview.
    }
  }, [previewOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (editorViewRef.current) {
        writeKaraokeMakerEditorView(projectId, editorViewRef.current);
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [
    followViewport,
    previewOpen,
    previewHeight,
    previewTextSize,
    projectId,
    selection,
    timingScope,
    viewDurationMs,
    viewStartMs,
  ]);

  useEffect(
    () => () => {
      if (editorViewRef.current) {
        writeKaraokeMakerEditorView(
          editorProjectIdRef.current,
          editorViewRef.current,
        );
      }
    },
    [],
  );

  return {
    /** Filled by the caller each render; see the note on this hook. */
    editorViewRef,
    editorProjectIdRef,
    viewStartMs,
    setViewStartMs,
    viewDurationMs,
    setViewDurationMs,
    followViewport,
    setFollowViewport,
    timingScope,
    setTimingScope,
    previewOpen,
    setPreviewOpen,
    previewTextSize,
    setPreviewTextSize,
    previewHeight,
    setPreviewHeight,
  };
};
