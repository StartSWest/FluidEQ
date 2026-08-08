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
 * The output level meter, in the sidebar under the visualizer switch.
 *
 * WHY IT IS ITS OWN COMPONENT. The readings arrive with the analyser frames,
 * thirty times a second, and a prop threaded down through the chart would wake
 * the whole chart up at that rate to move two bars — which is precisely the
 * mistake `CoverageOverlay` and `LiveTraceCanvas` were both pulled out to undo.
 * Subscribed down here the cost is one leaf component re-rendering, and nothing
 * above it notices.
 *
 * WHAT IT IS NOT. It is not the graph's y-axis in a narrow strip. The trace is
 * drawn against the record's own recent peak so the volume knob cannot flatten
 * it; this is drawn against digital full scale, which is a different scale
 * measuring a different thing, and the two only happen to share a vertical
 * edge. See the head of `outputLevel.ts` for why they must not be the same.
 *
 * WHERE IT SITS. Under the visualizer switch, because it answers the question
 * that switch raises: the graph says what the sound is shaped like, this says
 * how loud it actually is. It takes the rest of that column, since a meter is
 * the rare control that is simply better tall — the same twenty decibels over
 * more pixels is more resolution, for nothing.
 */

import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import { LEVEL_FLOOR_DB, levelFraction, levelZone } from './outputLevel';

/**
 * Stable React keys for a list that is one or two entries and never reorders.
 *
 * Written out rather than indexed so the keys say which channel they are, and
 * so a mono capture's single bar keeps the same identity as the left one it
 * replaces instead of remounting when a stereo endpoint comes back.
 */
const CHANNEL_KEYS = ['left', 'right'] as const;

/**
 * What to call a bar.
 *
 * A single letter, and still a key: several of the ten locales do not use L and
 * R for this — Russian sound gear says Л and П, Chinese 左 and 右 — and the one
 * place a translator can say so is a dictionary entry. `M` is the honest label
 * for the case where Windows handed over a mono endpoint and there is genuinely
 * only one channel to show.
 */
const channelNameKey = (index: number, isStereo: boolean): TranslationKey => {
  if (!isStereo) {
    return 'graph.meter.mono';
  }
  return index === 0 ? 'graph.meter.left' : 'graph.meter.right';
};

/**
 * ONE HOME, IN THE SIDEBAR.
 *
 * It began as an overlay in the plot's right gutter and was briefly in both
 * places. Both was wrong for a reason worth keeping: a second copy of the same
 * reading, four inches from the first, is not context — it is a thing to
 * check against, and two meters that must always agree are two chances to
 * notice they do not. The sidebar one is the one somebody watches, so it is
 * the one that stays.
 */
const OutputLevelMeter = () => {
  // The readings, straight from the capture. This component re-renders with
  // every frame and nothing above it does — which is the entire arrangement.
  const { isClipping, outputLevels } = useLiveAudioFrame();
  const { t } = useTranslation();

  /*
   * ALWAYS DRAWN, AND VISIBLY OFF WHEN NOTHING IS LISTENING.
   *
   * It used to return null with no capture, on the sound argument that a bar
   * resting at the floor reads as "silence" while the truth is "nothing is
   * listening" — two different statements, and the meter should not tell the
   * first one.
   *
   * But it now takes the rest of the sidebar column, so returning nothing
   * collapsed the card and handed the space to the preamp slider: switching the
   * graph off resized a control on the other side of the panel, for no reason
   * anybody could see. Layout that depends on whether audio happens to be
   * flowing is worse than a meter that has to say what it is doing.
   *
   * So it always occupies its space, and says which of the two it means by
   * going dim. Empty tracks at rest, and a pair of them, because two is what
   * comes back when a capture starts.
   */
  const isIdle = outputLevels.length === 0;
  const channels = isIdle
    ? [
        { levelDb: LEVEL_FLOOR_DB, peakDb: LEVEL_FLOOR_DB },
        { levelDb: LEVEL_FLOOR_DB, peakDb: LEVEL_FLOOR_DB },
      ]
    : outputLevels;
  const isStereo = channels.length > 1;
  return (
    <div
      className={`output-meter${isClipping ? ' is-clipping' : ''}${
        isIdle ? ' is-idle' : ''
      }`}
      // One thing with one meaning, so it is announced once and its bars are
      // not read out as a list of empty boxes.
      //
      // No tooltip, because the strip is inert by design and a `title` nobody
      // can hover is a string that only exists in the markup. What it would
      // have said — that this is real dBFS and not the trace's own scale — is
      // in the label instead, where it reaches the one reader who cannot see
      // the colours.
      role="img"
      aria-label={t('graph.meter.aria')}
    >
      {channels.map((channel, index) => {
        // The fast bar and the held mark are coloured independently, because
        // they genuinely differ: the point of a peak-hold is that it is still
        // showing red a second after the bar has fallen back to green.
        const zone = levelZone(channel.levelDb, isClipping);
        const peakZone = levelZone(channel.peakDb, isClipping);
        const fill = levelFraction(channel.levelDb);
        const peak = levelFraction(channel.peakDb);
        return (
          <span
            className={`output-meter__channel is-${zone}`}
            key={CHANNEL_KEYS[index]}
          >
            <span className="output-meter__name" aria-hidden>
              {t(channelNameKey(index, isStereo))}
            </span>
            <span className="output-meter__track">
              {/*
               * Clipped rather than resized, and the difference is the whole
               * colour scheme. The fill carries the zone gradient at full
               * height and is revealed from the bottom up, so green, amber and
               * red stay pinned to the decibels they belong to. Given a height
               * instead, the gradient would be squashed into whatever the bar
               * currently is and a quiet passage would paint red at the top of
               * a bar sitting at −40 dBFS.
               */}
              <span
                className="output-meter__fill"
                style={{
                  clipPath: `inset(${((1 - fill) * 100).toFixed(2)}% 0 0 0)`,
                }}
              />
              <span
                className={`output-meter__peak is-${peakZone}`}
                style={{ bottom: `${(peak * 100).toFixed(2)}%` }}
              />
            </span>
          </span>
        );
      })}
    </div>
  );
};

export default OutputLevelMeter;
