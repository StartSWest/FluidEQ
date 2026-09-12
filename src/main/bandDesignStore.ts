import fs from 'fs';
import path from 'path';
import { uid } from 'uid';
import {
  IBandDesign,
  MAX_BAND_DESIGNS,
  cloneBandDesign,
  isBandDesign,
} from '../common/bandDesigns';

const filename = 'band-designs.json';

export const readBandDesigns = (userDataDir: string): IBandDesign[] => {
  let content: string;
  try {
    content = fs.readFileSync(path.join(userDataDir, filename), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  const data: unknown = JSON.parse(content);
  if (
    !data ||
    typeof data !== 'object' ||
    !('version' in data) ||
    (data.version !== 1 && data.version !== 2) ||
    !('designs' in data) ||
    !Array.isArray(data.designs) ||
    data.designs.length > MAX_BAND_DESIGNS ||
    !data.designs.every(isBandDesign) ||
    new Set(data.designs.map((design) => design.id)).size !==
      data.designs.length
  ) {
    throw new Error('Invalid saved band designs');
  }
  return data.designs.map(cloneBandDesign);
};

const writeCatalog = (userDataDir: string, designs: IBandDesign[]) => {
  const destination = path.join(userDataDir, filename);
  const temporary = `${destination}.${uid()}.tmp`;
  try {
    fs.writeFileSync(
      temporary,
      `${JSON.stringify({ version: 2, designs: designs.map(cloneBandDesign) }, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    fs.renameSync(temporary, destination);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
};

export const writeBandDesign = (userDataDir: string, design: IBandDesign) => {
  if (!isBandDesign(design)) {
    throw new Error('Invalid band design');
  }
  const designs = readBandDesigns(userDataDir);
  const index = designs.findIndex((entry) => entry.id === design.id);
  if (index < 0 && designs.length >= MAX_BAND_DESIGNS) {
    throw new Error('Band design limit reached');
  }
  if (
    designs.some(
      (entry) =>
        entry.id !== design.id &&
        entry.name.toLocaleLowerCase() ===
          design.name.trim().toLocaleLowerCase(),
    )
  ) {
    throw new Error('Band design name already exists');
  }
  if (index < 0) {
    designs.push(cloneBandDesign(design));
  } else {
    designs[index] = cloneBandDesign(design);
  }
  writeCatalog(userDataDir, designs);
};

export const deleteBandDesign = (userDataDir: string, id: string) => {
  const designs = readBandDesigns(userDataDir);
  const remaining = designs.filter((design) => design.id !== id);
  if (remaining.length === designs.length) {
    return false;
  }
  writeCatalog(userDataDir, remaining);
  return true;
};
