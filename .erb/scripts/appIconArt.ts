/**
 * The app icon, Wave + Lagoon, as SVG in each of its three frames
 * (`src/common/appIconFrame.ts`). The large frame is `assets/icon.svg` byte
 * for byte; the small and mid frames are the same drawing with the tile grown
 * towards the canvas, the edge thickened, the hairline left out, and the wave
 * and its glow scaled with the tile. `make-app-icons.ts` writes and rasterises
 * them.
 */
import {
  APP_ICON_GRID,
  type IAppIconFrame,
  type IAppIconRing,
} from '../../src/common/appIconFrame';

const CENTRE = APP_ICON_GRID / 2;

/**
 * A superellipse |x|^5 + |y|^5 = r^5 around the centre, as a closed path of
 * 240 points: the outline `assets/icon.svg` has always been drawn with.
 */
export const squircle = (radius: number, points = 240): string => {
  const parts: string[] = [];
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = CENTRE + radius * Math.sign(cos) * Math.abs(cos) ** (2 / 5);
    const y = CENTRE + radius * Math.sign(sin) * Math.abs(sin) ** (2 / 5);
    parts.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${parts.join('')}Z`;
};

/** Lagoon, the icon's seven stops (held to the palette by lagoonIcon.test). */
const LAGOON = [
  '#72f7dd',
  '#00e5cf',
  '#00dbe6',
  '#00ccf5',
  '#27b8ff',
  '#51a3ff',
  '#7a95ff',
];

const lagoonStops = LAGOON.map(
  (colour, index) =>
    `<stop offset="${(index / (LAGOON.length - 1)).toFixed(3)}" stop-color="${colour}"/>`,
);

const WAVE = 'M112 256C160 144 208 144 256 256C304 368 352 368 400 256';

const ring = ({ radius, width }: IAppIconRing, paint: string): string =>
  `<path d="${squircle(radius)}" fill="none" ${paint} stroke-width="${width}"/>`;

/** One frame of the icon as a complete SVG document. */
export const appIconSvg = (frame: IAppIconFrame): string => {
  const body = squircle(frame.body);
  const wave = [
    `<path d="${WAVE}" stroke="url(#g)" stroke-width="64" stroke-linecap="round" fill="none" opacity=".55" filter="url(#blur)"/>`,
    `<path d="${WAVE}" stroke="url(#g)" stroke-width="48" stroke-linecap="round" fill="none"/>`,
    `<path d="${WAVE}" stroke="#fff" stroke-opacity=".45" stroke-width="9" stroke-linecap="round" fill="none" transform="translate(0 -10)" stroke-dasharray="0 34 150 400"/>`,
  ];
  // Scaled about the centre, so the wave keeps its place in a larger tile.
  const scale = frame.glyphScale;
  const glyph =
    scale === 1
      ? wave
      : [
          `<g transform="matrix(${scale.toFixed(5)} 0 0 ${scale.toFixed(5)} ${(CENTRE * (1 - scale)).toFixed(3)} ${(CENTRE * (1 - scale)).toFixed(3)})">`,
          ...wave,
          '</g>',
        ];
  return `${[
    `<svg viewBox="0 0 ${APP_ICON_GRID} ${APP_ICON_GRID}" width="${APP_ICON_GRID}" height="${APP_ICON_GRID}" xmlns="http://www.w3.org/2000/svg" fill="none">`,
    '<defs>',
    '<linearGradient id="bg" x1="80" y1="30" x2="430" y2="490" gradientUnits="userSpaceOnUse">',
    '<stop stop-color="#101722"/>',
    '<stop offset=".5" stop-color="#080b11"/>',
    '<stop offset="1" stop-color="#030508"/>',
    '</linearGradient>',
    '<radialGradient id="depth" cx="256" cy="300" r="250" gradientUnits="userSpaceOnUse">',
    '<stop stop-color="#00d1f1" stop-opacity=".22"/>',
    '<stop offset=".6" stop-color="#00d1f1" stop-opacity=".05"/>',
    '<stop offset="1" stop-color="#00d1f1" stop-opacity="0"/>',
    '</radialGradient>',
    '<linearGradient id="sheen" x1="256" y1="20" x2="256" y2="250" gradientUnits="userSpaceOnUse">',
    '<stop stop-color="#fff" stop-opacity=".07"/>',
    '<stop offset="1" stop-color="#fff" stop-opacity="0"/>',
    '</linearGradient>',
    '<linearGradient id="edge" x1="40" y1="40" x2="472" y2="472" gradientUnits="userSpaceOnUse">',
    ...lagoonStops,
    '</linearGradient>',
    '<clipPath id="clip">',
    `<path d="${body}"/>`,
    '</clipPath>',
    '<linearGradient id="g" x1="112" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">',
    ...lagoonStops,
    '</linearGradient>',
    '<filter id="blur" x="-30%" y="-30%" width="160%" height="160%">',
    '<feGaussianBlur stdDeviation="16"/>',
    '</filter>',
    '</defs>',
    `<path d="${body}" fill="url(#bg)"/>`,
    '<g clip-path="url(#clip)">',
    '<rect width="512" height="512" fill="url(#depth)"/>',
    '<rect width="512" height="250" fill="url(#sheen)"/>',
    '</g>',
    ...glyph,
    ring(frame.rim, 'stroke="url(#edge)"'),
    ...(frame.hairline
      ? [ring(frame.hairline, 'stroke="#fff" stroke-opacity=".06"')]
      : []),
    '</svg>',
  ].join('\n')}\n`;
};
