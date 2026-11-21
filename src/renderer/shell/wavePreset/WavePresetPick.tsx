/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef } from 'react';
import {
  dspPresetRowHint,
  dspPresetStages,
  presetLayerNameOf,
} from '../../dsp/dspPresetCatalog';
import GenreNotesPreview from '../../dsp/GenreNotesPreview';
import openEqPresetTab from '../../eq/openEqPresetTab';
import PresetCurveSpark from '../../eq/ownPresets/PresetCurveSpark';
import MenuIcon from '../../icons/MenuIcon';
import VoicingIcon from '../../icons/VoicingIcon';
import { useTranslation } from '../../utils/I18nContext';
import RichPick from '../../widgets/RichPick';
import useVoicingPick, {
  isOwnPreset,
  presetGlyph,
} from '../../components/useVoicingPick';
import useCardDismissal from './useCardDismissal';
import WavePresetCard from './WavePresetCard';

/**
 * The plate while the music's sound plays: the preset's glyph and name over
 * the wave, the quick pick the player's deck has on a press, and the card on
 * pointing (Ivan, 2026-11-20: "B in the top center plus the dropdown menu
 * that opens the menu", then "ok con la tarjeta").
 *
 * The pick is `useVoicingPick`'s, the deck's own list, so a pick, a song's or
 * album's sound, Auto EQ or a preset made on the EQ page renames the plate in
 * the render that changes what plays.
 */
const WavePresetPick = () => {
  const { t } = useTranslation();
  const pick = useVoicingPick();
  const { active, activeId } = pick;
  const openRef = useRef<(() => void) | undefined>(undefined);
  const card = useCardDismissal();
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
  } else if (pick.isApo) {
    // Equalizer APO plays a preset's curve and none of its rack.
    line = t('dsp.quick.apo');
  } else if (isOwn) {
    line = t('wavePreset.yours');
  } else if (active?.group === 'genre') {
    // A genre's own line, from its notes; any other preset's would be the
    // list of its stages, which the chips under it already are.
    line = dspPresetRowHint(active, t);
  }
  const stages = active && !pick.isApo ? dspPresetStages(active, t) : [];
  const openTab = () => {
    card.dismiss();
    openEqPresetTab();
  };

  return (
    // The card's own Escape and leaving, round the plate and the card both:
    // a key or a pointer moving between the two is still on the plate.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- it hears the keys and the pointer of the plate and card inside it, which are the controls
    <div
      className="wave-preset__holder"
      onPointerLeave={card.onPointerLeave}
      onBlur={card.onBlur}
      onKeyDown={card.onKeyDown}
    >
      <RichPick
        className={`wave-preset__pick${
          card.isDismissed ? ' is-card-dismissed' : ''
        }`}
        triggerClassName={`wave-preset__plate${isNone ? ' is-none' : ''}${
          isOwn ? ' is-own' : ''
        }`}
        triggerContent={
          <>
            {glyphOf('rich-pick__glyph wave-preset__glyph')}
            <span className="rich-pick__label wave-preset__name">{name}</span>
          </>
        }
        entries={pick.entries}
        groupLabel={pick.groupLabel}
        menuClassName="dsp-chain-preset-menu"
        favourites={pick.favourites}
        activeId={activeId}
        onPick={pick.apply}
        placeholder={name}
        placeholderIcon={glyphOf('rich-pick__glyph')}
        triggerAriaLabel={
          isNone ? t('wavePreset.noneLabel') : t('wavePreset.label', { name })
        }
        // No tooltip: the card under the plate says all a tooltip would,
        // and a tooltip would stand over it.
        triggerTitle=""
        disabled={pick.isDisabled}
        openRef={openRef}
        renderPreview={(id, close) => (
          <GenreNotesPreview chainId={id} closeMenu={close} />
        )}
        renderFooter={(close) => (
          <button
            type="button"
            className="rich-pick__action"
            onClick={() => {
              close();
              openTab();
            }}
          >
            <MenuIcon name="genre" />
            <span>{t('wavePreset.openTab')}</span>
          </button>
        )}
      >
        <WavePresetCard
          glyph={glyphOf('wave-preset-card__glyph')}
          name={name}
          label={name}
          line={line}
          actions={
            <>
              <button
                type="button"
                className="button small"
                disabled={pick.isDisabled}
                onClick={() => {
                  card.dismiss();
                  openRef.current?.();
                }}
              >
                {t(isNone ? 'wavePreset.choose' : 'wavePreset.change')}
              </button>
              <button
                type="button"
                className="button small subtle"
                onClick={openTab}
              >
                {t('wavePreset.openTab')}
              </button>
            </>
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
      </RichPick>
    </div>
  );
};

export default WavePresetPick;
