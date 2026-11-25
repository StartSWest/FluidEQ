/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A microphone's own effects (mockup A, Ivan's pick 2026-11-24): the
 * processing its maker registers on it — THX on a Razer Kraken's mic,
 * Realtek's on a laptop's array — listed by name, and one switch that takes
 * them off so only the FluidEQ Engine processes the voice, or puts them back
 * exactly as they were ("kill any processing that mics may bring and only
 * use fluid engine ... this needs to work for all").
 *
 * The switch is a Windows prompt and a moment of audio restarting each way
 * (`own_effects.h` in the setup helper), so it says so before the press and
 * what is happening during it, in a line that holds its place.
 */

import {
  FLUID_ENGINE_CLSID,
  type IFluidEngineMicrophone,
  type IMicEffect,
  type TMicEffectKind,
} from '../../common/audioEngine';
import type { TranslationKey } from '../../common/i18n';
import { ProcessorCard } from '../dsp/DspControls';
import { useTranslation } from '../utils/I18nContext';

export type TOwnEffectsPress = 'idle' | 'working' | 'declined' | 'failed';

const PRESS_WORDS: Record<TOwnEffectsPress, TranslationKey> = {
  idle: 'mic.own.prompt',
  working: 'mic.own.working',
  declined: 'mic.own.declined',
  failed: 'mic.own.failed',
};

const isEngine = (effect: IMicEffect) =>
  effect.clsid.toUpperCase() === FLUID_ENGINE_CLSID;

/** The mic's own effects as they stand: running, taken off, or none. */
export const micOwnEffects = (
  mic: IFluidEngineMicrophone,
): { on: boolean; effects: IMicEffect[]; known: boolean } => {
  if (mic.runs === undefined) {
    return { on: false, effects: [], known: false };
  }
  if (mic.ownEffectsOff) {
    return { on: false, effects: mic.ownEffectsTaken ?? [], known: true };
  }
  const effects = mic.runs.filter((effect) => !isEngine(effect));
  return { on: effects.length > 0, effects, known: true };
};

const KIND_WORDS: Record<TMicEffectKind, TranslationKey> = {
  stream: 'mic.own.kind.stream',
  mode: 'mic.own.kind.mode',
  endpoint: 'mic.own.kind.endpoint',
};

/**
 * One effect, with everything Windows has on record for it (Ivan,
 * 2026-11-25: "display the name and everything from Windows"): its name and
 * whether it is part of Windows, its maker and where it runs, what else
 * Windows calls it, and its file and class id. Only a class Windows truly
 * has no name for reads "Unnamed effect", and its class id still says which.
 */
const MicOwnEffect = ({
  effect,
  off,
}: {
  effect: IMicEffect;
  off: boolean;
}) => {
  const { t } = useTranslation();
  const facts = [
    effect.maker ?? t('mic.own.makerUnknown'),
    ...(effect.kind ? [t(KIND_WORDS[effect.kind])] : []),
  ];
  const file =
    effect.file && effect.version
      ? t('mic.own.fileVersion', { file: effect.file, version: effect.version })
      : effect.file;
  return (
    <li className="mic-own__effect">
      <span className="mic-own__name">
        {effect.name || t('mic.own.unnamed')}
      </span>
      {effect.windows && (
        <span className="mic-own__windows">{t('mic.own.windows')}</span>
      )}
      <span className="mic-own__state">
        {off ? t('mic.own.stateOff') : t('mic.own.stateOn')}
      </span>
      <span className="mic-own__facts">{facts.join(' · ')}</span>
      {effect.description && (
        <span className="mic-own__description">{effect.description}</span>
      )}
      {file && <span className="mic-own__file">{file}</span>}
      <span className="mic-own__id">{effect.clsid}</span>
    </li>
  );
};

interface IMicOwnEffectsCardProps {
  mic: IFluidEngineMicrophone;
  press: TOwnEffectsPress;
  onSwitch: (on: boolean) => void;
}

const MicOwnEffectsCard = ({
  mic,
  press,
  onSwitch,
}: IMicOwnEffectsCardProps) => {
  const { t } = useTranslation();
  const { on, effects, known } = micOwnEffects(mic);
  const off = mic.ownEffectsOff === true;
  const none = known && effects.length === 0;
  return (
    <ProcessorCard
      id="mic-own"
      titleKey="mic.own.title"
      descriptionKey="mic.own.description"
      isEnabled={on}
      onToggle={() => {
        if (press !== 'working' && known && !none) {
          onSwitch(!on);
        }
      }}
    >
      <div className="dsp-band mic-own__band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">
            {off ? t('mic.own.group.taken') : t('mic.own.group.brings')}
          </span>
        </div>
        {none && <p className="dsp-band-hint">{t('mic.own.none')}</p>}
        {!known && <p className="dsp-band-hint">{t('mic.own.unknown')}</p>}
        {effects.length > 0 && (
          <ul className={`mic-own__list${off ? ' is-off' : ''}`}>
            {effects.map((effect) => (
              <MicOwnEffect key={effect.clsid} effect={effect} off={off} />
            ))}
          </ul>
        )}
        {effects.length > 0 && (
          <p className="dsp-band-hint mic-own__source">{t('mic.own.source')}</p>
        )}
      </div>
      <div className="dsp-band mic-own__band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('mic.own.group.how')}</span>
        </div>
        <p className="dsp-band-hint">{t('mic.own.how')}</p>
        {/* One line, always there: what the press needs, then what it is
            doing, so the card never grows or shrinks around it. */}
        <p
          className={`mic-own__press is-${press}`}
          role="status"
          aria-live="polite"
        >
          {t(PRESS_WORDS[press])}
        </p>
      </div>
    </ProcessorCard>
  );
};

export default MicOwnEffectsCard;
