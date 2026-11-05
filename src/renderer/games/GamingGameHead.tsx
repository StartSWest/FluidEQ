/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { IGameProfile } from '../../common/games';
import type { IYoursGamingProfile } from '../../common/gaming';
import { useTranslation } from '../utils/I18nContext';
import RichPick from '../widgets/RichPick';
import GameIcon from './GameIcon';
import {
  GAMING_GROUP_LABEL_KEYS,
  GAMING_KIND_LABEL_KEYS,
  gamingProfileEntries,
  gamingProfileEntry,
} from './gamingCatalog';
import { gamingStageLabelKey, TGamingStage } from './gamingStages';

/*
 * The parts of a game's page in the Gaming Lab that only show what they are
 * given — its header, its profile picker, the line saying what was tuned —
 * so the page (`GamingGamePanel`) and its Help drawing
 * (`help/live/gamingFigures`) draw the same ones.
 */

const GamepadGlyph = () => (
  <svg
    className="rich-pick__glyph"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 7.5h8a5 5 0 0 1 5 5v1a3.6 3.6 0 0 1-6.3 2.4l-.7-.8h-4l-.7.8A3.6 3.6 0 0 1 3 13.5v-1a5 5 0 0 1 5-5z" />
    <path d="M7.4 11.4v2.4M6.2 12.6h2.4" />
  </svg>
);

interface IGamingProfilePickProps {
  profileId: string;
  yours: readonly IYoursGamingProfile[];
  onPick: (id: string) => void;
  disabled: boolean;
}

/**
 * Which Gaming profile a game's copy starts from: the listener's own, then
 * the ready-made ones by kind and by title, the kind worn as a chip. A
 * profile the list no longer has (one of Yours deleted) is still named, at
 * the top, rather than shown as nothing.
 */
export const GamingProfilePick = ({
  profileId,
  yours,
  onPick,
  disabled,
}: IGamingProfilePickProps) => {
  const { t } = useTranslation();
  const profile = gamingProfileEntry(profileId, yours, t);
  const entries = gamingProfileEntries(yours, t);
  const listed = entries.some((entry) => entry.id === profileId);
  const kindKey = GAMING_KIND_LABEL_KEYS[profile.kind];
  return (
    <div className="gaming-panel__profile">
      <span className="gaming-cap">{t('gaming.profile.label')}</span>
      <RichPick
        className="gaming-panel__pick"
        menuClassName="gaming-profile-menu"
        entries={[...(listed ? [] : [profile]), ...entries].map((entry) => ({
          id: entry.id,
          name: entry.name,
          hint: entry.hint,
          group: entry.group,
          icon: <GamepadGlyph />,
        }))}
        groupLabel={(group) =>
          group === 'yours'
            ? t('gaming.profile.kind.yours')
            : t(
                GAMING_GROUP_LABEL_KEYS[
                  group as keyof typeof GAMING_GROUP_LABEL_KEYS
                ],
              )
        }
        activeId={profileId}
        onPick={onPick}
        placeholder={profile.name}
        placeholderIcon={<GamepadGlyph />}
        triggerAriaLabel={t('gaming.profile.label')}
        triggerTitle={t('gaming.profile.pickHint')}
        triggerExtra={
          kindKey ? (
            <span className="gaming-kind">{t(kindKey)}</span>
          ) : undefined
        }
        disabled={disabled}
      />
    </div>
  );
};

interface IGamingGameHeadProps {
  game: IGameProfile;
  /** Where its sound plays: the launcher and the output, in words. */
  where: string;
  isPlaying: boolean;
  pick: ReactNode;
  actions: ReactNode;
}

/** A game's name and where it plays, its profile, and what can be done. */
export const GamingGameHead = ({
  game,
  where,
  isPlaying,
  pick,
  actions,
}: IGamingGameHeadProps) => {
  const { t } = useTranslation();
  return (
    <header className="gaming-panel__head">
      <div className="gaming-panel__game">
        <span className="gaming-panel__icon">
          <GameIcon program={game} />
        </span>
        <div className="gaming-panel__names">
          <h2 className="gaming-panel__name">
            {game.name}
            {isPlaying && (
              <span className="gaming-game__playing">
                <span className="gaming-dot" aria-hidden="true" />
                {t('gaming.list.playing')}
              </span>
            )}
          </h2>
          <span className="gaming-panel__where">{where}</span>
        </div>
      </div>
      {pick}
      <div className="gaming-panel__actions">{actions}</div>
    </header>
  );
};

interface IGamingGameStatusProps {
  tuned: readonly TGamingStage[];
  profileName: string;
  /** The name the listener gave this game's copy, if any. */
  copyName?: string;
}

/**
 * What this game's copy is, and every part of it tuned away from its
 * profile, named in the reader's language and joined as that language joins
 * a list.
 */
export const GamingGameStatus = ({
  tuned,
  profileName,
  copyName,
}: IGamingGameStatusProps) => {
  const { t, locale } = useTranslation();
  const parts = new Intl.ListFormat(locale, {
    style: 'long',
    type: 'conjunction',
  }).format(tuned.map((part) => t(gamingStageLabelKey(part))));
  let status: string;
  if (tuned.length === 0) {
    status = t('gaming.status.same');
  } else if (copyName) {
    status = t('gaming.status.tunedNamed', {
      copy: copyName,
      profile: profileName,
      parts,
    });
  } else {
    status = t('gaming.status.tuned', { profile: profileName, parts });
  }
  return (
    <p className={`gaming-panel__status${tuned.length > 0 ? ' is-tuned' : ''}`}>
      <span className="gaming-panel__status-dot" aria-hidden="true" />
      {status}
    </p>
  );
};
