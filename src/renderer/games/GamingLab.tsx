/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import ListenedLatency from '../components/ListenedLatency';
import GamingAddDialog from './GamingAddDialog';
import GamingGames from './GamingGames';
import GamingLabHead, { TGamingLabView } from './GamingLabHead';
import GamingNowPlaying from './GamingNowPlaying';
import GamingProfilesView from './GamingProfilesView';
import { setGamesEnabled } from './gameProfiles';
import { useGameSound } from './useGameSound';

/**
 * The Gaming Lab: the listener's games, each with a sound of its own copied
 * from a Gaming profile and tuned here, in one place (Ivan, 2026-11-02:
 * "we cannot be jumping back and forth from gaming and DSP to tune").
 *
 * Two views over one subject: the games, and the profiles their copies start
 * from. Adding a game is the same act from either, so the dialog belongs to
 * the page; the profiles view opens it with the profile already chosen.
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

  return (
    <div className="gaming-lab">
      <GamingLabHead
        view={view}
        onView={setView}
        isOn={enabled}
        onToggle={() => setGamesEnabled(!enabled)}
        onAdd={() => setAdding({})}
        gameMode={<ListenedLatency />}
        nowPlaying={
          sounding && (
            <GamingNowPlaying
              game={sounding}
              onShow={() => {
                setView('games');
                setSelected(sounding.id);
              }}
            />
          )
        }
      />

      {view === 'games' ? (
        <GamingGames
          games={profiles}
          isOn={enabled}
          playingId={playing?.id}
          soundingId={sounding?.id}
          selectedId={selected}
          onSelect={setSelected}
          onAdd={() => setAdding({})}
        />
      ) : (
        <GamingProfilesView
          games={profiles}
          onUse={(profileId) => setAdding({ profileId })}
        />
      )}

      {adding && (
        <GamingAddDialog
          games={profiles}
          profileId={adding.profileId}
          onAdded={(id) => {
            setAdding(undefined);
            setSelected(id);
            setView('games');
          }}
          onClose={() => setAdding(undefined)}
        />
      )}
    </div>
  );
};

export default GamingLab;
