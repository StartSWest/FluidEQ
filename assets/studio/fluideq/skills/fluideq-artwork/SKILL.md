---
name: fluideq-artwork
description: The reference for pictures in a FluidEQ scene - the member's own photos in named places of artwork.webp (pack.json "pictures"), and art of your own, made images, library textures and models ("artworkRegions", credits.txt), with every size limit, how to cut out and pack, and which licences may ship. Load before you write a scene around a photo, read or write the artwork's regions, or make, fetch or pack any image, texture or model, and whenever the member says "photo", "picture", "image", "texture", "my pet", "poster", "photo-real" or "realistic".
---

ARTWORK
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
  it, and I will not paint masks. W and H at most 4096, W x H at most
  4096 x 2048, the file at most 6 MB. Size each place for its photo:
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

YOUR OWN ART: MADE IMAGES, LIBRARY TEXTURES AND MODELS
Photo-real pictures lift a scene from drawn to real: FluidEQ's own aquarium
swims photo-real fish over sand, its concert crowd is eight real-looking
people, its hanami a garden of cherry trees. So:
- FIND WHAT CAN MAKE IMAGES BEFORE YOU DECIDE NOTHING CAN: a tool of your
  own (ChatGPT's or Codex's image generation, Gemini's, any other), an
  image-generation skill or plugin in your skills, an MCP image tool, or one
  I connected you to. Look at the start, and try one - most have a check
  command - before you tell me pictures cannot be made; only when none works,
  write me the prompt and the file name to save the picture as in the folder.
- USE IT for what should look real: a building, rocks, trees, mountains, a
  far shore, a creature, a material. Keep drawing in code what moves or
  answers the music - sky, light, water, weather, particles, glow - over and
  around the pictures. When I ask for something to look like a photograph,
  make the picture; never fake it in code. Rebuilding a drawn scene from
  pictures, tell me first which of its objects become pictures.
- ONE PICTURE PER OBJECT. A subject - a fish, a tree, a person, a cabin:
  alone and whole in frame, seen from the angle the camera sees it, lit as
  the scene is (the same light for every one), on a transparent background,
  with no ground, sky or text. Three clearly different ones of anything that
  repeats - rocks, trees: if they come out as near-clones, make them again
  asking for different shapes. A cut-out keyed from a flat colour keeps that
  colour on its soft edges: pull those pixels back to their neighbours' hue,
  and trim its empty margin, before packing. A material - bark, sand, stone,
  foam: seamless and tileable, straight on, evenly lit, no shadows; blend
  its edges if opposite edges do not match. Two of one subject (arms up and
  down, by day and by night): make the second by editing the first, so they
  stay in register and a day and night pair crossfades with the daylight
  without a jump. Take an unwanted detail out by editing too. Look at every
  picture yourself before you use it, and get what it shows - how dense a
  forest is, what a rock looks like - into the picture itself: when it is
  wrong, or I ask for a new one, make a new one; never cover it in code.
- A FAR BACKGROUND - mountains, a forest, a shore, together - is one strip
  that repeats: ask for a wide strip (2048 x 512) whose two ends meet the
  edge at the same height, crossfade its last columns into its first, and
  repeat it with fract() across any width. Read it with textureGrad and
  gradients taken from the unwrapped coordinate, or the wrap shows as a
  blurred seam. Standing on water, sink its thin, see-through bottom rows
  just under the waterline, so the picture and its reflection meet without
  a line.
- THE WHOLE SCENE PUBLISHES AT 5 MB AT MOST - artwork, models,
  code and all - because everybody who picks it downloads all of it, and
  the publish screen refuses more. The artwork is nearly all of it: give
  each picture the pixels it shows on screen and no more, share one strip
  for a far background, and pack the atlas no larger than its pieces need.
- LIGHT A PHOTOGRAPH AS PHOTOGRAPHED by day. By night darken it, tint it
  toward the sky, and let its own lights glow - windows and lanterns are the
  pixels where red stands well above blue. Never relight a photograph with
  made-up normals, and never paint shadows under it: a dark dome or shade
  baked onto the ground looks worse than even light.
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
  on a 1080p panel close up, and no larger. Every pack moves every piece:
  after each, update every region in every file that reads one - a stale
  one silently shows another picture. Shrink a piece by packing it again
  from its original picture; take out pieces nothing shows any more.
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
