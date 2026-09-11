import { useEffect, useMemo, useRef, useState } from 'react';
import type { IScenePack } from 'common/scenePacks';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import { createFlashGuard } from '../graph/sceneFlashGuard';
import { createWarmupLadder } from '../graph/sceneWarmup';
import useSceneRunner, { type ISceneSource } from '../graph/useSceneRunner';

export type TPreviewTrouble = 'heavy' | 'unavailable' | 'compile';

interface IScenePreviewProps {
  /** The scene and its version: a new one starts it from the top. */
  identity: string;
  pack: IScenePack;
  label: string;
  onTrouble: (trouble: TPreviewTrouble) => void;
}

/**
 * A published scene playing on the member's own music, on its page.
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
  pack,
  label,
  onTrouble,
}: IScenePreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLiveAudioCapture(true);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      const { width, height } = frame.getBoundingClientRect();
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
      reportFailure: (reason) =>
        troubleRef.current(reason === 'compile' ? 'compile' : 'unavailable'),
      tooSlow: () => troubleRef.current('heavy'),
      createLadder: createWarmupLadder,
      createGuard: createFlashGuard,
    }),
    [identity],
  );

  const canvasRef = useSceneRunner({
    source,
    width: box.width,
    height: box.height,
    spectrumRect: [0, 1, 0, 1],
  });

  return (
    <div ref={frameRef} className="gallery-preview__frame">
      <canvas
        ref={canvasRef}
        className="gallery-preview__canvas"
        aria-label={label}
        style={{ width: box.width, height: box.height }}
      />
    </div>
  );
}
