/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The register of players, and which of them counts as "the last thing".
 *
 * The bar on a tab that is not a player is whatever was last listened to:
 * the owner the bar last showed playing, whoever that was — one of this
 * app's players, the machine's own, another computer's. A player that only
 * describes itself does not take it. A song of the listener's own stays
 * after its player has gone, so the bar can keep showing it until something
 * new plays; anything that played outside leaves with its player, and
 * nothing of it is written down (Ivan, 2026-10-26).
 */

import { act, renderHook } from '@testing-library/react';
import { buildSongIdentity } from 'common/songIdentity';
import type * as LastShownModule from '../../../renderer/audio/lastShown';
import { useLastShown } from '../../../renderer/audio/lastShown';
import {
  claimPlayback,
  releasePlayback,
  resetPlaybackOwner,
} from '../../../renderer/audio/playbackOwner';
import {
  clearTransportSource,
  readRememberedTransportOwner,
  resetTransportSource,
  setTransportSource,
  useLastPlayingOwner,
  useLastTransportOwner,
  useTransportSources,
} from '../../../renderer/audio/transportSource';
import type { ITransportSource } from '../../../renderer/audio/transportSource';
import type { TPlaybackOwner } from '../../../renderer/audio/playbackOwner';

const source = (
  owner: TPlaybackOwner,
  isPlaying = false,
): ITransportSource => ({
  owner,
  title: `${owner} title`,
  isPlaying,
  positionMs: 0,
  durationMs: 1000,
  toggle: () => {},
});

/**
 * One of this app's players starting: it claims playback, as each of them
 * does from its own `play` event, and then describes itself as playing.
 */
const appPlays = (next: ITransportSource) => {
  act(() => {
    claimPlayback(next.owner);
    setTransportSource({ ...next, isPlaying: true });
  });
};

/** And pausing: it gives playback up and says so. */
const appPauses = (next: ITransportSource) => {
  act(() => {
    releasePlayback(next.owner);
    setTransportSource({ ...next, isPlaying: false });
  });
};

/**
 * Sound from outside the listener's own files taking the bar: a Media page
 * claims playback as the app's own players do, while another program and
 * another computer take it by saying they are playing.
 */
const outsidePlays = (owner: TPlaybackOwner, title = `${owner} title`) => {
  const next = { ...source(owner), title };
  if (owner === 'media') {
    appPlays(next);
    return;
  }
  act(() => setTransportSource({ ...next, isPlaying: true }));
};

const librarySongA = buildSongIdentity('library', 'a', 'Song A');
const librarySongB = buildSongIdentity('library', 'b', 'Song B');
const spotifySong = buildSongIdentity('system', 'Spotify.exe', 'Song B');
if (!librarySongA || !librarySongB || !spotifySong) {
  throw new Error('test fixtures produced no identity');
}

/** `source` above, with a song attached — what `lastPlayingOwner` actually
 * reads to decide whether a pause is still on the same track. */
const playing = (
  owner: TPlaybackOwner,
  isPlaying: boolean,
  identity: NonNullable<ITransportSource['identity']>,
): ITransportSource => ({ ...source(owner, isPlaying), identity });

beforeEach(() => {
  resetPlaybackOwner();
  resetTransportSource();
});

afterEach(() => {
  act(() => {
    resetPlaybackOwner();
    resetTransportSource();
  });
});

