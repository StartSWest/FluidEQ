/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';

/**
 * Higgsfield making what a scene's chat was asked for, as the chat shows it:
 * the request, the card asking to allow the member's own tool before any of
 * their credits are spent (`StudioChatAsk`, Allow loud), the step that says
 * it is making it, and the chat's Accounts with Claude and Higgsfield, both
 * found in the member's own Claude Code. Every word is the chat's own label;
 * Higgsfield is the Studio's one maker since GPT was taken out (2026-11-11).
 *
 * One loop of CSS (`_tour-release25.scss`).
 */

const MAKER = 'Higgsfield';

export default function StudioMakersVisual() {
  const { t } = useTranslation();
  const accounts: readonly { name: string; state: string }[] = [
    {
      name: t('studioChat.accounts.claude'),
      state: t('studioChat.accounts.unknown'),
    },
    {
      name: t('studioChat.accounts.higgsfield'),
      state: t('studioChat.accounts.higgsfieldReady'),
    },
  ];
  return (
    <div
      className="makers-visual"
      role="img"
      aria-label={t('tour.makers.imageAlt')}
    >
      <section className="makers-visual__chat">
        <span className="makers-visual__mine">{t('tour.makers.request')}</span>
        <span className="makers-visual__ask">
          <span className="makers-visual__ask-title">
            {t('studioChat.ask.toolTitle', { tool: MAKER })}
          </span>
          <small className="makers-visual__ask-body">
            {t('studioChat.ask.toolBody')}
          </small>
          <span className="makers-visual__answers">
            <span className="button small makers-visual__allow">
              {t('studioChat.ask.allow')}
            </span>
            <span className="button small subtle">
              {t('studioChat.ask.deny')}
            </span>
          </span>
        </span>
        <span className="makers-visual__step">
          <i />
          {t('studioChat.step.makeNow')}
        </span>
      </section>

      <section className="makers-visual__accounts">
        <span className="makers-visual__accounts-title">
          {t('studioChat.accounts.title')}
        </span>
        {accounts.map((account) => (
          <span key={account.name} className="makers-visual__account">
            <i />
            <span>
              <strong>{account.name}</strong>
              <small>{account.state}</small>
            </span>
          </span>
        ))}
      </section>
    </div>
  );
}
