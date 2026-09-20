import type { TranslationKey } from '../../common/i18n';
import type {
  IWallpaperScreen,
  TWallpaperError,
  TWallpaperMotion,
  TWallpaperPause,
} from '../../common/wallpaper';
import type { TCommunityGlyph } from '../community/Glyph';

export const MOTION_COPY: Record<
  TWallpaperMotion,
  { glyph: TCommunityGlyph; name: TranslationKey; hint: TranslationKey }
> = {
  music: {
    glyph: 'music',
    name: 'wallpaper.motion.music',
    hint: 'wallpaper.motion.music.hint',
  },
  calm: {
    glyph: 'calm',
    name: 'wallpaper.motion.calm',
    hint: 'wallpaper.motion.calm.hint',
  },
};

export const ERROR_KEYS: Record<TWallpaperError, TranslationKey> = {
  unsupported: 'wallpaper.error.unsupported',
  unavailable: 'wallpaper.error.unavailable',
  'not-entitled': 'wallpaper.error.notEntitled',
  'missing-scene': 'wallpaper.error.missingScene',
  refused: 'wallpaper.error.refused',
  'missing-display': 'wallpaper.error.missingDisplay',
  host: 'wallpaper.error.host',
  renderer: 'wallpaper.error.renderer',
  audio: 'wallpaper.error.audio',
};

export const PAUSE_KEYS: Record<TWallpaperPause, TranslationKey> = {
  locked: 'wallpaper.pause.locked',
  suspended: 'wallpaper.pause.suspended',
  battery: 'wallpaper.pause.battery',
  game: 'wallpaper.pause.game',
  covered: 'wallpaper.pause.covered',
};

/** One monitor's status as a sentence, where nothing else says what it is. */
export const screenStatusKey = (screen: IWallpaperScreen): TranslationKey => {
  if (screen.phase === 'error') {
    return ERROR_KEYS[screen.error ?? 'unavailable'];
  }
  if (screen.phase === 'paused') {
    return screen.pauseReason
      ? PAUSE_KEYS[screen.pauseReason]
      : 'wallpaper.status.paused';
  }
  return screen.phase === 'running'
    ? 'wallpaper.status.running'
    : 'wallpaper.status.starting';
};

/**
 * The one word a monitor tile has room for. A calm background playing says
 * Calm: that it plays is the dot beside the word, and how is what differs.
 */
export const screenPhaseKey = (screen: IWallpaperScreen): TranslationKey => {
  switch (screen.phase) {
    case 'running':
      return screen.motion === 'calm'
        ? 'wallpaper.motion.calm'
        : 'wallpaper.phase.playing';
    case 'paused':
      return 'wallpaper.phase.paused';
    case 'error':
      return 'wallpaper.phase.stopped';
    default:
      return 'wallpaper.phase.starting';
  }
};

/**
 * A monitor's line in a list already titled "Desktop background": a word
 * while it plays, and the reason whenever it does not. Whether it is calm is
 * the row's own switch, so the word does not say it twice.
 */
export const screenDetailKey = (screen: IWallpaperScreen): TranslationKey => {
  if (screen.phase === 'error') {
    return ERROR_KEYS[screen.error ?? 'unavailable'];
  }
  if (screen.phase === 'paused' && screen.pauseReason) {
    return PAUSE_KEYS[screen.pauseReason];
  }
  return screen.phase === 'running'
    ? 'wallpaper.phase.playing'
    : screenPhaseKey(screen);
};
