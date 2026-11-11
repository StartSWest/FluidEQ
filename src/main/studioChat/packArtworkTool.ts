/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { pictureFromBytes } from '../safePicture';
import { adoptPackedSheets } from './sheetAsPicture';
import type { IStudioChatPackPiece } from '../../common/studioChat';
import {
  listsOwnPieces,
  readArtworkRegions,
  type IArtworkRegion,
} from '../memberScenes/artworkRegions';
import {
  isPlainFileName,
  readManifest,
  writeInside,
} from '../memberScenes/projectFiles';
import {
  readPictureAtlas,
  readPictureImage,
} from '../memberScenes/projectPictures';
import {
  readArtworkSources,
  writeArtworkSources,
} from '../memberScenes/artworkSources';
import type { IMcpTool, IMcpToolResult } from '../studioAgent/mcpProtocol';
import { ART_DIR, failure, readArt, text } from './artFolder';
import { layoutArtwork, type ILayoutPiece, type IRect } from './artworkLayout';
import type { IPictureToolsDeps } from './pictureTools';

const REGION_ID = /^[a-z][a-z0-9_-]{0,31}$/;
const MAX_PIECES = 64;
const DEFAULT_ARTWORK_FILE = 'artwork.webp';
/** A piece's longest side in the artwork, as ARTWORK's own edge. */
const MAX_PIECE_EDGE = 4096;

const PACK_SCHEMA = {
  type: 'object',
  properties: {
    pieces: {
      type: 'array',
      maxItems: MAX_PIECES,
      description:
        "Every piece of the scene's own art, as the artwork should hold it from now on: a piece left out is gone from it. The member's photo places are kept whatever this says.",
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description:
              'The region id the shader knows it by: lowercase letters, digits, - and _, starting with a letter.',
          },
          from: {
            type: 'string',
            description:
              'Where it comes from: "art/<name>.png" for a picture make_picture made, or "artwork:<id>" for a piece already in the artwork, kept.',
          },
          kind: {
            type: 'string',
            enum: ['tile', 'subject'],
            description:
              'tile: a material that repeats; its gutter is filled with its own wrapped pixels. subject: a cut-out; its gutter stays clear.',
          },
          width: {
            type: 'integer',
            description:
              'Its size in the artwork; about the pixels it covers on a 1080p panel close up, and no larger. Defaults to its own size.',
          },
          height: { type: 'integer' },
        },
        required: ['id', 'from', 'kind'],
        additionalProperties: false,
      },
    },
  },
  required: ['pieces'],
  additionalProperties: false,
};

/** The region as the shader reads it: origin bottom-left, fractions of the image. */
const regionLine = (
  piece: { id: string } & IRect,
  width: number,
  height: number,
) => {
  const four = (value: number) => Number(value.toFixed(5));
  return `${piece.id}: x ${piece.x}, y ${piece.y}, ${piece.width} x ${piece.height} -> vec4(${four(piece.x / width)}, ${four(1 - (piece.y + piece.height) / height)}, ${four(piece.width / width)}, ${four(piece.height / height)})`;
};

interface IReadPiece {
  piece: ILayoutPiece;
  source: Pick<IStudioChatPackPiece, 'image' | 'fromArtwork'>;
  /** The picture it came from, `art/<name>.png`, or the region it keeps. */
  origin: { picture: string } | { kept: string };
}

const isSize = (value: unknown) =>
  value === undefined ||
  (typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_PIECE_EDGE);

/** One piece Claude listed, with where its pixels come from; or why not. */
const readPiece = (
  entry: unknown,
  folder: string,
  known: readonly IArtworkRegion[],
  hasArtwork: boolean,
): IReadPiece | string => {
  if (typeof entry !== 'object' || entry === null) {
    return 'Each piece needs an id, a from and a kind.';
  }
  const { id, from, kind, width, height } = entry as Record<string, unknown>;
  if (
    typeof id !== 'string' ||
    !REGION_ID.test(id) ||
    typeof from !== 'string' ||
    (kind !== 'tile' && kind !== 'subject')
  ) {
    return `Piece ${String(id)}: ids are a-z, 0-9, - and _, starting with a letter; from is a string; kind is tile or subject.`;
  }
  if (!isSize(width) || !isSize(height)) {
    return `Piece ${id}: its width and height are whole pixels, 1 to ${MAX_PIECE_EDGE}.`;
  }
  if (from.startsWith(`${ART_DIR}/`)) {
    const name = from.slice(ART_DIR.length + 1).replace(/.png$/, '');
    const png = readArt(folder, name);
    const image = png && pictureFromBytes(png);
    if (!png || !image || image.isEmpty()) {
      return `Piece ${id}: there is no picture ${from}.`;
    }
    const own = image.getSize();
    const size = {
      width: typeof width === 'number' ? width : own.width,
      height: typeof height === 'number' ? height : own.height,
    };
    if (size.width > MAX_PIECE_EDGE || size.height > MAX_PIECE_EDGE) {
      return `Piece ${id}: give it a width and height of at most ${MAX_PIECE_EDGE}.`;
    }
    const same = size.width === own.width && size.height === own.height;
    return {
      piece: { id, kind, ...size },
      source: {
        image: new Uint8Array(
          same ? png : image.resize({ ...size, quality: 'best' }).toPNG(),
        ),
      },
      origin: { picture: `${ART_DIR}/${name}.png` },
    };
  }
  if (from.startsWith('artwork:')) {
    const region = known.find((piece) => piece.id === from.slice(8));
    if (!region || !hasArtwork) {
      return `Piece ${id}: the artwork has no piece ${from.slice(8)}.`;
    }
    if (
      (width !== undefined && width !== region.width) ||
      (height !== undefined && height !== region.height)
    ) {
      return `Piece ${id}: a piece kept from the artwork keeps its size; make it again to change it.`;
    }
    const { x, y, width: w, height: h } = region;
    return {
      piece: { id, kind, width: w, height: h },
      source: { fromArtwork: { x, y, width: w, height: h } },
      origin: { kept: region.id },
    };
  }
  return `Piece ${id}: from is "art/<name>.png" or "artwork:<id>".`;
};

