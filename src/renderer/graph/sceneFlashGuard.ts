/**
 * The brightness limiter every member's scene is drawn through.
 *
 * A picture that flashes more than three times a second can trigger a seizure
 * in somebody with photosensitive epilepsy, and a member's scene is shown to
 * other people without anybody having watched it first. So this pass measures
 * brightness on the GPU and limits how fast the picture may change where it
 * could flash. WCAG 2.3.1 counts a flash as a pair of opposing swings of at
 * least 10 %, and a general or a red flash alike.
 *
 * Where it flashes: each pixel (at half resolution) keeps the SECONDS SINCE it
 * last rose — since how far it has travelled one way, in luminance or in
 * saturated red, turned from falling to rising. A rise less than a flash's
 * period behind the last one is a flash too soon, and where that is true AND
 * flashing covers a share of the area around it (`FLASH_AREA_START`), the
 * pixel is calmed. A rise and not a swing, because a flash is a PAIR of
 * changes: see `flashStep`.
 *
 * CALMED, NEVER BLENDED. A calmed pixel shows the calm field
 * (`FLASH_CALM_TEXELS`): the picture blurred to a sixty-fourth of the frame,
 * each patch of it following this frame's colour no faster than
 * `FLASH_LIMIT_PER_SECOND`. The flashing detail goes soft, the colours and
 * shapes stay, and nothing of the last picture's detail is put on the screen
 * again.
 *
 * It used to blend the last picture shown into the new one, and that is a
 * ghost: a pixel held back shows what was there before, so on a scene moving
 * fast the previous frame's detail is painted over this one. Hyperdrive at
 * three times its pace came out with its old rings of tiles smeared across
 * the new ones; Crystal at four times carried a second, torn outline of its
 * gem; the Dancing Cat at twice its pace, mottled and doubled. Motion cannot
 * be told from flashing pixel by pixel — a limb swinging back and forth over
 * a bright floor is, at every pixel it crosses, a flash — so whatever a limit
 * does to a pixel it does to motion too, and a remedy that reads the pixel's
 * past draws that past. This one reads the past only through the calm field,
 * where a moving thing is a soft patch of its own colour.
 *
 * There was a second limit, across the frame, on the average of those
 * quarter-frame cells where it reversed. Measured on the driver it held only
 * the one frame a picture turned on, and the picture arrived on the next, so
 * it never changed what reached the screen; applied as a calming, it would
 * have had to touch every pixel of a cell, flashing or not. It is gone.
 *
 * How: the scene draws into one of two offscreen textures, the other holding
 * its last frame. A state pass compares them and updates that state; the calm
 * field follows the new frame. The composite draws onto the canvas, calming
 * what flashes and passing everything else exactly as drawn. A new size
 * carries the last frame and the state across, scaled, and the calm field is
 * the same patches at any size, so a panel resizing every frame is still
 * limited.
 *
 * Official scenes do not go through this: they are watched before release.
 * NOT UNIT-TESTED beyond its arithmetic, for the same reason as `sceneGl.ts` —
 * jsdom has no WebGL. Measured in Chrome at the Studio's 1460x603 against a
 * whole-frame strobe, 8-, 32- and 128-square inverting checkerboards, a
 * red-grey flash and a quarter-frame strobe (all held), and a moving dot, a
 * jittering edge, sparkles and a beat (all left as drawn), and on FluidEQ's
 * Alpine, Aurora, Jellyfish and Ember, drawn as without it.
 *
 * HELD, every one down to a fifth of a flash a second on screen: a square
 * strobe and a ramp that snaps back at 3.75, 4, 5, 6 and 10 flashes a second;
 * an isoluminant slide from grey to saturated red and back — relative
 * luminance pinned at 0.2126 the whole way, so a measure of luminance alone
 * sees a still picture — at 4.6 and 4 a second; a red square at 4; half the
 * frame flickering ten times a second.
 *
 * LEFT ALONE, every one at the whole of its own swing: a square strobe at
 * exactly three a second, which is WCAG's own boundary and allowed; a beat at
 * 150 BPM as a square, as a ramp and as a red ramp; a beat pulsing at 2 a
 * second; a ramp at 2; a picture breathing at 1; a bar sweeping across a dark
 * frame; and the strips a sixteenth and an eighth of the frame flickering ten
 * times a second — 100 % and 100 % — which are the flame tips and the sparkles
 * this has twice been sent back for smearing.
 *
 * NONE OF THAT MOVES WITH THE FRAME RATE. Measured on the driver at 30, 60,
 * 144 and 240 frames a second: nought of twenty-five wrong at every one of
 * them. The design before this was right only at 60 — eleven of twenty-five
 * wrong at 144, including shapes held completely at 60 — and that was the
 * largest thing wrong in this file for as long as it has existed.
 *
 * WHAT CHANGED, and why the old shape could not be repaired. The per-pixel
 * half used to integrate turns into a PRESSURE and read its level. "More than
 * three flashes a second" is not a level, it is a statement about the time
 * between flashes, and a level failed in two measured ways:
 *
 * - It gained per flash and lost a fixed step per FRAME, because that step is
 *   the least an 8-bit channel can fall by. So its drain ran at the monitor's
 *   rate while its gain did not.
 * - A level cannot be quick, separating and smooth at once. Searched over
 *   every step and memory, with every shape run fifty seconds so nothing was
 *   read before it settled, the widest band between what must be held and what
 *   must be left alone was 0.038 within fourteen turns — under half a step, a
 *   switch rather than a ramp — and reached only 0.138 by thirty turns, which
 *   is 1.5 s of onset at ten flashes a second and 4.3 s at three and a half.
 *   Nothing under fourteen turns separated the shapes at all.
 *
 * So the red channel now counts the SECONDS SINCE the pixel last rose, and a
 * rise closer than a period behind the last one is a flash too soon. Rises
 * only, not both ends of the pair: a ramp that snaps back turns at the snap
 * and again on the very next frame as the rise begins, so measured from turn
 * to turn that pair is a frame apart at any rate at all, and a shape flashing
 * twice a second reads as thirty. Counting rises gives one a flash, evenly
 * spaced, for a strobe and a ramp alike — rise to rise IS the flash period.
 *
 * The flag HOLDS while the pixel is still inside a period of its last rise
 * and falls only after a whole one without one. Letting it decay between
 * rises was measured and is wrong: at 3.75 a second it fell to 0.59 between
 * them, and the flash arrived in the dip — 3.75, 4 and 5 all reached the
 * screen at their full rate while 6 and 10 were held.
 *
 * The state is drawn at HALF FLOAT, and there is no second-best; without the
 * extension this guard refuses to exist and the scene is not shown. Eight
 * bits were tried and cannot carry a gap accumulated a frame at a time: at 60
 * a frame is 4.25 steps of 255 and lands as 4, so a third of a second came out
 * six per cent short and read three flashes a second as faster than three,
 * while at 144 a frame is 1.77 steps and rounds up by thirteen. That is the
 * same frame-rate dependence this replaced, in a new place.
 *
 * Both passes are run frame by frame on a real driver over the sequences
 * above, counting the opposing swings of a tenth or more that REACH THE
 * SCREEN rather than the blend on any one frame — the arithmetic tests
 * measure the snap and cannot see the frames after it, which is how this file
 * was once believed to be holding things it was not.
 *
 * The red slide was open until 2026-09-18 and took four tries to close, all
 * measured, because three of them look obvious and are wrong:
 * - redness in the coarse measure holds the snap frame ONLY — `alternating` is
 *   a product of two consecutive frames, so the picture arrives on the next
 *   one. 4.6 to 4.5.
 * - `pow(pixelBlend, flashing)` instead of the mix closes the old 3.75 case
 *   and takes a third of the swing off that flickering eighth of a frame.
 * - counting turns of the travel, on its own, fixed red and broke the
 *   luminance ramps at 3.75 and 4.
 * What closed it was the counting AND what the count is worth, together: see
 * flashPressure for the first and FLASH_SWING_PRESSURE for the second. The
 * third piece was already here — FLASH_LIMIT_PER_SECOND had to come down
 * first, or a ramp gets its whole flash from its rise and the pressure never
 * gets a say.
 */

