/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, type KeyboardEvent } from 'react';
import type { TranslationKey } from 'common/i18n';
import { STUDIO_CHAT_EFFORTS, type TStudioChatEffort } from 'common/studioChat';
import { useTranslation } from '../../utils/I18nContext';
import { setStudioChatEffort, useStudioChat } from './studioChatStore';

const EFFORT_WORDS: Record<TStudioChatEffort, TranslationKey> = {
  default: 'studioChat.effortDefault',
  low: 'studioChat.effortLow',
  medium: 'studioChat.effortMedium',
  high: 'studioChat.effortHigh',
  xhigh: 'studioChat.effortXhigh',
  max: 'studioChat.effortMax',
};

/** The five levels a dot names, Low to Max. */
const STEPS = STUDIO_CHAT_EFFORTS.filter(
  (effort): effort is Exclude<TStudioChatEffort, 'default'> =>
    effort !== 'default',
);

/** Where Medium stands among the dots: past it, the composer warns. */
const MEDIUM = STEPS.indexOf('medium');

/**
 * Above Medium: Claude thinks longer, replies slow down and the member's plan
 * runs out sooner, so the box says so while one is picked (Ivan, 2026-10-09:
 * "warn about using higher effort levels").
 */
export const isHeavyEffort = (effort: TStudioChatEffort) =>
  STEPS.findIndex((step) => step === effort) > MEDIUM;

/** Each arrow's step along the row, as ARIA's radio group moves them. */
const ARROW_MOVES: Partial<Record<string, number>> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

/**
 * How hard Claude thinks, as five dots lit up to the level picked (Ivan chose
 * this over a menu, 2026-10-09: design C of the message-box mockups),
 * Medium unless picked otherwise. The dots past Medium light in the warning
 * colour, as the line under the box warns.
 *
 * A radio group by ARIA's pattern: one tab stop, on the picked dot or the
 * first, and the arrows move the pick along the row.
 */
export default function StudioChatEffortDots({
  disabled,
}: {
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { effort } = useStudioChat();
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const level = STEPS.findIndex((step) => step === effort);
  const stop = level < 0 ? 0 : level;
  const litClass = (index: number) => {
    if (index > level) {
      return undefined;
    }
    return level > MEDIUM ? 'is-lit is-heavy' : 'is-lit';
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const move = ARROW_MOVES[event.key];
    if (move === undefined) {
      return;
    }
    event.preventDefault();
    const next = Math.min(STEPS.length - 1, Math.max(0, stop + move));
    setStudioChatEffort(STEPS[next]);
    dots.current[next]?.focus();
  };

  return (
    <div className="studio-chat__effort" title={t('studioChat.effortHint')}>
      <div
        className="studio-chat__effort-dots"
        role="radiogroup"
        aria-label={t('studioChat.effort')}
      >
        {STEPS.map((step, index) => (
          <button
            key={step}
            ref={(element) => {
              dots.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={step === effort}
            aria-label={t(EFFORT_WORDS[step])}
            className={litClass(index)}
            tabIndex={index === stop ? 0 : -1}
            disabled={disabled}
            onClick={() => setStudioChatEffort(step)}
            onKeyDown={onKeyDown}
          />
        ))}
      </div>
      <span className="studio-chat__effort-name" aria-hidden="true">
        {t(EFFORT_WORDS[effort])}
      </span>
    </div>
  );
}
