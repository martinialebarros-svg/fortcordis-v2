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

  if (context.ultrasoundRegion) {
    if (tagMatches(header, 0x0018, 0x6012) && header.valueLength >= 2) {
      context.ultrasoundRegion.spatialFormat = view.getUint16(header.valueOffset, true);
      return;
    }
    if (tagMatches(header, 0x0018, 0x6018) && header.valueLength >= 4) {
      context.ultrasoundRegion.minX = view.getUint32(header.valueOffset, true);
      return;
    }
    if (tagMatches(header, 0x0018, 0x601a) && header.valueLength >= 4) {
      context.ultrasoundRegion.minY = view.getUint32(header.valueOffset, true);
      return;
    }
    if (tagMatches(header, 0x0018, 0x601c) && header.valueLength >= 4) {
      context.ultrasoundRegion.maxX = view.getUint32(header.valueOffset, true);
      return;
    }
    if (tagMatches(header, 0x0018, 0x601e) && header.valueLength >= 4) {
      context.ultrasoundRegion.maxY = view.getUint32(header.valueOffset, true);
      return;
    }
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
  if (tagMatches(header, PRIVATE_GROUP, 0x1057)) {
    if (readAscii(view, header.valueOffset, header.valueLength) === "CurvedSurface") {
      state.curvedSurfaceFound = true;
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

function collectEncapsulatedPreview(state, header, end) {
  let position = header.valueOffset;
  let fragmentIndex = 0;

  while (position + 8 <= end) {
    const item = readElementHeader(state.view, position, end);
    if (item.group !== ITEM_GROUP) {
      return;
    }
    if (item.element === SEQUENCE_DELIMITATION_TAG) {
      return;
    }
    if (item.element !== ITEM_TAG || item.valueLength === UNDEFINED_LENGTH) {
      return;
    }
    if (
      fragmentIndex > 0
      && item.valueLength >= 4
      && state.view.getUint8(item.valueOffset) === 0xff
      && state.view.getUint8(item.valueOffset + 1) === 0xd8
    ) {
      state.previewJpegOffset = item.valueOffset;
      state.previewJpegLength = item.valueLength;
      return;
    }
    fragmentIndex += 1;
    position = item.valueOffset + item.valueLength;
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
  const isUltrasoundRegionSequence = tagMatches(header, 0x0018, 0x6011);
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
    const ultrasoundRegion = isUltrasoundRegionSequence
      ? {
          spatialFormat: null,
          minX: null,
          minY: null,
          maxX: null,
          maxY: null,
        }
      : context.ultrasoundRegion;

    if (isVoxelGroupSequence) {
      state.voxelGroups.push(voxelGroup);
    }
    if (isUltrasoundRegionSequence) {
      state.ultrasoundRegions.push(ultrasoundRegion);
    }

    const parsed = parseDataset(
      state,
      item.valueOffset,
      itemEnd,
      { voxelGroup, ultrasoundRegion },
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

function parseDataset(
  state,
  start,
  end,
  context = { voxelGroup: null, ultrasoundRegion: null },
  depth = 0,
) {
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
      if (tagMatches(header, 0x7fe0, 0x0010)) {
        collectEncapsulatedPreview(state, header, end);
      }
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

function listValidImageSizes(candidates) {
  return candidates.filter(({ width, height }) => (
    Number.isInteger(width)
    && Number.isInteger(height)
    && width > 0
    && height > 0
    && width <= 8192
    && height <= 8192
  )).map((candidate) => ({
    ...candidate,
    frameSize: candidate.width * candidate.height,
  }));
}

function chooseImageSize(imageSizes, groups) {
  const ranked = imageSizes.map((candidate) => {
    let exactGroups = 0;
    let compatibleGroups = 0;
    for (const group of groups) {
      if (!group.voxelsLength || group.voxelsLength < candidate.frameSize) {
        continue;
      }
      const availableFrames = Math.floor(group.voxelsLength / candidate.frameSize);
      if (availableFrames > 0) {
        compatibleGroups += 1;
      }
      if (
        group.declaredFrames
        && availableFrames === group.declaredFrames
        && group.voxelsLength % candidate.frameSize === 0
      ) {
        exactGroups += 1;
      }
    }
    return {
      ...candidate,
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

function chooseDisplayGeometry(regions, imageSize, scanConversion) {
  const validTwoDimensionalRegions = regions
    .filter((region) => (
      region.spatialFormat === 1
      && Number.isInteger(region.minX)
      && Number.isInteger(region.minY)
      && Number.isInteger(region.maxX)
      && Number.isInteger(region.maxY)
      && region.maxX >= region.minX
      && region.maxY >= region.minY
    ))
    .map((region) => ({
      width: region.maxX - region.minX + 1,
      height: region.maxY - region.minY + 1,
    }))
    .filter(({ width, height }) => (
      width > 0
      && height > 0
      && width <= 8192
      && height <= 8192
      && width / height >= 0.2
      && width / height <= 5
    ));

  validTwoDimensionalRegions.sort((left, right) => (
    Math.abs(Math.log(left.width / imageSize.width))
    - Math.abs(Math.log(right.width / imageSize.width))
  ));

  const selected = validTwoDimensionalRegions[0];
  if (!selected) {
    if (scanConversion) {
      return {
        displayWidth: 1,
        displayHeight: 1,
        displayAspectRatio: 1,
        displayAspectRatioSource: "estimated-sector",
      };
    }
    return {
      displayWidth: imageSize.width,
      displayHeight: imageSize.height,
      displayAspectRatio: imageSize.width / imageSize.height,
      displayAspectRatioSource: "native-pixels",
    };
  }

  return {
    displayWidth: selected.width,
    displayHeight: selected.height,
    displayAspectRatio: selected.width / selected.height,
    displayAspectRatioSource: "ultrasound-region",
  };
}

function chooseGroupImageSize(group, imageSizes) {
  const timestampCount = group.timestampsOffset === null
    ? 0
    : Math.floor(group.timestampsLength / 8);
  const expectedFrameCounts = [group.declaredFrames, timestampCount]
    .filter((value) => Number.isInteger(value) && value > 0);

  const exact = imageSizes.filter((candidate) => expectedFrameCounts.some(
    (frameCount) => candidate.frameSize * frameCount === group.voxelsLength,
  ));
  if (exact.length) {
    exact.sort((left, right) => (
      Number(right.kind === 2) - Number(left.kind === 2)
      || Number(right.component === 0) - Number(left.component === 0)
      || right.frameSize - left.frameSize
    ));
    return exact[0];
  }

  if (!expectedFrameCounts.length) {
    const divisible = imageSizes.filter((candidate) => (
      group.voxelsLength >= candidate.frameSize
      && group.voxelsLength % candidate.frameSize === 0
    ));
    divisible.sort((left, right) => right.frameSize - left.frameSize);
    return divisible[0] || null;
  }
  return null;
}

function buildFrames(state, imageSizes) {
  const frames = [];
  const warnings = [];

  for (const group of state.voxelGroups) {
    if (group.voxelsOffset === null || !group.voxelsLength) {
      continue;
    }

    const imageSize = chooseGroupImageSize(group, imageSizes);
    if (!imageSize) {
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
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const timestampSeconds = group.timestampsOffset === null
        ? Number.NaN
        : state.view.getFloat64(group.timestampsOffset + frameIndex * 8, true);
      frames.push({
        offset: group.voxelsOffset + frameIndex * imageSize.frameSize,
        timestampSeconds,
        width: imageSize.width,
        height: imageSize.height,
        frameSize: imageSize.frameSize,
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

  const firstTimestamp = frames[0].timestampSeconds;
  const lastTimestamp = frames[frames.length - 1].timestampSeconds;
  const durationSeconds = Math.max(0, lastTimestamp - firstTimestamp);
  const frameRate = durationSeconds > 0 && frames.length > 1
    ? (frames.length - 1) / durationSeconds
    : 30;
  const dimensions = new Map();
  for (const frame of frames) {
    const key = `${frame.width}x${frame.height}`;
    const current = dimensions.get(key) || {
      width: frame.width,
      height: frame.height,
      frameCount: 0,
    };
    current.frameCount += 1;
    dimensions.set(key, current);
  }

  return {
    frames,
    warnings: [...new Set(warnings)],
    frameRate,
    firstTimestamp,
    durationSeconds,
    frameDimensions: [...dimensions.values()],
    maxFrameWidth: Math.max(...frames.map((frame) => frame.width)),
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
    previewJpegOffset: null,
    previewJpegLength: 0,
    privateCreatorFound: false,
    curvedSurfaceFound: false,
    imageSizeCandidates: [],
    voxelGroups: [],
    ultrasoundRegions: [],
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

  const imageSizes = listValidImageSizes(state.imageSizeCandidates);
  const imageSize = chooseImageSize(imageSizes, state.voxelGroups);
  const timeline = buildFrames(state, imageSizes);
  const scanConversion = state.curvedSurfaceFound && state.cineType.includes("2D");
  const displayGeometry = chooseDisplayGeometry(
    state.ultrasoundRegions,
    imageSize,
    scanConversion,
  );
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
    ...displayGeometry,
    frameSize: imageSize.frameSize,
    frameDimensions: timeline.frameDimensions,
    maxFrameWidth: timeline.maxFrameWidth,
    scanConversion,
    previewJpegOffset: state.previewJpegOffset,
    previewJpegLength: state.previewJpegLength,
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
  return new Uint8Array(study.sourceBuffer, frame.offset, frame.frameSize);
}

export function getVividIqPreviewJpeg(study) {
  if (
    !Number.isInteger(study.previewJpegOffset)
    || study.previewJpegOffset < 0
    || !Number.isInteger(study.previewJpegLength)
    || study.previewJpegLength <= 0
  ) {
    return null;
  }
  return new Uint8Array(
    study.sourceBuffer,
    study.previewJpegOffset,
    study.previewJpegLength,
  );
}

export function createVividIqDisplayMap(
  sourceWidth,
  sourceHeight,
  outputWidth,
  outputHeight,
  scanConversion = true,
  lateralFlip = true,
) {
  for (const dimension of [sourceWidth, sourceHeight, outputWidth, outputHeight]) {
    if (!Number.isInteger(dimension) || dimension <= 0 || dimension > 8192) {
      fail("INVALID_GEOMETRY", "Dimensao invalida para orientar o quadro do cine.");
    }
  }

  const mapping = new Int32Array(outputWidth * outputHeight);
  mapping.fill(-1);
  if (!scanConversion) {
    for (let y = 0; y < outputHeight; y += 1) {
      const sourceX = Math.min(
        sourceWidth - 1,
        Math.round((y / Math.max(1, outputHeight - 1)) * (sourceWidth - 1)),
      );
      for (let x = 0; x < outputWidth; x += 1) {
        const normalized = x / Math.max(1, outputWidth - 1);
        const sourceY = Math.min(
          sourceHeight - 1,
          Math.round((lateralFlip ? 1 - normalized : normalized) * (sourceHeight - 1)),
        );
        mapping[y * outputWidth + x] = sourceY * sourceWidth + sourceX;
      }
    }
    return mapping;
  }

  const aspectRatio = outputWidth / outputHeight;
  const halfAngle = Math.asin(Math.min(0.98, aspectRatio / 2));
  const centerX = (outputWidth - 1) / 2;
  const outerRadius = Math.max(1, outputHeight - 1);
  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const deltaX = x - centerX;
      const radius = Math.hypot(deltaX, y);
      const angle = Math.atan2(deltaX, y);
      if (radius > outerRadius || Math.abs(angle) > halfAngle) {
        continue;
      }
      const sourceX = Math.min(
        sourceWidth - 1,
        Math.round((radius / outerRadius) * (sourceWidth - 1)),
      );
      const beamPosition = 0.5 + angle / (2 * halfAngle);
      const sourceY = Math.min(
        sourceHeight - 1,
        Math.max(
          0,
          Math.round(
            (lateralFlip ? 1 - beamPosition : beamPosition) * (sourceHeight - 1),
          ),
        ),
      );
      mapping[y * outputWidth + x] = sourceY * sourceWidth + sourceX;
    }
  }
  return mapping;
}

export function detectVividIqPreviewAspectRatio(
  pixels,
  width,
  height,
  channels = 4,
) {
  if (
    !pixels
    || !Number.isInteger(width)
    || !Number.isInteger(height)
    || !Number.isInteger(channels)
    || width <= 0
    || height <= 0
    || channels < 3
    || pixels.length < width * height * channels
  ) {
    return null;
  }

  const blockSize = Math.max(4, Math.round(Math.min(width, height) / 118));
  const gridWidth = Math.floor(width / blockSize);
  const gridHeight = Math.floor(height / blockSize);
  if (gridWidth < 3 || gridHeight < 3) {
    return null;
  }
  const active = new Uint8Array(gridWidth * gridHeight);
  const minimumActivePixels = Math.ceil(blockSize * blockSize * 0.12);
  for (let gridY = 0; gridY < gridHeight; gridY += 1) {
    for (let gridX = 0; gridX < gridWidth; gridX += 1) {
      let activePixels = 0;
      for (let y = 0; y < blockSize; y += 1) {
        for (let x = 0; x < blockSize; x += 1) {
          const pixelOffset = (
            (gridY * blockSize + y) * width
            + gridX * blockSize
            + x
          ) * channels;
          const red = pixels[pixelOffset];
          const green = pixels[pixelOffset + 1];
          const blue = pixels[pixelOffset + 2];
          const maximum = Math.max(red, green, blue);
          const minimum = Math.min(red, green, blue);
          if (maximum > 12 && maximum - minimum < 15) {
            activePixels += 1;
          }
        }
      }
      if (activePixels >= minimumActivePixels) {
        active[gridY * gridWidth + gridX] = 1;
      }
    }
  }

  const visited = new Uint8Array(active.length);
  let largest = null;
  for (let start = 0; start < active.length; start += 1) {
    if (!active[start] || visited[start]) {
      continue;
    }
    const queue = [start];
    let head = 0;
    let count = 0;
    let minX = gridWidth;
    let minY = gridHeight;
    let maxX = 0;
    let maxY = 0;
    visited[start] = 1;
    while (head < queue.length) {
      const index = queue[head];
      head += 1;
      const x = index % gridWidth;
      const y = Math.floor(index / gridWidth);
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let adjacentY = Math.max(0, y - 1); adjacentY <= Math.min(gridHeight - 1, y + 1); adjacentY += 1) {
        for (let adjacentX = Math.max(0, x - 1); adjacentX <= Math.min(gridWidth - 1, x + 1); adjacentX += 1) {
          const adjacent = adjacentY * gridWidth + adjacentX;
          if (active[adjacent] && !visited[adjacent]) {
            visited[adjacent] = 1;
            queue.push(adjacent);
          }
        }
      }
    }
    if (!largest || count > largest.count) {
      largest = { count, minX, minY, maxX, maxY };
    }
  }

  if (!largest || largest.count < gridWidth * gridHeight * 0.03) {
    return null;
  }
  const componentWidth = (largest.maxX - largest.minX + 1) * blockSize;
  const componentHeight = (largest.maxY - largest.minY + 1) * blockSize;
  const aspectRatio = componentWidth / componentHeight;
  if (
    componentWidth < width * 0.15
    || componentHeight < height * 0.15
    || aspectRatio < 0.45
    || aspectRatio > 1.95
  ) {
    return null;
  }
  return aspectRatio;
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