/** pack_artwork: the scene's own pictures into its one artwork image. */
/** A picture's pixels, alpha last, for telling a sheet of frames from a picture. */
const pixelsOfPng = (png: Uint8Array) => {
  const image = pictureFromBytes(png);
  if (image.isEmpty()) {
    return undefined;
  }
  const { width, height } = image.getSize();
  const bitmap = image.toBitmap();
  return {
    width,
    height,
    data: new Uint8ClampedArray(
      bitmap.buffer,
      bitmap.byteOffset,
      bitmap.byteLength,
    ),
  };
};

const createPackArtworkTool = ({
  project,
  packInWindow,
  logger,
}: IPictureToolsDeps): IMcpTool => {
  const packArtworkTool = async (
    args: Record<string, unknown>,
  ): Promise<IMcpToolResult> => {
    const open = project();
    if (!open.ok) {
      return failure(
        "This chat's project is not in FluidEQ's Studio list any more, or may not be used now: ask the member to open it in the Studio again.",
      );
    }
    const raw = args.pieces;
    if (!Array.isArray(raw) || raw.length > MAX_PIECES) {
      return failure(
        `pack_artwork needs a list of at most ${MAX_PIECES} pieces.`,
      );
    }
    let manifest: Record<string, unknown>;
    try {
      manifest = await readManifest(open.folder);
    } catch {
      return failure('pack.json cannot be read; fix it first.');
    }
    const atlas = await readPictureAtlas(open.folder);
    const current =
      atlas.kind === 'atlas'
        ? await readPictureImage(open.folder, atlas.atlas)
        : undefined;
    const known =
      atlas.kind === 'atlas'
        ? readArtworkRegions(
            manifest.artworkRegions,
            atlas.atlas.width,
            atlas.atlas.height,
          )
        : [];
    // The member's photo places, where they are: every one `pictures` names,
    // filled or not, and an older artwork that is one photo and nothing else
    // as one place, kept whole — written into `pictures` below, or the
    // pieces beside it would take its place away. An artwork that lists
    // pieces of its own is never that photo, whether or not each entry can
    // be read: taken for one, it filled every pixel the artwork may have,
    // and nothing beside it fitted (`readArtworkRegions`).
    const implicitPlace =
      manifest.pictures === undefined &&
      !listsOwnPieces(manifest.artworkRegions) &&
      current;
    const places =
      atlas.kind === 'atlas' &&
      (manifest.pictures !== undefined || implicitPlace)
        ? atlas.atlas.pictures
        : [];

    const read = raw.map((entry) =>
      readPiece(entry, open.folder, known, current !== undefined),
    );
    const problem = read.find(
      (entry): entry is string => typeof entry === 'string',
    );
    if (problem) {
      return failure(problem);
    }
    const pieces = read.filter(
      (entry): entry is IReadPiece => typeof entry !== 'string',
    );
    const ids = [
      ...places.map((place) => place.id),
      ...pieces.map(({ piece }) => piece.id),
    ];
    if (new Set(ids).size !== ids.length) {
      return failure(
        "Each piece's id is used once, and never a photo place's id.",
      );
    }
    const layoutPieces = pieces.map(({ piece }) => piece);
    const sources = new Map(
      pieces.map(({ piece, source }) => [piece.id, source]),
    );

    const layout = layoutArtwork(layoutPieces, places);
    if (!layout.ok) {
      return failure(
        'Those pieces do not fit in one artwork within its limits (4096 a side, 8 megapixels). Make them smaller, or fewer.',
      );
    }
    const answer = await packInWindow({
      width: layout.width,
      height: layout.height,
      ...(current ? { current } : {}),
      keep: places.map(({ x, y, width, height }) => ({ x, y, width, height })),
      pieces: layout.placed.map((piece) => ({
        x: piece.x,
        y: piece.y,
        width: piece.width,
        height: piece.height,
        wrap: piece.wrap,
        gutter: piece.gutter,
        ...sources.get(piece.id),
      })),
    });
    if (answer === 'no-window' || !answer.ok) {
      return failure(
        answer !== 'no-window' && answer.reason === 'too-big'
          ? 'The artwork came out over its 6 MB limit even at low quality. Make the pieces smaller.'
          : "FluidEQ's window could not put the artwork together just now; try again.",
      );
    }
    const file =
      typeof manifest.artworkFile === 'string' &&
      isPlainFileName(manifest.artworkFile, 'artwork')
        ? manifest.artworkFile
        : DEFAULT_ARTWORK_FILE;
    const next: Record<string, unknown> = {
      ...manifest,
      artworkFile: file,
      artworkWidth: layout.width,
      artworkHeight: layout.height,
      artworkRegions: layout.placed.map(({ id, x, y, width, height }) => ({
        id,
        x,
        y,
        width,
        height,
      })),
      ...(implicitPlace && places.length > 0
        ? {
            pictures: places.map(({ id, x, y, width, height }) => ({
              id,
              names: { en: 'Your picture' },
              x,
              y,
              width,
              height,
            })),
          }
        : {}),
    };
    try {
      await writeInside(open.folder, file, 'artwork', answer.webp);
      await writeInside(
        open.folder,
        'pack.json',
        'pack.json',
        `${JSON.stringify(next, null, 2)}\n`,
      );
    } catch (error) {
      logger?.warn(
        `The Studio's artwork could not be written: ${String(error)}`,
      );
      return failure('The artwork could not be written into the project.');
    }
    // Where each piece came from, for the Animations tab: a picture of
    // art/, or what the record said of the region a kept piece keeps.
    const before = readArtworkSources(open.folder);
    const record = Object.fromEntries(
      pieces.flatMap(({ piece, origin }): Array<[string, string]> => {
        const picture =
          'picture' in origin ? origin.picture : before[origin.kept];
        return picture ? [[piece.id, picture]] : [];
      }),
    );
    try {
      writeArtworkSources(open.folder, record);
    } catch (error) {
      // The artwork is written; only the tab's knowing what it uses is not.
      logger?.warn(
        `Where the Studio's artwork pieces came from could not be recorded: ${String(error)}`,
      );
    }
    // A sheet of frames packed as a plain picture is made the animation it
    // is, and the chat told so before anything else (`sheetAsPicture.ts`).
    let adopted: string[] = [];
    try {
      adopted = await adoptPackedSheets(
        open.folder,
        pieces.flatMap(({ origin }) =>
          'picture' in origin ? [origin.picture] : [],
        ),
        pixelsOfPng,
      );
    } catch (error) {
      // The artwork is packed; only the correction did not happen.
      logger?.warn(
        `A packed picture could not be checked for animation frames: ${String(error)}`,
      );
    }
    return {
      content: [
        text(
          [
            ...adopted,
            `Packed ${layout.placed.length} piece${layout.placed.length === 1 ? '' : 's'} into ${file}, ${layout.width} x ${layout.height}, and wrote artworkFile, artworkWidth, artworkHeight and artworkRegions in pack.json${places.length ? "; the member's photo places are where they were" : ''}. Leave the version as it is: FluidEQ sets it when the member publishes.`,
            'Each region, and the vec4 the shader samples it by (x, y from the bottom-left, width, height, as fractions of the image):',
            ...layout.placed.map((piece) =>
              regionLine(piece, layout.width, layout.height),
            ),
            'It arrives premultiplied and in sRGB: the linear colour is pow(t.rgb / max(t.a, 0.001), vec3(2.2)); cut a subject out by discarding below alpha 0.5.',
          ].join('\n'),
        ),
      ],
    };
  };

  return {
    name: 'pack_artwork',
    title: "Pack the scene's artwork",
    description:
      "Lays the scene's own pictures into its one artwork image - pictures from make_picture, and pieces already in the artwork - with the gutters the brief asks for, encodes it as the WebP the build reads, and writes pack.json's artworkFile, artworkWidth, artworkHeight and artworkRegions to match. A sheet of animation frames is never packed as a plain picture: build it with build_sheet first, so it is an animation the member has; a grid of poses found packed without one is made an animation here and you are told to set it right. The member's photo places are kept where they are. Answers each region's place and the vec4 the shader samples it by.",
    inputSchema: PACK_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    call: packArtworkTool,
  };
};

export default createPackArtworkTool;
