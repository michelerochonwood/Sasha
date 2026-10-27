
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
  node.setAttributeNS(
    W_NS,
    `w:${name}`,
    String(value)
  );
}

function getWordAttribute(node, name) {
  return node.getAttributeNS(W_NS, name) ||
    node.getAttribute(`w:${name}`) ||
    '';
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

/* =====================================================
   TEXT NORMALIZATION
===================================================== */

function normalizeText(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(
      /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g,
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
   READ WORD STYLES
===================================================== */

function readStyles(zip) {
  const stylesFile = zip.file('word/styles.xml');

  const styles = {
    normal: 'Normal',
    heading1: 'Heading1',
    heading2: 'Heading2',
    heading3: 'Heading3',
    bullet: null
  };

  if (!stylesFile) {
    return styles;
  }

  const doc = new DOMParser().parseFromString(
    stylesFile.asText(),
    'application/xml'
  );

  const styleNodes =
    doc.getElementsByTagNameNS(W_NS, 'style');

  for (const node of Array.from(styleNodes)) {
    const styleId =
      getWordAttribute(node, 'styleId');

    const nameNode =
      getDirectChild(node, 'name');

    const styleName =
      nameNode
        ? getWordAttribute(nameNode, 'val')
        : '';

    const normalized =
      styleName.toLowerCase().trim();

    if (normalized === 'normal') {
      styles.normal = styleId;
    }

    if (normalized === 'heading 1') {
      styles.heading1 = styleId;
    }

    if (normalized === 'heading 2') {
      styles.heading2 = styleId;
    }

    if (normalized === 'heading 3') {
      styles.heading3 = styleId;
    }

    if (
      !styles.bullet &&
      /^(list bullet|normal bullets?|bullet)$/.test(normalized)
    ) {
      styles.bullet = styleId;
    }
  }

  return styles;
}

/* =====================================================
   READ WORD NUMBERING DEFINITIONS
===================================================== */

function readBulletNumbering(zip) {
  const file = zip.file('word/numbering.xml');

  if (!file) {
    return null;
  }

  const doc = new DOMParser().parseFromString(
    file.asText(),
    'application/xml'
  );

  const abstractDefinitions =
    doc.getElementsByTagNameNS(
      W_NS,
      'abstractNum'
    );

  const bulletAbstractIds = new Set();

  for (const abstract of Array.from(abstractDefinitions)) {
    const levels =
      abstract.getElementsByTagNameNS(W_NS, 'lvl');

    for (const level of Array.from(levels)) {
      const format =
        level.getElementsByTagNameNS(
          W_NS,
          'numFmt'
        ).item(0);

      if (
        format &&
        getWordAttribute(format, 'val') === 'bullet'
      ) {
        bulletAbstractIds.add(
          getWordAttribute(abstract, 'abstractNumId')
        );
      }
    }
  }

  const nums =
    doc.getElementsByTagNameNS(W_NS, 'num');

  for (const num of Array.from(nums)) {
    const abstractRef =
      num.getElementsByTagNameNS(
        W_NS,
        'abstractNumId'
      ).item(0);

    if (
      abstractRef &&
      bulletAbstractIds.has(
        getWordAttribute(abstractRef, 'val')
      )
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
   CREATE WORD PARAGRAPHS
===================================================== */

function createParagraph(
  doc,
  content,
  style,
  options = {}
) {
  const paragraph = element(doc, 'p');
  const properties = element(doc, 'pPr');

  if (style) {
    const styleNode = element(doc, 'pStyle');

    setWordAttribute(
      styleNode,
      'val',
      style
    );

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
    properties.appendChild(
      element(doc, 'keepNext')
    );
  }

  paragraph.appendChild(properties);

  const run = element(doc, 'r');
  const text = element(doc, 't');

  text.setAttribute(
    'xml:space',
    'preserve'
  );

  text.appendChild(
    doc.createTextNode(normalizeText(content))
  );

  run.appendChild(text);
  paragraph.appendChild(run);

  return paragraph;
}

/* =====================================================
   CLASSIFY CONTENT LINES
===================================================== */

function classifyLine(line, nextLine, styles) {
  const text = line.trim();

  if (!text) {
    return null;
  }

  const markdownHeading =
    text.match(/^(#{1,6})\s+(.+)$/);

  if (markdownHeading) {
    const depth = markdownHeading[1].length;

    return {
      type: 'heading',
      level: Math.min(depth + 1, 3),
      text: markdownHeading[2].trim()
    };
  }

  const bulletMatch =
    text.match(/^(?:[•*-]|\u2022)\s+(.+)$/);

  if (bulletMatch) {
    return {
      type: 'bullet',
      text: bulletMatch[1].trim()
    };
  }

  const numberedHeading =
    text.match(/^(\d+(?:\.\d+)+)\s+(.+)$/);

  if (numberedHeading) {
    return {
      type: 'heading',
      level:
        numberedHeading[1].split('.').length >= 3
          ? 3
          : 2,
      text
    };
  }

  /*
   * Conservative heading detection.
   *
   * Short standalone lines without sentence-ending
   * punctuation are treated as subsection headings.
   */

  const wordCount =
    text.split(/\s+/).length;

  const nextHasContent =
    Boolean(nextLine && nextLine.trim());

  const looksLikeHeading =
    wordCount <= 10 &&
    text.length <= 90 &&
    !/[.!?;:]$/.test(text) &&
    nextHasContent &&
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
   BUILD SECTION PARAGRAPHS
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

  const lines =
    normalizeText(section.content)
      .split('\n');

  let firstContentLine = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      continue;
    }

    const nextLine =
      lines.slice(i + 1).find(
        value => value.trim()
      ) || '';

    /*
     * Skip duplicate section headings,
     * including headings with numbering or Markdown.
     */

    if (
      firstContentLine &&
      normalizeHeading(line) ===
      normalizeHeading(section.title)
    ) {
      continue;
    }

    firstContentLine = false;

    const classified =
      classifyLine(
        line,
        nextLine,
        styles
      );

    if (!classified) {
      continue;
    }

    if (classified.type === 'heading') {
      const style =
        classified.level === 3
          ? styles.heading3
          : styles.heading2;

      paragraphs.push(
        createParagraph(
          doc,
          classified.text,
          style,
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
          {
            numbering: bulletNumbering
          }
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
   FIND TEMPLATE INSERTION POINT
===================================================== */

function getParagraphText(paragraph) {
  const textNodes =
    paragraph.getElementsByTagNameNS(
      W_NS,
      't'
    );

  return Array.from(textNodes)
    .map(node => node.textContent || '')
    .join('');
}

function findMarkerParagraph(body) {
  const paragraphs =
    body.getElementsByTagNameNS(
      W_NS,
      'p'
    );

  for (const paragraph of Array.from(paragraphs)) {
    if (
      getParagraphText(paragraph).includes(MARKER)
    ) {
      return paragraph;
    }
  }

  return null;
}

/* =====================================================
   GENERATE PROPOSAL DOCUMENT
===================================================== */

function generateProposalDocument({
  templateBuffer,
  proposal
}) {
  if (!Buffer.isBuffer(templateBuffer)) {
    throw new Error(
      'Word template buffer is missing.'
    );
  }

  const sections = (
    Array.isArray(proposal.contentSections)
      ? proposal.contentSections
      : []
  )
    .filter(section =>
      typeof section.content === 'string' &&
      section.content.trim()
    )
    .sort((a, b) =>
      Number(a.order || 0) -
      Number(b.order || 0)
    );

  if (!sections.length) {
    throw new Error(
      'This pursuit has no saved proposal sections.'
    );
  }

  const zip = new PizZip(templateBuffer);

  const documentFile =
    zip.file('word/document.xml');

  if (!documentFile) {
    throw new Error(
      'The template is missing word/document.xml.'
    );
  }

  const styles = readStyles(zip);

  const bulletNumbering =
    readBulletNumbering(zip);

  const doc = new DOMParser().parseFromString(
    documentFile.asText(),
    'application/xml'
  );

  const body =
    doc.getElementsByTagNameNS(
      W_NS,
      'body'
    ).item(0);

  if (!body) {
    throw new Error(
      'The Word template has no document body.'
    );
  }

  const markerParagraph =
    findMarkerParagraph(body);

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

  /*
   * Remove the marker and subsequent sample content,
   * preserving final section properties.
   */

  let node = markerParagraph;

  while (node) {
    const next = node.nextSibling;

    if (
      node.nodeType === 1 &&
      node.localName === 'sectPr' &&
      node.namespaceURI === W_NS
    ) {
      break;
    }

    body.removeChild(node);
    node = next;
  }

  const sectionProperties =
    Array.from(body.childNodes).find(
      child =>
        child.nodeType === 1 &&
        child.localName === 'sectPr' &&
        child.namespaceURI === W_NS
    ) || null;

  for (const section of sections) {
    const paragraphs =
      createSectionParagraphs(
        doc,
        section,
        styles,
        bulletNumbering
      );

    for (const paragraph of paragraphs) {
      body.insertBefore(
        paragraph,
        sectionProperties
      );
    }
  }

  zip.file(
    'word/document.xml',
    new XMLSerializer().serializeToString(doc)
  );

  return zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
}



/* =====================================================
   EXPORT SERVICE FUNCTIONS
===================================================== */



module.exports = {
  generateProposalDocument,
  normalizeText,
  normalizeHeading,
  classifyLine
};

