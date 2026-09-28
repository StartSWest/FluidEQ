/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AUTHOR_NAME,
  OFFICIAL_SITE_URL,
  REPOSITORY_URL,
} from 'common/branding';
import fluid from '../../../assets/brand/fluid-mascot.svg';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';

/**
 * Who FluidEQ is, under the About panel's name in its rail: the mascot, what
 * the app is for, who made it and the two ways to find it. The name and the
 * version are the rail's own heading; this is what follows them.
 */
export default function AboutBrand() {
  const { t } = useTranslation();
  return (
    <div className="about-brand">
      <div className="about-brand__portrait">
        <img src={fluid} width="240" height="240" alt={t('about.mascot')} />
      </div>
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
          <MenuIcon name="language" />
          {t('about.website')}
        </a>
        <a
          className="button small subtle"
          href={REPOSITORY_URL}
          target="_blank"
          rel="noreferrer"
        >
          <MenuIcon name="external" />
          {t('about.source')}
        </a>
      </div>
    </div>
  );
}
