# FluidEQ social showcase

A nine-page portrait product showcase with real screenshots, an editable PowerPoint, PDF, individual PNGs, platform-specific captions and a plain-text transcript with image descriptions.

## Outputs

- `output/pdf/FluidEQ-Social-Showcase.pdf`
- `output/presentations/FluidEQ-Social-Showcase.pptx`
- `output/social/FluidEQ-Social-Kit.zip`

The ZIP contains both documents, all nine images, posting copy in Markdown and plain text, and the transcript. It is the complete handoff. Files unpacked alongside the archive are working delivery copies and do not need separate copies in git.

## Build

Use the Codex bundled artifact runtime. Set `RUNTIME_NODE_MODULES`, `RUNTIME_PYTHON` and `PRESENTATION_SKILL_DIR` to the locations reported by the workspace-dependency tool. Run `build-showcase.mjs` from the repository root with the bundled Node executable. Run `package-showcase.py` with the bundled Python executable after visually reviewing the PNGs. The PowerPoint finalizer refuses to overwrite an existing final file; preserve previous versions before rebuilding.

The builder records its composition and validation receipt under the ignored `build/social-showcase` directory. PowerPoint text is editable; screenshots are original embedded PNGs. PDF pages use the reviewed social PNGs for consistent appearance and include bookmarks and clickable download links. The separate transcript provides the same narrative as text.

No application launch is involved in this workflow. Validate the artifact, not the running app: PPTX package integrity, slide geometry and font policy, import round-trip, all exported pages, PDF page dimensions/links, caption lengths and ZIP integrity.

## Sources

Feature evidence: repository `README.md`, original product images in `docs/`, and [fluideq.com](https://fluideq.com/) checked September 5, 2026. Speaker notes identify the relevant feature descriptions. Windows is the supported public download; macOS and Linux interface development is not presented as a shipping audio product. The nine-stage DSP rack is scoped to local playback inside FluidEQ.

Platform workflow references: [LinkedIn document posts](https://www.linkedin.com/help/linkedin/answer/a518909) and [X media posts](https://help.x.com/en/using-x/how-to-post).

## Generated background

`fluid-glass-background.png` was produced by the built-in OpenAI image generation tool. It is decorative artwork, not an app screenshot. The supplied app icon remains unchanged.

Prompt:

> Use case: ads-marketing. Asset type: abstract background for FluidEQ audio software portrait social carousel cover. Create a premium abstract macro 3D image of a single flowing translucent liquid-glass ribbon shaped like a gently undulating audio wave, with luminous aqua and turquoise edges, tiny subtle violet and cyan reflections. Dark nearly black navy background #080F19. Portrait 4:5 composition. The ribbon curves only along the far right edge and across the bottom quarter, with the center and upper left two-thirds almost empty dark navy for editable typography and a real app screenshot to be placed later. Sophisticated clean lighting, smooth sculptural glass, tactile, elegant, restrained glow, strong negative space. No text, no logo, no interfaces, no letters, no watermark, no devices. This is abstract decorative artwork, not a product screenshot.
