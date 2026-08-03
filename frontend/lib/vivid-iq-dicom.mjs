const DICOM_MAGIC_OFFSET = 128;
const DICOM_DATASET_OFFSET = 132;
const UNDEFINED_LENGTH = 0xffffffff;
const ITEM_GROUP = 0xfffe;
const ITEM_TAG = 0xe000;
const ITEM_DELIMITATION_TAG = 0xe00d;
const SEQUENCE_DELIMITATION_TAG = 0xe0dd;
const PRIVATE_GROUP = 0x7fe1;
const PRIVATE_CREATOR = "GEMS_Ultrasound_MovieGroup_001";
const MAX_FILE_BYTES = 512 * 1024 * 1024;
const MAX_ELEMENTS = 100_000;
const MAX_DEPTH = 48;

const LONG_VALUE_REPRESENTATIONS = new Set([
  "OB",
  "OD",
  "OF",
  "OL",
  "OV",
  "OW",
  "SQ",
  "UC",
  "UR",
  "UT",
  "UN",
]);

export class VividIqDicomError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "VividIqDicomError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new VividIqDicomError(code, message);
}

function assertBounds(offset, length, end, message) {
  if (
    !Number.isSafeInteger(offset)
    || !Number.isSafeInteger(length)
    || offset < 0
    || length < 0
    || offset + length > end
  ) {
    fail("INVALID_DICOM", message);
  }
}

function readAscii(view, offset, length) {
  assertBounds(offset, length, view.byteLength, "Texto DICOM ultrapassa o tamanho do arquivo.");
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value.replace(/[\0 ]+$/g, "");
}

function tagMatches(header, group, element) {
  return header.group === group && header.element === element;
}

function readElementHeader(view, offset, end) {
  assertBounds(offset, 8, end, "Cabecalho de elemento DICOM incompleto.");
  const group = view.getUint16(offset, true);
  const element = view.getUint16(offset + 2, true);

  if (group === ITEM_GROUP) {
    return {
      group,
      element,
      valueRepresentation: null,
      valueLength: view.getUint32(offset + 4, true),
      valueOffset: offset + 8,
      headerOffset: offset,
    };
  }

  const valueRepresentation = String.fromCharCode(
    view.getUint8(offset + 4),
    view.getUint8(offset + 5),
  );
  if (!/^[A-Z]{2}$/.test(valueRepresentation)) {
    fail(
      "INVALID_DICOM",
      "O conjunto de dados nao usa Explicit VR Little Endian ou esta corrompido.",
    );
  }

  let valueLength;
  let valueOffset;
  if (LONG_VALUE_REPRESENTATIONS.has(valueRepresentation)) {
    assertBounds(offset, 12, end, "Cabecalho DICOM longo incompleto.");
    valueLength = view.getUint32(offset + 8, true);
    valueOffset = offset + 12;
  } else {
    valueLength = view.getUint16(offset + 6, true);
    valueOffset = offset + 8;
  }

  if (valueLength !== UNDEFINED_LENGTH) {
    assertBounds(valueOffset, valueLength, end, "Valor DICOM ultrapassa o tamanho do arquivo.");
  }

  return {
    group,
    element,
    valueRepresentation,
    valueLength,
    valueOffset,
    headerOffset: offset,
  };
}

function collectElement(state, context, header) {
  const { view } = state;

  if (tagMatches(header, 0x0008, 0x0060)) {
    state.modality = readAscii(view, header.valueOffset, header.valueLength);
    return;
  }
  if (tagMatches(header, 0x0008, 0x0070)) {
    state.manufacturer = readAscii(view, header.valueOffset, header.valueLength);
    return;
  }
  if (tagMatches(header, 0x0008, 0x1090)) {
    state.model = readAscii(view, header.valueOffset, header.valueLength);
    return;
  }
  if (tagMatches(header, 0x0028, 0x0010) && header.valueLength >= 2) {
    state.previewHeight = view.getUint16(header.valueOffset, true);
    return;
  }
  if (tagMatches(header, 0x0028, 0x0011) && header.valueLength >= 2) {
    state.previewWidth = view.getUint16(header.valueOffset, true);
    return;
  }

  if (tagMatches(header, PRIVATE_GROUP, 0x0010)) {
    const creator = readAscii(view, header.valueOffset, header.valueLength);
    if (creator === PRIVATE_CREATOR) {
      state.privateCreatorFound = true;
    }
    return;
  }
  if (tagMatches(header, PRIVATE_GROUP, 0x1002)) {
    const cineType = readAscii(view, header.valueOffset, header.valueLength);
    if (!state.cineType || cineType.includes("2D")) {
      state.cineType = cineType;
    }
    return;
  }
  if (tagMatches(header, PRIVATE_GROUP, 0x1086) && header.valueLength >= 16) {
    state.imageSizeCandidates.push({
      width: view.getInt32(header.valueOffset, true),
      height: view.getInt32(header.valueOffset + 4, true),
      component: view.getInt32(header.valueOffset + 8, true),
      kind: view.getInt32(header.valueOffset + 12, true),
    });
    return;
  }

  if (!context.voxelGroup) {
    return;
  }

  if (tagMatches(header, PRIVATE_GROUP, 0x1037) && header.valueLength >= 4) {
    context.voxelGroup.declaredFrames = view.getUint32(header.valueOffset, true);
    return;
  }
  if (tagMatches(header, PRIVATE_GROUP, 0x1043)) {
    context.voxelGroup.timestampsOffset = header.valueOffset;
    context.voxelGroup.timestampsLength = header.valueLength;
    return;
  }
  if (tagMatches(header, PRIVATE_GROUP, 0x1060)) {
    context.voxelGroup.voxelsOffset = header.valueOffset;
    context.voxelGroup.voxelsLength = header.valueLength;
  }
}

