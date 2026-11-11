/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The scene's chat asking which of the member's own makers should make the
 * animation frames it was asked for, as the chat asks it (`StudioChatAsk`:
 * the two makers with what each runs on, and Remember my choice), beside the
 * chat's Accounts with Claude, the member's GPT plugin and Higgsfield, each
 * found in their own Claude Code. Every word is the chat's own label.
 *
 * One loop of CSS (`_tour-release25.scss`).
 */

const MAKERS: readonly { name: TranslationKey; runsOn: TranslationKey }[] = [
  { name: 'studioChat.accounts.gpt', runsOn: 'studioChat.ask.makerGpt' },
  {
    name: 'studioChat.accounts.higgsfield',
    runsOn: 'studioChat.ask.makerHiggsfield',
  },
];

export default function StudioMakersVisual() {
  const { t } = useTranslation();
  const accounts: readonly { name: string; state: string }[] = [
    {
      name: t('studioChat.accounts.claude'),
      state: t('studioChat.accounts.unknown'),
    },
    {
      name: t('studioChat.accounts.gpt'),
      state: t('studioChat.accounts.gptFound', { name: 'gpt-image' }),
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
            {t('studioChat.ask.makerFrames')}
          </span>
          {MAKERS.map((maker, index) => (
            <span
              key={maker.name}
              className={`makers-visual__maker${index === 1 ? ' is-chosen' : ''}`}
            >
              <span className="makers-visual__maker-name">{t(maker.name)}</span>
              <small>{t(maker.runsOn)}</small>
            </span>
          ))}
          <span className="makers-visual__remember">
            <i />
            {t('studioChat.ask.makerRemember')}
          </span>
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
