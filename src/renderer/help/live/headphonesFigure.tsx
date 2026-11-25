/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IMyCurve } from 'common/myCurves';
import MyCurveRow from '../../eq/MyCurveRow';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import '../../styles/AutoEQPanel.scss';

/**
 * Headphone corrections as it opens, on My curves, for the headphones
 * chapter (`helpChapters/corrections.ts`): the page's head, the My curves and
 * OPRA library tabs, the list's actions and search, and three made-up
 * curves, the first one playing.
 *
 * Each curve is the page's own `MyCurveRow`, its spark drawn from the
 * curve's text. Around them is `EqPresetsPanel`'s and `MyCurvesPanel`'s
 * markup, class for class: those read the reader's own curves and OPRA's
 * catalogue, and the actions open the reader's files.
 */

const nothing = () => undefined;

/** The page in the column of a wide window. */
const PAGE_WIDTH = 1000;

const curve = (
  id: string,
  name: string,
  source: IMyCurve['source'],
  bands: readonly (readonly [number, number, number])[],
  daysAgo: number,
): IMyCurve => ({
  id,
  name,
  source,
  ears: 'both',
  text: [
    `Preamp: ${-Math.max(...bands.map(([, gain]) => gain), 0).toFixed(1)} dB`,
    ...bands.map(
      ([hz, gain, q], at) =>
        `Filter ${at + 1}: ON PK Fc ${hz} Hz Gain ${gain} dB Q ${q}`,
    ),
  ].join('\n'),
  addedAt: Date.UTC(2026, 10, 20) - daysAgo * 86400000,
});

const CURVES: readonly IMyCurve[] = [
  curve(
    'help-curve-1',
    'HD 650 · Harman',
    'opra',
    [
      [105, 5.5, 0.7],
      [200, -1.8, 0.9],
      [1400, -2.2, 2],
      [3400, 3.5, 2.5],
      [6200, -4, 4],
      [10000, 2.5, 0.7],
    ],
    1,
  ),
  curve(
    'help-curve-2',
    'IE 200 · Squiglink',
    'squiglink',
    [
      [45, 2, 0.8],
      [600, -1.5, 1.2],
      [2500, 2.5, 1.8],
      [5500, -3, 3],
      [9000, 1.5, 2],
    ],
    6,
  ),
  curve(
    'help-curve-3',
    // A model name rather than a phrase, so the row reads the same in
    // every language the chapter is drawn in.
    'Sundara',
    'eq',
    [
      [70, -3, 1.4],
      [250, 1.5, 1],
      [4000, -1, 1.5],
      [12000, 2, 0.8],
    ],
    14,
  ),
];

export default function HeadphonesDrawing() {
  const { t, locale } = useTranslation();
  return (
    <div style={{ width: PAGE_WIDTH, padding: 12, boxSizing: 'border-box' }}>
      <section className="autoeq-panel">
        <div className="autoeq-panel__intro">
          <div>
            <p className="eyebrow">{t('autoeq.page.eyebrow')}</p>
            <h2>{t('autoeq.page.title')}</h2>
            <p>{t('autoeq.page.intro')}</p>
          </div>
          <div className="autoeq-update">
            <span>
              {t('autoeq.upToDate', { count: (4108).toLocaleString(locale) })}
            </span>
          </div>
        </div>
        <div className="autoeq-panel__libraries" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected
            className="autoeq-panel__tab"
          >
            {t('myCurves.tab.mine')}
            <span className="autoeq-panel__tab-count">{CURVES.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            className="autoeq-panel__tab"
          >
            {t('myCurves.tab.opra')}
          </button>
        </div>
        <div role="tabpanel" className="autoeq-panel__picker">
          <section className="my-curves">
            <header className="my-curves__header">
              <div>
                <h3>{t('myCurves.tab.mine')}</h3>
                <p>{t('myCurves.intro')}</p>
              </div>
              <div className="my-curves__actions">
                <div className="my-curves__pair">
                  <button type="button" className="button small subtle">
                    <MenuIcon name="download" />
                    {t('myCurves.import')}
                  </button>
                  <button type="button" className="button small subtle">
                    <MenuIcon name="upload" />
                    {t('myCurves.export')}
                  </button>
                </div>
                <div className="my-curves__pair">
                  <button type="button" className="button small subtle">
                    <MenuIcon name="graph" />
                    {t('myCurves.importSquiglink')}
                  </button>
                  <button type="button" className="button small">
                    <MenuIcon name="plus" />
                    {t('myCurves.add')}
                  </button>
                </div>
              </div>
            </header>
            <div className="my-curves__toolbar">
              <label className="my-curves__search" htmlFor="help-curves-search">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M20 20l-4.2-4.2" />
                </svg>
                <input
                  id="help-curves-search"
                  type="search"
                  placeholder={t('myCurves.search')}
                  aria-label={t('myCurves.search')}
                  readOnly
                />
              </label>
              <div className="segmented my-curves__sort" role="group">
                <button
                  type="button"
                  className="segmented__option is-selected"
                  aria-pressed
                >
                  {t('myCurves.sort.recent')}
                </button>
                <button
                  type="button"
                  className="segmented__option"
                  aria-pressed={false}
                >
                  {t('myCurves.sort.name')}
                </button>
              </div>
            </div>
            <ul className="my-curves__list">
              {CURVES.map((entry, at) => (
                <MyCurveRow
                  key={entry.id}
                  curve={entry}
                  isPlaying={at === 0}
                  isDisabled={false}
                  onApplyCurve={nothing}
                  onApplyEq={nothing}
                  onRename={nothing}
                  onDuplicate={nothing}
                  onEdit={nothing}
                  onDelete={nothing}
                />
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}
