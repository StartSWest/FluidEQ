/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useRef } from 'react';
import { currentAppNews, newsPreviewText } from 'common/appNews';
import { useWindowMode } from '../player/windowModeStore';
import {
  closeAppNews,
  expirePaintedNews,
  openAppNews,
  putNewsAway,
  useAppNews,
  useNewsOpen,
  useNewsPreview,
} from '../plus/appNewsStore';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import useModalKeys from '../utils/useModalKeys';
import MenuIcon from '../icons/MenuIcon';
import CompactFrame from './CompactFrame';
import DialogFrame from './DialogFrame';
import '../styles/AppNews.scss';
import '../styles/WhatsNew.scss';

const usePaintedNews = (painted: boolean) => {
  useEffect(() => {
    if (!painted) {
      return undefined;
    }
    let frame: number;
    const paint = () => {
      expirePaintedNews();
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [painted]);
};

/** The existing floating notice corner, with no layout or focus ownership. */
export function AppNewsNotice({ obscured = false }: { obscured?: boolean }) {
  const { t } = useTranslation();
  const state = useAppNews();
  const { mode } = useWindowMode();
  const item = currentAppNews(state.items).find((entry) =>
    state.unread.includes(entry.id),
  );
  const shown = useNoticeTurn(
    'appNews',
    Boolean(item) && mode !== 'player' && !obscured,
  );
  usePaintedNews(shown);
  if (!item || !shown) {
    return null;
  }
  return (
    <CompactFrame
      className="app-news-notice"
      role="status"
      aria-modal={undefined}
      icon={<MenuIcon name="gift" />}
      title={
        <>
          <span className="app-news-notice__label">
            {t('announce.news.title')}
          </span>
          {item.title}
        </>
      }
      titleId="app-news-notice-title"
      onClose={() => {
        putNewsAway(item.id).catch(() => undefined);
      }}
      closeLabel={t('app.dismiss')}
      actions={
        <button
          type="button"
          className="button small"
          onClick={() => {
            putNewsAway(item.id).catch(() => undefined);
            openAppNews();
          }}
        >
          {t('announce.news.read')}
        </button>
      }
    >
      <p className="app-news-notice__summary">{newsPreviewText(item.body)}</p>
    </CompactFrame>
  );
}

export function AppNewsHost() {
  const open = useNewsOpen();
  return open ? <AppNewsDialog /> : null;
}

function AppNewsDialog() {
  const { t, locale } = useTranslation();
  const state = useAppNews();
  const preview = useNewsPreview();
  const items = preview ? [preview] : currentAppNews(state.items);
  const surface = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useModalKeys(surface, close, { busy: false, onCancel: closeAppNews });
  usePaintedNews(!preview && items.length > 0);
  const newestId = items[0]?.id;
  useEffect(() => {
    if (!preview && newestId !== undefined) {
      putNewsAway(newestId).catch(() => undefined);
    }
  }, [preview, newestId]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return (
    <div className="whats-new-backdrop" role="presentation">
      <DialogFrame
        ref={surface}
        className="whats-new app-news"
        icon={<MenuIcon name="gift" />}
        title={t('announce.news.title')}
        titleId="app-news-title"
        description={
          preview ? t('announce.previewNote') : t('announce.news.description')
        }
        onClose={closeAppNews}
        closeLabel={t('support.close')}
        footer={
          <div className="dialog-frame__actions">
            <button
              ref={close}
              type="button"
              className="button small"
              onClick={closeAppNews}
            >
              {t('whatsNew.ok')}
            </button>
          </div>
        }
      >
        {state.offline && !preview && (
          <p className="gallery-fine" role="status">
            {t('announce.news.offline')}
          </p>
        )}
        {!items.length && <p>{t('announce.news.empty')}</p>}
        {items.map((item) => (
          <article key={item.id} className="dialog-frame__section">
            <p className="gallery-fine">
              <time dateTime={new Date(item.startsAt).toISOString()}>
                {date.format(item.startsAt)}
              </time>
            </p>
            <h3 className="whats-new__version">{item.title}</h3>
            <p className="app-news__body">{item.body}</p>
            {item.action && (
              <div className="dialog-frame__actions">
                <a
                  className="button small"
                  href={item.action.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.action.label}
                </a>
              </div>
            )}
          </article>
        ))}
      </DialogFrame>
    </div>
  );
}
