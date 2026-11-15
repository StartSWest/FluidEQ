/* eslint-disable no-bitwise -- ID3 sizes, FLAC's STREAMINFO and Ogg's CRC are bit-packed by their formats */
/**
 * Audio files built byte by byte with lyrics in each standard place, for the
 * lyrics reader's tests (`main/libraryLyrics.test.ts`). Every one is the real
 * layout its format writes — the tags and boxes a tagger produces, around
 * enough of a stream for the file to be recognised — never a stub of the
 * parser's own output. The words are written for these tests.
 */

const ascii = (text: string) => Buffer.from(text, 'latin1');

const u32be = (value: number) => {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value);
  return out;
};

const u32le = (value: number) => {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value);
  return out;
};

const u16le = (value: number) => {
  const out = Buffer.alloc(2);
  out.writeUInt16LE(value);
  return out;
};

/** UTF-16 with its byte-order mark, as ID3v2.3 writes anything not Latin-1. */
const utf16Bom = (text: string) =>
  Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);

/** MPEG-1 Layer III frames, 128 kb/s at 44.1 kHz, silent: what follows a tag. */
export const mpegFrames = (count = 8): Buffer => {
  const frame = Buffer.alloc(417);
  frame.writeUInt32BE(0xfffb9064);
  return Buffer.concat(Array.from({ length: count }, () => frame));
};

// --- ID3v2 ------------------------------------------------------------------

export interface ISyltEntryFixture {
  text: string;
  timeMs: number;
}

export type TId3Frame =
  | { id: 'USLT'; text: string }
  | {
      id: 'SYLT';
      entries: ISyltEntryFixture[];
      timeStampFormat?: number;
      contentType?: number;
    }
  | { id: 'TXXX'; description: string; text: string };

const syncsafe = (value: number) =>
  Buffer.from([
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f,
  ]);

/**
 * One frame's body. Version 4 writes UTF-8 (encoding 3); version 3 has no
 * UTF-8, so it writes UTF-16 with a BOM (encoding 1), as taggers do.
 */
const frameBody = (frame: TId3Frame, version: 3 | 4): Buffer => {
  const encoding = version === 4 ? 3 : 1;
  const text = (value: string) =>
    version === 4 ? Buffer.from(value, 'utf8') : utf16Bom(value);
  const end = version === 4 ? Buffer.from([0]) : Buffer.from([0, 0]);
  switch (frame.id) {
    case 'USLT':
      return Buffer.concat([
        Buffer.from([encoding]),
        ascii('eng'),
        text(''),
        end,
        text(frame.text),
      ]);
    case 'SYLT':
      return Buffer.concat([
        Buffer.from([encoding]),
        ascii('eng'),
        Buffer.from([frame.timeStampFormat ?? 2, frame.contentType ?? 1]),
        text(''),
        end,
        ...frame.entries.flatMap((entry) => [
          text(entry.text),
          end,
          u32be(entry.timeMs),
        ]),
      ]);
    case 'TXXX':
      return Buffer.concat([
        Buffer.from([encoding]),
        text(frame.description),
        end,
        text(frame.text),
      ]);
    default:
      throw new Error('unknown frame');
  }
};

/** An ID3v2.3 or v2.4 tag holding these frames. */
export const id3Tag = (frames: TId3Frame[], version: 3 | 4 = 4): Buffer => {
  const body = Buffer.concat(
    frames.map((frame) => {
      const data = frameBody(frame, version);
      return Buffer.concat([
        ascii(frame.id),
        version === 4 ? syncsafe(data.length) : u32be(data.length),
        Buffer.from([0, 0]),
        data,
      ]);
    }),
  );
  return Buffer.concat([
    ascii('ID3'),
    Buffer.from([version, 0, 0]),
    syncsafe(body.length),
    body,
  ]);
};

/** An MP3: an ID3v2 tag, then the stream. */
export const mp3WithId3 = (frames: TId3Frame[], version: 3 | 4 = 4) =>
  Buffer.concat([id3Tag(frames, version), mpegFrames()]);

