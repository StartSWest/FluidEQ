import {
  MAX_POINTER_BURST,
  MAX_POINTER_EMITTERS,
  MAX_POINTER_LIFE,
  MAX_POINTER_PIECES,
  MAX_POINTER_SIZE,
  MAX_POINTER_TRAIL,
  MIN_POINTER_LIFE,
  MIN_POINTER_SIZE,
  POINTER_SHAPES,
} from 'common/scenePointer';

/**
 * The part of the Studio's AI prompt (`aiPrompt.ts`) that says what a scene
 * may throw from the viewer's hand (`common/scenePointer.ts`): the format,
 * its bounds, and that it is a gift, never the point. Its numbers are the
 * reader's own, so the brief cannot promise what the engine clamps away.
 *
 * English, like the rest of the prompt: it is read by a model.
 */
export const POINTER_SECTION = `THROWN FROM THE HAND (pack.json "pointer", optional)
FluidEQ can throw pieces from the listener's pointer over the scene - a trail
as the mouse crosses it, a burst where it taps - drawn by FluidEQ in front of
the scene, while the listener's Pointer sparks switch is on. A flower
throws its petals, a fire its sparks, a winter scene its snow. Give it where
it belongs to the idea, never as decoration for its own sake:
  "pointer": { "emitters": [
    { "on": "move", "element": "petals", "amount": 3, "size": [10, 18],
      "life": 1.6, "speed": 0.3, "spread": 0.6, "gravity": 0.35,
      "spin": 0.6 },
    { "on": "tap", "shape": "spark", "colours": ["#ffd27a", "#ff8a4c"],
      "amount": 14, "size": [6, 12], "life": 0.9, "speed": 0.7,
      "spread": 1, "gravity": 0.2, "spin": 0.2 }
  ] }
- on: "move" throws "amount" pieces for every 100 pixels the hand travels,
  left behind it; "tap" throws "amount" at once, up and out.
- element: one of the scene's own elements in the window (see AMBIENT), by
  its id - its shape, outline or picture and its colours - or shape, one of
  ${POINTER_SHAPES.join(', ')}, with "colours" (1 to 3; an element's own when
  left empty).
- size [smallest, largest] in pixels (${MIN_POINTER_SIZE} to ${MAX_POINTER_SIZE}); life in seconds (${MIN_POINTER_LIFE} to ${MAX_POINTER_LIFE}); speed
  0..1, how fast a piece leaves the hand; spread 0..1, from straight away to
  every way round; gravity -1..1, rising (below 0) to falling (above 0);
  spin 0..1, how much each turns as it flies. Flat things - petals, leaves,
  birds - turn over as they fall by themselves.
- At most ${MAX_POINTER_EMITTERS} emitters; a trail at most ${MAX_POINTER_TRAIL} pieces for every 100 pixels, a burst
  at most ${MAX_POINTER_BURST}; FluidEQ keeps ${MAX_POINTER_PIECES} pieces in the air at most, across all of them,
  and throws nothing for someone who asked for less motion.

`;
