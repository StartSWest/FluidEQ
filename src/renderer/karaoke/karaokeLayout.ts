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

export type TKaraokeLayoutMode = 'normal' | 'fullscreen';

export interface IKaraokeLayoutSettings {
  playlistShare: number;
  playlistCollapsed: boolean;
  /**
   * The pitch strip's height in pixels, dragged at its top edge (Ivan,
   * 2026-11-16: "make sure it's resizable too"). Pixels rather than a share
   * of the stage: the strip is drawn at a size, slim by default as the K1
   * mockup has it, and a window made taller should give its room to the
   * words, not to the strip.
   */
  pitchHeight: number;
}

const STORAGE_STEM = 'fluideq.karaokeLayout';
const MIN_PLAYLIST_SHARE = 0.14;
const MAX_PLAYLIST_SHARE = 0.46;
const MIN_PITCH_HEIGHT = 56;
const MAX_PITCH_HEIGHT = 360;

const DEFAULTS: Record<TKaraokeLayoutMode, IKaraokeLayoutSettings> = {
  // Narrower than the 27% and 22% it started at (Ivan, 2026-11-16: "after
  // resetting all settings the karaoke list is too wide"): a fifth of the
  // page, about the Library rail's width on an ordinary window.
  // The pitch strip opens near its tallest, every note row readable (Ivan,
  // 2026-11-18, after a reset left it at 128: "it's too compressed ... like
  // the picture is fine", his strip at 360). It was 96 and 132, then 128
  // and 172 (2026-11-17, "a little bit taller").
  normal: {
    playlistShare: 0.2,
    playlistCollapsed: false,
    pitchHeight: 340,
  },
  fullscreen: {
    playlistShare: 0.17,
    playlistCollapsed: false,
    pitchHeight: 360,
  },
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const clampKaraokePlaylistShare = (share: number) =>
  clamp(share, MIN_PLAYLIST_SHARE, MAX_PLAYLIST_SHARE);

export const clampKaraokePitchHeight = (height: number) =>
  Math.round(clamp(height, MIN_PITCH_HEIGHT, MAX_PITCH_HEIGHT));

/** Where the strip's height stands in its range, for its handle's reading. */
export const karaokePitchHeightPercent = (height: number) =>
  ((clampKaraokePitchHeight(height) - MIN_PITCH_HEIGHT) /
    (MAX_PITCH_HEIGHT - MIN_PITCH_HEIGHT)) *
  100;

export const karaokeLayoutStorageKey = (mode: TKaraokeLayoutMode) =>
  `${STORAGE_STEM}.${mode}`;

export const readKaraokeLayout = (
  mode: TKaraokeLayoutMode,
): IKaraokeLayoutSettings => {
  const fallback = DEFAULTS[mode];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(karaokeLayoutStorageKey(mode)) ?? 'null',
    ) as Partial<IKaraokeLayoutSettings> | null;
    if (!parsed) {
      return { ...fallback };
    }
    return {
      playlistShare: Number.isFinite(parsed.playlistShare)
        ? clampKaraokePlaylistShare(parsed.playlistShare as number)
        : fallback.playlistShare,
      playlistCollapsed:
        typeof parsed.playlistCollapsed === 'boolean'
          ? parsed.playlistCollapsed
          : fallback.playlistCollapsed,
      pitchHeight: Number.isFinite(parsed.pitchHeight)
        ? clampKaraokePitchHeight(parsed.pitchHeight as number)
        : fallback.pitchHeight,
    };
  } catch {
    return { ...fallback };
  }
};

export const writeKaraokeLayout = (
  mode: TKaraokeLayoutMode,
  settings: IKaraokeLayoutSettings,
) => {
  try {
    window.localStorage.setItem(
      karaokeLayoutStorageKey(mode),
      JSON.stringify(settings),
    );
  } catch {
    // A blocked localStorage must never make a splitter stop responding.
  }
};
