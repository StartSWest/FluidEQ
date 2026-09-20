/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import { isCheckoutConfigured } from 'common/accountConfig';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import PlusTrialOffer from '../plus/PlusTrialCard';
import { usePlusTrial } from '../plus/trialStore';
import { useTranslation } from '../utils/I18nContext';
import '../styles/StudioLocked.scss';

interface IStep {
  glyph: TCommunityGlyph;
  label: TranslationKey;
}

/** What the Studio is, in the order somebody would do it. */
const STEPS: readonly IStep[] = [
  { glyph: 'studio', label: 'studio.locked.write' },
  { glyph: 'music', label: 'studio.locked.test' },
  { glyph: 'upload', label: 'studio.locked.publish' },
];

/**
 * The Studio for a member who may not use it: what it is, the free trial,
 * and the way to Plus.
 *
 * Shown instead of the bench rather than beside it. A bench whose every
 * press is refused reads as a broken page, and this page has something to
 * say: the Studio is Plus's (Ivan, 2026-09-20: "I want them to pay first to
 * access the studio"), the trial is how anybody sees it, and a scene
 * published each month keeps it free afterwards.
 *
 * The trial card is the gallery's own, unchanged: it knows the four states a
 * trial can be in and draws nothing when there is no offer to make. So the
 * "See Plus" button beside it carries the emphasis only when no trial is
 * waiting — the loud style belongs to whichever of the two is the thing to
 * press.
 */
export default function StudioLocked() {
  const { t } = useTranslation();
  const { offer } = usePlusTrial();
  const trialWaiting = offer?.state === 'eligible';
  return (
    <div className="studio-locked">
      <section className="studio-locked__pitch">
        <div className="studio-locked__lead">
          <span className="studio-locked__head">
            <span className="studio-locked__mark" aria-hidden="true">
              <Glyph name="studio" />
            </span>
            <h2 className="studio-locked__title">{t('studio.locked.title')}</h2>
          </span>
          <p className="studio-locked__body">{t('studio.locked.body')}</p>
          <p className="studio-locked__earn">
            <Glyph name="gift" className="studio-locked__earn-mark" />
            <span>{t('studio.locked.earn')}</span>
          </p>
          {isCheckoutConfigured() && (
            <div className="studio-locked__actions">
              <button
                type="button"
                className={`button small${trialWaiting ? ' subtle' : ''}`}
                onClick={() => requestAccountPanel('subscribe')}
              >
                <Glyph name="plus" />
                {t('plus.gate.cta')}
              </button>
            </div>
          )}
        </div>
        <ul className="studio-locked__steps">
          {STEPS.map((step) => (
            <li key={step.label} className="studio-locked__step">
              <span className="studio-locked__step-mark" aria-hidden="true">
                <Glyph name={step.glyph} />
              </span>
              <span className="studio-locked__step-text">{t(step.label)}</span>
            </li>
          ))}
        </ul>
      </section>
      <PlusTrialOffer />
    </div>
  );
}
