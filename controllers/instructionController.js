  const crypto = require(
  'crypto'
);

const {
  toFile
} = require(
  'openai'
);

const InstructionResource = require(
  '../models/instruction_resource'
);

const Organization = require(
  '../models/organization'
);

const sashaAiService = require(
  '../services/sashaAiService'
);

const cloudinary = require(
  '../config/cloudinary'
);



/* =====================================================
   CONSTANTS
===================================================== */

const ANALYSIS_EXPIRY =
  60 * 60 * 1000;


const ALLOWED_USE_TYPES = [
  'standing instruction',
  'organizational context',
  'writing or branding reference',
  'searchable background material',
  'specific task or project'
];


const ALLOWED_RESOURCE_CATEGORIES = [
  'strategic or business plan',
  'branding or writing guideline',
  'proposal or qualifications document',
  'RFP or RFQ',
  'historic project information',
  'client or market intelligence',
  'technical standard or procedure',
  'lessons learned or closeout material',
  'performance or evidence report',
  'template or approved example',
  'other'
];


/* =====================================================
   DOCUMENT ANALYSIS INSTRUCTIONS
===================================================== */

const documentAnalysisInstructions = `
You are Sasha, an AI assistant specializing in proposal
development, pursuit strategy, proposal planning, proposal
writing, review, and organizational proposal knowledge for
technical consulting firms.

Review the uploaded documents and prepare suggestions for
an instruction-resource form.

Base every suggestion only on information visible in the
uploaded documents.

Do not invent document ownership, dates, clients,
disciplines, markets, regions, instructions, limitations,
or document purpose.

Use null when information is unavailable.

Suggest how the resource could help Sasha, but do not decide:

- its formal authority level
- its confidentiality
- whether it is approved for proposals
- whether it is approved for public use

Those decisions must be made by a person.

For useType, return exactly one of:

- standing instruction
- organizational context
- writing or branding reference
- searchable background material
- specific task or project

For resourceCategory, return exactly one of:

- strategic or business plan
- branding or writing guideline
- proposal or qualifications document
- RFP or RFQ
- historic project information
- client or market intelligence
- technical standard or procedure
- lessons learned or closeout material
- performance or evidence report
- template or approved example
- other

Keep the resource description factual and concise.

Usage instructions should explain when and how Sasha should
consult the resource.

Limitations should identify cautions supported by the
document, including outdated dates, draft status, pricing,
confidential material, pursuit-specific information, or
uncertain authority.

Return only the requested structured data.
`;


/* =====================================================
   STRUCTURED ANALYSIS FORMAT
===================================================== */

const documentAnalysisFormat = {
  type:
    'json_schema',

  name:
    'instruction_resource_suggestions',

  strict:
    true,

  schema: {
    type:
      'object',

    additionalProperties:
      false,

    properties: {

      resourceTitle: {
        type: [
          'string',
          'null'
        ]
      },

      resourceCategory: {
        type: [
          'string',
          'null'
        ],

        enum: [
          ...ALLOWED_RESOURCE_CATEGORIES,
          null
        ]
      },

      documentOwner: {
        type: [
          'string',
          'null'
        ]
      },

      resourceDescription: {
        type: [
          'string',
          'null'
        ]
      },

      useType: {
        type: [
          'string',
          'null'
        ],

        enum: [
          ...ALLOWED_USE_TYPES,
          null
        ]
      },

      usageInstructions: {
        type: [
          'string',
          'null'
        ]
      },

      limitations: {
        type: [
          'string',
          'null'
        ]
      },

      relevantMarketSector: {
        type: [
          'string',
          'null'
        ]
      },

      relevantDiscipline: {
        type: [
          'string',
          'null'
        ]
      },

      relevantClient: {
        type: [
          'string',
          'null'
        ]
      },

      relevantRegion: {
        type: [
          'string',
          'null'
        ]
      },

      resourceKeywords: {
        type:
          'array',

        items: {
          type:
            'string'
        }
      }
    },

    required: [
      'resourceTitle',
      'resourceCategory',
      'documentOwner',
      'resourceDescription',
      'useType',
      'usageInstructions',
      'limitations',
      'relevantMarketSector',
      'relevantDiscipline',
      'relevantClient',
      'relevantRegion',
      'resourceKeywords'
    ]
  }
};

/* =====================================================
   CREATE OPENAI FILE
===================================================== */

async function createOpenAiFile(
  client,
  uploadedFile
) {

  const openAiUpload =
    await toFile(
      uploadedFile.buffer,
      uploadedFile.originalname,
      {
        type:
          uploadedFile.mimetype
      }
    );


  return client.files.create(
    {
      file:
        openAiUpload,

      purpose:
        'assistants'
    }
  );

}

