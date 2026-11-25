/**
 * FHA EAD / UAD 3.6 appraisal ZIP ingest — validate package shape and extract summary fields.
 * Development work by David Lane
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';

export const MAX_ZIP_BYTES = 60 * 1024 * 1024;
export const SESSION_TTL_MS = 30 * 60 * 1000;

const VALID_DOCUMENT_TYPES = new Set([
  'AppraisalReport',
  'ValuationUpdate',
  'ValuationCompletion',
]);

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png']);
const sessions = new Map();

function finding(code, message, severity = 'Fatal') {
  return { code, message, severity };
}

function localName(node) {
  if (!node || !node.nodeName) return '';
  const n = String(node.nodeName);
  const i = n.indexOf(':');
  return i >= 0 ? n.slice(i + 1) : n;
}

function textContent(node) {
  if (!node) return '';
  return String(node.textContent || '').trim();
}

function walk(node, visit) {
  if (!node) return;
  visit(node);
  const kids = node.childNodes;
  if (!kids) return;
  for (let i = 0; i < kids.length; i += 1) {
    walk(kids[i], visit);
  }
}

function collectByLocalName(root, name) {
  const out = [];
  walk(root, (n) => {
    if (n.nodeType === 1 && localName(n) === name) out.push(n);
  });
  return out;
}

function firstTextByLocalName(root, name) {
  const nodes = collectByLocalName(root, name);
  for (const n of nodes) {
    const t = textContent(n);
    if (t) return t;
  }
  return '';
}

function basenameNorm(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .pop()
    ?.toLowerCase() || '';
}

function pathNorm(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .toLowerCase();
}

function classifyZipEntries(files) {
  const xml = [];
  const pdf = [];
  const images = [];
  const other = [];

  for (const [rawName, data] of Object.entries(files)) {
    const name = String(rawName).replace(/\\/g, '/');
    if (!name || name.endsWith('/')) continue;
    const lower = name.toLowerCase();
    const base = basenameNorm(name);
    const ext = path.extname(base).toLowerCase();
    const entry = { name, base, data: Buffer.from(data) };

    if (ext === '.xml') xml.push(entry);
    else if (ext === '.pdf') pdf.push(entry);
    else if (IMAGE_EXT.has(ext)) images.push(entry);
    else other.push(entry);
  }

  return { xml, pdf, images, other };
}

function partyNameFromParty(partyEl) {
  const first = firstTextByLocalName(partyEl, 'FirstName');
  const middle = firstTextByLocalName(partyEl, 'MiddleName');
  const last = firstTextByLocalName(partyEl, 'LastName');
  const full = firstTextByLocalName(partyEl, 'FullName');
  if (full) return full;
  return [first, middle, last].filter(Boolean).join(' ').trim();
}

function partyRole(partyEl) {
  return firstTextByLocalName(partyEl, 'PartyRoleType');
}

function extractParties(doc) {
  let borrowerName = '';
  let appraiserName = '';
  for (const party of collectByLocalName(doc, 'PARTY')) {
    const role = partyRole(party);
    const name = partyNameFromParty(party);
    if (!name) continue;
    if (!borrowerName && /borrower/i.test(role)) borrowerName = name;
    if (!appraiserName && /appraiser/i.test(role) && !/supervisory/i.test(role)) {
      appraiserName = name;
    }
  }
  return { borrowerName, appraiserName };
}

function extractAddress(doc) {
  const addresses = collectByLocalName(doc, 'ADDRESS');
  for (const addr of addresses) {
    const line = firstTextByLocalName(addr, 'AddressLineText');
    const city = firstTextByLocalName(addr, 'CityName');
    const state = firstTextByLocalName(addr, 'StateCode');
    const postal = firstTextByLocalName(addr, 'PostalCode');
    if (line || city || state || postal) {
      return {
        addressLine: line,
        city,
        state,
        postalCode: postal,
        formatted: [line, [city, state].filter(Boolean).join(', '), postal]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      };
    }
  }
  return { addressLine: '', city: '', state: '', postalCode: '', formatted: '' };
}

function extractPdfReference(doc) {
  for (const fo of collectByLocalName(doc, 'FOREIGN_OBJECT')) {
    const mime = firstTextByLocalName(fo, 'MIMETypeIdentifier')
      || firstTextByLocalName(fo, 'MIMEType')
      || '';
    const objectName =
      firstTextByLocalName(fo, 'ObjectName')
      || firstTextByLocalName(fo, 'ObjectEncodingType')
      || firstTextByLocalName(fo, 'EmbeddedContentXML')
      || '';
    const location =
      firstTextByLocalName(fo, 'ObjectURL')
      || firstTextByLocalName(fo, 'FileLocationIdentifier')
      || firstTextByLocalName(fo, 'ImageFileLocationIdentifier')
      || '';
    if (/pdf/i.test(mime) || /\.pdf$/i.test(objectName) || /\.pdf$/i.test(location)) {
      return basenameNorm(objectName || location);
    }
  }
  const named = firstTextByLocalName(doc, 'ObjectName');
  if (/\.pdf$/i.test(named)) return basenameNorm(named);
  return '';
}

function ancestorLocalNames(node, maxHops = 8) {
  const names = [];
  let cur = node ? node.parentNode : null;
  let hops = 0;
  while (cur && hops < maxHops) {
    if (cur.nodeType === 1) names.push(localName(cur));
    cur = cur.parentNode;
    hops += 1;
  }
  return names;
}

function nearestAncestor(node, wantedNames) {
  const wanted = new Set(wantedNames);
  let cur = node ? node.parentNode : null;
  let hops = 0;
  while (cur && hops < 12) {
    if (cur.nodeType === 1 && wanted.has(localName(cur))) return cur;
    cur = cur.parentNode;
    hops += 1;
  }
  return null;
}

function extractImageMeta(imageEl) {
  const location =
    firstTextByLocalName(imageEl, 'ImageFileLocationIdentifier')
    || firstTextByLocalName(imageEl, 'FileLocationIdentifier')
    || '';
  if (!location) return null;

  const category =
    firstTextByLocalName(imageEl, 'ImageCategoryType')
    || firstTextByLocalName(imageEl, 'ImageCategory')
    || '';
  const caption =
    firstTextByLocalName(imageEl, 'ImageCaptionCommentDescription')
    || firstTextByLocalName(imageEl, 'ImageCaption')
    || firstTextByLocalName(imageEl, 'ObjectDescription')
    || '';
  const mime =
    firstTextByLocalName(imageEl, 'MIMETypeIdentifier')
    || firstTextByLocalName(imageEl, 'MIMEType')
    || '';

  const room = nearestAncestor(imageEl, ['ROOM']);
  const roomType = room ? firstTextByLocalName(room, 'RoomType') : '';
  const levelType = room ? firstTextByLocalName(room, 'LevelType') : '';

  const car = nearestAncestor(imageEl, ['CAR_STORAGE']);
  const section =
    (room && 'Room')
    || (car && 'Car storage')
    || (nearestAncestor(imageEl, ['INSPECTION']) && 'Inspection')
    || (nearestAncestor(imageEl, ['COMPARABLE']) && 'Comparable')
    || (ancestorLocalNames(imageEl).find((n) =>
      /SUBJECT|SITE|IMPROVEMENT|VALUATION|EXHIBIT/i.test(n)
    ) || '');

  const fileStem = basenameNorm(location)
    .replace(/\.[^.]+$/, '')
    .replace(/^sf\d+[a-z]?_/i, '')
    .replace(/^condo\d+_/i, '')
    .replace(/^mh\d+_/i, '')
    .replace(/^coop\d+_/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  const pretty = (s) =>
    String(s || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  const displayTitle =
    pretty(caption)
    || pretty(category)
    || pretty(roomType)
    || pretty(fileStem)
    || basenameNorm(location);

  return {
    location,
    base: basenameNorm(location),
    caption,
    category,
    mime,
    roomType,
    levelType,
    section: section || '',
    displayTitle,
  };
}

function extractImagesFromXml(doc) {
  const images = [];
  const seen = new Set();

  for (const imageEl of collectByLocalName(doc, 'IMAGE')) {
    const meta = extractImageMeta(imageEl);
    if (!meta) continue;
    const key = pathNorm(meta.location);
    if (seen.has(key)) {
      // Prefer the entry that carries more labeling when the same file is referenced twice
      const existing = images.find((i) => pathNorm(i.location) === key);
      if (existing && !existing.caption && meta.caption) Object.assign(existing, meta);
      if (existing && !existing.category && meta.category) {
        existing.category = meta.category;
        if (!existing.displayTitle || existing.displayTitle === existing.base) {
          existing.displayTitle = meta.displayTitle;
        }
      }
      continue;
    }
    seen.add(key);
    images.push(meta);
  }

  for (const detail of collectByLocalName(doc, 'IMAGE_DETAIL')) {
    const meta = extractImageMeta(detail);
    if (!meta) continue;
    const key = pathNorm(meta.location);
    if (seen.has(key)) continue;
    seen.add(key);
    images.push(meta);
  }

  return images;
}

function extractSummaryFields(doc) {
  const documentType =
    firstTextByLocalName(doc, 'DocumentType')
    || firstTextByLocalName(doc, 'ValuationReportType')
    || '';

  const opinionOfValue =
    firstTextByLocalName(doc, 'PropertyValuationAmount')
    || firstTextByLocalName(doc, 'OpinionOfMarketValueAmount')
    || firstTextByLocalName(doc, 'PropertyAppraisedValueAmount')
    || '';

  const marketValueCondition =
    firstTextByLocalName(doc, 'PropertyValuationConditionalConclusionType')
    || firstTextByLocalName(doc, 'MarketValueConditionType')
    || firstTextByLocalName(doc, 'AppraisalConditionType')
    || '';

  const effectiveDate =
    firstTextByLocalName(doc, 'AppraisalReportEffectiveDate')
    || firstTextByLocalName(doc, 'AppraisalEffectiveDate')
    || firstTextByLocalName(doc, 'ValuationEffectiveDate')
    || '';

  const address = extractAddress(doc);
  const { borrowerName, appraiserName } = extractParties(doc);
  const pdfReference = extractPdfReference(doc);
  const xmlImages = extractImagesFromXml(doc);

  return {
    documentType,
    opinionOfValue,
    marketValueCondition,
    effectiveDate,
    address,
    borrowerName,
    appraiserName,
    pdfReference,
    xmlImages,
  };
}

function matchImages(xmlImages, zipImages) {
  const byBase = new Map();
  const byPath = new Map();
  for (const img of zipImages) {
    byBase.set(img.base, img);
    byPath.set(pathNorm(img.name), img);
  }

  const matched = [];
  const missing = [];
  const referencedBases = new Set();

  for (const ref of xmlImages) {
    const hit =
      byPath.get(pathNorm(ref.location))
      || byBase.get(ref.base)
      || byBase.get(basenameNorm(ref.location))
      || null;
    const meta = {
      location: ref.location,
      caption: ref.caption || '',
      category: ref.category || '',
      mime: ref.mime || '',
      roomType: ref.roomType || '',
      levelType: ref.levelType || '',
      section: ref.section || '',
      displayTitle: ref.displayTitle || ref.caption || ref.category || ref.base,
      base: ref.base,
    };
    if (hit) {
      referencedBases.add(hit.base);
      matched.push({
        ...meta,
        zipPath: hit.name,
        present: true,
      });
    } else {
      missing.push(ref.location);
      matched.push({
        ...meta,
        zipPath: null,
        present: false,
      });
    }
  }

  const unreferenced = zipImages
    .filter((img) => !referencedBases.has(img.base))
    .map((img) => img.name);

  return { matched, missing, unreferenced };
}

async function purgeExpiredSessions() {
  const now = Date.now();
  for (const [id, meta] of sessions.entries()) {
    if (now - meta.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
      await fs.rm(meta.dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function writeSessionAssets({ pdf, images, matched }) {
  await purgeExpiredSessions();
  const sessionId = crypto.randomBytes(12).toString('hex');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `ead-${sessionId}-`));
  const assets = [];

  let pdfAsset = null;
  if (pdf) {
    const safeName = path.basename(pdf.name).replace(/[^\w.\-]+/g, '_');
    await fs.writeFile(path.join(dir, safeName), pdf.data);
    pdfAsset = {
      name: safeName,
      url: `/api/ead/assets/${sessionId}/${encodeURIComponent(safeName)}`,
      zipPath: pdf.name,
    };
    assets.push({ name: safeName, kind: 'pdf' });
  }

  const imageAssets = [];
  for (const m of matched) {
    if (!m.present) continue;
    const zipImg = images.find((i) => i.name === m.zipPath);
    if (!zipImg) continue;
    const safeName = path.basename(zipImg.name).replace(/[^\w.\-]+/g, '_');
    const dest = path.join(dir, safeName);
    await fs.writeFile(dest, zipImg.data);
    imageAssets.push({
      id: `${sessionId}-${safeName}`,
      name: safeName,
      caption: m.caption || '',
      category: m.category || '',
      mime: m.mime || '',
      roomType: m.roomType || '',
      levelType: m.levelType || '',
      section: m.section || '',
      displayTitle: m.displayTitle || m.caption || m.category || safeName,
      location: m.location,
      url: `/api/ead/assets/${sessionId}/${encodeURIComponent(safeName)}`,
      zipPath: zipImg.name,
      bytes: zipImg.data.length,
    });
    assets.push({ name: safeName, kind: 'image' });
  }

  sessions.set(sessionId, { dir, createdAt: Date.now(), assets: new Set(assets.map((a) => a.name)) });

  return { sessionId, pdfAsset, imageAssets };
}

/**
 * Parse a UAD 3.6 / EAD appraisal ZIP buffer.
 * @param {Buffer} buffer
 * @param {{ originalName?: string }} [opts]
 */
