import { useEffect, useState, type ReactNode } from 'react';
import type { IAccountState } from 'main/account/session';
import type { TranslationKey } from 'common/i18n/en';
import { STARTER_CREDITS } from 'common/sceneStore';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import BrandMark from '../icons/BrandMark';
import CreditCoin from '../plus/CreditCoin';
import { useTranslation } from '../utils/I18nContext';
import { pluralCategory } from '../utils/pluralCategory';
import '../styles/AccountWelcome.scss';

/**
 * What the account panel's left side says before anybody is signed in, as
 * Ivan approved it on 2026-11-13 ("I love that login"): FluidEQ's logo, and
 * then either what creating an account gets — the credit coin, the starter
 * scenes waiting, the three steps with the current one lit — or, signing
 * in, what is waiting on the account.
 */
export type TWelcomeKind = 'create' | 'confirm' | 'signIn';

const STEPS: readonly TranslationKey[] = [
  'account.welcome.step.create',
  'account.welcome.step.confirm',
];

const BACK: readonly { glyph: TCommunityGlyph; key: TranslationKey }[] = [
  { glyph: 'monitor', key: 'account.welcome.back.scenes' },
  { glyph: 'credit', key: 'account.welcome.back.credits' },
  { glyph: 'studio', key: 'account.welcome.back.studio' },
];

/** FluidEQ's logo tile and name, as the window's header spells it. */
function Brand() {
  return (
    <span className="account-welcome__brand">
      <BrandMark className="account-welcome__mark" />
      <span className="account-welcome__word">
        Fluid<span className="account-welcome__eq">EQ</span>
      </span>
    </span>
  );
}

/** Across the top of the rail: the logo, and the coin when creating. */
export function WelcomeCover({ kind }: { kind: TWelcomeKind }) {
  return (
    <div className="account-welcome__cover">
      <Brand />
      {kind !== 'signIn' && <CreditCoin size="l" badge={STARTER_CREDITS} />}
    </div>
  );
}

/** The rest of the rail: the steps, or what is waiting, and the free note. */
export function WelcomeRail({
  kind,
  termsLink,
}: {
  kind: TWelcomeKind;
  termsLink: ReactNode;
}) {
  const { t, locale } = useTranslation();
  const plural = pluralCategory(STARTER_CREDITS, locale);
  const at = kind === 'confirm' ? 1 : 0;
  const steps = [
    ...STEPS.map((key) => t(key)),
    t(`account.welcome.step.pick.${plural}` as TranslationKey, {
      count: String(STARTER_CREDITS),
    }),
  ];
  return (
    <div className="account-welcome__rail">
      {kind === 'signIn' ? (
        <ul className="account-welcome__list">
          {BACK.map((line) => (
            <li key={line.key}>
              <Glyph name={line.glyph} />
              {t(line.key)}
            </li>
          ))}
        </ul>
      ) : (
        <ol className="account-welcome__list account-welcome__steps">
          {steps.map((step, index) => {
            let state = '';
            if (index < at) {
              state = 'is-done';
            } else if (index === at) {
              state = 'is-now';
            }
            return (
              <li
                key={step}
                className={state}
                aria-current={index === at ? 'step' : undefined}
              >
                <span className="account-welcome__n">
                  {index < at ? <Glyph name="check" /> : index + 1}
                </span>
                {step}
              </li>
            );
          })}
        </ol>
      )}
      <div className="account-welcome__foot">
        <p className="account-welcome__free">{t('account.welcome.free')}</p>
        {termsLink}
      </div>
    </div>
  );
}

/**
 * Which form is open while nobody is signed in, and so what the rail says:
 * the dialog's page picks the first form, a tab press changes it, and an
 * address waiting for its code is the confirm step whatever the tab.
 */
export function useWelcome(page: string, account: IAccountState) {
  const [formMode, setFormMode] = useState<'signIn' | 'signUp'>(
    page === 'signUp' ? 'signUp' : 'signIn',
  );
  useEffect(() => {
    setFormMode(page === 'signUp' ? 'signUp' : 'signIn');
  }, [page]);
  let kind: TWelcomeKind = formMode === 'signUp' ? 'create' : 'signIn';
  if (account.pending?.purpose === 'signup') {
    kind = 'confirm';
  }
  return { kind, formMode, setFormMode, ...useWelcomeHeading(kind) };
}

/** The heading and its line for each kind. */
export function useWelcomeHeading(kind: TWelcomeKind) {
  const { t, locale } = useTranslation();
  const count = { count: String(STARTER_CREDITS) };
  const plural = pluralCategory(STARTER_CREDITS, locale);
  if (kind === 'signIn') {
    return {
      title: t('account.welcome.backTitle'),
      description: t('account.welcome.backLine'),
    };
  }
  return {
    title: t(`account.welcome.createTitle.${plural}` as TranslationKey, count),
    description: t(
      `account.welcome.createLine.${plural}` as TranslationKey,
      count,
    ),
  };
}
