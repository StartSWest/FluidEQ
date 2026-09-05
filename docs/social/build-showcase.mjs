import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { addShowcasePages } from './showcase-content.mjs';

// Run from the repository root with the bundled presentation runtime.
const root = process.cwd();
const { RUNTIME_NODE_MODULES, PRESENTATION_SKILL_DIR, RUNTIME_PYTHON } =
  process.env;
if (!RUNTIME_NODE_MODULES || !PRESENTATION_SKILL_DIR || !RUNTIME_PYTHON) {
  throw new Error(
    'Set RUNTIME_NODE_MODULES, PRESENTATION_SKILL_DIR and RUNTIME_PYTHON.',
  );
}
const { Presentation, PresentationFile } = await import(
  pathToFileURL(
    path.join(
      RUNTIME_NODE_MODULES,
      '@oai/artifact-tool/dist/artifact_tool.mjs',
    ),
  )
);
const { finalizePresentation } = await import(
  pathToFileURL(
    path.join(
      PRESENTATION_SKILL_DIR,
      'container_tools/artifact_tool_utils.mjs',
    ),
  )
);
const staging = path.join(root, 'build/social-showcase');
const kit = path.join(root, 'output/social/FluidEQ-Social-Kit');
await fs.mkdir(staging, { recursive: true });
await fs.mkdir(kit, { recursive: true });
const presentation = Presentation.create({
  slideSize: { width: 1080, height: 1350 },
});
const composition = [];
const white = '#F4F8FC';
const muted = '#BDD0DF';
const accent = '#6DE7DC';
let current;

function text(
  slide,
  value,
  x,
  y,
  w,
  h,
  size = 34,
  color = white,
  bold = false,
) {
  const shape = slide.shapes.add({
    geometry: 'textbox',
    name: value.replaceAll('\n', ' ').slice(0, 50),
    position: { left: x, top: y, width: w, height: h },
    fill: 'none',
    line: { fill: 'none', width: 0 },
  });
  shape.text = value;
  shape.text.style = {
    typeface: 'Segoe UI',
    fontSize: size,
    bold,
    color,
    autoFit: 'none',
    verticalAlignment: 'top',
    wrap: 'none',
    insets: { left: 0, top: 0, right: 0, bottom: 0 },
  };
  current.elements.push({ type: 'text', value, x, y, w, h, size, color, bold });
  return shape;
}

async function picture(slide, file, x, y, w, h, alt, fit = 'contain') {
  slide.images.add({
    blob: new Uint8Array(await fs.readFile(path.join(root, file))),
    contentType: 'image/png',
    fit,
    alt,
    position: { left: x, top: y, width: w, height: h },
  });
  current.elements.push({ type: 'image', file, x, y, w, h, alt, fit });
}

async function page(number, title, art = false) {
  const slide = presentation.slides.add();
  slide.background.fill = '#080F19';
  current = { number, title, background: '#080F19', elements: [] };
  composition.push(current);
  if (art)
    await picture(
      slide,
      'docs/social/fluid-glass-background.png',
      0,
      0,
      1080,
      1350,
      'Abstract aqua liquid-glass wave on dark navy',
      'cover',
    );
  if (number !== 1 && number !== 11) {
    await picture(slide, 'assets/icon.png', 64, 56, 44, 44, 'FluidEQ logo');
    text(slide, 'FluidEQ', 123, 57, 400, 45, 29, white, true);
  }
  text(slide, 'fluideq.com', 64, 1273, 500, 40, 26, muted);
  text(
    slide,
    String(number).padStart(2, '0') + ' / 11',
    905,
    1273,
    140,
    40,
    25,
    muted,
  );
  return slide;
}

function notes(slide, description, source) {
  slide.speakerNotes.textFrame.setText(
    description +
      '\n\nFeature evidence: repository README.md, ' +
      source +
      '. Public cross-check: https://fluideq.com/ (5 September 2026). ' +
      'Screenshots are existing repository product captures. Displayed media belongs to its respective owners; no affiliation or included music is implied. ' +
      'Decorative cover/end background generated using OpenAI image generation; original FluidEQ logo preserved.',
  );
}

await addShowcasePages({ page, picture, text, notes, accent, white, muted });

await fs.writeFile(
  path.join(staging, 'composition.json'),
  JSON.stringify(composition, null, 2),
);
const candidatePath = path.join(staging, 'candidate.pptx');
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
const validatedPath = path.join(
  await fs.mkdtemp(path.join(staging, 'validated-')),
  'FluidEQ-Social-Showcase.pptx',
);
await finalizePresentation({
  workspaceDir: root,
  candidatePath,
  finalPath: validatedPath,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(
    PRESENTATION_SKILL_DIR,
    'container_tools/inspect_presentation_package_integrity.py',
  ),
  layoutValidatorPath: path.join(
    PRESENTATION_SKILL_DIR,
    'container_tools/inspect_presentation_layout_geometry.py',
  ),
  layoutArgs: [
    '--expected-slide-size-emu',
    '10287000,12858750',
    '--validate-heading-fit',
  ],
  explicitTotalSlideCount: 11,
  requiredNativeTableOwnerSlides: [],
  fontPolicy: { basis: 'design', families: ['Segoe UI'] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(
    staging,
    path.basename(path.dirname(validatedPath)) + '-validation.json',
  ),
});
// Publish the validated revision to the stable delivery filename.
await fs.copyFile(
  validatedPath,
  path.join(root, 'output/presentations/FluidEQ-Social-Showcase.pptx'),
);
for (let i = 0; i < presentation.slides.items.length; i++) {
  const output = await presentation.export({
    slide: presentation.slides.items[i],
    format: 'png',
    scale: 1,
  });
  await fs.writeFile(
    path.join(kit, `${String(i + 1).padStart(2, '0')}-FluidEQ.png`),
    new Uint8Array(await output.arrayBuffer()),
  );
}
console.log('Created 11-slide editable showcase and social PNGs.');
