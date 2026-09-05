/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import prettier from 'prettier';
import { HELP_CHAPTERS } from '../../src/common/helpGuide';
import help from '../../src/common/i18n/en/help';

// The shipped reader and the document use the same text and captures, so a
// corrected instruction cannot silently leave the downloadable guide behind.
const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
const chapters = HELP_CHAPTERS.map(({ id, image, width, height }) => ({
  id,
  image,
  width,
  height,
  title: help[`help.${id}.title`],
  intro: help[`help.${id}.intro`],
  steps: help[`help.${id}.steps`].split('\n'),
  tip: help[`help.${id}.tip`],
}));
const output = path.resolve(__dirname, '../../docs');
chapters.forEach(({ image }) => {
  if (!fs.existsSync(path.join(output, image))) {
    throw new Error(`User guide capture is missing: ${image}`);
  }
});
const markdown = [
  '# FluidEQ · User guide',
  '',
  `> ${help['help.subtitle']}`,
  '',
  help['help.intro'],
  '',
  help['help.captureNote'],
  '',
  '**In FluidEQ: Help → User guide, or press F1.**',
  '',
  '[Open the illustrated, print-ready edition](user-guide.html)',
  '',
  ...chapters.map(
    (chapter, index) => `${index + 1}. [${chapter.title}](#${chapter.id})`,
  ),
  '',
  ...chapters.flatMap((chapter) => [
    `<a id="${chapter.id}"></a>`,
    '',
    `## ${chapter.title}`,
    '',
    chapter.intro,
    '',
    `![${chapter.title}](${chapter.image})`,
    '',
    `### ${help['help.steps']}`,
    '',
    ...chapter.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    `> **${help['help.tip']}:** ${chapter.tip}`,
    '',
  ]),
];

const sections = chapters
  .map(
    (chapter, index) => `<section id="${chapter.id}">
  <header class="chapter-heading"><span class="number">${String(index + 1).padStart(2, '0')}</span><h2>${escape(chapter.title)}</h2></header>
  <p>${escape(chapter.intro)}</p>
  <figure><a href="${chapter.image}" aria-label="${escape(help['help.enlarge'].replace('{title}', chapter.title))}"><img src="${chapter.image}" width="${chapter.width}" height="${chapter.height}" alt="${escape(chapter.title)}" loading="lazy"></a><figcaption>${escape(chapter.title)} · FluidEQ</figcaption></figure>
  <h3>${escape(help['help.steps'])}</h3><ol>${chapter.steps.map((step) => `<li>${escape(step)}</li>`).join('')}</ol>
  <aside class="tip"><strong>${escape(help['help.tip'])}</strong><p>${escape(chapter.tip)}</p></aside>
</section>`,
  )
  .join('\n');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light"><title>FluidEQ · User guide</title>
