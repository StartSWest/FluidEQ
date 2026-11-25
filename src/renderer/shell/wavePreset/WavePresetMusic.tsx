/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import {
  dspPresetRowHint,
  dspPresetStages,
  presetLayerNameOf,
} from '../../dsp/dspPresetCatalog';
import PresetCardCurve from '../../eq/presetCard/PresetCardCurve';
import usePresetCurveDesign from '../../eq/presetCard/usePresetCurveDesign';
import Chevron from '../../icons/Chevron';
import VoicingIcon from '../../icons/VoicingIcon';
import { useTranslation } from '../../utils/I18nContext';
import {
  isOwnPreset,
  presetGlyph,
  usePlayingPreset,
} from '../../components/useVoicingPick';
import runsOnMac from '../../utils/platform';
import presetMenuKeyDown from './presetMenuKeys';
import usePresetBrowse from './usePresetBrowse';
import useWaveMenu from './useWaveMenu';
import WavePresetBrowse from './WavePresetBrowse';
import WavePresetPanel from './WavePresetPanel';

/**
 * The plate while the music's sound plays: the preset's glyph and name over
 * the wave with the mockup's chevron, and on a press the panel — what plays,
 * None, the favourites and the Preset tab (Ivan, 2026-11-20), with a field
 * that searches every preset and a star on every row (2026-11-25).
 *
 * The preset is read as the Preset tab reads it (`usePlayingPreset`), so a
 * pick, a song's or album's sound, Auto EQ or a preset made on the EQ page
 * renames the plate in the render that changes what plays.
 */
const WavePresetMusic = () => {
  const { t } = useTranslation();
  const playing = usePlayingPreset();
  const { active, activeId, isApo } = playing;
  const menu = useWaveMenu();
  const browse = usePresetBrowse(menu.isOpen, menu.close, playing);
  // The curve drawn as the Preset tab's cards draw it, with the EQ's own
  // model, Q and Treble design (`presetCardDrawing.ts`).
  const curveDesign = usePresetCurveDesign();
  // Where the panel hangs from (`.wave-preset__anchor`): state, so the panel
  // places itself once the element is there.
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
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
    <div className="wave-preset__holder" ref={menu.holderRef}>
      <button
        ref={menu.plateRef}
        type="button"
        className={`wave-preset__plate${isNone ? ' is-none' : ''}${
          isOwn ? ' is-own' : ''
        }`}
        aria-haspopup="menu"
        aria-expanded={menu.isOpen}
        aria-label={
          isNone ? t('wavePreset.noneLabel') : t('wavePreset.label', { name })
        }
        onClick={menu.toggle}
      >
        {glyphOf('wave-preset__glyph')}
        <span className="wave-preset__name">{name}</span>
        <Chevron className="wave-preset__caret" />
      </button>
      <span ref={setAnchor} className="wave-preset__anchor" aria-hidden />

      <WavePresetPanel
        anchor={anchor}
        isOpen={menu.isOpen}
        arrive={menu.arrive}
        close={menu.close}
        onKeyDown={presetMenuKeyDown(browse, runsOnMac())}
        header={
          <>
            <div className="wave-preset-head">
              {glyphOf('wave-preset-head__glyph')}
              <strong className="wave-preset-head__name">{name}</strong>
              {line && <span className="wave-preset-head__line">{line}</span>}
            </div>
            {active?.curve && (
              <div className="wave-preset-head__curve">
                <PresetCardCurve
                  curve={active.curve}
                  design={curveDesign}
                  tone={isOwn ? 'own' : 'playing'}
                />
              </div>
            )}
            {stages.length > 0 && (
              <div
                className="eq-preset-tab__stages wave-preset-head__stages"
                role="group"
                aria-label={t('eq.preset.rack')}
              >
                <ul>
                  {stages.map((stage) => (
                    <li key={stage}>{stage}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        }
      >
        <WavePresetBrowse browse={browse} />
      </WavePresetPanel>
    </div>
  );
};

export default WavePresetMusic;
