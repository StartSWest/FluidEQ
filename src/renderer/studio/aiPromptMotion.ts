import {
  MAX_CAMERA_PITCH,
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
} from 'common/sceneCamera';
import { SCENE_TAP_AGE_LIMIT_S } from 'common/sceneUniformContract';

/**
 * The parts of the Studio's AI prompt (`aiPrompt.ts`) about what moves a
 * scene besides the level and the bands: the music's time (`uRhythm`,
 * `uDrums`, `uSong`, `uStereo`, from `sceneRhythm.ts` and `stereoImage.ts`)
 * and the viewer's hands (`uPointer`, `uTap`, `uCamera`, from
 * `sceneInteraction.ts` and `sceneCamera.ts`).
 *
 * Written because a uniform a model is only listed is a uniform it uses
 * badly: told "x = beat phase", it moves a dancer by the phase straight, and
 * the dancer keeps dancing through silence and into a calm desktop, where
 * the clock is held and only its certainty says so. Every formula here is
 * one the contract answers exactly as described; change them together.
 *
 * English, like the rest of the prompt: it is read by a model.
 */

/** As a member would write it: four places, enough to go all the way round. */
const turn = (radians: number) => Number(radians.toFixed(4));

export const MOTION_SECTIONS = `DANCING TO THE MUSIC
uBeat and uDrums say a hit happened, after it happened: a dance built on them
lands every step late, and a dancer who steps after the beat looks drunk.
uRhythm is a clock that knows where the next beat will fall, so a step can be
on its way down BEFORE the kick and land on it. That is the difference between
a dancer and something twitching.
- Weigh everything you hang on the clock by how sure it is,
    float sure = smoothstep(0.25, 0.65, uRhythm.w);
  and blend from an idle motion (a slow breath on uTime) to the dance with it.
  uRhythm.w falls to 0 in silence, on a calm desktop background and in music
  with no steady beat, and the clock holds still between songs: weighed like
  this, the dancer comes to rest instead of dancing to nothing, or freezing
  mid-step.
- EVERY MOVE SMOOTH, AND AT REST ON THE BEAT. FluidEQ nudges the clock onto
  each kick as it lands, so anything passing the beat at speed jumps by that
  nudge, beat after beat; and a move that reaches the beat fast and stops
  dead - a hard landing, a clap that arrives at speed - jerks there whatever
  the clock does. Both read as the dancer glitching. Build every move from
  cos() and from poses eased in and out, so it arrives at each beat at rest
  and leaves it from rest.
- A bounce with its low point on the beat:
    float bob = 0.5 - 0.5 * cos(6.2832 * uRhythm.x);  // 0 on the beat
  a landing that peaks sharply on the beat, for a dip or a squash:
    float land = pow(0.5 + 0.5 * cos(6.2832 * uRhythm.x), 6.0);
  Move nothing by a curve that is not the same at 0 and at 1: the phase
  wraps from 1 to 0 on every beat, and 1.0 - smoothstep(0.0, 0.35, x), which
  reads well as a light's flash, jumps a body from 0 to 1 there - a pop.
- Moves that take a bar: a sway left on one and right on three is
  sin(6.2832 * 2.0 * uRhythm.y); a routine of four poses is
  floor(uRhythm.y * 4.0), eased between poses by
  smoothstep(0.0, 1.0, fract(uRhythm.y * 4.0)), so each pose is reached at
  rest on its beat. Which beat starts the bar is FluidEQ's best guess (the
  heaviest kick), so keep a move a bar long symmetric and it never looks
  wrong.
- Fit the moves to the tempo, uRhythm.z: above about 140 BPM dance to half of
  it (fract(uRhythm.y * 2.0) is a phase two beats long), below about 80 to
  double (fract(uRhythm.x * 2.0)).
- The drums (uDrums, uBeat) and the levels (uBands, uLevel) jump up the
  moment a hit lands and fall away within a tenth of a second, so anything
  they MOVE twitches on every hit - a head snapped by the snare, a body
  squashed by the bass. Move bodies by the clock alone, which knows the hit
  is coming, and give each drum light to play with: the kick a floor pulse or
  a ring, the snare a spark or the lights flaring on two and four, the hats a
  glint or a shimmer along an edge.
- uSong.x scales the whole performance: small moves in a quiet verse, the
  full dance in the chorus. uSong.y is anticipation - a crouch, lights
  narrowing, particles drawn in - and uSong.z is the release that follows:
  the jump, the burst, the confetti, a new colour, with uSong.w as the seed so
  no two drops look alike. uSong.z halves every 0.7 s, so the seconds since
  the drop are -0.7 * log2(max(uSong.z, 0.001)): time a jump's arc by them.
- uVoice is the singer, for a creature with a mouth or anything that
  follows a voice: open a mouth by uVoice.x - it moves syllable by syllable,
  like a jaw - weighed by smoothstep(0.2, 0.6, uVoice.z), so it closes in the
  instrumental parts; lift a head, a brow or the light with the high notes
  by uVoice.y. Never move a whole body by uVoice.x: it would chatter.
- uStereo.x leans the subject or pans the lights towards the louder side;
  uStereo.y spreads things apart when the music is wide.
- A shader has no memory: every frame is drawn from that frame's uniforms
  alone. A pose is a function of uRhythm and uSong; momentum that builds up
  comes from uMusicRun.

THE VIEWER'S HANDS
The listener can reach into a scene: point at it, tap it, and turn a 3D one
with the mouse. It is a gift, never the point. Most of the time nobody
touches it, and nobody ever can on the desktop background or the desk
lights, so the scene is whole with uPointer.w at 0, and whatever the pointer
does fades with uPointer.w.
- uPointer: light that follows the hand, eyes that watch it, fur that parts
  or water that ripples under it, the world leaning towards it. xy is where
  it is, in uv; z rises to 1 while it is held down.
- uTap: something that happens where the viewer tapped - a ripple, a burst, a
  creature turning to look - driven by uTap.z, the seconds since, which reads
  ${SCENE_TAP_AGE_LIMIT_S} until the first tap:
    float age = uTap.z;
    float ring = exp(-2.0 * age)
               * (1.0 - smoothstep(0.0, 0.015, abs(length(p - tap) - 0.6 * age)));
  with p and tap the pixel and uTap.xy in the same aspect-corrected space.
  uTap.w changes with every tap: hash it for each one's own colour or
  direction. Keep it small and quick like a beat; the rules on flashing hold.
- uCamera: the viewer turns a 3D scene by dragging it and moves in and out
  with the wheel, and FluidEQ does all of that - the dragging, the easing,
  the limits, the way back to your view. Say how far in pack.json:
    "camera": { "yaw": [-0.9, 0.9], "pitch": [-0.15, 0.6], "zoom": [0.7, 1.8] }
  radians round to either side, down and up, and how far out and in. Each
  range holds 0 (1 for zoom), which is your own view, and FluidEQ keeps the
  camera inside them. Pitch above 0 raises the viewer to look down on the
  scene. The widest FluidEQ allows: pitch ${turn(MAX_CAMERA_PITCH)} each way,
  zoom ${MIN_CAMERA_ZOOM} to ${MAX_CAMERA_ZOOM}, and yaw [-${turn(Math.PI)}, ${turn(Math.PI)}],
  which goes all the way round - uCamera.x then wraps, so use it only inside
  sin and cos. Leave "camera" out and the scene cannot be turned. Orbit your
  camera about what it looks at:
    float yaw = uCamera.x;
    float pitch = 0.3 + uCamera.y;       // your own tilt, plus theirs
    float dist = 4.5 / uCamera.z;
    vec3 target = vec3(0.0, 1.0, 0.0);
    vec3 ro = target + dist * vec3(sin(yaw) * cos(pitch), sin(pitch),
                                   cos(yaw) * cos(pitch));
  then build forward, right and up from ro to target as always, and keep
  your own tilt plus theirs short of 1.57, straight down or up, where a
  look-at camera folds. Choose the ranges from pictures: every angle you
  allow must look designed - no bare underside of a floor, no missing back
  wall, no subject leaving the frame. Letting me turn a scene that was built
  for one view means building what it never showed - its sides, a back, a
  floor to the edges, a subject deep enough from the side - and that is
  keeping its look, from every angle.
  A flat scene can take a camera too, as parallax: each layer shifted by
  uCamera.xy times its depth.

`;