// --- FLAC and Ogg (Vorbis comments) -----------------------------------------

const vorbisComments = (comments: Record<string, string>) => {
  const vendor = Buffer.from('FluidEQ test', 'utf8');
  const entries = Object.entries(comments).map(([key, value]) =>
    Buffer.from(`${key}=${value}`, 'utf8'),
  );
  return Buffer.concat([
    u32le(vendor.length),
    vendor,
    u32le(entries.length),
    ...entries.flatMap((entry) => [u32le(entry.length), entry]),
  ]);
};

/** STREAMINFO for 44.1 kHz stereo 16-bit, length unknown. */
const flacStreamInfo = () => {
  const info = Buffer.alloc(34);
  info.writeUInt16BE(4096, 0);
  info.writeUInt16BE(4096, 2);
  // Sample rate (20 bits), channels - 1 (3), bits - 1 (5), samples (36).
  const packed = (44100n << 44n) | (1n << 41n) | (15n << 36n);
  info.writeBigUInt64BE(packed, 10);
  return info;
};

const flacBlock = (type: number, isLast: boolean, data: Buffer) => {
  const header = Buffer.alloc(4);
  header.writeUInt8((isLast ? 0x80 : 0) | type, 0);
  header.writeUIntBE(data.length, 1, 3);
  return Buffer.concat([header, data]);
};

/** A FLAC file whose Vorbis comment block carries these fields. */
export const flacWithComments = (comments: Record<string, string>) =>
  Buffer.concat([
    ascii('fLaC'),
    flacBlock(0, false, flacStreamInfo()),
    flacBlock(4, true, vorbisComments(comments)),
  ]);

const OGG_CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index << 24;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 0x80000000 ? (crc << 1) ^ 0x04c11db7 : crc << 1;
  }
  return crc >>> 0;
});

const oggCrc = (page: Buffer) =>
  page.reduce(
    (crc, byte) =>
      ((crc << 8) ^ OGG_CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]) >>> 0,
    0,
  );

const oggPage = (
  packet: Buffer,
  sequence: number,
  headerType: number,
  granule: bigint,
) => {
  const lacing: number[] = [];
  let left = packet.length;
  while (left >= 255) {
    lacing.push(255);
    left -= 255;
  }
  lacing.push(left);
  const header = Buffer.alloc(27);
  ascii('OggS').copy(header, 0);
  header.writeUInt8(0, 4);
  header.writeUInt8(headerType, 5);
  header.writeBigUInt64LE(granule, 6);
  header.writeUInt32LE(0x46455131, 14);
  header.writeUInt32LE(sequence, 18);
  header.writeUInt8(lacing.length, 26);
  const page = Buffer.concat([header, Buffer.from(lacing), packet]);
  page.writeUInt32LE(oggCrc(page), 22);
  return page;
};

/** An Ogg Opus file: its OpusHead, its OpusTags, and one empty audio page. */
export const opusWithComments = (comments: Record<string, string>) => {
  const head = Buffer.alloc(19);
  ascii('OpusHead').copy(head, 0);
  head.writeUInt8(1, 8);
  head.writeUInt8(2, 9);
  head.writeUInt16LE(312, 10);
  head.writeUInt32LE(48000, 12);
  const tags = Buffer.concat([ascii('OpusTags'), vorbisComments(comments)]);
  // One Opus packet of silence (a 20 ms CELT frame's TOC byte, code 0).
  const audio = Buffer.from([0xf8, 0xff, 0xfe]);
  return Buffer.concat([
    oggPage(head, 0, 0x02, 0n),
    oggPage(tags, 1, 0x00, 0n),
    oggPage(audio, 2, 0x04, 960n),
  ]);
};

// --- MP4 ----------------------------------------------------------------------

const box = (type: Buffer | string, ...children: Buffer[]) => {
  const body = Buffer.concat(children);
  const name = typeof type === 'string' ? ascii(type) : type;
  return Buffer.concat([u32be(8 + body.length), name, body]);
};

