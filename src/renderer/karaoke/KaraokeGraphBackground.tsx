/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import LiveTraceCanvas from '../graph/LiveTraceCanvas';
import { useStandInForGraphScene } from '../graph/sceneStandIn';
import usePlayerTrace from '../player/playerTrace';
import useGraphScenePack from '../player/useGraphScenePack';
import ScenePreview from '../plus/ScenePreview';
import { useKaraokeSceneAppearance } from './karaokeSceneAppearance';

/**
 * The Karaoke's own scene, played inside its lyric window with its own See
 * through and Blur (Ivan, 2026-11-16: "keep it for karaoke as a separate
 * scene that you can play inside that karaoke window with its own
 * settings"). While it plays it stands in for the window's scene
 * (`sceneStandIn.ts`), as the Video page's does: the Backdrop's copy went on
 * drawing behind the page, two players of one scene (Ivan, 2026-11-16:
 * "instead of loading 2 viz make sure only the app one stays").
 */
export default function KaraokeGraphBackground() {
  const frame = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const scene = useGraphScenePack();
  // The blur laid over this backdrop (`KaraokeBackdrop`): the scene is drawn
  // at no more pixels than survive it, the more blur the fewer.
  const { blur } = useKaraokeSceneAppearance();
  const [failedIdentity, setFailedIdentity] = useState<string>();
  useLiveAudioCapture(true);
  const { curves, xScale, yScale } = usePlayerTrace(box.width, box.height);

  useEffect(() => {
    const element = frame.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setBox((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const playsScene =
    scene.state === 'ready' && failedIdentity !== scene.identity;
  useStandInForGraphScene(playsScene);
  return (
    <div
      ref={frame}
      className="karaoke-stage-media karaoke-graph-background"
      aria-hidden="true"
      inert
    >
      {playsScene && scene.state === 'ready' && (
        <ScenePreview
          identity={scene.identity}
          madeBy={scene.madeBy}
          pack={scene.pack}
          look={{ lookId: scene.lookId, revision: scene.revision }}
          surface="player"
          label={scene.label}
          tuning={scene.tuning}
          wave={scene.wave}
          blurPx={blur}
          onTrouble={() => setFailedIdentity(scene.identity)}
        />
      )}
      {!playsScene &&
        scene.state !== 'loading' &&
        box.width > 0 &&
        box.height > 0 && (
          <LiveTraceCanvas
            curves={curves}
            xScale={xScale}
            yScale={yScale}
            width={box.width}
            height={box.height}
            offsetLeft={0}
            offsetTop={0}
            isForeground
            hasKey={false}
          />
        )}
    </div>
  );
}
