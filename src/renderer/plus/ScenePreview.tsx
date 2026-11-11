import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TSceneMaker } from 'common/sceneMaker';
import type { IScenePack } from 'common/scenePacks';
import { DEFAULT_SCENE_WAVE, type ISceneWave } from 'common/sceneWave';
import type { TSceneSurface } from 'common/sceneFailureLog';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import type { ISceneFrame } from '../graph/sceneGl';
import type { ISceneDrawReport } from '../graph/sceneRunnerTypes';
import { createSceneInteraction } from '../graph/sceneInteraction';
import { readSceneCameraControl } from '../utils/sceneCameraControlStore';

import SceneViewReset from '../graph/SceneViewReset';
import { studioSpectrumRect } from '../studio/studioWave';
import { lastSceneBuild, reportSceneBuilt } from '../utils/sceneBuilds';
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
   * Who made the scene being shown (`sceneMaker.ts`). The gallery shows
   * FluidEQ's own scenes, other members' work, and the viewer's own
   * published scenes, and each is run as it is everywhere else.
   */
  madeBy: TSceneMaker;
  pack: IScenePack;
  label: string;
  onTrouble: (trouble: TPreviewTrouble) => void;
  /**
   * A newer version would not build and an earlier one plays on in its
   * place (`ISceneSource.versionFailed`). Absent, nothing is told.
   */
  onVersionFailed?: () => void;
  /**
   * After every frame drawn, with the frame, and what drawing it cost: the
   * admin's review page reads the scene's frame time from it.
   */
  onDrawn?: (
    frame: ISceneFrame,
    canvas?: HTMLCanvasElement,
    report?: ISceneDrawReport,
  ) => void;
  /** Replaces what the scene hears — the Studio's test signals. */
  shapeFrame?: (frame: ISceneFrame) => ISceneFrame;
  /** The member's settings over the pack's — the Studio's, in Publish. */
  tuning?: ISceneTuning;
  captureFrames?: boolean;
  /** Recording output, independent of this preview's CSS size and DPI. */
  captureSize?: { width: number; height: number };
  /**
   * Where the wave stands, for a preview that plays the listener's own
   * visualizer — the Library's player, its EQ screen, the backdrop behind a
   * video — which takes the wave the listener watches it with, as the desktop
   * does (`useWatchedSceneWave`). Absent, the author's: the gallery and the
   * review show a scene as its maker framed it.
   */
  wave?: ISceneWave;
  /**
   * The time of day to draw at, read every frame; absent, the page's
   * (Brightness or the listener's own choice). The Publish dialog sets its
   * own, so the cover and the preview video are shot at the hour the maker
   * picks there.
   */
  daylight?: () => number;
  /**
   * The look this scene is, where it plays one of the listener's looks: a
   * version of it that will not compile then gives way to the last one that
   * built here (`sceneBuilds.ts`) instead of the trouble below. With the
   * revision the pack is, a version that builds is kept as that last one.
   */
  look?: { lookId: string; revision?: string };
  /**
   * Where it plays, for the log's line when it does not
   * (`common/sceneFailureLog.ts`): the Library's player and the stages that
   * play the graph's look say `player`; every other preview is `preview`.
   */
  surface?: TSceneSurface;
}

/**
 * A scene playing on the member's own music: a published one on its page,
 * the listener's visualizer in the Library's player, or the member's own in
 * the Publish dialog, where the cover is caught.
 *
 * The same runner the graph, the desktop and the Studio use, run by the same
 * rules for the same maker (`sceneRules.ts`). It holds the live capture open
 * while it is on screen — the Plus tab is a view of its own, and a preview
 * that heard nothing would show a scene at rest whatever was playing. Only
 * one plays at a time: the page shows one scene, and the cards beside it are
 * pictures.
 */
export default function ScenePreview({
  identity,
  madeBy,
  pack,
  label,
  onTrouble,
  onVersionFailed,
  onDrawn,
  shapeFrame,
  tuning,
  captureFrames,
  captureSize,
  wave: listenerWave,
  daylight,
  look,
  surface = 'preview',
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
  const versionFailedRef = useRef(onVersionFailed);
  versionFailedRef.current = onVersionFailed;
  const tellsVersions = onVersionFailed !== undefined;

  const lookId = look?.lookId;
  const lookRevision = look?.revision;
  const source = useMemo<ISceneSource>(
    () => ({
      identity,
      surface,
      ...(lookId !== undefined ? { lookId } : {}),
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
      ...(tellsVersions
        ? { versionFailed: () => versionFailedRef.current?.() }
        : {}),
      ...(lookId !== undefined
        ? {
            lastBuilt: () => lastSceneBuild(lookId),
            built: () => {
              if (lookRevision !== undefined) {
                reportSceneBuilt(lookId, lookRevision);
              }
            },
          }
        : {}),
      madeBy,
    }),
    [identity, madeBy, lookId, lookRevision, surface, tellsVersions],
  );

  const drawnRef = useRef(onDrawn);
  drawnRef.current = onDrawn;
  const drawn = useCallback(
    (
      frame: ISceneFrame,
      _scale: number,
      _accent: number,
      _heard: ISceneFrame,
      report: ISceneDrawReport,
    ) =>
      drawnRef.current?.(
        frame,
        frameRef.current?.querySelector('canvas') ?? undefined,
        report,
      ),
    [],
  );

  // Where this scene's wave stands, worked out the way the graph, the stage
  // and the desktop background all work it out. It was [0, 1, 0, 1] - the
  // whole panel - so every scene that asks for a band of it was told its wave
  // fills the picture, and drew it somewhere else entirely: Alpine's curtain
  // came down among the mountains here while it crossed the sky everywhere
  // else, which is a scene a listener cannot judge from its own page. The
  // author's wave unless the place playing it hands over the listener's.
  const wave = listenerWave ?? pack.wave ?? DEFAULT_SCENE_WAVE;
  const { height: waveHeight, position: wavePosition } = wave;
  const spectrumRect = useMemo(
    () =>
      studioSpectrumRect(pack, { height: waveHeight, position: wavePosition }),
    [pack, waveHeight, wavePosition],
  );

  // The viewer's hands: turned and tapped wherever a preview can be reached
  // at all. Where one only decorates - a banner under its own overlay, a
  // backdrop that takes no pointer - no press ever arrives, and nothing here
  // needs telling so.
  const interaction = useMemo(
    () => createSceneInteraction(readSceneCameraControl),
    [],
  );

  const sceneRef = useSceneRunner({
    captureFrames,
    captureSize,
    source,
    width: box.width,
    height: box.height,
    spectrumRect,
    shapeFrame,
    ...(tuning ? { tuning } : {}),
    ...(daylight ? { daylight } : {}),
    onDrawn: drawn,
    interaction,
  });

  useEffect(() => {
    const frame = frameRef.current;
    const host = sceneRef.current;
    if (!frame || !host) {
      return undefined;
    }
    return interaction.attach(frame, {
      frame: () => host.getBoundingClientRect(),
    });
  }, [interaction, sceneRef]);

  return (
    <div ref={frameRef} className="gallery-preview__frame">
      <div
        ref={sceneRef}
        className="gallery-preview__canvas"
        role="img"
        aria-label={label}
        style={{ width: box.width, height: box.height }}
      />
      <SceneViewReset
        interaction={interaction}
        className="gallery-preview__reset"
      />
    </div>
  );
}