describe('the register of players', () => {
  it('remembers whose sound the bar last showed playing', () => {
    const { result } = renderHook(() => useLastTransportOwner());

    appPlays(source('library'));
    appPlays(source('karaoke'));

    expect(result.current).toBe('karaoke');
  });

  it('does not hand the last thing to a player that only describes itself', () => {
    // The Media tab loading a page, Karaoke opening a session: neither is
    // somebody listening to something, and neither may take the bar from the
    // song that was paused a moment ago.
    const { result } = renderHook(() => useLastTransportOwner());

    appPlays(source('library'));
    appPauses(source('library'));
    act(() => setTransportSource(source('media')));
    act(() => setTransportSource(source('karaoke')));

    expect(result.current).toBe('library');
  });

  it('lets the machine’s own player be the last thing once the bar showed it playing', () => {
    const { result } = renderHook(() => useLastTransportOwner());

    appPlays(source('library'));
    appPauses(source('library'));
    // A browser tab starts with nothing of this app's playing, takes the bar
    // by playing, and then stops. It is what was listened to last.
    act(() => setTransportSource(source('system', true)));
    act(() => setTransportSource(source('system', false)));

    expect(result.current).toBe('system');
  });

  it('keeps a browser tab playing under a library song from taking the last thing', () => {
    // With the one-player switch off, a browser tab can go on playing while
    // the bar shows the library song. The bar is the song's, so the last
    // thing is too — the tab saying it is playing on every reading must not
    // flip it back and forth.
    const { result } = renderHook(() => useLastTransportOwner());

    appPlays(source('library'));
    act(() => setTransportSource(source('system', true)));

    expect(result.current).toBe('library');
  });

  it('writes the last thing down when it is the listener’s own', () => {
    // What decides, at the next launch, which player comes back to restore
    // itself.
    appPlays(source('karaoke'));

    expect(readRememberedTransportOwner()).toBe('karaoke');
  });

  it.each<TPlaybackOwner>(['system', 'remote', 'media'])(
    'never writes down that %s sound was last, and keeps the listener’s own',
    (outside) => {
      // The control is the case above: the same playing does write a name.
      const { result } = renderHook(() => useLastTransportOwner());
      appPlays(source('library'));
      appPauses(source('library'));
      outsidePlays(outside);
      // It did take the bar: what is asserted below is the storage alone.
      expect(result.current).toBe(outside);

      expect(readRememberedTransportOwner()).toBe('library');
      expect(window.localStorage.getItem('fluideq.transport.lastOwner')).toBe(
        'library',
      );
    },
  );

  it('hands the bar back to the listener’s own song when outside sound goes', () => {
    // A browser tab closed: the bar is what it was before the tab played,
    // not a name that indexes nothing.
    const { result } = renderHook(() => useLastTransportOwner());

    appPlays(source('library'));
    appPauses(source('library'));
    act(() => setTransportSource(source('system', true)));
    expect(result.current).toBe('system');

    act(() => clearTransportSource('system'));

    expect(result.current).toBe('library');
  });

  it('keeps only the name of outside sound that goes when nothing of the listener’s own played', () => {
    // The name indexes no player, so the bar reads "Nothing playing" rather
    // than leaving the foot of the window; and nothing of it is stored.
    const { result } = renderHook(() => ({
      last: useLastTransportOwner(),
      shown: useLastShown(),
    }));

    act(() => setTransportSource(source('remote', true)));
    act(() => clearTransportSource('remote'));

    expect(result.current.last).toBe('remote');
    expect(result.current.shown).toBeUndefined();
    expect(readRememberedTransportOwner()).toBeUndefined();
  });

  it('forgets a player that has gone', () => {
    const { result } = renderHook(() => useTransportSources());

    act(() => setTransportSource(source('library')));
    act(() => clearTransportSource('library'));

    expect(result.current.library).toBeUndefined();
  });

  it('still remembers who that player was, so Stop leaves a bar behind', () => {
    // Stop empties the queue, which leaves no track to describe, which
    // withdraws the library's entry here. `lastOwner` used to be wiped along
    // with it — and the bar reads `lastOwner` as its proof that something has
    // ever played, the one thing separating a fresh install (no bar) from a
    // machine where music has been chosen. So a press of Stop took the whole
    // foot of the window away instead of leaving the bar behind.
    //
    // The entry going and the memory of it going are two different things:
    // the first is asserted above, and `pickTransportOwner` reads this only
    // to index the register, so a name outliving its entry can never put a
    // live bar on screen for a player that is gone.
    const { result } = renderHook(() => ({
      last: useLastTransportOwner(),
      sources: useTransportSources(),
    }));

    appPlays(source('library'));
    act(() => clearTransportSource('library'));

    expect(result.current.sources.library).toBeUndefined();
    expect(result.current.last).toBe('library');
  });

  it('remembers who last actually played, across their own pause', () => {
    const { result } = renderHook(() => useLastPlayingOwner());

    act(() => setTransportSource(playing('library', true, librarySongA)));
    act(() => setTransportSource(playing('library', false, librarySongA)));

    expect(result.current).toBe('library');
  });

  it('does not let a player who has since been superseded stay "last playing" forever', () => {
    // The bug this guards: an ownership-release tracker only updates when
    // its OWN owner releases, so a library track paused once resolved every
    // later Spotify pause to the same stale library song forever, because
    // `system` never participates in that ownership scheme at all. Tracking
    // "who last reported isPlaying: true" instead means anyone starting to
    // play — `system` included — overwrites the previous answer on its own.
    const { result } = renderHook(() => useLastPlayingOwner());

    act(() => setTransportSource(playing('library', true, librarySongA)));
    act(() => setTransportSource(playing('library', false, librarySongA)));
    expect(result.current).toBe('library');

    act(() => setTransportSource(playing('system', true, spotifySong)));
    act(() => setTransportSource(playing('system', false, spotifySong)));

    expect(result.current).toBe('system');
  });

  it('drops a player once it cues something else without playing it', () => {
    // The same-track guard: describing a newly cued track while paused is
    // not "still paused on the song that was playing", and reporting it as
    // such would leak a stale identity into whatever reads this.
    const { result } = renderHook(() => useLastPlayingOwner());

    act(() => setTransportSource(playing('library', true, librarySongA)));
    act(() => setTransportSource(playing('library', false, librarySongA)));
    expect(result.current).toBe('library');

    act(() => setTransportSource(playing('library', false, librarySongB)));

    expect(result.current).toBeUndefined();
  });

  it('forgets who last played once that player is gone entirely', () => {
    const { result } = renderHook(() => useLastPlayingOwner());

    act(() => setTransportSource(playing('library', true, librarySongA)));
    act(() => setTransportSource(playing('library', false, librarySongA)));
    act(() => clearTransportSource('library'));

    expect(result.current).toBeUndefined();
  });
});

