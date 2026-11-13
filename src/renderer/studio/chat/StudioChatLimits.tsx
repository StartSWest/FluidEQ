/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  STUDIO_CHAT_LIMIT_WINDOWS,
  type IStudioChatLimit,
  type TStudioChatLimitWindow,
} from 'common/studioChat';
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

/** Each window under its own name, wherever one is spoken of. */
export const LIMIT_NAMES: Record<TStudioChatLimitWindow, TranslationKey> = {
  fiveHour: 'studioChat.limits.fiveHour',
  week: 'studioChat.limits.week',
  fable: 'studioChat.limits.fable',
  opus: 'studioChat.limits.opus',
};

/**
 * How a window's reset is written: the session starts over within hours,
 * so its time alone; the weeks within days, so their day too.
 */
export const useLimitTimes = () => {
  const { locale } = useTranslation();
  return useMemo(() => {
    const time = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
    });
    const dayAndTime = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
    return {
      time,
      dayAndTime,
      of: (window: TStudioChatLimitWindow) =>
        window === 'fiveHour' ? time : dayAndTime,
    };
  }, [locale]);
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
 * The Claude plan's usage windows, under its account (Ivan, 2026-10-14:
 * "show the 5h and weekly limits … under accounts"), and Fable's own
 * beside them (2026-11-13: "show fable session limit too in the account
 * menu"): Claude Code keeps no five-hour window per model, so Fable's is
 * its week, as Claude Code's /usage shows it. Opening the card shows the
 * last reading and asks Claude Code for a new one, which replaces it a few
 * seconds later; every answer asks again (`chatUsage.ts`).
 *
 * A window whose reset has passed is not shown: its figure is the old
 * window's, and the card once showed last week's 31% days into a week at
 * 12% (Ivan, 2026-10-24). The reading's time carries its day when it is
 * not today's.
 */
export default function StudioChatLimits() {
  const { t } = useTranslation();
  const { limits } = useStudioChat();
  const times = useLimitTimes();

  useEffect(() => {
    checkStudioChatLimits().catch(() => undefined);
  }, []);

  const now = Date.now();
  const shown = STUDIO_CHAT_LIMIT_WINDOWS.flatMap((window) => {
    const limit = limits?.[window];
    return limit && limit.resetsAt > now ? [{ window, limit }] : [];
  });
  if (!limits || shown.length === 0) {
    return (
      <p className="studio-chat-limits__none">{t('studioChat.limits.none')}</p>
    );
  }
  const sameDay =
    new Date(limits.at).toDateString() === new Date(now).toDateString();
  return (
    <div className="studio-chat-limits">
      {shown.map(({ window, limit }) => (
        <LimitBar
          key={window}
          name={LIMIT_NAMES[window]}
          limit={limit}
          resets={times.of(window)}
        />
      ))}
      <p className="studio-chat-limits__as-of">
        {t('studioChat.limits.asOf', {
          time: (sameDay ? times.time : times.dayAndTime).format(limits.at),
        })}
      </p>
    </div>
  );
}
