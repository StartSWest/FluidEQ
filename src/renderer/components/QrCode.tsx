/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { useMemo } from 'react';
import { encodeQr, qrToPath } from 'common/qr';

interface IQrCodeProps {
  /** Exactly what the scanner will read: a URL, or a wallet URI. */
  value: string;
  /** Announced to screen readers in place of the image. */
  label: string;
  /** Rendered edge length in px. The matrix scales to fit. */
  size?: number;
}

/**
 * A scannable QR rendered from `value` at paint time.
 *
 * Generating it rather than shipping an image means the code can never drift
 * from the address or URL beside it — both come from the same config. The
 * light plate is deliberate: inverted codes defeat a good number of phone
 * cameras, so this one square stays out of the neon theme.
 */
export default function QrCode({ value, label, size = 116 }: IQrCodeProps) {
  const code = useMemo(() => {
    const matrix = encodeQr(value);
    return matrix
      ? { path: qrToPath(matrix), modules: matrix.length }
      : undefined;
  }, [value]);

  // Too long to encode at version 10. Better to show nothing than a code that
  // scans to the wrong destination.
  if (!code) {
    return null;
  }

  // The quiet zone is part of the spec, not padding: without it scanners lose
  // the finder patterns against a busy background.
  const quiet = 4;
  const extent = code.modules + quiet * 2;

  return (
    <svg
      className="qr-code"
      width={size}
      height={size}
      viewBox={`0 0 ${extent} ${extent}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={extent} height={extent} fill="#ffffff" rx={1} />
      <path
        d={code.path}
        fill="#050b12"
        transform={`translate(${quiet} ${quiet})`}
      />
    </svg>
  );
}
