/**
 * Build assets/icon-update.ico: the tray mark with an "update waiting" dot.
 *
 * WHY AN ASSET AND NOT A RUNTIME COMPOSITE. A tray icon is asked for at 16px
 * at 100%, and 20 or 24 at the scalings most laptops actually run — Windows
 * picks per-DPI out of the .ico. Compositing one bitmap at runtime gives a
 * single size that Windows then resamples, and a 3px dot resampled out of a
 * 256px source is a smudge. Drawing the dot separately at every size is the
 * only way it stays a circle at 16px.
 *
 * WHY DIB FRAMES AND NOT PNG. An .ico may hold either, and Vista's shell
 * reads both — but System.Drawing.Icon reads only DIB, and a PNG-framed icon
 * comes back through it as colour noise rather than as an error. That is not
 * an academic point: it is what every .NET-based tool sees, and it is what
 * the first version of this file shipped before anyone looked at the output.
 * Only the 256 frame stays PNG, the way real icons do it, because 256 as an
 * uncompressed DIB is a quarter of a megabyte for a size no notification
 * area ever asks for.
 *
 * Re-run this whenever assets/icon.ico changes:
 *   pnpm make-tray-badge-icon
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/** Every size Windows asks a tray icon for, plus the shell's larger ones. */
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
/** At and above this, the frame is stored as PNG. See the note above. */
const PNG_FROM = 256;

/** The app accent. Bright enough to read on a dark or a light taskbar. */
const DOT_RGB = { r: 0x20, g: 0xdd, b: 0xcc };
/** $primary-dark, as a ring so the dot separates from whatever is under it. */
const RING_RGB = { r: 0x07, g: 0x05, b: 0x12 };

const repoRoot = path.resolve(__dirname, '../..');
const sourceIcon = path.join(repoRoot, 'assets', 'icon.ico');
const targetIcon = path.join(repoRoot, 'assets', 'icon-update.ico');

/** A single-quoted PowerShell literal escapes an apostrophe by doubling it. */
const psLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

/**
 * Draw each size, and hand back both a PNG and the raw BGRA pixels.
 *
 * Raw pixels as well as PNG because the DIB frames are assembled here in
 * Node, and decoding a PNG to recover them would mean writing an inflate and
 * a defilter for no reason when GDI+ can hand the buffer over directly.
 */
const buildPowershell = (outDir: string) =>
  [
    'Add-Type -AssemblyName System.Drawing',
    `$src = ${psLiteral(sourceIcon)}`,
    `$out = ${psLiteral(outDir)}`,
    `$sizes = @(${SIZES.join(',')})`,
    `$dot = [System.Drawing.Color]::FromArgb(255, ${DOT_RGB.r}, ${DOT_RGB.g}, ${DOT_RGB.b})`,
    `$ring = [System.Drawing.Color]::FromArgb(255, ${RING_RGB.r}, ${RING_RGB.g}, ${RING_RGB.b})`,
    'foreach ($size in $sizes) {',
    // Ask the .ico for the nearest real frame rather than scaling the 256.
    '  $icon = New-Object System.Drawing.Icon($src, $size, $size)',
    '  $source = $icon.ToBitmap()',
    '  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)',
    '  $g = [System.Drawing.Graphics]::FromImage($bitmap)',
    '  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias',
    '  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
    '  $g.DrawImage($source, 0, 0, $size, $size)',
    // Proportional, with a floor: below about five pixels a dot stops being a
    // dot and becomes a stray pixel that reads as a rendering fault.
    '  $d = [Math]::Max(5, [Math]::Round($size * 0.38))',
    '  $ringWidth = [Math]::Max(1, [Math]::Round($size * 0.06))',
    '  $inset = [Math]::Round($size * 0.03)',
    '  $x = $size - $d - $inset - $ringWidth',
    '  $y = $size - $d - $inset - $ringWidth',
    '  $ringBrush = New-Object System.Drawing.SolidBrush($ring)',
    '  $dotBrush = New-Object System.Drawing.SolidBrush($dot)',
    '  $g.FillEllipse($ringBrush, $x - $ringWidth, $y - $ringWidth, $d + 2*$ringWidth, $d + 2*$ringWidth)',
    '  $g.FillEllipse($dotBrush, $x, $y, $d, $d)',
    '  $g.Dispose()',
    '  $bitmap.Save((Join-Path $out ([string]$size + ".png")), [System.Drawing.Imaging.ImageFormat]::Png)',
    // Straight (non-premultiplied) BGRA, top-down, stride = width * 4.
    '  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)',
    '  $locked = $bitmap.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)',
    '  $raw = New-Object byte[] ($locked.Stride * $locked.Height)',
    '  [System.Runtime.InteropServices.Marshal]::Copy($locked.Scan0, $raw, 0, $raw.Length)',
    '  $bitmap.UnlockBits($locked)',
    '  [System.IO.File]::WriteAllBytes((Join-Path $out ([string]$size + ".bgra")), $raw)',
    '  $ringBrush.Dispose()',
    '  $dotBrush.Dispose()',
    '  $bitmap.Dispose()',
    '  $source.Dispose()',
    '  $icon.Dispose()',
    '}',
  ].join('\n');