export async function parseEadAppraisalZip(buffer, opts = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('ZIP file required');
    err.code = 'ZIP_REQUIRED';
    throw err;
  }
  if (buffer.length > MAX_ZIP_BYTES) {
    const err = new Error(`ZIP exceeds ${MAX_ZIP_BYTES / (1024 * 1024)} MB limit`);
    err.code = 'ZIP_TOO_LARGE';
    throw err;
  }

  const findings = [];
  let files;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch (e) {
    findings.push(finding('SYS9001', `Invalid ZIP file: ${e.message || 'cannot open archive'}`));
    return {
      ok: false,
      originalName: opts.originalName || null,
      findings,
      summary: null,
      sessionId: null,
      pdf: null,
      images: [],
    };
  }

  const { xml, pdf, images } = classifyZipEntries(files);

  if (xml.length === 0) {
    findings.push(finding('SYS9001', 'Missing XML file.'));
  } else if (xml.length > 1) {
    findings.push(finding('SYS9001', `Too many XML files (${xml.length}). Exactly one is required.`));
  }

  if (pdf.length === 0) {
    findings.push(finding('SYS9003', 'Missing Appraisal Report PDF File.'));
  } else if (pdf.length > 1) {
    findings.push(finding('SYS9006', 'More than One Appraisal Report PDF File.'));
  }

  let summary = null;
  let matchedImages = [];
  let xmlParseOk = false;

  if (xml.length === 1) {
    let xmlText;
    try {
      xmlText = strFromU8(xml[0].data);
    } catch {
      xmlText = xml[0].data.toString('utf8');
    }

    let doc;
    try {
      const parser = new DOMParser({
        errorHandler: {
          warning() {},
          error(msg) {
            throw new Error(String(msg));
          },
          fatalError(msg) {
            throw new Error(String(msg));
          },
        },
      });
      doc = parser.parseFromString(xmlText, 'text/xml');
      const parseErrors = collectByLocalName(doc, 'parsererror');
      if (parseErrors.length) {
        throw new Error(textContent(parseErrors[0]) || 'XML parse error');
      }
      xmlParseOk = true;
    } catch (e) {
      findings.push(
        finding(
          'SYS9001',
          `Appraisal data in invalid format: ${e.message || 'XML file not well formed.'}`
        )
      );
    }

    if (xmlParseOk && doc) {
      const fields = extractSummaryFields(doc);
      if (fields.documentType && !VALID_DOCUMENT_TYPES.has(fields.documentType)) {
        findings.push(
          finding(
            'SYS9001',
            `Cannot auto-detect document type. Got "${fields.documentType}"; expected AppraisalReport, ValuationUpdate, or ValuationCompletion.`
          )
        );
      } else if (!fields.documentType) {
        findings.push(
          finding(
            'SYS9001',
            'Cannot auto-detect document type. DocumentType element missing or empty.'
          )
        );
      }

      if (pdf.length === 1 && fields.pdfReference) {
        if (basenameNorm(pdf[0].name) !== fields.pdfReference) {
          findings.push(
            finding(
              'SYS9004',
              `Mismatched PDF File Name: PDF reference ${fields.pdfReference} in XML file does not match PDF file ${path.basename(pdf[0].name)} in Zip file.`
            )
          );
        }
      }

      const match = matchImages(fields.xmlImages, images);
      matchedImages = match.matched;
      for (const loc of match.missing) {
        findings.push(
          finding('SYS9008', `Missing Appraisal Image in Zip File: ${loc}.`, 'Warning')
        );
      }
      for (const loc of match.unreferenced) {
        findings.push(
          finding('SYS9009', `Unreferenced Appraisal Image in XML File: ${loc}.`, 'Warning')
        );
      }

      summary = {
        documentType: fields.documentType || null,
        subjectAddress: fields.address.formatted || null,
        address: fields.address,
        opinionOfValue: fields.opinionOfValue || null,
        marketValueCondition: fields.marketValueCondition || null,
        effectiveDate: fields.effectiveDate || null,
        appraiserName: fields.appraiserName || null,
        borrowerName: fields.borrowerName || null,
        pdfReference: fields.pdfReference || null,
        xmlFileName: path.basename(xml[0].name),
        pdfFileName: pdf[0] ? path.basename(pdf[0].name) : null,
        imageCount: images.length,
        referencedImageCount: fields.xmlImages.length,
      };
    }
  }

  const fatal = findings.some((f) => f.severity === 'Fatal');
  let sessionId = null;
  let pdfAsset = null;
  let imageAssets = [];

  if (xmlParseOk || pdf.length || images.length) {
    const written = await writeSessionAssets({
      pdf: pdf[0] || null,
      images,
      matched: matchedImages.length
        ? matchedImages
        : images.map((img) => ({
            present: true,
            zipPath: img.name,
            caption: '',
            location: img.name,
            base: img.base,
          })),
    });
    sessionId = written.sessionId;
    pdfAsset = written.pdfAsset;
    imageAssets = written.imageAssets;
  }

  return {
    ok: !fatal && xml.length === 1 && pdf.length === 1 && xmlParseOk,
    originalName: opts.originalName || null,
    findings,
    summary,
    sessionId,
    pdf: pdfAsset,
    images: imageAssets,
    package: {
      xmlCount: xml.length,
      pdfCount: pdf.length,
      imageCount: images.length,
      xmlNames: xml.map((x) => x.name),
      pdfNames: pdf.map((p) => p.name),
    },
  };
}