/**
 * How fast a calmed region's colour may move: of full relative luminance, or
 * of saturated red, per second.
 *
 * 0.35, not the 0.5 this was. Both are under the 0.6 that three flashes a
 * second need, but 0.5 is not under it by enough: a picture that RISES over a
 * whole cycle and snaps back is allowed 0.5 x the cycle by the rise alone,
 * which at 3.75 flashes a second is 0.133 — past the tenth WCAG counts as a
 * flash, so the shape got its swing without the snap ever being let through.
 * That was the one rate left over the line in the measurements below, at 3.2
 * flashes a second against a bound of 3.
 *
 * At 0.35 the same rise delivered 0.093 — and then 0.28, because what this
 * limiter hands on is not what the listener sees. The picture is judged at the
 * size the scene drew it and the finishing chain scales it up to the panel
 * (`scenePost.ts`): EASU, then RCAS, a five-tap sharpen with a negative lobe,
 * then FXAA. Measured on the real passes at their shipped strength, on a
 * checkerboard held to exactly 0.093: the sharpen alone returns 0.183, and
 * after the smoothing that follows it, 0.115 at two-pixel cells and 0.101 at
 * four and eight — over the tenth WCAG counts, from a swing this file had
 * called safe. One-pixel cells come out at 0.034; the smoothing eats those.
 *
 * So the budget carries the chain's worst measured gain: 0.28 x 0.267 = 0.075
 * over a cycle at 3.75 flashes a second, x1.24 through the chain, 0.093 on the
 * glass. What it costs, measured on the driver over every sequence in the
 * header: nothing. Not one picture that must be left alone moves — a beat at
 * 150 BPM, a ramp at two a second, a breathing picture, a bar sweeping across
 * and the strips a sixteenth and an eighth of the frame flickering ten times a
 * second all keep exactly the share of their swing they kept at 0.5. A tighter
 * limit only bites where the guard was already holding.
 */
