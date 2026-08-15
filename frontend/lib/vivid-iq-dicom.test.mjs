import assert from "node:assert/strict";
import test from "node:test";

import {
  VividIqDicomError,
  createVividIqDisplayMap,
  detectVividIqPreviewAspectRatio,
  findVividIqFrameAtTimestamp,
  getVividIqFramePixels,
  getVividIqPreviewJpeg,
  parseVividIqDicom,
} from "./vivid-iq-dicom.mjs";

const LONG_VRS = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "UC", "UR", "UT", "UN"]);

function concat(...parts) {
  return Buffer.concat(parts.map((part) => Buffer.from(part)));
}

function evenText(value, padding = 0x20) {
  const raw = Buffer.from(value, "ascii");
  return raw.length % 2 ? concat(raw, Buffer.from([padding])) : raw;
}

function element(group, tag, vr, value) {
  const payload = Buffer.from(value);
  const header = Buffer.alloc(LONG_VRS.has(vr) ? 12 : 8);
  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(tag, 2);
  header.write(vr, 4, 2, "ascii");
  if (LONG_VRS.has(vr)) {
    header.writeUInt32LE(payload.length, 8);
  } else {
    header.writeUInt16LE(payload.length, 6);
  }
  return concat(header, payload);
}

function textElement(group, tag, vr, value) {
  return element(group, tag, vr, evenText(value, vr === "UI" ? 0 : 0x20));
}

function uint16Element(group, tag, value) {
  const payload = Buffer.alloc(2);
  payload.writeUInt16LE(value);
  return element(group, tag, "US", payload);
}

function uint32Element(group, tag, value) {
  const payload = Buffer.alloc(4);
  payload.writeUInt32LE(value);
  return element(group, tag, "UL", payload);
}

function int32x4Element(group, tag, values) {
  const payload = Buffer.alloc(16);
  values.forEach((value, index) => payload.writeInt32LE(value, index * 4));
  return element(group, tag, "SL", payload);
}

function item(value) {
  const payload = Buffer.from(value);
  const header = Buffer.alloc(8);
  header.writeUInt16LE(0xfffe, 0);
  header.writeUInt16LE(0xe000, 2);
  header.writeUInt32LE(payload.length, 4);
  return concat(header, payload);
}

function undefinedLengthElement(group, tag, vr, fragments) {
  const header = Buffer.alloc(12);
  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(tag, 2);
  header.write(vr, 4, 2, "ascii");
  header.writeUInt32LE(0xffffffff, 8);
  const delimiter = Buffer.alloc(8);
  delimiter.writeUInt16LE(0xfffe, 0);
  delimiter.writeUInt16LE(0xe0dd, 2);
  return concat(header, ...fragments.map((fragment) => item(fragment)), delimiter);
}

function timestampsBuffer(values) {
  const timestamps = Buffer.alloc(values.length * 8);
  values.forEach((value, index) => timestamps.writeDoubleLE(value, index * 8));
  return timestamps;
}

function sequence(group, tag, ...items) {
  return element(group, tag, "SQ", concat(...items.map((value) => item(value))));
}

