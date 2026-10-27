
const PizZip = require('pizzip');

const {
  DOMParser,
  XMLSerializer
} = require('@xmldom/xmldom');

const MARKER = '{{PROPOSAL_CONTENT}}';

const W_NS =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/* =====================================================
   WORD XML HELPERS
===================================================== */

function element(doc, name) {
  return doc.createElementNS(W_NS, `w:${name}`);
}

function setWordAttribute(node, name, value) {
  node.setAttributeNS(W_NS, `w:${name}`, String(value));
}

function addText(doc, paragraph, value) {
  const run = element(doc, 'r');
  const text = element(doc, 't');

  text.setAttribute(
    'xml:space',
    'preserve'
  );

  text.appendChild(
    doc.createTextNode(value)
  );

  run.appendChild(text);
  paragraph.appendChild(run);
}

function createParagraph(
  doc,
  content,
  style = 'Normal',
  bullet = false
) {
  const paragraph = element(doc, 'p');
  const properties = element(doc, 'pPr');

  const paragraphStyle = element(doc, 'pStyle');
  setWordAttribute(
    paragraphStyle,
    'val',
    style
  );

  properties.appendChild(paragraphStyle);

  if (bullet) {
    const indent = element(doc, 'ind');
    setWordAttribute(indent, 'left', '720');
    setWordAttribute(indent, 'hanging', '360');
    properties.appendChild(indent);
  }

  paragraph.appendChild(properties);

  addText(
    doc,
    paragraph,
    bullet ? `• ${content}` : content
  );

  return paragraph;
}

/* =====================================================
   FORMAT SAVED SECTION CONTENT
===================================================== */

function createSectionParagraphs(doc, section) {
  const paragraphs = [];

  paragraphs.push(
    createParagraph(
      doc,
      section.title,
      'Heading1'
    )
  );

  const lines = String(section.content || '')
    .replace(/\r\n/g, '\n')
    .split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    // Avoid duplicating the section heading.
    if (
      line.toLowerCase() ===
      String(section.title).trim().toLowerCase()
    ) {
      continue;
    }

    const bulletMatch =
      line.match(/^(?:[-•*]|\d+[.)])\s+(.+)$/);

    if (bulletMatch) {
      paragraphs.push(
        createParagraph(
          doc,
          bulletMatch[1],
          'Normal',
          true
        )
      );
      continue;
    }

    paragraphs.push(
      createParagraph(doc, line, 'Normal')
    );
  }

  return paragraphs;
}

/* =====================================================
   FIND PLACEHOLDER PARAGRAPH
===================================================== */

function getParagraphText(paragraph) {
  const textNodes =
    paragraph.getElementsByTagNameNS(
      W_NS,
      't'
    );

  let text = '';

  for (let i = 0; i < textNodes.length; i++) {
    text += textNodes.item(i).textContent || '';
  }

  return text;
}

function findMarkerParagraph(body) {
  const paragraphs =
    body.getElementsByTagNameNS(
      W_NS,
      'p'
    );

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs.item(i);

    if (getParagraphText(paragraph).includes(MARKER)) {
      return paragraph;
    }
  }

  return null;
}

/* =====================================================
   GENERATE PROPOSAL FROM WORD TEMPLATE
===================================================== */

function generateProposalDocument({
  templateBuffer,
  proposal
}) {
  if (!Buffer.isBuffer(templateBuffer)) {
    throw new Error('Word template buffer is missing.');
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

  const xml = documentFile.asText();

  const doc = new DOMParser().parseFromString(
    xml,
    'application/xml'
  );

  const body =
    doc.getElementsByTagNameNS(
      W_NS,
      'body'
    ).item(0);

  if (!body) {
    throw new Error(
      'The template has no Word document body.'
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
      'Place {{PROPOSAL_CONTENT}} in a normal body paragraph, outside tables and text boxes.'
    );
  }

  /*
   * Remove the marker and sample content following it.
   * Preserve the final section properties, which may
   * contain page setup and header/footer references.
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
      createSectionParagraphs(doc, section);

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

module.exports = {
  generateProposalDocument
};