export const FLASH_LIMIT_PER_SECOND = 0.28;

/** A stalled frame earns no extra allowance: the change it permits is capped. */
export const MAX_FRAME_MS = 100;

/** How far a calmed region's colour may move this frame. */
export const flashAllowance = (deltaMs: number): number =>
  (FLASH_LIMIT_PER_SECOND * Math.max(0, Math.min(MAX_FRAME_MS, deltaMs))) /
  1000;

/**
 * The share of its move toward this frame's colour a calmed region makes, so
 * a move of `change` — in luminance or in red, whichever is larger — comes to
 * at most `allowance`. Mirrors COMPOSITE_SOURCE.
 */
export const flashCalmShare = (change: number, allowance: number): number =>
  Math.abs(change) > allowance ? allowance / Math.abs(change) : 1;

/** The smallest swing WCAG counts as part of a flash: a tenth of full scale. */
export const FLASH_SWING = 0.1;

/**
 * How far a pixel has travelled one way, and which way, carried into the next
 * frame. Mirrors `flashTravel` in the shader; see its comment for why this is
 * travel and not the last direction.
 */
export const flashTravelled = (
  travelled: number,
  swing: number,
  decay: number,
): number => {
  // One swing big enough to be a flash on its own still counts whole and at
  // once, as it always did — that is what makes the smallest pair WCAG counts
  // a flash. Anything smaller adds up instead of being thrown away.
  if (Math.abs(swing) >= FLASH_SWING) {
    return Math.sign(swing);
  }
  const carried = travelled * swing < 0 ? swing : travelled * decay + swing;
  return Math.max(-1, Math.min(1, carried));
};

/**
 * Flashes a second WCAG 2.3.1 allows, and the time between them that means.
 *
 * ONLY TURNS ONE WAY ARE COUNTED — where the travel reverses from falling to
 * rising. A flash is a PAIR of opposing changes, so counting both ends of the
 * pair counts each flash twice, and the two ends are not evenly spaced: a
 * picture that slides up over a whole cycle and snaps back turns at the snap
 * and again on the very next frame as the rise begins. Measured from turn to
 * turn, that pair is a frame apart at any rate at all, and a shape flashing
 * twice a second — which is allowed — reads as if it were flashing thirty
 * times. Counting the rises alone gives one count a flash, evenly spaced, for
 * a strobe and a ramp alike: rise to rise IS the flash period.
 *
 * So the test is the time from one rise to the next, against a whole period.
 * Strictly shorter, so a picture sitting exactly on three a second is left
 * alone — the standard allows three.
 */
