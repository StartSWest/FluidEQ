/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useMemo, useState } from 'react';
import type { ErrorDescription } from '../../common/errors';
import { FOOTSTEPS_PRESET_GROUPS } from '../../common/dsp/footstepsPresets';
import { gamingProfileOf, IGameProfile } from '../../common/games';
import {
  GAMING_PROFILE_NAME_MAX,
  IYoursGamingProfile,
  yoursGamingProfileId,
} from '../../common/gaming';
import OverflowArrow from '../components/OverflowArrow';
import DspPresetSaveDialog from '../dsp/DspPresetSaveDialog';
import { dspPresetCatalog } from '../dsp/dspPresetCatalog';
import MenuIcon from '../icons/MenuIcon';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { deleteGamingProfile, renameGamingProfile } from '../utils/gamingApi';
import { useTranslation } from '../utils/I18nContext';
import { useOverflowScroll } from '../utils/useOverflowScroll';
import {
  GAMING_GROUP_LABEL_KEYS,
  gamingProfileEntries,
  IGamingProfileEntry,
} from './gamingCatalog';
import GamingProfileCard from './GamingProfileCard';
import GamingProfileGlyph from './GamingProfileGlyph';
import {
  gamingProfileFacts,
  matchesSearch,
  yoursProfileFacts,
} from './gamingProfileFacts';
import {
  sayGamingProfilesChanged,
  useYoursGamingProfiles,
} from './useGamingData';

type TFilter = 'all' | 'yours' | (typeof FOOTSTEPS_PRESET_GROUPS)[number];

interface IGamingProfilesViewProps {
  games: readonly IGameProfile[];
  onUse: (profileId: string) => void;
}

/**
 * Every profile a game can start from: the listener's own, kept from a
 * game's copy, and the ready-made ones by kind of game and by title. A
 * profile here is never changed by tuning a game; each card says what it
 * does and which games took a copy of it (Ivan, 2026-11-02), and a search
 * finds one by its name, its games, its curve or its chain (2026-11-04).
 */
