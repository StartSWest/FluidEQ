/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ReactNode, useRef } from 'react';
import '../../styles/EqLayers.scss';
import '../../styles/EqAutoPanel.scss';
import EqModeTriggerFace from '../eqMode/EqModeTriggerFace';
import useToolRowFit from '../../eq/useToolRowFit';
import Chevron from '../../icons/Chevron';
import MenuIcon from '../../icons/MenuIcon';
import VoicingIcon from '../../icons/VoicingIcon';
import PlayerIcon from '../../player/PlayerIcon';
import { LAYER_SWATCH } from '../../styles/color';
import { useTranslation } from '../../utils/I18nContext';
import { PICTURE_BANDS } from './playerPictureData';

/**
 * The amp's sound rows as a picture (`PlayerSound`, `PlayerToolRow`): the
 * same markup in the same classes, holding the picture's fixed bands and
 * touching no state, so Help and What's New show the rows the amp has.
 */

/** The head: Your EQ and the Tone, the preset, the power, the fold. */
export const PictureSoundHead = ({ face }: { face: 'tone' | 'bands' }) => {
  const { t } = useTranslation();
  const tab = (
    which: 'tone' | 'bands',
    icon: 'eqBars' | 'waveform',
    word: string,
    meta: string,
  ) => (
    <button
      type="button"
      role="tab"
      className="eq-layer-tabs__tab"
      aria-selected={face === which}
    >
      <MenuIcon name={icon} className="eq-toolbar__icon" />
      <span className="eq-layer-tabs__word">{word}</span>
      <span className="eq-layer-tabs__meta">{meta}</span>
    </button>
  );
  return (
    <div className="player-eq__keys player-sound__head">
      <button
        type="button"
        className="player-sound__power"
        aria-pressed
        aria-label={t('sidebar.systemEq')}
      >
        <PlayerIcon name="power" />
      </button>
      <div className="eq-layer-tabs__list player-sound__tabs" role="tablist">
        {tab(
          'bands',
          'eqBars',
          t('eq.tabs.bands'),
          String(PICTURE_BANDS.length),
        )}
        {tab('tone', 'waveform', t('eq.tone'), t('eq.tabs.toneOn'))}
      </div>
      <div className="rich-pick voicing-pick">
        <button
          type="button"
          className="rich-pick__trigger"
          aria-label={t('dsp.presets')}
        >
          <VoicingIcon className="rich-pick__glyph" />
          <span className="rich-pick__label">{t('dsp.eqPreset.custom')}</span>
          <Chevron className="rich-pick__caret" />
        </button>
      </div>
      <button
        type="button"
        className="player-shelf__key player-sound__fold"
        aria-expanded
        aria-label={t('player.sound.fold')}
      >
        <PlayerIcon name="fold" className="player-icon player-sound__chevron" />
      </button>
    </div>
  );
};

/** Auto EQ, as the page's button draws it while every part is off. */
const PictureAutoEq = () => {
  const { t } = useTranslation();
  return (
    <span className="eq-mode eq-auto is-subtle">
      <button
        type="button"
        className="button small subtle eq-mode__main"
        aria-label={t('autoEq.aria')}
      >
        <MenuIcon name="smart" className="eq-toolbar__icon" />
        <span className="eq-auto__name">{t('autoEq.title')}</span>
        <Chevron />
      </button>
    </span>
  );
};

/**
 * The bottom row as the amp draws it, fitted the amp's own way
 * (`useToolRowFit`): a fit written in by hand was one level short of the
 * amp's in English once the saved EQ's name joined the row, and three in
 * French, whose Auto EQ ran off the picture's end.
 */
const PictureToolRow = ({ children }: { children: ReactNode }) => {
  const row = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  useToolRowFit(row, slot, tools);
  return (
    <div className="eq-layer-tabs player-sound__tools" ref={row}>
      <div className="eq-layer-tabs__slot" ref={slot}>
        <div className="eq-layer-tabs__tools" ref={tools}>
          {children}
        </div>
      </div>
    </div>
  );
};

const group = (caption: string, children: ReactNode) => (
  <div className="eq-tool-group" role="group" aria-label={caption}>
    <span className="eq-tool-group__caption" aria-hidden="true">
      {caption}
    </span>
    <div className="eq-tool-group__tools">{children}</div>
  </div>
);

/** Your EQ's tools: BANDS, then VIEW, then Auto EQ. */
export const PictureBandsTools = () => {
  const { t } = useTranslation();
  return (
    <PictureToolRow>
      {group(
        t('eq.tools.bands'),
        <>
          <span className="eq-mode is-subtle quick-layouts">
            <button
              type="button"
              className="button small subtle eq-mode__main quick-layouts__trigger"
              aria-label={t('eq.quickLayouts')}
            >
              <MenuIcon name="layout" className="eq-toolbar__icon" />
              <span className="band-designs__current">
                {PICTURE_BANDS.length}
              </span>
              <Chevron />
            </button>
          </span>
          <button
            type="button"
            className="button small subtle eq-toolbar__add"
            aria-label={t('eq.addBandAria')}
          >
            <MenuIcon name="plus" className="eq-toolbar__icon" />
            <span className="eq-toolbar__word">{t('eq.tools.add')}</span>
          </button>
          <button
            type="button"
            className="button small subtle clear-eq-trigger"
          >
            <MenuIcon name="reset" className="eq-toolbar__icon" />
            <span className="eq-toolbar__word">{t('eq.tools.clear')}</span>
          </button>
          <button
            type="button"
            className="button small subtle eq-load-trigger"
            aria-label={t('eq.tools.loadEq')}
          >
            <MenuIcon name="openEq" className="eq-toolbar__icon" />
            <span className="eq-toolbar__word eq-load-trigger__name">
              {t('autoEq.eqs.title')}
            </span>
            <Chevron />
          </button>
          <button
            type="button"
            className="button small subtle eq-save-trigger"
            aria-label={t('eq.tools.saveEq')}
          >
            <span className="eq-save-trigger__glyph">
              <MenuIcon name="saveEq" className="eq-toolbar__icon" />
            </span>
          </button>
        </>,
      )}
      <span className="eq-layer-tabs__rule" aria-hidden="true" />
      {group(
        t('eq.tools.view'),
        <>
          <span className="eq-mode is-subtle active-layers__picker">
            <button
              type="button"
              className="button small subtle eq-mode__main active-layers__trigger"
              aria-label={t('graph.curves')}
            >
              <span className="active-layers__dots" aria-hidden>
                <i style={{ color: LAYER_SWATCH.eq }} />
                <i style={{ color: LAYER_SWATCH.tone }} />
              </span>
              <span className="eq-toolbar__word">{t('graph.curves')}</span>
              <Chevron />
            </button>
          </span>
          <div className="eq-toolbar__option">
            <button
              type="button"
              className="eq-mode-trigger"
              aria-label={t('eq.mode')}
            >
              <EqModeTriggerFace customized={false} end={<Chevron />} />
            </button>
          </div>
        </>,
      )}
      <PictureAutoEq />
    </PictureToolRow>
  );
};

/** The Tone's tools: Reset Tone, then Auto EQ. */
export const PictureToneTools = () => {
  const { t } = useTranslation();
  return (
    <PictureToolRow>
      <button type="button" className="button small subtle">
        <MenuIcon name="reset" className="eq-toolbar__icon" />
        <span className="eq-toolbar__word">{t('eq.tone.reset')}</span>
      </button>
      <PictureAutoEq />
    </PictureToolRow>
  );
};
