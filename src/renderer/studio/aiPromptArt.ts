import {
  MAX_SCENE_ARTWORK_BYTES,
  MAX_SCENE_ARTWORK_EDGE,
  MAX_SCENE_ARTWORK_PIXELS,
} from 'common/sceneArtwork';

/**
 * The two parts of the Studio's AI prompt (`aiPrompt.ts`) about pictures in
 * a scene, which share one image, artwork.webp: ARTWORK, the member's own
 * photos, laid into the places `pictures` names by FluidEQ
 * (`projectPictures.ts`); and YOUR OWN ART, the images and models the
 * member's AI makes or fetches for the scene itself. Ivan, 2026-09-30: "make
 * sure the prompt is updated so the AI uses image gen available or 3D models
 * from any free resources" - and then, of the brief's size: "this needs to
 * be awesome, performant, but be able to build good things". So YOUR OWN ART
 * is short and every line is a rule or a number the engine holds it to; the
 * limits are `sceneArtwork.ts`'s.
 *
 * Every rule in it was learned building FluidEQ's own scenes in the release
 * pass of 2026-09-30: photo-real fish, coral, kelp, crowds, trees and a
 * starship, made with an image model, cut out, packed into one image and
 * sampled from world GLSL (`worldShaderHooks.ts`, `uArtwork`). A key colour
 * left on a cut-out's soft edges showed as a lilac rim on pink petals and a
 * pink rim on kelp; mipmaps of tiles packed edge to edge mixed two textures
 * in the distance. Its pieces are listed in `artworkRegions`, because an
 * image with no `pictures` is otherwise offered to the member as one photo
 * place, and one photo chosen for it painted over every piece.
 *
 * Library assets: CC0 or public domain only, because a published scene goes
 * to every member of an app that is sold and FluidEQ has nowhere to show a
 * credit an attribution licence requires. Each library named was checked on
 * its own licence page on 2026-09-30; the Smithsonian's covers only the items
 * it marks CC0.
 */

const MB = 1024 * 1024;
const pixelsIn = (pixels: number) =>
  `${MAX_SCENE_ARTWORK_EDGE} x ${pixels / MAX_SCENE_ARTWORK_EDGE}`;

/** The member's own photos, laid into named places of the artwork. */
export const ARTWORK_SECTION = `ARTWORK
A scene may use photos of mine: my pet, a place, a poster. They all live in
one image, artwork.webp, W x H pixels, each photo a named place in it:
  "pictures": [
    { "id": "pet", "names": { "en": "Your pet" },
      "x": 0, "y": 0, "width": 1280, "height": 1280 }
  ]
- x, y, width, height: pixels from the image's top-left corner, inside it.
  id: a-z, 0-9, - and _, starting with a letter. Up to 8 photos; one may
  cover the whole image. Name each for what I should put there, in every
  language you can.
- Optional per photo: "fit": "cover" (fill the place, cropping) or
  "contain" (the whole photo, clear margins), and "focus": [x, y], the point
  of the photo kept at the centre as fractions from its top-left - [0.5, 0.4]
  keeps a pet's face in view. I can reframe each photo in FluidEQ.
- I choose any photo for each place in FluidEQ, which crops it to fill the
  place, centred, and saves the image. You never place or crop my photos in
  it, and I will not paint masks. W and H at most ${MAX_SCENE_ARTWORK_EDGE}, W x H at most
  ${pixelsIn(MAX_SCENE_ARTWORK_PIXELS)}, the file at most ${MAX_SCENE_ARTWORK_BYTES / MB} MB. Size each place for its photo:
  1280 x 1280 for a pet, 1920 x 1080 for a landscape.
- In the shader, a place's own q (0..1, origin bottom-left) is at
    vec2 a = (vec2(x, H - y - height) + q * vec2(width, height)) / vec2(W, H);
  and its colour is texture(uArtwork, a).
Bring each photo alive from what is in it: find parts by brightness, colour,
edges (compare neighbouring samples) or distance from the centre, where the
subject usually is, and move, bend, light or tint them with the music - the
photo breathing on the beat (uRhythm), a glow along its edges on uBeat,
colours warming with uBands.y, particles in front glinting with uBands.z.
Keep each photo recognisable: light and move parts of it, never wash it out.

`;

/** Images and models the member's AI makes or fetches for the scene. */
export const ART_SECTION = `YOUR OWN ART: MADE IMAGES, LIBRARY TEXTURES AND MODELS
Photo-real pictures lift a scene from drawn to real: FluidEQ's own aquarium
swims photo-real fish over sand, its concert crowd is eight real-looking
people, its hanami a garden of cherry trees. So:
- IF YOU CAN MAKE IMAGES (a tool of your own, or one I connected you to),
  USE IT for the scene's subjects and materials. A subject - a fish, a tree,
  a person, a ship: alone, seen from the angle the camera sees it, lit as the
  scene is, on a transparent background. A cut-out keyed from a flat colour
  keeps that colour on its soft edges: pull those pixels back to their
  neighbours' hue before packing. A material - bark, sand, stone, foam:
  seamless and tileable, straight on, evenly lit, no shadows; blend its
  edges if opposite edges do not match. Two of one subject (arms up and
  down, by day and by night): make the second by editing the first, so they
  stay in register.
- OR TAKE THEM FROM FREE LIBRARIES, CC0 or public domain only: Poly Haven,
  ambientCG, Kenney, Quaternius, and the Smithsonian's 3D scans marked CC0.
  Never non-commercial, share-alike, attribution-required or unlicensed
  work: what I publish goes to every member of an app that is sold. Read the
  licence on the author's own page, and list each asset, its address and its
  licence in credits.txt in the folder.
- PACK THE IMAGES INTO artwork.webp yourself, beside any places for my
  photos, with a script kept outside this folder so it can be packed again:
  one WebP within ARTWORK's limits, its exact size as pack.json's
  artworkWidth and artworkHeight (artworkFile "artwork.webp"). Give every
  tile a gutter of its own wrapped pixels (32) and every subject a
  transparent margin (16), so distant mipmaps never mix two of them. A
  piece whose top-left pixel is (x, y), w by h, in an image W by H, is the
  region vec4(x / W, 1 - (y + h) / H, w / W, h / H): the origin is the
  image's BOTTOM-left. It arrives premultiplied and in sRGB: the linear
  colour is pow(t.rgb / max(t.a, 0.001), vec3(2.2)); cut a subject out by
  discarding below alpha 0.5. Size each piece at about the pixels it covers
  on a 1080p panel close up, and no larger.
- LIST THE PIECES in pack.json, in pixels from the top-left like a photo's
  place: "artworkRegions": [{ "id": "koi", "x": 0, "y": 0, "width": 512,
  "height": 256 }], at most 64, ids a-z, 0-9, - and _, starting with a
  letter. FluidEQ shows me each to look at and save, and without them
  offers me the whole image as one place for a photo, which would paint
  over every piece. "pictures" name only places for my photos; FluidEQ
  keeps your pieces when it lays a photo of mine into one.
- MODELS: a library model is rarely ready as it comes. Convert it to one
  binary .glb that keeps to MODELS under A 3D WORLD - triangles, one scene,
  nothing outside the file, no Draco, meshopt or KTX2 compression - and
  simplify it until it fits the budget (gltf-transform and Blender's
  Decimate both do). A photograph on a plane costs four vertices; a model
  costs all of its vertices in every pass that draws it.

`;
