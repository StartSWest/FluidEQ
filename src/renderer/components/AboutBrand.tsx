/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AUTHOR_NAME,
  OFFICIAL_SITE_URL,
  REPOSITORY_URL,
} from 'common/branding';
import { getSupportMethods, SUPPORT_CONFIG } from 'common/support';
import fluid from '../../../assets/brand/fluid-mascot.svg';
import supportQrImage from '../../../assets/support-qr.png';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';

/**
 * Who FluidEQ is, under the About panel's name in its rail: the mascot, what
 * the app is for, who made it, the two ways to find it, and the way to
 * support it — the Buy Me a Coffee code the support window shows, the same
 * artwork, so the same scan lands on the same page (Ivan, 2026-11-04: "add
 * the support QR for buy me a coffee as we got already in the other
 * modal"). The coffee is the rail's one loud button; the website and the
 * source are the quiet ones beside each other.
 */
export default function AboutBrand() {
  const { t } = useTranslation();
  const hasCoffee = getSupportMethods().includes('coffee');
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
          className="button small subtle"
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
      {hasCoffee && (
        <section
          className="about-support"
          aria-labelledby="about-support-title"
        >
          <h3 id="about-support-title" className="about-support__title">
            <MenuIcon name="support" />
            {t('support.pet.title')}
          </h3>
          <div className="about-support__code">
            {/* The branded code from Buy Me a Coffee, shipped rather than
                generated, as the support window's: pinned to the page it was
                made for, so a new FLUIDEQ_COFFEE_URL means a new file too. */}
            <img
              className="qr-code"
              src={supportQrImage}
              alt={t('support.qr.coffee')}
              width={168}
              height={168}
            />
          </div>
          <p className="about-support__hint">{t('support.coffee.hint')}</p>
          <a
            className="button small about-support__action"
            href={SUPPORT_CONFIG.coffeeUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('support.coffee')}
            <MenuIcon name="external" />
          </a>
        </section>
      )}
    </div>
  );
}
