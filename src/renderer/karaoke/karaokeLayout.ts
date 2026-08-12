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
  pitchShare: number;
}

const STORAGE_STEM = 'fluideq.karaokeLayout';
const MIN_PLAYLIST_SHARE = 0.14;
const MAX_PLAYLIST_SHARE = 0.46;
const MIN_PITCH_SHARE = 0.2;
const MAX_PITCH_SHARE = 0.62;

const DEFAULTS: Record<TKaraokeLayoutMode, IKaraokeLayoutSettings> = {
  normal: {
    playlistShare: 0.27,
    playlistCollapsed: false,
    pitchShare: 0.34,
  },
  fullscreen: {
    playlistShare: 0.22,
    playlistCollapsed: false,
    pitchShare: 0.4,
  },
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const clampKaraokePlaylistShare = (share: number) =>
  clamp(share, MIN_PLAYLIST_SHARE, MAX_PLAYLIST_SHARE);

export const clampKaraokePitchShare = (share: number) =>
  clamp(share, MIN_PITCH_SHARE, MAX_PITCH_SHARE);

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
      pitchShare: Number.isFinite(parsed.pitchShare)
        ? clampKaraokePitchShare(parsed.pitchShare as number)
        : fallback.pitchShare,
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
