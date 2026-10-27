
const mongoose = require('mongoose');

const Proposal = require(
  '../models/proposal'
);

const ProposalTemplate = require(
  '../models/proposalTemplate'
);

const cloudinary = require(
  '../config/cloudinary'
);

const {
  generateProposalDocument
} = require(
  '../services/proposalDocumentService'
);

const MAX_TEMPLATE_BYTES =
  25 * 1024 * 1024;

/* =====================================================
   DOWNLOAD AUTHENTICATED TEMPLATE
===================================================== */

async function downloadTemplate(template) {
  const url =
    cloudinary.utils.private_download_url(
      template.cloudinaryPublicId,
      null,
      {
        resource_type: 'raw',
        type: 'authenticated',
        expires_at:
          Math.floor(Date.now() / 1000) + 300
      }
    );

  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(
      `Cloudinary template download failed: ${response.status}`
    );
  }

  const declaredLength =
    Number(response.headers.get('content-length') || 0);

  if (declaredLength > MAX_TEMPLATE_BYTES) {
    throw new Error('Template exceeds download size limit.');
  }

  const chunks = [];
  let total = 0;

  for await (const chunk of response.body) {
    total += chunk.length;

    if (total > MAX_TEMPLATE_BYTES) {
      throw new Error('Template exceeds download size limit.');
    }

    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

/* =====================================================
   GENERATE WORD DOCUMENT
===================================================== */

exports.postGenerateProposalDocument =
  async (req, res) => {

    try {
      const organizationId =
        req.session?.organizationId;

      const pursuitId =
        typeof req.body?.pursuitId === 'string'
          ? req.body.pursuitId.trim()
          : '';

      if (!organizationId) {
        return res.status(401).send(
          'Please log in before generating a proposal.'
        );
      }

      if (!mongoose.isValidObjectId(pursuitId)) {
        return res.status(400).send(
          'A valid pursuit is required.'
        );
      }

      const proposal = await Proposal.findOne({
        _id: pursuitId,
        organization: organizationId
      }).lean();

      if (!proposal) {
        return res.status(404).send(
          'The requested pursuit was not found.'
        );
      }

      const template =
        await ProposalTemplate.findOne({
          organization: organizationId,
          isActive: true
        })
          .sort({ createdAt: -1 })
          .lean();

      if (!template) {
        return res.status(400).send(
          'Upload an organization proposal template first.'
        );
      }

      const templateBuffer =
        await downloadTemplate(template);

      const documentBuffer =
        generateProposalDocument({
          templateBuffer,
          proposal
        });

      const safeName =
        String(proposal.rfpNumber || 'proposal')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 70);

      const filename =
        `TOMA_Proposal_${safeName}.docx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );

      res.setHeader(
        'Cache-Control',
        'no-store'
      );

      return res.status(200).send(documentBuffer);

    } catch (error) {
      console.error(
        'GENERATE PROPOSAL DOCUMENT FAILED:',
        error
      );

      return res.status(500).send(
        'Sasha could not generate the Word document. Check the Railway logs for details.'
      );
    }
  };
