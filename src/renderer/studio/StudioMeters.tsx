import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type MutableRefObject,
} from 'react';
import { isNeutralResponse, type ISceneResponse } from 'common/sceneResponse';
import { SPECTRUM_TEXELS } from 'common/sceneUniformContract';
import { useTranslation } from '../utils/I18nContext';
import StudioCardGroup from './StudioCardGroup';
import {
  StudioBalanceMeter,
  StudioBeatClock,
  StudioDrumLamps,
  StudioLevelMeter,
  StudioMomentumMeter,
  StudioVoiceMeter,
  type ILevelMeter,
  type TMeterDraw,
  type TMeterRegister,
} from './StudioMeterRows';
import type { TStageHeard } from './StudioStage';
import '../styles/StudioMeters.scss';

/**
 * What the sound is made of: the ones the response bends, with the music as
 * played under them, and the stereo width beside the balance.
 */
const SOUND: readonly ILevelMeter[] = [
  {
    key: 'level',
    label: 'studio.meter.level',
    hint: 'studio.hears.level',
    value: (frame) => frame.level,
    heard: (frame) => frame.level,
  },
  {
    key: 'bass',
    label: 'studio.meter.bass',
    hint: 'studio.hears.bass',
    value: (frame) => frame.bands[0],
    heard: (frame) => frame.bands[0],
  },
  {
    key: 'mid',
    label: 'studio.meter.mid',
    hint: 'studio.hears.mid',
    value: (frame) => frame.bands[1],
    heard: (frame) => frame.bands[1],
  },
  {
    key: 'treble',
    label: 'studio.meter.treble',
    hint: 'studio.hears.treble',
    value: (frame) => frame.bands[2],
    heard: (frame) => frame.bands[2],
  },
];

const WIDTH: ILevelMeter = {
  key: 'width',
  label: 'studio.meter.width',
  hint: 'studio.hears.width',
  value: (frame) => frame.stereo?.[1] ?? 0,
};

/** The clock's certainty, and the pulse the beat lights. */
const RHYTHM: readonly ILevelMeter[] = [
  {
    key: 'sure',
    label: 'studio.meter.sure',
    hint: 'studio.hears.sure',
    value: (frame) => frame.rhythm?.confidence ?? 0,
  },
  {
    key: 'beat',
    label: 'studio.meter.beat',
    hint: 'studio.hears.beat',
    value: (frame) => frame.beat,
    heard: (frame) => frame.beat,
  },
];

/**
 * Where the song is: how intense this part is, a build, a drop landing (its
 * readout counts the drops, which scenes use to make each one different),
 * and the rare big moment. The accent is the scene's own envelope, made
 * after the response, so it has nothing heard to compare with.
 */
const SONG: readonly ILevelMeter[] = [
  {
    key: 'intensity',
    label: 'studio.meter.intensity',
    hint: 'studio.hears.intensity',
    value: (frame) => frame.rhythm?.intensity ?? 0,
  },
  {
    key: 'build',
    label: 'studio.meter.build',
    hint: 'studio.hears.build',
    value: (frame) => frame.rhythm?.build ?? 0,
  },
  {
    key: 'drop',
    label: 'studio.meter.drop',
    hint: 'studio.hears.drop',
    value: (frame) => frame.rhythm?.drop ?? 0,
    text: (frame) => `#${frame.rhythm?.dropSerial ?? 0}`,
    // The count comes round again after 4095 (`rhythmSection.ts`).
    widest: '#0000',
  },
  {
    key: 'accent',
    label: 'studio.meter.accent',
    hint: 'studio.hears.accent',
    value: (_frame, accent) => accent,
  },
];

/** Bars in the spectrum strip: enough to read its shape, few enough to draw. */
const SPECTRUM_BARS = 32;

interface IStudioMetersProps {
  /** The stage calls this with every frame, the moment it is made. */
  feed: MutableRefObject<TStageHeard | undefined>;
  /** How the scene answers the music now, to show what it does. */
  response: ISceneResponse;
}

