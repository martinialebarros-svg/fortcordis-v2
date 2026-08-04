export interface VividIqFrame {
  offset: number;
  timestampSeconds: number;
}

export interface VividIqStudy {
  fileName: string;
  fileSize: number;
  transferSyntax: string;
  modality: string;
  manufacturer: string;
  model: string;
  equipment: string;
  cineType: string;
  previewWidth: number | null;
  previewHeight: number | null;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  displayAspectRatio: number;
  displayAspectRatioSource: "ultrasound-region" | "native-pixels";
  frameSize: number;
  frameCount: number;
  frameRate: number;
  durationSeconds: number;
  firstTimestamp: number;
  frames: VividIqFrame[];
  warnings: string[];
  sourceBuffer: ArrayBuffer;
}

export class VividIqDicomError extends Error {
  code: string;
  constructor(code: string, message: string);
}

export function parseVividIqDicom(buffer: ArrayBuffer, fileName?: string): VividIqStudy;
export function getVividIqFramePixels(study: VividIqStudy, frameIndex: number): Uint8Array;
export function findVividIqFrameAtTimestamp(
  study: VividIqStudy,
  timestampSeconds: number,
): number;

export const VIVID_IQ_MAX_FILE_BYTES: number;
