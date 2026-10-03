import { useMemo } from 'react';
import type { AxisScale, NumberValue } from 'd3';
import type { IEditableChartPoint } from './ChartController';
import { handleXInPlot } from './bandHandlePosition';
import { layoutBandLabels, ILabelBounds } from './bandLabelLayout';
import { useGraphBandLabelsHidden } from '../utils/graphViewSettings';
import '../styles/BandLabels.scss';

interface IProps {
  points: IEditableChartPoint[];
  xScale: AxisScale<NumberValue>;
  yScale: AxisScale<NumberValue>;
  bounds: ILabelBounds;
}

const number = (value: number) => String(Math.round(value * 100) / 100);
const frequency = (value: number) =>
  value >= 1000 ? `${number(value / 1000)} kHz` : `${number(value)} Hz`;

/** A separate overlay: labels never participate in curve generation or editing. */
export default function BandLabels({ points, xScale, yScale, bounds }: IProps) {
  const hidden = useGraphBandLabelsHidden();
  const { left, right, top, bottom } = bounds;
  const labels = useMemo(() => {
    if (hidden) {
      return [];
    }
    const prepared = points.flatMap((point) => {
      if (!point.parameters) {
        return [];
      }
      const { gain, quality } = point.parameters;
      const title = frequency(point.parameters.frequency);
      const qualityLabel = `Q ${number(quality)}`;
      const gainLabel = `${gain > 0 ? '+' : ''}${number(gain)} dB`;
      return [
        {
          point,
          title,
          qualityLabel,
          gainLabel,
          id: point.id,
          x: handleXInPlot(Number(xScale(point.data.x)) || 0, xScale.range()),
          y: Number(yScale(point.data.y)) || 0,
          width: Math.max(
            48,
            title.length * 5.6 + 10,
            qualityLabel.length * 4.9 + 10,
            gainLabel.length * 5.6 + 10,
          ),
          height: 36,
          // Hover/focus must never reshuffle the readouts around other dots.
          priority: 0,
        },
      ];
    });
    const byId = new Map(prepared.map((entry) => [entry.id, entry]));
    return layoutBandLabels(prepared, { left, right, top, bottom }).flatMap(
      (box) => {
        const anchor = byId.get(box.id);
        return anchor ? [{ box, anchor }] : [];
      },
    );
  }, [points, xScale, yScale, left, right, top, bottom, hidden]);

  return (
    <g className="eq-band-labels" pointerEvents="none" aria-hidden="true">
      {labels.map(({ box, anchor }) => {
        const lineX = Math.max(
          box.x + 8,
          Math.min(box.x + box.width - 8, anchor.x),
        );
        const above = box.y + box.height <= anchor.y;
        return (
          <g
            key={box.id}
            className={`eq-band-label${anchor.point.isEnabled ? '' : ' is-disabled'}`}
          >
            <path
              className="eq-band-label__leader"
              d={`M${anchor.x},${anchor.y + (above ? -9 : 9)} L${lineX},${above ? box.y + box.height : box.y}`}
            />
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              rx={4}
            />
            <text
              x={box.x + box.width / 2}
              y={box.y + 10}
              className="eq-band-label__frequency"
              textAnchor="middle"
            >
              {anchor.title}
            </text>
            <text
              x={box.x + box.width / 2}
              y={box.y + 21}
              className="eq-band-label__quality"
              textAnchor="middle"
            >
              {anchor.qualityLabel}
            </text>
            <text
              x={box.x + box.width / 2}
              y={box.y + 32}
              className="eq-band-label__gain"
              textAnchor="middle"
            >
              {anchor.gainLabel}
            </text>
          </g>
        );
      })}
    </g>
  );
}