const GamingProfilesView = ({ games, onUse }: IGamingProfilesViewProps) => {
  const { t, locale } = useTranslation();
  const { setGlobalError } = useFluidEqContext();
  const yours = useYoursGamingProfiles();
  const [filter, setFilter] = useState<TFilter>('all');
  const [query, setQuery] = useState('');
  const searchId = useId();
  const filterScroll = useOverflowScroll();
  const [renaming, setRenaming] = useState<IYoursGamingProfile>();
  /** The one of Yours whose Delete was pressed and is asked about. */
  const [deleting, setDeleting] = useState<string>();
  const entries = gamingProfileEntries(yours, t);
  const chainNames = useMemo(
    () => new Map(dspPresetCatalog(t).map((chain) => [chain.id, chain.name])),
    [t],
  );
  const count = new Intl.NumberFormat(locale);

  const usedBy = (entry: IGamingProfileEntry): string[] =>
    games
      .filter((game) => gamingProfileOf(game) === entry.id)
      .map((game) => game.name);

  const ownOf = (entry: IGamingProfileEntry) =>
    yours.find((profile) => yoursGamingProfileId(profile.id) === entry.id);

  // Each card's facts and words, worked out once a render: the search reads
  // the same words the card shows, so it finds what the reader can see. A
  // profile of Yours says what its saved sound plays, as a ready-made does.
  const cards = entries.map((entry) => {
    const own = ownOf(entry);
    const facts = own
      ? yoursProfileFacts(own.summary)
      : gamingProfileFacts(entry.id, t);
    const chainName =
      facts?.chainId === undefined ? undefined : chainNames.get(facts.chainId);
    const users = usedBy(entry);
    const words = [
      entry.name,
      entry.hint,
      chainName ?? '',
      facts?.curve ? t(facts.curve.labelKey) : '',
      facts?.roomNote ?? '',
      ...users,
    ];
    return { entry, facts, chainName, users, words };
  });
  const found = cards.filter((card) => matchesSearch(card.words, query));
  const searching = query.trim() !== '';
  const inGroup = (group: TFilter) =>
    found.filter((card) => group === 'all' || card.entry.group === group);

  const fail = (error: unknown) => setGlobalError(error as ErrorDescription);

  const actionsOf = (entry: IGamingProfileEntry) => {
    const own = ownOf(entry);
    // A profile of Yours is the only copy of a sound somebody tuned, so its
    // Delete asks once, in place, with the name still on the card above.
    if (own && deleting === own.id) {
      return (
        <>
          <span className="gaming-profile__ask" role="status">
            {t('gaming.profiles.confirmDelete')}
          </span>
          <button
            type="button"
            className="button small"
            onClick={() => {
              setDeleting(undefined);
              deleteGamingProfile(own.id)
                .then(() => sayGamingProfilesChanged())
                .catch(fail);
            }}
          >
            {t('gaming.profiles.delete')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={() => setDeleting(undefined)}
          >
            {t('gaming.profiles.keep')}
          </button>
        </>
      );
    }
    return (
      <>
        {own && (
          <>
            <button
              type="button"
              className="button small subtle"
              onClick={() => setRenaming(own)}
            >
              {t('gaming.profiles.rename')}
            </button>
            <button
              type="button"
              className="button small subtle is-danger"
              onClick={() => setDeleting(own.id)}
            >
              {t('gaming.profiles.delete')}
            </button>
          </>
        )}
        <button
          type="button"
          className="button small subtle"
          onClick={() => onUse(entry.id)}
        >
          {t('gaming.profiles.use')}
        </button>
      </>
    );
  };

  const grid = (list: typeof cards, isYours = false) => (
    <div className={`gaming-profiles__grid${isYours ? ' is-yours' : ''}`}>
      {list.map((card) => (
        <GamingProfileCard
          key={card.entry.id}
          entry={card.entry}
          facts={card.facts}
          chainName={card.chainName}
          users={card.users}
          isYours={isYours}
          actions={actionsOf(card.entry)}
        />
      ))}
    </div>
  );

  const shows = (group: TFilter) => filter === 'all' || filter === group;
  const yoursFound = inGroup('yours');
  const groupsShown = FOOTSTEPS_PRESET_GROUPS.filter(
    (group) => shows(group) && inGroup(group).length > 0,
  );
  // The empty Yours says how to fill it, unless a search is narrowing the
  // page: then an empty section is only one the search left out.
  const showsYours = shows('yours') && (!searching || yoursFound.length > 0);
  const nothing = !showsYours && groupsShown.length === 0;

  const filterLabel = (id: TFilter): string => {
    if (id === 'all') {
      return t('gaming.profiles.filter.all');
    }
    return id === 'yours'
      ? t('gaming.profiles.filter.yours')
      : t(GAMING_GROUP_LABEL_KEYS[id]);
  };

  return (
    <div className="gaming-profiles">
      <div className="gaming-profiles__bar">
        <label className="gaming-profiles__search" htmlFor={searchId}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M20 20l-4.2-4.2" />
          </svg>
          <input
            id={searchId}
            type="search"
            placeholder={t('gaming.profiles.search')}
            aria-label={t('gaming.profiles.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query !== '') {
                event.stopPropagation();
                setQuery('');
              }
            }}
          />
          {searching && (
            <button
              type="button"
              className="gaming-profiles__clear"
              aria-label={t('gaming.profiles.searchClear')}
              title={t('gaming.profiles.searchClear')}
              onClick={() => setQuery('')}
            >
              <MenuIcon name="clear" />
            </button>
          )}
        </label>
        {/* One line beside the search at every width (Ivan, 2026-11-04:
            "filters on same line"): what does not fit scrolls, with the
            app's round arrows to it, rather than wrapping under. */}
        <div className="gaming-profiles__filter-row">
          {filterScroll.canScrollBack && (
            <OverflowArrow
              direction="back"
              onPress={() => filterScroll.scrollBy(-1)}
            />
          )}
          <div
            ref={filterScroll.ref}
            onScroll={filterScroll.onScroll}
            className={`gaming-profiles__filters${
              filterScroll.canScrollBack ? ' has-back' : ''
            }${filterScroll.canScrollForward ? ' has-forward' : ''}`}
            role="group"
            aria-label={t('gaming.profiles.filterLabel')}
          >
            {(['all', 'yours', ...FOOTSTEPS_PRESET_GROUPS] as const).map(
              (id) => (
                <button
                  key={id}
                  type="button"
                  className={`gaming-filter${filter === id ? ' is-on' : ''}`}
                  aria-pressed={filter === id}
                  onClick={(event) => {
                    setFilter(id);
                    event.currentTarget.scrollIntoView({
                      block: 'nearest',
                      inline: 'nearest',
                    });
                  }}
                >
                  {filterLabel(id)}
                  <span className="gaming-filter__count">
                    {count.format(inGroup(id).length)}
                  </span>
                </button>
              ),
            )}
          </div>
          {filterScroll.canScrollForward && (
            <OverflowArrow
              direction="forward"
              onPress={() => filterScroll.scrollBy(1)}
            />
          )}
        </div>
      </div>

      <p className="gaming-profiles__intro">
        <MenuIcon name="info" />
        <span>{t('gaming.profiles.intro')}</span>
      </p>

      {showsYours && (
        <section className="gaming-profiles__section">
          <h3 className="gaming-cap">{t('gaming.profiles.yours')}</h3>
          {yoursFound.length === 0 ? (
            <div className="gaming-profiles__empty">
              <span className="gaming-profile__glyph">
                <GamingProfileGlyph glyph="yours" />
              </span>
              <p>{t('gaming.profiles.yoursEmpty')}</p>
            </div>
          ) : (
            grid(yoursFound, true)
          )}
        </section>
      )}

      {groupsShown.map((group) => (
        <section key={group} className="gaming-profiles__section">
          <h3 className="gaming-cap">
            {t('gaming.profiles.readyGroup', {
              group: t(GAMING_GROUP_LABEL_KEYS[group]),
            })}
          </h3>
          {grid(inGroup(group))}
        </section>
      ))}

      {nothing && (
        <div className="gaming-profiles__empty is-search">
          <p>{t('gaming.profiles.noMatch', { query: query.trim() })}</p>
          <button
            type="button"
            className="button small subtle"
            onClick={() => setQuery('')}
          >
            {t('gaming.profiles.searchClear')}
          </button>
        </div>
      )}

      {renaming && (
        <DspPresetSaveDialog
          existing={[]}
          titleKey="gaming.profiles.renameTitle"
          hintKey="gaming.profiles.renameHint"
          placeholderKey="gaming.saveDialog.placeholder"
          nameMax={GAMING_PROFILE_NAME_MAX}
          onSave={(name) => {
            const { id } = renaming;
            setRenaming(undefined);
            renameGamingProfile(id, name)
              .then(() => sayGamingProfilesChanged())
              .catch(fail);
          }}
          onClose={() => setRenaming(undefined)}
        />
      )}
    </div>
  );
};

export default GamingProfilesView;
