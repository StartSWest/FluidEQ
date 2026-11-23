/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Resolves what music or media is currently playing across FluidEQ's built-in
 * Library player, Media/Video webviews, and Windows System Media Transport
 * Controls (SMTC) so AI tuning assistants know the track, artist, and source.
 */

import { spawn } from 'child_process';
import path from 'path';
import { webContents } from 'electron';
import { APP_USER_MODEL_ID } from '../appIdentity';
import { readDspHostNowPlaying } from '../ipc/dspHost';
import { POWERSHELL_PATH, utf8Command } from '../powershell';
import { getLatestSystemMedia } from '../systemMedia';

export interface INowPlayingInfo {
  source: 'library' | 'media-tab' | 'system' | 'none';
  isPlaying: boolean;
  app?: string;
  title?: string;
  artist?: string;
  album?: string;
  url?: string;
  filePath?: string;
  positionMs?: number;
  durationMs?: number;
}

interface IWebviewMediaMeta {
  title?: string;
  artist?: string;
  album?: string;
  playbackState?: string;
}

const cleanPlatformLabel = (rawUrl: string): string | undefined => {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    if (host.includes('music.youtube.com')) {
      return 'YouTube Music';
    }
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return 'YouTube';
    }
    if (host.includes('spotify.com')) {
      return 'Spotify Web';
    }
    if (host.includes('soundcloud.com')) {
      return 'SoundCloud';
    }
    if (host.includes('bilibili.com')) {
      return 'Bilibili';
    }
    if (host.includes('music.apple.com')) {
      return 'Apple Music Web';
    }
    return host || undefined;
  } catch {
    return undefined;
  }
};

const readMediaTabNowPlaying = async (): Promise<
  INowPlayingInfo | undefined
> => {
  const guests = webContents
    .getAllWebContents()
    .filter((wc) => !wc.isDestroyed() && wc.getType() === 'webview');
  if (guests.length === 0) {
    return undefined;
  }
  const active = guests.find((wc) => wc.isCurrentlyAudible()) ?? guests[0];
  const url = active.getURL();
  const pageTitle = active.getTitle().trim();
  const audible = active.isCurrentlyAudible();
  const app = cleanPlatformLabel(url) ?? 'FluidEQ Media';

  let meta: IWebviewMediaMeta | undefined;
  try {
    const raw: unknown = await active.executeJavaScript(`(() => {
      const ms = navigator.mediaSession;
      const md = ms && ms.metadata;
      return {
        title: md && typeof md.title === 'string' ? md.title : '',
        artist: md && typeof md.artist === 'string' ? md.artist : '',
        album: md && typeof md.album === 'string' ? md.album : '',
        playbackState: ms && typeof ms.playbackState === 'string' ? ms.playbackState : '',
      };
    })()`);
    if (typeof raw === 'object' && raw !== null) {
      meta = raw as IWebviewMediaMeta;
    }
  } catch {
    // Guest page may still be navigating; fall back to its title & URL.
  }

  const title = meta?.title?.trim() || pageTitle || undefined;
  const artist = meta?.artist?.trim() || undefined;
  const album = meta?.album?.trim() || undefined;
  const isPlaying = audible || meta?.playbackState === 'playing';

  if (!title && !audible) {
    return undefined;
  }
  return {
    source: 'media-tab',
    isPlaying,
    app,
    ...(title ? { title } : {}),
    ...(artist ? { artist } : {}),
    ...(album ? { album } : {}),
    ...(url ? { url } : {}),
  };
};

