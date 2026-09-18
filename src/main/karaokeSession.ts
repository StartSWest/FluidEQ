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

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { isLocalRendererPath } from './rendererPaths';
import {
  IKaraokeRestoredFile,
  IKaraokeRestoredFileBytes,
  IKaraokeRestoredSession,
  IKaraokeSessionFileReference,
  IKaraokeSessionSnapshot,
} from '../common/karaoke/sessionPersistence';
import {
  KARAOKE_AUDIO_EXTENSIONS,
  KARAOKE_IMAGE_EXTENSIONS,
  KARAOKE_LYRIC_EXTENSIONS,
  KARAOKE_VIDEO_EXTENSIONS,
} from '../common/karaoke/files';
import { decodeKaraokeText } from '../common/karaoke/textEncoding';

const SESSION_FILENAME = 'karaoke-session.json';
const MAX_FILES = 5_000;

/**
 * The largest file handed back whole when a session is restored. The same
 * bound the Library's own playback blob keeps: past it, a file is long enough
 * that holding it in the window's heap costs more than it buys, and a path
 * that turns out to be something else entirely is refused rather than read.
 */
const MAX_RESTORED_FILE_BYTES = 96 * 1024 * 1024;
const MAX_LYRICS_BYTES = 4 * 1024 * 1024;
/**
 * Taken from the renderer's own list, not copied. A second copy that fell
 * behind would drop a whole format on restart without saying so — a widened
 * picker would accept an `.opus` song that the next launch quietly refused to
 * restore, which is the same failure the media set below already guards.
 */
const AUDIO_EXTENSIONS = new Set<string>(KARAOKE_AUDIO_EXTENSIONS);
/**
 * Derived like the two sets around it, and for the same reason: this one was
 * still a hand-written copy, so a new lyric adapter would have been offered by
 * the picker and accepted by the importer while the next launch refused to
 * restore it — silently, since a session that comes back without its lyrics
 * looks exactly like a song that never had any.
 */
const LYRIC_EXTENSIONS = new Set<string>(KARAOKE_LYRIC_EXTENSIONS);
/**
 * The stage's pictures and video, taken from the renderer's own lists rather
 * than copied. A second copy that fell behind would not fail loudly: it would
 * quietly drop one format's artwork on restart, which is the exact bug this
 * set exists to fix.
 */
const MEDIA_EXTENSIONS = new Set<string>([
  ...KARAOKE_IMAGE_EXTENSIONS,
  ...KARAOKE_VIDEO_EXTENSIONS,
]);
const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  lrc: 'text/plain',
  elrc: 'text/plain',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  apng: 'image/apng',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  avi: 'video/x-msvideo',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  flv: 'video/x-flv',
  wmv: 'video/x-ms-wmv',
  mkv: 'video/x-matroska',
  divx: 'video/x-msvideo',
};

interface IKaraokeStoredFile {
  localPath: string;
  relativePath: string;
}

interface IKaraokeStoredSession {
  version: 1;
  files: IKaraokeStoredFile[];
  playlistOrder: string[];
  selectedPlaylistId?: string;
  playheadMs: number;
}

const tokenPaths = new Map<string, string>();

const extensionForPath = (localPath: string): string =>
  path.extname(localPath).slice(1).toLowerCase();

const roleForPath = (
  localPath: string,
): IKaraokeRestoredFile['role'] | undefined => {
  const extension = extensionForPath(localPath);
  if (AUDIO_EXTENSIONS.has(extension)) {
    return 'audio';
  }
  if (LYRIC_EXTENSIONS.has(extension)) {
    return 'lyrics';
  }
  if (MEDIA_EXTENSIONS.has(extension)) {
    return 'media';
  }
  return undefined;
};

const tokenForPath = (localPath: string): string =>
  createHash('sha256').update(localPath).digest('hex').slice(0, 32);

const sessionPath = (userDataDir: string): string =>
  path.join(userDataDir, SESSION_FILENAME);

const safeRelativePath = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 2_048) {
    return fallback;
  }
  return value.replace(/^[/\\]+/, '');
};

const safeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.length > 0 && entry.length < 2_048,
      )
    : [];

const resolveReferencePath = (
  reference: IKaraokeSessionFileReference,
): string | undefined => {
  if (reference.token) {
    return tokenPaths.get(reference.token);
  }
  return reference.localPath;
};

const validateStoredFile = (
  localPath: unknown,
  relativePath: unknown,
): IKaraokeStoredFile | undefined => {
  // Not a path on another machine, whatever else it is: `stat` on
  // `\\host\share` authenticates outbound as this user, and the path arrived
  // over IPC (`rendererPaths.ts`).
  if (
    !isLocalRendererPath(localPath) ||
    !path.isAbsolute(localPath) ||
    !roleForPath(localPath)
  ) {
    return undefined;
  }
  try {
    const stats = fs.statSync(localPath);
    if (!stats.isFile()) {
      return undefined;
    }
    return {
      localPath,
      relativePath: safeRelativePath(relativePath, path.basename(localPath)),
    };
  } catch {
    return undefined;
  }
};

