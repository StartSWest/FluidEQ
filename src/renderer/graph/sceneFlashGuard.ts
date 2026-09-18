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
 * Two limits, each for what the other cannot see:
 *
 * - Across the frame: relative luminance, averaged over cells about a quarter
 *   of the frame across, may move at most half of full scale per second —
 *   below the 0.6 that three flashes need — WHERE IT IS REVERSING. A beat
 *   still reads; a strobe of the whole picture does not. Averages cannot see
 *   a pattern: a checkerboard of squares an eighth across, inverting every
 *   frame, kept every cell's average where it was and passed untouched.
 *
 *   Reversing, because a flash is a PAIR of opposing swings and a cell's
 *   average moves just as fast when something bright simply crosses it.
 *   Limiting every fast change alike smeared motion badly: measured here,
 *   Hyperdrive at three times its pace showed 29 % of each new frame and lost
 *   a third of its picture, Crystal at four times showed half — and Crystal
 *   was slowed down in its own shader to work around it. Only the second
 *   swing of a pair is held, so at most one un-opposed swing of a strobe
 *   reaches the screen: half a flash, where WCAG allows three.
 * - Where it alternates, over enough of the picture: each pixel (at half
 *   resolution) keeps a pressure that every TURN of the picture — where how
 *   far it has travelled one way, in luminance or in saturated red, reverses —
 *   pushes up and time lets down. Where pressure is high AND flashing covers a
 *   share of the area around it (`FLASH_AREA_START`), the pixel may change no
 *   faster than the frame limit. A turn and not a swing, because a flash is a
 *   PAIR of changes: see `flashPressure`.
 *
 * How: the scene draws into one of two offscreen textures, the other holding
 * its last frame. A state pass compares them and updates the pressure. The
 * composite blends the last picture shown toward the new one by just enough
 * for both limits, and the result is copied to the canvas. A new size carries
 * the last picture shown, the last frame and the pressure across, scaled, so
 * a panel resizing every frame is still limited.
 *
 * Official scenes do not go through this: they are watched before release.
 * NOT UNIT-TESTED beyond its arithmetic, for the same reason as `sceneGl.ts` —
 * jsdom has no WebGL. Measured in Chrome at the Studio's 1460x603 against a
 * whole-frame strobe, 8-, 32- and 128-square inverting checkerboards, a
 * red-grey flash and a quarter-frame strobe (all held), and a moving dot, a
 * jittering edge, sparkles and a beat (all left as drawn), and on FluidEQ's
 * Alpine, Aurora, Jellyfish and Ember, drawn as without it.
 *
 * Both passes are run frame by frame on a real driver over known sequences,
 * counting the opposing swings of a tenth or more that REACH THE SCREEN rather
 * than the blend on any one frame — the arithmetic tests measure the snap and
 * cannot see the frames after it, which is how this file was once believed to
 * be holding things it was not. Every number below is from that harness.
 *
 * HELD. A square strobe at 3.75, 4, 5, 6 and 10 flashes a second comes out at
 * 1.4, 1.2, 1.0, 1.0 and 0.8. A ramp that rises over a whole cycle and snaps
 * back, at the same rates, at 1.4, 1.2, 1.0, 0.8 and 0.6. An isoluminant slide
 * from grey to saturated red and back — relative luminance pinned at 0.2126
 * the whole way, so the frame limit sees a still picture — at 4.6 and 4 a
 * second, 1.0 and 1.2. A red square at 4, 1.4. Half the frame flickering ten
 * times a second, 0.8.
 *
 * LEFT ALONE, every one at the whole of its own swing: a beat at 150 BPM as a
 * square, as a ramp and as a red ramp; a beat pulsing at 2 a second; a ramp at
 * 2; a picture breathing at 1; a bar sweeping across a dark frame; and the
 * strips a sixteenth and an eighth of the frame flickering ten times a second
 * — 100 % and 97 % — which are the flame tips and the sparkles this has twice
 * been sent back for smearing.
 *
 * At exactly three a second, WCAG's own boundary, a square arrives at 2.4 and
 * a red ramp at 2.2, both with their brightness range untouched: held a little
 * where holding is conservative rather than wrong.
 *
 * EVERY NUMBER ABOVE IS AT SIXTY FRAMES A SECOND, and the per-pixel half of
 * this guard does not hold at other rates. It is not a calibration that wants
 * nudging; it is structural, it predates all of this, and it is the largest
 * thing still wrong here.
 *
 * The pressure gains per FLASH and loses PRESSURE_FLOOR per FRAME — the step
 * an 8-bit texture needs before rounding lets it fall at all. So the drain is
 * fps/255 a second while the gain is not, and the rate at which holding begins
 * moves with the monitor. Measured on the driver at 144 frames a second, with
 * the same sequences the header lists: eleven of twenty-five come out wrong,
 * including shapes held completely at 60 — an isoluminant red square at four
 * flashes a second among them. Modelled over 30 to 240, the per-pixel path is
 * dead from about 90 up, and over-eager at 30, where it touches pictures that
 * must be left alone.
 *
 * Three cures were modelled and none works: making the drain per-second dies
 * at 90 and 120 and saturates at 240; no pairing of step size and memory
 * length separates the rates; and even with the drain gone entirely and exact
 * arithmetic, a red slide at 3.5 flashes a second and one at 2.5 sit 0.16
 * against 0.20 — the wrong way round. The 8-bit state is the root of the
 * first two, so the honest fix starts by giving the pressure a half-float
 * target and dropping the floor, after which the economy is frame-rate free
 * by construction and can be re-derived. What is left after that is a product
 * question and not an engineering one: no threshold separates a red slide at
 * 3.5 a second from one at 2.5, so somebody has to choose which of the two to
 * be wrong about.
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
 * Of full relative luminance, per second, where the picture is reversing.
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

