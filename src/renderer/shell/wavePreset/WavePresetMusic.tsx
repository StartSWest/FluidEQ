/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  dspPresetRowHint,
  dspPresetStages,
  presetLayerNameOf,
} from '../../dsp/dspPresetCatalog';
import openEqPresetTab from '../../eq/openEqPresetTab';
import PresetCurveSpark from '../../eq/ownPresets/PresetCurveSpark';
import VoicingIcon from '../../icons/VoicingIcon';
import { useTranslation } from '../../utils/I18nContext';
import {
  isOwnPreset,
  presetGlyph,
  usePlayingPreset,
} from '../../components/useVoicingPick';
import useWaveCard from './useWaveCard';
import WavePresetCard from './WavePresetCard';

/**
 * The plate while the music's sound plays: the preset's glyph and name over
 * the wave, and on a press the card that says what it is and what it does
 * (Ivan, 2026-11-20).
 *
 * The card's one press is Change preset, which opens the EQ page on its
 * Preset tab ("not the preset list but the preset page"): the plate opens no
 * list of its own, so nothing it shows can stand between him and the
 * presets.
 *
 * The preset is read as the Preset tab reads it (`usePlayingPreset`), so a
 * pick, a song's or album's sound, Auto EQ or a preset made on the EQ page
 * renames the plate in the render that changes what plays.
 */
const WavePresetMusic = () => {
  const { t } = useTranslation();
  const { active, activeId, isApo } = usePlayingPreset();
  const card = useWaveCard();
  const isNone = activeId === 'none';
  const isOwn = isOwnPreset(active);
  // A Preset layer no list holds is named as the layers' chip names it: a
  // game's curve by its own name, a preset being made by the name it is
  // getting, a saved chain deleted while its layer plays as Custom.
  const name = isNone
    ? t('wavePreset.none')
    : (active?.name ?? presetLayerNameOf(activeId, t));
  const glyphOf = (className: string) =>
    active ? (
      presetGlyph(active, className)
    ) : (
      <VoicingIcon
        profileId={isNone ? 'none' : undefined}
        className={className}
      />
    );
  let line: string | undefined;
  if (isNone) {
    line = t('voicing.none.hint');
  } else if (isApo) {
    // Equalizer APO plays a preset's curve and none of its rack.
    line = t('dsp.quick.apo');
  } else if (isOwn) {
    line = t('wavePreset.yours');
  } else if (active?.group === 'genre') {
    // A genre's own line, from its notes; any other preset's would be the
    // list of its stages, which the chips under it already are.
    line = dspPresetRowHint(active, t);
  }
  const stages = active && !isApo ? dspPresetStages(active, t) : [];

  return (
    <div className="wave-preset__holder" ref={card.holderRef}>
      <button
        ref={card.plateRef}
        type="button"
        className={`wave-preset__plate${isNone ? ' is-none' : ''}${
          isOwn ? ' is-own' : ''
        }`}
        aria-haspopup="dialog"
        aria-expanded={card.isOpen}
        aria-label={
          isNone ? t('wavePreset.noneLabel') : t('wavePreset.label', { name })
        }
        onClick={card.toggle}
      >
        {glyphOf('wave-preset__glyph')}
        <span className="wave-preset__name">{name}</span>
      </button>

      {card.isOpen && (
        <WavePresetCard
          cardRef={card.cardRef}
          glyph={glyphOf('wave-preset-card__glyph')}
          name={name}
          label={name}
          line={line}
          actions={
            <button
              type="button"
              className="button small"
              onClick={() => {
                card.close();
                openEqPresetTab();
              }}
            >
              {t(isNone ? 'wavePreset.choose' : 'wavePreset.change')}
            </button>
          }
        >
          {active?.curve && (
            <div className={`wave-preset-card__curve${isOwn ? ' is-own' : ''}`}>
              <PresetCurveSpark curve={active.curve} size="wide" />
            </div>
          )}
          {stages.length > 0 && (
            <div className="eq-preset-tab__stages wave-preset-card__stages">
              <span className="eq-preset-tab__eyebrow">
                {t('eq.preset.rack')}
              </span>
              <ul>
                {stages.map((stage) => (
                  <li key={stage}>{stage}</li>
                ))}
              </ul>
            </div>
          )}
        </WavePresetCard>
      )}
    </div>
  );
};

export default WavePresetMusic;
