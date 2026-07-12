import { parseXml, type XmlNode, type XmlElement } from '@rgrove/parse-xml';

export interface SVGValidationResult {
  valid: boolean;
  pathCount: number;
  groupCount: number;
  fileSizeBytes: number;
  hasViewBox: boolean;
  hasXmlns: boolean;
  duplicateIds: string[];
  emptyPaths: string[];
  errors: string[];
  warnings: string[];
}

const MAX_PATH_COUNT = 5_000;
const MAX_SIZE_BYTES = 5_000_000;

function isElement(node: XmlNode): node is XmlElement {
  return node.type === 'element';
}

export function validateSVG(svg: string): SVGValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sizeBytes = Buffer.byteLength(svg, 'utf8');
  if (sizeBytes > MAX_SIZE_BYTES) {
    errors.push(`SVG too large: ${sizeBytes} bytes (max ${MAX_SIZE_BYTES})`);
  }

  let doc;
  try {
    doc = parseXml(svg);
  } catch (e) {
    return {
      valid: false,
      pathCount: 0,
      groupCount: 0,
      fileSizeBytes: sizeBytes,
      hasViewBox: false,
      hasXmlns: false,
      duplicateIds: [],
      emptyPaths: [],
      errors: [`XML parse error: ${e instanceof Error ? e.message : String(e)}`],
      warnings: [],
    };
  }

  const root = doc.children.find((n) => isElement(n) && n.name === 'svg') as
    | XmlElement
    | undefined;

  if (!root) {
    errors.push('No <svg> root element');
    return {
      valid: false,
      pathCount: 0,
      groupCount: 0,
      fileSizeBytes: sizeBytes,
      hasViewBox: false,
      hasXmlns: false,
      duplicateIds: [],
      emptyPaths: [],
      errors,
      warnings,
    };
  }

  const hasViewBox = 'viewBox' in (root.attributes ?? {});
  const hasXmlns = 'xmlns' in (root.attributes ?? {});

  if (!hasViewBox) warnings.push('Missing viewBox attribute');
  if (!hasXmlns) warnings.push('Missing xmlns attribute');

  const ids = new Set<string>();
  const duplicateIds: string[] = [];
  const emptyPaths: string[] = [];
  let pathCount = 0;
  let groupCount = 0;

  function walk(node: XmlNode): void {
    if (!isElement(node)) return;

    if (node.name === 'path') {
      pathCount++;
      const d = node.attributes?.d ?? '';
      if (!d || d.trim() === '' || d === 'M0 0') {
        emptyPaths.push(node.attributes?.id ?? `path-${pathCount}`);
      }
    }

    if (node.name === 'g') groupCount++;

    const id = node.attributes?.id;
    if (id) {
      if (ids.has(id)) duplicateIds.push(id);
      else ids.add(id);
    }

    node.children.forEach(walk);
  }

  walk(root);

  if (pathCount > MAX_PATH_COUNT) {
    errors.push(`Too many paths: ${pathCount} (max ${MAX_PATH_COUNT})`);
  }

  if (duplicateIds.length > 0) {
    warnings.push(`Duplicate IDs: ${duplicateIds.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    pathCount,
    groupCount,
    fileSizeBytes: sizeBytes,
    hasViewBox,
    hasXmlns,
    duplicateIds,
    emptyPaths,
    errors,
    warnings,
  };
}
