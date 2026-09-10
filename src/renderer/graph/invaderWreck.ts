import { BURST, PixelRect, SHIP, spriteRects } from 'common/graphInvaders';

/**
 * The last ship coming apart.
 *
 * Its own pixels, flung out from the middle — the fast ones furthest,
 * slowing as they go and sinking a little, each one shrinking as it burns
 * out — in the hull's, canopy's and stripes' own colours, so what flies
 * apart is recognisably the fighter rather than a stock explosion pasted
 * over the spot where it was. A fireball of the cabinet's burst sprite
 * swells behind the debris and burns down to embers.
 *
 * A pure function of the wreck's age: nothing is simulated, so a paused
 * song holds the debris exactly where it was.
 */

/**
 * The wreck flies this long before the next game's ship arrives. Long
 * enough to read as the ship dying, short enough that the fight is not
 * left without its hero for a whole bar.
 */
export const EXPLODE_LIFE = 1.2;
/** Sparks thrown out of the blast. */
const SPARKS = 36;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

const rects = (path: Path2D, list: readonly PixelRect[]) => {
  list.forEach(([x, y, w, h]) => path.rect(x, y, w, h));
};

export const createWreckPaths = (
  centreX: number,
  centreY: number,
  ship: number,
  age: number,
) => {
  const t = Math.max(0, Math.min(1, age / EXPLODE_LIFE));
  // Out fast and settling, the way debris from a blast actually travels.
  const out = 1 - (1 - t) ** 3;
  const size = ship * (1 - t * 0.65);
  const hull = new Path2D();
  const canopy = new Path2D();
  const stripes = new Path2D();
  const layers: Record<string, Path2D> = { X: hull, C: canopy, R: stripes };
  SHIP.frames[0].forEach((row, r) => {
    [...row].forEach((glyph, c) => {
      const layer = layers[glyph];
      if (!layer) {
        return;
      }
      const dx = c - (SHIP.width - 1) / 2;
      const dy = r - (SHIP.height - 1) / 2;
      const seed = r * 31 + c * 7;
      const heading = Math.atan2(dy, dx) + (noise(seed) - 0.5) * 1.3;
      const reach = ship * (8 + noise(seed + 3) * 30);
      const x = centreX + dx * ship + Math.cos(heading) * reach * out;
      const y =
        centreY +
        dy * ship +
        Math.sin(heading) * reach * out +
        ship * 10 * t * t;
      layer.rect(x - size / 2, y - size / 2, size, size);
    });
  });

  // The blast: the cabinet's burst sprite at the heart, swelling a little,
  // and a ring of sparks thrown out faster than the debris. The burst
  // stays near a ship pixel in size — scaled up to a fireball it became a
  // wall of brown squares twice the ship's width, which read as a glitch.
  const heart = new Path2D();
  const grow = ship * (0.6 + out * 0.7);
  rects(
    heart,
    spriteRects(
      BURST.frames[0],
      centreX,
      centreY - (BURST.height * grow) / 2,
      grow,
    ),
  );
  const fire = new Path2D();
  const spark = ship * 0.7 * (1 - t);
  for (let index = 0; index < SPARKS; index += 1) {
    const heading = (index / SPARKS) * Math.PI * 2 + noise(index * 13) * 0.5;
    const reach = ship * (16 + noise(index * 5 + 1) * 30);
    fire.rect(
      centreX + Math.cos(heading) * reach * out - spark / 2,
      centreY + Math.sin(heading) * reach * out - spark / 2 + ship * 6 * t * t,
      spark,
      spark,
    );
  }

  return {
    hull,
    canopy,
    stripes,
    fire,
    heart,
    /** 1 as it goes up, 0 when the last ember is out. */
    glow: 1 - t,
    /** The first tenth of a second is a white flash. */
    flash: age < 0.1,
  };
};

export type WreckPaths = ReturnType<typeof createWreckPaths>;
