/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * One drawing per standing slide, in the same hand as the Share Audio
 * diagram: panels, screens, the accent for what is live. Drawn rather than
 * captured because a capture of any of these tabs carries the user's own
 * files, accounts or songs, and because a drawing does not go stale when a
 * button moves.
 *
 * All five share a 400×260 box and the `.tour-art` classes; the numbers are
 * placed by eye and mean nothing beyond this file.
 */

const BOX = '0 0 400 260';

/** Six album tiles and the player bar under them. */
export function LibraryArt() {
  const tiles = [
    [24, 24],
    [144, 24],
    [264, 24],
    [24, 118],
    [144, 118],
    [264, 118],
  ];
  return (
    <svg className="tour-art" viewBox={BOX} aria-hidden="true">
      {tiles.map(([x, y], index) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <rect
            className={`tour-art__tile tour-art__tile--${index % 3}`}
            width="112"
            height="78"
            rx="10"
          />
          {index === 1 && (
            <g transform="translate(56 39)">
              <circle className="tour-art__accent-fill" r="16" />
              <path className="tour-art__ink" d="M-5 -8 L9 0 L-5 8 Z" />
            </g>
          )}
        </g>
      ))}
      <rect
        className="tour-art__panel"
        x="24"
        y="212"
        width="352"
        height="30"
        rx="8"
      />
      <circle className="tour-art__accent-fill" cx="50" cy="227" r="9" />
      <path className="tour-art__ink" d="M47 222 L55 227 L47 232 Z" />
      <line className="tour-art__track" x1="76" y1="227" x2="356" y2="227" />
      <line className="tour-art__accent" x1="76" y1="227" x2="196" y2="227" />
      <circle className="tour-art__accent-fill" cx="196" cy="227" r="4" />
    </svg>
  );
}

/** A rack of four stage cards, each with a curve and two knobs. */
export function DspArt() {
  const curves = [
    'M14 30 C 40 30, 50 12, 80 12 S 120 30, 150 30',
    'M14 32 C 50 32, 60 8, 90 14 S 130 34, 150 22',
    'M14 18 L 60 18 C 80 18, 80 34, 100 34 L 150 34',
    'M14 26 C 30 10, 50 40, 70 24 S 110 10, 150 26',
  ];
  return (
    <svg className="tour-art" viewBox={BOX} aria-hidden="true">
      {curves.map((d, index) => (
        <g key={d} transform={`translate(24 ${20 + index * 56})`}>
          <rect className="tour-art__panel" width="352" height="46" rx="9" />
          <rect
            className="tour-art__accent-fill"
            x="0"
            y="0"
            width="4"
            height="46"
            rx="2"
          />
          <rect
            className="tour-art__screen"
            x="16"
            y="6"
            width="164"
            height="34"
            rx="6"
          />
          <path className="tour-art__wave" d={d} transform="translate(16 2)" />
          <circle className="tour-art__knob" cx="230" cy="23" r="12" />
          <line
            className="tour-art__accent"
            x1="230"
            y1="23"
            x2={230 + 8 * Math.cos(-2.2 + index * 0.9)}
            y2={23 + 8 * Math.sin(-2.2 + index * 0.9)}
          />
          <circle className="tour-art__knob" cx="280" cy="23" r="12" />
          <line
            className="tour-art__accent"
            x1="280"
            y1="23"
            x2={280 + 8 * Math.cos(-0.6 - index * 0.7)}
            y2={23 + 8 * Math.sin(-0.6 - index * 0.7)}
          />
          <rect
            className={
              index === 2 ? 'tour-art__toggle-off' : 'tour-art__toggle'
            }
            x="316"
            y="15"
            width="28"
            height="16"
            rx="8"
          />
          <circle
            className="tour-art__ink"
            cx={index === 2 ? 324 : 336}
            cy="23"
            r="5"
          />
        </g>
      ))}
    </svg>
  );
}

/** A lyric line, then the pitch lane with note blocks and the live voice. */
export function KaraokeArt() {
  const words = [
    [24, 54, false],
    [86, 70, true],
    [164, 46, true],
    [218, 78, false],
    [304, 60, false],
  ] as const;
  const notes = [
    [24, 168, 44],
    [76, 150, 36],
    [120, 182, 60],
    [188, 140, 40],
    [236, 158, 52],
    [296, 172, 30],
    [334, 150, 42],
  ];
  return (
    <svg className="tour-art" viewBox={BOX} aria-hidden="true">
      <rect
        className="tour-art__panel"
        x="24"
        y="20"
        width="352"
        height="84"
        rx="10"
      />
      {words.map(([x, width, sung]) => (
        <rect
          key={x}
          className={sung ? 'tour-art__accent-fill' : 'tour-art__word'}
          x={x + 16}
          y="52"
          width={width}
          height="20"
          rx="5"
        />
      ))}
      <rect
        className="tour-art__screen"
        x="24"
        y="120"
        width="352"
        height="120"
        rx="10"
      />
      {notes.map(([x, y, width]) => (
        <rect
          key={`${x}-${y}`}
          className="tour-art__note"
          x={x + 8}
          y={y}
          width={width}
          height="10"
          rx="3"
        />
      ))}
      <path
        className="tour-art__wave"
        d="M32 175 C 52 172, 60 158, 84 156 S 120 190, 150 186 S 190 146, 220 144 S 260 166, 288 164 S 320 178, 340 160 S 366 150, 372 154"
      />
    </svg>
  );
}

