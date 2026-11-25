/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { FIXED_BAND_SIZES } from 'common/constants';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import '../../styles/BandLayoutMenu.scss';

/**
 * The band layouts menu, open, as `BandLayoutMenu` draws it: the built-in
 * counts with ten picked, Reset bands, one made-up saved design and Save as
 * new. Its markup, class for class: the real menu loads the reader's own
 * saved designs and applies a press to their bands.
 */

/** Where the menu stands in the window: its own width, held in flow. */
const MENU_WIDTH = 320;

export default function BandDesignsDrawing() {
  const { t } = useTranslation();
  const saved = t('help.eqmode.sampleDesign');
  return (
    <div style={{ width: MENU_WIDTH + 16, padding: 8 }}>
      <div
        className="band-designs__menu"
        role="dialog"
        style={{ position: 'relative', inset: 'auto', width: MENU_WIDTH }}
      >
        <div className="band-designs__content">
          <h3>{t('eq.layouts.builtIn')}</h3>
          <div className="band-designs__grid">
            {FIXED_BAND_SIZES.map((size) => (
              <button
                type="button"
                key={size}
                className={`button small${size === 10 ? '' : ' subtle'}`}
                aria-pressed={size === 10}
              >
                {t('eq.bandCount', { count: size })}
              </button>
            ))}
          </div>
          <p className="band-designs__hint">{t('eq.layouts.qHint')}</p>
          <button type="button" className="button small subtle">
            <MenuIcon name="reset" className="eq-toolbar__icon" />
            {t('eq.layouts.resetBands')}
          </button>
          <h3>{t('eq.layouts.saved')}</h3>
          <p className="band-designs__hint">{t('eq.layouts.empty')}</p>
          <div className="band-designs__saved">
            <div className="band-designs__entry">
              <button
                type="button"
                className="button small band-designs__row subtle"
                aria-pressed={false}
              >
                <MenuIcon name="layout" className="eq-toolbar__icon" />
                <span>
                  {saved}
                  <small>{t('eq.bandCount', { count: 12 })}</small>
                </span>
              </button>
              <button
                type="button"
                className="button small subtle band-designs__delete"
                aria-label={t('eq.layouts.deleteNamed', { name: saved })}
              >
                <MenuIcon name="trash" className="eq-toolbar__icon" />
              </button>
            </div>
          </div>
          <div className="band-designs__actions">
            <button type="button" className="button small">
              <MenuIcon name="plus" className="eq-toolbar__icon" />
              {t('eq.layouts.saveNew')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
