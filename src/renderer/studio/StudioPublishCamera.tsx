import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import type { IScenePack } from 'common/scenePacks';
import Glyph from '../community/Glyph';
import { pageDaylight } from '../graph/sceneDaylight';
import { snapPercent } from '../utils/percentSnaps';
import { SceneAudioProvider } from '../audio/SceneAudioContext';
import type { ISceneFrame } from '../graph/sceneGl';
import type { ISceneDrawReport } from '../graph/sceneRunnerTypes';
import type { ISceneTuning } from '../graph/useSceneRunner';
import ScenePreview, { type TPreviewTrouble } from '../plus/ScenePreview';
import { useTranslation } from '../utils/I18nContext';
import { createMomentRecorder } from './momentRecorder';
import StudioPublishVideo from './StudioPublishVideo';
import StudioPublishDaylightIcon from './StudioPublishDaylightIcon';
import StudioPublishHears from './StudioPublishHears';
import { Setting } from './StudioSettings';
import {
  NightToDaySwitch,
  useDaylightSweep,
  useNightToDay,
} from './StudioPublishSweep';
import usePublishVideo, { type IPublishPreview } from './usePublishVideo';
import usePublishSignal, { useDemoEndsWithTake } from './usePublishSignal';
import { previewCaptureSize } from './previewVideo';
import {
  isTakeHolding,
  isTakeRunning,
  StudioPublishShapeOver,
  StudioPublishShapeSwitch,
  StudioPublishViewTabs,
  viewOfShape,
  type TPublishShape,
} from './StudioPublishShapes';
import {
  DAYLIGHT_SNAPS,
  DAYLIGHT_SPAN,
  MAX_FRAME_MS,
  QUIET_LEVEL,
  QUIET_MS,
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
  /**
   * Where the clip's status and its button go: the dialog's side column,
   * under the covers, with the rest of what is published. Made once, before
   * the camera first renders, so the button there can take the dialog's
   * first focus (`usePortalSlot`).
   */
  videoSlot: HTMLElement;
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
  videoSlot,
  initialFocusRef,
}: IStudioPublishCameraProps) {
  const { t } = useTranslation();
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
  const nightToDay = useNightToDay(pack);
  // The hour the preview video is shot at, set when the slider is let go: a
  // clip shot at another hour is not the one asked for, so it is recorded
  // again — once, not at every step of the drag.
  const [videoDaylight, setVideoDaylight] = useState(daylight);
  const recorder = useMemo(createMomentRecorder, []);
  // Why a control does nothing while the clip is on its way to the gallery.
  const lockedHint = locked ? t('studio.publish.clipLocked') : undefined;
  // Drawn at the size the clip is recorded at (1280x720 where VP9 records).
  const captureSize = useMemo(previewCaptureSize, []);
  // A demo that cannot play fails the take; the take is made below, keyed on
  // what the scene hears, so the failure reaches it through this.
  const failTake = useRef<() => void>(() => undefined);
  const hearing = usePublishSignal(() => failTake.current());
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
    `${source}\n${hearing.signal}\n${nightToDay.sweeping ? 'night-to-day' : videoDaylight}`,
    t('studio.publish.videoWatermark'),
    previewChanged,
  );
  failTake.current = videoFail;
  useDemoEndsWithTake(hearing, videoState.phase);
  // What the frame shows: the scene playing, or the clip just recorded, on
  // two tabs over the frame (Ivan, 2026-11-07: under the buttons the
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

  // The view the scene is played in. The covers and the preview video are
  // the Normal view's alone: in the others the clip waits and Capture rests,
  // because each is drawn on a canvas of its own shape.
  const [shape, setShape] = useState<TPublishShape>('normal');
  const shapeRef = useRef(shape);
  shapeRef.current = shape;
  const viewfinderRef = useRef<HTMLDivElement>(null);
  const { livePaused } = hearing;
  const shapeFrame = useCallback(
    (frame: ISceneFrame) => {
      const normal = shapeRef.current === 'normal';
      videoInput(normal && frame.playing === true && !livePaused());
      const view = viewOfShape(shapeRef.current);
      return view ? { ...frame, view } : frame;
    },
    [videoInput, livePaused],
  );
  const selectSignal = (next: TCameraSignal) => {
    videoInput(false);
    hearing.select(next);
  };

  // Counted on drawn frames, and state set only when it flips, so nothing
  // above the canvas renders at frame rate.
  const quietFor = useRef(0);
  const quietRef = useRef(false);
  const readyRef = useRef(false);
  const onDrawn = useCallback(
    (
      frame: ISceneFrame,
      canvas?: HTMLCanvasElement,
      report?: ISceneDrawReport,
    ) => {
      // A frame of the Normal view by what it was drawn as, not by the view
      // chosen now: on the way back from another view the first frames are
      // still that view's, at its size, and one of them kept would be a
      // squashed frame in the clip.
      const normal = shapeRef.current === 'normal' && frame.view === undefined;
      if (normal) {
        recorder.record(frame);
      }
      // The runner's fade approaches one asymptotically. Capture once its
      // real rendered frame is visible, so the video's opening is the scene.
      if (
        normal &&
        canvas &&
        frame.fade >= 0.99 &&
        report?.outputWidth === captureSize.width &&
        report.outputHeight === captureSize.height
      ) {
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
    [recorder, videoFrame, captureSize],
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

  // A VIEW NEVER COSTS THE CLIP (Ivan, 2026-11-18: "We need to keep the
  // video displayed ... when I select between Amp, Ultra wide, it's a
  // mess"). Leaving Normal used to cancel a take under way and start it
  // again from nothing on the way back, so a look at Amp mid-take threw the
  // recording away and the footer asked for a preview video again. A take
  // now waits in the other views exactly as it waits through a quiet moment
  // — `shapeFrame` tells it nothing is playing there — and carries on from
  // the same second in Normal; a finished clip is never touched, and its tab
  // plays it from any view. Choosing a view shows that view live.
  const chooseShape = (next: TPublishShape) => {
    if (next === shape) {
      return;
    }
    setLiveOver(recordedUrl);
    setShape(next);
  };
  const recording = shape === 'normal' && isTakeRunning(videoState.phase);
  const readDaylight = useDaylightSweep(
    nightToDay.sweeping && recording,
    videoState,
    daylightRef,
  );

  return (
    <div className="studio-publish__camera">
      <div className="studio-publish__stage-bar">
        <StudioPublishViewTabs
          showsRecorded={showsRecorded}
          hasRecording={recordedUrl !== undefined}
          onLive={() => setLiveOver(recordedUrl)}
          onRecorded={() => setLiveOver(undefined)}
        />
        <StudioPublishShapeSwitch
          shape={shape}
          disabled={trouble !== undefined}
          onShape={chooseShape}
        />
      </div>
      {/* ONE FRAME FOR EVERY VIEW. Each view's picture is fitted inside it
          on the dialog's own ground; the Amp's column used to make the
          frame up to 966px tall and Ultra wide a third of that, so every
          control under it jumped at each switch and the Amp's pushed them
          out of the dialog (Ivan, 2026-11-18). */}
      <div className="studio-publish__stage">
        {trouble ? (
          <p className="studio-publish__trouble" role="status">
            {t(TROUBLE_KEYS[trouble])}
          </p>
        ) : (
          <div
            ref={viewfinderRef}
            className={`studio-publish__viewfinder studio-publish__viewfinder--${shape}`}
          >
            <SceneAudioProvider value={hearing.audio}>
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
            <StudioPublishShapeOver shape={shape} frameRef={viewfinderRef} />
            {flashes > 0 && (
              <span
                key={flashes}
                className="studio-publish__flash"
                aria-hidden="true"
              />
            )}
            {!locked &&
              !showsRecorded &&
              quiet &&
              hearing.signal === 'live' && (
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
        )}
        {/* The clip is the Normal view's 16:9, the frame's own shape, so it
            fills the frame over whichever view is live under it. */}
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
      </div>

      <div className="studio-publish__controls">
        <StudioPublishHears
          signal={hearing.signal}
          demoPlaying={hearing.demoPlaying}
          disabled={locked || trouble !== undefined}
          hint={lockedHint}
          onSelect={selectSignal}
        />
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
      <div className="studio-publish__hour">
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
        <NightToDaySwitch
          choice={nightToDay}
          disabled={locked || trouble !== undefined}
          hint={lockedHint}
        />
      </div>
      {createPortal(
        <StudioPublishVideo
          initialFocusRef={initialFocusRef}
          state={videoState}
          away={shape !== 'normal'}
          locked={locked}
          onCancel={videoCancel}
          onRetry={retryVideo}
        />,
        videoSlot,
      )}
    </div>
  );
}
