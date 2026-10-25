/* FluidEQ — GPL-3.0-or-later */

export const GROUP_MEDIA_WATCH = 'group-media-watch';
export const GROUP_MEDIA_COMMAND = 'group-media-command';

/** Volume and mute belong to this computer and never enter this channel. */
export const GROUP_MEDIA_KEYS = [
  ['MediaPlayPause', 'toggle'],
  ['MediaStop', 'stop'],
  ['MediaNextTrack', 'next'],
  ['MediaPreviousTrack', 'previous'],
] as const;
