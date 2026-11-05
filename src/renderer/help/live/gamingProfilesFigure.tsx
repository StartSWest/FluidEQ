/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { readyGamingProfileId } from 'common/gaming';
import { dspPresetCatalog } from '../../dsp/dspPresetCatalog';
import { gamingProfileEntry } from '../../games/gamingCatalog';
import GamingProfileCard from '../../games/GamingProfileCard';
import { gamingProfileFacts } from '../../games/gamingProfileFacts';
import { useTranslation } from '../../utils/I18nContext';

/** The real profile cards, with fictional game copies and no access to the reader's files. */
export default function GamingProfilesDrawing() {
  const { t } = useTranslation();
  const chains = new Map(
    dspPresetCatalog(t).map((chain) => [chain.id, chain.name]),
  );
  return (
    <div className="gaming-profiles">
      <div className="gaming-profiles__grid">
        {['competitive', 'story', 'yours'].map((kind) => {
          const ready = gamingProfileEntry(
            readyGamingProfileId(kind === 'yours' ? 'competitive' : kind),
            [],
            t,
          );
          const facts = gamingProfileFacts(ready.id, t);
          const isYours = kind === 'yours';
          const entry = isYours
            ? {
                ...ready,
                id: 'help-saved',
                name: 'Ranked nights',
                kind: 'yours' as const,
                group: 'yours' as const,
                hint: t('gaming.profiles.savedFrom', {
                  game: 'Counter-Strike 2',
                }),
              }
            : ready;
          return (
            <GamingProfileCard
              key={kind}
              entry={entry}
              facts={
                facts && { ...facts, glyph: isYours ? 'yours' : facts.glyph }
              }
              chainName={facts?.chainId ? chains.get(facts.chainId) : undefined}
              users={isYours ? ['Counter-Strike 2'] : []}
              isYours={isYours}
              actions={
                <button type="button" className="button small subtle">
                  {t('gaming.profiles.use')}
                </button>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
