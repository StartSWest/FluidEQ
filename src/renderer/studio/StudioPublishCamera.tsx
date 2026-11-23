import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import type { IScenePack } from 'common/scenePacks';
import Glyph from '../community/Glyph';
import { snapPercent } from '../utils/percentSnaps';
import { SceneAudioProvider } from '../audio/SceneAudioContext';
import type { ISceneFrame } from '../graph/sceneGl';
import type { ISceneDrawReport } from '../graph/sceneRunnerTypes';
import type { ISceneTuning } from '../graph/useSceneRunner';
import ScenePreview, { type TPreviewTrouble } from '../plus/ScenePreview';
import { useTranslation } from '../utils/I18nContext';
import { createMomentRecorder } from './momentRecorder';
import StudioPublishVideo, {
  StudioPublishRecordingTag,
} from './StudioPublishVideo';
import StudioPublishDaylightIcon from './StudioPublishDaylightIcon';
import { Setting } from './StudioSettings';
import {
  NightToDaySwitch,
  useDaylightSweep,
  useNightToDay,
} from './StudioPublishSweep';
import usePublishVideo, {
  type IPublishPreview,
  type TPublishVideoState,
} from './usePublishVideo';
import usePublishSignal from './usePublishSignal';
import { previewCaptureSize } from './previewVideo';
import {
  isTakeBusy,
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
  DAYLIGHT_START,
  TROUBLE_KEYS,
} from './publishCameraSettings';
import '../styles/StudioStage.scss';