/**
 * What a freshly loaded window reads: a new copy of the module, starting from
 * storage alone. Its hook is read with React's store subscription standing
 * aside, because a component of this copy's own React would be a second
 * React the test renderer has never heard of.
 */
const reloaded = (): {
  shown: LastShownModule.ILastShown | undefined;
  owner: TPlaybackOwner | undefined;
} => {
  let freshShown: typeof LastShownModule | undefined;
  let freshTransport:
    typeof import('../../../renderer/audio/transportSource') | undefined;
  jest.isolateModules(() => {
    jest.doMock('react', () => ({
      useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) =>
        getSnapshot(),
    }));
    // eslint-disable-next-line global-require -- a fresh copy of the module is what a reload is
    freshTransport = require('../../../renderer/audio/transportSource');
    // eslint-disable-next-line global-require -- the copy the one above loaded
    freshShown = require('../../../renderer/audio/lastShown');
  });
  jest.dontMock('react');
  if (freshShown === undefined || freshTransport === undefined) {
    throw new Error('the reloaded modules did not load');
  }
  return {
    shown: freshShown.useLastShown(),
    owner: freshTransport.useLastTransportOwner(),
  };
};

/**
 * "Nothing playing" never replaces a song of the listener's own: after Stop
 * or a reload, the bar goes on saying what played last until something new
 * plays. What played outside — a browser tab, another computer, a Media page
 * — is never kept to be said, in memory or in storage, once its player goes.
 */
