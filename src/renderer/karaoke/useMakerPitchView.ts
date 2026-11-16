/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useMemo, useState } from 'react';
import { readKaraokeMakerEditorView } from './karaokeEditorPersistence';
import {
  IMakerPitchWindow,
  clampPitchWindow,
  fitPitchWindow,
  panPitchWindow,
  zoomPitchWindow,
} from './makerPitchView';

interface IMakerPitchViewState {
  /** The project this window was settled for. */
  projectId: string;
  window: IMakerPitchWindow;
  /**
   * Zoomed, scrolled or dragged by hand. Only a chosen window is remembered
   * with the project; a fit hands the window back to the notes.
   */
  chosen: boolean;
  /**
   * Settled after the saved draft was decided on. Until then the project may
   * still be swapped for the draft, whose notes are the ones to fit.
   */
  settled: boolean;
}

interface IMakerPitchViewInput {
  projectId: string;
  notes: readonly { targetMidi: number }[];
  /** The saved draft has been adopted or declined. */
  draftReady: boolean;
}

/**
 * The note grid's pitch window: what the canvas paints and the pointer
 * reads, and what the wheel, the scroller and the fit button move.
 *
 * A song opens on the window it was left at, if somebody zoomed it, and is
 * otherwise fitted to its notes — once, when the draft is decided, and never
 * again by itself: refitting on every edit would move the rows under a note
 * while it is being dragged.
 *
 * Keyed by project rather than reset from outside, so a project file opened
 * over this one gets its own window without the opener knowing this exists.
 */
const useMakerPitchView = ({
  projectId,
  notes,
  draftReady,
}: IMakerPitchViewInput) => {
  const remembered = useMemo(
    () => readKaraokeMakerEditorView(projectId)?.pitchWindow,
    [projectId],
  );
  const [state, setState] = useState<IMakerPitchViewState>(() => ({
    projectId,
    window: remembered ?? fitPitchWindow(notes),
    chosen: remembered !== undefined,
    settled: draftReady || remembered !== undefined,
  }));

  // Adjusted while rendering, as React prescribes for state that follows a
  // prop: an effect would paint one frame of the previous song's window.
  let current = state;
  if (state.projectId !== projectId) {
    current = {
      projectId,
      window: remembered ?? fitPitchWindow(notes),
      chosen: remembered !== undefined,
      settled: draftReady || remembered !== undefined,
    };
    setState(current);
  } else if (!state.settled && draftReady) {
    current = {
      ...state,
      window: state.chosen ? state.window : fitPitchWindow(notes),
      settled: true,
    };
    setState(current);
  }

  const zoomPitch = useCallback((anchorMidi: number, factor: number) => {
    setState((previous) => ({
      ...previous,
      window: zoomPitchWindow(previous.window, anchorMidi, factor),
      chosen: true,
    }));
  }, []);

  const panPitch = useCallback((semitones: number) => {
    setState((previous) => ({
      ...previous,
      window: panPitchWindow(previous.window, semitones),
      chosen: true,
    }));
  }, []);

  const showPitchWindow = useCallback((window: IMakerPitchWindow) => {
    setState((previous) => ({
      ...previous,
      window: clampPitchWindow(window),
      chosen: true,
    }));
  }, []);

  const fitPitch = useCallback(() => {
    setState((previous) => ({
      ...previous,
      window: fitPitchWindow(notes),
      chosen: false,
      settled: true,
    }));
  }, [notes]);

  return {
    pitchWindow: current.window,
    /** Whether the window is the user's to remember, or the notes' fit. */
    pitchWindowChosen: current.chosen,
    zoomPitch,
    panPitch,
    showPitchWindow,
    fitPitch,
  };
};

export default useMakerPitchView;