function skipUndefinedBinary(state, valueOffset, end) {
  const { view } = state;
  let position = valueOffset;
  while (position + 8 <= end) {
    const item = readElementHeader(view, position, end);
    if (item.group !== ITEM_GROUP) {
      fail("INVALID_DICOM", "Item encapsulado DICOM invalido.");
    }
    if (item.element === SEQUENCE_DELIMITATION_TAG) {
      return item.valueOffset;
    }
    if (item.element !== ITEM_TAG || item.valueLength === UNDEFINED_LENGTH) {
      fail("INVALID_DICOM", "Fragmento encapsulado DICOM invalido.");
    }
    position = item.valueOffset + item.valueLength;
  }
  fail("INVALID_DICOM", "Sequencia encapsulada sem delimitador.");
}

function parseSequence(state, header, context, depth, end) {
  if (depth > MAX_DEPTH) {
    fail("RESOURCE_LIMIT", "O DICOM excede o limite seguro de sequencias aninhadas.");
  }

  const { view } = state;
  const sequenceEnd = header.valueLength === UNDEFINED_LENGTH
    ? end
    : header.valueOffset + header.valueLength;
  const isVoxelGroupSequence = tagMatches(header, PRIVATE_GROUP, 0x1036);
  let position = header.valueOffset;

  while (position + 8 <= sequenceEnd) {
    const item = readElementHeader(view, position, sequenceEnd);
    if (item.group !== ITEM_GROUP) {
      fail("INVALID_DICOM", "Sequencia DICOM contem um item invalido.");
    }
    if (item.element === SEQUENCE_DELIMITATION_TAG) {
      return item.valueOffset;
    }
    if (item.element !== ITEM_TAG) {
      fail("INVALID_DICOM", "Delimitador inesperado dentro de sequencia DICOM.");
    }

    const itemEnd = item.valueLength === UNDEFINED_LENGTH
      ? sequenceEnd
      : item.valueOffset + item.valueLength;
    const voxelGroup = isVoxelGroupSequence
      ? {
          declaredFrames: null,
          timestampsOffset: null,
          timestampsLength: 0,
          voxelsOffset: null,
          voxelsLength: 0,
        }
      : context.voxelGroup;

    if (isVoxelGroupSequence) {
      state.voxelGroups.push(voxelGroup);
    }

    const parsed = parseDataset(
      state,
      item.valueOffset,
      itemEnd,
      { voxelGroup },
      depth + 1,
    );

    if (item.valueLength === UNDEFINED_LENGTH) {
      if (parsed.delimiter !== ITEM_DELIMITATION_TAG) {
        fail("INVALID_DICOM", "Item DICOM indefinido sem delimitador.");
      }
      position = parsed.position + 8;
    } else {
      position = itemEnd;
    }
  }

  if (header.valueLength === UNDEFINED_LENGTH) {
    fail("INVALID_DICOM", "Sequencia DICOM indefinida sem delimitador.");
  }
  return sequenceEnd;
}

function parseDataset(state, start, end, context = { voxelGroup: null }, depth = 0) {
  if (depth > MAX_DEPTH) {
    fail("RESOURCE_LIMIT", "O DICOM excede o limite seguro de profundidade.");
  }

  let position = start;
  while (position + 8 <= end) {
    const header = readElementHeader(state.view, position, end);
    if (header.group === ITEM_GROUP) {
      return { position, delimiter: header.element };
    }

    state.elementCount += 1;
    if (state.elementCount > MAX_ELEMENTS) {
      fail("RESOURCE_LIMIT", "O DICOM excede o limite seguro de elementos.");
    }

    collectElement(state, context, header);

    if (header.valueRepresentation === "SQ") {
      position = parseSequence(state, header, context, depth + 1, end);
    } else if (header.valueLength === UNDEFINED_LENGTH) {
      position = skipUndefinedBinary(state, header.valueOffset, end);
    } else {
      position = header.valueOffset + header.valueLength;
    }
  }

  return { position, delimiter: null };
}

