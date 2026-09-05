/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AUTHOR_NAME,
  OFFICIAL_SITE_URL,
  PRODUCT_NAME,
  PRODUCT_VERSION,
  REPOSITORY_URL,
} from 'common/branding';
import fluid from '../../../assets/brand/fluid-mascot.svg';
import { useTranslation } from '../utils/I18nContext';
import BrandMark from '../icons/BrandMark';

export default function AboutBrand() {
  const { t } = useTranslation();
  return (
    <section className="about-brand" aria-label={PRODUCT_NAME}>
      <div className="about-brand__portrait">
        <div className="about-brand__orbit" aria-hidden="true" />
        <img src={fluid} width="240" height="240" alt={t('about.mascot')} />
        <span className="about-brand__pet-name">Fluid</span>
      </div>
      <div className="about-brand__identity">
        <div className="about-brand__wordmark">
          <BrandMark />
          <h2>{PRODUCT_NAME}</h2>
          {PRODUCT_VERSION && (
            <span className="dialog-header__version">v{PRODUCT_VERSION}</span>
          )}
        </div>
        <p className="about-brand__tagline">{t('app.tagline')}</p>
        <p className="about-brand__description">{t('about.description')}</p>
        <p className="about-brand__author">
          {t('about.author', { author: AUTHOR_NAME })}
        </p>
        <div className="about-brand__links">
          <a
            className="button small"
            href={OFFICIAL_SITE_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t('about.website')}
          </a>
          <a
            className="button small subtle"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t('about.source')}
          </a>
        </div>
      </div>
    </section>
  );
}
