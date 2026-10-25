/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import STUDIO_STARTER_SOURCE from 'common/studioStarterSource';
import { useSceneStore } from '../plus/sceneStore';
import type { TStageHeard } from './StudioStage';
import {
  beginStarterGuide,
  closeStarterGuide,
  markStarterStep,
} from './studioStarterGuide';

/**
 * How loud the music has to be before "Play a song" ticks: above the
 * analyser's floor in a quiet room, below the softest passage of a song.
 */
const HEARD_LEVEL = 0.04;

/**
 * The starter's guides, from the bench: the open project joins the guide
 * while its scene is the starter's untouched text, "Ask your AI" ticks the
 * moment that text changes (whoever changed it — the chat, another AI, the
 * member in the code tab), "Play a song" ticks on the first frame with music
 * in it, and publishing ends the guide. "Move a dial" ticks where the dials
 * are moved (`useStudioTuning`).
 *
 * `untouched` is whether the stage's labels can be trusted: they name where
 * the starter puts its orb, ring and floor, and an edited scene may have
 * moved any of them.
 */
export default function useStudioStarter(
  projectId: string | undefined,
  /** The scene's own id, as the store lists it once it is published. */
  packId: string | undefined,
  sourceText: string | undefined,
) {
  const untouched = sourceText === STUDIO_STARTER_SOURCE;
  // Published as the store's own list says, never as the draft's mark reads
  // it: until the store has answered, a Plus member's own scene counts as
  // playable (`mayPlayLook`), and taken for published that closed every new
  // project's guide in the moment before the answer came.
  const { store } = useSceneStore();
  const published =
    packId !== undefined && (store?.published?.includes(packId) ?? false);
  const edited = sourceText !== undefined && !untouched;

  useEffect(() => {
    if (projectId && untouched && !published) {
      beginStarterGuide(projectId);
    }
  }, [projectId, untouched, published]);

  useEffect(() => {
    if (projectId && edited) {
      markStarterStep(projectId, 'asked');
    }
  }, [projectId, edited]);

  useEffect(() => {
    if (projectId && published) {
      closeStarterGuide(projectId);
    }
  }, [projectId, published]);

  // The labels' writer, handed every frame after this one has looked at it.
  const labels = useRef<TStageHeard | undefined>(undefined);
  const project = useRef(projectId);
  project.current = projectId;
  const heardFor = useRef<string | undefined>(undefined);
  const hear = useRef<TStageHeard | undefined>((frame, heard, accent) => {
    if (
      heardFor.current !== project.current &&
      frame.playing === true &&
      frame.level > HEARD_LEVEL
    ) {
      heardFor.current = project.current;
      markStarterStep(project.current, 'heard');
    }
    labels.current?.(frame, heard, accent);
  });

  return { untouched, hear, labels };
}
