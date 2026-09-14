/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import prettier from 'prettier';
import {
  HELP_CHAPTERS,
  helpCaptureWidth,
  helpPieceScale,
  type IHelpControl,
  type IHelpFigure,
} from '../../src/common/helpGuide';
import en from '../../src/common/i18n/en';

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

const chapters = HELP_CHAPTERS.map(({ id, group, figures }) => ({
  id,
  group,
  figures,
  title: en[`help.${id}.title`],
  intro: en[`help.${id}.intro`],
  steps: en[`help.${id}.steps`].split('\n'),
  tip: en[`help.${id}.tip`],
}));
const captures = new Set(
  chapters.flatMap((chapter) => chapter.figures.map((figure) => figure.image)),
);
const output = path.resolve(__dirname, '../../docs');
captures.forEach((image) => {
  if (!fs.existsSync(path.join(output, image))) {
    throw new Error(`User guide capture is missing: ${image}`);
  }
});

const figureTitle = (figure: IHelpFigure, chapterTitle: string) =>
  figure.caption ? en[figure.caption] : chapterTitle;

const controlLine = (control: IHelpControl) =>
  `- **${en[control.name]}**${control.keys ? ` (\`${control.keys}\`)` : ''} — ${en[control.text]}`;

const startsGroup = (index: number) =>
  index === 0 || chapters[index].group !== chapters[index - 1].group;

const markdown = [
  '# FluidEQ · User guide',
  '',
  `> ${en['help.subtitle']}`,
  '',
  en['help.intro'],
  '',
  en['help.captureNote'],
  '',
  '**In FluidEQ: Help → User guide, or press F1.**',
  '',
  '[Open the illustrated, print-ready edition](user-guide.html)',
  '',
  ...chapters.flatMap((chapter, index) => [
    ...(startsGroup(index)
      ? ['', `**${en[`help.group.${chapter.group}`]}**`, '']
      : []),
    `${index + 1}. [${chapter.title}](#${chapter.id})`,
  ]),
  '',
  ...chapters.flatMap((chapter) => [
    `<a id="${chapter.id}"></a>`,
    '',
    `## ${chapter.title}`,
    '',
    chapter.intro,
    '',
    ...chapter.figures.flatMap((figure) => [
      ...(figure.caption ? [`### ${en[figure.caption]}`, ''] : []),
      `![${figureTitle(figure, chapter.title)}](${figure.image})`,
      '',
      ...(figure.controls ?? []).map(controlLine),
      ...(figure.controls?.length ? [''] : []),
    ]),
    `### ${en['help.steps']}`,
    '',
    ...chapter.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    `> **${en['help.tip']}:** ${chapter.tip}`,
    '',
  ]),
];

const piece = (figure: IHelpFigure, control: IHelpControl) => {
  if (!control.icon) {
    return '';
  }
  const [x, y, width, height] = control.icon;
  const scale = helpPieceScale(control.icon);
  return `<span class="well"><span class="piece" style="width:${width * scale}px;height:${height * scale}px;background-image:url('${figure.image}');background-size:${figure.width * scale}px ${figure.height * scale}px;background-position:${-x * scale}px ${-y * scale}px"></span></span>`;
};

const figureHtml = (figure: IHelpFigure, chapterTitle: string) => {
  const title = figureTitle(figure, chapterTitle);
  const controls = figure.controls ?? [];
  const width = helpCaptureWidth(figure);
  return `${figure.caption ? `<h3>${escape(title)}</h3>` : ''}<div class="figure-body"><figure style="flex-basis:${width};max-width:${width}"><a href="${figure.image}" aria-label="${escape(en['help.enlarge'].replace('{title}', title))}"><img src="${figure.image}" width="${figure.width}" height="${figure.height}" alt="${escape(title)}" loading="lazy"></a><figcaption>${escape(title)} · FluidEQ</figcaption></figure>${
    controls.length
      ? `<ul class="controls">${controls
          .map(
            (control) =>
              `<li${control.icon ? '' : ' class="plain"'}>${piece(figure, control)}<span><span class="name"><strong>${escape(en[control.name])}</strong>${control.keys ? `<kbd>${escape(control.keys)}</kbd>` : ''}</span><span class="text">${escape(en[control.text])}</span></span></li>`,
          )
          .join('')}</ul>`
      : ''
  }</div>`;
};

const sections = chapters
  .map(
    (chapter, index) => `<section id="${chapter.id}">
  ${startsGroup(index) ? `<span class="eyebrow part">${escape(en[`help.group.${chapter.group}`])}</span>` : ''}
  <header class="chapter-heading"><span class="number">${String(index + 1).padStart(2, '0')}</span><h2>${escape(chapter.title)}</h2></header>
  <p>${escape(chapter.intro)}</p>
  ${chapter.figures.map((figure) => figureHtml(figure, chapter.title)).join('\n  ')}
  <h3>${escape(en['help.steps'])}</h3><ol>${chapter.steps.map((step) => `<li>${escape(step)}</li>`).join('')}</ol>
  <aside class="tip"><strong>${escape(en['help.tip'])}</strong><p>${escape(chapter.tip)}</p></aside>
</section>`,
  )
  .join('\n');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light"><title>FluidEQ · User guide</title>
