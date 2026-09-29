/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
} from 'react';
import { type IGuidedLineCapture } from './useMakerLineCapture';
import { type TSelection } from './useKaraokeMakerSelection';
import { type IMakerCanvasGesture } from './useMakerCanvasGesture';

interface IMakerDismissalsInput {
  analysisAbortRef: RefObject<AbortController | undefined>;
  toolsRef: RefObject<HTMLDivElement | null>;
  setToolPanel: Dispatch<
    SetStateAction<'timing' | 'edit' | 'analysis' | undefined>
  >;
  setExportOpen: Dispatch<SetStateAction<boolean>>;
  setLineEntryMode: Dispatch<SetStateAction<boolean>>;
  setLineEntryCapture: Dispatch<SetStateAction<IGuidedLineCapture | undefined>>;
  setHandPanMode: Dispatch<SetStateAction<boolean>>;
  setIsCanvasPanning: Dispatch<SetStateAction<boolean>>;
  setIsCanvasScrubbing: Dispatch<SetStateAction<boolean>>;
  setSelection: Dispatch<SetStateAction<TSelection>>;
  cancelAudibleInteractions: (pause?: boolean) => void;
  gesture: IMakerCanvasGesture;
}

/**
 * What closes on its own: a job still running is aborted when the editor
 * goes, a press outside the toolbar closes its popovers, and Escape backs
 * out of every mode, selection and audition at once.
 */
const useMakerDismissals = ({
  analysisAbortRef,
  toolsRef,
  setToolPanel,
  setExportOpen,
  setLineEntryMode,
  setLineEntryCapture,
  setHandPanMode,
  setIsCanvasPanning,
  setIsCanvasScrubbing,
  setSelection,
  cancelAudibleInteractions,
  gesture,
}: IMakerDismissalsInput) => {
  useEffect(
    () => () => {
      analysisAbortRef.current?.abort();
    },
    [analysisAbortRef],
  );

  useEffect(() => {
    const closeFloatingTools = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !toolsRef.current?.contains(event.target)
      ) {
        setToolPanel(undefined);
        setExportOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setToolPanel(undefined);
        setExportOpen(false);
        setLineEntryMode(false);
        setLineEntryCapture(undefined);
        setHandPanMode(false);
        setIsCanvasPanning(false);
        setIsCanvasScrubbing(false);
        setSelection(undefined);
        cancelAudibleInteractions();
        gesture.drag.current = undefined;
        gesture.pan.current = undefined;
        gesture.lastDragAuditionMidi.current = undefined;
      }
    };
    window.addEventListener('pointerdown', closeFloatingTools);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeFloatingTools);
      window.removeEventListener('keydown', closeOnEscape);
      cancelAudibleInteractions();
    };
  }, [
    cancelAudibleInteractions,
    gesture.drag,
    gesture.lastDragAuditionMidi,
    gesture.pan,
    setExportOpen,
    setHandPanMode,
    setIsCanvasPanning,
    setIsCanvasScrubbing,
    setLineEntryCapture,
    setLineEntryMode,
    setSelection,
    setToolPanel,
    toolsRef,
  ]);
};

export default useMakerDismissals;
