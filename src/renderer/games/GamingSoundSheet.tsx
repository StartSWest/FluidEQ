/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import {
  environmentDb,
  FOOTSTEPS_MAX_CALM_DB,
  FOOTSTEPS_MAX_LIFT_DB,
  VOICES_MAX_LIFT_DB,
} from '../../common/dsp/footsteps';
import { gameCurveOfVoicing } from '../../common/dsp/gameCurves';
import type { IGameCopySound } from '../../common/gaming';
import type { TranslationKey } from '../../common/i18n/en';
import { hasTone } from '../../common/tone';
import { presetLayerNameOf } from '../dsp/dspPresetCatalog';
import { dspStageIsOn } from '../dsp/dspStageSwitch';
import type { TDspSection } from '../dsp/sections';
import { useTranslation } from '../utils/I18nContext';
import GamingProfileCurve from './GamingProfileCurve';
import rackStageProfileKey from './gamingStageProfile';
import { GAMING_STAGES, TGamingStage } from './gamingStages';

/**
 * Where 20 Hz, 100 Hz, 1 kHz and 10 kHz stand on the curve's 20 Hz-20 kHz
 * axis. The first stands at the left edge, from it rather than centred on it.
 */
const CURVE_TICKS: readonly { label: string; at: number }[] = [
  { label: '20 Hz', at: 0 },
  { label: '100 Hz', at: Math.log10(5) / 3 },
  { label: '1 kHz', at: Math.log10(50) / 3 },
  { label: '10 kHz', at: Math.log10(500) / 3 },
];

/** What the Environment dial does to the bed, said in words. */
const environmentKey = (bedDb: number): TranslationKey => {
  if (bedDb < 0) {
    return 'gaming.sheet.environmentDown';
  }
  return bedDb > 0
    ? 'gaming.sheet.environmentUp'
    : 'gaming.sheet.environmentAsMixed';
};

const RACK_STAGES = GAMING_STAGES.filter((stage) => stage.group === 'dsp');

interface ISectionProps {
  title: string;
  /** The rack's chain beside the heading, for the DSP part. */
  aside?: string;
  part: TGamingStage;
  isChosen: boolean;
  className: string;
  tuneHint: string;
  onTune: (part: TGamingStage) => void;
  isBusy: boolean;
  children: ReactNode;
}

/**
 * One part of the sound: its name over one hairline, and Tune, which puts
 * the game's sound on and opens that part. The part chosen in the rail
 * wears the accent on its line, so the rail reads as this page's index.
 */
const Section = ({
  title,
  aside,
  part,
  isChosen,
  className,
  tuneHint,
  onTune,
  isBusy,
  children,
}: ISectionProps) => {
  const { t } = useTranslation();
  return (
    <section
      className={`gaming-sheet__part ${className}${isChosen ? ' is-chosen' : ''}`}
      aria-label={title}
    >
      <header className="gaming-sheet__head">
        <h3 className="gaming-sheet__name">{title}</h3>
        {aside && <span className="gaming-sheet__aside">{aside}</span>}
        <button
          type="button"
          className="button plain small gaming-sheet__tune"
          title={tuneHint}
          disabled={isBusy}
          onClick={() => onTune(part)}
        >
          {t('gaming.sheet.tune')}
        </button>
      </header>
      {children}
    </section>
  );
};

interface IReadingProps {
  label: string;
  value: string;
  /** A value that says nothing is done, drawn quieter than one that does. */
  isQuiet: boolean;
  more: string;
}

const Reading = ({ label, value, isQuiet, more }: IReadingProps) => (
  <div className="gaming-sheet__reading">
    <span className="gaming-sheet__label">{label}</span>
    <span className={`gaming-sheet__value${isQuiet ? ' is-quiet' : ''}`}>
      {value}
    </span>
    <span className="gaming-sheet__more">{more}</span>
  </div>
);

interface IGamingSoundSheetProps {
  gameName: string;
  sound: IGameCopySound;
  /** The part chosen in the rail. */
  stage: TGamingStage;
  onTune: (part: TGamingStage) => void;
  isBusy: boolean;
}

