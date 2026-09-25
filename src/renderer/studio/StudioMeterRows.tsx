import { useEffect, useRef } from 'react';
import type { TranslationKey } from 'common/i18n';
import { RUN_MAX_TURNS } from 'common/spectrumEnergy';
import { VOICE_HIGH_HZ, VOICE_LOW_HZ } from 'common/voiceReading';
import type { ISceneFrame } from '../graph/sceneGl';
import { useTranslation } from '../utils/I18nContext';
import writeLiveText from '../utils/liveText';
import LiveFigure from '../components/LiveFigure';

/**
 * The rows of "What it hears now" (`StudioMeters.tsx`), each drawing itself
 * after every frame the stage draws.
 *
 * Nothing here goes through React state: a row that re-rendered sixty times
 * a second would cost more than the scene it describes. React draws each row
 * once; the row hands the card a drawing, and the drawing moves transforms
 * and opacities, which are composited, and the text of readouts that are
 * laid out on their own (`LiveFigure.tsx`) — never the page around them.
 */

/** A row's drawing: the frame the scene got, the music as played, the accent. */
export type TMeterDraw = (
  frame: ISceneFrame,
  heard: ISceneFrame,
  accent: number,
) => void;

/** How a row hands its drawing to the card, and takes it back. */
export type TMeterRegister = (
  key: string,
  draw: TMeterDraw | undefined,
) => void;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** The row's drawing, handed to the card while the row is on the page. */
const useMeterDraw = (
  key: string,
  register: TMeterRegister,
  draw: TMeterDraw,
) => {
  useEffect(() => {
    register(key, draw);
    return () => register(key, undefined);
  }, [key, register, draw]);
};

/** What a plain meter shows. Kept as module constants, so each is one function. */
export interface ILevelMeter {
  key: string;
  label: TranslationKey;
  hint: TranslationKey;
  /** What the scene gets, 0..1. */
  value: (frame: ISceneFrame, accent: number) => number;
  /** The music as played, drawn faintly under it while a response bends one into the other. */
  heard?: (frame: ISceneFrame) => number;
  /** The readout, when it is not the value itself. */
  text?: (frame: ISceneFrame) => string;
  /** The readout at its widest, when it is not the value's `0.00`. */
  widest?: string;
}

/** A value from 0 to 1, as its readout writes it: every one is this wide. */
const VALUE_WIDEST = ['0.00'];

interface IStudioLevelMeterProps {
  meter: ILevelMeter;
  /** Where the response's gate cuts in, on this meter's scale. */
  gate?: number;
  register: TMeterRegister;
}

/** A bar from 0 to 1 with its reading beside it. */
export function StudioLevelMeter({
  meter,
  gate,
  register,
}: IStudioLevelMeterProps) {
  const { t } = useTranslation();
  const fill = useRef<HTMLSpanElement>(null);
  const ghost = useRef<HTMLSpanElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const draw = useRef<TMeterDraw>((frame, heard, accent) => {
    const shown = clamp01(meter.value(frame, accent));
    if (fill.current) {
      fill.current.style.transform = `scaleX(${shown})`;
    }
    if (ghost.current && meter.heard) {
      ghost.current.style.transform = `scaleX(${clamp01(meter.heard(heard))})`;
    }
    writeLiveText(
      readout.current,
      meter.text ? meter.text(frame) : shown.toFixed(2),
    );
  }).current;
  useMeterDraw(meter.key, register, draw);
  return (
    <div
      className={`studio-meter studio-meter--${meter.key}`}
      role="presentation"
      title={t(meter.hint)}
    >
      <span className="studio-meter__label">{t(meter.label)}</span>
      <span className="studio-meter__track">
        {meter.heard && <span className="studio-meter__heard" ref={ghost} />}
        <span className="studio-meter__fill" ref={fill} />
        {gate !== undefined && (
          <span
            className="studio-meter__gate"
            style={{ left: `${gate * 100}%` }}
          />
        )}
      </span>
      <LiveFigure
        className="studio-meter__value"
        widest={meter.widest ? [meter.widest] : VALUE_WIDEST}
        textRef={readout}
      >
        0.00
      </LiveFigure>
    </div>
  );
}

/** A lean either way, as the balance's readout writes it. */
const BALANCE_WIDEST = ['-0.00'];

