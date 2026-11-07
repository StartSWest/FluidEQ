/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import '../styles/SponsorLink.scss';

/** Uses the same default-browser route as the existing support links. */
export default function SponsorLink() {
  const { t } = useTranslation();
  return (
    <a
      className="button small subtle support-sponsor"
      href="https://github.com/sponsors/StartSWest"
      target="_blank"
      rel="noreferrer noopener"
    >
      <MenuIcon name="support" className="support-sponsor__heart" />
      <span>{t('support.github')}</span>
      <MenuIcon name="external" />
    </a>
  );
}
