/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { CONVOLUTION_SOURCES } from 'common/convolution';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import '../../styles/Convolution.scss';

/**
 * The Convolution page under the FluidEQ Engine, for the convolution chapter
 * (`helpChapters/corrections.ts`): one impulse applied, a model typed into the
 * search and three results from the catalogue, the first the one applied.
 *
 * `ConvolutionPanel`'s markup, class for class, with made-up results: the
 * real page searches the catalogue online, reads the reader's applied
 * impulse and downloads or imports one.
 */

/** The page in the column of a wide window. */
const PAGE_WIDTH = 1000;

const SOURCE = CONVOLUTION_SOURCES[0];

const RESULTS = [
  { id: 'hd650-o', name: 'Sennheiser HD 650', provider: 'oratory1990' },
  { id: 'hd650-c', name: 'Sennheiser HD 650', provider: 'crinacle' },
  { id: 'hd660s2', name: 'Sennheiser HD 660S2', provider: 'oratory1990' },
] as const;

export default function ConvolutionDrawing() {
  const { t } = useTranslation();
  const applied = `${RESULTS[0].name} (${RESULTS[0].provider})`;
  return (
    <div style={{ width: PAGE_WIDTH, padding: 12, boxSizing: 'border-box' }}>
      <section className="convolution-panel">
        <div className="convolution-panel__intro">
          <div>
            <p className="eyebrow">{t('convolution.eyebrow.fluid')}</p>
            <h2>{t('convolution.title')}</h2>
            <p>{t('convolution.intro')}</p>
            <span className="convolution-source-link">{SOURCE?.name}</span>
          </div>
          <button
            type="button"
            className="convolution-button convolution-button--quiet"
          >
            <MenuIcon name="import" className="convolution-button__icon" />
            {t('convolution.import')}
          </button>
        </div>
        <div className="convolution-applied">
          <MenuIcon name="convolution" className="convolution-applied__icon" />
          <div>
            <span className="convolution-applied__label">
              {t('convolution.applied')}
            </span>
            <strong>{applied}</strong>
          </div>
          <button
            type="button"
            className="convolution-button convolution-button--quiet"
          >
            <MenuIcon name="clear" className="convolution-button__icon" />
            {t('convolution.clear')}
          </button>
        </div>
        <div className="convolution-search">
          <span>{t('convolution.search')}</span>
          <div className="convolution-search__field">
            <svg
              className="convolution-search__glyph"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="M20 20l-4.2-4.2" />
            </svg>
            <input
              type="text"
              value="HD 65"
              readOnly
              aria-label={t('convolution.search')}
            />
          </div>
        </div>
        <div className="convolution-notice">
          {t('convolution.notice.fluid')}
        </div>
        <div className="convolution-results">
          {RESULTS.map((entry, at) => (
            <article
              className={`convolution-result${at === 0 ? ' is-applied' : ''}`}
              key={entry.id}
            >
              <div className="convolution-result__details">
                <strong>{entry.name}</strong>
                <span>
                  {t('convolution.entryDetail', {
                    provider: entry.provider,
                    rate: 48,
                  })}
                </span>
              </div>
              <span className="convolution-result__link">
                {t('convolution.source')}
              </span>
              <button
                type="button"
                className={`convolution-button${at === 0 ? ' is-applied' : ''}`}
              >
                {at === 0 ? t('convolution.isApplied') : t('convolution.apply')}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
