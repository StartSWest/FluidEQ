# The starter project's art

"New project" copies these two files into every new Studio project, beside
the starter's `scene.frag` and `pack.json` (`main/memberScenes/starterScene.ts`).
Existing projects never receive them.

- `artwork.webp` (512 × 776): the scene's one image. The top 512 × 512 is
  the picture place named `orb` in `pack.json`, holding a full moon until the
  member chooses a photo of their own in the Pictures tab. Under it, from
  y = 520, is the swallow's 8-frame sheet at 106 × 128 per frame (424 × 256,
  listed in `artworkRegions` as `swallow`), which the scene plays in the sky.
- `art/swallow-flight.webp` (848 × 512): the same 8 frames at 212 × 256, the
  sheet `animations/swallow-flight.json` names, so the Animations tab shows the
  swallow sharp at its own size.

## Origin

Both images were generated for FluidEQ on 2026-11-09 with OpenAI's image
model through Ivan Carmenates Garcia's own ChatGPT subscription, then
processed by script: the moon cropped to its disc, the swallow's frames cut
from the generated sheet, each registered on the bird's eye and beak so the
head holds still while the wings beat, and the chroma key's green taken off
their edges. No photograph, stock image or third-party artwork is in either.
Under OpenAI's terms the output belongs to the person who generated it; they
ship with FluidEQ under its own licence.

Regenerate or reprocess them only together with the numbers above: the
picture place, the sheet's region and its frame size are written into the
starter's `pack.json` and `scene.frag`, and `memberSceneProject.test.ts` holds
the files to them.
