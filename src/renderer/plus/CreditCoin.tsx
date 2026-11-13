import type { ReactNode } from 'react';
import { BRAND_MARK } from 'common/branding';
import '../styles/CreditCoin.scss';

/**
 * A credit, drawn as the site draws it (FluidEQ-Site's
 * `partials/credit-coin.html`, Ivan 2026-11-13: "put the coin we use on the
 * site there", "the 3D one"): a struck coin with FluidEQ's wave on its face
 * and a milled edge under it, floating in a slow orbit of its own, with what
 * it counts on a solid badge beside it — the badge, not the face, because a
 * digit struck in the face turned with the coin and was hard to read.
 *
 * `l` carries the orbit, the pulse and the sparks; `m` is the coin alone,
 * for a card's corner. Scenery: every word it stands for is in the copy
 * beside it.
 */
export default function CreditCoin({
  size,
  badge,
}: {
  size: 'l' | 'm';
  badge: ReactNode;
}) {
  return (
    <span className={`credit-coin credit-coin--${size}`} aria-hidden="true">
      {size === 'l' && (
        <>
          <span className="credit-coin__orbit">
            <i />
            <i />
          </span>
          <span className="credit-coin__pulse" />
        </>
      )}
      <span className="credit-coin__coin">
        <span className="credit-coin__edge" />
        <span className="credit-coin__face">
          <svg viewBox="0 0 512 512" fill="none">
            <circle className="credit-coin__rim" cx="256" cy="256" r="214" />
            <circle
              className="credit-coin__rim credit-coin__rim--inner"
              cx="256"
              cy="256"
              r="186"
            />
            <g className="credit-coin__dots">
              <circle cx="256" cy="56" r="5" />
              <circle cx="456" cy="256" r="5" />
              <circle cx="256" cy="456" r="5" />
              <circle cx="56" cy="256" r="5" />
            </g>
            {/* The app icon's wave (`BRAND_MARK`), struck across the face. */}
            <g transform="translate(16 16) scale(10)">
              <path className="credit-coin__glow" d={BRAND_MARK.path} />
              <path className="credit-coin__wave" d={BRAND_MARK.path} />
            </g>
          </svg>
        </span>
        <span className="credit-coin__sheen" />
      </span>
      {size === 'l' && (
        <>
          <span className="credit-coin__spark credit-coin__spark--one" />
          <span className="credit-coin__spark credit-coin__spark--two" />
        </>
      )}
      <span className="credit-coin__badge">{badge}</span>
    </span>
  );
}