<style>
:root{color-scheme:dark;--bg:#0b1926;--panel:#152b3b;--text:#ecf5fb;--muted:#bed3df;--accent:#70ddce;--line:#304b5b}
*{box-sizing:border-box}html{scroll-padding-top:2rem}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Ubuntu,Cantarell,'Noto Sans','DejaVu Sans',sans-serif;font-variant-numeric:tabular-nums;line-height:1.75}
a{color:var(--accent);text-underline-offset:4px}a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:4px}
.shell{display:grid;grid-template-columns:270px minmax(0,1fr);max-width:1600px;margin:auto}.rail{position:sticky;top:0;height:100vh;overflow:auto;padding:32px 22px;background:var(--panel);border-right:1px solid var(--line)}
.brand{font-size:24px;font-weight:bold;letter-spacing:-.04em}.rail small{display:block;color:var(--accent);margin-bottom:28px}.rail nav{display:grid;gap:7px}.rail nav a{color:var(--muted);font-size:14px;text-decoration:none;padding:6px 0}.rail nav a:hover{color:var(--accent)}
main{min-width:0;padding:60px clamp(22px,5vw,80px)}.hero{padding-bottom:38px}.eyebrow{text-transform:uppercase;letter-spacing:.15em;font-size:12px;color:var(--accent)}h1{font-size:clamp(36px,4.5vw,64px);line-height:1.08;letter-spacing:-.04em;max-width:750px;margin:26px 0}h2{font-size:28px;line-height:1.25;margin:0}h3{font-size:17px}.lead{font-size:20px;color:var(--muted);max-width:730px}.note{font-size:13px;color:var(--muted);max-width:760px}
.badge,button{display:inline-block;border:1px solid var(--line);border-radius:9px;padding:8px 13px;font:inherit;font-size:13px}.badge{color:var(--accent)}button{background:var(--accent);color:var(--bg);cursor:pointer;margin:10px 0}section{padding:40px 0 52px;border-top:1px solid var(--line)}.chapter-heading{display:flex;align-items:center;gap:20px}.number{color:var(--accent);font-size:18px;border:1px solid var(--line);border-radius:50%;width:44px;height:44px;display:grid;place-items:center;flex-shrink:0}p{margin:18px 0 24px}figure{margin:28px 0}figure img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:12px}figcaption{color:var(--muted);font-size:12px;margin-top:8px}li{padding-left:8px;margin:12px 0}li::marker{color:var(--accent);font-weight:bold}.tip{background:var(--panel);border-left:3px solid var(--accent);border-radius:8px;padding:18px 22px}.tip strong{color:var(--accent)}.tip p{margin:4px 0 0}footer{font-size:13px;color:var(--muted)}
@media(max-width:850px){.shell{display:block}.rail{position:static;height:auto;padding:20px}.rail nav{grid-template-columns:repeat(2,minmax(0,1fr))}main{padding:32px 20px}h2{font-size:24px}}
@media print{ :root{color-scheme:light;--bg:white;--panel:#f2f6f7;--text:#132b38;--muted:#425d6d;--accent:#17665e;--line:#b7cbd4}body{font-size:10pt}.shell{display:block}.rail{display:none}main{padding:0}.hero{break-after:page}h1{font-size:38pt}section{break-before:page;padding:12pt 0;border:0}.chapter-heading,figure,.tip{break-inside:avoid}figure img{border-radius:4px}figure{margin:14pt 0}h2{font-size:20pt}h3{break-after:avoid}li{margin:6pt 0}button{display:none}a{color:inherit;text-decoration:none}@page{size:A4;margin:16mm}}
</style></head><body><div class="shell"><aside class="rail"><div class="brand">FluidEQ</div><small>User guide · Offline edition</small><nav aria-label="In this guide">${chapters.map((chapter, index) => `<a href="#${chapter.id}">${String(index + 1).padStart(2, '0')} &nbsp; ${escape(chapter.title)}</a>`).join('')}</nav></aside>
<main><header class="hero"><span class="eyebrow">FluidEQ / The illustrated guide</span><h1>${escape(help['help.subtitle'])}</h1><p class="lead">${escape(help['help.intro'])}</p><span class="badge">${chapters.length} chapters · ${new Set(chapters.map((chapter) => chapter.image)).size} real interface captures · Offline</span><p><strong>In FluidEQ: Help → User guide, or press F1.</strong></p><button type="button" id="print">Print / Save as PDF</button><p class="note">${escape(help['help.captureNote'])}</p></header>${sections}<footer>FluidEQ · User guide · © 2026 Ivan Carmenates Garcia. Screenshots remain unaltered. Keep this document beside its PNG files for offline viewing.</footer></main></div>
<script>document.getElementById('print').addEventListener('click',async()=>{const button=document.getElementById('print');button.disabled=true;try{await Promise.all(Array.from(document.images,image=>{image.loading='eager';return image.decode()}));window.print()}catch(error){console.error('Cannot print the guide because a screenshot did not load.',error);button.textContent='A screenshot could not load. Keep the PNG files beside this document, then try again.'}finally{button.disabled=false}});</script></body></html>`;

const writeGuide = async (): Promise<void> => {
  const [formattedMarkdown, formattedHtml] = await Promise.all([
    prettier.format(markdown.join('\n'), {
      parser: 'markdown',
      singleQuote: true,
    }),
    prettier.format(html, { parser: 'html', singleQuote: true }),
  ]);
  fs.writeFileSync(path.join(output, 'USER-GUIDE.md'), formattedMarkdown);
  fs.writeFileSync(path.join(output, 'user-guide.html'), formattedHtml);
};

writeGuide().catch((error: unknown) => {
  console.error('Could not export the FluidEQ user guide.', error);
  process.exitCode = 1;
});
