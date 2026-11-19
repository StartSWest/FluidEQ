/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import ListenedLatency from '../components/ListenedLatency';
import { useRailWidth } from '../library/LibraryRailSplitter';
import { useRailPinned } from '../widgets/StudioRail';
import GamingAddDialog from './GamingAddDialog';
import GamingGames, { GamingGameList, shownGame } from './GamingGames';
import GamingLabFrame from './GamingLabFrame';
import GamingLabHead, { TGamingLabView } from './GamingLabHead';
import GamingNowPlaying from './GamingNowPlaying';
import GamingProfilesView from './GamingProfilesView';
import { setGamesEnabled } from './gameProfiles';
import { GAMING_RAIL_PINNED_KEY, GAMING_RAIL_WIDTH_KEY } from './gamingRail';
import { useGameSound } from './useGameSound';

/**
 * The Gaming Lab: the listener's games, each with a sound of its own copied
 * from a Gaming profile and tuned here, in one place (Ivan, 2026-11-02:
 * "we cannot be jumping back and forth from gaming and DSP to tune").
 *
 * The games down the rail, and two views beside it: the chosen game's sound,
 * and the profiles their copies start from. A game picked in the rail opens
 * its sound from either view, as a shelf in the Library's rail does. Adding a
 * game is the same act from anywhere, so the dialog belongs to the page; the
 * profiles view opens it with the profile already chosen.
 */
const GamingLab = () => {
  // Watching while the page is open as well, so the list can say which game
  // is in front while one is being added or tuned.
  const { profiles, enabled, playing, sounding } = useGameSound({
    always: true,
  });
  const [view, setView] = useState<TGamingLabView>('games');
  const [adding, setAdding] = useState<{ profileId?: string } | undefined>();
  const [selected, setSelected] = useState<string | undefined>();
  const [isPinned, setPinned] = useRailPinned(GAMING_RAIL_PINNED_KEY);
  const railWidth = useRailWidth(GAMING_RAIL_WIDTH_KEY);
  const shown = shownGame(profiles, selected, playing?.id, sounding?.id);
  const showGame = (id: string) => {
    setSelected(id);
    setView('games');
  };

  return (
    <>
      <GamingLabFrame
        count={profiles.length}
        isOn={enabled}
        isPinned={isPinned}
        onPinned={setPinned}
        railWidth={railWidth}
        onAdd={() => setAdding({})}
        rows={
          <GamingGameList
            games={profiles}
            shownId={view === 'games' ? shown?.id : undefined}
            playingId={playing?.id}
            onSelect={showGame}
          />
        }
        head={
          <GamingLabHead
            view={view}
            onView={setView}
            isOn={enabled}
            onToggle={() => setGamesEnabled(!enabled)}
            gameMode={<ListenedLatency />}
            nowPlaying={
              sounding && (
                <GamingNowPlaying
                  game={sounding}
                  onShow={() => showGame(sounding.id)}
                />
              )
            }
          />
        }
      >
        {view === 'games' ? (
          <GamingGames
            shown={shown}
            playingId={playing?.id}
            onAdd={() => setAdding({})}
          />
        ) : (
          <GamingProfilesView
            games={profiles}
            onUse={(profileId) => setAdding({ profileId })}
          />
        )}
      </GamingLabFrame>

      {adding && (
        <GamingAddDialog
          games={profiles}
          profileId={adding.profileId}
          onAdded={(id) => {
            setAdding(undefined);
            showGame(id);
          }}
          onClose={() => setAdding(undefined)}
        />
      )}
    </>
  );
};

export default GamingLab;
