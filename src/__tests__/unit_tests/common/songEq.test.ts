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

import { FilterTypeEnum, ISmartEqSettings } from 'common/constants';
import { buildSongIdentity, ISongIdentity } from 'common/songIdentity';
import {
  SONG_EQ_MAX_ENTRIES,
  checkpointSongEq,
  commitSongEq,
  forgetSongEq,
  getDefaultSongEqSettings,
  lookupSongEq,
  stripSongEqLayer,
} from 'common/songEq';

const DEVICE = 'device-a';

const layerOf = (gain: number): ISmartEqSettings => ({
  filters: {
    'smart-1000': {
      id: 'smart-1000',
      frequency: 1000,
      gain,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    },
  },
});

const identityOf = (title: string, artist?: string): ISongIdentity => {
  const identity = buildSongIdentity('library', title, title, artist);
  if (!identity) {
    throw new Error('test fixture produced no identity');
  }
  return identity;
};

const mustBuild = (result: ISongIdentity | undefined): ISongIdentity => {
  if (!result) {
    throw new Error('buildSongIdentity returned undefined');
  }
  return result;
};

const mustAlias = (identity: ISongIdentity): string => {
  if (!identity.alias) {
    throw new Error('test fixture produced no alias');
  }
  return identity.alias;
};

/**
 * A third `Black Dog` that owns neither of the two keys the alias tests save
 * under, so the only way it can resolve at all is through the alias index.
 */
const aliasOnlyTwin = (): ISongIdentity =>
  mustBuild(
    buildSongIdentity('system', 'VLC.exe', 'Black Dog', 'Led Zeppelin'),
  );

