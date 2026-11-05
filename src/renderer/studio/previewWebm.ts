/** MediaRecorder writes a streaming WebM with no duration. Give the finished
 * file a real duration so native players can seek and validate it. This only
 * accepts the recorder's unindexed layout: moving indexed offsets would break
 * seek tables, so arbitrary imported WebM is deliberately refused. */
interface IElement {
  id: number;
  start: number;
  body: number;
  end: number;
  unknown: boolean;
}

const elementAt = (
  bytes: Uint8Array,
  start: number,
  limit: number,
): IElement => {
  const widthOf = (byte: number, maximum: number) => {
    for (let width = 1; width <= maximum; width += 1) {
      if (byte >= 2 ** (8 - width)) {
        return width;
      }
    }
    throw new Error('Invalid WebM element');
  };
  const idWidth = widthOf(bytes[start], 4);
  let id = 0;
  for (let i = start; i < start + idWidth; i += 1) {
    id = id * 256 + bytes[i];
  }
  const sizeStart = start + idWidth;
  const sizeWidth = widthOf(bytes[sizeStart], 8);
  let size = bytes[sizeStart] - 2 ** (8 - sizeWidth);
  let unknown = size === 2 ** (8 - sizeWidth) - 1;
  for (let i = sizeStart + 1; i < sizeStart + sizeWidth; i += 1) {
    size = size * 256 + bytes[i];
    unknown = unknown && bytes[i] === 255;
  }
  const body = sizeStart + sizeWidth;
  const end = unknown ? limit : body + size;
  if (
    body > limit ||
    end > limit ||
    end <= start ||
    !Number.isSafeInteger(end)
  ) {
    throw new Error('Truncated WebM element');
  }
  return { id, start, body, end, unknown };
};

const children = (
  bytes: Uint8Array,
  start: number,
  end: number,
): IElement[] => {
  const result: IElement[] = [];
  for (let offset = start; offset < end;) {
    const child = elementAt(bytes, offset, end);
    result.push(child);
    offset = child.end;
  }
  return result;
};

const sized = (id: number[], body: Uint8Array): Uint8Array => {
  let width = 1;
  while (body.length >= 2 ** (7 * width) - 1) {
    width += 1;
  }
  const result = new Uint8Array(id.length + width + body.length);
  result.set(id);
  let size = body.length;
  for (let index = width - 1; index >= 0; index -= 1) {
    result[id.length + index] = size % 256;
    size = Math.floor(size / 256);
  }
  result[id.length] += 2 ** (8 - width);
  result.set(body, id.length + width);
  return result;
};

const joined = (parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const result = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
};

const finishPreviewWebm = async (
  blob: Blob,
  durationMs: number,
): Promise<Blob> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const segment = children(bytes, 0, bytes.length).find(
    (item) => item.id === 0x18538067,
  );
  if (!segment) {
    throw new Error('Missing WebM segment');
  }
  const entries = children(bytes, segment.body, segment.end);
  const info = entries.find((item) => item.id === 0x1549a966);
  if (!info) {
    throw new Error('Missing WebM info');
  }
  const fields = children(bytes, info.body, info.end);
  const scale = fields.find((item) => item.id === 0x2ad7b1);
  let nanoseconds = scale ? 0 : 1000000;
  if (scale) {
    for (let i = scale.body; i < scale.end; i += 1) {
      nanoseconds = nanoseconds * 256 + bytes[i];
    }
  }
  if (!nanoseconds) {
    throw new Error('Invalid WebM time scale');
  }
  const existing = fields.find((item) => item.id === 0x4489);
  if (existing) {
    const data = new DataView(
      bytes.buffer,
      existing.body,
      existing.end - existing.body,
    );
    let value = NaN;
    if (data.byteLength === 8) {
      value = data.getFloat64(0);
    }
    if (data.byteLength === 4) {
      value = data.getFloat32(0);
    }
    if (
      !Number.isFinite(value) ||
      Math.abs((value * nanoseconds) / 1000000 - durationMs) > 500
    ) {
      throw new Error('WebM duration does not match its capture');
    }
    // Recent Chromium finalizes indexed WebM itself. Keep its offsets and
    // measured duration unchanged; only older streaming output needs repair.
    return blob;
  }
  if (
    entries.some((item) => item.id === 0x114d9b74 || item.id === 0x1c53bb6b)
  ) {
    throw new Error('Indexed WebM has no duration');
  }
  const duration = new Uint8Array(8);
  new DataView(duration.buffer).setFloat64(
    0,
    (durationMs * 1000000) / nanoseconds,
  );
  const newInfo = sized(
    [0x15, 0x49, 0xa9, 0x66],
    joined([
      ...fields
        .filter((item) => item.id !== 0x4489)
        .map((item) => bytes.slice(item.start, item.end)),
      sized([0x44, 0x89], duration),
    ]),
  );
  const body = joined(
    entries.map((item) =>
      item === info ? newInfo : bytes.slice(item.start, item.end),
    ),
  );
  return new Blob(
    [
      joined([
        bytes.slice(0, segment.start),
        sized([0x18, 0x53, 0x80, 0x67], body),
        bytes.slice(segment.end),
      ]),
    ],
    { type: blob.type },
  );
};

export default finishPreviewWebm;