/* =====================================================
   CREATE OPENAI INPUT ITEMS
===================================================== */

function createDocumentInput(
  openAiFiles
) {

  const content = [
    {
      type:
        'input_text',

      text:
        'Review the attached resource files and prepare the instruction-resource form suggestions.'
    }
  ];


  openAiFiles.forEach(
    (file) => {

      content.push(
        {
          type:
            'input_file',

          file_id:
            file.id
        }
      );

    }
  );


  return [
    {
      role:
        'user',

      content
    }
  ];

}

/* =====================================================
   REMOVE EXPIRED ANALYSIS RECORDS
===================================================== */

function removeExpiredAnalyses(
  req
) {

  if (
    !req.session.instructionAnalyses ||
    typeof req.session.instructionAnalyses !==
      'object'
  ) {

    req.session.instructionAnalyses =
      {};

    return;

  }


  const currentTime =
    Date.now();


  Object.entries(
    req.session.instructionAnalyses
  ).forEach(
    ([token, analysis]) => {

      if (
        !analysis.expiresAt ||
        analysis.expiresAt <
          currentTime
      ) {

        delete req.session
          .instructionAnalyses[token];

      }

    }
  );

}
/* =====================================================
   GET ADD INSTRUCTIONS
===================================================== */

exports.getAddInstructions =
(
  req,
  res
) => {

  return res.render(
    'add_instructions',
    {
      layout:
        'mainlayout',

      pageTitle:
        'Add Instructions | Sasha',

      csrfToken:
        req.csrfToken
          ? req.csrfToken()
          : null
    }
  );

};




/* =====================================================
   ANALYZE INSTRUCTION RESOURCE
===================================================== */

exports.analyzeInstruction =
async (
  req,
  res
) => {

  try {

    const organizationId =
      req.session.organizationId;


    if (!organizationId) {

      return res.status(401).json(
        {
          success:
            false,

          errorMessage:
            'Please log in before asking Sasha to review a document.'
        }
      );

    }


    if (
      !Array.isArray(req.files) ||
      req.files.length === 0
    ) {

      return res.status(400).json(
        {
          success:
            false,

          errorMessage:
            'Select at least one file before asking Sasha to prepare the form.'
        }
      );

    }


    const client =
      sashaAiService.createClient(
        process.env.OPENAI_API_KEY
      );


    const openAiFiles =
      await Promise.all(
        req.files.map(
          (uploadedFile) =>
            createOpenAiFile(
              client,
              uploadedFile
            )
        )
      );


    const response =
      await client.responses.create(
        {
          model:
            'gpt-5-mini',

          reasoning: {
            effort:
              'minimal'
          },

          instructions:
            documentAnalysisInstructions,

          input:
            createDocumentInput(
              openAiFiles
            ),

          text: {
            format:
              documentAnalysisFormat
          },

          max_output_tokens:
            1600
        }
      );


    const outputText =
      response.output_text ||
      '';


    if (!outputText) {

      throw new Error(
        'OpenAI returned an empty document analysis.'
      );

    }


    let suggestions;


    try {

      suggestions =
        JSON.parse(
          outputText
        );

    } catch (
      parseError
    ) {

      throw new Error(
        'OpenAI returned invalid document-analysis JSON.'
      );

    }


    removeExpiredAnalyses(
      req
    );


    const analysisToken =
      crypto
        .randomBytes(24)
        .toString('hex');


    req.session.instructionAnalyses[
      analysisToken
    ] = {
      organizationId:
        organizationId.toString(),

      expiresAt:
        Date.now() +
        ANALYSIS_EXPIRY,

      files:
        openAiFiles.map(
          (
            openAiFile,
            index
          ) => ({
            openAiFileId:
              openAiFile.id,

            originalFilename:
              req.files[index]
                .originalname,

            mimeType:
              req.files[index]
                .mimetype,

            fileSize:
              req.files[index]
                .size
          })
        )
    };


    return res.status(200).json(
      {
        success:
          true,

        analysisToken,

        suggestions
      }
    );

  } catch (
    error
  ) {

    console.error(
      'INSTRUCTION FILE ANALYSIS FAILED:',
      error
    );


    return res.status(500).json(
      {
        success:
          false,

        errorMessage:
          'Sasha could not review the uploaded document. Please try again.'
      }
    );

  }

};

/* =====================================================
   UPLOAD RESOURCE TO CLOUDINARY
===================================================== */

function uploadResourceToCloudinary(
  uploadedFile,
  organizationId
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const uploadStream =
        cloudinary.uploader.upload_stream(
          {
            resource_type:
              'raw',

            type:
              'authenticated',

            folder:
              `sasha/${organizationId}/instruction-resources`,

            use_filename:
              true,

            unique_filename:
              true,

            overwrite:
              false
          },

          (
            error,
            result
          ) => {

            if (error) {

              return reject(
                error
              );

            }


            return resolve(
              result
            );

          }
        );


      uploadStream.end(
        uploadedFile.buffer
      );

    }
  );

}

