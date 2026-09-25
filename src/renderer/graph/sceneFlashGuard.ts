import { SCENE_VERTEX_SOURCE } from '../../common/sceneUniformContract';

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
const MAX_FRAME_MS = 100;

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
const MAX_GAP_S = 1;

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
const GAP_MARGIN_S = 0.008;

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

const COLOUR_FUNCTIONS = `
vec3 lightOf(vec3 colour) {
  return pow(max(colour, vec3(0.0)), vec3(2.2));
}

float lumaOfLight(vec3 light) {
  return dot(light, vec3(0.2126, 0.7152, 0.0722));
}

// Saturated red: red light well above both green and blue.
float rednessOfLight(vec3 light) {
  return max(0.0, light.r - max(light.g, light.b));
}

float luma(vec3 colour) {
  return lumaOfLight(lightOf(colour));
}

float redness(vec3 colour) {
  return rednessOfLight(lightOf(colour));
}
`;

/**
 * How far a pixel has travelled one way, and which way, in one number.
 *
 * This used to be the direction alone, set only when ONE FRAME moved by a
 * tenth of full scale and faded otherwise — and that is what a flash was
 * recognised by. So a brightness spread over eleven frames or more moved by
 * under a tenth each time, set nothing, and left the memory to fade to
 * nothing; the instant drop at the end of the ramp then had nothing to
 * oppose, and a full-screen black-to-white strobe at three to five and a half
 * flashes a second — the exact band that provokes seizures — was drawn
 * exactly as its author wrote it. Ten characters of shader.
 *
 * Travel accumulates instead, decaying as it always did, so a slow rise is
 * remembered as the rise it is. A movement the other way starts the count
 * again from itself, which is what makes a turn after a rise a turn at all:
 * `flashStep` counts the rises that come after a fall of a tenth.
 */
const TRAVEL_FUNCTION = `
float flashTravel(float last, float swing, float decay) {
  float carried = last * swing < 0.0 ? swing : last * decay + swing;
  return abs(swing) >= ${FLASH_SWING.toFixed(3)}
    ? sign(swing)
    : clamp(carried, -1.0, 1.0);
}
`;

