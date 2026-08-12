const crypto = require(
  'crypto'
);


/* =====================================================
CSRF CONFIGURATION
===================================================== */

const CSRF_SESSION_KEY =
  'csrfToken';

const CSRF_BODY_FIELD =
  '_csrf';


/* =====================================================
GENERATE TOKEN
===================================================== */

function generateCsrfToken() {

  return crypto
    .randomBytes(32)
    .toString('hex');

}


/* =====================================================
TIMING-SAFE TOKEN COMPARISON
===================================================== */

function tokensMatch(
  submittedToken,
  sessionToken
) {

  if (
    typeof submittedToken !==
      'string' ||
    typeof sessionToken !==
      'string'
  ) {

    return false;

  }


  const submittedBuffer =
    Buffer.from(
      submittedToken
    );

  const sessionBuffer =
    Buffer.from(
      sessionToken
    );


  if (
    submittedBuffer.length !==
    sessionBuffer.length
  ) {

    return false;

  }


  return crypto.timingSafeEqual(
    submittedBuffer,
    sessionBuffer
  );

}


/* =====================================================
ATTACH CSRF TOKEN
===================================================== */

function attachCsrfToken(
  req,
  res,
  next
) {

  if (
    !req.session
  ) {

    return next(
      new Error(
        'Session middleware must run before CSRF protection.'
      )
    );

  }


  if (
    !req.session[
      CSRF_SESSION_KEY
    ]
  ) {

    req.session[
      CSRF_SESSION_KEY
    ] =
      generateCsrfToken();

  }


  res.locals.csrfToken =
    req.session[
      CSRF_SESSION_KEY
    ];


  return next();

}


/* =====================================================
VERIFY CSRF TOKEN
===================================================== */

function verifyCsrfToken(
  req,
  res,
  next
) {

  const submittedToken =
    req.body?.[
      CSRF_BODY_FIELD
    ] ||
    req.headers[
      'x-csrf-token'
    ];


  const sessionToken =
    req.session?.[
      CSRF_SESSION_KEY
    ];


  if (
    !tokensMatch(
      submittedToken,
      sessionToken
    )
  ) {

    const error =
      new Error(
        'Invalid CSRF token.'
      );


    error.code =
      'EBADCSRFTOKEN';


    return next(
      error
    );

  }  


  return next();

}


/* =====================================================
EXPORTS
===================================================== */

module.exports = {
  attachCsrfToken,
  verifyCsrfToken
};