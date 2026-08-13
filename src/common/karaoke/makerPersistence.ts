/* FluidEQ Karaoke Maker persistence contracts. GPL-3.0-or-later. */

export interface IKaraokeMakerExportRequest {
  fileName: string;
  contents: string;
  formatName: string;
  extensions: string[];
}

export interface IKaraokeMakerExportResult {
  canceled: boolean;
  filePath?: string;
}