function asArrayBuffer(value) {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

function buildSyntheticVividIqDicom({
  includePrivateMovie = true,
  includeUltrasoundRegion = true,
  includeCurvedSurface = false,
  includePreview = false,
  imageSizes = [[2, 2]],
  voxelGroupSpecs,
  rawPixels,
} = {}) {
  const preamble = Buffer.alloc(128);
  const magic = Buffer.from("DICM", "ascii");
  const meta = concat(
    textElement(0x0002, 0x0010, "UI", "1.2.840.10008.1.2.4.50"),
  );
  const ultrasoundRegion = includeUltrasoundRegion
    ? sequence(
        0x0018,
        0x6011,
        concat(
          uint16Element(0x0018, 0x6012, 1),
          uint32Element(0x0018, 0x6018, 10),
          uint32Element(0x0018, 0x601a, 20),
          uint32Element(0x0018, 0x601c, 209),
          uint32Element(0x0018, 0x601e, 119),
        ),
      )
    : Buffer.alloc(0);
  const preview = includePreview
    ? undefinedLengthElement(0x7fe0, 0x0010, "OB", [
        Buffer.alloc(4),
        Buffer.from([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]),
      ])
    : Buffer.alloc(0);
  const safeDataset = concat(
    textElement(0x0008, 0x0060, "CS", "US"),
    textElement(0x0008, 0x0070, "LO", "GE Vingmed Ultrasound"),
    textElement(0x0008, 0x1090, "LO", "Vivid iq"),
    textElement(0x0010, 0x0010, "PN", "PACIENTE^NAO_EXIBIR"),
    ultrasoundRegion,
    uint16Element(0x0028, 0x0010, 708),
    uint16Element(0x0028, 0x0011, 1016),
    preview,
  );

  if (!includePrivateMovie) {
    return asArrayBuffer(concat(preamble, magic, meta, safeDataset));
  }

  const defaultPixels = rawPixels || Buffer.from([
    0, 64, 128, 255,
    255, 128, 64, 0,
  ]);
  const groups = voxelGroupSpecs || [{
    timestamps: [1, 1.1],
    pixels: defaultPixels,
  }];

  const imageDescription = sequence(
    0x7fe1,
    0x1026,
    concat(
      textElement(0x7fe1, 0x0010, "LO", "GEMS_Ultrasound_MovieGroup_001"),
      includeCurvedSurface
        ? textElement(0x7fe1, 0x1057, "LT", "CurvedSurface")
        : Buffer.alloc(0),
      ...imageSizes.map(([width, height]) => (
        int32x4Element(0x7fe1, 0x1086, [width, height, 0, 2])
      )),
    ),
  );
  const voxelGroups = sequence(
    0x7fe1,
    0x1036,
    ...groups.map((group) => concat(
      textElement(0x7fe1, 0x0010, "LO", "GEMS_Ultrasound_MovieGroup_001"),
      uint32Element(0x7fe1, 0x1037, group.timestamps.length),
      element(0x7fe1, 0x1043, "OB", timestampsBuffer(group.timestamps)),
      element(0x7fe1, 0x1060, "OB", group.pixels),
    )),
  );
  const levelTwo = sequence(
    0x7fe1,
    0x1020,
    concat(
      textElement(0x7fe1, 0x0010, "LO", "GEMS_Ultrasound_MovieGroup_001"),
      imageDescription,
      voxelGroups,
    ),
  );
  const levelOne = sequence(
    0x7fe1,
    0x1010,
    concat(
      textElement(0x7fe1, 0x0010, "LO", "GEMS_Ultrasound_MovieGroup_001"),
      levelTwo,
    ),
  );
  const movie = concat(
    textElement(0x7fe1, 0x0010, "LO", "GEMS_Ultrasound_MovieGroup_001"),
    sequence(
      0x7fe1,
      0x1001,
      concat(
        textElement(0x7fe1, 0x0010, "LO", "GEMS_Ultrasound_MovieGroup_001"),
        textElement(0x7fe1, 0x1002, "LO", "2D+Trace"),
        levelOne,
      ),
    ),
  );

  return asArrayBuffer(concat(preamble, magic, meta, safeDataset, movie));
}

test("extrai cine GE sintetico sem expor metadados do paciente", () => {
  const study = parseVividIqDicom(buildSyntheticVividIqDicom(), "SEMEXTENSAO");

  assert.equal(study.fileName, "SEMEXTENSAO");
  assert.equal(study.model, "Vivid iq");
  assert.equal(study.cineType, "2D+Trace");
  assert.equal(study.width, 2);
  assert.equal(study.height, 2);
  assert.equal(study.displayWidth, 200);
  assert.equal(study.displayHeight, 100);
  assert.equal(study.displayAspectRatio, 2);
  assert.equal(study.displayAspectRatioSource, "ultrasound-region");
  assert.equal(study.frameCount, 2);
  assert.ok(Math.abs(study.durationSeconds - 0.1) < 0.0001);
  assert.ok(Math.abs(study.frameRate - 10) < 0.0001);
  assert.deepEqual([...getVividIqFramePixels(study, 0)], [0, 64, 128, 255]);
  assert.deepEqual([...getVividIqFramePixels(study, 1)], [255, 128, 64, 0]);
  assert.equal(findVividIqFrameAtTimestamp(study, 1.05), 0);
  assert.equal(findVividIqFrameAtTimestamp(study, 1.1), 1);
  assert.equal(JSON.stringify(study).includes("PACIENTE"), false);
});

test("usa proporcao nativa quando a regiao 2D do equipamento nao existe", () => {
  const study = parseVividIqDicom(
    buildSyntheticVividIqDicom({ includeUltrasoundRegion: false }),
  );

  assert.equal(study.displayWidth, 2);
  assert.equal(study.displayHeight, 2);
  assert.equal(study.displayAspectRatio, 1);
  assert.equal(study.displayAspectRatioSource, "native-pixels");
});

test("preserva dimensoes por bloco quando o equipamento muda a geometria no mesmo cine", () => {
  const study = parseVividIqDicom(buildSyntheticVividIqDicom({
    includeUltrasoundRegion: false,
    imageSizes: [[2, 2], [3, 2]],
    voxelGroupSpecs: [
      {
        timestamps: [1, 1.1],
        pixels: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
      },
      {
        timestamps: [1.2],
        pixels: Buffer.from([9, 10, 11, 12, 13, 14]),
      },
    ],
  }));

  assert.equal(study.frameCount, 3);
  assert.deepEqual(study.frameDimensions, [
    { width: 2, height: 2, frameCount: 2 },
    { width: 3, height: 2, frameCount: 1 },
  ]);
  assert.deepEqual(
    study.frames.map(({ width, height, frameSize }) => ({ width, height, frameSize })),
    [
      { width: 2, height: 2, frameSize: 4 },
      { width: 2, height: 2, frameSize: 4 },
      { width: 3, height: 2, frameSize: 6 },
    ],
  );
  assert.deepEqual([...getVividIqFramePixels(study, 2)], [9, 10, 11, 12, 13, 14]);
  assert.ok(Math.abs(study.frameRate - 10) < 0.0001);
});

test("extrai a previa JPEG local sem interpretar seus metadados visuais", () => {
  const study = parseVividIqDicom(buildSyntheticVividIqDicom({ includePreview: true }));
  assert.deepEqual(
    [...getVividIqPreviewJpeg(study)],
    [0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9],
  );
});

test("orienta a varredura curva como setor com profundidade vertical", () => {
  const study = parseVividIqDicom(buildSyntheticVividIqDicom({
    includeCurvedSurface: true,
    includeUltrasoundRegion: false,
  }));
  const mapping = createVividIqDisplayMap(5, 3, 5, 5, true, true);

  assert.equal(study.scanConversion, true);
  assert.equal(study.displayAspectRatioSource, "estimated-sector");
  assert.equal(mapping.length, 25);
  assert.ok(mapping.some((sourceIndex) => sourceIndex >= 0));
  assert.equal(mapping[2], 5);
  assert.equal(mapping[4], -1);
});

test("estima a proporcao da maior regiao neutra da previa", () => {
  const width = 120;
  const height = 100;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 20; y < 90; y += 1) {
    const halfWidth = Math.round((y - 20) * 0.6);
    for (let x = 60 - halfWidth; x <= 60 + halfWidth; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 90;
      pixels[offset + 1] = 90;
      pixels[offset + 2] = 90;
      pixels[offset + 3] = 255;
    }
  }

  const aspectRatio = detectVividIqPreviewAspectRatio(pixels, width, height, 4);
  assert.ok(aspectRatio > 1 && aspectRatio < 1.4);
});

test("rejeita arquivo sem assinatura DICM", () => {
  assert.throws(
    () => parseVividIqDicom(new ArrayBuffer(256)),
    (error) => error instanceof VividIqDicomError && error.code === "INVALID_DICOM",
  );
});

test("rejeita DICOM sem MovieGroup privado", () => {
  assert.throws(
    () => parseVividIqDicom(buildSyntheticVividIqDicom({ includePrivateMovie: false })),
    (error) => error instanceof VividIqDicomError && error.code === "UNSUPPORTED_GE_MOVIE",
  );
});

test("rejeita MovieGroup sem um quadro completo", () => {
  assert.throws(
    () => parseVividIqDicom(buildSyntheticVividIqDicom({ rawPixels: Buffer.from([1, 2, 3]) })),
    (error) => error instanceof VividIqDicomError && error.code === "INVALID_MOVIE",
  );
});