/** Where the music leans: a bar growing left or right from the middle. */
export function StudioBalanceMeter({ register }: { register: TMeterRegister }) {
  const { t } = useTranslation();
  const left = useRef<HTMLSpanElement>(null);
  const right = useRef<HTMLSpanElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const draw = useRef<TMeterDraw>((frame) => {
    const lean = Math.max(-1, Math.min(1, frame.stereo?.[0] ?? 0));
    if (left.current) {
      left.current.style.transform = `scaleX(${Math.max(0, -lean)})`;
    }
    if (right.current) {
      right.current.style.transform = `scaleX(${Math.max(0, lean)})`;
    }
    // Rounded before it is signed, so a lean too small to show never reads
    // as a minus zero flickering against a zero.
    const rounded = Math.round(lean * 100) / 100;
    writeLiveText(readout.current, rounded === 0 ? '0.00' : rounded.toFixed(2));
  }).current;
  useMeterDraw('balance', register, draw);
  return (
    <div
      className="studio-meter studio-meter--balance"
      role="presentation"
      title={t('studio.hears.balance')}
    >
      <span className="studio-meter__label">{t('studio.meter.balance')}</span>
      <span className="studio-meter__track studio-meter__track--centred">
        <span className="studio-meter__half is-left" ref={left} />
        <span className="studio-meter__half is-right" ref={right} />
      </span>
      <LiveFigure
        className="studio-meter__value"
        widest={BALANCE_WIDEST}
        textRef={readout}
      >
        0.00
      </LiveFigure>
    </div>
  );
}

/**
 * The note `uVoice.y` stands for, named the way the language names notes:
 * `names` are the twelve from C, space-separated, as the locale writes them.
 */
const noteName = (pitch: number, names: readonly string[]) => {
  const hz = VOICE_LOW_HZ * (VOICE_HIGH_HZ / VOICE_LOW_HZ) ** pitch;
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  return `${names[((midi % 12) + 12) % 12] ?? ''}${Math.floor(midi / 12) - 1}`;
};

/** How sure the voice has to be before its note is named. */
const NAMED_FROM = 0.5;

/**
 * The singer: how open a mouth singing along would be, as a bar, and the note
 * sung, named - the whole row faint while nobody is singing.
 */
export function StudioVoiceMeter({ register }: { register: TMeterRegister }) {
  const { t } = useTranslation();
  const row = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const names = t('studio.meter.voiceNotes').split(' ');
  const namesRef = useRef(names);
  namesRef.current = names;
  const draw = useRef<TMeterDraw>((frame) => {
    const [open, pitch, sure] = frame.voice ?? [0, 0, 0];
    if (fill.current) {
      fill.current.style.transform = `scaleX(${clamp01(open)})`;
    }
    if (row.current) {
      row.current.style.opacity = `${0.45 + 0.55 * clamp01(sure)}`;
    }
    writeLiveText(
      readout.current,
      sure >= NAMED_FROM ? noteName(pitch, namesRef.current) : '–',
    );
  }).current;
  useMeterDraw('voice', register, draw);
  return (
    <div
      className="studio-meter studio-meter--voice"
      role="presentation"
      title={t('studio.hears.voice')}
      ref={row}
    >
      <span className="studio-meter__label">{t('studio.meter.voice')}</span>
      <span className="studio-meter__track">
        <span className="studio-meter__fill" ref={fill} />
      </span>
      <LiveFigure
        className="studio-meter__value"
        // Each note with its octave, which is one figure from 80 Hz to 1 kHz.
        widest={names.map((name) => `${name}0`)}
        textRef={readout}
      >
        –
      </LiveFigure>
    </div>
  );
}

/** A tempo, as the clock's readout writes it. */
const TEMPO_WIDEST = ['000'];

/** Beats in a bar, as the music's clock counts them. */
const BEATS = [0, 1, 2, 3] as const;

/**
 * The music's clock: the bar's four beats, the one it is in lit, a playhead
 * gliding across the bar, and the tempo it counts. The whole of it dims as
 * the clock grows unsure, which is when a scene's dance fades too.
 */
