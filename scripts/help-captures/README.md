# Help guide captures

One script takes the guide's 2.1 pictures from the real window and measures
the box of every numbered control in the same render, so a picture and its
boxes are always written together:

| Picture                    | Chapter | Shows                                |
| -------------------------- | ------- | ------------------------------------ |
| `14-share-audio-roles.png` | share   | Share Audio with one computer linked |

The pictures go to `docs/`, the boxes to
`src/common/helpChapters/captured.ts`, which the chapters read. Never move a
box by hand: run the script again.

## How it works

It does not run Electron. `webpack.config.ts` builds the app's own renderer
and stylesheets, with the app's own loaders, for a browser; `electron` is
answered by `harness/fakeElectron.ts`, so the real preload and every bridge run
unchanged, and `harness/scenario.ts` answers each request the window makes of
the main process: three outputs (Kraken V4 Pro, Speakers (Realtek Audio),
BlackShark V2 Pro at 80% battery), the FluidEQ Engine on all of them, a ten-band
EQ, two profiles, nobody signed in. The live graph draws two bars of music the
harness makes itself (`harness/music.ts`), so nobody's recording is in a
picture. `capture.ts` starts headless Chrome or Edge, drives it over the
DevTools protocol, and for each figure in `figures.ts` sets the window up,
cuts the picture and measures the boxes. The Share Audio picture's connection
code and network addresses are blurred before it is taken.

## Running it on Windows

The guide's pictures are taken on Windows, because the app draws its text in
the system font, Segoe UI, and a picture taken anywhere else shows another
face (and measures other boxes).

1. In the repository, `pnpm install` if you have not.
2. Run

   ```powershell
   pnpm docs:captures
   ```

   It builds the harness (about three minutes the first time), starts Edge
   or Chrome headless — nothing appears on screen — and writes the six
   pictures and `captured.ts`. Use `--chrome "C:\path\to\chrome.exe"` to name
   the browser, and `--only 18-eq-mode.png` (repeatable) to take one figure.
   The browser should be at least as new as the Chromium in the app's
   Electron: the band rail's dB scale is placed with CSS anchor positioning,
   and an older browser draws it beside the wrong part of the faders.

3. Look at every picture at full size: nothing clipped, crowded or wrong.
4. `pnpm exec jest helpCallouts helpFigureSizes` to check the numbered
   call-outs against the new boxes, then `pnpm docs:guide` to write the
   exported guide again.

Each run builds into `node_modules/.cache/fluideq-help-captures`, out of the
source tree. A figure whose control has moved or been renamed fails with the
finder that found nothing; fix its finder in `figures.ts`.

## The live figures' pictures

The guide in the app draws its figures from the app's own parts
(`src/renderer/help/live/`), so it has no capture to show, but the exported
guide (`docs/USER-GUIDE.md`, `docs/user-guide.html`) is a page of pictures.
`stills.ts` takes them from the figures themselves, in the same harness:

```powershell
pnpm docs:stills
pnpm docs:guide
```

It opens the guide (F1), scrolls to every live figure, waits for its drawing
and its numbered circles, lets its made-up music play for a moment, and cuts
the figure at twice the pixels into `docs/help/<live id>.png` — the `still`
each figure names. English, the window's default colours, software GL so the
run takes nobody's GPU. The figures the repository's README shows (`PLAIN`
in `stills.ts`) are also taken without their circles into
`docs/help/plain/<live id>.png`, because the README has no list for the
numbers to point into. `--only rail-left` (repeatable) takes one figure,
`--skip-build` uses the harness as last built. Retake the pictures whenever a
drawing changes, then export the guide again.
