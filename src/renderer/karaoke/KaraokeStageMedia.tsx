/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { IKaraokeSong } from '../../common/karaoke/types';
import { isKaraokePlayableVideoFile } from '../../common/karaoke/files';
import { useTranslation } from '../utils/I18nContext';

/**
 * How far the picture may drift from the song before it is nudged back.
 *
 * A `<video>` and an `<audio>` are two independent clocks and they separate
 * slowly no matter how carefully they were started. Correcting every frame
 * would mean seeking constantly, which stutters; correcting never means the
 * picture is visibly behind by the last chorus. A fifth of a second is under
 * what anybody notices on scenery and far more than the jitter between two
 * media elements on the same machine.
 */
const VIDEO_DRIFT_TOLERANCE_MS = 200;

export interface IKaraokeStageMediaProps {
  song: IKaraokeSong;
  /** The song's clock, which the picture follows rather than leads. */
  playheadMs: number;
  isPlaying: boolean;
}

/**
 * The picture behind the words: a song's own video, or its artwork.
 *
 * WHY THE AUDIO STAYS IN CHARGE. The `<audio>` element is the song — it is
 * what the lyrics, the pitch lane and the transport are all timed against, and
 * it is what a separation swaps out underneath everything. The video here is
 * muted scenery slaved to that clock. Giving the video its own audio track
 * would put two decoders on the same song and let them argue about where it
 * is; there is one clock in this player and this is not it.
 *
 * WHAT IT PREFERS, IN ORDER. A playable video, then a background picture, then
 * the cover. The last of those is a deliberate downgrade rather than a
 * fallback of last resort: a cover is square artwork meant to be looked at, so
 * stretched across a widescreen stage it is the worst-looking of the three and
 * still much better than the empty gradient that used to be there.
 */
const KaraokeStageMedia = ({
  song,
  playheadMs,
  isPlaying,
}: IKaraokeStageMediaProps) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideoFailed, setHasVideoFailed] = useState(false);

  const cover = song.assets.find((asset) => asset.role === 'cover');
  const background = song.assets.find((asset) => asset.role === 'background');
  const video = song.assets.find((asset) => asset.role === 'video');

  // Recognised but undecodable is its own state, and the commonest one in a
  // real UltraStar library: those packs are full of AVI and FLV, which
  // Chromium has no demuxer for. Saying so beats a black rectangle.
  const isVideoPlayable = Boolean(
    video && isKaraokePlayableVideoFile(video.file),
  );
  const showsVideo = isVideoPlayable && !hasVideoFailed;
  const still = background ?? cover;

  /*
   * One object URL per file, revoked when the file changes or the player goes.
   *
   * `useMemo` rather than an effect, because the URL has to exist during the
   * render that uses it — an effect would hand the first paint an empty `src`,
   * which for a video is a flash of the poster area and for an image is a
   * broken-image frame. The cleanup lives in the effect below, which is the
   * only place that can run on unmount.
   */
  const videoUrl = useMemo(
    () => (showsVideo && video ? URL.createObjectURL(video.file) : undefined),
    [showsVideo, video],
  );
  const stillUrl = useMemo(
    () => (still ? URL.createObjectURL(still.file) : undefined),
    [still],
  );
  useEffect(
    () => () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    },
    [videoUrl],
  );
  useEffect(
    () => () => {
      if (stillUrl) {
        URL.revokeObjectURL(stillUrl);
      }
    },
    [stillUrl],
  );

  // A new file gets a fresh chance to decode; otherwise one bad video would
  // keep this component in its failed state for every song after it.
  useEffect(() => setHasVideoFailed(false), [video]);

  /*
   * Follow the song, and only correct when the drift is worth a seek.
   *
   * `#VIDEOGAP` is positive when the picture starts later than the song, so it
   * is subtracted to find where the video should be for a given moment in the
   * audio. A negative result means the song is still in its intro and the
   * video has not started — held at frame zero rather than seeked to a
   * negative time, which Chromium clamps silently and which would otherwise
   * make the first seconds play the opening frames twice.
   */
  useEffect(() => {
    const element = videoRef.current;
    if (!element || !showsVideo) {
      return;
    }
    const wantedMs = playheadMs - (song.meta.videoGapMs ?? 0);
    const wantedSeconds = Math.max(0, wantedMs / 1000);
    if (
      Math.abs(element.currentTime * 1000 - wantedSeconds * 1000) >
      VIDEO_DRIFT_TOLERANCE_MS
    ) {
      element.currentTime = wantedSeconds;
    }
  }, [playheadMs, showsVideo, song.meta.videoGapMs]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !showsVideo) {
      return;
    }
    if (isPlaying) {
      // A rejected play() here is not worth surfacing: the picture is
      // decoration and the song is already going. The catch exists because an
      // unhandled rejection in a media element is noisy in the console and
      // says nothing useful.
      element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, [isPlaying, showsVideo]);

  if (!showsVideo && !stillUrl) {
    return null;
  }

  return (
    <div className="karaoke-stage-media" aria-hidden="true">
      {stillUrl && (
        <img
          className={`karaoke-stage-media__still${
            showsVideo ? ' is-behind-video' : ''
          }`}
          src={stillUrl}
          alt=""
        />
      )}
      {showsVideo && videoUrl && (
        <video
          ref={videoRef}
          className="karaoke-stage-media__video"
          src={videoUrl}
          // Muted and silent by contract, not by preference — see the note at
          // the top about there being one clock in this player.
          muted
          playsInline
          // No controls and not focusable: this is scenery, and a picture that
          // can be scrubbed independently of the song is a second transport.
          tabIndex={-1}
          onError={() => setHasVideoFailed(true)}
        />
      )}
      {/* Said quietly, once, and only when there is genuinely a video that
          this build cannot open. It sits over the artwork that took its place
          so the fallback does not look like the song simply having no video. */}
      {video && !isVideoPlayable && (
        <p className="karaoke-stage-media__unsupported">
          {t('karaoke.stage.videoUnsupported', {
            format: video.extension.toUpperCase(),
          })}
        </p>
      )}
    </div>
  );
};

export default KaraokeStageMedia;
