/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The palette's second to seventh colours (`Rainbow.scss`); the pill itself
 * wears the first.
 */
const FACE_STOPS = [2, 3, 4, 5, 6, 7] as const;

/**
 * The faces the lit Colourful pill fades between as it runs through the
 * palette (`Euphoria.scss`): one per colour after the first, each with the
 * pill's label, laid exactly over it. Fading one over another is the
 * compositor's work, where changing the pill's colour on every frame was the
 * main thread's. Hidden from assistive technology, which reads the pill's own
 * label once; drawn only while the pill is lit in Colourful mode.
 */
export default function EuphoriaPillFaces({ label }: { label: string }) {
  return (
    <span className="euphoria-pill__faces" aria-hidden="true">
      {FACE_STOPS.map((stop) => (
        <span key={stop} className="euphoria-pill__face">
          {label}
        </span>
      ))}
    </span>
  );
}
