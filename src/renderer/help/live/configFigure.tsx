/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IApoConfigFile } from 'common/apoConfig';
import { apoFeatureFileWord, type TApoFeature } from 'common/constants';
import { ConfigFileNode } from '../../components/ConfigFileNode';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import { HELP_EQ_FILTERS } from './helpEqState';
import '../../styles/ConfigInspector.scss';

/**
 * The Config page under the FluidEQ Engine, for the config and trouble
 * chapters (`helpChapters/sound.ts`, `listen.ts`): the engine applying the
 * config, two outputs with the headphones playing, and the headphones'
 * chain as a tree — the device file, its EQ and Tone files and the custom
 * file — with the chain's export and import.
 *
 * The tree's rows are the page's own `ConfigFileNode`, handed a made-up
 * chain written the way `deviceProfiles` names and writes its files; around
 * them is `ConfigInspector`'s markup, class for class, because the page
 * reads the reader's config from disk and writes it back.
 */

/** The page in the column of a wide window. */
const PAGE_WIDTH = 1000;

/** A device slug as `deviceProfiles` makes one: twelve hex digits. */
const SLUG = '3f9a61c04e2b';

/** The file names `deviceProfiles` writes, assembled as it assembles them. */
const PREFIX = 'fluideq';
const featureFile = (feature: TApoFeature) =>
  `${PREFIX}-${SLUG}-${apoFeatureFileWord(feature)}.txt`;

const BAND_LINES = Object.values(HELP_EQ_FILTERS)
  .sort((a, b) => a.frequency - b.frequency)
  .map(
    (band, at) =>
      `Filter ${at + 1}: ON PK Fc ${band.frequency} Hz Gain ${band.gain.toFixed(1)} dB Q ${band.quality.toFixed(2)}`,
  );

const CHAIN: IApoConfigFile = {
  fileName: `${PREFIX}-device-${SLUG}.txt`,
  lines: ['Preamp: -3.5 dB'],
  includes: [
    { fileName: featureFile('eq'), lines: BAND_LINES, includes: [] },
    {
      fileName: featureFile('tone'),
      lines: [
        'Filter 1: ON LSC Fc 100 Hz Gain 1.5 dB Q 0.71',
        'Filter 2: ON HSC Fc 10000 Hz Gain 1.0 dB Q 0.71',
      ],
      includes: [],
    },
    {
      fileName: `${PREFIX}-${SLUG}-custom.txt`,
      lines: [],
      includes: [],
    },
  ],
};

const nothing = () => undefined;

export default function ConfigDrawing() {
  const { t } = useTranslation();
  const headphones = t('help.profiles.sampleHeadset');
  const speakers = t('help.profiles.sampleSpeakers');
  return (
    <div style={{ width: PAGE_WIDTH, padding: 12, boxSizing: 'border-box' }}>
      <section className="config-inspector">
        <div className="config-inspector__bar">
          <div className="config-inspector__title">
            <span className="eyebrow">{t('config.eyebrow')}</span>
            <h2>{t('config.title.fluid')}</h2>
            <p className="config-inspector__lede">{t('config.lede')}</p>
          </div>
          <button
            type="button"
            className="button small subtle config-inspector__reload"
          >
            <MenuIcon name="restart" />
            <span>{t('config.reload')}</span>
          </button>
        </div>
        <p className="config-status config-status--on">
          {t('config.status.active.fluid')}
        </p>
        <div className="config-inspector__cards" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected
            className="config-card is-selected is-current"
          >
            <span className="config-card__name">{headphones}</span>
            <span className="config-card__profile">
              {t('help.profiles.sampleMusic')}
            </span>
            <span className="config-card__facts">
              {t('config.filters.many', { count: 12 })}
            </span>
            <span className="config-card__badge">{t('config.playingNow')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            className="config-card"
          >
            <span className="config-card__name">{speakers}</span>
            <span className="config-card__facts">
              {t('config.filters.many', { count: 10 })}
            </span>
          </button>
        </div>
        <section className="config-device">
          <header className="config-device__head">
            <h4>{headphones}</h4>
            <code className="config-device__pattern">
              {'{0.0.0.00000000}.{a17c4e2d-6b1f-4f0e-9d2a-3c58e1b7f640}'}
            </code>
          </header>
          <div className="config-device__facts">
            <span>{t('config.filters.many', { count: 12 })}</span>
            <span>-3.5 dB</span>
          </div>
          <div className="config-device__transfer">
            <span className="config-device__transfer-note">
              {t('config.import.hint')}
            </span>
            <div className="config-device__transfer-actions">
              <button type="button" className="config-device__export">
                <svg viewBox="0 0 16 16" aria-hidden>
                  <path d="M8 10V2.5M5.2 5.3L8 2.5l2.8 2.8" />
                  <path d="M2.5 9.8v3.7h11V9.8" />
                </svg>
                {t('config.export')}
              </button>
              <button type="button" className="config-device__import">
                <svg viewBox="0 0 16 16" aria-hidden>
                  <path d="M8 2.5V10M5.2 7.2L8 10l2.8-2.8" />
                  <path d="M2.5 9.8v3.7h11V9.8" />
                </svg>
                {t('config.import')}
              </button>
            </div>
          </div>
          <ul className="config-device__tree">
            <ConfigFileNode
              file={CHAIN}
              subject={headphones}
              isLive={false}
              onSaved={nothing}
            />
          </ul>
        </section>
      </section>
    </div>
  );
}
