# The gallery behind the signed-out Visualizers page

`assets/plus/gallery-ground.jpg` is the picture the Visualizers tab shows
behind its glass before anybody signs in. It is the gallery drawn by the
gallery's own components (`harness/index.tsx`), handed FluidEQ's own scenes
and pictured by stills the app already ships, so it never shows anybody's
account and never needs the server.

**Remake it before each release**, so the page shows the gallery as it looks
in that release:

```
pnpm docs:gallery-ground
```

It builds the drawing, opens it in a headless Chrome or Edge at 1920 × 1080,
waits for every card's picture and the fonts to paint, and writes the JPEG,
stepping the quality down until the file is at most 160 KB (about 160 KB at
quality 56 today). Pass `--chrome <path>` if neither browser is where the
Help captures look for it, and `--skip-build` to reuse the last build.

To show other scenes, change `SCENES` in `harness/index.tsx`; a new still has
to be one the app ships already (`assets/plus`, `assets/tour`).
