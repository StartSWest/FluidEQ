/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import BrandMark from '../../icons/BrandMark';
import { PRODUCT_NAME } from '../../../common/branding';
import { useTranslation } from '../../utils/I18nContext';

/** The curve the card plays: a gentle bass lift and a little air. */
const CURVE = 'M0 22 C 10 10, 22 9, 34 15 S 58 22, 72 18 S 92 10, 100 12';

/**
 * Windows' notification area at sign-in: the taskbar's corner with its own
 * icons and the clock, FluidEQ's icon lit among them, and above it the card
 * a hover brings up, its curve already playing. No window anywhere: that is
 * the point of the slide. Drawn, not captured: a capture of the real taskbar
 * would carry somebody's own icons and clock.
 */
export default function TrayVisual() {
  const { t } = useTranslation();
  return (
    <div className="tour-tray" role="img" aria-label={t('tour.tray.imageAlt')}>
      <div className="tour-tray__desktop">
        <div className="tour-tray__card">
          <div className="tour-tray__card-head">
            <BrandMark className="tour-tray__card-mark" />
            <strong>{PRODUCT_NAME}</strong>
            <span className="tour-tray__card-on" />
          </div>
          <span className="tour-tray__card-line">{t('tour.tray.card')}</span>
          <svg
            className="tour-tray__card-curve"
            viewBox="0 0 100 30"
            preserveAspectRatio="none"
          >
            <path
              className="tour-tray__card-fill"
              d={`${CURVE} L100 30 L0 30 Z`}
            />
            <path className="tour-tray__card-stroke" d={CURVE} />
          </svg>
        </div>
      </div>
      <div className="tour-tray__taskbar">
        <span className="tour-tray__chevron">
          <svg viewBox="0 0 16 16">
            <path d="m4 10 4-4 4 4" />
          </svg>
        </span>
        <span className="tour-tray__icon">
          <svg viewBox="0 0 16 16">
            <path d="M2 6.5a9 9 0 0 1 12 0M4.2 9a6 6 0 0 1 7.6 0M6.4 11.4a3 3 0 0 1 3.2 0" />
          </svg>
        </span>
        <span className="tour-tray__icon">
          <svg viewBox="0 0 16 16">
            <path d="M2.5 6v4h2.5l3.5 3V3L5 6zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.6a6 6 0 0 1 0 8.8" />
          </svg>
        </span>
        <span className="tour-tray__icon tour-tray__icon--fluid">
          <BrandMark className="tour-tray__mark" />
        </span>
        <span className="tour-tray__clock">
          <span>9:41</span>
          <small>29/10/2026</small>
        </span>
      </div>
    </div>
  );
}
