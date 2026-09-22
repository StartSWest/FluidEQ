/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, type CSSProperties } from 'react';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import type { TranslationKey } from '../../../common/i18n';
import {
  NONE_CHAIN_ID,
  dspPresetHint,
  dspPresetName,
} from '../../dsp/dspPresetCatalog';
import MenuIcon from '../../icons/MenuIcon';
import VoicingIcon from '../../icons/VoicingIcon';
import { useTranslation } from '../../utils/I18nContext';
import playerDark from '../../../../assets/tour/player-dark.png';
import playerLight from '../../../../assets/tour/player-light.png';
import sceneAurora from '../../../../assets/tour/scene-aurora.jpg';

/**
 * The pictures on the 1.8 headline slides.
 *
 * The Compact player is shown as it is: two real captures of it, one in each
 * of its themes. The rest are the app's own pages in miniature, drawn with
 * the app's own words in the reader's language and its real catalogue — the
 * preset names and the stages a chain switches on come from the presets
 * themselves, so the picture changes when they do. Each is composed to be
 * about as tall as it is wide, the shape the slide gives it beside the text.
 */

const presetById = (id: string) =>
  DSP_PRESETS.find((preset) => preset.id === id);

/** The Compact player, in its Dark theme and its Light one. */
export function PlayerVisual() {
  const { t } = useTranslation();
  const players: { src: string; theme: TranslationKey }[] = [
    { src: playerDark, theme: 'theme.black' },
    { src: playerLight, theme: 'theme.ocean' },
  ];
  return (
    <div
      className="player-visual"
      role="img"
      aria-label={t('tour.player.imageAlt')}
    >
      {players.map((player) => (
        <span key={player.theme} className="player-visual__player">
          <img className="player-visual__shot" src={player.src} alt="" />
          <span className="player-visual__theme">{t(player.theme)}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * The games the picture lists. Real games, because the feature is about the
 * games people have; tiles in their colours rather than their logos.
 */
const GAMES: {
  name: string;
  initials: string;
  source: TranslationKey;
  preset?: string;
  colours: [string, string];
  inFront?: boolean;
}[] = [
  {
    name: 'Counter-Strike 2',
    initials: 'CS',
    source: 'games.source.steam',
    preset: 'gaming-competitive',
    colours: ['#f5a53a', '#b24d1c'],
    inFront: true,
  },
  {
    name: 'Cyberpunk 2077',
    initials: 'CP',
    source: 'games.source.gog',
    preset: 'movie',
    colours: ['#f3e53c', '#1bb3a6'],
  },
  {
    name: 'Forza Horizon 5',
    initials: 'FH',
    source: 'games.source.xbox',
    preset: 'gaming',
    colours: ['#ff6190', '#ff9b3c'],
  },
  {
    name: 'World of Warcraft',
    initials: 'WW',
    source: 'games.source.battlenet',
    colours: ['#7383ff', '#2a2e8c'],
  },
];

/** The Game presets page, and the two cards a game raises on the desktop. */
export function GamesVisual() {
  const { t } = useTranslation();
  const name = (id: string) => {
    const preset = presetById(id);
    return preset ? dspPresetName(preset, t) : id;
  };
  const [front, , closed] = GAMES;
  return (
    <div
      className="games-visual"
      role="img"
      aria-label={t('tour.games.imageAlt')}
    >
      <div className="games-visual__page">
        <div className="games-visual__head">
          <VoicingIcon profileId="gaming" className="games-visual__glyph" />
          <strong>{t('tabs.games')}</strong>
          <span className="games-visual__add">
            <MenuIcon name="plus" />
            {t('games.add')}
          </span>
        </div>
        <ul className="games-visual__rows">
          {GAMES.map((game) => (
            <li
              key={game.name}
              className={game.inFront ? 'is-front' : undefined}
              style={
                {
                  '--game-from': game.colours[0],
                  '--game-to': game.colours[1],
                } as CSSProperties
              }
            >
              <span className="games-visual__tile">{game.initials}</span>
              <span className="games-visual__game">
                <strong>{game.name}</strong>
                <span>
                  <span className="games-visual__source">{t(game.source)}</span>
                  {game.inFront && (
                    <span className="games-visual__live">
                      {t('games.row.inFront')} · {t('games.row.sounding')}
                    </span>
                  )}
                </span>
              </span>
              <span
                className={`games-visual__sound${
                  game.preset ? '' : ' is-none'
                }`}
              >
                {game.preset ? name(game.preset) : t('games.preset.none')}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="games-visual__desk">
        <span className="games-visual__card is-behind">
          <VoicingIcon profileId="music" className="games-visual__card-glyph" />
          <span>
            <strong>
              {t('games.toast.restored', { preset: name('pop') })}
            </strong>
            <small>{t('games.toast.afterGame', { game: closed.name })}</small>
          </span>
        </span>
        <span className="games-visual__card">
          <VoicingIcon
            profileId="gaming-competitive"
            className="games-visual__card-glyph"
          />
          <span>
            <strong>
              {t('games.toast.loaded', {
                preset: name(front.preset ?? 'gaming'),
              })}
            </strong>
            <small>{t('games.toast.forGame', { game: front.name })}</small>
          </span>
          <span className="games-visual__mode">
            {t('dsp.latency.gameMode')}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * The picker filed as both pages file it: None on its own above everything,
 * then the chains the listener starred, the classics and the genres, under
 * the equaliser's own headings.
 */
const PICKER: { group?: TranslationKey; ids: string[] }[] = [
  { ids: [NONE_CHAIN_ID] },
  { group: 'dsp.favorites.title', ids: ['rock', 'gaming'] },
  { group: 'dsp.quick.classics', ids: ['music', 'music-room', 'movie'] },
  { group: 'voicing.groupGenre', ids: ['metal', 'pop', 'hiphop', 'jazz'] },
];
const CHOSEN = 'rock';
/** Three chains whose levels the picture sets side by side: the same. */
const LEVELLED = ['empty', 'rock', 'lofi'];

/** The presets picker with Rock chosen, and what a chain is now. */
export function PresetsVisual() {
  const { t } = useTranslation();
  const chosen = presetById(CHOSEN);
  // The picker's own line under a chain: its stages, joined with a middle
  // dot that is the same in every language.
  const stages = chosen ? dspPresetHint(chosen, t).split(' · ') : [];
  return (
    <div
      className="presets-visual"
      role="img"
      aria-label={t('tour.presets.imageAlt')}
    >
      <div className="presets-visual__picker">
        <span className="presets-visual__search">
          <MenuIcon name="configure" />
          {t('dsp.presets')}
        </span>
        {PICKER.map((section) => (
          <div
            key={section.group ?? NONE_CHAIN_ID}
            className="presets-visual__section"
          >
            {section.group && (
              <span className="presets-visual__group">{t(section.group)}</span>
            )}
            <ul>
              {section.ids.map((id) => {
                const preset = presetById(id);
                if (!preset) {
                  return null;
                }
                // None is the equaliser's own row: its word and its plain
                // glyph, never a star.
                const isNone = id === NONE_CHAIN_ID;
                return (
                  <li
                    key={id}
                    className={id === CHOSEN ? 'is-chosen' : undefined}
                  >
                    <VoicingIcon
                      profileId={isNone ? undefined : id}
                      className="presets-visual__icon"
                    />
                    <span>
                      {isNone ? t('voicing.none') : dspPresetName(preset, t)}
                    </span>
                    {/* The real list shows a row's star under the pointer
                        only; the chosen row is drawn as if pointed at. */}
                    {id === CHOSEN && (
                      <MenuIcon name="star" className="presets-visual__star" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="presets-visual__cards">
        <div className="presets-visual__card">
          <span className="presets-visual__name">
            {chosen ? dspPresetName(chosen, t) : ''}
          </span>
          <span className="presets-visual__note">
            {t('tour.presets.chain')}
          </span>
          <ul className="presets-visual__stages">
            {stages.map((stage) => (
              <li key={stage}>{stage}</li>
            ))}
          </ul>
        </div>
        <div className="presets-visual__card">
          <span className="presets-visual__name is-small">
            {t('tour.presets.level')}
          </span>
          <ul className="presets-visual__levels">
            {LEVELLED.map((id) => {
              const preset = presetById(id);
              return (
                <li key={id}>
                  <span>{preset ? dspPresetName(preset, t) : id}</span>
                  <i />
                </li>
              );
            })}
          </ul>
          <span className="presets-visual__note">
            {t('tour.presets.levelNote')}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Where the three thirds sit on the graph, in its 0..1 width. */
const THIRDS: { key: TranslationKey; from: number; to: number }[] = [
  { key: 'eq.tone.bass', from: 0, to: 0.3 },
  { key: 'eq.tone.mid', from: 0.3, to: 0.7 },
  { key: 'eq.tone.treble', from: 0.7, to: 1 },
];

const KNOBS: { key: TranslationKey; db: number }[] = [
  { key: 'eq.tone.bass', db: 4.5 },
  { key: 'eq.tone.mid', db: 0 },
  { key: 'eq.tone.treble', db: 3 },
];

const LAYOUTS = [6, 10, 15, 20, 31];
const NEW_LAYOUT = 20;

/**
 * The curve the three knobs make: Bass up by its dial, the middle flat,
 * Treble up by its dial, the joins as smooth as shelves are. Points on a
 * 0..100 box, gain up.
 */
const toneCurve = (() => {
  const points: string[] = [];
  for (let step = 0; step <= 60; step += 1) {
    const x = step / 60;
    const bass = 4.5 / (1 + Math.exp((x - 0.28) * 22));
    const treble = 3 / (1 + Math.exp(-(x - 0.74) * 22));
    const y = 50 - (bass + treble) * 6;
    points.push(`${(x * 100).toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(' ');
})();

/** A dial's angle for a gain, on the same ±12 dB the tone dials turn over. */
const dialAngle = (db: number) => (db / 12) * 135;

/** A point on a dial's ring, `degrees` clockwise from straight up. */
const onRing = (degrees: number, radius: number) => {
  const radians = (degrees * Math.PI) / 180;
  return `${(20 + radius * Math.sin(radians)).toFixed(2)} ${(
    20 -
    radius * Math.cos(radians)
  ).toFixed(2)}`;
};

/** The ring's arc between two angles, drawn clockwise. */
const ringArc = (from: number, to: number, radius: number) => {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const large = end - start > 180 ? 1 : 0;
  return `M ${onRing(start, radius)} A ${radius} ${radius} 0 ${large} 1 ${onRing(end, radius)}`;
};

/** The curve in its three thirds, the three knobs, the quick layouts. */
export function ToneVisual() {
  const { t } = useTranslation();
  // The fill under the curve fades to nothing, and SVG gradients are found
  // by id across the whole document.
  const fade = useId();
  return (
    <div
      className="tone-visual"
      role="img"
      aria-label={t('tour.tone.imageAlt')}
    >
      <div className="tone-visual__graph">
        {THIRDS.map((third) => (
          <span
            key={third.key}
            className="tone-visual__third"
            style={{
              left: `${third.from * 100}%`,
              width: `${(third.to - third.from) * 100}%`,
            }}
          >
            {t(third.key)}
          </span>
        ))}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
              <stop className="tone-visual__fade-top" offset="0" />
              <stop className="tone-visual__fade-bottom" offset="1" />
            </linearGradient>
          </defs>
          <line className="tone-visual__zero" x1="0" y1="50" x2="100" y2="50" />
          <polyline
            className="tone-visual__fill"
            points={`0,100 ${toneCurve} 100,100`}
            fill={`url(#${fade})`}
          />
          <polyline className="tone-visual__curve" points={toneCurve} />
        </svg>
      </div>

      <div className="tone-visual__controls">
        <ul className="tone-visual__knobs">
          {KNOBS.map((knob) => (
            <li key={knob.key}>
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <path
                  className="tone-visual__track"
                  d={ringArc(-135, 135, 16)}
                />
                {knob.db !== 0 && (
                  <path
                    className="tone-visual__value"
                    d={ringArc(0, dialAngle(knob.db), 16)}
                  />
                )}
                <circle className="tone-visual__cap" cx="20" cy="20" r="11" />
                <line
                  className="tone-visual__needle"
                  x1="20"
                  y1="17"
                  x2="20"
                  y2="11"
                  transform={`rotate(${dialAngle(knob.db)} 20 20)`}
                />
              </svg>
              <strong>{t(knob.key)}</strong>
              <span>{`${knob.db > 0 ? '+' : ''}${knob.db.toFixed(1)} dB`}</span>
            </li>
          ))}
        </ul>
        <div className="tone-visual__layouts">
          <span className="tone-visual__caption">{t('eq.quickLayouts')}</span>
          <ul>
            {LAYOUTS.map((count) => (
              <li
                key={count}
                className={count === NEW_LAYOUT ? 'is-new' : undefined}
              >
                {t('eq.bandCount', { count })}
                {count === NEW_LAYOUT && <em>{t('tour.newBadge')}</em>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** A scene made in the Studio, the idea it came from, and the two ways in. */
export function StudioVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="studio-visual"
      role="img"
      aria-label={t('tour.studio.imageAlt')}
    >
      <img className="studio-visual__scene" src={sceneAurora} alt="" />
      <span className="studio-visual__prompt">
        <span className="studio-visual__label">
          <MenuIcon name="smart" />
          {t('studio.maker.describe')}
        </span>
        <span className="studio-visual__idea">{t('tour.studio.idea')}</span>
      </span>
      <span className="studio-visual__offers">
        <span className="studio-visual__offer">{t('trial.offer.title')}</span>
        <span className="studio-visual__offer is-earned">
          {t('tour.studio.earned')}
        </span>
      </span>
    </div>
  );
}

export { default as GuideVisual } from './GuideVisual';
