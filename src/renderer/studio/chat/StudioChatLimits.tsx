/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IStudioChatLimit } from 'common/studioChat';
import { useTranslation } from '../../utils/I18nContext';
import { checkStudioChatLimits, useStudioChat } from './studioChatStore';

/** Past these a bar turns amber, then red: the member is near the wall. */
const NEARLY = 0.8;
const ALMOST = 0.95;

export const levelOf = (used: number) => {
  if (used >= ALMOST) {
    return 'is-full';
  }
  return used >= NEARLY ? 'is-near' : 'is-fine';
};

function LimitBar({
  name,
  limit,
  resets,
}: {
  name: TranslationKey;
  limit: IStudioChatLimit;
  resets: Intl.DateTimeFormat;
}) {
  const { t } = useTranslation();
  const percent = Math.round(limit.used * 100);
  return (
    <div className={`studio-chat-limits__row ${levelOf(limit.used)}`}>
      <p className="studio-chat-limits__name">
        <span>{t(name)}</span>
        <span className="studio-chat-limits__percent">
          {t('studioChat.limits.used', { percent })}
        </span>
      </p>
      <div
        className="studio-chat-limits__bar"
        role="meter"
        aria-label={t(name)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="studio-chat-limits__resets">
        {t('studioChat.limits.resets', {
          time: resets.format(limit.resetsAt),
        })}
      </p>
    </div>
  );
}

/**
 * The Claude plan's two usage windows, under its account (Ivan, 2026-10-14:
 * "show the 5h and weekly limits … under accounts"). Opening the card shows
 * the last reading and asks Claude Code for a new one, which replaces it a
 * few seconds later; every answer asks again (`chatUsage.ts`).
 *
 * A window whose reset has passed is not shown: its figure is the old
 * window's, and the card once showed last week's 31% days into a week at
 * 12% (Ivan, 2026-10-24). The reading's time carries its day when it is
 * not today's.
 */
export default function StudioChatLimits() {
  const { t, locale } = useTranslation();
  const { limits } = useStudioChat();

  useEffect(() => {
    checkStudioChatLimits().catch(() => undefined);
  }, []);

  // The session starts over within hours, so its time alone; the week
  // within days, so its day too.
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    [locale],
  );
  const dayAndTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [locale],
  );

  const now = Date.now();
  const current = (limit: IStudioChatLimit | undefined) =>
    limit && limit.resetsAt > now ? limit : undefined;
  const fiveHour = current(limits?.fiveHour);
  const week = current(limits?.week);
  if (!limits || (!fiveHour && !week)) {
    return (
      <p className="studio-chat-limits__none">{t('studioChat.limits.none')}</p>
    );
  }
  const sameDay =
    new Date(limits.at).toDateString() === new Date(now).toDateString();
  return (
    <div className="studio-chat-limits">
      {fiveHour && (
        <LimitBar
          name="studioChat.limits.fiveHour"
          limit={fiveHour}
          resets={time}
        />
      )}
      {week && (
        <LimitBar
          name="studioChat.limits.week"
          limit={week}
          resets={dayAndTime}
        />
      )}
      <p className="studio-chat-limits__as-of">
        {t('studioChat.limits.asOf', {
          time: (sameDay ? time : dayAndTime).format(limits.at),
        })}
      </p>
    </div>
  );
}
