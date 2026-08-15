# Design QA — Karaoke Maker word resize handles

- Source visual truth: `C:\Users\ivanc\AppData\Local\Temp\codex-clipboard-b2613f10-18dc-4fc0-9267-03f48caf847f.png`
- Browser evidence: `C:\Users\ivanc\Documents\_DEV\_PERSONAL\FluidEQ\design-qa-karaoke-maker-browser-blocked.png`
- Source pixels: 223 × 144
- Browser pixels: 1280 × 720
- CSS viewport: 1280 × 720
- Device pixel ratio: 1
- State: selected lyric word in the Karaoke Maker timing canvas

## Full-view comparison evidence

The source capture shows the selected word `leads` with a visible right resize boundary but no matching left-arrow affordance on the selected word's lane. The implementation could not be rendered in the in-app browser because FluidEQ requires Electron's preload bridge (`platform` and `ipcRenderer`), which is unavailable in an ordinary browser tab.

## Focused-region comparison evidence

The focused source region was opened at native resolution. Code inspection confirmed that an internal word's left boundary was drawn from the preceding word's lane. The Canvas renderer now gives every timed word its own left boundary region and draws outward-pointing chevrons for both `resize-start` and `resize-end` handles. A post-fix focused browser capture is unavailable for the Electron-only reason above.

## Findings

- [P1] Browser-rendered visual verification is blocked.
  - Location: local FluidEQ browser preview at `http://localhost:1212/`.
  - Evidence: the preview enters the app error boundary because the Electron preload bridge is absent.
  - Impact: the revised Canvas arrows cannot be compared visually against the source in the required browser QA surface.
  - Fix: reload the running Electron development window and inspect a selected internal word; both outward arrows should appear on that word's own row.

## Comparison history

- Initial finding: the selected internal word had no left-arrow affordance because the shared boundary was rendered using the previous word's vertical lane.
- Fix made: every timed word now registers and renders its own left boundary, and both handles include directional chevrons.
- Post-fix evidence: TypeScript, ESLint, and 112 focused tests pass. Browser visual evidence remains blocked by the Electron-only preload dependency.

## Required fidelity surfaces

- Fonts and typography: unchanged by this patch; not visually reverified because the Electron surface could not render in Browser.
- Spacing and layout rhythm: handle geometry remains within the existing lyric timing lane; post-fix visual verification blocked.
- Colors and visual tokens: existing cyan/glow tokens retained; post-fix visual verification blocked.
- Image quality and assets: no image assets changed.
- Copy and content: unchanged.

## Implementation checklist

- Reload the Electron window.
- Select a non-first word.
- Confirm a left-pointing arrow at its start and a right-pointing arrow at its end.
- Drag both handles and confirm adjacent timings remain contiguous.

final result: blocked
