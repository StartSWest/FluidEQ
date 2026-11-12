/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { IMemberNotice } from 'common/memberNotices';
import type { LocaleCode, TranslationKey } from 'common/i18n';
import { useAccount } from '../account/accountStore';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import { dismissMemberNotices, useSceneStore } from '../plus/sceneStore';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import CompactFrame from './CompactFrame';
import '../styles/MemberNotice.scss';

const MARKS: Record<IMemberNotice['kind'], MenuIconName> = {
  'scene-returned': 'credit',
  'scene-taken-down': 'alert',
  'scene-restored': 'check',
  'purchase-refunded': 'credit',
};

/** The words of one notice: a title, and the line under it when there is one. */
const wordsOf = (
  notice: IMemberNotice,
  t: (key: TranslationKey, vars?: Record<string, string>) => string,
  locale: LocaleCode,
): { title: string; body: ReactNode } => {
  const name = notice.names ? (notice.names[locale] ?? notice.names.en) : '';
  switch (notice.kind) {
    case 'scene-returned':
      return {
        title: t('store.notice.returned'),
        body: (
          <p className="member-notice__line">
            {t('store.notice.returnedBody')}
          </p>
        ),
      };
    case 'scene-taken-down': {
      const { block } = notice;
      return {
        title: t('store.notice.takenDown', { name }),
        body: (
          <>
            <p className="member-notice__line">
              {t('store.notice.takenDownBody', { name })}
            </p>
            {block && (
              <p className="member-notice__block">
                {t(
                  block.scope === 'scene'
                    ? 'store.notice.blockScene'
                    : 'store.notice.blockAccount',
                  { count: String(block.days) },
                )}
              </p>
            )}
          </>
        ),
      };
    }
    case 'scene-restored':
      return { title: t('store.notice.restored', { name }), body: null };
    case 'purchase-refunded':
      return {
        title: t('store.notice.refunded'),
        body: (
          <p className="member-notice__line">
            {t('store.notice.refundedBody', { name })}
          </p>
        ),
      };
    default:
      return { title: '', body: null };
  }
};

/**
 * What the server has to tell this account about its scenes (premium 0105),
 * one at a time, oldest first, in the corner where the other news is.
 *
 * A buyer is told one thing only, on the day it happens: that a scene is no
 * longer available and its credit is back — never why, never by whom, never
 * a warning before (Ivan, 2026-11-12). A maker is told of a takedown with the
 * block that came with it, of a restore, and of a refunded purchase.
 *
 * Put away once, it is put away on every computer: the server is told, and
 * the store that comes back no longer carries it. Nothing to do but read it,
 * so its one answer wears the loud style.
 */
export default function MemberNotice() {
  const { t, locale } = useTranslation();
  const account = useAccount();
  const { store } = useSceneStore();
  // A suspended account has its own screen, and nothing else to be told.
  const notice =
    account.status === 'signed-in' && !store?.suspension
      ? store?.notices?.[0]
      : undefined;
  const isShown = useNoticeTurn('memberNotice', notice !== undefined);

  if (!notice || !isShown) {
    return null;
  }

  const putAway = () => {
    dismissMemberNotices([notice.id]).catch(() => undefined);
  };
  const { title, body } = wordsOf(notice, t, locale);

  return (
    <CompactFrame
      className="member-notice"
      tone={notice.kind === 'scene-taken-down' ? 'warn' : 'accent'}
      icon={<MenuIcon name={MARKS[notice.kind]} />}
      title={title}
      titleId="member-notice-title"
      role="dialog"
      aria-modal="false"
      onClose={putAway}
      closeLabel={t('app.dismiss')}
      actions={
        <button type="button" className="button small" onClick={putAway}>
          {t('review.notice.gotIt')}
        </button>
      }
    >
      {body}
    </CompactFrame>
  );
}