function parseMetaHeader(state) {
  let position = DICOM_DATASET_OFFSET;
  while (position + 8 <= state.view.byteLength) {
    const group = state.view.getUint16(position, true);
    if (group !== 0x0002) {
      break;
    }
    const header = readElementHeader(state.view, position, state.view.byteLength);
    if (tagMatches(header, 0x0002, 0x0010)) {
      state.transferSyntax = readAscii(
        state.view,
        header.valueOffset,
        header.valueLength,
      );
    }
    state.elementCount += 1;
    position = header.valueOffset + header.valueLength;
  }
  return position;
}

function validateTransferSyntax(transferSyntax) {
  if (!transferSyntax) {
    fail("INVALID_DICOM", "O DICOM nao informa a sintaxe de transferencia.");
  }
  if (
    transferSyntax === "1.2.840.10008.1.2"
    || transferSyntax === "1.2.840.10008.1.2.2"
  ) {
    fail(
      "UNSUPPORTED_TRANSFER_SYNTAX",
      "Esta versao aceita apenas conjuntos de dados Explicit VR Little Endian.",
    );
  }
}

function chooseImageSize(candidates, groups) {
  const validCandidates = candidates.filter(({ width, height }) => (
    Number.isInteger(width)
    && Number.isInteger(height)
    && width > 0
    && height > 0
    && width <= 8192
    && height <= 8192
  ));

  const ranked = validCandidates.map((candidate) => {
    const frameSize = candidate.width * candidate.height;
    let exactGroups = 0;
    let compatibleGroups = 0;
    for (const group of groups) {
      if (!group.voxelsLength || group.voxelsLength < frameSize) {
        continue;
      }
      const availableFrames = Math.floor(group.voxelsLength / frameSize);
      if (availableFrames > 0) {
        compatibleGroups += 1;
      }
      if (
        group.declaredFrames
        && availableFrames === group.declaredFrames
        && group.voxelsLength % frameSize === 0
      ) {
        exactGroups += 1;
      }
    }
    return {
      ...candidate,
      frameSize,
      exactGroups,
      compatibleGroups,
    };
  });

  ranked.sort((left, right) => (
    right.exactGroups - left.exactGroups
    || right.compatibleGroups - left.compatibleGroups
    || right.frameSize - left.frameSize
  ));

  const selected = ranked[0];
  if (!selected || selected.compatibleGroups === 0) {
    fail("INVALID_MOVIE", "Nao foi possivel determinar as dimensoes do cine GE.");
  }
  return selected;
}

function median(values) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function buildFrames(state, imageSize) {
  const frames = [];
  const warnings = [];

  for (const group of state.voxelGroups) {
    if (group.voxelsOffset === null || !group.voxelsLength) {
      continue;
    }

    const availableFrames = Math.floor(group.voxelsLength / imageSize.frameSize);
    const declaredFrames = Number.isInteger(group.declaredFrames) && group.declaredFrames > 0
      ? group.declaredFrames
      : availableFrames;
    const timestampCount = group.timestampsOffset === null
      ? 0
      : Math.floor(group.timestampsLength / 8);
    let frameCount = Math.min(availableFrames, declaredFrames);
    if (timestampCount > 0) {
      frameCount = Math.min(frameCount, timestampCount);
    }

    if (frameCount <= 0) {
      continue;
    }
    if (availableFrames < declaredFrames) {
      warnings.push("Um bloco declarou mais quadros do que o buffer contem; somente quadros completos foram usados.");
    }

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const timestampSeconds = group.timestampsOffset === null
        ? Number.NaN
        : state.view.getFloat64(group.timestampsOffset + frameIndex * 8, true);
      frames.push({
        offset: group.voxelsOffset + frameIndex * imageSize.frameSize,
        timestampSeconds,
      });
    }
  }

  if (!frames.length) {
    fail("INVALID_MOVIE", "O MovieGroup foi encontrado, mas nao contem quadros 2D completos.");
  }

  let timestampsAreMonotonic = true;
  for (let index = 0; index < frames.length; index += 1) {
    if (!Number.isFinite(frames[index].timestampSeconds)) {
      timestampsAreMonotonic = false;
      break;
    }
    if (
      index > 0
      && frames[index].timestampSeconds <= frames[index - 1].timestampSeconds
    ) {
      timestampsAreMonotonic = false;
      break;
    }
  }

  if (!timestampsAreMonotonic) {
    for (let index = 0; index < frames.length; index += 1) {
      frames[index].timestampSeconds = index / 30;
    }
    warnings.push("Os timestamps privados estavam ausentes ou fora de ordem; a reproducao usa 30 fps estimados.");
  }

  const deltas = [];
  for (let index = 1; index < frames.length; index += 1) {
    const delta = frames[index].timestampSeconds - frames[index - 1].timestampSeconds;
    if (delta > 0 && delta < 1) {
      deltas.push(delta);
    }
  }
  const medianDelta = median(deltas) || (1 / 30);
  const firstTimestamp = frames[0].timestampSeconds;
  const lastTimestamp = frames[frames.length - 1].timestampSeconds;

  return {
    frames,
    warnings: [...new Set(warnings)],
    frameRate: 1 / medianDelta,
    firstTimestamp,
    durationSeconds: Math.max(0, lastTimestamp - firstTimestamp),
  };
}

