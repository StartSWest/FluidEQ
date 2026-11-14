import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import type { IScenePack } from 'common/scenePacks';
import Glyph from '../community/Glyph';
import { pageDaylight } from '../graph/sceneDaylight';
import { snapPercent } from '../utils/percentSnaps';
import {
  SceneAudioProvider,
  useSceneAudio,
  type ISceneAudio,
} from '../audio/SceneAudioContext';
import type { ISceneFrame } from '../graph/sceneGl';
import type { ISceneTuning } from '../graph/useSceneRunner';
import ScenePreview, { type TPreviewTrouble } from '../plus/ScenePreview';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';
import { createMomentRecorder } from './momentRecorder';
import StudioPublishVideo from './StudioPublishVideo';
import StudioPublishDaylightIcon from './StudioPublishDaylightIcon';
import { Setting } from './StudioSettings';
import usePublishVideo, { type IPublishPreview } from './usePublishVideo';
import { previewCaptureSize } from './previewVideo';
import createPublishDemoAudio from './publishDemoAudio';
import {
  isTakeHolding,
  isTakeRunning,
  StudioPublishShapeOver,
  StudioPublishShapeSwitch,
  viewOfShape,
  type TPublishShape,
} from './StudioPublishShapes';
import {
  DAYLIGHT_SNAPS,
  DAYLIGHT_SPAN,
  MAX_FRAME_MS,
  QUIET_LEVEL,
  QUIET_MS,
  SIGNALS,
  TROUBLE_KEYS,
  type TCameraSignal,
} from './publishCameraSettings';
import '../styles/StudioStage.scss';

