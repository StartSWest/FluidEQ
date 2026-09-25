/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import useGraphScenePack from '../player/useGraphScenePack';
import ScenePreview from '../plus/ScenePreview';
import { useSceneLook } from '../utils/graphStyle';
import { useGuestTintEnabled } from './guestTintPreference';

/**
 * Whether the Media page stands over the graph's Plus visualizer.
 *
 * In the video's own full screen only, and only while the page is being shown
 * in FluidEQ's colours: the page's surfaces are made see-through for it
 * (`buildGuestGlassCss`), which is the same kind of change as colouring them
 * and waits on the same choice by the user (`guestTintPreference.ts`).
 */
export const useSceneBehindVideo = (isFullScreen: boolean): boolean => {
  const scene = useSceneLook();
  const isTintOn = useGuestTintEnabled();
  return isFullScreen && isTintOn && scene !== null;
};

/**
 * The graph's Plus visualizer, playing behind the Media page in the video's
 * own full screen, so the page — its chat, comments and suggestions — stands
 * over the scene while the video itself stays solid on top (Ivan, 2026-09-21:
 * "I wanna see the viz behind the YouTube chat and all… not the video").
 *
 * The scene as the listener has it everywhere it is watched: loaded by the
 * same hook as the Library's player (`useGraphScenePack`) — the same pack,
 * their own controls, timing and wave for it — and played by the same player
 * every page outside the graph uses, which listens to the music itself and
 * measures its own box. It had a copy of that loading of its own, which is
 * how places that play the same scene come to play it differently. The
 * graph's canvas is hidden in this full screen and stops drawing, so the GPU
 * is doing this one scene, not two.
 */
const VideoSceneBackdrop = () => {
  const scene = useGraphScenePack();
  const [failedIdentity, setFailedIdentity] = useState<string>();
  if (scene.state !== 'ready' || failedIdentity === scene.identity) {
    return null;
  }
  const { identity } = scene;
  return (
    <div className="video-browser__scene" aria-hidden="true">
      <ScenePreview
        identity={identity}
        madeBy={scene.madeBy}
        pack={scene.pack}
        label={scene.label}
        // A scene that cannot play here leaves the page over the plain
        // window, as it is with no visualizer at all.
        onTrouble={() => setFailedIdentity(identity)}
        tuning={scene.tuning}
        wave={scene.wave}
      />
    </div>
  );
};

export default VideoSceneBackdrop;