/* =====================================================
   GET CACHED OPENAI FILE
===================================================== */

function findCachedOpenAiFile(
  req,
  uploadedFile
) {

  const analysisToken =
    typeof req.body
      .instructionAnalysisToken ===
      'string'
      ? req.body
          .instructionAnalysisToken
          .trim()
      : '';


  if (
    !analysisToken ||
    !req.session
      .instructionAnalyses
  ) {

    return null;

  }


  const analysis =
    req.session
      .instructionAnalyses[
        analysisToken
      ];


  if (!analysis) {

    return null;

  }


  if (
    analysis.organizationId !==
    req.session.organizationId
      .toString()
  ) {

    return null;

  }


  if (
    !analysis.expiresAt ||
    analysis.expiresAt <
      Date.now()
  ) {

    delete req.session
      .instructionAnalyses[
        analysisToken
      ];

    return null;

  }


  return analysis.files.find(
    (cachedFile) => {

      return (
        cachedFile.originalFilename ===
          uploadedFile.originalname &&
        cachedFile.mimeType ===
          uploadedFile.mimetype &&
        cachedFile.fileSize ===
          uploadedFile.size
      );

    }
  ) || null;

}

/* =====================================================
   GET OR CREATE VECTOR STORE
===================================================== */

async function getOrCreateVectorStore(
  client,
  organization
) {

  if (
    organization.aiSettings
      ?.vectorStoreId
  ) {

    return organization
      .aiSettings
      .vectorStoreId;

  }


  organization.aiSettings =
    organization.aiSettings ||
    {};


  organization.aiSettings
    .vectorStoreStatus =
      'creating';

  organization.aiSettings
    .vectorStoreError =
      null;


  await organization.save();


  try {

    const vectorStore =
      await client.vectorStores.create(
        {
          name:
            `Sasha Knowledge Base - ${organization.organizationName}`
        }
      );


    organization.aiSettings
      .vectorStoreId =
        vectorStore.id;

    organization.aiSettings
      .vectorStoreStatus =
        'ready';

    organization.aiSettings
      .vectorStoreCreatedAt =
        new Date();

    organization.aiSettings
      .vectorStoreLastUpdatedAt =
        new Date();

    organization.aiSettings
      .vectorStoreError =
        null;


    await organization.save();


    return vectorStore.id;

  } catch (
    error
  ) {

    organization.aiSettings
      .vectorStoreStatus =
        'error';

    organization.aiSettings
      .vectorStoreError =
        error.message;


    await organization.save();


    throw error;

  }

}

/* =====================================================
   MAP VECTOR STORE STATUS
===================================================== */

function mapVectorStoreStatus(
  vectorStoreFile
) {

  if (
    vectorStoreFile.status ===
    'completed'
  ) {

    return 'ready';

  }


  if (
    vectorStoreFile.status ===
      'failed' ||
    vectorStoreFile.status ===
      'cancelled'
  ) {

    return 'failed';

  }


  return 'processing';

}

/* =====================================================
   PARSE KEYWORDS
===================================================== */

function parseKeywords(
  value
) {

  if (
    Array.isArray(
      value
    )
  ) {

    return value
      .map(
        (keyword) =>
          String(
            keyword
          ).trim()
      )
      .filter(
        Boolean
      );

  }


  if (
    typeof value !==
    'string'
  ) {

    return [];

  }


  return value
    .split(
      ','
    )
    .map(
      (keyword) =>
        keyword.trim()
    )
    .filter(
      Boolean
    );

}

/* =====================================================
   PREPARE RESOURCE DATA
===================================================== */

function prepareResourceData(
  req
) {

  return {
    resourceTitle:
      req.body.resourceTitle,

    resourceCategory:
      req.body.resourceCategory,

    documentOwner:
      req.body.documentOwner,

    resourceDescription:
      req.body.resourceDescription,

    useType:
      req.body.useType,

    usageInstructions:
      req.body.usageInstructions,

    limitations:
      req.body.limitations,

    relevantMarketSector:
      req.body
        .relevantMarketSector,

    relevantDiscipline:
      req.body
        .relevantDiscipline,

    relevantClient:
      req.body.relevantClient,

    relevantRegion:
      req.body.relevantRegion,

    resourceKeywords:
      parseKeywords(
        req.body.resourceKeywords
      ),

    authorityLevel:
      req.body.authorityLevel,

    confidentiality:
      req.body.confidentiality,

    effectiveDate:
      req.body.effectiveDate ||
      undefined,

    reviewDate:
      req.body.reviewDate ||
      undefined,

    status:
      'active',

    processedByPhil:
      false,

    organization:
      req.session.organizationId
  };

}