/** An M4A whose iTunes list carries `©lyr`. */
export const m4aWithLyrics = (text: string) => {
  const data = box(
    'data',
    u32be(1), // UTF-8 text
    u32be(0),
    Buffer.from(text, 'utf8'),
  );
  const hdlr = box(
    'hdlr',
    u32be(0),
    u32be(0),
    ascii('mdir'),
    ascii('appl'),
    Buffer.alloc(8),
    Buffer.from([0]),
  );
  const ilst = box('ilst', box(Buffer.from([0xa9, 0x6c, 0x79, 0x72]), data));
  const meta = box('meta', u32be(0), hdlr, ilst);
  const mvhd = box(
    'mvhd',
    u32be(0),
    u32be(0),
    u32be(0),
    u32be(44100),
    u32be(0),
    u32be(0x00010000),
    Buffer.from([0x01, 0x00]),
    Buffer.alloc(10),
    Buffer.alloc(36),
    Buffer.alloc(24),
    u32be(2),
  );
  return Buffer.concat([
    box('ftyp', ascii('M4A '), u32be(0), ascii('M4A '), ascii('mp42')),
    box('moov', mvhd, box('udta', meta)),
  ]);
};

// --- APEv2 --------------------------------------------------------------------

/** An MP3 ending in an APEv2 tag (footer only) with these items. */
export const mp3WithApe = (items: Record<string, string>) => {
  const fields = Object.entries(items).map(([key, value]) => {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([
      u32le(bytes.length),
      u32le(0),
      ascii(key),
      Buffer.from([0]),
      bytes,
    ]);
  });
  const body = Buffer.concat(fields);
  const footer = Buffer.concat([
    ascii('APETAGEX'),
    u32le(2000),
    u32le(body.length + 32),
    u32le(fields.length),
    u32le(0),
    Buffer.alloc(8),
  ]);
  return Buffer.concat([mpegFrames(), body, footer]);
};

// --- ASF ----------------------------------------------------------------------

/** A GUID as ASF stores it: the first three fields little-endian. */
const guid = (text: string) => {
  const hex = text.replace(/-/g, '');
  const bytes = Buffer.from(hex, 'hex');
  return Buffer.concat([
    Buffer.from(bytes.subarray(0, 4)).reverse(),
    Buffer.from(bytes.subarray(4, 6)).reverse(),
    Buffer.from(bytes.subarray(6, 8)).reverse(),
    bytes.subarray(8),
  ]);
};

const HEADER_GUID = '75B22630-668E-11CF-A6D9-00AA0062CE6C';
const EXTENDED_CONTENT_GUID = 'D2D0A440-E307-11D2-97F0-00A0C95EA850';
const DATA_GUID = '75B22636-668E-11CF-A6D9-00AA0062CE6C';

const asfObject = (id: string, body: Buffer) => {
  const size = Buffer.alloc(8);
  size.writeBigUInt64LE(BigInt(24 + body.length));
  return Buffer.concat([guid(id), size, body]);
};

const utf16z = (text: string) => Buffer.from(`${text}\0`, 'utf16le');

/** A WMA whose Extended Content Description carries `WM/Lyrics`. */
export const wmaWithLyrics = (text: string) => {
  const name = utf16z('WM/Lyrics');
  const value = utf16z(text);
  const descriptor = Buffer.concat([
    u16le(name.length),
    name,
    u16le(0), // a Unicode string
    u16le(value.length),
    value,
  ]);
  const extended = asfObject(
    EXTENDED_CONTENT_GUID,
    Buffer.concat([u16le(1), descriptor]),
  );
  const header = asfObject(
    HEADER_GUID,
    Buffer.concat([u32le(1), Buffer.from([1, 2]), extended]),
  );
  const data = asfObject(DATA_GUID, Buffer.alloc(26));
  return Buffer.concat([header, data]);
};
