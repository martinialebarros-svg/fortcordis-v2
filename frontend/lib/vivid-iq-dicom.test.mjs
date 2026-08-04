import assert from "node:assert/strict";
import test from "node:test";

import {
  VividIqDicomError,
  findVividIqFrameAtTimestamp,
  getVividIqFramePixels,
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

function sequence(group, tag, ...items) {
  return element(group, tag, "SQ", concat(...items.map((value) => item(value))));
}

function asArrayBuffer(value) {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

function buildSyntheticVividIqDicom({
  includePrivateMovie = true,
  includeUltrasoundRegion = true,
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
  const safeDataset = concat(
    textElement(0x0008, 0x0060, "CS", "US"),
    textElement(0x0008, 0x0070, "LO", "GE Vingmed Ultrasound"),
    textElement(0x0008, 0x1090, "LO", "Vivid iq"),
    textElement(0x0010, 0x0010, "PN", "PACIENTE^NAO_EXIBIR"),
    ultrasoundRegion,
    uint16Element(0x0028, 0x0010, 708),
    uint16Element(0x0028, 0x0011, 1016),
  );

  if (!includePrivateMovie) {
    return asArrayBuffer(concat(preamble, magic, meta, safeDataset));
  }

  const timestamps = Buffer.alloc(16);
  timestamps.writeDoubleLE(1, 0);
  timestamps.writeDoubleLE(1.1, 8);
  const pixels = rawPixels || Buffer.from([
    0, 64, 128, 255,
    255, 128, 64, 0,
  ]);

  const imageDescription = sequence(
    0x7fe1,
    0x1026,
    concat(
      textElement(0x7fe1, 0x0010, "LO", "GEMS_Ultrasound_MovieGroup_001"),
      int32x4Element(0x7fe1, 0x1086, [2, 2, 0, 2]),
    ),
  );
  const voxelGroups = sequence(
    0x7fe1,
    0x1036,
    concat(
      textElement(0x7fe1, 0x0010, "LO", "GEMS_Ultrasound_MovieGroup_001"),
      uint32Element(0x7fe1, 0x1037, 2),
      element(0x7fe1, 0x1043, "OB", timestamps),
      element(0x7fe1, 0x1060, "OB", pixels),
    ),
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