export const FLASHES_ALLOWED_PER_SECOND = 3;
export const FLASH_PERIOD_S = 1 / FLASHES_ALLOWED_PER_SECOND;

/**
 * The longest gap the state can hold, in seconds.
 *
 * The red channel counts UP from a turn instead of decaying towards one, and
 * that is the whole reason this design works in eight bits where the pressure
 * it replaces did not. A pressure had to lose a little every frame, and at
 * 144 frames a second a frame's worth of loss is far under one step of 255,
 * so it was rounded away and the limiter went deaf above about ninety.
 * Counting up has no such floor: a second spread over 255 steps is 3.9ms a
 * step, and even at 240 frames a second one frame is 1.06 steps. The number
 * it has to resolve is a sixth of a second, which is step 43 of 255.
 *
 * A second is far more range than the test needs and keeps the arithmetic in
 * a channel's own 0..1. Anything longer reads as "a second or more ago",
 * which is every answer this asks.
 */
export const MAX_GAP_S = 1;

/**
 * How much shorter than a period a gap has to be before it counts.
 *
 * A picture at exactly three flashes a second is ALLOWED, and its gap is
 * exactly one period, so the test sits on a knife edge that any drift falls
 * off. Eight milliseconds puts the limit at about 3.07 flashes a second
 * instead of 3.00 — clear of the drift that accumulating a frame at a time
 * leaves in a half float, and far below the 3.75 that is the slowest thing
 * this has ever had to hold.
 *
 * It is NOT a fudge for the storage. That was tried: with the gap in eight
 * bits a frame at sixty is 4.25 steps of 255 and lands as 4, so a third of a
 * second came out six per cent short and no margin fixed it, because at 144 a
 * frame is 1.77 steps and rounds the other way. See `createFlashGuard`.
 */
export const GAP_MARGIN_S = 0.008;

/**
 * Seconds for the flashing flag to fall to 1/e once the flashing stops.
 *
 * It rises to full on one qualifying turn — instantly, which is what the
 * pressure could never do — and only the fall is smoothed. That asymmetry is
 * the point: a level built up over turns cannot be quick, separating and
 * smooth at once (measured: within 14 turns the widest band between held and
 * free shapes was 0.038, less than half one step), and a flag that is set
 * rather than accumulated is all three.
 *
 * Half a second holds through the gaps of anything still flashing — a strobe
 * at four a second turns every 125ms and never falls below 0.78 — and lets go
 * about a second and a half after it stops. The pressure it replaces took
 * four seconds, which is the scene staying dim long after a flash that Ivan
 * reported seeing.
 */
const FLASHING_MEMORY_S = 0.5;

/** What the flashing flag is multiplied by over a frame of `deltaMs`. */
export const flashingDecay = (deltaMs: number): number =>
  Math.exp(
    -Math.max(0, Math.min(MAX_FRAME_MS, deltaMs)) / 1000 / FLASHING_MEMORY_S,
  );

/**
 * How far this pixel has travelled one way, which is what the pressure counts
 * the turns of. Travel, exactly like the coarse memory: a rise made of steps
 * each too small to be a flash on its own is still a rise, and that is the
 * whole reason a picture can slide somewhere and snap back unnoticed.
 *
 * It was one frame's swing, decaying — and then a swing under a tenth set
 * nothing at all, so an isoluminant slide from grey to saturated red and back
 * never raised the pressure by a step. Measured on the driver: 4.6 flashes a
 * second drawn, 4.6 on the screen, at every rate.
 *
 * The rule is written twice, here and as GLSL beside it, because the suite
 * cannot run a shader; `sceneFlashGuardMemory.test.ts` holds the two spellings
 * to each other, which is what nothing did when they last drifted apart.
 */
export const FLASH_PRESSURE_MEMORY_SOURCE = `flashTravel(lastSwing, swing, uDecay)`;

/**
 * Seconds for a pixel's travel — which way it has been going — to fall to
 * 1/e. Its own memory, not the flashing flag's: this is how long a rise has
 * to be remembered for the fall after it to count as a turn, and it has to
 * outlast the slowest pair worth catching.
 */
const TRAVEL_SECONDS = 4;