interface IStudioPublishCameraProps {
  /** The project, so a new one would start the stage from the top. */
  identity: string;
  pack: IScenePack;
  name: string;
  /** Publishing: nothing is caught while it runs. */
  locked: boolean;
  /**
   * The press is recording the clip it sends: the hour and the shutter
   * rest for its ten seconds, since a new hour would let the take go.
   */
  sending: boolean;
  /** The Studio's settings: the cover is the scene as it was tuned. */
  tuning: ISceneTuning;
  /** A caught moment, at the time of day the stage was showing. */
  onCapture: (frames: ISceneFrame[], daylight: number) => void;
  source: string;
  onPreview: (preview: IPublishPreview | undefined) => void;
  /**
   * Where the take stands, each time it moves: the dialog sends the scene
   * once its clip is ready, and gives the press back if it fails or is
   * cancelled.
   */
  onTake?: (phase: TPublishVideoState['phase']) => void;
  /**
   * Filled with the way to start a take, which the dialog calls when the
   * member sends the scene: the clip is recorded then, never on opening.
   */
  recordRef: MutableRefObject<(() => void) | undefined>;
  /**
   * Where the clip's status and its button go: the dialog's side column,
   * under the covers, with the rest of what is published. Made once, before
   * the camera first renders (`usePortalSlot`).
   */
  videoSlot: HTMLElement;
  initialFocusRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Where the cover is caught: the scene playing in the dialog to the demo
 * song, without a sound (`usePublishSignal`), the hour it is shot at, and
 * the shutter beside them — never on the scene, since what is framed is
 * what is kept. The preview clip is shot here too, but only when the scene
 * is sent (`recordRef`).
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
  sending,
  tuning,
  onCapture,
  source,
  onPreview,
  onTake,
  recordRef,
  videoSlot,
  initialFocusRef,
}: IStudioPublishCameraProps) {
  const { t } = useTranslation();
  const [trouble, setTrouble] = useState<TPreviewTrouble>();
  const [flashes, setFlashes] = useState(0);
  // The hour the cover and the preview video are shot at (Ivan, 2026-11-07:
  // "we need sliders for time of day so we configure that from the publish
  // screen"). It starts halfway (`DAYLIGHT_START`) and is the dialog's own:
  // moving it leaves the app's Brightness and every other scene alone.
  const [daylight, setDaylight] = useState(DAYLIGHT_START);
  const daylightRef = useRef(daylight);
  daylightRef.current = daylight;
  const nightToDay = useNightToDay(pack);
  // The hour the preview video is shot at, set when the slider is let go: a
  // clip already shot at another hour is not the one asked for, so it is
  // let go, and the next send records it again.
  const [videoDaylight, setVideoDaylight] = useState(daylight);
  const recorder = useMemo(createMomentRecorder, []);
  // Why a control does nothing while the clip is on its way to the gallery.
  const lockedHint = locked ? t('studio.publish.clipLocked') : undefined;
  const resting = locked || sending;
  // Drawn at the size the clip is recorded at (1280x720 where VP9 records).
  const captureSize = useMemo(previewCaptureSize, []);
  const hearing = usePublishSignal();
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
    record: videoRecord,
  } = usePublishVideo(
    `${source}\n${nightToDay.sweeping ? 'night-to-day' : videoDaylight}`,
    t('studio.publish.videoWatermark'),
    previewChanged,
  );
  useEffect(() => onTake?.(videoState.phase), [videoState.phase, onTake]);
  // A take under way, read where a failure lands outside a render.
  const takePhase = useRef(videoState.phase);
  takePhase.current = videoState.phase;
  // What the frame shows: the scene playing, or the clip just recorded, on
  // two tabs over the frame (Ivan, 2026-11-07: under the buttons the
  // finished clip sat below everything else). A new clip opens on its own
  // tab; Live is the member's choice for that clip only.
  const recordedUrl = videoState.phase === 'ready' ? videoState.url : undefined;
  const [liveOver, setLiveOver] = useState<string>();
  const showsRecorded = recordedUrl !== undefined && liveOver !== recordedUrl;
  // A scene that cannot play fails the take it was recording; with none
  // asked for, the stage says why and the next send fails at once
  // (`recordRef`), rather than the clip's part calling a recording failed
  // that nobody started.
  const stageTrouble = useCallback(
    (problem: TPreviewTrouble) => {
      setTrouble(problem);
      if (isTakeBusy(takePhase.current)) {
        videoFail();
      }
    },
    [videoFail],
  );
  // The demo giving out mid-take would hold the take on a scene at rest for
  // good; it fails instead, and the press is given back.
  useEffect(() => {
    if (hearing.failed && isTakeBusy(takePhase.current)) {
      videoFail();
    }
  }, [hearing.failed, videoFail]);

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
      videoInput(normal && frame.playing === true);
      const view = viewOfShape(shapeRef.current);
      return view ? { ...frame, view } : frame;
    },
    [videoInput],
  );

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

  // THE CLIP IS SHOT WHEN THE SCENE IS SENT (Ivan, 2026-11-23: "when they
  // click publish ... at that point, we will be recording the video"). The
  // take is the Normal view's, so the stage goes back to it, live, for its
  // ten seconds. A demo that could not start would leave the take waiting on
  // a scene at rest for good, so it fails at once instead, and says so.
  recordRef.current = () => {
    setLiveOver(undefined);
    setShape('normal');
    if (hearing.failed || trouble !== undefined) {
      videoFail();
      return;
    }
    videoRecord();
  };

  // A VIEW NEVER COSTS THE CLIP (Ivan, 2026-11-18: "We need to keep the
  // video displayed ... when I select between Amp, Ultra wide, it's a
  // mess"). A take waits in the other views — `shapeFrame` tells it nothing
  // is playing there — and carries on from the same second in Normal; a
  // finished clip is never touched, and its tab plays it from any view.
  // Choosing a view shows that view live.
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
          chosenRef={initialFocusRef}
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
            {shape === 'normal' && (
              <StudioPublishRecordingTag state={videoState} />
            )}
            {flashes > 0 && (
              <span
                key={flashes}
                className="studio-publish__flash"
                aria-hidden="true"
              />
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

      {/* The cover's whole job in one row: the hour it is shot at and the
          shutter. The music choice that stood here went with the member's
          own music (`usePublishSignal`). */}
      <div className="studio-publish__controls">
        <Setting
          label={t('studio.publish.timeOfDay')}
          hint={lockedHint ?? t('studio.publish.timeOfDayFor')}
          value={t('studio.settings.percent', { percent: daylight })}
          position={(daylight - SCENE_DAYLIGHT_MIN) / DAYLIGHT_SPAN}
          disabled={resting || trouble !== undefined}
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
          disabled={resting || trouble !== undefined}
          hint={lockedHint}
        />
        <button
          type="button"
          className="button small subtle studio-publish__shutter"
          // Never held for the first frame: a press before anything is
          // drawn keeps nothing.
          disabled={
            resting ||
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
      {createPortal(
        <StudioPublishVideo
          state={videoState}
          away={shape !== 'normal'}
          locked={locked}
          onCancel={videoCancel}
        />,
        videoSlot,
      )}
    </div>
  );
}
