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
 * Whether this song brings anything for the stage to show.
 *
 * The stage-art toggle in the workspace is offered only when the answer is
 * yes: a control that visibly does nothing reads as broken, and an audio-only
 * song has nothing behind the words either way. Undecodable video counts —
 * the stage still puts up the artwork that replaced it, and the notice saying
 * why, both of which the toggle is entitled to remove.
 *
 * That last clause is only honest because the notice now renders with no
 * artwork under it. While the component returned `null` for a video-only pack
 * this function answered yes for a stage that drew nothing, and the toggle was
 * enabled over an empty layer — exactly the broken-looking control it exists
 * to avoid.
 *
 * One case it still cannot answer: a cover this build cannot decode. Whether a
 * file decodes is known only after `<img>` has tried, which is a render later
 * and inside the component, so a song whose only stage asset is a truncated
 * JPEG leaves the toggle enabled over the gradient. That is the smaller of the
 * two defects — the alternative was drawing the browser's broken-image frame
 * across the stage — and closing it would mean this answer changing after the
 * fact, which is a different shape of surprise.
 */
export const hasKaraokeStageArt = (song: IKaraokeSong): boolean =>
  song.assets.some(
    (asset) =>
      asset.role === 'video' ||
      asset.role === 'background' ||
      asset.role === 'cover',
  );

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
  const [hasStillFailed, setHasStillFailed] = useState(false);

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
   * A picture that will not decode steps aside, and says nothing.
   *
   * The file picker now accepts `.svg .avif .ico .apng .jfif .bmp`, none of
   * which Chromium is guaranteed to decode from an arbitrary UltraStar pack,
   * and a truncated or mislabelled JPEG is commoner still. Handing `<img>` one
   * of those draws the browser's broken-image frame across the whole stage —
   * `fileTypes.ts` argues that is worse than the gradient, and it is right.
   *
   * NO NOTICE HERE, deliberately, where the video gets two. The video IS the
   * stage: a pack chosen for its clip that shows nothing needs to be told why,
   * and that sentence is the only content in this layer. Artwork is scenery at
   * 0.32 opacity behind the words and has never carried information — when it
   * fails the stage falls back to exactly what an audio-only song shows, which
   * is a normal state and not a broken one. A caption over a stage that looks
   * correct is noise competing with the lyrics.
   */
  const showsStill = Boolean(still) && !hasStillFailed;

  /*
   * The notice answers failure, not file extension.
   *
   * An `.mp4` carrying HEVC or AC-3 passes `isKaraokePlayableVideoFile` and
   * then fires the element's `error` event, so gating the sentence on the
   * extension alone left that song falling back to a still picture — or to an
   * empty stage — with nothing anywhere saying why. The two cases get
   * different wording because they are different answers: one is "this app
   * never opens this container", the other is "this file did not decode".
   */
  const hasVideoNotice = Boolean(video) && (!isVideoPlayable || hasVideoFailed);
  const videoNoticeKey = hasVideoFailed
    ? 'karaoke.stage.videoFailed'
    : 'karaoke.stage.videoUnsupported';
  // Nothing behind it and nothing beside it: an UltraStar pack whose only
  // stage asset is `[VD#0].avi`. The notice then IS the stage art the toggle
  // offers, so it has to be drawn and has to be legible on its own.
  const isNoticeAlone = !showsVideo && !showsStill;

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
  useEffect(() => setHasStillFailed(false), [still]);

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

  if (!showsVideo && !showsStill && !hasVideoNotice) {
    return null;
  }

  // `aria-hidden` sits on the pictures rather than on the box that holds them.
  // On the box it also hid the notice, which is the one thing in this layer
  // that is content and not decoration — a screen reader was told the stage
  // was empty while the sighted user was reading why the video would not play.
  return (
    <div className="karaoke-stage-media">
      {showsStill && stillUrl && (
        <img
          className={`karaoke-stage-media__still${
            showsVideo ? ' is-behind-video' : ''
          }`}
          src={stillUrl}
          alt=""
          aria-hidden="true"
          onError={() => setHasStillFailed(true)}
        />
      )}
      {showsVideo && videoUrl && (
        <video
          ref={videoRef}
          className="karaoke-stage-media__video"
          src={videoUrl}
          aria-hidden="true"
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
      {/* Said once, and only when there is genuinely a video this build could
          not put on the stage. Over artwork it is a caption on the picture
          that took the video's place; with no artwork under it, it is the
          whole of what this layer has to say and `is-alone` sizes it to be
          read rather than glimpsed. */}
      {video && hasVideoNotice && (
        <p
          className={`karaoke-stage-media__unsupported${
            isNoticeAlone ? ' is-alone' : ''
          }`}
          role="status"
        >
          {t(videoNoticeKey, {
            format: video.extension.toUpperCase(),
          })}
        </p>
      )}
    </div>
  );
};

export default KaraokeStageMedia;