/** How far the coarse luminance may move this frame. */
export const flashAllowance = (deltaMs: number): number =>
  (FLASH_LIMIT_PER_SECOND * Math.max(0, Math.min(MAX_FRAME_MS, deltaMs))) /
  1000;

/**
 * The share of the new frame to show over the last one, so a coarse luminance
 * change of `change` moves by at most `allowance`. Mirrors the shader below.
 */
export const flashBlend = (change: number, allowance: number): number =>
  Math.abs(change) > allowance ? allowance / Math.abs(change) : 1;

/** The mip level whose texels cover roughly a quarter of the frame. */
export const flashLod = (width: number, height: number): number =>
  Math.max(0, Math.log2(Math.max(width, height) / 4));

/** The smallest swing WCAG counts as part of a flash: a tenth of full scale. */
export const FLASH_SWING = 0.1;

/**
 * Seconds in which the memory of the last coarse swing falls to 1/e: the
 * period of three flashes a second, so a reversal slower than the rate WCAG
 * forbids meets nothing to oppose and is left alone.
 */
const COARSE_SECONDS = 1 / 3;

/** What the memory of the last coarse swing is multiplied by over a frame. */
export const flashCoarseDecay = (deltaMs: number): number =>
  Math.exp(
    -Math.max(0, Math.min(MAX_FRAME_MS, deltaMs)) / 1000 / COARSE_SECONDS,
  );

/**
 * How far the picture has travelled one way, and which way, carried into the
 * next frame. Mirrors `flashTravel` in the shader; see its comment for why
 * this is travel and not the last direction.
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
 * Which way the coarse luminance has been moving, and how far, carried into
 * the next frame. Mirrors the alpha channel of STATE_SOURCE.
 *
 * It used to be the direction alone, set only when ONE FRAME swung by a tenth
 * of full scale — and a brightness ramped over eleven frames or more swings
 * by less than that every time, so it set nothing and the memory faded to
 * nothing. The instant drop at the end of such a ramp then had nothing to
 * oppose: a full-screen strobe at three to five and a half flashes a second,
 * the band that provokes seizures, went through untouched.
 */