export function StudioBeatClock({ register }: { register: TMeterRegister }) {
  const { t } = useTranslation();
  const bar = useRef<HTMLSpanElement>(null);
  const head = useRef<HTMLSpanElement>(null);
  const cells = useRef<Array<HTMLElement | null>>([]);
  const readout = useRef<HTMLSpanElement>(null);
  const lit = useRef(-1);
  const draw = useRef<TMeterDraw>((frame) => {
    const { rhythm } = frame;
    const barPhase = rhythm ? clamp01(rhythm.barPhase) : 0;
    const now =
      rhythm && rhythm.tempo > 0 ? Math.min(3, Math.floor(barPhase * 4)) : -1;
    if (now !== lit.current) {
      cells.current[lit.current]?.classList.remove('is-now');
      cells.current[now]?.classList.add('is-now');
      lit.current = now;
    }
    if (head.current) {
      head.current.style.transform = `translateX(${barPhase * 100}%)`;
    }
    if (bar.current) {
      bar.current.style.opacity = `${0.35 + 0.65 * clamp01(rhythm?.confidence ?? 0)}`;
    }
    writeLiveText(
      readout.current,
      rhythm && rhythm.tempo > 0 ? String(Math.round(rhythm.tempo)) : '–',
    );
  }).current;
  useMeterDraw('clock', register, draw);
  return (
    <div
      className="studio-meter studio-meter--clock"
      role="presentation"
      title={t('studio.hears.tempo')}
    >
      <span className="studio-meter__label">{t('studio.meter.tempo')}</span>
      <span className="studio-clock" ref={bar}>
        {BEATS.map((beat) => (
          <i
            key={beat}
            className="studio-clock__beat"
            ref={(element) => {
              cells.current[beat] = element;
            }}
          />
        ))}
        <span className="studio-clock__head" ref={head} />
      </span>
      <LiveFigure
        className="studio-meter__value"
        widest={TEMPO_WIDEST}
        textRef={readout}
      >
        –
      </LiveFigure>
    </div>
  );
}

/** The three drums the music's clock hears apart, in the order a kit is read. */
const DRUMS = [
  { key: 'kick', label: 'studio.meter.kick', hint: 'studio.hears.kick' },
  { key: 'snare', label: 'studio.meter.snare', hint: 'studio.hears.snare' },
  { key: 'hat', label: 'studio.meter.hats', hint: 'studio.hears.hats' },
] as const;

/** Each drum as a lamp that lights on its hit and dies away with it. */
export function StudioDrumLamps({ register }: { register: TMeterRegister }) {
  const { t } = useTranslation();
  const lights = useRef<
    Partial<Record<(typeof DRUMS)[number]['key'], HTMLElement | null>>
  >({});
  const draw = useRef<TMeterDraw>((frame) => {
    DRUMS.forEach(({ key }) => {
      const light = lights.current[key];
      if (light) {
        light.style.opacity = `${clamp01(frame.rhythm?.[key] ?? 0)}`;
      }
    });
  }).current;
  useMeterDraw('drums', register, draw);
  return (
    <div className="studio-drums" role="presentation">
      {DRUMS.map(({ key, label, hint }) => (
        <span
          key={key}
          className={`studio-drum studio-drum--${key}`}
          title={t(hint)}
        >
          <span className="studio-drum__lamp" aria-hidden="true">
            <span
              className="studio-drum__light"
              ref={(element) => {
                lights.current[key] = element;
              }}
            />
          </span>
          <span className="studio-drum__name">{t(label)}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * The flywheel the music winds: its speed as a bar, and a dial turning with
 * it, so a scene carried along by it can be seen to be.
 */
export function StudioMomentumMeter({
  register,
}: {
  register: TMeterRegister;
}) {
  const { t } = useTranslation();
  const fill = useRef<HTMLSpanElement>(null);
  const hand = useRef<HTMLSpanElement>(null);
  const draw = useRef<TMeterDraw>((frame) => {
    const [turn, speed] = frame.musicRun;
    if (fill.current) {
      fill.current.style.transform = `scaleX(${clamp01(speed / RUN_MAX_TURNS)})`;
    }
    if (hand.current) {
      hand.current.style.transform = `rotate(${turn}turn)`;
    }
  }).current;
  useMeterDraw('momentum', register, draw);
  return (
    <div
      className="studio-meter studio-meter--momentum"
      role="presentation"
      title={t('studio.hears.momentum')}
    >
      <span className="studio-meter__label">{t('studio.meter.momentum')}</span>
      <span className="studio-meter__track">
        <span className="studio-meter__fill" ref={fill} />
      </span>
      <span className="studio-meter__dial" aria-hidden="true">
        <span className="studio-meter__hand" ref={hand} />
      </span>
    </div>
  );
}