/** What the travel memory is multiplied by over a frame of `deltaMs`. */
export const flashTravelDecay = (deltaMs: number): number =>
  Math.exp(
    -Math.max(0, Math.min(MAX_FRAME_MS, deltaMs)) / 1000 / TRAVEL_SECONDS,
  );

export const flashPressureMemory = (
  swing: number,
  lastSwing: number,
  deltaMs: number,
): number => flashTravelled(lastSwing, swing, flashTravelDecay(deltaMs));

/** A pixel's state after one frame: what the state pass keeps about it. */
export interface IFlashState {
  /**
   * Seconds since this pixel last turned round, capped at `MAX_GAP_S`. A
   * fresh pixel starts at the cap, so the first turn it ever sees is never
   * too soon after a turn that never happened.
   */
  sinceTurn: number;
  /** Whether it is flashing: 1 on a turn that came too soon, decaying after. */
  flashing: number;
}

/**
 * One frame of a pixel's state, as the state pass computes it. Mirrors
 * STATE_SOURCE.
 *
 * MEASURING THE GAP, not building a level. "More than three flashes a second"
 * is a statement about the INTERVAL between turns, and the pressure this
 * replaces integrated turns and read a level instead — the wrong instrument,
 * and it failed in two measured ways. It went deaf above about ninety frames
 * a second, because it lost a little every frame against a gain taken per
 * flash and eight bits cannot hold a frame's worth of loss at 144. And a
 * level cannot be quick, separating and smooth at once: searched over every
 * step and memory, within fourteen turns the widest band between what must be
 * held and what must be left alone was 0.038, under half of one step, so it
 * was either a switch that flickered on and off or a ramp that took seconds
 * to arrive. Both are gone here, because neither is a property of a gap.
 *
 * A TURN, not a swing. WCAG counts a flash as a PAIR of opposing changes, and
 * counting the changes counts a square wave twice a cycle — it turns at both
 * edges — against once for a picture that slides up and snaps back, whose
 * rise is spread too thin to be a change at all. Counting where the TRAVEL
 * turns round scores both at two: the strobe at each edge, the ramp at its
 * snap and again on the first step of the rise after it.
 *
 * Restarting the travel from that first step is its own refractory period —
 * after a turn the picture must travel a tenth again before another counts —
 * so a jittering pixel cannot trip this.
 *
 * ONE TURN CANNOT SET IT. The gap from a pixel that has been still is the
 * cap, which is never under `TURN_GAP_S`, so a single cut on a beat is not a
 * flash; it takes a second turn close behind the first. That falls out of
 * measuring the gap and needed no rule of its own.
 */
export const flashStep = (
  state: IFlashState,
  swing: number,
  lastSwing: number,
  deltaMs: number,
): IFlashState => {
  const elapsed = Math.max(0, Math.min(MAX_FRAME_MS, deltaMs)) / 1000;
  const turned = flashPressureMemory(swing, lastSwing, deltaMs);
  // A rise: the travel was falling by at least a flash's worth and is now
  // going up. One of these a flash, evenly spaced — see FLASH_PERIOD_S.
  const rose = turned > 0 && lastSwing <= -FLASH_SWING;
  // The period this rise closes: everything since the last one, this frame
  // included. Capped, so a pixel that has been still for a minute reads the
  // same as one still for a second — every answer this asks of it.
  const gap = Math.min(MAX_GAP_S, state.sinceTurn + elapsed);
  const tooSoon = rose && gap < FLASH_PERIOD_S - GAP_MARGIN_S;
  // The flag HOLDS while the pixel is still inside a period of its last
  // rise, and only starts falling once a whole one has gone by without one.
  //
  // Decaying it between rises was measured on the driver and is wrong: a
  // shape at 3.75 a second rises every 267ms, and over that the flag fell to
  // 0.59, which is the weight the limit is applied with — so the flash
  // arrived in the dip, and 3.75, 4 and 5 a second all reached the screen at
  // their full rate while 6 and 10 were held. Holding it is not a fudge, it
  // is the question: a pixel whose last rise was less than a period ago is
  // flashing faster than three a second, and that is true continuously, not
  // only on the frames it rises.
  const held =
    gap < FLASH_PERIOD_S
      ? state.flashing
      : state.flashing * flashingDecay(deltaMs);
  return {
    sinceTurn: rose ? 0 : gap,
    // Set outright, and only the fall is smoothed.
    flashing: Math.max(held, tooSoon ? 1 : 0),
  };
};

