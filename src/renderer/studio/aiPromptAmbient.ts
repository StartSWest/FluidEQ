import {
  AMBIENT_AREAS,
  AMBIENT_CEILING,
  AMBIENT_FIELDS,
  AMBIENT_MUSIC,
  AMBIENT_OPACITY_ADVISED,
  AMBIENT_SHAPES,
  MAX_AMBIENT_COLOURS,
  MAX_AMBIENT_COUNT,
  MAX_AMBIENT_ELEMENTS,
  MAX_AMBIENT_FRAME_EDGE,
  MAX_AMBIENT_FRAMES,
  MAX_AMBIENT_PARAMS,
  MAX_AMBIENT_PATH_LENGTH,
  MAX_AMBIENT_SIZE,
  MAX_AMBIENT_TOTAL,
  MIN_AMBIENT_FRAME_EDGE,
  MIN_AMBIENT_SIZE,
} from 'common/sceneAmbient';

/**
 * The AMBIENT section of the Studio's AI prompt (`aiPrompt.ts`): the scene's
 * elements floating around the app, described in pack.json rather than code.
 * Every number in it is the one `sceneAmbient.ts` enforces, and changes with
 * it.
 */
export const AMBIENT_SECTION = `AMBIENT (optional, in pack.json)
The scene's own elements floating in the window around it, drawn faintly over
the app when I choose the Ambient mode: birds for a mountain scene, petals for
a flower, stars for a city. They float over FluidEQ itself - across its
buttons, sliders, lists and words, not inside the scene's panel - so they are
the one part of a scene that can get in the way of using the app, and they are
kept faint for that reason. FluidEQ draws them from this description; none of
it is code. Add them when the idea has something that belongs around it:
  "ambient": {
    "elements": [
      { "id": "gulls", "shape": "bird", "colours": ["#dfe9ff"], "count": 6,
        "size": [14, 24], "opacity": 0.7, "motion": "fly", "speed": 0.35,
        "area": "top", "flap": 0.7, "turn": 0.3, "music": "mid", "react": 0.3 }
    ],
    "params": [
      { "id": "flock", "names": { "en": "Birds" }, "value": 0.6,
        "targets": [ { "element": "gulls", "field": "count", "min": 2, "max": 10 } ] }
    ]
  }
- elements: up to ${MAX_AMBIENT_ELEMENTS}. id: a-z, 0-9 and _, starting with a letter.
  shape: ${AMBIENT_SHAPES.join(', ')}.
  THE NAMED ONES ARE SHORTCUTS, NOT THE CHOICE. They are the handful that
  come up often, and picking from them because they are written down is how
  every scene ends up with the same stars and sparks. Start from what my idea
  actually has flying, falling or drifting around it - a kite, a paper plane,
  a koi, a moth, a music note, an ember, a bat, a jellyfish, a snowflake with
  its own arms, a leaf from THIS tree - and only then see whether one of the
  names above happens to be it. If none is, "path" draws whatever you like
  and "picture" flies the scene's own artwork; both are below, and both are
  the normal answer rather than the advanced one.
  For path, add "path": an outline
  in a box from -1 to 1, only the commands M L H V C S Q T Z and numbers from
  -2 to 2, at most ${MAX_AMBIENT_PATH_LENGTH} characters.
  For picture, the element is drawn from artwork.webp itself - the scene's
  own bird, petal or lantern flying around the app. Add "frames": up to ${MAX_AMBIENT_FRAMES}
  places [x, y, width, height] in the artwork's pixels from its top-left
  (the same pixels as "pictures"), all one size, ${MIN_AMBIENT_FRAME_EDGE} to ${MAX_AMBIENT_FRAME_EDGE} pixels a side,
  inside the image. They play in order, one cycle per wingbeat or flutter
  (flap sets the pace), each blending into the next: the poses of one
  wingbeat, or one frame for a still picture. Optional "rest": the index of
  the pose it holds while gliding. "facing": "right" or "left" if the
  picture looks that way, so it turns to face where it flies; "none"
  otherwise. colours are not needed for it. Use places whose ground is
  transparent: FluidEQ fades every edge, but a photo still reads as a
  faint square. size is its longer side.
  motion: fly (crosses the window in arcs, wings beating), drift (rides one
  slow wind), wander (turns on a walk of its own), twinkle (stays put and
  breathes), fall, rise, sway (bobs where it stands).
  colours: 1 to ${MAX_AMBIENT_COLOURS} like #rrggbb, from the scene. count: 1 to ${MAX_AMBIENT_COUNT} each, ${MAX_AMBIENT_TOTAL}
  in all. size: [smallest, largest] in pixels, ${MIN_AMBIENT_SIZE} to ${MAX_AMBIENT_SIZE}. opacity: keep it
  between ${AMBIENT_OPACITY_ADVISED[0]} and ${AMBIENT_OPACITY_ADVISED[1]} (see the last two rules below). speed, flap (wing
  beat, flutter or twinkle), turn (how much each turns and differs) and react:
  0 to 1. area: ${AMBIENT_AREAS.join(', ')}. music: ${AMBIENT_MUSIC.join(', ')}.
- params: up to ${MAX_AMBIENT_PARAMS} sliders for these elements, which FluidEQ shows me.
  Each moves its targets - a field (${AMBIENT_FIELDS.join(', ')}) of an
  element - from its min to its max as the slider goes from 0 to 1. "value"
  is where it stands, 0 to 1; I tune it in FluidEQ, so keep it unless I ask.
  TWO OF THEM ARE ALWAYS THERE, whatever else you add, because they are the
  two things anyone wants of something flying around their window: how many,
  and how much it shows. Give every scene with elements both, each targeting
  EVERY element you declared:
  { "id": "ambient_amount", "names": { "en": "Things in the window" },
    "value": 0.5, "targets": [ { "element": "<each>", "field": "count",
    "min": 0, "max": <that element's own count, doubled> } ] }
  { "id": "ambient_opacity", "names": { "en": "How much they show" },
    "value": 0.6, "targets": [ { "element": "<each>", "field": "opacity",
    "min": 0, "max": ${AMBIENT_OPACITY_ADVISED[1]} } ] }
  A count of 0 at the bottom is deliberate: somebody who wants their window
  clear must be able to have it, and the top is where somebody who likes them
  gets a full sky.
- They are the background, never the point, and they are over everything I am
  reading. Keep every element's opacity between ${AMBIENT_OPACITY_ADVISED[0]} and ${AMBIENT_OPACITY_ADVISED[1]}, with soft
  colours, modest counts and slow speeds, so they read as the room the music
  is playing in. FluidEQ draws the whole layer of them at most ${Math.round(AMBIENT_CEILING * 100)}% over the
  window, however many of them overlap, so nothing here can hide a word; an
  element's opacity is its strength inside that layer - 1 is as strong as the
  layer lets anything be, and under ${AMBIENT_OPACITY_ADVISED[0]} it is lost on a bright desktop.
- If I ask for them heavier than that - a thick flock, a veil over the app,
  something that has to be noticed - say in one line, before you write it,
  that it will sit over FluidEQ's buttons and words and make them harder to
  read, and what the quieter version would be. Then do whichever I choose.
- ASK ME WHICH ONES, AND SUGGEST THEM YOURSELF. These fly around the whole
  app, not inside the scene, so they are mine to choose and I will not know
  they are possible unless you say so. Name the two or three that belong to
  my idea and ask me in one line which I want - "gulls, sea spray or a slow
  drift of cloud?" for a coast, lanterns or moths for a night garden, sparks
  for a fire, koi or dragonflies for a pond, ash and cinders for a volcano,
  paper planes for a desk. Name the things MY scene has, in my own words, not
  the shapes on the list: two scenes of different worlds should never be
  offered the same three. Do not wait for the answer: put your own suggestion
  in now, and change it when I answer. Skip the question if my idea already
  said which, or if the scene already has elements and my idea is not about
  them - then keep them as they are - and leave "ambient" out altogether if I
  say none.
`;
