
const PizZip = require('pizzip');

const {
  DOMParser,
  XMLSerializer
} = require('@xmldom/xmldom');

const MARKER = '{{PROPOSAL_CONTENT}}';

const W_NS =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/* =====================================================
   XML HELPERS
===================================================== */

function element(doc, name) {
  return doc.createElementNS(W_NS, `w:${name}`);
}

function setWordAttribute(node, name, value) {
  node.setAttributeNS(W_NS, `w:${name}`, String(value));
}

function getWordAttribute(node, name) {
  return node.getAttributeNS(W_NS, name) ||
    node.getAttribute(`w:${name}`) || '';
}

function getDirectChild(parent, localName) {
  for (const child of Array.from(parent.childNodes || [])) {
    if (
      child.nodeType === 1 &&
      child.localName === localName &&
      child.namespaceURI === W_NS
    ) {
      return child;
    }
  }
  return null;
}


function parseXml(xml, filename) {
  const errors = [];

  const doc = new DOMParser({
    onError: (level, message) => {
      errors.push(`${level}: ${message}`);
    }
  }).parseFromString(xml, 'application/xml');

  if (
    errors.length ||
    doc.getElementsByTagName('parsererror').length
  ) {
    throw new Error(
      `Invalid XML in ${filename}: ${errors.join('; ')}`
    );
  }

  return doc;
}


/* =====================================================
   TEXT NORMALIZATION
===================================================== */


/* =====================================================
   TEXT NORMALIZATION
   Preserve organization typography.
   Standardize unusual hyphen characters.
===================================================== */

function normalizeText(value) {

  return String(value ?? '')
    .normalize('NFC')

    // Standardize line endings.
    .replace(/\r\n?/g, '\n')

    // Convert uncommon Unicode hyphens to ASCII hyphen.
    .replace(
      /[\u2010\u2011\u2012\u2043\u2212\uFE58\uFE63\uFF0D]/g,
      '-'
    )

    // Remove invisible soft hyphens.
    .replace(/\u00AD/g, '')

    // Remove invalid XML 1.0 control characters.
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
      ''
    )

    // Remove unpaired UTF-16 surrogates.
    .replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g,
      ''
    )
    .replace(
      /(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      ''
    );

}


