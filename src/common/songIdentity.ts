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
 * What makes a song the same song when it comes back.
 *
 * The bar carries four different kinds of thing and none of them shared an id:
 * a library file has a path, a page in the Media tab has a URL, and another
 * program has only what Windows publishes about it. This gives each an exact
 * key in its own namespace, plus — for three of the four — a normalised alias
 * so that your own file and the same song on Spotify can find each other.
 *
 * Its own source union rather than `TPlaybackOwner`, deliberately. That type
 * lives in the renderer, and the main process reads identities out of the
 * store; importing across that line to save four words would put a renderer
 * module in main's bundle.
 */
export type TSongSource = 'library' | 'karaoke' | 'media' | 'system';

export interface ISongIdentity {
  /** Exact, source-scoped. Never collides across sources. */
  key: string;
  /** Normalised `title|artist`. Absent where an alias would be a lie. */
  alias?: string;
  title: string;
  artist?: string;
  source: TSongSource;
}

/**
 * The closed list of platform noise, and the reason it is closed.
 *
 * A general "strip anything in brackets" would merge `(Remastered 2011)` with
 * the original and `(Live at Wembley)` with the studio cut — two pairs that
 * measure differently in exactly the range the correction cares about, and the
 * merge would be silent. So only phrases that describe a *delivery* are
 * removed, never ones that describe a *recording*.
 */
const PLATFORM_NOISE = [
  'official music video',
  'official lyric video',
  'official video',
  'official audio',
  'lyric video',
  'lyrics',
  'visualizer',
  'visualiser',
  'full song',
  'audio',
  '4k',
  'hd',
  'hq',
  'mv',
];

/** `(...)` and `[...]` groups whose whole contents are one noise phrase. */
const NOISE_GROUP = new RegExp(
  `[([]\\s*(${PLATFORM_NOISE.join('|')})\\s*[)\\]]`,
  'gi',
);

/** A trailing `feat.` clause, bracketed or not — it names a guest, not a mix. */
const FEATURE_CLAUSE = /\s*[([]?\s*(feat\.|ft\.|featuring)\s[^)\]]*[)\]]?\s*$/i;

const collapse = (value: string) =>
  value
    .toLowerCase()
    // Punctuation carries no meaning between two spellings of one title, but
    // the characters that separate words have to become spaces rather than
    // vanish, or `rock-n-roll` and `rock n roll` stop matching.
    .replace(/[_\-–—/]+/g, ' ')
    .replace(/["'’“”.,!?:;]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeSongAlias = (
  title: string,
  artist?: string,
): string | undefined => {
  const rawTitle = title.trim();
  if (!rawTitle) {
    return undefined;
  }

  const stripped = rawTitle
    .replace(NOISE_GROUP, ' ')
    .replace(FEATURE_CLAUSE, '');
  const cleanTitle = collapse(stripped);
  if (!cleanTitle) {
    return undefined;
  }

  const cleanArtist = collapse(artist ?? '');

  // NO ARTIST AND NOTHING STRIPPED IS A PAGE, NOT A SONG.
  //
  // A podcast, a livestream, a video essay: each publishes a title and no
  // artist, and giving those an alias would let two unrelated tabs share a
  // curve. Noise that was actually removed is the evidence that the title came
  // off a media page describing a track, so that case still gets one.
  if (!cleanArtist && collapse(rawTitle) === cleanTitle) {
    return undefined;
  }

  return `${cleanTitle}|${cleanArtist}`;
};

/**
 * Query parameters known to be tracking or session noise, never the content.
 *
 * A denylist, and the direction is deliberate. Keeping a tracking parameter
 * by mistake splits one video across two keys, which costs a re-learn.
 * Stripping one that identifies the content merges many videos onto a single
 * key — the wrong curve, applied to the wrong song, named wrongly in the
 * notice. Under-remembering is recoverable; over-merging is a bug nobody can
 * explain. The title alias is a second chance for the split case and no help
 * at all for the merge.
 */
const MEDIA_URL_NOISE_PARAMS = new Set([
  't',
  'si',
  'feature',
  'pp',
  'ab_channel',
  'index',
  'start_radio',
  'fbclid',
  'gclid',
  'igshid',
  'ref',
  'ref_src',
  'source',
]);

/**
 * A media URL with its tracking cut off, keeping whatever names the content.
 *
 * The hash is never the content. The query can be — YouTube's video id lives
 * in `v=` — so parameters are filtered against a denylist rather than
 * dropped wholesale, and the survivors are sorted: the same video loaded with
 * its parameters in a different order must still produce one key.
 */
const trimMediaUrl = (url: string): string => {
  const hashIndex = url.indexOf('#');
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex === -1) {
    return withoutHash;
  }
  const base = withoutHash.slice(0, queryIndex);
  const keptParams = withoutHash
    .slice(queryIndex + 1)
    .split('&')
    .filter((pair) => pair.length > 0)
    .filter((pair) => {
      const name = pair.split('=')[0];
      return !MEDIA_URL_NOISE_PARAMS.has(name) && !name.startsWith('utm_');
    })
    .sort();
  return keptParams.length > 0 ? `${base}?${keptParams.join('&')}` : base;
};

export const buildSongIdentity = (
  source: TSongSource,
  exact: string,
  title: string,
  artist?: string,
): ISongIdentity | undefined => {
  const cleanTitle = title.trim();
  if (!cleanTitle) {
    // A session with no title is a player that registered and has nothing
    // loaded — the same rule `parseSystemMediaLine` already applies.
    return undefined;
  }

  const cleanArtist = artist?.trim() || undefined;

  const key = (() => {
    if (source === 'media') {
      return `media:${trimMediaUrl(exact)}`;
    }
    if (source === 'system') {
      // The app alone is not a song: Spotify is one session playing a
      // different track every three minutes. Collapsed rather than raw so a
      // republished title with different spacing is still the same key.
      return `system:${exact}:${collapse(cleanTitle)}:${collapse(cleanArtist ?? '')}`;
    }
    return `${source}:${exact}`;
  })();

  return {
    key,
    // Karaoke never gets one — see the module comment on the spec's §6.
    alias:
      source === 'karaoke'
        ? undefined
        : normalizeSongAlias(cleanTitle, cleanArtist),
    title: cleanTitle,
    artist: cleanArtist,
    source,
  };
};