const normalizeStoredSession = (value: unknown): IKaraokeStoredSession => {
  const candidate = value as Partial<IKaraokeStoredSession> | undefined;
  if (candidate?.version !== 1 || !Array.isArray(candidate.files)) {
    return { version: 1, files: [], playlistOrder: [], playheadMs: 0 };
  }
  const files: IKaraokeStoredFile[] = [];
  const seen = new Set<string>();
  candidate.files.slice(0, MAX_FILES).forEach((file) => {
    const valid = validateStoredFile(file?.localPath, file?.relativePath);
    const key = valid?.localPath.toLowerCase();
    if (valid && key && !seen.has(key)) {
      seen.add(key);
      files.push(valid);
    }
  });
  return {
    version: 1,
    files,
    playlistOrder: safeStringArray(candidate.playlistOrder),
    selectedPlaylistId:
      typeof candidate.selectedPlaylistId === 'string'
        ? candidate.selectedPlaylistId
        : undefined,
    playheadMs:
      typeof candidate.playheadMs === 'number' &&
      Number.isFinite(candidate.playheadMs)
        ? Math.max(0, candidate.playheadMs)
        : 0,
  };
};

const readStoredSession = (userDataDir: string): IKaraokeStoredSession => {
  try {
    return normalizeStoredSession(
      JSON.parse(fs.readFileSync(sessionPath(userDataDir), 'utf8')),
    );
  } catch {
    return { version: 1, files: [], playlistOrder: [], playheadMs: 0 };
  }
};

const activateTokens = (files: readonly IKaraokeStoredFile[]) => {
  tokenPaths.clear();
  files.forEach((file) => {
    tokenPaths.set(tokenForPath(file.localPath), file.localPath);
  });
};

export const saveKaraokeSession = (
  userDataDir: string,
  snapshot: IKaraokeSessionSnapshot,
): void => {
  const storedFiles = snapshot.files
    .slice(0, MAX_FILES)
    .map((reference) => {
      const localPath = resolveReferencePath(reference);
      return validateStoredFile(localPath, reference.relativePath);
    })
    .filter((file): file is IKaraokeStoredFile => Boolean(file));
  const stored: IKaraokeStoredSession = {
    version: 1,
    files: storedFiles,
    playlistOrder: safeStringArray(snapshot.playlistOrder),
    selectedPlaylistId:
      typeof snapshot.selectedPlaylistId === 'string'
        ? snapshot.selectedPlaylistId
        : undefined,
    playheadMs:
      Number.isFinite(snapshot.playheadMs) && snapshot.playheadMs > 0
        ? snapshot.playheadMs
        : 0,
  };
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(sessionPath(userDataDir), JSON.stringify(stored, null, 2));
  // DELIBERATELY NOT `activateTokens(stored.files)`.
  //
  // A token is `sha256(path)`, so a caller that names a path can work out its
  // own token — and activating on save made this pair of channels an arbitrary
  // read of any media file on the machine in one round trip: save a session
  // naming somebody's photo, then ask for its bytes. The window has the file
  // it just saved; it does not need main to read it back. Only a session
  // RESTORED from disk hands out tokens, which is the case the read-back
  // exists for: files the window no longer holds because the app was closed.
};

export const restoreKaraokeSession = (
  userDataDir: string,
): IKaraokeRestoredSession | undefined => {
  const stored = readStoredSession(userDataDir);
  if (!stored.files.length) {
    tokenPaths.clear();
    return undefined;
  }
  activateTokens(stored.files);
  const files = stored.files.flatMap((file): IKaraokeRestoredFile[] => {
    const role = roleForPath(file.localPath);
    if (!role) {
      return [];
    }
    const stats = fs.statSync(file.localPath);
    const extension = extensionForPath(file.localPath);
    if (role === 'lyrics' && stats.size > MAX_LYRICS_BYTES) {
      return [];
    }
    return [
      {
        token: tokenForPath(file.localPath),
        name: path.basename(file.localPath),
        relativePath: file.relativePath,
        type: MIME_TYPES[extension] ?? '',
        lastModified: stats.mtimeMs,
        role,
        // Bytes, then the renderer's own decoder: `'utf8'` here made a restored
        // CP1252 or UTF-16 file read differently from the same file freshly
        // opened, so a song that imported correctly came back mangled.
        ...(role === 'lyrics'
          ? { text: decodeKaraokeText(fs.readFileSync(file.localPath)) }
          : {}),
      },
    ];
  });
  if (!files.some((file) => file.role === 'audio')) {
    return undefined;
  }
  return {
    files,
    playlistOrder: stored.playlistOrder,
    selectedPlaylistId: stored.selectedPlaylistId,
    playheadMs: stored.playheadMs,
  };
};

export const readRestoredKaraokeFile = (
  token: string,
): Promise<IKaraokeRestoredFileBytes | undefined> => {
  const localPath = tokenPaths.get(token);
  const role = localPath ? roleForPath(localPath) : undefined;
  // Lyrics are excluded because they already arrived as text with the session;
  // serving them here would be a second, byte-for-byte copy of what the
  // renderer holds.
  if (!localPath || (role !== 'audio' && role !== 'media')) {
    return Promise.resolve(undefined);
  }
  return fs.promises
    .stat(localPath)
    .then(async (stats) => {
      // The whole file goes into the window's heap, so the size is asked
      // before the bytes are: a song is megabytes, and a path that turns out
      // to be a disc image is refused rather than read into memory.
      if (stats.size > MAX_RESTORED_FILE_BYTES) {
        return undefined;
      }
      const data = await fs.promises.readFile(localPath);
      return {
        data: new Uint8Array(data),
        lastModified: stats.mtimeMs,
        type: MIME_TYPES[extensionForPath(localPath)] ?? '',
      };
    })
    .catch(() => undefined);
};

export const clearKaraokeSession = (userDataDir: string): void => {
  tokenPaths.clear();
  try {
    fs.rmSync(sessionPath(userDataDir), { force: true });
  } catch {
    // A locked profile should not prevent the user from clearing the UI.
  }
};
