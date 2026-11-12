/* FluidEQ — GPL-3.0-or-later */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AUTHOR_NAME, PRODUCT_VERSION } from 'common/branding';
import CompactFrame from '../components/CompactFrame';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { useSignedEdition } from './useSignedEdition';
import '../styles/Edition.scss';

/** Kept on this computer: the notice is told once, not once per account. */
const TOLD_KEY = 'fluideq.updatesChanging.told';

const wasTold = (): boolean => {
  try {
    return window.localStorage.getItem(TOLD_KEY) !== null;
  } catch {
    // Storage that cannot be read: said again rather than never.
    return false;
  }
};

const rememberTold = (version: string) => {
  try {
    window.localStorage.setItem(TOLD_KEY, version);
  } catch {
    // Nothing to keep it in; it is told again next launch.
  }
};

/**
 * 2.5 is the last version that reaches the free edition by itself. The
 * notice only that version carries: a later free copy was downloaded by
 * somebody who already knows where new versions are.
 */
const carriesTheNews = (version: string) => version.startsWith('2.5.');

interface IUpdatesChangingNoticeProps {
  /** This build's version; a test says which. */
  version?: string;
}

/**
 * The free edition's one-time word about updates (Ivan, 2026-11-11; session
 * 22's frame 5b): from here on new versions are on the site, FluidEQ stays
 * free, and the Signed Edition is the one that keeps updating itself. "Got
 * it" is the answer it asks for; the edition is the quiet one. Told once per
 * computer, whichever way it is put away.
 *
 * The publisher named is the one on the signed copy's certificate, which is
 * the developer's own name. The price is the server's wording; with none,
 * the sentence is said without a price.
 */
export default function UpdatesChangingNotice({
  version = PRODUCT_VERSION,
}: IUpdatesChangingNoticeProps) {
  const { t } = useTranslation();
  const status = useSignedEdition();
  const [told, setTold] = useState(wasTold);
  const gotItRef = useRef<HTMLButtonElement>(null);
  const showing =
    carriesTheNews(version) &&
    !told &&
    status !== undefined &&
    !status.signedCopy;

  const close = () => {
    rememberTold(version);
    setTold(true);
  };

  useEffect(() => {
    if (!showing) {
      return undefined;
    }
    gotItRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        rememberTold(version);
        setTold(true);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [showing, version]);

  if (!showing) {
    return null;
  }
  const price = status?.price;
  return createPortal(
    <div className="edition-changing-backdrop" role="presentation">
      <CompactFrame
        className="edition-changing"
        icon={<MenuIcon name="download" />}
        title={t('edition.changing.title')}
        titleId="edition-changing-title"
        aria-describedby="edition-changing-detail"
        actions={
          <>
            <button
              type="button"
              className="button small subtle"
              onClick={() => {
                window.electron?.ipcRenderer
                  ?.signedEditionBuy?.()
                  .catch(() => undefined);
                close();
              }}
            >
              {price
                ? t('edition.changing.see', { price })
                : t('edition.changing.seeNoPrice')}
            </button>
            <button
              ref={gotItRef}
              type="button"
              className="button small"
              onClick={close}
            >
              {t('edition.changing.gotIt')}
            </button>
          </>
        }
      >
        <div id="edition-changing-detail">
          <p>{t('edition.changing.free')}</p>
          <p>
            {price
              ? t('edition.changing.signed', { price, publisher: AUTHOR_NAME })
              : t('edition.changing.signedNoPrice', {
                  publisher: AUTHOR_NAME,
                })}
          </p>
        </div>
      </CompactFrame>
    </div>,
    document.body,
  );
}