/**
 * What the scene hears, frame by frame as the music is heard — so a creator
 * can see WHY something moved, or why it did not — in three groups that fold
 * on their own, as the settings card's do: the sound, its rhythm (the clock a
 * dance is built on, the drums, the flywheel) and where the song is.
 *
 * With a response set, each bent meter shows both: faint, the music as it
 * is played; bright, what the scene got from it; and a mark where the
 * threshold cuts in, on the music's own scale. A slider moved beside it
 * shows its effect here in the same second.
 */
export default function StudioMeters({ feed, response }: IStudioMetersProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const drawers = useRef(new Map<string, TMeterDraw>());
  const bars = useRef<Array<HTMLElement | null>>([]);
  const register = useCallback<TMeterRegister>((key, draw) => {
    if (draw) {
      drawers.current.set(key, draw);
    } else {
      drawers.current.delete(key);
    }
  }, []);
  const bent = !isNeutralResponse(response);
  // Where the gate shuts, in what is heard: below this, the scene gets
  // nothing. Past the end of the scale when the sensitivity makes it so.
  const gateAt =
    response.threshold > 0
      ? Math.min(1, response.threshold / response.sensitivity)
      : undefined;

  useEffect(() => {
    feed.current = (frame, heard, musicAccent) => {
      drawers.current.forEach((draw) => draw(frame, heard, musicAccent));
      const step = SPECTRUM_TEXELS / SPECTRUM_BARS;
      bars.current.forEach((bar, index) => {
        if (bar) {
          const texel = frame.spectrum[Math.floor(index * step + step / 2)];
          bar.style.transform = `scaleY(${Math.max(0.03, texel / 255)})`;
        }
      });
    };
    return () => {
      feed.current = undefined;
    };
  }, [feed]);

  return (
    <section
      className={`studio-card studio-meters${bent ? ' is-bent' : ''}`}
      aria-labelledby={titleId}
      aria-live="off"
    >
      <span className="studio-card__eyebrow" id={titleId}>
        {t('studio.meters.title')}
      </span>
      <StudioCardGroup group="sound" title={t('studio.meters.sound')}>
        <div className="studio-meters__rows">
          {SOUND.map((meter) => (
            <StudioLevelMeter
              key={meter.key}
              meter={meter}
              gate={gateAt}
              register={register}
            />
          ))}
          <StudioVoiceMeter register={register} />
          <StudioBalanceMeter register={register} />
          <StudioLevelMeter meter={WIDTH} register={register} />
        </div>
        <div
          className="studio-meters__spectrum"
          aria-hidden="true"
          title={t('studio.hears.spectrum')}
        >
          {Array.from({ length: SPECTRUM_BARS }, (_, index) => (
            <i
              // The bars are positions on a fixed axis, never reordered.
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              ref={(element) => {
                bars.current[index] = element;
              }}
            />
          ))}
        </div>
        {bent && (
          <span className="studio-meters__legend">
            <span
              className="studio-meters__swatch is-heard"
              aria-hidden="true"
            />
            {t('studio.meters.heard')}
            <span className="studio-meters__swatch" aria-hidden="true" />
            {t('studio.meters.got')}
          </span>
        )}
      </StudioCardGroup>
      <StudioCardGroup group="rhythm" title={t('studio.meters.rhythm')}>
        <div className="studio-meters__rows">
          <StudioBeatClock register={register} />
          {RHYTHM.map((meter) => (
            <StudioLevelMeter
              key={meter.key}
              meter={meter}
              register={register}
            />
          ))}
          <StudioDrumLamps register={register} />
          <StudioMomentumMeter register={register} />
        </div>
      </StudioCardGroup>
      <StudioCardGroup group="song" title={t('studio.meters.song')}>
        <div className="studio-meters__rows">
          {SONG.map((meter) => (
            <StudioLevelMeter
              key={meter.key}
              meter={meter}
              register={register}
            />
          ))}
        </div>
      </StudioCardGroup>
    </section>
  );
}