const STATE_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uLastFrame;
uniform sampler2D uState;
uniform float uDecay;
/** Seconds this frame took, for the gap between turns. */
uniform float uElapsed;
/** What the flashing flag is multiplied by over this frame. */
uniform float uFlashDecay;
in vec2 vUv;
out vec4 state;
${COLOUR_FUNCTIONS}${TRAVEL_FUNCTION}
void main() {
  vec3 now = textureLod(uCurrent, vUv, 1.0).rgb;
  vec3 before = textureLod(uLastFrame, vUv, 1.0).rgb;
  float lumaSwing = luma(now) - luma(before);
  float redSwing = redness(now) - redness(before);
  float swing = abs(redSwing) > abs(lumaSwing) ? redSwing : lumaSwing;
  vec4 old = textureLod(uState, vUv, 0.0);
  float lastSwing = old.g * 2.0 - 1.0;
  // Travel — see FLASH_PRESSURE_MEMORY_SOURCE, whose text this is.
  float remembered = ${FLASH_PRESSURE_MEMORY_SOURCE};
  // A TURN of that travel, not a swing: a flash is a pair of changes, and
  // counting changes counts a square wave twice a cycle against a ramp's
  // once. See flashStep, which is this.
  // A RISE, not either end of the pair: one of these a flash, evenly spaced
  // for a strobe and for a ramp that snaps back alike. See FLASH_PERIOD_S.
  float opposing = remembered > 0.0
    && lastSwing <= ${(-FLASH_SWING).toFixed(3)} ? 1.0 : 0.0;
  // Red counts the seconds SINCE the last turn, and the gap this turn closes
  // is everything since it, this frame included. Counting up rather than
  // decaying down is what lets eight bits hold it at any frame rate: a second
  // over 255 steps is 3.9 ms, and the number this has to resolve is a sixth
  // of a second. See flashStep for why the level it replaced could not.
  float gap = min(${MAX_GAP_S.toFixed(1)}, old.r + uElapsed);
  float tooSoon = opposing
    * (gap < ${(FLASH_PERIOD_S - GAP_MARGIN_S).toFixed(6)} ? 1.0 : 0.0);
  float sinceTurn = opposing > 0.5 ? 0.0 : gap;
  // Blue is whether this spot is flashing, kept apart from the gap so its
  // mips are the share of an area that is. Set outright by a turn that came
  // too soon and only smoothed on the way down, which is what a level built
  // up over turns could never be.
  // Holds while the pixel is still inside a period of its last rise, and
  // falls only once a whole one has gone by without one. Decaying between
  // rises let 3.75, 4 and 5 a second through in the dip — see flashStep.
  float held = gap < ${FLASH_PERIOD_S.toFixed(6)}
    ? old.b
    : old.b * uFlashDecay;
  float flashing = max(held, tooSoon);
  // Alpha is unused.
  state = vec4(sinceTurn, remembered * 0.5 + 0.5, flashing, 0.0);
}
`;

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

/**
 * The flag's mip level the calming reads: two levels of the half-size state,
 * so it follows a flashing area eight pixels at a time rather than one. Read
 * pixel by pixel, the flags along a tunnel's tiles and not between them
 * striped the calmed area with the picture's own dark gaps.
 */
const FLAG_LOD = 2;

/**
 * The calm field: every region's colour, followed no faster than the limit.
 *
 * Each texel reads the frame blurred to its own size, in light, and moves its
 * own colour toward that by at most the allowance, in luminance or in red,
 * whichever moved more. It is kept for every region all the time, not only
 * where something flashes, so a region that starts flashing is calmed from
 * the colour it had and not from a jump. A calmed pixel shows this field and
 * nothing else, so what it shows moves no faster than the limit whatever its
 * neighbours do — which is the whole of the protection, and why it holds at
 * any size of field.
 */
const CALM_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uCalm;
uniform float uLod;
uniform float uAllowance;
uniform float uFirst;
in vec2 vUv;
out vec4 calmOut;
${COLOUR_FUNCTIONS}
void main() {
  vec3 region = lightOf(textureLod(uCurrent, vUv, uLod).rgb);
  if (uFirst > 0.5) {
    calmOut = vec4(region, 1.0);
    return;
  }
  vec3 was = texture(uCalm, vUv).rgb;
  float change = max(
    abs(lumaOfLight(region) - lumaOfLight(was)),
    abs(rednessOfLight(region) - rednessOfLight(was)));
  calmOut = vec4(
    was + (region - was) * (change > uAllowance ? uAllowance / change : 1.0),
    1.0);
}
`;

