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
 * The output level meter, down the right-hand edge of the plot.
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
 * WHY IT OVERLAYS RATHER THAN SITS BESIDE. The plot already keeps thirty pixels
 * of air on its right, so with the grid on this lands in that gutter and takes
 * nothing at all from the frequency axis. With the grid off there is no gutter
 * and it lays over the last of the treble — which is the right trade in a mode
 * whose whole point is that the drawing has stopped being a measurement.
 */

import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import { levelFraction, levelZone } from './outputLevel';

/**
 * How far down the card the strip has to start to clear the legend row.
 *
 * The controls float over the top right of the plot at eight pixels with
 * twenty-eight-pixel buttons, and they are right-aligned — so they sit exactly
 * where the top of this would otherwise be, and the top of a meter is the part
 * that must never be hidden. Taken as a floor rather than as the position, so
 * an already lower plot is left where it is.
 */
const LEGEND_CLEARANCE_PX = 42;
/** Air between the strip and the card's right edge. */
const EDGE_GAP_PX = 4;

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

interface IOutputLevelMeterProps {
  /** Where the plot's drawing area starts and ends inside the card. */
  plotTop: number;
  plotBottom: number;
}

const OutputLevelMeter = ({ plotTop, plotBottom }: IOutputLevelMeterProps) => {
  // The readings, straight from the capture. This component re-renders with
  // every frame and nothing above it does — which is the entire arrangement.
  const { isClipping, outputLevels } = useLiveAudioFrame();
  const { t } = useTranslation();

  // No capture, no meter. Not a bar sitting at the floor: that would read as
  // "silence", and "there is nothing listening" is a different statement.
  if (outputLevels.length === 0) {
    return null;
  }

  const isStereo = outputLevels.length > 1;
  return (
    <div
      className={`output-meter${isClipping ? ' is-clipping' : ''}`}
      style={{
        top: Math.max(plotTop, LEGEND_CLEARANCE_PX),
        bottom: plotBottom,
        insetInlineEnd: EDGE_GAP_PX,
      }}
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
      {outputLevels.map((channel, index) => {
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