/** The maker's timeline: a waveform, word markers, the playhead. */
export function KaraokeMakerArt() {
  const bars = Array.from({ length: 44 }, (_, index) => {
    const phase = index / 44;
    const height =
      10 + 42 * Math.abs(Math.sin(phase * 9.4) * Math.cos(phase * 3.1));
    return [32 + index * 7.8, height] as const;
  });
  const markers = [54, 104, 150, 212, 262, 318];
  return (
    <svg className="tour-art" viewBox={BOX} aria-hidden="true">
      <rect
        className="tour-art__panel"
        x="24"
        y="20"
        width="352"
        height="56"
        rx="10"
      />
      {markers.map((x, index) => (
        <rect
          key={x}
          className={index === 2 ? 'tour-art__accent-fill' : 'tour-art__word'}
          x={x}
          y="38"
          width={index === 3 ? 40 : 34}
          height="20"
          rx="5"
        />
      ))}
      <rect
        className="tour-art__screen"
        x="24"
        y="92"
        width="352"
        height="148"
        rx="10"
      />
      {bars.map(([x, height]) => (
        <rect
          key={x}
          className="tour-art__bar"
          x={x}
          y={166 - height / 2}
          width="4"
          height={height}
          rx="2"
        />
      ))}
      {markers.map((x) => (
        <line
          key={`tick-${x}`}
          className="tour-art__tick"
          x1={x}
          y1="100"
          x2={x}
          y2="232"
        />
      ))}
      <line className="tour-art__accent" x1="166" y1="96" x2="166" y2="236" />
      <path className="tour-art__accent-fill" d="M160 96 L172 96 L166 104 Z" />
    </svg>
  );
}

/** A browser frame: site chips, a video, and the response curve under it. */
export function OnlineMediaArt() {
  // Site chips, as [x, width]; the first is the one that is open.
  const chips: Array<[number, number]> = [
    [40, 70],
    [118, 46],
    [172, 62],
    [242, 48],
    [298, 40],
  ];
  return (
    <svg className="tour-art" viewBox={BOX} aria-hidden="true">
      <rect
        className="tour-art__panel"
        x="24"
        y="20"
        width="352"
        height="220"
        rx="12"
      />
      {chips.map(([x, width]) => (
        <rect
          key={x}
          className={x === 40 ? 'tour-art__accent-fill' : 'tour-art__word'}
          x={x}
          y="32"
          width={width}
          height="16"
          rx="8"
        />
      ))}
      <rect
        className="tour-art__screen"
        x="40"
        y="60"
        width="320"
        height="120"
        rx="8"
      />
      <circle className="tour-art__accent-fill" cx="200" cy="120" r="22" />
      <path className="tour-art__ink" d="M193 108 L213 120 L193 132 Z" />
      <path
        className="tour-art__wave"
        d="M40 214 C 80 214, 100 196, 140 198 S 200 222, 240 214 S 300 190, 360 204"
      />
      <line className="tour-art__track" x1="40" y1="214" x2="360" y2="214" />
    </svg>
  );
}

/** Four forms of the same spectrum, one of them being edited. */
export function CustomLooksArt() {
  // Ten columns of one spectrum: where each stands, how tall, which stop of
  // the rainbow. The x is the column's identity across all four tiles.
  const columns = [18, 34, 52, 44, 60, 38, 30, 46, 24, 16].map(
    (height, index) => ({ x: 18 + index * 14, height, hue: index % 5 }),
  );
  const tiles = [
    [24, 24],
    [204, 24],
    [24, 148],
    [204, 148],
  ];
  return (
    <svg className="tour-art" viewBox={BOX} aria-hidden="true">
      {tiles.map(([x, y], index) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <rect
            className={index === 3 ? 'tour-art__panel-lit' : 'tour-art__panel'}
            width="172"
            height="100"
            rx="10"
          />
          <rect
            className="tour-art__screen"
            x="10"
            y="10"
            width="152"
            height="80"
            rx="6"
          />
          {index === 0 &&
            columns.map(({ x, height, hue }) => (
              <rect
                key={x}
                className={`tour-art__spectrum tour-art__spectrum--${hue}`}
                x={x}
                y={84 - height}
                width="9"
                height={height}
                rx="2"
              />
            ))}
          {index === 1 && (
            <path
              className="tour-art__spectrum-line"
              d={`M18 ${84 - columns[0].height} ${columns
                .map(({ x, height }) => `L${x + 4} ${84 - height}`)
                .join(' ')} L162 84 L18 84 Z`}
            />
          )}
          {index === 2 &&
            columns.map(({ x, height, hue }) => (
              <circle
                key={x}
                className={`tour-art__spectrum tour-art__spectrum--${hue}`}
                cx={x + 4}
                cy={84 - height}
                r="4"
              />
            ))}
          {index === 3 &&
            columns.map(({ x, height }) =>
              Array.from({ length: Math.round(height / 8) }, (_, row) => (
                <rect
                  key={`${x}-${80 - row * 8}`}
                  className={`tour-art__spectrum tour-art__spectrum--${row % 5}`}
                  x={x}
                  y={80 - row * 8}
                  width="9"
                  height="5"
                  rx="1"
                />
              )),
            )}
        </g>
      ))}
      {/* The editor's hand: a colour ramp and a slider under the lit tile. */}
      <g transform="translate(204 252)">
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            className={`tour-art__spectrum tour-art__spectrum--${i}`}
            x={i * 20}
            y="0"
            width="16"
            height="6"
            rx="2"
          />
        ))}
        <line className="tour-art__track" x1="112" y1="3" x2="172" y2="3" />
        <circle className="tour-art__accent-fill" cx="150" cy="3" r="4" />
      </g>
    </svg>
  );
}