interface IStudioPublishCameraProps {
  /** The project, so a new one would start the stage from the top. */
  identity: string;
  pack: IScenePack;
  name: string;
  /** Publishing: nothing is caught while it runs. */
  locked: boolean;
  /** The Studio's settings: the cover is the scene as it was tuned. */
  tuning: ISceneTuning;
  /** A caught moment, at the time of day the stage was showing. */
  onCapture: (frames: ISceneFrame[], daylight: number) => void;
  source: string;
  onPreview: (preview: IPublishPreview | undefined) => void;
  /**
   * A take is being recorded or finished: Send says so and waits. Waiting
   * for the music is not one — nothing happens until it plays.
   */
  onRecording?: (recording: boolean) => void;
  initialFocusRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Where the cover is caught: the scene playing in the dialog, on the member's
 * music or on the demo chorus, and the shutter under it — never on it, since
 * what is framed is what is kept.
 *
 * What is on screen is the scene at the stage's size; what a capture keeps is
 * the same moment drawn again at the gallery's full quality from what the
 * scene heard up to it, so a machine that plays the stage small still sends a
 * sharp cover.
 */
export default function StudioPublishCamera({
  identity,
  pack,
  name,
  locked,
  tuning,
  onCapture,
  source,
  onPreview,
  onRecording,
  initialFocusRef,
}: IStudioPublishCameraProps) {
  const { t } = useTranslation();
  const [signal, setSignal] = useState<TCameraSignal>('live');
  const [trouble, setTrouble] = useState<TPreviewTrouble>();
  const [ready, setReady] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [flashes, setFlashes] = useState(0);
  // The hour the cover and the preview video are shot at (Ivan, 2026-11-07:
  // "we need sliders for time of day so we configure that from the publish
  // screen"). It starts where the window has it and is the dialog's own:
  // moving it leaves the app's Brightness and every other scene alone.
  const [daylight, setDaylight] = useState(() => Math.round(pageDaylight()));
  const daylightRef = useRef(daylight);
  daylightRef.current = daylight;
  const readDaylight = useCallback(() => daylightRef.current, []);
  // The hour the preview video is shot at, set when the slider is let go: a
  // clip shot at another hour is not the one asked for, so it is recorded
  // again — once, not at every step of the drag.
  const [videoDaylight, setVideoDaylight] = useState(daylight);
  const recorder = useMemo(createMomentRecorder, []);
  // Why a control does nothing while the clip is on its way to the gallery.
  const lockedHint = locked ? t('studio.publish.clipLocked') : undefined;
  // Drawn at the size the clip is recorded at (1280x720 where VP9 records).
  const captureSize = useMemo(previewCaptureSize, []);
  const liveAudio = useSceneAudio();
  const demo = useRef<ReturnType<typeof createPublishDemoAudio> | undefined>(
    undefined,
  );
  const stopDemo = useCallback(() => {
    const playing = demo.current;
    demo.current = undefined;
    playing
      ?.stop()
      .catch((error: unknown) =>
        reportError('Stopping the preview demo', error),
      );
  }, []);
  useEffect(() => stopDemo, [stopDemo]);
  const previewChanged = useCallback(
    (preview: IPublishPreview | undefined) => {
      onPreview(preview ? { ...preview, source } : undefined);
    },
    [source, onPreview],
  );
  const {
    state: videoState,
    frame: videoFrame,
    input: videoInput,
    fail: videoFail,
    cancel: videoCancel,
    retry: videoRetry,
  } = usePublishVideo(
    `${source}\n${signal}\n${videoDaylight}`,
    t('studio.publish.videoWatermark'),
    previewChanged,
  );
  useEffect(() => {
    const playing = demo.current;
    playing?.setPaused(liveAudio.isPaused).catch(() => {
      if (demo.current === playing) {
        stopDemo();
        videoFail();
      }
    });
  }, [signal, liveAudio.isPaused, stopDemo, videoFail]);
  // What the frame shows: the scene playing, or the clip just recorded, on
  // two tabs in the frame itself (Ivan, 2026-11-07: under the buttons the
  // finished clip sat below everything else). A new clip opens on its own
  // tab; Live is the member's choice for that clip only.
  const takeBusy =
    isTakeHolding(videoState.phase) ||
    videoState.phase === 'encoding' ||
    videoState.phase === 'checking';
  useEffect(() => onRecording?.(takeBusy), [takeBusy, onRecording]);
  const recordedUrl = videoState.phase === 'ready' ? videoState.url : undefined;
  const [liveOver, setLiveOver] = useState<string>();
  const showsRecorded = recordedUrl !== undefined && liveOver !== recordedUrl;
  const stageTrouble = useCallback(
    (problem: TPreviewTrouble) => {
      setTrouble(problem);
      videoFail();
    },
    [videoFail],
  );

  const signalRef = useRef(signal);
  signalRef.current = signal;
  const audioRef = useRef(liveAudio);
  audioRef.current = liveAudio;
  const selectedAudio = useMemo<ISceneAudio>(
    () => ({
      points: signal === 'live' ? liveAudio.points : [],
      waveform: signal === 'live' ? liveAudio.waveform : [],
      isPaused: liveAudio.isPaused,
      readFrame: () =>
        signalRef.current === 'live'
          ? audioRef.current.readFrame()
          : (demo.current?.readFrame() ?? {
              points: [],
              waveform: [],
              sound: undefined,
            }),
    }),
    [signal, liveAudio.points, liveAudio.waveform, liveAudio.isPaused],
  );
  // The view the scene is played in. The covers and the preview video are
  // the Normal view's alone: in the others the clip waits and Capture rests,
  // because each is drawn on a canvas of its own shape.
  const [shape, setShape] = useState<TPublishShape>('normal');
  const shapeRef = useRef(shape);
  shapeRef.current = shape;
  const viewfinderRef = useRef<HTMLDivElement>(null);
  const shapeFrame = useCallback(
    (frame: ISceneFrame) => {
      const normal = shapeRef.current === 'normal';
      videoInput(
        normal && frame.playing === true && !audioRef.current.isPaused,
      );
      const view = viewOfShape(shapeRef.current);
      return view ? { ...frame, view } : frame;
    },
    [videoInput],
  );
  const selectSignal = (next: TCameraSignal) => {
    stopDemo();
    videoInput(false);
    setSignal(next);
    if (next === 'showcase') {
      try {
        const playing = createPublishDemoAudio(liveAudio.isPaused);
        demo.current = playing;
        playing.ready.catch(() => {
          if (demo.current === playing) {
            stopDemo();
            videoFail();
          }
        });
      } catch {
        videoFail();
      }
    }
  };

  // Counted on drawn frames, and state set only when it flips, so nothing
  // above the canvas renders at frame rate.
  const quietFor = useRef(0);
  const quietRef = useRef(false);
  const readyRef = useRef(false);
  const onDrawn = useCallback(
    (frame: ISceneFrame, canvas?: HTMLCanvasElement) => {
      const normal = shapeRef.current === 'normal';
      if (normal) {
        recorder.record(frame);
      }
      // The runner's fade approaches one asymptotically. Capture once its
      // real rendered frame is visible, so the video's opening is the scene.
      if (normal && canvas && frame.fade >= 0.99) {
        videoFrame(canvas);
      }
      if (!readyRef.current) {
        readyRef.current = true;
        setReady(true);
      }
      quietFor.current =
        frame.level < QUIET_LEVEL
          ? quietFor.current + Math.min(MAX_FRAME_MS, frame.deltaMs ?? 0)
          : 0;
      const nowQuiet = quietFor.current >= QUIET_MS;
      if (nowQuiet !== quietRef.current) {
        quietRef.current = nowQuiet;
        setQuiet(nowQuiet);
      }
    },
    [recorder, videoFrame],
  );

  const shoot = () => {
    const frames = recorder.moment();
    if (frames.length === 0) {
      return;
    }
    setFlashes((count) => count + 1);
    onCapture(frames, daylight);
  };
  const retryVideo = () => {
    setTrouble(undefined);
    videoRetry();
  };

  // A take holds the canvas at the clip's size while it records, so it runs
  // in the Normal view only: one under way when another view is chosen is
  // let go, and taken again on the way back (a take still waiting for music
  // holds nothing and simply waits). The views are never locked behind the
  // clip: with nothing playing it waits for good.
  const retakeOnNormal = useRef(false);
  const chooseShape = (next: TPublishShape) => {
    if (next === shape) {
      return;
    }
    if (next !== 'normal') {
      // The clip is the Normal view's: another view shows the scene live.
      setLiveOver(recordedUrl);
      if (isTakeHolding(videoState.phase)) {
        videoCancel();
        retakeOnNormal.current = true;
      }
    } else if (retakeOnNormal.current) {
      retakeOnNormal.current = false;
      videoRetry();
    }
    setShape(next);
  };
  const recording = shape === 'normal' && isTakeRunning(videoState.phase);

  return (
    <div className="studio-publish__camera">
      {!trouble && (
        <StudioPublishShapeSwitch shape={shape} onShape={chooseShape} />
      )}
      <div
        ref={viewfinderRef}
        className={`studio-publish__viewfinder studio-publish__viewfinder--${shape}`}
      >
        {trouble ? (
          <p className="studio-publish__trouble" role="status">
            {t(TROUBLE_KEYS[trouble])}
          </p>
        ) : (
          <SceneAudioProvider value={selectedAudio}>
            <ScenePreview
              // Paused too: a stage scrolled out of sight would give its
              // canvas back, and the take holding it could not carry on.
              captureFrames={recording}
              // The clip's size is the Normal view's canvas; the others are
              // drawn at the shape they show.
              captureSize={shape === 'normal' ? captureSize : undefined}
              // The member's own work, on its way to the gallery.
              madeBy="listener"
              identity={`publish:${identity}`}
              pack={pack}
              label={t('studio.stage.label', { name })}
              onTrouble={stageTrouble}
              onDrawn={onDrawn}
              shapeFrame={shapeFrame}
              tuning={tuning}
              daylight={readDaylight}
            />
          </SceneAudioProvider>
        )}

        {!trouble && (
          <StudioPublishShapeOver shape={shape} frameRef={viewfinderRef} />
        )}

        {showsRecorded && (
          <video
            key={recordedUrl}
            className="studio-publish__recorded"
            src={recordedUrl}
            autoPlay
            loop
            muted
            playsInline
            controls
            aria-label={t('studio.publish.videoPlay')}
          />
        )}

        {/* The clip is the Normal view's, so its tab is too: over the
            player's title or the ultra-wide band it covered what is judged. */}
        {!trouble && shape === 'normal' && (
          <div
            className="studio-segments studio-publish__view-tabs"
            role="group"
            aria-label={t('studio.publish.viewChoice')}
          >
            <button
              type="button"
              className="studio-segment"
              aria-pressed={!showsRecorded}
              onClick={() => setLiveOver(recordedUrl)}
            >
              {t('studio.publish.viewLive')}
            </button>
            <button
              type="button"
              className="studio-segment"
              aria-pressed={showsRecorded}
              disabled={recordedUrl === undefined}
              onClick={() => {
                setLiveOver(undefined);
                setShape('normal');
              }}
            >
              {t('studio.publish.viewRecorded')}
            </button>
          </div>
        )}

        {flashes > 0 && (
          <span
            key={flashes}
            className="studio-publish__flash"
            aria-hidden="true"
          />
        )}

        {!trouble &&
          !locked &&
          !showsRecorded &&
          quiet &&
          signal === 'live' && (
            <div className="studio-publish__quiet" role="status">
              <strong>{t('studio.publish.quietTitle')}</strong>
              <span>{t('studio.publish.quietBody')}</span>
              <button
                type="button"
                className="button small subtle"
                onClick={() => selectSignal('showcase')}
              >
                {t('studio.publish.useDemo')}
              </button>
            </div>
          )}
      </div>

      <div className="studio-publish__controls">
        <div
          className="studio-segments"
          role="group"
          aria-label={t('studio.publish.hears')}
        >
          {SIGNALS.map((entry) => (
            <button
              key={entry.signal}
              type="button"
              className="studio-segment"
              aria-pressed={signal === entry.signal}
              disabled={locked || trouble !== undefined}
              title={lockedHint}
              onClick={() => selectSignal(entry.signal)}
            >
              {t(entry.key)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="button small subtle"
          disabled={
            !ready ||
            locked ||
            trouble !== undefined ||
            showsRecorded ||
            shape !== 'normal'
          }
          title={
            lockedHint ??
            (shape === 'normal' ? undefined : t('studio.publish.coversNormal'))
          }
          onClick={shoot}
        >
          <Glyph name="camera" />
          {t('studio.publish.capture')}
        </button>
      </div>
      <Setting
        label={t('studio.publish.timeOfDay')}
        hint={lockedHint ?? t('studio.publish.timeOfDayHint')}
        value={t('studio.settings.percent', { percent: daylight })}
        position={(daylight - SCENE_DAYLIGHT_MIN) / DAYLIGHT_SPAN}
        disabled={locked || trouble !== undefined}
        onPosition={(position) =>
          setDaylight(
            snapPercent(
              Math.round(SCENE_DAYLIGHT_MIN + position * DAYLIGHT_SPAN),
            ),
          )
        }
        onCommit={() => setVideoDaylight(daylightRef.current)}
        snaps={DAYLIGHT_SNAPS}
        icon={<StudioPublishDaylightIcon daylight={daylight} />}
      />
      <StudioPublishVideo
        initialFocusRef={initialFocusRef}
        state={videoState}
        locked={locked}
        onCancel={videoCancel}
        onRetry={retryVideo}
      />
    </div>
  );
}
