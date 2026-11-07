import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IScenePack } from 'common/scenePacks';
import Glyph from '../community/Glyph';
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
import usePublishVideo, { type IPublishPreview } from './usePublishVideo';
import type { TStudioSignal } from './studioSignals';
import createPublishDemoAudio from './publishDemoAudio';
import '../styles/StudioStage.scss';

/** What the scene can hear while its cover is caught. */
type TCameraSignal = Extract<TStudioSignal, 'live' | 'showcase'>;

const SIGNALS: readonly { signal: TCameraSignal; key: TranslationKey }[] = [
  { signal: 'live', key: 'studio.publish.yourMusic' },
  { signal: 'showcase', key: 'studio.publish.demo' },
];

/**
 * Below this the scene is hearing nothing. The energy a scene is given falls
 * to zero when nothing plays and sits well above this under the quietest
 * passage of a real song.
 */
const QUIET_LEVEL = 0.02;

/**
 * How long nothing has to be heard before the stage says so, in drawn-frame
 * time: long enough that a gap between two songs, or the moment the stage
 * opens before the music reaches it, is not mistaken for silence.
 */
const QUIET_MS = 1500;

/** The runner's own cap on how far one frame moves the clock. */
const MAX_FRAME_MS = 100;

const TROUBLE_KEYS: Record<TPreviewTrouble, TranslationKey> = {
  heavy: 'studio.publish.stageHeavy',
  unavailable: 'studio.publish.stageUnavailable',
  compile: 'studio.publish.stageUnavailable',
};

interface IStudioPublishCameraProps {
  /** The project, so a new one would start the stage from the top. */
  identity: string;
  pack: IScenePack;
  name: string;
  /** Publishing: nothing is caught while it runs. */
  locked: boolean;
  /** The Studio's settings: the cover is the scene as it was tuned. */
  tuning: ISceneTuning;
  onCapture: (frames: ISceneFrame[]) => void;
  source: string;
  onPreview: (preview: IPublishPreview | undefined) => void;
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
  initialFocusRef,
}: IStudioPublishCameraProps) {
  const { t } = useTranslation();
  const [signal, setSignal] = useState<TCameraSignal>('live');
  const [trouble, setTrouble] = useState<TPreviewTrouble>();
  const [ready, setReady] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [flashes, setFlashes] = useState(0);
  const recorder = useMemo(createMomentRecorder, []);
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
    `${source}\n${signal}`,
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
  const shapeFrame = useCallback(
    (frame: ISceneFrame) => {
      videoInput(frame.playing === true && !audioRef.current.isPaused);
      return frame;
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
      recorder.record(frame);
      // The runner's fade approaches one asymptotically. Capture once its
      // real rendered frame is visible, so the video's opening is the scene.
      if (canvas && frame.fade >= 0.99) {
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
    onCapture(frames);
  };
  const retryVideo = () => {
    setTrouble(undefined);
    videoRetry();
  };

  return (
    <div className="studio-publish__camera">
      <div className="studio-publish__viewfinder">
        {trouble ? (
          <p className="studio-publish__trouble" role="status">
            {t(TROUBLE_KEYS[trouble])}
          </p>
        ) : (
          <SceneAudioProvider value={selectedAudio}>
            <ScenePreview
              captureFrames={
                videoState.phase === 'waiting' ||
                videoState.phase === 'preparing' ||
                videoState.phase === 'recording'
              }
              captureSize={{ width: 854, height: 480 }}
              // The member's own work, on its way to the gallery.
              madeBy="listener"
              identity={`publish:${identity}`}
              pack={pack}
              label={t('studio.stage.label', { name })}
              onTrouble={stageTrouble}
              onDrawn={onDrawn}
              shapeFrame={shapeFrame}
              tuning={tuning}
            />
          </SceneAudioProvider>
        )}

        {flashes > 0 && (
          <span
            key={flashes}
            className="studio-publish__flash"
            aria-hidden="true"
          />
        )}

        {!trouble && quiet && signal === 'live' && (
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
              onClick={() => selectSignal(entry.signal)}
            >
              {t(entry.key)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="button small subtle"
          disabled={!ready || locked || trouble !== undefined}
          onClick={shoot}
        >
          <Glyph name="camera" />
          {t('studio.publish.capture')}
        </button>
      </div>
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