describe('songEq store', () => {
  it('finds nothing in an empty store', () => {
    expect(
      lookupSongEq(getDefaultSongEqSettings(), DEVICE, identityOf('Song')),
    ).toBeUndefined();
  });

  it('finds by exact key what commit put there', () => {
    // The positive control for the empty-store test above.
    const identity = identityOf('Song', 'Artist');
    const saved = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      identity,
      layerOf(3),
      1000,
    );
    expect(lookupSongEq(saved, DEVICE, identity)?.plays).toBe(1);
  });

  it('finds by alias what a different source saved', () => {
    const fromLibrary = identityOf('Black Dog', 'Led Zeppelin');
    const saved = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      fromLibrary,
      layerOf(3),
      1000,
    );
    const fromSpotify = buildSongIdentity(
      'system',
      'Spotify.exe',
      'Black Dog (Official Video)',
      'Led Zeppelin',
    );
    expect(fromSpotify).toBeDefined();
    expect(lookupSongEq(saved, DEVICE, mustBuild(fromSpotify))?.title).toBe(
      'Black Dog',
    );
  });

  it('keeps outputs apart', () => {
    // A correction measured on headphones says nothing about speakers.
    const identity = identityOf('Song', 'Artist');
    const saved = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      identity,
      layerOf(3),
      1000,
    );
    expect(lookupSongEq(saved, 'device-b', identity)).toBeUndefined();
  });

  it('counts a play on commit and not on checkpoint', () => {
    const identity = identityOf('Song', 'Artist');
    let store = checkpointSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      identity,
      layerOf(3),
      1000,
    );
    expect(lookupSongEq(store, DEVICE, identity)?.plays).toBe(0);
    store = commitSongEq(store, DEVICE, identity, layerOf(4), 2000);
    expect(lookupSongEq(store, DEVICE, identity)?.plays).toBe(1);
    store = checkpointSongEq(store, DEVICE, identity, layerOf(5), 3000);
    expect(lookupSongEq(store, DEVICE, identity)?.plays).toBe(1);
    expect(lookupSongEq(store, DEVICE, identity)?.updatedAt).toBe(3000);
  });

  it('strips apoOverride before storing', () => {
    // That field is a config file somebody hand-edited through Equalizer APO.
    // It belongs to that moment on that output, and replaying it onto another
    // song would write a manual edit into a track that never had one.
    const identity = identityOf('Song', 'Artist');
    const withOverride: ISmartEqSettings = {
      ...layerOf(3),
      apoOverride: { filters: {} },
    };
    const store = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      identity,
      withOverride,
      1000,
    );
    expect(
      lookupSongEq(store, DEVICE, identity)?.settings.apoOverride,
    ).toBeUndefined();
    expect(stripSongEqLayer(withOverride).apoOverride).toBeUndefined();
    // Positive control: the rest of the layer survived the strip.
    expect(stripSongEqLayer(withOverride).filters['smart-1000'].gain).toBe(3);
  });

  it('evicts the least recently saved at the cap', () => {
    let store = getDefaultSongEqSettings();
    for (let index = 0; index < SONG_EQ_MAX_ENTRIES; index += 1) {
      store = commitSongEq(
        store,
        DEVICE,
        identityOf(`Song ${index}`, 'Artist'),
        layerOf(1),
        1000 + index,
      );
    }
    expect(Object.keys(store.outputs[DEVICE].entries)).toHaveLength(
      SONG_EQ_MAX_ENTRIES,
    );
    const oldest = identityOf('Song 0', 'Artist');
    store = commitSongEq(
      store,
      DEVICE,
      identityOf('One more', 'Artist'),
      layerOf(1),
      999_999,
    );
    expect(Object.keys(store.outputs[DEVICE].entries)).toHaveLength(
      SONG_EQ_MAX_ENTRIES,
    );
    expect(lookupSongEq(store, DEVICE, oldest)).toBeUndefined();
    // Positive control: the newest survived, so eviction removed one entry
    // rather than emptying the output.
    expect(
      lookupSongEq(store, DEVICE, identityOf('One more', 'Artist')),
    ).toBeDefined();
  });

  it('drops an evicted entry alias with it', () => {
    let store = getDefaultSongEqSettings();
    for (let index = 0; index < SONG_EQ_MAX_ENTRIES + 1; index += 1) {
      store = commitSongEq(
        store,
        DEVICE,
        identityOf(`Song ${index}`, 'Artist'),
        layerOf(1),
        1000 + index,
      );
    }
    expect(Object.keys(store.outputs[DEVICE].aliases)).toHaveLength(
      SONG_EQ_MAX_ENTRIES,
    );
  });

  it('forgets an entry and the alias that points at it', () => {
    const identity = identityOf('Song', 'Artist');
    const saved = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      identity,
      layerOf(3),
      1000,
    );
    const forgotten = forgetSongEq(saved, DEVICE, identity);
    expect(lookupSongEq(forgotten, DEVICE, identity)).toBeUndefined();
    expect(Object.keys(forgotten.outputs[DEVICE].aliases)).toHaveLength(0);
  });

  /**
   * The cross-source Forget the alias index exists to create, and the one it
   * used to fail silently.
   *
   * Fails if `forgetSongEq` resolves `identity.key` alone instead of going
   * through `resolveSongEqKey`: the system key was never in `entries`, so the
   * store came back untouched, main replied success and the library entry was
   * still on disk for the next play.
   */
  it('forgets a library entry reached from another source through its alias', () => {
    const fromLibrary = identityOf('Black Dog', 'Led Zeppelin');
    const fromSpotify = mustBuild(
      buildSongIdentity(
        'system',
        'Spotify.exe',
        'Black Dog (Official Video)',
        'Led Zeppelin',
      ),
    );
    // Neither key is the other's, and the match can only have come by alias.
    expect(fromSpotify.key).not.toBe(fromLibrary.key);
    expect(fromSpotify.alias).toBe(fromLibrary.alias);

    let store = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      fromLibrary,
      layerOf(3),
      1000,
    );
    // Positive control: the curve really is reachable from the other source
    // before Forget is asked to remove it.
    expect(lookupSongEq(store, DEVICE, fromSpotify)).toBeDefined();

    store = forgetSongEq(store, DEVICE, fromSpotify);
    expect(lookupSongEq(store, DEVICE, fromSpotify)).toBeUndefined();
    expect(lookupSongEq(store, DEVICE, fromLibrary)).toBeUndefined();
    expect(store.outputs[DEVICE].entries[fromLibrary.key]).toBeUndefined();
  });

  it('prefers the exact key over an alias that points somewhere else', () => {
    // Spec §7: "Lookup tries the exact key first and always, so your own file
    // beats an alias that drifted to a YouTube rip of the same song." Fails if
    // the two branches in `resolveSongEqKey` are swapped — the rip's gain of 9
    // would come back for the library file's own identity.
    const fromLibrary = identityOf('Black Dog', 'Led Zeppelin');
    const rip = mustBuild(
      buildSongIdentity(
        'media',
        'https://example.test/watch?v=rip',
        'Black Dog',
        'Led Zeppelin',
      ),
    );
    let store = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      fromLibrary,
      layerOf(3),
      1000,
    );
    // Saved last, so the alias now points at the rip rather than at the file.
    store = commitSongEq(store, DEVICE, rip, layerOf(9), 2000);
    expect(store.outputs[DEVICE].aliases[mustAlias(fromLibrary)]).toBe(rip.key);

    expect(
      lookupSongEq(store, DEVICE, fromLibrary)?.settings.filters['smart-1000']
        .gain,
    ).toBe(3);
    // Positive control: the alias itself does resolve, for an identity that
    // has no entry of its own.
    expect(
      lookupSongEq(store, DEVICE, aliasOnlyTwin())?.settings.filters[
        'smart-1000'
      ].gain,
    ).toBe(9);
  });

  it('leaves an alias alone when it has moved on to another key', () => {
    // Last save wins the alias. Forgetting the key that no longer owns it must
    // not take the live entry's alias away with it.
    //
    // Asserting the alias INDEX, not just that the live entry is still
    // findable: the entry was reachable by its own exact key regardless, so
    // this test passed against a `forgetSongEq` that emptied every alias.
    const first = identityOf('Black Dog', 'Led Zeppelin');
    const second = mustBuild(
      buildSongIdentity(
        'media',
        'https://example.test/watch',
        'Black Dog',
        'Led Zeppelin',
      ),
    );
    const alias = mustAlias(first);
    let store = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      first,
      layerOf(3),
      1000,
    );
    store = commitSongEq(store, DEVICE, second, layerOf(4), 2000);
    store = forgetSongEq(store, DEVICE, first);

    expect(lookupSongEq(store, DEVICE, second)).toBeDefined();
    expect(store.outputs[DEVICE].aliases[alias]).toBe(second.key);
    // And the alias path still resolves, from a third identity that owns
    // neither key — the thing the exact-key assertion above cannot see.
    expect(lookupSongEq(store, DEVICE, aliasOnlyTwin())?.title).toBe(
      'Black Dog',
    );
  });

  it('does not mutate the store it was given', () => {
    const before = getDefaultSongEqSettings();
    commitSongEq(
      before,
      DEVICE,
      identityOf('Song', 'Artist'),
      layerOf(3),
      1000,
    );
    expect(before.outputs[DEVICE]).toBeUndefined();
  });
});