/**
 * One BMP/DIB icon frame.
 *
 * The header lies about the height on purpose — the format wants the XOR and
 * AND masks stacked, so biHeight is twice the real one. The AND mask is left
 * all zero: with 32 bits per pixel the alpha channel is what Windows honours,
 * and a stale 1-bit mask beside it is how icons end up with black corners.
 */
const dibFrame = (size: number, bgraTopDown: Buffer) => {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight: XOR plus AND
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(0, 16); // biCompression = BI_RGB

  // DIB rows run bottom-up; GDI+ handed them over top-down.
  const stride = size * 4;
  const xor = Buffer.alloc(stride * size);
  for (let row = 0; row < size; row += 1) {
    bgraTopDown.copy(
      xor,
      row * stride,
      (size - 1 - row) * stride,
      (size - row) * stride,
    );
  }

  // 1bpp, each row padded to a four-byte boundary.
  const maskStride = Math.ceil(size / 32) * 4;
  const and = Buffer.alloc(maskStride * size);

  return Buffer.concat([header, xor, and]);
};

/** Header (6 bytes), one 16-byte directory entry per frame, then payloads. */
const packIco = (frames: { size: number; payload: Buffer }[]) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(frames.length, 4);

  const directory = Buffer.alloc(16 * frames.length);
  let offset = header.length + directory.length;
  frames.forEach((frame, index) => {
    const entry = index * 16;
    // A width or height byte of 0 means 256.
    const dimension = frame.size >= 256 ? 0 : frame.size;
    directory.writeUInt8(dimension, entry);
    directory.writeUInt8(dimension, entry + 1);
    directory.writeUInt8(0, entry + 2); // palette size, 0 for truecolour
    directory.writeUInt8(0, entry + 3); // reserved
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(frame.payload.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += frame.payload.length;
  });

  return Buffer.concat([
    header,
    directory,
    ...frames.map((frame) => frame.payload),
  ]);
};

const main = () => {
  if (process.platform !== 'win32') {
    throw new Error(
      'This generator needs Windows: it draws with System.Drawing.',
    );
  }
  if (!fs.existsSync(sourceIcon)) {
    throw new Error(`Source icon is missing: ${sourceIcon}`);
  }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-badge-'));
  try {
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', buildPowershell(outDir)],
      { stdio: 'pipe', encoding: 'utf8' },
    );

    const frames = SIZES.map((size) => {
      if (size >= PNG_FROM) {
        const png = fs.readFileSync(path.join(outDir, `${size}.png`));
        if (png.length < 8 || png.readUInt32BE(0) !== 0x89504e47) {
          throw new Error(`Frame ${size} is not a PNG`);
        }
        return { size, payload: png };
      }
      const bgra = fs.readFileSync(path.join(outDir, `${size}.bgra`));
      if (bgra.length !== size * size * 4) {
        throw new Error(
          `Frame ${size} has ${bgra.length} bytes, expected ${size * size * 4}`,
        );
      }
      return { size, payload: dibFrame(size, bgra) };
    });

    fs.writeFileSync(targetIcon, packIco(frames));
    const kb = Math.round(fs.statSync(targetIcon).size / 1024);
    process.stdout.write(
      `Wrote ${path.relative(repoRoot, targetIcon)} — ${frames.length} sizes, ${kb}KB\n`,
    );
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
};

main();
