import { useCallback, useMemo, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IScenePack } from 'common/scenePacks';
import Glyph from '../community/Glyph';
import type { ISceneFrame } from '../graph/sceneGl';
import type { ISceneTuning } from '../graph/useSceneRunner';
import ScenePreview, { type TPreviewTrouble } from '../plus/ScenePreview';
import { useTranslation } from '../utils/I18nContext';
import { createMomentRecorder } from './momentRecorder';
import {
  createStudioSignalBuffers,
  shapeStudioFrame,
  type TStudioSignal,
} from './studioSignals';
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
}: IStudioPublishCameraProps) {
  const { t } = useTranslation();
  const [signal, setSignal] = useState<TCameraSignal>('live');
  const [trouble, setTrouble] = useState<TPreviewTrouble>();
  const [ready, setReady] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [flashes, setFlashes] = useState(0);
  const recorder = useMemo(createMomentRecorder, []);

  const buffers = useMemo(createStudioSignalBuffers, []);
  const signalRef = useRef(signal);
  signalRef.current = signal;
  const shapeFrame = useCallback(
    (frame: ISceneFrame) => shapeStudioFrame(frame, signalRef.current, buffers),
    [buffers],
  );

  // Counted on drawn frames, and state set only when it flips, so nothing
  // above the canvas renders at frame rate.
  const quietFor = useRef(0);
  const quietRef = useRef(false);
  const readyRef = useRef(false);
  const onDrawn = useCallback(
    (frame: ISceneFrame) => {
      recorder.record(frame);
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
    [recorder],
  );

  const shoot = () => {
    const frames = recorder.moment();
    if (frames.length === 0) {
      return;
    }
    setFlashes((count) => count + 1);
    onCapture(frames);
  };

  return (
    <div className="studio-publish__camera">
      <div className="studio-publish__viewfinder">
        {trouble ? (
          <p className="studio-publish__trouble" role="status">
            {t(TROUBLE_KEYS[trouble])}
          </p>
        ) : (
          <ScenePreview
            identity={`publish:${identity}`}
            pack={pack}
            label={t('studio.stage.label', { name })}
            onTrouble={setTrouble}
            onDrawn={onDrawn}
            shapeFrame={shapeFrame}
            tuning={tuning}
          />
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
              onClick={() => setSignal('showcase')}
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
              disabled={trouble !== undefined}
              onClick={() => setSignal(entry.signal)}
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
    </div>
  );
}