export function parseVividIqDicom(buffer, fileName = "arquivo DICOM") {
  if (!(buffer instanceof ArrayBuffer)) {
    fail("INVALID_INPUT", "O visualizador recebeu um arquivo invalido.");
  }
  if (buffer.byteLength > MAX_FILE_BYTES) {
    fail("RESOURCE_LIMIT", "O arquivo excede o limite local de 512 MB.");
  }
  if (buffer.byteLength < DICOM_DATASET_OFFSET) {
    fail("INVALID_DICOM", "O arquivo e pequeno demais para ser um DICOM Part 10.");
  }

  const view = new DataView(buffer);
  if (readAscii(view, DICOM_MAGIC_OFFSET, 4) !== "DICM") {
    fail("INVALID_DICOM", "Assinatura DICM nao encontrada. Selecione o arquivo original exportado pelo equipamento.");
  }

  const state = {
    view,
    elementCount: 0,
    transferSyntax: "",
    modality: "",
    manufacturer: "",
    model: "",
    cineType: "",
    previewWidth: null,
    previewHeight: null,
    privateCreatorFound: false,
    imageSizeCandidates: [],
    voxelGroups: [],
  };

  const datasetOffset = parseMetaHeader(state);
  validateTransferSyntax(state.transferSyntax);
  parseDataset(state, datasetOffset, buffer.byteLength);

  if (!state.privateCreatorFound) {
    fail(
      "UNSUPPORTED_GE_MOVIE",
      "Este DICOM nao contem GEMS_Ultrasound_MovieGroup_001 e nao e suportado por este visualizador.",
    );
  }
  if (!state.voxelGroups.some((group) => group.voxelsOffset !== null)) {
    fail(
      "UNSUPPORTED_GE_MOVIE",
      "O arquivo possui metadados GE, mas nao contem um cine 2D no formato MovieGroup conhecido.",
    );
  }

  const imageSize = chooseImageSize(state.imageSizeCandidates, state.voxelGroups);
  const timeline = buildFrames(state, imageSize);
  const equipment = [state.manufacturer, state.model].filter(Boolean).join(" · ");

  return {
    fileName,
    fileSize: buffer.byteLength,
    transferSyntax: state.transferSyntax,
    modality: state.modality || "US",
    manufacturer: state.manufacturer || "GE Ultrasound",
    model: state.model || "Vivid iq",
    equipment: equipment || "GE Vivid iq",
    cineType: state.cineType || "2D",
    previewWidth: state.previewWidth,
    previewHeight: state.previewHeight,
    width: imageSize.width,
    height: imageSize.height,
    frameSize: imageSize.frameSize,
    frameCount: timeline.frames.length,
    frameRate: timeline.frameRate,
    durationSeconds: timeline.durationSeconds,
    firstTimestamp: timeline.firstTimestamp,
    frames: timeline.frames,
    warnings: timeline.warnings,
    sourceBuffer: buffer,
  };
}

export function getVividIqFramePixels(study, frameIndex) {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= study.frameCount) {
    fail("INVALID_FRAME", "Quadro solicitado fora da sequencia.");
  }
  const frame = study.frames[frameIndex];
  return new Uint8Array(study.sourceBuffer, frame.offset, study.frameSize);
}

export function findVividIqFrameAtTimestamp(study, timestampSeconds) {
  if (!study.frames.length) {
    return 0;
  }
  if (timestampSeconds <= study.frames[0].timestampSeconds) {
    return 0;
  }
  const lastIndex = study.frames.length - 1;
  if (timestampSeconds >= study.frames[lastIndex].timestampSeconds) {
    return lastIndex;
  }

  let low = 0;
  let high = lastIndex;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (study.frames[middle].timestampSeconds <= timestampSeconds) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return Math.max(0, low - 1);
}

export const VIVID_IQ_MAX_FILE_BYTES = MAX_FILE_BYTES;