export const flashCoarseMemory = (
  swing: number,
  lastSwing: number,
  deltaMs: number,
): number => flashTravelled(lastSwing, swing, flashCoarseDecay(deltaMs));

/** How fresh the memory of an opposing swing still is at this flash rate. */
const freshnessAt = (flashesPerSecond: number) =>
  Math.exp(-1 / (2 * flashesPerSecond) / COARSE_SECONDS);

/**
 * Where a reversal starts counting as flashing and where it counts whole:
 * two flashes a second, which WCAG allows, and three, which it does not.
 */
export const FLASH_REVERSAL_START = freshnessAt(2);
export const FLASH_REVERSAL_FULL = freshnessAt(3);

/**
 * How much of the coarse limit applies: nothing while the picture moves one
 * way or reverses slowly, all of it where this swing opposes one recent
 * enough to make three flashes a second. Smooth rather than a switch, or the
 * limit would snap on and be seen as a step in the brightness. Mirrors
 * COMPOSITE_SOURCE.
 */
export const flashAlternating = (swing: number, lastSwing: number): number => {
  const against = Math.max(0, -swing * lastSwing);
  const t = Math.max(
    0,
    Math.min(
      1,
      (against - FLASH_REVERSAL_START) /
        (FLASH_REVERSAL_FULL - FLASH_REVERSAL_START),
    ),
  );
  return t * t * (3 - 2 * t);
};

/**
 * Pressure one turn of the picture adds, and how long pressure takes to fall
 * to 1/e. The two are one decision and were searched for together.
 *
 * They used to be a sixth and one second, which held a strobe at a hundred
 * per cent and let a ramp-and-snap through — a strobe turns at both its edges
 * and scored two a cycle, a ramp scored one, and nothing distinguishes a
 * forbidden ramp from an allowed strobe when one is counted twice. The turn
 * rule below fixed the counting; these two fix what the count is worth.
 *
 * Slower and smaller, because what decides whether a picture is held is not
 * the pressure's LEVEL but its lowest point: `flashing` is a smoothstep, so
 * wherever the pressure sags between two counts the limit lets go for those
 * frames, and that sag is what every leak measured here turned out to be. A
 * gentler build over a longer memory flattens the sag without moving the
 * average, which is what opens a gap between the rates.
 *
 * Searched over every pairing of seconds and step: at four seconds and a
 * twentieth, EVERY shape that must be held — ramps, squares and isoluminant
 * red ramps at 3.5, 3.75, 4, 5, 6, 8, 10, 15 and 30 flashes a second — keeps
 * its pressure above 0.301 at its lowest, while every shape that must be left
 * alone — the same three at 0.5 to 2.5, and a breathing picture — stays below
 * 0.105 at its highest. That gap is where START and FULL below sit, with room
 * to be a ramp rather than a switch. It is not a knife edge: the ten best
 * pairings are all three and a half to four seconds with steps of a sixteenth
 * to a twentieth.
 */
export const FLASH_SWING_PRESSURE = 1 / 20;

/** One step of an 8-bit channel: without it, rounding stops a small pressure falling. */
const PRESSURE_FLOOR = 1 / 255;

/**
 * Seconds in which pressure, and the travel it is counted from, fall to 1/e.
 *
 * The cost of four rather than one, and it is a real one: a picture that
 * flashes and stops stays limited for about four seconds afterwards instead
 * of one.
 */
const PRESSURE_SECONDS = 4;

