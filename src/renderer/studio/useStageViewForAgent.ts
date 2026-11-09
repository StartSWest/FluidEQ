/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import {
  AGENT_SHAPE_OF_PREVIEW,
  type TStagePreview,
} from './studioStageScreen';

/**
 * Tells main which view the stage shows the scene in, so the member's AI
 * looks at that shape when it names none (Ivan, 2026-11-09: asked to improve
 * a scene "on ultra wide", the AI drew it in shapes of its own). Told again
 * on every change, and taken back when the Studio closes.
 */
export default function useStageViewForAgent(preview: TStagePreview) {
  useEffect(() => {
    const tell = window.electron?.ipcRenderer?.studioAgentStageView;
    tell?.(AGENT_SHAPE_OF_PREVIEW[preview]).catch(() => undefined);
    return () => {
      tell?.(null).catch(() => undefined);
    };
  }, [preview]);
}
