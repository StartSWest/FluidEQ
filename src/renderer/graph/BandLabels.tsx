import { useRef } from 'react';
import type { AxisScale, NumberValue } from 'd3';
import type { IEditableChartPoint } from './ChartController';
import { handleXInPlot } from './bandHandlePosition';
import {
  genrePinBox,
  ILabelBox,
  layoutBandLabels,
  rememberLabels,
  IBandLabelAnchor,
  ILabelBounds,
  ILaidLabel,
  TLabelMemory,
} from './bandLabelLayout';
import { useGraphBandLabelsHidden } from '../utils/graphViewSettings';
import frequencyText from '../utils/frequencyText';
import '../styles/BandLabels.scss';

interface IProps {
  points: IEditableChartPoint[];
  xScale: AxisScale<NumberValue>;
  yScale: AxisScale<NumberValue>;
  bounds: ILabelBounds;
  /**
   * The genre pins on the Preset line, where the graph draws them
   * (`useGenrePinSpots`): every label keeps clear of each one and its badge.
   */
  pins?: ReadonlyArray<{ hz: number; db: number }>;
  /**
   * Where a measuring view's key stands on the plot, when one is painted
   * (`legendPlace.ts`): a bass band's label below its dot sat on it.
   */
  legend?: ILabelBox;
  /**
   * The window's count of whole-EQ replacements — a preset, Clear EQ, a
   * reset, another output (`bandSetReplacement`). The labels start over from
   * a fresh layout when it moves and the bands with it (Ivan, 2026-10-03:
   * "resetting the EQ need to reset labels too").
   */
  bandSetReplacement: number;
}

interface IAnchor extends IBandLabelAnchor {
  point: IEditableChartPoint;
  title: string;
  qualityLabel: string;
  gainLabel: string;
}

interface ILaidOut {
  key: string;
  labels: Array<{ box: ILaidLabel; anchor: IAnchor }>;
  memory: TLabelMemory;
  replacement: number;
  bands: string;
}

const number = (value: number) => String(Math.round(value * 100) / 100);

/** A separate overlay: labels never participate in curve generation or editing. */
export default function BandLabels({
  points,
  xScale,
  yScale,
  bounds,
  pins = [],
  legend,
  bandSetReplacement,
}: IProps) {
  const hidden = useGraphBandLabelsHidden();
  // The last layout and its memory: each label's home and where it stood, so
  // a drag carries its own label with its dot, a label in its way steps
  // aside only while it is, and nothing else moves (`bandLabelLayout.ts`).
  const laidOut = useRef<ILaidOut | undefined>(undefined);

  const anchors: IAnchor[] = hidden
    ? []
    : points.flatMap((point) => {
        if (!point.parameters) {
          return [];
        }
        const { gain, quality } = point.parameters;
        const title = frequencyText(point.parameters.frequency);
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
            isActive: point.selected,
          },
        ];
      });
  const obstacles = [
    ...pins.map(({ hz, db }) =>
      genrePinBox(Number(xScale(hz)), Number(yScale(db))),
    ),
    ...(legend ? [legend] : []),
  ];
  // Laid out again only when something a label shows or stands on moved, or
  // the EQ was replaced. Hovering a band rebuilds the points it is handed,
  // and re-solving the whole plot for that was work for nothing on every
  // pointer move; selecting one moves no dot, so it is not in here either.
  const key = [
    ...anchors.map(
      (anchor) =>
        `${anchor.id}|${Math.round(anchor.x)}|${Math.round(anchor.y)}|${anchor.title}|${anchor.qualityLabel}|${anchor.gainLabel}|${anchor.point.isEnabled}`,
    ),
    ...obstacles.map(
      (box) =>
        `keep-off|${Math.round(box.x)}|${Math.round(box.y)}|${Math.round(box.width)}|${Math.round(box.height)}`,
    ),
    `${bounds.left}|${bounds.top}|${bounds.right}|${bounds.bottom}`,
    `replaced|${bandSetReplacement}`,
  ].join(';');
  if (laidOut.current?.key !== key) {
    const before = laidOut.current;
    const bands = anchors
      .map(
        ({ id, point }) =>
          `${id}|${point.parameters?.frequency}|${point.parameters?.gain}|${point.parameters?.quality}|${point.isEnabled}`,
      )
      .join(';');
    // A replacement that changed the bands starts the labels over: their
    // homes were found for a curve that is gone. One that changed nothing —
    // the state re-read after a Tone or cut change — keeps them.
    const previous =
      before &&
      (before.replacement === bandSetReplacement || before.bands === bands)
        ? before.memory
        : undefined;
    const boxes = layoutBandLabels(anchors, bounds, { previous, obstacles });
    const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]));
    laidOut.current = {
      key,
      labels: boxes.flatMap((box) => {
        const anchor = byId.get(box.id);
        return anchor ? [{ box, anchor }] : [];
      }),
      memory: rememberLabels(boxes, anchors, previous),
      replacement: bandSetReplacement,
      bands,
    };
  }
  const { labels } = laidOut.current;

  return (
    <g className="eq-band-labels" pointerEvents="none" aria-hidden="true">
      {labels.map(({ box, anchor }) => {
        const lineX = Math.max(
          box.x + 8,
          Math.min(box.x + box.width - 8, anchor.x),
        );
        const above = box.place.isAbove;
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