const COMPOSITE_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uCalm;
uniform sampler2D uState;
uniform float uAreaLod;
in vec2 vUv;
out vec4 fragColor;
${COLOUR_FUNCTIONS}
void main() {
  vec4 current = texture(uCurrent, vUv);
  // How much of this pixel is flashing: its flag (FLAG_LOD), weighed by how
  // much of the area around it is flashing too (FLASH_AREA_START).
  vec2 reach = 0.5 * pow(2.0, uAreaLod) / vec2(textureSize(uState, 0));
  float area = 0.25 * (
      textureLod(uState, vUv + vec2(-reach.x, -reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2( reach.x, -reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2(-reach.x,  reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2( reach.x,  reach.y), uAreaLod).b);
  float flashing = textureLod(uState, vUv, ${FLAG_LOD.toFixed(1)}).b
    * smoothstep(${FLASH_AREA_START.toFixed(2)}, ${FLASH_AREA_FULL.toFixed(2)}, area);
  // Nothing flashing here: exactly what the scene drew.
  if (flashing <= 0.0) {
    fragColor = current;
    return;
  }
  float calmed = ${FLASH_CALM_WEIGHT_SOURCE};
  vec3 light = mix(lightOf(current.rgb), texture(uCalm, vUv).rgb, calmed);
  fragColor = vec4(pow(light, vec3(1.0 / 2.2)), current.a);
}
`;

export interface IFlashGuard {
  /** Point drawing at the offscreen frame. Call before the scene draws. */
  begin(width: number, height: number): void;
  /**
   * Limit what was drawn and put it on `destination` — the canvas when null,
   * or the upscaler's input when the scene is drawn smaller than its panel
   * (`sceneUpscale.ts`), so the limiter judges the picture at the size it
   * was drawn and the upscale reads what was shown.
   *
   * FALSE when it could not limit the frame, which is a GPU that would not
   * give it somewhere to draw. Every caller treats that the way it treats a
   * guard that could not be built at all — a member's scene is not shown. It
   * used to bind the destination and return, quietly, which put the scene on
   * the screen with no limiter at all and nothing said: the one place in this
   * file that failed OPEN, and the only one that mattered.
   */
  end(deltaMs: number, destination: WebGLFramebuffer | null): boolean;
  dispose(): void;
}

interface ITarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
}

const compile = (gl: WebGL2RenderingContext, kind: number, source: string) => {
  const shader = gl.createShader(kind);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const link = (gl: WebGL2RenderingContext, fragmentSource: string) => {
  const vertex = compile(gl, gl.VERTEX_SHADER, SCENE_VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

/**
 * `null` when the GPU cannot give it what it needs — the scene then must not
 * run. Which scenes are drawn through it is decided in `sceneRules.ts`, from
 * who made them, and nowhere else.
 */
export const createFlashGuard = (
  gl: WebGL2RenderingContext,
): IFlashGuard | null => {
  // The state has to be drawn into at half-float precision, and there is no
  // second-best. The red channel counts the seconds since a pixel last rose,
  // a frame at a time, and eight bits cannot carry that: a frame at sixty is
  // 4.25 steps of 255 and is stored as 4, so a gap of a third of a second
  // comes out six per cent short — enough to read three flashes a second, the
  // rate WCAG allows, as faster than three. Worse, the size of that error is
  // the frame rate: at 144 a frame is 1.77 steps and rounds UP by thirteen
  // per cent. That is the same frame-rate dependence this design exists to
  // remove, in a new place. Measured on the driver both ways.
  //
  // Refusing here is refusing to draw a member's scene at all, which is what
  // every other failure in this file does and is the only safe direction: a
  // scene nobody has watched is not shown without a working limiter.
  if (!gl.getExtension('EXT_color_buffer_float')) {
    return null;
  }
  const composite = link(gl, COMPOSITE_SOURCE);
  const stateProgram = link(gl, STATE_SOURCE);
  const calmProgram = link(gl, CALM_SOURCE);
  const vao = gl.createVertexArray();
  if (!composite || !stateProgram || !calmProgram || !vao) {
    return null;
  }
  const where = {
    current: gl.getUniformLocation(composite, 'uCurrent'),
    calm: gl.getUniformLocation(composite, 'uCalm'),
    state: gl.getUniformLocation(composite, 'uState'),
    areaLod: gl.getUniformLocation(composite, 'uAreaLod'),
  };
  const stateWhere = {
    current: gl.getUniformLocation(stateProgram, 'uCurrent'),
    lastFrame: gl.getUniformLocation(stateProgram, 'uLastFrame'),
    state: gl.getUniformLocation(stateProgram, 'uState'),
    decay: gl.getUniformLocation(stateProgram, 'uDecay'),
    elapsed: gl.getUniformLocation(stateProgram, 'uElapsed'),
    flashDecay: gl.getUniformLocation(stateProgram, 'uFlashDecay'),
  };
  const calmWhere = {
    current: gl.getUniformLocation(calmProgram, 'uCurrent'),
    calm: gl.getUniformLocation(calmProgram, 'uCalm'),
    lod: gl.getUniformLocation(calmProgram, 'uLod'),
    allowance: gl.getUniformLocation(calmProgram, 'uAllowance'),
    first: gl.getUniformLocation(calmProgram, 'uFirst'),
  };

  let width = 0;
  let height = 0;
  /** The scene's two frames: the one drawn this time, and the one before. */
  let frames: [ITarget, ITarget] | undefined;
  let drawn = 0;
  let hasFrame = false;
  let pressure: [ITarget, ITarget] | undefined;
  let pressureLatest = 0;
  /** The calm field (CALM_SOURCE), and whether it has been filled yet. */
  let calm: [ITarget, ITarget] | undefined;
  let calmLatest = 0;
  let hasCalm = false;

  const release = (target: ITarget | undefined) => {
    if (target) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
  };
  const releasePair = (pair: [ITarget, ITarget] | undefined) => {
    release(pair?.[0]);
    release(pair?.[1]);
  };

  const makeTarget = (
    targetWidth: number,
    targetHeight: number,
    mipmapped: boolean,
    /** Half floats, for the state and the calm field, which eight bits
     * cannot carry: a gap counted a frame at a time, and light moved by
     * a few thousandths a frame. */
    precise: boolean,
    /** What an untouched texel reads as. The state's travel means "no
     * swing" at a half, not at zero, which would read as a full swing down. */
    clear: readonly [number, number, number, number] = [0, 0, 0, 0],
  ): ITarget | undefined => {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) {
      return undefined;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      precise ? gl.RGBA16F : gl.RGBA8,
      targetWidth,
      targetHeight,
      0,
      gl.RGBA,
      precise ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null,
    );
    // Mipmapped: the region colour and the flashing share are read from high
    // levels. A texture that asks for levels it has never been given samples
    // as black, so every one is given them below and after each write.
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      mipmapped ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (mipmapped) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    return { texture, framebuffer, width: targetWidth, height: targetHeight };
  };

  const makePair = (
    targetWidth: number,
    targetHeight: number,
    mipmapped: boolean,
    precise: boolean,
    clear?: readonly [number, number, number, number],
  ): [ITarget, ITarget] | undefined => {
    const a = makeTarget(targetWidth, targetHeight, mipmapped, precise, clear);
    const b = makeTarget(targetWidth, targetHeight, mipmapped, precise, clear);
    if (a && b) {
      return [a, b];
    }
    release(a);
    release(b);
    return undefined;
  };

  /** One target's picture into another, scaled; the caller lifts the scissor. */
  const carry = (from: ITarget, to: ITarget, mipmapped: boolean) => {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to.framebuffer);
    gl.blitFramebuffer(
      0,
      0,
      from.width,
      from.height,
      0,
      0,
      to.width,
      to.height,
      gl.COLOR_BUFFER_BIT,
      gl.LINEAR,
    );
    if (mipmapped) {
      gl.bindTexture(gl.TEXTURE_2D, to.texture);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  };

  const resize = (nextWidth: number, nextHeight: number) => {
    const old = { frames, drawn, pressure, pressureLatest };
    width = nextWidth;
    height = nextHeight;
    // Clearing a new target and every carry below must reach every pixel.
    const scissored = gl.isEnabled(gl.SCISSOR_TEST);
    gl.disable(gl.SCISSOR_TEST);
    frames = makePair(width, height, true, false);
    pressure = makePair(
      Math.max(1, Math.ceil(width / 2)),
      Math.max(1, Math.ceil(height / 2)),
      true,
      true,
      // Red starts at the CAP, not at zero: it counts the seconds since the
      // last turn, and a fresh pixel has never turned. Cleared to zero it
      // would read as having turned this instant, and the first turn it ever
      // saw would come "too soon" after one that never happened — one cut on
      // a beat, on a scene just started, held as a flash. The travel means
      // "no swing" at a half; the flashing flag starts off; alpha is unused.
      [FLASH_STATE_REST.sinceTurn, 0.5, FLASH_STATE_REST.flashing, 0],
    );
    // The calm field is the same few texels at any size, laid over the frame,
    // so it goes on as it was; the last frame and the state are scaled into
    // the new size, so a panel resizing every frame is still limited.
    calm ??= makePair(FLASH_CALM_TEXELS, FLASH_CALM_TEXELS, false, true);
    if (hasFrame && old.frames && frames) {
      carry(old.frames[old.drawn], frames[drawn], true);
    } else {
      hasFrame = false;
    }
    if (old.pressure && pressure) {
      carry(old.pressure[old.pressureLatest], pressure[pressureLatest], true);
    }
    if (scissored) {
      gl.enable(gl.SCISSOR_TEST);
    }
    releasePair(old.frames);
    releasePair(old.pressure);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const updatePressure = (current: ITarget, last: ITarget, deltaMs: number) => {
    if (!pressure) {
      return;
    }
    const before = pressure[pressureLatest];
    const after = pressure[1 - pressureLatest];
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, current.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, last.texture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, before.texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, after.framebuffer);
    gl.viewport(0, 0, after.width, after.height);
    gl.useProgram(stateProgram);
    gl.bindVertexArray(vao);
    gl.uniform1i(stateWhere.current, 0);
    gl.uniform1i(stateWhere.lastFrame, 1);
    gl.uniform1i(stateWhere.state, 2);
    gl.uniform1f(stateWhere.decay, flashTravelDecay(deltaMs));
    gl.uniform1f(
      stateWhere.elapsed,
      Math.max(0, Math.min(MAX_FRAME_MS, deltaMs)) / 1000,
    );
    gl.uniform1f(stateWhere.flashDecay, flashingDecay(deltaMs));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Its levels are the share of each area that is flashing.
    gl.bindTexture(gl.TEXTURE_2D, after.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    pressureLatest = 1 - pressureLatest;
  };

  const updateCalm = (current: ITarget, deltaMs: number) => {
    if (!calm) {
      return;
    }
    const before = calm[calmLatest];
    const after = calm[1 - calmLatest];
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, current.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, before.texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, after.framebuffer);
    gl.viewport(0, 0, after.width, after.height);
    gl.useProgram(calmProgram);
    gl.bindVertexArray(vao);
    gl.uniform1i(calmWhere.current, 0);
    gl.uniform1i(calmWhere.calm, 1);
    // The frame blurred to the field's own patch size.
    gl.uniform1f(calmWhere.lod, flashCalmLod(width, height));
    gl.uniform1f(calmWhere.allowance, flashAllowance(deltaMs));
    gl.uniform1f(calmWhere.first, hasCalm ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    calmLatest = 1 - calmLatest;
    hasCalm = true;
  };

  return {
    begin: (nextWidth, nextHeight) => {
      if (nextWidth !== width || nextHeight !== height || !frames) {
        resize(nextWidth, nextHeight);
      }
      // Never the canvas as a fallback. Binding `null` where a target is
      // missing pointed the scene straight at what the listener sees, and
      // `end` then had nothing to limit: the scene was drawn raw. Where there
      // is no target the scene draws into no framebuffer at all, and `end`
      // says below that it could not do its job.
      const into = frames?.[1 - drawn].framebuffer;
      if (into) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, into);
      }
    },
    end: (deltaMs, destination) => {
      if (!frames || !pressure || !calm) {
        return false;
      }
      const current = frames[1 - drawn];
      const last = frames[drawn];

      // The state and the calm field reach every texel, whatever part of the
      // panel is on screen.
      const scissored = gl.isEnabled(gl.SCISSOR_TEST);
      gl.disable(gl.SCISSOR_TEST);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, current.texture);
      gl.generateMipmap(gl.TEXTURE_2D);
      if (hasFrame) {
        updatePressure(current, last, deltaMs);
      }
      updateCalm(current, deltaMs);
      if (scissored) {
        gl.enable(gl.SCISSOR_TEST);
      }

      // Straight onto the destination, under the same scissor the scene was
      // drawn with, so only the part of the panel on screen is touched.
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, current.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, calm[calmLatest].texture);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, pressure[pressureLatest].texture);
      gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
      gl.viewport(0, 0, width, height);
      gl.useProgram(composite);
      gl.bindVertexArray(vao);
      gl.uniform1i(where.current, 0);
      gl.uniform1i(where.calm, 1);
      gl.uniform1i(where.state, 2);
      gl.uniform1f(where.areaLod, flashAreaLod(width, height));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0);
      drawn = 1 - drawn;
      hasFrame = true;
      return true;
    },
    dispose: () => {
      releasePair(frames);
      releasePair(pressure);
      releasePair(calm);
      frames = undefined;
      pressure = undefined;
      calm = undefined;
      gl.deleteVertexArray(vao);
      gl.deleteProgram(composite);
      gl.deleteProgram(stateProgram);
      gl.deleteProgram(calmProgram);
    },
  };
};