<style>
:root{color-scheme:dark;--bg:#0b1926;--panel:#152b3b;--well:#07121b;--text:#ecf5fb;--muted:#bed3df;--accent:#70ddce;--line:#304b5b}
*{box-sizing:border-box}html{scroll-padding-top:2rem}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Ubuntu,Cantarell,'Noto Sans','DejaVu Sans',sans-serif;font-variant-numeric:tabular-nums;line-height:1.75}
a{color:var(--accent);text-underline-offset:4px}a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:4px}
.shell{display:grid;grid-template-columns:270px minmax(0,1fr);max-width:1600px;margin:auto}.rail{position:sticky;top:0;height:100vh;overflow:auto;padding:32px 22px;background:var(--panel);border-right:1px solid var(--line)}
.brand{font-size:24px;font-weight:bold;letter-spacing:-.04em}.rail small{display:block;color:var(--accent);margin-bottom:28px}.rail nav{display:grid;gap:7px}.rail nav a{color:var(--muted);font-size:14px;text-decoration:none;padding:6px 0}.rail nav a:hover{color:var(--accent)}.rail nav .part{margin-top:14px;color:var(--accent);font-size:11px;letter-spacing:.14em;text-transform:uppercase}
main{min-width:0;padding:60px clamp(22px,5vw,80px)}.hero{padding-bottom:38px}.eyebrow{text-transform:uppercase;letter-spacing:.15em;font-size:12px;color:var(--accent)}.eyebrow.part{display:block;margin-bottom:14px}h1{font-size:clamp(36px,4.5vw,64px);line-height:1.08;letter-spacing:-.04em;max-width:750px;margin:26px 0}h2{font-size:28px;line-height:1.25;margin:0}h3{font-size:17px}.lead{font-size:20px;color:var(--muted);max-width:730px}.note{font-size:13px;color:var(--muted);max-width:760px}
.badge,button{display:inline-block;border:1px solid var(--line);border-radius:9px;padding:8px 13px;font:inherit;font-size:13px}.badge{color:var(--accent)}button{background:var(--accent);color:var(--bg);cursor:pointer;margin:10px 0}section{padding:40px 0 52px;border-top:1px solid var(--line)}.chapter-heading{display:flex;align-items:center;gap:20px}.number{color:var(--accent);font-size:18px;border:1px solid var(--line);border-radius:50%;width:44px;height:44px;display:grid;place-items:center;flex-shrink:0}p{margin:18px 0 24px}figure{margin:28px 0 12px}figure img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:12px}figcaption{color:var(--muted);font-size:12px;margin-top:8px}li{padding-left:8px;margin:12px 0}li::marker{color:var(--accent);font-weight:bold}.tip{background:var(--panel);border-left:3px solid var(--accent);border-radius:8px;padding:18px 22px}.tip strong{color:var(--accent)}.tip p{margin:4px 0 0}footer{font-size:13px;color:var(--muted)}
.figure-body{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:center;gap:16px 20px;margin:28px 0 12px}.figure-body figure{flex-grow:0;flex-shrink:1;min-width:0;margin:0}.controls{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:8px;flex:1 1 300px;min-width:min(100%,300px);margin:0;padding:0;list-style:none}.controls li{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:12px;margin:0;padding:9px 12px 9px 9px;border:1px solid var(--line);border-radius:10px;background:var(--panel);break-inside:avoid}.controls li::marker{content:none}.controls li.plain{grid-template-columns:minmax(0,1fr)}.well{display:grid;place-items:center;min-width:44px;min-height:44px;padding:4px;border-radius:8px;background:var(--well)}.piece{display:block;background-repeat:no-repeat}.name{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 10px;line-height:1.35}.name kbd{padding:1px 6px;border:1px solid var(--line);border-radius:6px;font-size:11px;white-space:nowrap}.text{display:block;color:var(--muted);font-size:13px;line-height:1.45}
@media(max-width:850px){.shell{display:block}.rail{position:static;height:auto;padding:20px}.rail nav{grid-template-columns:repeat(2,minmax(0,1fr))}main{padding:32px 20px}h2{font-size:24px}}
@media print{ :root{color-scheme:light;--bg:white;--panel:#f2f6f7;--well:#dfe8ec;--text:#132b38;--muted:#425d6d;--accent:#17665e;--line:#b7cbd4}body{font-size:10pt}.shell{display:block}.rail{display:none}main{padding:0}.hero{break-after:page}h1{font-size:38pt}section{break-before:page;padding:12pt 0;border:0}.chapter-heading,figure,.tip{break-inside:avoid}figure img{border-radius:4px}figure{margin:14pt 0}h2{font-size:20pt}h3{break-after:avoid}li{margin:6pt 0}button{display:none}a{color:inherit;text-decoration:none}.piece{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:16mm}}
</style></head><body><div class="shell"><aside class="rail"><div class="brand">FluidEQ</div><small>User guide · Offline edition</small><nav aria-label="In this guide">${chapters.map((chapter, index) => `${startsGroup(index) ? `<span class="part">${escape(en[`help.group.${chapter.group}`])}</span>` : ''}<a href="#${chapter.id}">${String(index + 1).padStart(2, '0')} &nbsp; ${escape(chapter.title)}</a>`).join('')}</nav></aside>
<main><header class="hero"><span class="eyebrow">FluidEQ / The illustrated guide</span><h1>${escape(en['help.subtitle'])}</h1><p class="lead">${escape(en['help.intro'])}</p><span class="badge">${chapters.length} chapters · ${captures.size} real interface captures · Offline</span><p><strong>In FluidEQ: Help → User guide, or press F1.</strong></p><button type="button" id="print">Print / Save as PDF</button><p class="note">${escape(en['help.captureNote'])}</p></header>${sections}<footer>FluidEQ · User guide · © 2026 Ivan Carmenates Garcia. Screenshots remain unaltered. Keep this document beside its PNG files for offline viewing.</footer></main></div>
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
