import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const root = process.cwd();
const base = path.join(
  root,
  'outputs/01a1756e-064d-7e03-970a-b2a37d7937b3/FluidEQ-Marketing-Kit',
);
const build = path.join(root, 'build/fluid-marketing-2026');
const data = JSON.parse(
  await fs.readFile(path.join(base, 'schedule/campaign.json'), 'utf8'),
);
const ledger = JSON.parse(
  await fs.readFile(path.join(base, 'schedule/publishing-ledger.json'), 'utf8'),
);
for (const row of data.posts) {
  const receipt = ledger.receipts.find((item) => item.campaign_id === row.id);
  if (receipt?.state === 'scheduled_verified') {
    row.status = 'Scheduled - verified';
  }
}
const wb = Workbook.create();
const schedule = wb.worksheets.add('Schedule');
const copy = wb.worksheets.add('Captions');
const review = wb.worksheets.add('Weekly review');
const navy = '#10263A';
const mint = '#DDF8F0';
const body = '#18354B';

function setup(sheet, last, title, subtitle) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${last}80`).format.font = {
    name: 'Arial',
    size: 11,
    color: body,
  };
  sheet.getRange('A1').values = [[title]];
  sheet.getRange('A1').format.font = {
    name: 'Arial',
    size: 16,
    bold: true,
    color: navy,
  };
  sheet.getRange('A1').format.rowHeight = 29;
  sheet.getRange('A2').values = [[subtitle]];
  sheet.getRange('A2').format.rowHeight = 25;
  sheet.tabColor = navy;
}

function header(sheet, range, values) {
  sheet.getRange(range).values = [values];
  sheet.getRange(range).format = {
    fill: navy,
    font: { name: 'Arial', size: 11, bold: true, color: '#FFFFFF' },
    rowHeight: 32,
    wrapText: true,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
  };
}

setup(
  schedule,
  'K',
  'FluidEQ organic calendar',
  'Oct 26 - Dec 25, 2026 | America/New_York | No paid ads',
);
schedule.getRange('A4').values = [['61 daily slots']];
schedule.getRange('C4').formulas = [['=COUNTIFS(E8:E68,"<>Story")']];
schedule.getRange('D4').values = [['Feed posts']];
schedule.getRange('F4').formulas = [['=COUNTIFS(E8:E68,"Story")']];
schedule.getRange('G4').values = [['Stories']];
schedule.getRange('A5').values = [
  [
    'Nov 1 launch is tentative. Verify the public 2.1 installer before any live claim.',
  ],
];
schedule.getRange('A5').format.font = {
  name: 'Arial',
  size: 11,
  color: '#916000',
};
header(schedule, 'A7:K7', [
  'ID',
  'Date',
  'Time (ET)',
  'Week',
  'Format',
  'Theme',
  'Headline',
  'Release gate',
  'Publishing status',
  'Asset files',
  'Next step',
]);
const values = data.posts.map((r) => [
  r.id,
  new Date(`${r.date}T12:00:00Z`),
  Number(r.time.slice(0, 2)) / 24 + Number(r.time.slice(3)) / 1440,
  r.week,
  r.format,
  r.theme,
  r.headline,
  r.gate,
  r.status,
  r.files.join('\n'),
  r.gate === '2.1 live'
    ? 'Verify release; use evergreen fallback if unavailable.'
    : 'Queue organically; verify receipt.',
]);
schedule.getRange('A8:K68').values = values;
schedule.getRange('B8:B68').setNumberFormat('ddd, mmm d');
schedule.getRange('C8:C68').setNumberFormat('h:mm AM/PM');
schedule.getRange('D8:D68').setNumberFormat('0');
schedule.getRange('A8:K68').format.rowHeight = 67;
schedule.getRange('A8:K68').format.wrapText = true;
schedule.getRange('A8:K68').format.verticalAlignment = 'center';
const widths = [13, 18, 13, 7, 13, 29, 44, 15, 28, 34, 42];
widths.forEach((w, i) => {
  schedule.getRangeByIndexes(6, i, 62, 1).format.columnWidth = w;
});
schedule.getRange('H8:H68').conditionalFormats.add('containsText', {
  text: '2.1 live',
  format: { fill: '#FFF0D3', font: { color: '#805500', bold: true } },
});
schedule.getRange('I8:I68').dataValidation = {
  rule: {
    type: 'list',
    values: [
      'Prepared - not scheduled',
      'Scheduled - verified',
      'Published - verified',
      'Held - release',
      'Fallback scheduled',
      'Skipped',
    ],
  },
};
schedule.tables.add('A7:K68', true, 'FluidSchedule');
schedule.freezePanes.freezeRows(7);
schedule.freezePanes.freezeColumns(2);

setup(
  copy,
  'H',
  'Ready-to-use copy',
  'Use image files in order. Captions are English-first; all publishing is organic.',
);
header(copy, 'A4:H4', [
  'ID',
  'Headline',
  'Caption',
  'Image description',
  'Release requirement',
  'Fallback caption',
  'Fallback image',
  'Tracked destination',
]);
copy.getRange('A5:H65').values = data.posts.map((r) => [
  r.id,
  r.headline,
  r.caption,
  r.alt,
  r.release_check,
  r.gate === '2.1 live' ? r.fallback_caption : '',
  r.fallback_file,
  r.url,
]);
copy.getRange('A5:H65').format.wrapText = true;
copy.getRange('A5:H65').format.verticalAlignment = 'top';
copy.getRange('A5:H65').format.rowHeight = 235;
[13, 40, 85, 59, 63, 78, 40, 56].forEach((w, i) => {
  copy.getRangeByIndexes(3, i, 62, 1).format.columnWidth = w;
});
copy.tables.add('A4:H65', true, 'FluidCaptions');
copy.freezePanes.freezeRows(4);
copy.freezePanes.freezeColumns(2);

setup(
  review,
  'I',
  'Weekly organic review',
  'Enter measured results only. Blank is unmeasured; link clicks do not establish downloads.',
);
header(review, 'A4:I4', [
  'Week of',
  'Theme',
  'Reach',
  'Engagements',
  'Website link clicks',
  'Tracked site visits',
  'Confirmed downloads',
  'Engagement / reach',
  'What to try next',
]);
const themes = [...new Set(data.posts.map((r) => r.theme))];
review.getRange('A5:I13').values = themes.map((theme, i) => [
  new Date(Date.UTC(2026, 9, 26 + i * 7, 12)),
  theme,
  null,
  null,
  null,
  null,
  null,
  null,
  'Record the strongest post and one practical adjustment.',
]);
review.getRange('A5:A13').setNumberFormat('mmm d, yyyy');
review.getRange('C5:G13').setNumberFormat('#,##0');
review.getRange('C5:G13').format.fill = '#FFF3D7';
review.getRange('H5:H13').setNumberFormat('0.0%');
review.getRange('H5:H13').formulas = themes.map((_, i) => [
  `=IF(COUNT(C${i + 5}:D${i + 5})<2,"",IF(C${i + 5}=0,"n.a.",D${i + 5}/C${i + 5}))`,
]);
review.getRange('A5:I13').format.rowHeight = 54;
review.getRange('A5:I13').format.wrapText = true;
[18, 35, 15, 17, 20, 20, 22, 22, 55].forEach((w, i) => {
  review.getRangeByIndexes(3, i, 10, 1).format.columnWidth = w;
});
review.getRange('A16').values = [
  ['Inputs shown in amber. No reach, click or conversion target is invented.'],
];
review.getRange('A18').values = [
  [
    'Feature sources: README and CHANGELOG inspected Oct 25, 2026; fluideq.com and GitHub releases.',
  ],
];
review.getRange('A19').values = [
  ['https://fluideq.com/ | https://github.com/StartSWest/FluidEQ/releases'],
];
review.getRange('A21').values = [
  [
    'Publishing receipts live in schedule/publishing-ledger.json; the calendar itself does not prove scheduling.',
  ],
];

wb.recalculate();
const counts = await wb.inspect({
  kind: 'table',
  range: 'Schedule!A4:H4',
  include: 'values,formulas',
  maxChars: 1600,
  tableMaxRows: 1,
  tableMaxCols: 8,
});
console.log(counts.ndjson);
const errors = await wb.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#NULL!|#SPILL!|#CALC!',
  options: { useRegex: true, maxResults: 30 },
  maxChars: 2000,
  summary: 'Final formula error scan',
});
console.log(errors.ndjson);
// Exercise the live review calculation, including zero and unmeasured inputs.
review.getRange('C5:D5').values = [[100, 7]];
wb.recalculate();
if (Math.abs(review.getRange('H5').values[0][0] - 0.07) > 0.000001)
  throw new Error('Review rate failed');
review.getRange('C5:D5').values = [[0, 0]];
wb.recalculate();
if (review.getRange('H5').values[0][0] !== 'n.a.')
  throw new Error('Zero reach guard failed');
review.getRange('C5:D5').values = [[null, null]];
wb.recalculate();
if (review.getRange('H5').values[0][0] !== '')
  throw new Error('Unmeasured metric guard failed');
await fs.mkdir(path.join(build, 'previews'), { recursive: true });
for (const [sheetName, range] of [
  ['Schedule', 'A1:I12'],
  ['Captions', 'A4:E6'],
  ['Weekly review', 'A1:I13'],
]) {
  const preview = await wb.render({
    sheetName,
    range,
    scale: 1.3,
    format: 'png',
  });
  await fs.writeFile(
    path.join(build, 'previews', `${sheetName.replaceAll(' ', '-')}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}
const exported = await SpreadsheetFile.exportXlsx(wb);
await exported.save(path.join(base, 'FluidEQ-Two-Month-Schedule.xlsx'));
console.log(
  JSON.stringify({
    saved: 'FluidEQ-Two-Month-Schedule.xlsx',
    rows: data.posts.length,
    tabs: 3,
    tested: [
      'content count',
      'formula errors',
      '7/100 rate',
      'zero reach',
      'missing metrics',
      'three sheet renders',
    ],
  }),
);