const SMTC_QUERY_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]
function Await($op, $type) {
  $asTask.MakeGenericMethod($type).Invoke($null, @($op)).Result
}
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$manager = Await ($managerType::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
if (-not $manager) { exit 0 }
$selfId = '${APP_USER_MODEL_ID}'
$sessions = @($manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -ne $selfId })
if ($sessions.Count -eq 0) { exit 0 }
$picked = $sessions | Where-Object { "$($_.GetPlaybackInfo().PlaybackStatus)" -eq 'Playing' } | Select-Object -First 1
if (-not $picked) { $picked = $sessions | Select-Object -First 1 }
$props = Await ($picked.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
$info = $picked.GetPlaybackInfo()
$tl = $picked.GetTimelineProperties()
[pscustomobject]@{
  app = [string]$picked.SourceAppUserModelId
  title = [string]$props.Title
  artist = [string]$props.Artist
  album = [string]$props.AlbumTitle
  isPlaying = ("$($info.PlaybackStatus)" -eq 'Playing')
  positionMs = if ($tl) { [int64]($tl.Position.TotalMilliseconds) } else { 0 }
  durationMs = if ($tl) { [int64]($tl.EndTime.TotalMilliseconds) } else { 0 }
} | ConvertTo-Json -Compress
`;

const queryWindowsSmtcOnce = (): Promise<INowPlayingInfo | undefined> => {
  if (process.platform !== 'win32') {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    let stdout = '';
    const child = spawn(
      POWERSHELL_PATH,
      [
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle',
        'Hidden',
        '-Command',
        utf8Command(SMTC_QUERY_SCRIPT),
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.on('error', () => resolve(undefined));
    child.on('close', () => {
      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve(undefined);
        return;
      }
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        const title =
          typeof parsed.title === 'string' && parsed.title.trim()
            ? parsed.title.trim()
            : undefined;
        const artist =
          typeof parsed.artist === 'string' && parsed.artist.trim()
            ? parsed.artist.trim()
            : undefined;
        const album =
          typeof parsed.album === 'string' && parsed.album.trim()
            ? parsed.album.trim()
            : undefined;
        const app =
          typeof parsed.app === 'string' && parsed.app.trim()
            ? parsed.app.trim()
            : undefined;
        if (!title && !artist) {
          resolve(undefined);
          return;
        }
        resolve({
          source: 'system',
          isPlaying: parsed.isPlaying === true,
          ...(app ? { app } : {}),
          ...(title ? { title } : {}),
          ...(artist ? { artist } : {}),
          ...(album ? { album } : {}),
          ...(typeof parsed.positionMs === 'number' && parsed.positionMs > 0
            ? { positionMs: parsed.positionMs }
            : {}),
          ...(typeof parsed.durationMs === 'number' && parsed.durationMs > 0
            ? { durationMs: parsed.durationMs }
            : {}),
        });
      } catch {
        resolve(undefined);
      }
    });
  });
};

export const readNowPlaying = async (): Promise<INowPlayingInfo> => {
  const library = readDspHostNowPlaying();
  if (library.isPlaying && library.filePath) {
    return {
      source: 'library',
      isPlaying: true,
      app: 'FluidEQ Library',
      title: path.basename(library.filePath, path.extname(library.filePath)),
      filePath: library.filePath,
    };
  }

  const mediaTab = await readMediaTabNowPlaying();
  if (mediaTab?.isPlaying) {
    return mediaTab;
  }

  const cached = getLatestSystemMedia();
  if (cached && (cached.title || cached.artist)) {
    return {
      source: 'system',
      isPlaying: cached.isPlaying,
      app: cached.app,
      ...(cached.title ? { title: cached.title } : {}),
      ...(cached.artist ? { artist: cached.artist } : {}),
      positionMs: cached.positionMs,
      durationMs: cached.durationMs,
    };
  }

  const smtc = await queryWindowsSmtcOnce();
  if (smtc?.isPlaying) {
    return smtc;
  }

  if (mediaTab) {
    return mediaTab;
  }
  if (smtc) {
    return smtc;
  }
  if (library.filePath) {
    return {
      source: 'library',
      isPlaying: false,
      app: 'FluidEQ Library',
      title: path.basename(library.filePath, path.extname(library.filePath)),
      filePath: library.filePath,
    };
  }
  return { source: 'none', isPlaying: false };
};