function normalizeHeading(value) {
  return normalizeText(value)
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\d+(?:\.\d+)*[.)]?\s+/, '')
    .replace(/^[•*-]\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/[_*]/g, '')
    .replace(/[.:]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/* =====================================================
   WORD STYLES
===================================================== */


function readStyles(zip) {
  const styles = {
    normal: 'Normal',
    heading1: 'Heading1',
    heading2: 'Heading2',
    heading3: 'Heading3',
    bullet: null,
    evidenceGap: null,
    complianceRisk: null,
    actionRequired: null
  };

  const file = zip.file('word/styles.xml');
  if (!file) return styles;

  const doc = parseXml(file.asText(), 'word/styles.xml');

  const nodes = doc.getElementsByTagNameNS(W_NS, 'style');

  for (const node of Array.from(nodes)) {
    const id = getWordAttribute(node, 'styleId');
    const nameNode = getDirectChild(node, 'name');

    const name = nameNode
      ? getWordAttribute(nameNode, 'val').toLowerCase().trim()
      : '';

    if (name === 'normal') styles.normal = id;
    if (name === 'heading 1') styles.heading1 = id;
    if (name === 'heading 2') styles.heading2 = id;
    if (name === 'heading 3') styles.heading3 = id;

    if (
      !styles.bullet &&
      /^(list bullet|normal bullets?|bullet)$/.test(name)
    ) {
      styles.bullet = id;
    }

    if (
      name === 'evidencegap' ||
      name === 'evidence gap'
    ) {
      styles.evidenceGap = id;
    }

    if (
      name === 'compliancerisk' ||
      name === 'compliance risk'
    ) {
      styles.complianceRisk = id;
    }

    if (
      name === 'actionrequired' ||
      name === 'action required'
    ) {
      styles.actionRequired = id;
    }
  }

  return styles;
}


/* =====================================================
   BULLET NUMBERING
===================================================== */

function readBulletNumbering(zip) {
  const file = zip.file('word/numbering.xml');
  if (!file) return null;

  const doc = parseXml(file.asText(), 'word/numbering.xml');

  const abstractIds = new Set();

  const definitions =
    doc.getElementsByTagNameNS(W_NS, 'abstractNum');

  for (const abstract of Array.from(definitions)) {
    const levels =
      abstract.getElementsByTagNameNS(W_NS, 'lvl');

    for (const level of Array.from(levels)) {
      const format =
        level.getElementsByTagNameNS(W_NS, 'numFmt').item(0);

      if (
        format &&
        getWordAttribute(format, 'val') === 'bullet'
      ) {
        abstractIds.add(
          getWordAttribute(abstract, 'abstractNumId')
        );
      }
    }
  }

  const nums = doc.getElementsByTagNameNS(W_NS, 'num');

  for (const num of Array.from(nums)) {
    const ref =
      num.getElementsByTagNameNS(W_NS, 'abstractNumId')
        .item(0);

    if (
      ref &&
      abstractIds.has(getWordAttribute(ref, 'val'))
    ) {
      return {
        numId: getWordAttribute(num, 'numId'),
        level: 0
      };
    }
  }

  return null;
}

/* =====================================================
   CREATE WORD PARAGRAPH
===================================================== */

function createParagraph(doc, content, style, options = {}) {
  const paragraph = element(doc, 'p');
  const properties = element(doc, 'pPr');

  if (style) {
    const styleNode = element(doc, 'pStyle');
    setWordAttribute(styleNode, 'val', style);
    properties.appendChild(styleNode);
  }

  if (options.numbering) {
    const numPr = element(doc, 'numPr');

    const ilvl = element(doc, 'ilvl');
    setWordAttribute(
      ilvl,
      'val',
      options.numbering.level
    );

    const numId = element(doc, 'numId');
    setWordAttribute(
      numId,
      'val',
      options.numbering.numId
    );

    numPr.appendChild(ilvl);
    numPr.appendChild(numId);
    properties.appendChild(numPr);
  }

  if (options.keepWithNext) {
    properties.appendChild(element(doc, 'keepNext'));
  }

  paragraph.appendChild(properties);

  const run = element(doc, 'r');
  const text = element(doc, 't');

  text.setAttribute('xml:space', 'preserve');
  text.appendChild(
    doc.createTextNode(normalizeText(content))
  );

  run.appendChild(text);
  paragraph.appendChild(run);

  return paragraph;
}

/* =====================================================
   CLASSIFY PROPOSAL TEXT
===================================================== */

function classifyLine(line, nextLine, styles) {
  const text = line.trim();
  if (!text) return null;

const flagMatch = text.match(
  /^(?:\*\*)?(EVIDENCE GAP|COMPLIANCE RISK|ACTION REQUIRED)(?:\*\*)?\s*:\s*(.+)$/i
);

if (flagMatch) {
  const flagTypes = {
    'EVIDENCE GAP': 'evidenceGap',
    'COMPLIANCE RISK': 'complianceRisk',
    'ACTION REQUIRED': 'actionRequired'
  };

  return {
    type: 'flag',
    flagType: flagTypes[flagMatch[1].toUpperCase()],
    text: `${flagMatch[1].toUpperCase()}: ${flagMatch[2].trim()}`
  };
}

  const markdownHeading =
    text.match(/^(#{1,6})\s+(.+)$/);

  if (markdownHeading) {
    return {
      type: 'heading',
      level: Math.min(markdownHeading[1].length + 1, 3),
      text: markdownHeading[2].trim()
    };
  }

  const bullet =
    text.match(/^(?:[•*-])\s+(.+)$/);

  if (bullet) {
    return {
      type: 'bullet',
      text: bullet[1].trim()
    };
  }

  const numberedHeading =
    text.match(/^(\d+(?:\.\d+)+)\s+(.+)$/);

  if (numberedHeading) {
    return {
      type: 'heading',
      level: numberedHeading[1].split('.').length >= 3
        ? 3
        : 2,
      text
    };
  }

  const wordCount = text.split(/\s+/).length;

  const looksLikeHeading =
    wordCount <= 10 &&
    text.length <= 90 &&
    !/[.!?;:]$/.test(text) &&
    Boolean(nextLine && nextLine.trim()) &&
    !/^[-•*]/.test(text) &&
    !/^\d+[.)]\s/.test(text);

  if (looksLikeHeading) {
    return {
      type: 'heading',
      level: 2,
      text
    };
  }

  return {
    type: 'body',
    text
  };
}

/* =====================================================
   BUILD SAVED PROPOSAL SECTION
===================================================== */

function createSectionParagraphs(
  doc,
  section,
  styles,
  bulletNumbering
) {
  const paragraphs = [];

  paragraphs.push(
    createParagraph(
      doc,
      section.title,
      styles.heading1,
      { keepWithNext: true }
    )
  );

  const lines = normalizeText(section.content).split('\n');
  let firstContentLine = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const nextLine =
      lines.slice(i + 1).find(value => value.trim()) || '';

    if (
      firstContentLine &&
      normalizeHeading(line) ===
        normalizeHeading(section.title)
    ) {
      continue;
    }

    firstContentLine = false;

    const classified =
      classifyLine(line, nextLine, styles);

    if (!classified) continue;

if (classified.type === 'flag') {
  paragraphs.push(
    createParagraph(
      doc,
      classified.text,
      styles[classified.flagType] || styles.normal
    )
  );
  continue;
}

    if (classified.type === 'heading') {
      paragraphs.push(
        createParagraph(
          doc,
          classified.text,
          classified.level === 3
            ? styles.heading3
            : styles.heading2,
          { keepWithNext: true }
        )
      );
      continue;
    }

    if (classified.type === 'bullet') {
      paragraphs.push(
        createParagraph(
          doc,
          classified.text,
          styles.bullet || styles.normal,
          { numbering: bulletNumbering }
        )
      );
      continue;
    }

    paragraphs.push(
      createParagraph(
        doc,
        classified.text,
        styles.normal
      )
    );
  }

  return paragraphs;
}

/* =====================================================
   METADATA PLACEHOLDERS
===================================================== */

function formatSubmissionDate(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  // Date only. The stored deadline may have a time zone.
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

function buildMetadata(proposal) {
  return {
    '{{proposalName}}':
      normalizeText(proposal.proposalName),

    '{{clientName}}':
      normalizeText(proposal.clientName),

    '{{rfpNumber}}':
      normalizeText(proposal.rfpNumber),

    '{{submissionDeadline}}':
      formatSubmissionDate(proposal.submissionDeadline),

    '{{proposalManager}}':
      normalizeText(proposal.proposalManager?.name)
  };
}

/* =====================================================
   REPLACE PLACEHOLDERS IN WORD PARAGRAPHS

   Handles placeholders divided across multiple text runs.
   Preserves the surrounding paragraph, table and run
   formatting. The replacement inherits formatting from
   the first text run containing the placeholder.
===================================================== */

function replaceTextInParagraph(paragraph, replacements) {
  const nodes = Array.from(
    paragraph.getElementsByTagNameNS(W_NS, 't')
  );

  if (!nodes.length) return;

  for (const [placeholder, replacement] of
    Object.entries(replacements)) {

    let text = nodes.map(node => node.textContent || '').join('');
    let position = text.indexOf(placeholder);

    while (position !== -1) {
      let cursor = 0;
      let startIndex = -1;
      let endIndex = -1;
      let startOffset = 0;
      let endOffset = 0;

      for (let i = 0; i < nodes.length; i++) {
        const length = (nodes[i].textContent || '').length;

        if (
          startIndex === -1 &&
          position >= cursor &&
          position < cursor + length
        ) {
          startIndex = i;
          startOffset = position - cursor;
        }

        if (
          startIndex !== -1 &&
          position + placeholder.length <= cursor + length
        ) {
          endIndex = i;
          endOffset = position + placeholder.length - cursor;
          break;
        }

        cursor += length;
      }

      if (startIndex === -1 || endIndex === -1) break;

      const first = nodes[startIndex];
      const last = nodes[endIndex];

      const firstText = first.textContent || '';
      const lastText = last.textContent || '';

      const before = firstText.slice(0, startOffset);
      const after = lastText.slice(endOffset);

      if (startIndex === endIndex) {
        first.textContent =
          before + String(replacement) + after;
      } else {
        first.textContent =
          before + String(replacement);

        for (let i = startIndex + 1; i < endIndex; i++) {
          nodes[i].textContent = '';
        }

        last.textContent = after;
      }

      text = nodes.map(node => node.textContent || '').join('');
      position = text.indexOf(
        placeholder,
        position + String(replacement).length
      );
    }
  }
}

function replaceMetadataInDocument(doc, replacements) {
  const paragraphs = Array.from(
    doc.getElementsByTagNameNS(W_NS, 'p')
  );

  for (const paragraph of paragraphs) {
    replaceTextInParagraph(paragraph, replacements);
  }
}

/* =====================================================
   FIND MAIN PROPOSAL CONTENT MARKER
===================================================== */

function findMarkerParagraph(body) {
  const paragraphs = Array.from(
    body.getElementsByTagNameNS(W_NS, 'p')
  );

  return paragraphs.find(paragraph => {
    const text = Array.from(
      paragraph.getElementsByTagNameNS(W_NS, 't')
    )
      .map(node => node.textContent || '')
      .join('');

    return text.includes(MARKER);
  }) || null;
}

/* =====================================================
   INSERT PROPOSAL CONTENT

   Replace only the marker paragraph.
   Preserve all subsequent template content.
===================================================== */

function insertProposalContent(
  doc,
  body,
  sections,
  styles,
  bulletNumbering
) {
  const markerParagraph = findMarkerParagraph(body);

  if (!markerParagraph) {
    throw new Error(
      'The template does not contain {{PROPOSAL_CONTENT}}.'
    );
  }

  if (markerParagraph.parentNode !== body) {
    throw new Error(
      'Place {{PROPOSAL_CONTENT}} in a normal body paragraph.'
    );
  }

  const markerText = Array.from(
    markerParagraph.getElementsByTagNameNS(W_NS, 't')
  )
    .map(node => node.textContent || '')
    .join('')
    .trim();

  if (markerText !== MARKER) {
    throw new Error(
      '{{PROPOSAL_CONTENT}} must be alone in its paragraph.'
    );
  }

  for (const section of sections) {
    const paragraphs = createSectionParagraphs(
      doc,
      section,
      styles,
      bulletNumbering
    );

    for (const paragraph of paragraphs) {
      body.insertBefore(paragraph, markerParagraph);
    }
  }

  body.removeChild(markerParagraph);
}

/* =====================================================
   GENERATE PROPOSAL DOCUMENT
===================================================== */

function generateProposalDocument({
  templateBuffer,
  proposal
} = {}) {
  if (!Buffer.isBuffer(templateBuffer)) {
    throw new Error(
      'Word template buffer is missing.'
    );
  }

  if (!proposal || typeof proposal !== 'object') {
    throw new Error(
      'Proposal data is missing.'
    );
  }


  const sections = (
    Array.isArray(proposal.contentSections)
      ? proposal.contentSections
      : []
  )
    .filter(section =>
      section &&
      typeof section.content === 'string' &&
      section.content.trim().length > 0
    )
    .map(section => ({
      title: normalizeText(section.title || 'Untitled Section'),
      content: normalizeText(section.content)
    }));

  if (!sections.length) {
    throw new Error(
      'The proposal has no saved written sections to assemble.'
    );
  }

  let zip;

  try {
    zip = new PizZip(templateBuffer);
  } catch (error) {
    throw new Error(
      `Unable to open Word template: ${error.message}`
    );
  }

  const documentFile = zip.file('word/document.xml');

  if (!documentFile) {
    throw new Error(
      'The uploaded template is not a valid Word DOCX document.'
    );
  }

  const doc = parseXml(
    documentFile.asText(),
    'word/document.xml'
  );

  const body = doc.getElementsByTagNameNS(
    W_NS,
    'body'
  ).item(0);

  if (!body) {
    throw new Error(
      'The Word template does not contain a document body.'
    );
  }

  // Read paragraph styles and numbering from the template.
  const styles = readStyles(zip);
  const bulletNumbering = readBulletNumbering(zip);

  // Replace proposal metadata throughout the main document.
  const metadata = buildMetadata(proposal);

  replaceMetadataInDocument(doc, metadata);

  // Insert the saved proposal sections at the content marker.
  insertProposalContent(
    doc,
    body,
    sections,
    styles,
    bulletNumbering
  );

  // Save the modified main document XML.
  const serializer = new XMLSerializer();

  zip.file(
    'word/document.xml',
    serializer.serializeToString(doc)
  );

  // Replace metadata in headers and footers, if present.
  const auxiliaryFiles = Object.keys(zip.files)
    .filter(filename =>
      /^word\/(?:header|footer)\d+\.xml$/.test(filename)
    );

  for (const filename of auxiliaryFiles) {
    const file = zip.file(filename);
    if (!file) continue;

    const auxiliaryDoc = parseXml(
      file.asText(),
      filename
    );

    replaceMetadataInDocument(
      auxiliaryDoc,
      metadata
    );

    zip.file(
      filename,
      serializer.serializeToString(auxiliaryDoc)
    );
  }

  // Generate the completed Word document as a Buffer.
  return zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6
    }
  });
}

module.exports = {
  generateProposalDocument
};
