import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IScenePack } from 'common/scenePacks';
import { DEFAULT_SCENE_WAVE } from 'common/sceneWave';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import type { TSceneMaker } from '../graph/sceneFlashGuard';
import type { ISceneFrame } from '../graph/sceneGl';
import { createWarmupLadder } from '../graph/sceneWarmup';
import { studioSpectrumRect } from '../studio/studioWave';
import useSceneRunner, {
  type ISceneSource,
  type ISceneTuning,
} from '../graph/useSceneRunner';
import '../styles/ScenePreview.scss';

export type TPreviewTrouble = 'heavy' | 'unavailable' | 'compile';

interface IScenePreviewProps {
  /** The scene and its version: a new one starts it from the top. */
  identity: string;
  /**
   * Who made the scene being shown. The gallery shows FluidEQ's own scenes,
   * other members' work, and the viewer's own published scenes, and the
   * brightness limiter is only for the middle one.
   */
  madeBy: TSceneMaker;
  pack: IScenePack;
  label: string;
  onTrouble: (trouble: TPreviewTrouble) => void;
  /** After every frame drawn, with the frame. */
  onDrawn?: (frame: ISceneFrame) => void;
  /** Replaces what the scene hears — the Studio's test signals. */
  shapeFrame?: (frame: ISceneFrame) => ISceneFrame;
  /** The member's settings over the pack's — the Studio's, in Publish. */
  tuning?: ISceneTuning;
}

/**
 * A scene playing on the member's own music: a published one on its page,
 * or the member's own in the Publish dialog, where the cover is caught.
 *
 * The same runner the graph and the Studio use, with the warm-up ladder and
 * the brightness limiter, because this is where a stranger's scene is first
 * watched. It holds the live capture open while it is on screen — the Plus
 * tab is a view of its own, and a preview that heard nothing would show a
 * scene at rest whatever was playing. Only one plays at a time: the page
 * shows one scene, and the cards beside it are pictures.
 */
export default function ScenePreview({
  identity,
  madeBy,
  pack,
  label,
  onTrouble,
  onDrawn,
  shapeFrame,
  tuning,
}: IScenePreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLiveAudioCapture(true);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }
    // The layout size, never the painted one: in the Publish dialog the frame
    // first appears inside the dialog's pop-in, scaled to 88%, and a
    // bounding rectangle taken then kept the canvas at 88% of its frame for
    // good — the size never changes again, so nothing measured it again.
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((previous) =>
        Math.round(previous.width) === Math.round(width) &&
        Math.round(previous.height) === Math.round(height)
          ? previous
          : { width, height },
      );
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const packRef = useRef(pack);
  packRef.current = pack;
  const troubleRef = useRef(onTrouble);
  troubleRef.current = onTrouble;

  const source = useMemo<ISceneSource>(
    () => ({
      identity,
      version: String(packRef.current.version),
      name: packRef.current.names.en,
      load: () => Promise.resolve(packRef.current),
      block: () => troubleRef.current('unavailable'),
      // Stops just this attempt; nothing here is written to disk, so the
      // next time the page opens it tries again fresh.
      reportFailure: (reason) => {
        troubleRef.current(reason === 'compile' ? 'compile' : 'unavailable');
      },
      tooSlow: () => troubleRef.current('heavy'),
      createLadder: createWarmupLadder,
      madeBy,
    }),
    [identity, madeBy],
  );

  const drawnRef = useRef(onDrawn);
  drawnRef.current = onDrawn;
  const drawn = useCallback(
    (frame: ISceneFrame) => drawnRef.current?.(frame),
    [],
  );

  // Where this scene's wave stands, worked out the way the graph, the stage
  // and the desktop background all work it out. It was [0, 1, 0, 1] - the
  // whole panel - so every scene that asks for a band of it was told its wave
  // fills the picture, and drew it somewhere else entirely: Alpine's curtain
  // came down among the mountains here while it crossed the sky everywhere
  // else, which is a scene a listener cannot judge from its own page. The
  // author's wave, because this is the scene as its maker framed it; a
  // listener's own choice belongs to the graph they play it on.
  const wave = pack.wave ?? DEFAULT_SCENE_WAVE;
  const { height: waveHeight, position: wavePosition } = wave;
  const spectrumRect = useMemo(
    () =>
      studioSpectrumRect(pack, { height: waveHeight, position: wavePosition }),
    [pack, waveHeight, wavePosition],
  );

  const sceneRef = useSceneRunner({
    source,
    width: box.width,
    height: box.height,
    spectrumRect,
    shapeFrame,
    ...(tuning ? { tuning } : {}),
    onDrawn: drawn,
  });

  return (
    <div ref={frameRef} className="gallery-preview__frame">
      <div
        ref={sceneRef}
        className="gallery-preview__canvas"
        role="img"
        aria-label={label}
        style={{ width: box.width, height: box.height }}
      />
    </div>
  );
}
