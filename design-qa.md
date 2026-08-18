# Design QA — responsive workspace, Karaoke, and live graph

- Source visual truth:
  - `C:\Users\ivanc\AppData\Local\Temp\codex-clipboard-c2b993aa-9f36-44b2-8fbe-0af018f94b99.png`
  - `C:\Users\ivanc\AppData\Local\Temp\codex-clipboard-650b8f07-4180-480e-8cdc-45d0f79d7413.png`
  - `C:\Users\ivanc\AppData\Local\Temp\codex-clipboard-cb897cd3-1ba4-4c92-b691-5a1f7d02d562.png`
  - `C:\Users\ivanc\AppData\Local\Temp\codex-clipboard-8358fc68-415d-47f8-b2ee-2a6224cf048a.png`
  - `C:\Users\ivanc\AppData\Local\Temp\codex-clipboard-c1b5ea35-7709-455b-8069-bbad0980a949.png`
  - `C:\Users\ivanc\AppData\Local\Temp\codex-clipboard-5298a7e5-f92a-4db9-8fbd-9a466df58ef6.png`
  - `C:\Users\ivanc\AppData\Local\Temp\codex-clipboard-31ea7523-369b-4bc2-97d0-9335a9e066de.png`
- Implementation screenshots:
  - `D:\DEV\_PERSONAL\FluidEQ\design-qa-responsive-mobile.png`
  - `D:\DEV\_PERSONAL\FluidEQ\design-qa-responsive-media.png`
  - `D:\DEV\_PERSONAL\FluidEQ\design-qa-responsive-karaoke.png`
  - `D:\DEV\_PERSONAL\FluidEQ\design-qa-waveform-live.png`
  - `D:\DEV\_PERSONAL\FluidEQ\design-qa-karaoke-doubleclick-fullscreen.png`
  - `D:\DEV\_PERSONAL\FluidEQ\design-qa-karaoke-doubleclick-normal.png`
  - `D:\DEV\_PERSONAL\FluidEQ\design-qa-karaoke-graph-overlay.png`
  - `D:\DEV\_PERSONAL\FluidEQ\design-qa-karaoke-graph-header.png`
  - `D:\DEV\_PERSONAL\FluidEQ\design-qa-karaoke-graph-no-header.png`
- Source pixels: 723 × 1395, 733 × 1393, and 714 × 1399
- Implementation pixels: 720 × 1391 for all three captures
- CSS viewport: 720 × 1391
- Device pixel ratio and normalization: direct CSS-pixel Electron capture; source crops differ by at most 13px and were compared at their native narrow-window scale
- State: EQ with the response graph enabled, Media with the graph disabled, Karaoke Maker with the graph disabled, Karaoke player in normal/fullscreen, and the response graph expanded over Karaoke

## Full-view comparison evidence

The original EQ capture shows the graph beginning inside the still-visible selected-band editor and continuing without a bounded end. In the revised capture, the editor completes before the graph begins. Live DOM sampling held the graph at exactly 720px, the graph plot at 718px, and the page scroll height at 1768px for sixteen samples over eight seconds.

The original Media and Karaoke captures stop their active surfaces near the top half of the window and leave the remaining workspace empty. In the revised captures, both active panels measure 1097px and extend to the bottom edge of the 1133px center workspace.

The original live-output capture has active L/R meters but a flat titlebar trace. The revised capture shows a continuously changing, full-width multicolor waveform driven from the same channel analyzers as the meters.

The original Karaoke overlay places the graph menu and pet over Karaoke's top-left and top-right song controls. The revised expanded overlay keeps the song and chord chrome unobstructed and docks the graph menu 12px from the lower-right edge. Karaoke stays sharp while the saved graph-only styling computes to opacity `0.63` and `blur(22px)`.

The revised fullscreen Karaoke capture keeps the transport 12px above the screen edge. Live double-click sampling changed the player from normal to fullscreen and back to normal, with the stage remaining the toggle surface.

The latest source crop shows the retained 78px graph-fullscreen titlebar covering the upper half of Karaoke's chord and lyric-size controls. In the revised capture, the full-bleed stage remains at the screen edge while the Karaoke heading begins at 99px, the chord controls at 133px, and the collapsed-playlist control at 91px. With the titlebar hidden, those elements return to 21px, 55px, and 13px respectively, confirming the offset is conditional rather than baked into Karaoke fullscreen.

