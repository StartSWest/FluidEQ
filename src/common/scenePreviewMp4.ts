interface IBox {
  type: string;
  start: number;
  body: number;
  end: number;
}
const invalid = (): never => {
  throw new Error('Invalid MP4 scene preview');
};

export const readScenePreviewMp4 = (bytes: Uint8Array) => {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (at: number) => {
    if (at < 0 || at + 4 > bytes.length) {
      return invalid();
    }
    return data.getUint32(at);
  };
  const u16 = (at: number) => {
    if (at < 0 || at + 2 > bytes.length) {
      return invalid();
    }
    return data.getUint16(at);
  };
  const u64 = (at: number) => {
    const value = u32(at) * 4294967296 + u32(at + 4);
    if (!Number.isSafeInteger(value)) {
      return invalid();
    }
    return value;
  };
  const word = (at: number) =>
    String.fromCharCode(...bytes.subarray(at, at + 4));
  const boxes = (from: number, to: number): IBox[] => {
    const result: IBox[] = [];
    for (let at = from; at < to;) {
      if (at + 8 > to || result.length > 10000) {
        return invalid();
      }
      let size = u32(at);
      let header = 8;
      if (size === 1) {
        size = u64(at + 8);
        header = 16;
      }
      if (size === 0) {
        size = to - at;
      }
      if (size < header || at + size > to) {
        return invalid();
      }
      result.push({
        type: word(at + 4),
        start: at,
        body: at + header,
        end: at + size,
      });
      at += size;
    }
    return result;
  };
  const one = (entries: IBox[], type: string) => {
    const matches = entries.filter((box) => box.type === type);
    if (matches.length !== 1) {
      return invalid();
    }
    return matches[0];
  };
  const descendants = (box: IBox) => boxes(box.body, box.end);
  const top = boxes(0, bytes.length);
  one(top, 'ftyp');
  const moov = descendants(one(top, 'moov'));
  const trak = descendants(one(moov, 'trak'));
  const tkhd = one(trak, 'tkhd');
  const width = u32(tkhd.end - 8) / 65536;
  const height = u32(tkhd.end - 4) / 65536;
  // The box a clip must fit is readScenePreviewMedia's, for both formats.
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 2 ||
    height < 2
  ) {
    return invalid();
  }
  const media = descendants(one(trak, 'mdia'));
  const handler = one(media, 'hdlr');
  if (word(handler.body + 8) !== 'vide') {
    return invalid();
  }
  const mdhd = one(media, 'mdhd');
  const timescale = u32(mdhd.body + (bytes[mdhd.body] === 1 ? 20 : 12));
  if (!timescale || timescale > 1000000000) {
    return invalid();
  }
  const table = descendants(one(descendants(one(media, 'minf')), 'stbl'));
  const stsd = one(table, 'stsd');
  if (u32(stsd.body + 4) !== 1) {
    return invalid();
  }
  const entry = one(boxes(stsd.body + 8, stsd.end), 'avc1');
  if (u16(entry.body + 24) !== width || u16(entry.body + 26) !== height) {
    return invalid();
  }
  const avc = one(boxes(entry.body + 78, entry.end), 'avcC');
  if (
    avc.end - avc.body < 7 ||
    bytes[avc.body] !== 1 ||
    bytes[avc.body + 4] % 4 !== 3
  ) {
    return invalid();
  }

  // The recorder asks for baseline H.264. Read its coded dimensions too:
  // trusting only tkhd/stsd would permit a tiny header over huge decoder work.
  const checkSps = (from: number, to: number) => {
    if (to - from < 5 || bytes[from] % 32 !== 7) {
      return invalid();
    }
    const rbsp: number[] = [];
    for (let at = from + 1; at < to; at += 1) {
      if (!(bytes[at] === 3 && bytes[at - 1] === 0 && bytes[at - 2] === 0)) {
        rbsp.push(bytes[at]);
      }
    }
    let bit = 0;
    const read = (count: number) => {
      if (bit + count > rbsp.length * 8) {
        return invalid();
      }
      let result = 0;
      for (let i = 0; i < count; i += 1) {
        result =
          result * 2 +
          (Math.floor(rbsp[Math.floor(bit / 8)] / 2 ** (7 - (bit % 8))) % 2);
        bit += 1;
      }
      return result;
    };
    const ue = () => {
      let zeroes = 0;
      while (read(1) === 0) {
        zeroes += 1;
        if (zeroes > 24) {
          return invalid();
        }
      }
      return 2 ** zeroes - 1 + read(zeroes);
    };
    if (read(8) !== 66) {
      return invalid();
    }
    read(8);
    if (read(8) > 42) {
      return invalid();
    }
    ue();
    if (ue() > 12) {
      return invalid();
    }
    const order = ue();
    if (order === 0) {
      if (ue() > 12) {
        return invalid();
      }
    } else if (order === 1) {
      read(1);
      ue();
      ue();
      const cycle = ue();
      if (cycle > 255) {
        return invalid();
      }
      for (let i = 0; i < cycle; i += 1) {
        ue();
      }
    } else if (order !== 2) {
      return invalid();
    }
    if (ue() > 16) {
      return invalid();
    }
    read(1);
    const columns = ue() + 1;
    const rows = ue() + 1;
    if (read(1) !== 1) {
      return invalid();
    }
    read(1);
    let cropX = 0;
    let cropY = 0;
    if (read(1)) {
      cropX = ue() + ue();
      cropY = ue() + ue();
    }
    if (
      columns * 16 - cropX * 2 !== width ||
      rows * 16 - cropY * 2 !== height
    ) {
      return invalid();
    }
    return undefined;
  };
  const spsCount = bytes[avc.body + 5] % 32;
  if (spsCount < 1 || spsCount > 4) {
    return invalid();
  }
  let spsAt = avc.body + 6;
  for (let i = 0; i < spsCount; i += 1) {
    const length = u16(spsAt);
    if (length === 0 || spsAt + 2 + length > avc.end) {
      return invalid();
    }
    checkSps(spsAt + 2, spsAt + 2 + length);
    spsAt += 2 + length;
  }
  const payloads = top.filter((box) => box.type === 'mdat');
  if (payloads.length === 0) {
    return invalid();
  }
  let frames = 0;
  let first = Infinity;
  let endTime = 0;
  const sample = (
    at: number,
    size: number,
    decode: number,
    duration: number,
    composition = 0,
  ) => {
    frames += 1;
    if (
      frames > 400 ||
      !Number.isSafeInteger(size) ||
      size < 5 ||
      duration <= 0 ||
      !payloads.some((box) => at >= box.body && at + size <= box.end)
    ) {
      return invalid();
    }
    const pts = ((decode + composition) * 1000) / timescale;
    if (!Number.isFinite(pts) || pts < 0 || pts > 10500) {
      return invalid();
    }
    first = Math.min(first, pts);
    endTime = Math.max(endTime, pts + (duration * 1000) / timescale);
    let idr = false;
    let nals = 0;
    for (let offset = at; offset < at + size;) {
      const length = u32(offset);
      offset += 4;
      nals += 1;
      if (!length || offset + length > at + size || nals > 100) {
        return invalid();
      }
      const kind = bytes[offset] % 32;
      if (kind === 5) {
        idr = true;
      }
      if (kind === 7) {
        checkSps(offset, offset + length);
      }
      offset += length;
    }
    if (frames === 1 && !idr) {
      return invalid();
    }
    return undefined;
  };
  const fragments = top.filter((box) => box.type === 'moof');
  if (fragments.length) {
    const trex = one(descendants(one(moov, 'mvex')), 'trex');
    const trackId = u32(trex.body + 4);
    for (
      let fragmentIndex = 0;
      fragmentIndex < fragments.length;
      fragmentIndex += 1
    ) {
      const fragment = fragments[fragmentIndex];
      const traf = descendants(one(descendants(fragment), 'traf'));
      const tfhd = one(traf, 'tfhd');
      const flags = u32(tfhd.body) % 16777216;
      if (u32(tfhd.body + 4) !== trackId) {
        return invalid();
      }
      let at = tfhd.body + 8;
      let base = fragment.start;
      if (flags % 2) {
        base = u64(at);
        at += 8;
      }
      if (Math.floor(flags / 2) % 2) {
        at += 4;
      }
      let defaultDuration = u32(trex.body + 12);
      let defaultSize = u32(trex.body + 16);
      if (Math.floor(flags / 8) % 2) {
        defaultDuration = u32(at);
        at += 4;
      }
      if (Math.floor(flags / 16) % 2) {
        defaultSize = u32(at);
        at += 4;
      }
      if (Math.floor(flags / 32) % 2) {
        at += 4;
      }
      if (at > tfhd.end) {
        return invalid();
      }
      const tfdt = one(traf, 'tfdt');
      let decode =
        bytes[tfdt.body] === 1 ? u64(tfdt.body + 4) : u32(tfdt.body + 4);
      let offset = payloads.find((box) => box.start >= fragment.end)?.body;
      const runs = traf.filter((box) => box.type === 'trun');
      for (let runIndex = 0; runIndex < runs.length; runIndex += 1) {
        const run = runs[runIndex];
        const bits = u32(run.body) % 16777216;
        const count = u32(run.body + 4);
        if (count === 0 || count > 400) {
          return invalid();
        }
        let cursor = run.body + 8;
        if (bits % 2) {
          offset = base + data.getInt32(cursor);
          cursor += 4;
        }
        if (Math.floor(bits / 4) % 2) {
          cursor += 4;
        }
        for (let i = 0; i < count; i += 1) {
          let duration = defaultDuration;
          let size = defaultSize;
          let composition = 0;
          if (Math.floor(bits / 256) % 2) {
            duration = u32(cursor);
            cursor += 4;
          }
          if (Math.floor(bits / 512) % 2) {
            size = u32(cursor);
            cursor += 4;
          }
          if (Math.floor(bits / 1024) % 2) {
            cursor += 4;
          }
          if (Math.floor(bits / 2048) % 2) {
            composition =
              bytes[run.body] === 1 ? data.getInt32(cursor) : u32(cursor);
            cursor += 4;
          }
          if (cursor > run.end || offset === undefined) {
            return invalid();
          }
          sample(offset, size, decode, duration, composition);
          offset += size;
          decode += duration;
        }
        if (cursor !== run.end) {
          return invalid();
        }
      }
    }
  } else {
    const sizes = one(table, 'stsz');
    const fixed = u32(sizes.body + 4);
    const count = u32(sizes.body + 8);
    if (
      count < 20 ||
      count > 400 ||
      (!fixed && sizes.body + 12 + count * 4 !== sizes.end)
    ) {
      return invalid();
    }
    const durations: number[] = [];
    const stts = one(table, 'stts');
    const timeEntries = u32(stts.body + 4);
    if (stts.body + 8 + timeEntries * 8 !== stts.end || timeEntries > 400) {
      return invalid();
    }
    for (let i = 0; i < timeEntries; i += 1) {
      const repeats = u32(stts.body + 8 + i * 8);
      const duration = u32(stts.body + 12 + i * 8);
      if (!repeats || durations.length + repeats > count) {
        return invalid();
      }
      for (let j = 0; j < repeats; j += 1) {
        durations.push(duration);
      }
    }
    if (
      durations.length !== count ||
      table.some((box) => box.type === 'ctts')
    ) {
      return invalid();
    }
    const stsc = one(table, 'stsc');
    const mappings = u32(stsc.body + 4);
    const chunkBox = table.find(
      (box) => box.type === 'stco' || box.type === 'co64',
    );
    if (
      !chunkBox ||
      mappings < 1 ||
      mappings > count ||
      stsc.body + 8 + mappings * 12 !== stsc.end
    ) {
      return invalid();
    }
    const chunks = u32(chunkBox.body + 4);
    if (chunks < 1 || chunks > count) {
      return invalid();
    }
    let index = 0;
    let mapping = 0;
    let decode = 0;
    for (let chunk = 1; chunk <= chunks; chunk += 1) {
      while (
        mapping + 1 < mappings &&
        u32(stsc.body + 8 + (mapping + 1) * 12) <= chunk
      ) {
        mapping += 1;
      }
      if (
        u32(stsc.body + 8) !== 1 ||
        u32(stsc.body + 16 + mapping * 12) !== 1
      ) {
        return invalid();
      }
      const samples = u32(stsc.body + 12 + mapping * 12);
      let offset =
        chunkBox.type === 'co64'
          ? u64(chunkBox.body + 8 + (chunk - 1) * 8)
          : u32(chunkBox.body + 8 + (chunk - 1) * 4);
      if (!samples || index + samples > count) {
        return invalid();
      }
      for (let i = 0; i < samples; i += 1) {
        const size = fixed || u32(sizes.body + 12 + index * 4);
        sample(offset, size, decode, durations[index]);
        offset += size;
        decode += durations[index];
        index += 1;
      }
    }
    if (index !== count) {
      return invalid();
    }
  }
  const durationMs = endTime - first;
  if (
    frames < 20 ||
    !Number.isFinite(durationMs) ||
    durationMs < 9750 ||
    durationMs > 10500
  ) {
    return invalid();
  }
  return { mimeType: 'video/mp4' as const, durationMs, width, height, frames };
};