/**
 * Everything a game's sound does, read from its copy, on the page while that
 * sound is off (Ivan, 2026-11-19: "is too empty"): the Game filter's reach,
 * Your EQ and the Tone, the curve drawn, and which stages of the rack play.
 * Nothing here is tuned blind: every part's Tune puts the sound on first.
 * Every number is the sound's own, in the units its editor shows.
 */
const GamingSoundSheet = ({
  gameName,
  sound,
  stage,
  onTune,
  isBusy,
}: IGamingSoundSheetProps) => {
  const { t, locale } = useTranslation();
  const dbFormat = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
  // A narrow no-break space, so the unit never wraps from its number.
  const db = (value: number) =>
    `${dbFormat.format(value)}${String.fromCodePoint(0x202f)}${t('gaming.sheet.dbUnit')}`;
  const list = new Intl.ListFormat(locale, {
    style: 'long',
    type: 'conjunction',
  });
  const { dsp } = sound;
  const steps = dsp.footsteps;
  const hintFor = (nameKey: TranslationKey) =>
    t('gaming.sheet.tuneHint', { game: gameName, part: t(nameKey) });
  const isRackStage = !['footsteps', 'mainEq', 'curve'].includes(stage);

  const lift = steps.lift * FOOTSTEPS_MAX_LIFT_DB;
  const voices = steps.voices * VOICES_MAX_LIFT_DB;
  const bed = environmentDb(steps.environment);
  const extras = [
    ...(steps.calm > 0
      ? [t('gaming.sheet.calm', { db: db(steps.calm * FOOTSTEPS_MAX_CALM_DB) })]
      : []),
    ...(steps.heavy ? [t('dsp.game.heavy')] : []),
    ...(steps.duck ? [t('dsp.game.duck')] : []),
  ];

  const curve = sound.curveId ? gameCurveOfVoicing(sound.curveId) : undefined;
  const curveName = sound.curveId
    ? presetLayerNameOf(sound.curveId, t)
    : t('gaming.profiles.noCurve');

  const playing = RACK_STAGES.filter(({ id }) =>
    dspStageIsOn(id as TDspSection, dsp),
  );
  const resting = RACK_STAGES.filter(
    ({ id }) => !dspStageIsOn(id as TDspSection, dsp),
  );
  const chainName = dsp.presetId ? presetLayerNameOf(dsp.presetId, t) : '';

  return (
    <div className="gaming-sheet__parts">
      <Section
        title={t('gaming.stage.footsteps')}
        part="footsteps"
        isChosen={stage === 'footsteps'}
        className="gaming-sheet__part--filter"
        tuneHint={hintFor('gaming.stage.footsteps')}
        onTune={onTune}
        isBusy={isBusy}
      >
        {steps.enabled ? (
          <>
            <div className="gaming-sheet__readings">
              <Reading
                label={t('dsp.game.footsteps')}
                value={lift > 0 ? db(lift) : t('gaming.sheet.off')}
                isQuiet={lift <= 0}
                more={t(
                  lift > 0
                    ? 'gaming.sheet.footstepsOn'
                    : 'gaming.sheet.footstepsOff',
                )}
              />
              <Reading
                label={t('dsp.game.dialogue')}
                value={voices > 0 ? db(voices) : t('gaming.sheet.off')}
                isQuiet={voices <= 0}
                more={t(
                  voices > 0
                    ? 'gaming.sheet.dialogueOn'
                    : 'gaming.sheet.dialogueOff',
                )}
              />
              <Reading
                label={t('dsp.game.environment')}
                value={bed === 0 ? t('gaming.sheet.asMixed') : db(bed)}
                isQuiet={bed === 0}
                more={t(environmentKey(bed))}
              />
            </div>
            {extras.length > 0 && (
              <p className="gaming-sheet__facts">
                {t('gaming.sheet.alsoOn', { parts: extras.join(' · ') })}
              </p>
            )}
          </>
        ) : (
          <p className="gaming-sheet__facts">{t('gaming.sheet.filterOff')}</p>
        )}
      </Section>

      <Section
        title={t('gaming.stage.mainEq')}
        part="mainEq"
        isChosen={stage === 'mainEq'}
        className="gaming-sheet__part--eq"
        tuneHint={hintFor('gaming.stage.mainEq')}
        onTune={onTune}
        isBusy={isBusy}
      >
        <div className="gaming-sheet__readings">
          <Reading
            label={t('gaming.sheet.bands')}
            value={
              sound.bands > 0
                ? new Intl.NumberFormat(locale).format(sound.bands)
                : t('gaming.sheet.none')
            }
            isQuiet={sound.bands === 0}
            more={t(
              sound.bands > 0
                ? 'gaming.sheet.bandsSome'
                : 'gaming.sheet.bandsNone',
            )}
          />
          <Reading
            label={t('eq.tone')}
            value={t(
              hasTone(sound.tone) ? 'gaming.sheet.toneOn' : 'gaming.sheet.flat',
            )}
            isQuiet={!hasTone(sound.tone)}
            more={
              hasTone(sound.tone)
                ? t('gaming.sheet.toneSet', {
                    bass: db(sound.tone.bass),
                    mid: db(sound.tone.mid),
                    treble: db(sound.tone.treble),
                  })
                : t('gaming.sheet.toneFlat')
            }
          />
        </div>
      </Section>

      <Section
        title={t('gaming.stage.curve')}
        part="curve"
        isChosen={stage === 'curve'}
        className="gaming-sheet__part--curve"
        tuneHint={hintFor('gaming.stage.curve')}
        onTune={onTune}
        isBusy={isBusy}
      >
        <p className="gaming-sheet__curve-name">{curveName}</p>
        {/* A Preset layer that is not a game curve has no bands here to
            draw, and a flat line would say it plays nothing. */}
        {(curve || !sound.curveId) && (
          <div className="gaming-sheet__plot">
            <GamingProfileCurve
              gains={curve?.gains ?? []}
              className="gaming-sheet__curve"
            />
            <span className="gaming-sheet__zero" aria-hidden="true">
              {db(0)}
            </span>
            <div className="gaming-sheet__axis" aria-hidden="true">
              {CURVE_TICKS.map(({ label, at }) => (
                <span key={label} style={{ insetInlineStart: `${at * 100}%` }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
        {sound.hasCorrection && (
          <p className="gaming-sheet__facts">{t('gaming.sheet.correction')}</p>
        )}
      </Section>

      <Section
        title={t('gaming.rail.dsp')}
        aside={chainName}
        part={isRackStage ? stage : (playing[0]?.id ?? 'normalizer')}
        isChosen={isRackStage}
        className="gaming-sheet__part--rack"
        tuneHint={t('gaming.sheet.tuneRackHint', { game: gameName })}
        onTune={onTune}
        isBusy={isBusy}
      >
        {playing.length > 0 ? (
          <ul className="gaming-sheet__stages">
            {playing.map(({ id, labelKey }) => {
              const profileKey = rackStageProfileKey(id as TDspSection, dsp);
              return (
                <li key={id} className="gaming-sheet__stage-row">
                  <button
                    type="button"
                    className={`button plain small gaming-sheet__stage${
                      id === stage ? ' is-chosen' : ''
                    }`}
                    title={hintFor(labelKey)}
                    disabled={isBusy}
                    onClick={() => onTune(id)}
                  >
                    <span className="gaming-sheet__lamp" aria-hidden="true" />
                    {t(labelKey)}
                  </button>
                  {profileKey && (
                    <span className="gaming-sheet__stage-profile">
                      {t(profileKey)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="gaming-sheet__facts">{t('gaming.sheet.rackOff')}</p>
        )}
        {(resting.length > 0 || dsp.gameMode) && (
          <p className="gaming-sheet__facts">
            {[
              ...(dsp.gameMode ? [t('gaming.sheet.gameMode')] : []),
              ...(resting.length > 0 && playing.length > 0
                ? [
                    t('gaming.sheet.restOff', {
                      stages: list.format(resting.map((s) => t(s.labelKey))),
                    }),
                  ]
                : []),
            ].join(' · ')}
          </p>
        )}
      </Section>
    </div>
  );
};

export default GamingSoundSheet;
