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
import { useStudio } from './studioStore';
import { useTranslation } from '../utils/I18nContext';
import '../styles/StudioLocked.scss';

interface IStep {
  glyph: TCommunityGlyph;
  label: TranslationKey;
}

/**
 * The one folder to name for a set of project folders: the one that holds
 * them all. With a single project that is its own folder; with several it is
 * what they share, which for anything made here is the projects folder. A
 * member who linked projects from opposite ends of the disk shares only a
 * drive, and is sent to where new ones are made instead.
 */
const folderHolding = (paths: string[], projectsRoot: string): string => {
  const first = paths[0];
  if (!first) {
    return projectsRoot;
  }
  if (paths.length === 1) {
    return first;
  }
  const parts = first.split(/[\\/]/);
  const shared = paths.slice(1).reduce((held, path) => {
    const other = path.split(/[\\/]/);
    const upTo = Math.min(held, other.length);
    const differs = parts
      .slice(0, upTo)
      .findIndex((part, index) => part !== other[index]);
    return differs === -1 ? upTo : differs;
  }, parts.length);
  // One part is a bare drive or an empty root: not an answer anybody can use.
  return shared > 1 ? parts.slice(0, shared).join('\\') : projectsRoot;
};

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
 * The trial card is the gallery's own, unchanged: it knows the states a
 * trial can be in and draws nothing when there is no offer to make. What it
 * draws decides this page's own button, because two of them would otherwise
 * be the same press:
 * - a trial to start: the card's is the thing to press, so "See Plus" goes
 *   quiet beside it;
 * - a trial that ended: the card already carries "See plans", which IS this
 *   button, so this one is not drawn at all;
 * - no trial at all: this is the only way in, and it is loud.
 */
export default function StudioLocked() {
  const { t } = useTranslation();
  const { offer } = usePlusTrial();
  const { state } = useStudio();
  const trialWaiting = offer?.state === 'eligible';
  const trialOffersPlans = offer?.state === 'ended';
  // Their own work, not FluidEQ's scenes opened to look inside.
  const mine = state.projects.filter((project) => !project.official);
  const kept =
    mine.length > 0
      ? {
          count: mine.length,
          folder: folderHolding(
            mine.map((project) => project.path),
            state.projectsRoot,
          ),
        }
      : undefined;
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
          {/* Somebody who made projects while the Studio was open to
              everybody must not meet a page that never mentions them: the
              folders are untouched on disk, and a page that says nothing
              reads as "my work is gone". */}
          {kept && (
            <p className="studio-locked__kept">
              <Glyph name="folder" className="studio-locked__kept-mark" />
              <span>
                {t(
                  kept.count === 1
                    ? 'studio.locked.keptOne'
                    : 'studio.locked.keptMany',
                  { count: String(kept.count) },
                )}{' '}
                <span className="studio-locked__kept-path">{kept.folder}</span>
              </span>
            </p>
          )}
          {isCheckoutConfigured() && !trialOffersPlans && (
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
