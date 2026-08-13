const {
  v2: cloudinary
} = require('cloudinary');


/* =====================================================
   REQUIRED ENVIRONMENT VARIABLES
===================================================== */

const requiredCloudinaryVariables = [
  'CLOUDINARY_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];


requiredCloudinaryVariables.forEach(
  (variableName) => {

    if (!process.env[variableName]) {

      throw new Error(
        `${variableName} is missing from the environment variables.`
      );

    }

  }
);


/* =====================================================
   CLOUDINARY CONFIGURATION
===================================================== */

cloudinary.config({

  cloud_name:
    process.env.CLOUDINARY_NAME,

  api_key:
    process.env.CLOUDINARY_API_KEY,

  api_secret:
    process.env.CLOUDINARY_API_SECRET,

  secure:
    true

});


/* =====================================================
   EXPORT CONFIGURED CLOUDINARY INSTANCE
===================================================== */

module.exports = cloudinary;