/** What pressure is multiplied by over a frame of `deltaMs`. */
export const flashPressureDecay = (deltaMs: number): number =>
  Math.exp(
    -Math.max(0, Math.min(MAX_FRAME_MS, deltaMs)) / 1000 / PRESSURE_SECONDS,
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

export const flashPressureMemory = (
  swing: number,
  lastSwing: number,
  deltaMs: number,
): number => flashTravelled(lastSwing, swing, flashPressureDecay(deltaMs));

/**
 * The pressure after one frame, as the state pass computes it: decayed, less
 * the one step an 8-bit texture needs to fall at all, plus one for a TURN.
 * Mirrors STATE_SOURCE.
 *
 * A turn, not a swing, and that is the fix rather than the numbers around it.
 * WCAG counts a flash as a PAIR of opposing changes, and counting the changes
 * counts a square wave twice a cycle — it turns at both edges — against once
 * for a picture that slides up and snaps back, whose rise is spread too thin
 * to be a change at all. One shape scored double the other for the same
 * number of flashes, so no step size and no threshold could tell a forbidden
 * ramp from an allowed strobe. Counting where the TRAVEL turns round scores
 * both at two: the strobe at each edge, the ramp at its snap and again on the
 * first step of the rise after it.
 *
 * Restarting the travel from that first step is its own refractory period —
 * after a turn the picture must travel a tenth again before another can
 * count — so a jittering pixel cannot run the pressure up.
 */
export const flashPressure = (
  pressure: number,
  swing: number,
  lastSwing: number,
  deltaMs: number,
): number => {
  const turned = flashPressureMemory(swing, lastSwing, deltaMs);
  const opposing = turned * lastSwing < 0 && Math.abs(lastSwing) >= FLASH_SWING;
  const fallen = Math.max(
    0,
    pressure * flashPressureDecay(deltaMs) - PRESSURE_FLOOR,
  );
  return Math.min(1, fallen + (opposing ? FLASH_SWING_PRESSURE : 0));
};

/**
 * Where pressure starts limiting a pixel, and where the limit is whole: the
 * band the search at FLASH_SWING_PRESSURE found, set inside it rather than at
 * its edges.
 *
 * Nothing that must be left alone reaches 0.105 at its loudest and nothing
 * that must be held falls under 0.301 at its quietest, so these sit at 0.15
 * and 0.28 — clear of both, and far enough apart to come on as a ramp rather
 * than a step in the brightness.
 *
 * Measured end to end on the driver, against the whole sequence list in this
 * file's header: a picture pulsing to a beat at 150 BPM keeps every bit of
 * its swing — a square, a ramp and an isoluminant red ramp at two and a half
 * a second all come out at their own rate and full amplitude, as does a beat
 * at two a second, a breathing picture, a bar sweeping across, and the strips
 * a sixteenth and an eighth of the frame flickering ten times a second that
 * are the flame tips and the sparkles. What moved is at exactly three a
 * second, WCAG's own boundary, where a square now arrives at 2.4 rather than
 * 2.9 with its brightness range untouched: held a little where holding is
 * conservative rather than wrong.
 */
export const FLASH_PRESSURE_START = 0.15;
export const FLASH_PRESSURE_FULL = 0.28;

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
float luma(vec3 colour) {
  vec3 linear = pow(max(colour, vec3(0.0)), vec3(2.2));
  return dot(linear, vec3(0.2126, 0.7152, 0.0722));
}

// Saturated red: red light well above both green and blue.
float redness(vec3 colour) {
  vec3 linear = pow(max(colour, vec3(0.0)), vec3(2.2));
  return max(0.0, linear.r - max(linear.g, linear.b));
}
`;

/**
 * How far the picture has travelled one way, and which way, in one number.
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
 * again from itself, which is what makes the DROP small against a gentle
 * turn and enormous against a sudden one: what the composite weighs is this
 * frame's travel against the last frame's, so a scene that breathes reverses
 * from a small new step and passes, and one that snaps back reverses from a
 * whole one and is held.
 *
 * Measured against the thresholds above: a ramp-and-drop reaches 0.54 at two
 * flashes a second, which WCAG allows and which this lets through, and 0.61
 * to 0.81 from two and a half up, which it does not and this holds.
 *
 * What it holds is the ONE frame the picture turns on, because `against` is a
 * product of two consecutive frames and is non-zero only where the sign
 * flips. Driven on a GPU, every sequence in the header comes out the same
 * with this and with the single-frame direction it replaced: what keeps a
 * picture held for the LENGTH of a flash is the pressure below, not this.
 * Worth having for the frame it does hold, worth nobody believing it is the
 * limiter.
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
uniform float uCoarseDecay;
uniform float uLod;
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
  // once. See flashPressure, which is this.
  float opposing = remembered * lastSwing < 0.0
    && abs(lastSwing) >= ${FLASH_SWING.toFixed(3)} ? 1.0 : 0.0;
  float pressure = min(1.0,
    max(0.0, old.r * uDecay - ${PRESSURE_FLOOR.toFixed(6)})
    + opposing * ${FLASH_SWING_PRESSURE.toFixed(6)});
  // Blue is whether this spot is flashing, kept apart from the pressure so
  // its mips are the share of an area that is.
  float flashing = smoothstep(${FLASH_PRESSURE_START.toFixed(2)}, ${FLASH_PRESSURE_FULL.toFixed(2)}, pressure);
  // Alpha: the same memory over the quarter-frame average the composite
  // limits, so it can tell a reversal from something crossing the cell. Read
  // from the scene's own frames, never from the picture shown, or the limit
  // would keep itself switched on.
  float coarseSwing = luma(textureLod(uCurrent, vUv, uLod).rgb)
    - luma(textureLod(uLastFrame, vUv, uLod).rgb);
  float lastCoarse = old.a * 2.0 - 1.0;
  float coarse = flashTravel(lastCoarse, coarseSwing, uCoarseDecay);
  state = vec4(pressure, remembered * 0.5 + 0.5, flashing, coarse * 0.5 + 0.5);
}
`;

const COMPOSITE_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uPrevious;
uniform sampler2D uState;
/** The state as it was before this frame: the swing this one may oppose. */
uniform sampler2D uWas;
uniform float uLod;
uniform float uAreaLod;
uniform float uAllowance;
uniform float uFirst;
in vec2 vUv;
out vec4 fragColor;
${COLOUR_FUNCTIONS}
float changeOf(vec3 now, vec3 before) {
  return max(abs(luma(now) - luma(before)), abs(redness(now) - redness(before)));
}

void main() {
  vec4 current = texture(uCurrent, vUv);
  if (uFirst > 0.5) {
    fragColor = current;
    return;
  }
  vec4 previous = texture(uPrevious, vUv);
  // Luminance only across the frame. Red is caught where it alternates,
  // below; a quarter-frame average of redness also moved with every surge of
  // a fire scene's flames, and smeared them when nothing flashed.
  float coarse = abs(luma(textureLod(uCurrent, vUv, uLod).rgb)
                   - luma(textureLod(uPrevious, vUv, uLod).rgb));
  // Only where the scene's own coarse luminance is reversing. Its swing this
  // frame and the one it follows come from the state pass, which reads the
  // frames as drawn; something merely crossing the cell swings one way and
  // is left alone however fast it goes.
  float nowSwing = textureLod(uState, vUv, 0.0).a * 2.0 - 1.0;
  float beforeSwing = textureLod(uWas, vUv, 0.0).a * 2.0 - 1.0;
  float against = max(0.0, -nowSwing * beforeSwing);
  float alternating = smoothstep(
    ${FLASH_REVERSAL_START.toFixed(4)},
    ${FLASH_REVERSAL_FULL.toFixed(4)},
    against);
  float frameBlend = mix(
    1.0,
    coarse > uAllowance ? uAllowance / coarse : 1.0,
    alternating);
  float pixel = changeOf(current.rgb, previous.rgb);
  float pixelBlend = pixel > uAllowance ? uAllowance / pixel : 1.0;
  vec2 reach = 0.5 * pow(2.0, uAreaLod) / vec2(textureSize(uState, 0));
  float area = 0.25 * (
      textureLod(uState, vUv + vec2(-reach.x, -reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2( reach.x, -reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2(-reach.x,  reach.y), uAreaLod).b
    + textureLod(uState, vUv + vec2( reach.x,  reach.y), uAreaLod).b);
  float flashing = textureLod(uState, vUv, 0.0).b
    * smoothstep(${FLASH_AREA_START.toFixed(2)}, ${FLASH_AREA_FULL.toFixed(2)}, area);
  float blend = min(frameBlend, mix(1.0, pixelBlend, flashing));
  fragColor = mix(previous, current, blend);
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
 * Which scenes are drawn through the limiter, in one place because it was in
 * four and they disagreed: the Studio's stage showed a scene as it is while
 * the graph showed the same scene ghosted, and the listener had made it.
 *
 * A scene the listener made themselves is one they have watched — they built
 * it, and the Studio's stage is where they watched it. The limiter is for the
 * others: a scene that arrives from another member, or from the gallery, and
 * reaches somebody's eyes with nobody having seen it first.
 *
 * Holding a flash back means blending the last picture shown into the new
 * one, so on a scene moving fast it paints the previous frame's detail over
 * this one — a gem at full speed carrying two sets of facets, a tenth of the
 * picture wrong. That is a price worth paying against a stranger's scene and
 * not against your own.
 */
export type TSceneMaker = 'fluideq' | 'listener' | 'member';

export const limiterIsFor = (madeBy: TSceneMaker) => madeBy === 'member';

/** `null` when the GPU cannot give it what it needs — the scene then must not run. */
export const createFlashGuard = (
  gl: WebGL2RenderingContext,
): IFlashGuard | null => {
  const composite = link(gl, COMPOSITE_SOURCE);
  const stateProgram = link(gl, STATE_SOURCE);
  const vao = gl.createVertexArray();
  if (!composite || !stateProgram || !vao) {
    return null;
  }
  const where = {
    current: gl.getUniformLocation(composite, 'uCurrent'),
    previous: gl.getUniformLocation(composite, 'uPrevious'),
    state: gl.getUniformLocation(composite, 'uState'),
    was: gl.getUniformLocation(composite, 'uWas'),
    lod: gl.getUniformLocation(composite, 'uLod'),
    areaLod: gl.getUniformLocation(composite, 'uAreaLod'),
    allowance: gl.getUniformLocation(composite, 'uAllowance'),
    first: gl.getUniformLocation(composite, 'uFirst'),
  };
  const stateWhere = {
    current: gl.getUniformLocation(stateProgram, 'uCurrent'),
    lastFrame: gl.getUniformLocation(stateProgram, 'uLastFrame'),
    state: gl.getUniformLocation(stateProgram, 'uState'),
    decay: gl.getUniformLocation(stateProgram, 'uDecay'),
    coarseDecay: gl.getUniformLocation(stateProgram, 'uCoarseDecay'),
    lod: gl.getUniformLocation(stateProgram, 'uLod'),
  };

  let width = 0;
  let height = 0;
  /** The scene's two frames: the one drawn this time, and the one before. */
  let frames: [ITarget, ITarget] | undefined;
  let drawn = 0;
  let hasFrame = false;
  let shown: [ITarget, ITarget] | undefined;
  let latest = 0;
  let hasShown = false;
  let pressure: [ITarget, ITarget] | undefined;
  let pressureLatest = 0;

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
    /** What an untouched texel reads as. The state's two memories mean "no
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
      gl.RGBA8,
      targetWidth,
      targetHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    // Mipmapped: the coarse luminance and the flashing share are read from
    // high levels. A texture that asks for levels it has never been given
    // samples as black, so every one is given them below and after each write.
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
    clear?: readonly [number, number, number, number],
  ): [ITarget, ITarget] | undefined => {
    const a = makeTarget(targetWidth, targetHeight, mipmapped, clear);
    const b = makeTarget(targetWidth, targetHeight, mipmapped, clear);
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
    const old = { frames, drawn, shown, latest, pressure, pressureLatest };
    width = nextWidth;
    height = nextHeight;
    // Clearing a new target and every carry below must reach every pixel.
    const scissored = gl.isEnabled(gl.SCISSOR_TEST);
    gl.disable(gl.SCISSOR_TEST);
    frames = makePair(width, height, true);
    shown = makePair(width, height, true);
    pressure = makePair(
      Math.max(1, Math.ceil(width / 2)),
      Math.max(1, Math.ceil(height / 2)),
      true,
      [0, 0.5, 0, 0.5],
    );
    // The last picture shown, the last frame and the pressure, scaled into
    // the new size, are what the next frame is limited against; only a guard
    // that never showed a picture starts unlimited.
    if (hasShown && old.shown && shown) {
      carry(old.shown[old.latest], shown[latest], true);
    } else {
      hasShown = false;
    }
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
    releasePair(old.shown);
    releasePair(old.pressure);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const updatePressure = (current: ITarget, last: ITarget, deltaMs: number) => {
    if (!pressure) {
      return;
    }
    const before = pressure[pressureLatest];
    const after = pressure[1 - pressureLatest];
    const scissored = gl.isEnabled(gl.SCISSOR_TEST);
    gl.disable(gl.SCISSOR_TEST);
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
    gl.uniform1f(stateWhere.decay, flashPressureDecay(deltaMs));
    gl.uniform1f(stateWhere.coarseDecay, flashCoarseDecay(deltaMs));
    // The frame's own size, not the half-size state's: the coarse level is
    // read from the frame textures.
    gl.uniform1f(stateWhere.lod, flashLod(width, height));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Its levels are the share of each area that is flashing.
    gl.bindTexture(gl.TEXTURE_2D, after.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (scissored) {
      gl.enable(gl.SCISSOR_TEST);
    }
    pressureLatest = 1 - pressureLatest;
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
      if (!frames || !shown || !pressure) {
        return false;
      }
      const current = frames[1 - drawn];
      const last = frames[drawn];
      const previous = shown[latest];
      const next = shown[1 - latest];

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, current.texture);
      gl.generateMipmap(gl.TEXTURE_2D);
      if (hasFrame) {
        updatePressure(current, last, deltaMs);
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, current.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, previous.texture);
      if (hasShown) {
        gl.generateMipmap(gl.TEXTURE_2D);
      }
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, pressure[pressureLatest].texture);
      // The state before this frame, which `updatePressure` has just left as
      // the other half of the pair: what this frame's swing may oppose.
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, pressure[1 - pressureLatest].texture);

      gl.bindFramebuffer(gl.FRAMEBUFFER, next.framebuffer);
      gl.viewport(0, 0, width, height);
      gl.useProgram(composite);
      gl.bindVertexArray(vao);
      gl.uniform1i(where.current, 0);
      gl.uniform1i(where.previous, 1);
      gl.uniform1i(where.state, 2);
      gl.uniform1i(where.was, 3);
      gl.uniform1f(where.lod, flashLod(width, height));
      gl.uniform1f(where.areaLod, flashAreaLod(width, height));
      gl.uniform1f(where.allowance, flashAllowance(deltaMs));
      gl.uniform1f(where.first, hasShown ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Onto the destination. The blit honours the same scissor as the scene
      // did, so only the part of the panel on screen is touched.
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, next.framebuffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destination);
      gl.blitFramebuffer(
        0,
        0,
        width,
        height,
        0,
        0,
        width,
        height,
        gl.COLOR_BUFFER_BIT,
        gl.NEAREST,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0);
      latest = 1 - latest;
      hasShown = true;
      drawn = 1 - drawn;
      hasFrame = true;
      return true;
    },
    dispose: () => {
      releasePair(frames);
      releasePair(shown);
      releasePair(pressure);
      frames = undefined;
      shown = undefined;
      pressure = undefined;
      gl.deleteVertexArray(vao);
      gl.deleteProgram(composite);
      gl.deleteProgram(stateProgram);
    },
  };
};