describe('what the bar last showed playing', () => {
  const song: ITransportSource = {
    ...source('library'),
    title: 'Blue in Green',
    subtitle: 'Miles Davis',
    artworkUrl: 'fluideq-media://art/cover-1',
  };

  it('keeps its words and picture once the player that showed it has gone', () => {
    const { result } = renderHook(() => useLastShown());

    appPlays(song);
    act(() => clearTransportSource('library'));

    expect(result.current).toEqual({
      owner: 'library',
      title: 'Blue in Green',
      subtitle: 'Miles Davis',
      artworkUrl: 'fluideq-media://art/cover-1',
    });
  });

  it.each<TPlaybackOwner>(['system', 'remote', 'media'])(
    'keeps nothing of %s sound once its player has gone',
    (outside) => {
      // The case Ivan reported: a browser tab closed, and its title stayed on
      // the bar. The test above is the control — the same withdrawal keeps
      // a song of the listener's own.
      const { result } = renderHook(() => useLastShown());

      outsidePlays(outside, 'A private title');
      act(() => clearTransportSource(outside));

      expect(result.current).toBeUndefined();
    },
  );

  it('does not let outside sound take the place of the listener’s own song', () => {
    const { result } = renderHook(() => useLastShown());

    appPlays(song);
    appPauses(song);
    outsidePlays('system', 'A private title');
    act(() => clearTransportSource('system'));

    expect(result.current?.title).toBe('Blue in Green');
  });

  it('writes nothing that played outside to storage, while it plays or after', () => {
    // Every value the window keeps, not one key: the words must be nowhere.
    const everythingStored = () => {
      const values: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        values.push(
          `${key}=${key === null ? '' : window.localStorage.getItem(key)}`,
        );
      }
      return values.join('\n');
    };

    // The control: the listener's own song is written down.
    appPlays(song);
    expect(everythingStored()).toContain('Blue in Green');

    (['system', 'remote', 'media'] as const).forEach((outside) => {
      const described = {
        ...source(outside),
        title: 'A private title',
        subtitle: 'A private channel',
        artworkUrl: 'data:image/png;base64,cHJpdmF0ZQ==',
        origin: 'Den PC',
      };
      if (outside === 'media') {
        appPlays(described);
      } else {
        act(() => setTransportSource({ ...described, isPlaying: true }));
      }
      expect(everythingStored()).not.toMatch(/private|cHJpdmF0ZQ|Den PC/);
      act(() => clearTransportSource(outside));
    });

    expect(everythingStored()).not.toMatch(/private|cHJpdmF0ZQ|Den PC/);
  });

  it('is not replaced by a player that only describes itself', () => {
    const { result } = renderHook(() => useLastShown());

    appPlays(song);
    appPauses(song);
    act(() =>
      setTransportSource({ ...source('media'), title: 'A page, loaded' }),
    );

    expect(result.current?.title).toBe('Blue in Green');
  });

  it('is replaced by the next thing that plays', () => {
    // The control for the case above: the words do move, and on playing.
    const { result } = renderHook(() => useLastShown());

    appPlays(song);
    appPlays({ ...source('karaoke'), title: 'Warm-up' });

    expect(result.current).toEqual({ owner: 'karaoke', title: 'Warm-up' });
  });

  it('does not keep a picture that dies with the page that made it', () => {
    // A `blob:` URL belongs to the page that minted it; after a restart it
    // draws as a broken image where the generated tile would otherwise be.
    const { result } = renderHook(() => useLastShown());

    appPlays({ ...song, artworkUrl: 'blob:http://localhost/cover' });

    expect(result.current?.title).toBe('Blue in Green');
    expect(result.current?.artworkUrl).toBeUndefined();
  });

  it('is still there after the window reloads', () => {
    appPlays(song);
    act(() => clearTransportSource('library'));

    expect(reloaded()).toEqual({
      shown: {
        owner: 'library',
        title: 'Blue in Green',
        subtitle: 'Miles Davis',
        artworkUrl: 'fluideq-media://art/cover-1',
      },
      owner: 'library',
    });
  });

  it.each<TPlaybackOwner>(['system', 'remote', 'media'])(
    'is forgotten at launch when an older build kept %s sound there',
    (outside) => {
      // Builds before 2026-10-26 wrote what played outside here, and its
      // owner beside it. The test above is the control: a song of the
      // listener's own comes back with the window.
      window.localStorage.setItem(
        'fluideq.transport.lastShown',
        JSON.stringify({
          owner: outside,
          title: 'A private title',
          subtitle: 'A private channel',
          origin: 'Den PC',
        }),
      );
      window.localStorage.setItem('fluideq.transport.lastOwner', outside);

      expect(reloaded()).toEqual({ shown: undefined, owner: undefined });
      expect(
        window.localStorage.getItem('fluideq.transport.lastShown'),
      ).toBeNull();
      expect(
        window.localStorage.getItem('fluideq.transport.lastOwner'),
      ).toBeNull();
    },
  );
});