## Focused-region comparison evidence

No additional crop was needed. At this narrow width the three full-height captures keep the affected pane edges, the graph boundary, and the empty-space regression readable at the same time.

## Findings

- No actionable P0/P1/P2 mismatch remains for the reported responsive states.
- The response graph now has a bounded mobile height and no longer participates in the page-height feedback loop.
- Media and Karaoke use the available mobile center row instead of stopping at intrinsic content height.
- The titlebar waveform now follows real channel activity even for opposite-polarity stereo content.
- Karaoke lyrics have a stronger focused line and a calmer, more legible distance fade.
- The Karaoke pitch-guide button has an unmistakable selected state.
- Expanded graph controls no longer collide with Karaoke metadata, chords, or the pet.
- Karaoke can be toggled into and out of fullscreen by double-clicking the stage; interactive controls and the Maker remain protected.
- Core EQ, EQ Presets, Voicing, and Convolution panels no longer animate through a dark opacity frame when tabs change.
- A retained graph-fullscreen titlebar no longer clips Karaoke song, chord, text-size, or playlist controls.

## Comparison history

- Earlier P1: the mobile graph flexed inside an auto-height scrolling page, repeatedly enlarging its own containing block.
  - Fix: the mobile graph is a non-growing viewport-relative slice, the desktop pane divider is hidden at this breakpoint, and the editor returns to natural content height.
  - Post-fix evidence: graph 720px, plot 718px, page scroll height 1768px, unchanged through sixteen 500ms samples.
- Earlier P1: Media and Karaoke left the lower half of tall narrow windows unused.
  - Fix: the mobile workspace grid now assigns remaining viewport height to the center row while retaining content-driven page growth when required.
  - Post-fix evidence: Media and Karaoke each fill a 1097px active panel inside the 1133px center workspace.

## Required fidelity surfaces

- Fonts and typography: unchanged; existing FluidEQ families, weights, and truncation rules are preserved.
- Spacing and layout rhythm: the existing 12px center gap and panel radii are preserved; only mobile track sizing and graph height ownership changed.
- Colors and visual tokens: unchanged; all existing surface, border, graph, and Karaoke tokens remain in use.
- Image quality and assets: unchanged; the embedded video and existing Karaoke canvas rendering retain their native output.
- Copy and content: unchanged.

## Primary interactions tested

- Switched among EQ, Media, and Karaoke at the 720px breakpoint.
- Enabled and disabled the response graph through the existing visualizer control.
- Confirmed the Media guest view and Karaoke Maker both resize with their active pane.
- Double-clicked the Karaoke stage into fullscreen and back to normal; measured the fullscreen transport bottom inset at 15px including its border.
- Expanded the response graph over Karaoke and confirmed graph-only opacity/blur plus a bottom-docked options bar.
- Confirmed the live waveform and L/R meters remain active together.
- Confirmed the ordinary workspace tab panel has no opacity animation (`animation-name: none`).
- Toggled the graph-fullscreen top bar off and on: hidden chrome returned Karaoke to its normal top spacing, and restored chrome reserved exactly the 78px titlebar before interactive controls.

## Console and build checks

- DOM and computed-style inspection completed through the running Electron renderer.
- `pnpm.cmd typecheck:styles` passed.
- `pnpm.cmd typecheck` passed.
- Focused Jest suites passed: 3 suites, 36 tests, including Karaoke surface fullscreen toggling, lyric rendering, and channel waveform aggregation.

## Implementation checklist

- Bound the mobile graph independently of document height.
- Remove the desktop-only pane resize interaction in stacked mode.
- Make the mobile center grid row consume remaining viewport space.
- Verify graph, Media, and Karaoke states in the running renderer.
- Verify Karaoke normal/fullscreen round trips and lower transport spacing.
- Verify graph overlay controls and visual effects against the Karaoke surface.
- Verify the titlebar waveform against active output meters.
- Verify Karaoke control clearance in graph fullscreen with the top bar both shown and hidden.

final result: passed