/* =====================================================
   POST ADD INSTRUCTIONS
===================================================== */

exports.postAddInstructions =
async (
  req,
  res
) => {

  try {

    const organizationId =
      req.session.organizationId;


    if (!organizationId) {

      return res.status(401).render(
        'add_instructions',
        {
          layout:
            'mainlayout',

          pageTitle:
            'Add Instructions | Sasha',

          errorMessage:
            'Please log in before adding a resource.',

          formData:
            req.body || {}
        }
      );

    }


    if (
      !Array.isArray(req.files) ||
      req.files.length === 0
    ) {

      return res.status(400).render(
        'add_instructions',
        {
          layout:
            'mainlayout',

          pageTitle:
            'Add Instructions | Sasha',

          errorMessage:
            'Select at least one resource file.',

          formData:
            req.body || {}
        }
      );

    }


    const organization =
      await Organization.findById(
        organizationId
      );


    if (!organization) {

      return res.status(404).render(
        'add_instructions',
        {
          layout:
            'mainlayout',

          pageTitle:
            'Add Instructions | Sasha',

          errorMessage:
            'The organization could not be found.',

          formData:
            req.body || {}
        }
      );

    }


    const client =
      sashaAiService.createClient(
        process.env.OPENAI_API_KEY
      );


    const vectorStoreId =
      await getOrCreateVectorStore(
        client,
        organization
      );


    const resource =
      new InstructionResource(
        prepareResourceData(
          req
        )
      );


    const preparedFiles =
      [];


    for (
      const uploadedFile
      of req.files
    ) {

      const cloudinaryFile =
        await uploadResourceToCloudinary(
          uploadedFile,
          organizationId
        );


      const cachedOpenAiFile =
        findCachedOpenAiFile(
          req,
          uploadedFile
        );


      const openAiFile =
        cachedOpenAiFile
          ? {
              id:
                cachedOpenAiFile
                  .openAiFileId
            }
          : await createOpenAiFile(
              client,
              uploadedFile
            );


      const vectorStoreFile =
        await client
          .vectorStores
          .files
          .create(
            vectorStoreId,
            {
              file_id:
                openAiFile.id
            }
          );


      const processingStatus =
        mapVectorStoreStatus(
          vectorStoreFile
        );


      preparedFiles.push(
        {
          filename:
            cloudinaryFile.public_id,

          originalFilename:
            uploadedFile.originalname,

          url:
            cloudinaryFile.secure_url,

          publicId:
            cloudinaryFile.public_id,

          mimeType:
            uploadedFile.mimetype,

          fileSize:
            uploadedFile.size,

          openAiFileId:
            openAiFile.id,

          vectorStoreFileId:
            vectorStoreFile.id,

          processingStatus,

          submittedToOpenAiAt:
            new Date(),

          indexedAt:
            processingStatus ===
              'ready'
              ? new Date()
              : undefined
        }
      );

    }


    resource.resourceFiles =
      preparedFiles;


    resource.processedByPhil =
      preparedFiles.length > 0 &&
      preparedFiles.every(
        (file) =>
          file.processingStatus ===
            'ready'
      );


    resource.processingNotes =
      resource.processedByPhil
        ? 'All files are indexed and ready for Sasha.'
        : 'Files were uploaded and are being indexed by Sasha.';


    await resource.save();


    organization.aiSettings =
      organization.aiSettings ||
      {};


    organization.aiSettings
      .vectorStoreLastUpdatedAt =
        new Date();


    await organization.save();


    const analysisToken =
      req.body
        .instructionAnalysisToken;


    if (
      analysisToken &&
      req.session
        .instructionAnalyses
    ) {

      delete req.session
        .instructionAnalyses[
          analysisToken
        ];

    }


    return res.render(
      'add_instructions',
      {
        layout:
          'mainlayout',

        pageTitle:
          'Add Instructions | Sasha',

        successMessage:
          'The resource was added successfully.'
      }
    );

  } catch (
    error
  ) {

    console.error(
      'CREATE INSTRUCTION RESOURCE FAILED:',
      error
    );


    let errorMessage =
      'Sasha could not add this resource. Please try again.';


    if (
      error.name ===
      'ValidationError'
    ) {

      errorMessage =
        Object.values(
          error.errors
        )
          .map(
            (validationError) =>
              validationError.message
          )
          .join(' ');

    }


    return res.status(500).render(
      'add_instructions',
      {
        layout:
          'mainlayout',

        pageTitle:
          'Add Instructions | Sasha',

        errorMessage,

        formData:
          req.body || {}
      }
    );

  }

};