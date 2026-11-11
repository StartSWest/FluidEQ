/* FluidEQ — GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import { SITE_DOWNLOAD_URL } from 'common/branding';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import CompactFrame from './CompactFrame';
import '../styles/UpdateNotice.scss';

interface IOnSiteUpdateNoticeProps {
  version: string;
  onClose: () => void;
}

/**
 * The free edition's news of a new version (Ivan, 2026-11-11): from 2.5 it
 * does not update itself, so it says the version is on the site. Download is
 * the answer it asks for; the Signed Edition, which does update itself, is
 * the quiet one beside it.
 *
 * The price is the server's wording and is asked for when the notice shows.
 * Without an answer the offer is made with no price rather than a guessed
 * one: it is a launch price and changes without a release.
 */
export default function OnSiteUpdateNotice({
  version,
  onClose,
}: IOnSiteUpdateNoticeProps) {
  const { t } = useTranslation();
  const [price, setPrice] = useState<string>();

  useEffect(() => {
    let current = true;
    window.electron?.ipcRenderer
      ?.signedEditionStatus?.()
      .then((status) => {
        if (current) {
          setPrice(status.price);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  return (
    <CompactFrame
      className="update-notice"
      icon={<MenuIcon name="download" />}
      title={t('update.onSite.title')}
      titleId="update-notice-title"
      role="status"
      aria-modal={undefined}
      onClose={onClose}
      closeLabel={t('app.dismiss')}
      actions={
        <>
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              window.electron?.ipcRenderer
                ?.signedEditionBuy?.()
                .catch(() => undefined);
            }}
          >
            {price
              ? t('update.onSite.getAuto', { price })
              : t('update.onSite.getAutoNoPrice')}
          </button>
          <a
            className="button small"
            href={SITE_DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t('update.onSite.download')}
          </a>
        </>
      }
    >
      <p>{t('update.onSite.body', { version })}</p>
    </CompactFrame>
  );
}