/** What a pixel nothing has happened to yet holds. */
export const FLASH_STATE_REST: IFlashState = {
  sinceTurn: MAX_GAP_S,
  flashing: 0,
};

/**
 * How much of the picture has to be flashing together before any of it is
 * held: a share of a window a quarter of the frame's longer side across.
 *
 * WCAG 2.3.1 counts flashing by area — a quarter of any 10° field of view,
 * about a quarter-screen window. Flame tips, a ridge riding the level and
 * scattered sparkles all alternate at three flashes a second and more, pixel
 * by pixel; held wherever they did, every scene in the Studio and the gallery
 * tore into frozen shards along exactly the lines that move, while the graph
 * drew the same scenes cleanly. A strobe, an inverting checkerboard or a red
 * flash across a region fills the window, and is held.
 *
 * Starting at a fifth rather than at the quarter itself, and whole only past
 * a third, because a fire's flames flicker in red over a quarter of a window
 * or so without anything flashing as a whole: on FluidEQ's Ember at 1460x603,
 * 0.12-0.25 still held a patch of flame, 0.2-0.35 left 0.6% of the picture
 * faintly softer and nothing visible, while every strobe and checkerboard
 * above was still held. The window is sampled from a mip of the flags, so the
 * share rises and falls smoothly across the frame rather than cell by cell.
 */
export const FLASH_AREA_WINDOW = 4;
export const FLASH_AREA_START = 0.2;
export const FLASH_AREA_FULL = 0.35;

/**
 * The mip level of the half-size flag texture whose texels are half a window
 * across, so four taps half a texel either side of a pixel cover one window.
 */
export const flashAreaLod = (width: number, height: number): number =>
  Math.max(0, Math.log2(Math.max(width, height) / (FLASH_AREA_WINDOW * 4)));

/**
 * How much of a pixel is calmed, from how much of it is flashing — its flag,
 * weighed by the share of the area around it that is flashing too, 0..1.
 *
 * The cube of that, not the share itself. Where a flash is whole the two
 * agree. At the edges of one — the area gate's ramp, a flag letting go after
 * the flashing stops — the share alone took a tenth off the swing of an
 * eighth of the frame flickering ten times a second, which is a fire's flame
 * tips, which WCAG leaves alone and which this has twice been sent back for
 * smearing. The blend this replaced got its gentleness there for nothing, by
 * converging over the flat frames between swings; a calming does not
 * converge, it takes the same share every frame. Measured on the driver: the
 * eighth keeps all of its swing with the cube, 89 % with the share, and 97 %
 * under the old blend, and everything that must be held still is.
 */
export const FLASH_CALM_WEIGHT_SOURCE = 'flashing * flashing * flashing';

/** `FLASH_CALM_WEIGHT_SOURCE`, as arithmetic. */
export const flashCalmWeight = (flashing: number): number => flashing ** 3;

/**
 * Texels across each side of the calm field, whatever the panel's size or
 * shape: each is a sixty-fourth of the frame.
 *
 * Chosen by looking, because the two ends fail in opposite ways. At eight
 * across — a region of a quarter of the frame, where this started — a calmed
 * pixel took the colour of a whole corner of the picture: the Dancing Cat at
 * twice its pace, whose fur and bouncing edges read as flashing, came out as
 * a grey blob where its body was. At a hundred and twenty-eight the field is
 * fine enough to hold a picture of its own, and holds on to it: an inverting
 * checkerboard stayed on the screen as its first frame, which is safe and is
 * also the old blend's lag coming back, only blurred. At sixty-four the cat
 * keeps its orange coat and its white chest and only goes soft where it
 * flickers, Crystal at four times its pace keeps a gem where the blend tore
 * it in two, and a checkerboard or a strobe is held as firmly as ever.
 */
export const FLASH_CALM_TEXELS = 64;

/** The mip level of a `width x height` frame whose texels are a calm patch. */
export const flashCalmLod = (width: number, height: number): number =>
  Math.max(0, Math.log2(Math.max(width, height) / FLASH_CALM_TEXELS));