/**
 * Read a previously extracted asset for a parse session.
 * @param {string} sessionId
 * @param {string} name
 * @returns {Promise<{ buffer: Buffer, contentType: string, fileName: string } | null>}
 */
export async function getEadSessionAsset(sessionId, name) {
  await purgeExpiredSessions();
  const meta = sessions.get(sessionId);
  if (!meta) return null;
  const safe = path.basename(String(name || ''));
  if (!safe || safe !== name.replace(/\\/g, '/').split('/').pop()) return null;
  if (!meta.assets.has(safe)) return null;
  const filePath = path.join(meta.dir, safe);
  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(safe).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    return { buffer, contentType, fileName: safe };
  } catch {
    return null;
  }
}

/** Test helper: build a minimal EAD-shaped ZIP in memory. */
export function buildSyntheticEadZip({
  includePdf = true,
  includeSecondXml = false,
  includeImages = true,
  omitReferencedImage = false,
  documentType = 'AppraisalReport',
  pdfName = 'SF5_Appraisal_v1.4.pdf',
  xmlPdfRef = 'SF5_Appraisal_v1.4.pdf',
  opinionOfValue = '195000',
} = {}) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas" MISMOReferenceModelIdentifier="3.6.0366">
  <DEAL_SETS>
    <DEAL_SET>
      <DEALS>
        <DEAL>
          <COLLATERALS>
            <COLLATERAL>
              <SUBJECT_PROPERTY>
                <ADDRESS>
                  <AddressLineText>12345 Holiday Hwy</AddressLineText>
                  <CityName>Surfside</CityName>
                  <StateCode>HI</StateCode>
                  <PostalCode>12345</PostalCode>
                </ADDRESS>
              </SUBJECT_PROPERTY>
            </COLLATERAL>
          </COLLATERALS>
          <PARTIES>
            <PARTY>
              <INDIVIDUAL>
                <NAME>
                  <FirstName>Betty</FirstName>
                  <LastName>Borrower</LastName>
                </NAME>
              </INDIVIDUAL>
              <ROLES>
                <ROLE>
                  <ROLE_DETAIL>
                    <PartyRoleType>Borrower</PartyRoleType>
                  </ROLE_DETAIL>
                </ROLE>
              </ROLES>
            </PARTY>
            <PARTY>
              <INDIVIDUAL>
                <NAME>
                  <FirstName>Tom</FirstName>
                  <LastName>Appraiser</LastName>
                </NAME>
              </INDIVIDUAL>
              <ROLES>
                <ROLE>
                  <ROLE_DETAIL>
                    <PartyRoleType>Appraiser</PartyRoleType>
                  </ROLE_DETAIL>
                </ROLE>
              </ROLES>
            </PARTY>
          </PARTIES>
          <SERVICES>
            <SERVICE>
              <VALUATION>
                <VALUATION_RESPONSE>
                  <VALUATION_REPORT>
                    <VALUATION_REPORT_DETAIL>
                      <AppraisalReportEffectiveDate>2019-10-05</AppraisalReportEffectiveDate>
                      <DocumentType>${documentType}</DocumentType>
                    </VALUATION_REPORT_DETAIL>
                    <PROPERTY_VALUATION>
                      <PROPERTY_VALUATION_DETAIL>
                        <PropertyValuationAmount>${opinionOfValue}</PropertyValuationAmount>
                        <PropertyValuationConditionalConclusionType>AsIs</PropertyValuationConditionalConclusionType>
                      </PROPERTY_VALUATION_DETAIL>
                    </PROPERTY_VALUATION>
                    <EMBEDDED_FILE>
                      <DOCUMENT>
                        <FOREIGN_OBJECT>
                          <ObjectName>${xmlPdfRef}</ObjectName>
                          <MIMETypeIdentifier>application/pdf</MIMETypeIdentifier>
                        </FOREIGN_OBJECT>
                      </DOCUMENT>
                    </EMBEDDED_FILE>
                    <IMAGE>
                      <ImageCategoryType>DwellingFront</ImageCategoryType>
                      <ImageCaptionCommentDescription>Subject front</ImageCaptionCommentDescription>
                      <ImageFileLocationIdentifier>Images/front.jpg</ImageFileLocationIdentifier>
                      <MIMETypeIdentifier>image/jpeg</MIMETypeIdentifier>
                    </IMAGE>
                    <IMAGE>
                      <ImageCategoryType>Kitchen</ImageCategoryType>
                      <ImageCaptionCommentDescription>Kitchen</ImageCaptionCommentDescription>
                      <ImageFileLocationIdentifier>Images/kitchen.jpg</ImageFileLocationIdentifier>
                      <MIMETypeIdentifier>image/jpeg</MIMETypeIdentifier>
                    </IMAGE>
                  </VALUATION_REPORT>
                </VALUATION_RESPONSE>
              </VALUATION>
            </SERVICE>
          </SERVICES>
        </DEAL>
      </DEALS>
    </DEAL_SET>
  </DEAL_SETS>
