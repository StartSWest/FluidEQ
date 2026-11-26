/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A song playing on a linked computer sets this computer's song and album
 * sounds, as the same song playing here would (Ivan, 2026-11-25: "it's to
 * set the preset — sending song and album over the network").
 *
 * The sender tells only what a now-playing shows — title, artist, and a
 * Library song's album tags — and the listener builds its own identity from
 * them (`remoteSongIdentity`), which goes through the one Auto EQ path every
 * other player goes through. Main's lookup is `songSoundIpc.test.ts`; how
 * the message travels is `remoteAudioLanProtocol.test.ts` and
 * `sharedSongNowPlaying.test.tsx`.
 */

import { FilterTypeEnum } from 'common/constants';
import { remoteLibrarySongOf } from 'common/remoteAudio';
import type { ISongSound } from 'common/songSound';
import {
  buildSongIdentity,
  type ISongIdentity,
  libraryTrackIdentity,
  remoteSongIdentity,
} from 'common/songIdentity';
import {
  albumKeyForSound,
  canKeepSongSound,
  takesAlbumSounds,
} from 'common/songSoundMemory';
import {
  getInitialSongSoundState,
  type ISongSoundState,
  reduceSongSound,
  type TSongSoundEffect,
  type TSongSoundEvent,
} from 'common/songSoundRecorder';

const mustBe = (identity: ISongIdentity | undefined): ISongIdentity => {
  if (!identity) {
    throw new Error('the fixture names no song');
  }
  return identity;
};

/** Blue in Green, a file in THIS computer's Library. */
const ourTrack = mustBe(
  libraryTrackIdentity({
    id: 'our-track',
    title: 'Blue in Green',
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    albumArtist: 'Miles Davis',
    kind: 'audio',
  }),
);

describe('what a Library track tells a linked computer', () => {
  it('is its album and album artist, trimmed, and nothing else', () => {
    expect(
      remoteLibrarySongOf({
        album: '  Kind of Blue ',
        albumArtist: ' Miles Davis',
        kind: 'audio',
      }),
    ).toEqual({ album: 'Kind of Blue', albumArtist: 'Miles Davis' });
  });

  it('is a Library song with no album where the file has none', () => {
    expect(remoteLibrarySongOf({ kind: 'audio' })).toEqual({});
    // An album artist means nothing without the album it is the artist of.
    expect(
      remoteLibrarySongOf({ albumArtist: 'Miles', kind: 'audio' }),
    ).toEqual({});
  });

  it('never tells a folder name taken for an album before the tags are read', () => {
    expect(
      remoteLibrarySongOf({
        album: 'Downloads',
        kind: 'audio',
        isPending: true,
      }),
    ).toEqual({});
  });

  it('is nothing at all for a film, which never plays a song’s sound', () => {
    expect(
      remoteLibrarySongOf({ album: 'Trailers', kind: 'video' }),
    ).toBeUndefined();
  });

  it('bounds every tag to what the listener accepts', () => {
    const told = remoteLibrarySongOf({
      album: 'a'.repeat(300),
      albumArtist: 'b'.repeat(300),
      kind: 'audio',
    });
    expect(told?.album).toHaveLength(256);
    expect(told?.albumArtist).toHaveLength(256);
  });
});

describe('the song as the listener knows it', () => {
  const shared = mustBe(
    remoteSongIdentity('OFFICE-PC', {
      title: 'Blue in Green',
      artist: 'Miles Davis',
      library: { album: 'Kind of Blue', albumArtist: 'Miles Davis' },
    }),
  );

  it('carries this Library’s own album key for the same album', () => {
    expect(shared.albumKey).toBe(ourTrack.albumKey);
    expect(shared.fromLinkedLibrary).toBe(true);
    expect(albumKeyForSound(shared)).toBe(ourTrack.albumKey);
  });

  it('takes album sounds as a Library song does, and no other player’s song', () => {
    expect(takesAlbumSounds(shared)).toBe(true);
    expect(takesAlbumSounds(ourTrack)).toBe(true);
    const spotify = mustBe(
      buildSongIdentity('system', 'Spotify.exe', 'Blue in Green', 'Miles'),
    );
    expect(takesAlbumSounds(spotify)).toBe(false);
    expect(
      takesAlbumSounds(
        mustBe(remoteSongIdentity('OFFICE-PC', { title: 'Blue in Green' })),
      ),
    ).toBe(false);
  });

  it('finds the album by the track artist where no album artist is tagged', () => {
    const untagged = mustBe(
      libraryTrackIdentity({
        id: 'x',
        title: 'So What',
        artist: 'Miles Davis',
        album: 'Kind of Blue',
        kind: 'audio',
      }),
    );
    const arriving = remoteSongIdentity('OFFICE-PC', {
      title: 'So What',
      artist: 'Miles Davis',
      library: { album: 'Kind of Blue' },
    });
    expect(arriving?.albumKey).toBe(untagged.albumKey);
  });

  it('files a compilation under its album artist, as this Library does', () => {
    const ours = mustBe(
      libraryTrackIdentity({
        id: 'comp',
        title: 'Take Five',
        artist: 'Dave Brubeck',
        album: 'Jazz Classics',
        albumArtist: 'Various Artists',
        kind: 'audio',
      }),
    );
    const arriving = remoteSongIdentity('OFFICE-PC', {
      title: 'Take Five',
      artist: 'Dave Brubeck',
      library: { album: 'Jazz Classics', albumArtist: 'Various Artists' },
    });
    expect(arriving?.albumKey).toBe(ours.albumKey);
    // Control: filed by the track artist it would be another album.
    expect(
      remoteSongIdentity('OFFICE-PC', {
        title: 'Take Five',
        artist: 'Dave Brubeck',
        library: { album: 'Jazz Classics' },
      })?.albumKey,
    ).not.toBe(ours.albumKey);
  });

  it('is the same song by name as this Library’s, so its song sound is found', () => {
    expect(shared.alias).toBe(ourTrack.alias);
    expect(shared.source).toBe('remote');
  });

  it('is the remote song it always was where the sender sends no Library tags', () => {
    // A FluidEQ from before 2.6, or a player over there that is not its
    // Library: exactly the identity the listener built before.
    const plain = remoteSongIdentity('OFFICE-PC', {
      title: 'Blue in Green',
      artist: 'Miles Davis',
    });
    expect(plain).toEqual(
      buildSongIdentity('remote', 'OFFICE-PC', 'Blue in Green', 'Miles Davis'),
    );
    expect(plain?.albumKey).toBeUndefined();
    expect(plain && albumKeyForSound(plain)).toBeUndefined();
    // And an album key without the word is not an album to look up.
    expect(
      albumKeyForSound({ ...mustBe(plain), albumKey: ourTrack.albumKey }),
    ).toBeUndefined();
  });

  it('tells apart two songs of one name, by album and by player', () => {
    const live = remoteSongIdentity('OFFICE-PC', {
      title: 'Blue in Green',
      artist: 'Miles Davis',
      library: { album: 'Live at the Plugged Nickel' },
    });
    expect(live?.key).not.toBe(shared.key);
    expect(live?.alias).toBe(shared.alias);
    // And the same song from the Library over there, then from another
    // player there: Auto EQ asks again, so the Library's answer does not stay.
    const noAlbum = remoteSongIdentity('OFFICE-PC', {
      title: 'Blue in Green',
      artist: 'Miles Davis',
      library: {},
    });
    const elsewhere = remoteSongIdentity('OFFICE-PC', {
      title: 'Blue in Green',
      artist: 'Miles Davis',
    });
    expect(noAlbum?.key).not.toBe(elsewhere?.key);
    expect(noAlbum?.alias).toBe(elsewhere?.alias);
  });

  it('keeps a Library song with no artist, as this Library does', () => {
    const noArtist = mustBe(
      remoteSongIdentity('OFFICE-PC', {
        title: 'Untitled demo',
        library: { album: 'Demos' },
      }),
    );
    expect(noArtist.alias).toBeUndefined();
    expect(canKeepSongSound(noArtist)).toBe(true);
    // Control: the same from a player over there is a page, not a song.
    expect(
      canKeepSongSound(
        mustBe(remoteSongIdentity('OFFICE-PC', { title: 'Untitled demo' })),
      ),
    ).toBe(false);
  });
});

describe('Auto EQ on the listener while a shared song plays', () => {
  const sound = (presetId: string, gain = 0): ISongSound => ({
    presetId,
    filters: {
      band: {
        id: 'band',
        frequency: 1000,
        gain,
        quality: 1,
        type: FilterTypeEnum.PK,
      },
    },
  });
  const own = sound('mine', 3);
  const shared = mustBe(
    remoteSongIdentity('OFFICE-PC', {
      title: 'Blue in Green',
      artist: 'Miles Davis',
      library: { album: 'Kind of Blue', albumArtist: 'Miles Davis' },
    }),
  );
  /** Kind of Blue set to the Jazz preset in this computer's Library. */
  const kindOfBlue = { sound: { presetId: 'jazz' }, title: 'Kind of Blue' };

  const run = (
    state: ISongSoundState,
    steps: Array<[number, TSongSoundEvent]>,
  ): { state: ISongSoundState; effects: TSongSoundEffect[] } => {
    let current = state;
    const effects: TSongSoundEffect[] = [];
    steps.forEach(([now, event]) => {
      const [next, produced] = reduceSongSound(current, event, now);
      current = next;
      effects.push(...produced);
    });
    return { state: current, effects };
  };
  const applies = (effects: TSongSoundEffect[]) =>
    effects.filter((effect) => effect.kind === 'apply');

  /** The shared song arrives and main answers with the album's sound. */
  const albumPlaying = () => {
    const asked = run(
      {
        ...getInitialSongSoundState({ songs: true, albums: true }),
        deviceId: 'main',
        live: own,
      },
      [[0, { kind: 'nowPlaying', identity: shared, isPlaying: true }]],
    );
    const answered = run(asked.state, [
      [1, { kind: 'matched', identity: shared, album: kindOfBlue }],
    ]);
    return { asked, answered };
  };

  it('asks main about the song with its album, and puts the album’s preset on', () => {
    const { asked, answered } = albumPlaying();
    expect(asked.effects).toContainEqual({ kind: 'lookup', identity: shared });
    expect(applies(answered.effects)).toEqual([
      {
        kind: 'apply',
        sound: { ...own, presetId: 'jazz' },
        isLent: true,
        presetOnly: true,
      },
    ]);
    expect(answered.state.session?.owner).toBe('album');
  });

  it('hands the listener’s own sound back the moment the shared song is gone', () => {
    const { answered } = albumPlaying();
    const { pending } = answered.state;
    if (!pending) {
      throw new Error('the album’s sound was not put on');
    }
    // The stream ended, the link paused or dropped, or the sender's bar
    // emptied: the remote source is cleared and nothing is named.
    const ended = run(answered.state, [
      [2, { kind: 'applied', asked: pending, landed: pending }],
      [3, { kind: 'nowPlaying', identity: undefined, isPlaying: false }],
    ]);
    expect(applies(ended.effects)).toEqual([
      { kind: 'apply', sound: own, isLent: false },
    ]);
    expect(ended.state.session).toBeUndefined();
  });

  it('control: with the album part off, the same answer puts nothing on', () => {
    const asked = run(
      {
        ...getInitialSongSoundState({ songs: true, albums: false }),
        deviceId: 'main',
        live: own,
      },
      [
        [0, { kind: 'nowPlaying', identity: shared, isPlaying: true }],
        [1, { kind: 'matched', identity: shared, album: kindOfBlue }],
      ],
    );
    expect(applies(asked.effects)).toEqual([]);
  });

  it('drops an answer about the song before when the sender has moved on', () => {
    const next = mustBe(
      remoteSongIdentity('OFFICE-PC', {
        title: 'So What',
        artist: 'Miles Davis',
        library: { album: 'Some Other Album' },
      }),
    );
    const moved = run(
      {
        ...getInitialSongSoundState({ songs: true, albums: true }),
        deviceId: 'main',
        live: own,
      },
      [
        [0, { kind: 'nowPlaying', identity: shared, isPlaying: true }],
        [1, { kind: 'nowPlaying', identity: next, isPlaying: true }],
        // Main's answer for the first song lands after the second began.
        [2, { kind: 'matched', identity: shared, album: kindOfBlue }],
      ],
    );
    expect(applies(moved.effects)).toEqual([]);
    expect(moved.state.session?.identity.key).toBe(next.key);
  });
});
