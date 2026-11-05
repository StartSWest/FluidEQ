/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import { useTranslation } from '../utils/I18nContext';
import type { IGamingProfileEntry } from './gamingCatalog';
import GamingProfileCurve from './GamingProfileCurve';
import GamingProfileGlyph from './GamingProfileGlyph';
import { gamingProfileGlyph, IGamingProfileFacts } from './gamingProfileFacts';

interface IGamingProfileCardProps {
  entry: IGamingProfileEntry;
  /** What it plays; none for a saved profile main could not read. */
  facts?: IGamingProfileFacts;
  /** The gaming chain its copy's rack starts from, by its own name. */
  chainName?: string;
  /** The games whose copies started from it. */
  users: readonly string[];
  isYours: boolean;
  actions: ReactNode;
}

/**
 * One Gaming profile: what kind of game it is for, the curve it plays, how
 * far each part of the Game filter reaches, the chain and the Room under
 * it, and which games started from it. The numbers are what tells two
 * shooters' profiles apart; the curve is what tells a shooter's from a
 * story's.
 */
const GamingProfileCard = ({
  entry,
  facts,
  chainName,
  users,
  isYours,
  actions,
}: IGamingProfileCardProps) => {
  const { t, locale } = useTranslation();
  const db = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
  // A narrow no-break space, so the unit never wraps from its number.
  const reach = (value: number) =>
    `${db.format(value)}${String.fromCodePoint(0x202f)}dB`;
  const glyph = facts?.glyph ?? gamingProfileGlyph(entry.id);

  return (
    <article
      className={`gaming-profile${isYours ? ' is-yours' : ''}`}
      data-kind={glyph}
    >
      <div className="gaming-profile__head">
        <span className="gaming-profile__glyph">
          <GamingProfileGlyph glyph={glyph} />
        </span>
        <span className="gaming-profile__names">
          <span className="gaming-profile__name" title={entry.name}>
            {entry.name}
          </span>
          <span className="gaming-profile__hint" title={entry.hint}>
            {entry.hint}
          </span>
        </span>
      </div>

      {facts && (
        <>
          {facts.showsCurve && (
            <div className="gaming-profile__sound">
              <span className="gaming-profile__curve-name">
                {facts.curve
                  ? `${t('gaming.stage.curve')} · ${t(facts.curve.labelKey)}`
                  : t('gaming.profiles.noCurve')}
              </span>
              {/* No curve draws the flat line it plays. */}
              <GamingProfileCurve gains={facts.curve?.gains ?? []} />
            </div>
          )}
          {facts.filter && (
            <dl className="gaming-profile__facts">
              <div>
                <dt>{t('dsp.game.footsteps')}</dt>
                <dd>{reach(facts.filter.footstepsDb)}</dd>
              </div>
              <div>
                <dt>{t('dsp.game.dialogue')}</dt>
                <dd>{reach(facts.filter.dialogueDb)}</dd>
              </div>
              <div>
                <dt>{t('dsp.game.environment')}</dt>
                <dd>{reach(facts.filter.environmentDb)}</dd>
              </div>
            </dl>
          )}
          {(chainName || facts.roomNote) && (
            <div className="gaming-profile__tags">
              {chainName && (
                <span className="gaming-profile__tag">{chainName}</span>
              )}
              {facts.roomNote && (
                <span className="gaming-profile__tag">{facts.roomNote}</span>
              )}
            </div>
          )}
        </>
      )}

      <div className="gaming-profile__foot">
        {users.length > 0 && (
          <span className="gaming-profile__used">
            <span className="gaming-dot" aria-hidden="true" />
            {t('gaming.profiles.usedBy', {
              games: new Intl.ListFormat(locale, {
                style: 'long',
                type: 'conjunction',
              }).format(users),
            })}
          </span>
        )}
        <div className="gaming-profile__actions">{actions}</div>
      </div>
    </article>
  );
};

export default GamingProfileCard;