</MESSAGE>
`;

  const files = {
    'SF5_Appraisal_v1.4.xml': strToU8(xml),
  };
  if (includeSecondXml) {
    files['extra.xml'] = strToU8('<MESSAGE><DocumentType>AppraisalReport</DocumentType></MESSAGE>');
  }
  if (includePdf) {
    files[pdfName] = strToU8('%PDF-1.4 synthetic');
  }
  if (includeImages) {
    files['Images/front.jpg'] = strToU8('fake-jpeg-front');
    if (!omitReferencedImage) {
      files['Images/kitchen.jpg'] = strToU8('fake-jpeg-kitchen');
    }
  }

  return Buffer.from(zipSync(files));
}

/** Test-only: clear session map. */
export async function clearEadSessionsForTests() {
  for (const [id, meta] of sessions.entries()) {
    sessions.delete(id);
    await fs.rm(meta.dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * GSE Appendix D-1 nested packages live under fixtures/ead/appendix-d-1/ (gitignored).
 * Override with EAD_SAMPLES_DIR.
 */
export function getEadSamplesDir() {
  if (process.env.EAD_SAMPLES_DIR) return path.resolve(process.env.EAD_SAMPLES_DIR);
  return path.resolve(process.cwd(), 'fixtures', 'ead', 'appendix-d-1');
}

const SAMPLE_LABELS = [
  { id: 'sf5', match: /SF5_Appraisal/i, label: 'SF5 — Single family (typical)', recommended: true },
  { id: 'sf1', match: /SF1_Appraisal/i, label: 'SF1 — Single family 1' },
  { id: 'sf2', match: /SF2_Appraisal/i, label: 'SF2 — Single family 2' },
  { id: 'sf3', match: /SF3_Appraisal/i, label: 'SF3 — Single family 3 (ADU outbuilding)' },
  { id: 'sf4', match: /SF4_Appraisal/i, label: 'SF4 — Single family 4 (basement ADU)' },
  { id: 'condo1', match: /Condo1_Appraisal/i, label: 'Condo1 — Hybrid' },
  { id: 'condo2', match: /Condo2_Appraisal/i, label: 'Condo2 — Desktop' },
  { id: 'coop1', match: /Coop1_Appraisal/i, label: 'Coop1 — Cooperative' },
  { id: 'mh1', match: /MH1_Appraisal/i, label: 'MH1 — Manufactured' },
  { id: 'mh2', match: /MH2_Appraisal/i, label: 'MH2 — Manufactured 2' },
  { id: 'units', match: /2- to 4-unit_Appraisal\.zip$/i, label: '2–4 unit' },
  { id: 'units2', match: /2- to 4-unit_Scenario_2/i, label: '2–4 unit scenario 2' },
];

function sampleIdFromFileName(fileName) {
  for (const row of SAMPLE_LABELS) {
    if (row.match.test(fileName)) return row.id;
  }
  return fileName
    .replace(/^Appendix D-1\s+/i, '')
    .replace(/_Appraisal\.zip$/i, '')
    .replace(/[^\w]+/g, '-')
    .toLowerCase();
}

function sampleLabelFromFileName(fileName) {
  for (const row of SAMPLE_LABELS) {
    if (row.match.test(fileName)) return row.label;
  }
  return fileName.replace(/\.zip$/i, '');
}

/**
 * List local GSE Appendix D-1 scenario ZIPs.
 * @returns {Promise<{ dir: string, samples: Array<{ id: string, label: string, fileName: string, bytes: number, recommended?: boolean }> }>}
 */
export async function listEadSamples() {
  const dir = getEadSamplesDir();
  let names = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return { dir, samples: [], available: false };
  }

  const samples = [];
  for (const fileName of names) {
    if (!/\.zip$/i.test(fileName)) continue;
    if (!/Appraisal/i.test(fileName)) continue;
    const full = path.join(dir, fileName);
    let st;
    try {
      st = await fs.stat(full);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    const id = sampleIdFromFileName(fileName);
    const meta = SAMPLE_LABELS.find((r) => r.id === id);
    samples.push({
      id,
      label: sampleLabelFromFileName(fileName),
      fileName,
      bytes: st.size,
      recommended: Boolean(meta?.recommended),
    });
  }

  samples.sort((a, b) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    return a.label.localeCompare(b.label);
  });

  return { dir, samples, available: samples.length > 0 };
}

/**
 * Resolve a sample id or file name to an absolute path under the samples dir.
 * @param {string} idOrName
 * @returns {Promise<{ id: string, fileName: string, filePath: string, bytes: number }>}
 */
export async function resolveEadSample(idOrName) {
  const key = String(idOrName || '').trim();
  if (!key) {
    const err = new Error('Sample id required');
    err.code = 'SAMPLE_REQUIRED';
    throw err;
  }
  const { samples, dir } = await listEadSamples();
  const hit =
    samples.find((s) => s.id === key)
    || samples.find((s) => s.fileName === key)
    || samples.find((s) => s.fileName.toLowerCase() === key.toLowerCase());
  if (!hit) {
    const err = new Error(`Sample not found: ${key}`);
    err.code = 'SAMPLE_NOT_FOUND';
    throw err;
  }
  const filePath = path.join(dir, hit.fileName);
  // Prevent path escape even if fileName were ever tainted
  if (path.resolve(filePath) !== path.resolve(dir, path.basename(hit.fileName))) {
    const err = new Error('Invalid sample path');
    err.code = 'SAMPLE_NOT_FOUND';
    throw err;
  }
  return { id: hit.id, fileName: hit.fileName, filePath, bytes: hit.bytes };
}

/**
 * Parse a local Appendix D-1 scenario ZIP by id.
 * @param {string} idOrName
 */
export async function parseEadSample(idOrName) {
  const sample = await resolveEadSample(idOrName);
  const buffer = await fs.readFile(sample.filePath);
  const result = await parseEadAppraisalZip(buffer, { originalName: sample.fileName });
  return { ...result, sample };
}
