const path =
  require('path');

const express =
  require('express');

const mongoose =
  require('mongoose');

const {
  engine
} =
  require('express-handlebars');

const session =
  require('express-session');

const {
  MongoStore
} =
  require('connect-mongo');

const methodOverride =
  require('method-override');

const helmet =
  require('helmet');

const compression =
  require('compression');


require('dotenv')
  .config();


/* =====================================================
ENVIRONMENT
===================================================== */

const isProduction =
  process.env.NODE_ENV ===
  'production';


const PORT =
  process.env.PORT ||
  3000;


/* =====================================================
ENVIRONMENT VALIDATION
===================================================== */

function validateEnvironment() {

  const requiredVariables = [
    'MONGODB_URI',
    'SESSION_SECRET',
    'CLOUDINARY_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];


  const missingVariables =
    requiredVariables.filter(
      (variableName) => {

        return (
          !process.env[
            variableName
          ]
        );

      }
    );


  if (
    missingVariables.length >
    0
  ) {

    throw new Error(
      `Missing environment variables: ${missingVariables.join(', ')}`
    );

  }


  if (
    process.env.SESSION_SECRET.length <
    32
  ) {

    throw new Error(
      'SESSION_SECRET must be at least 32 characters long.'
    );

  }

}


/* =====================================================
VALIDATE BEFORE APPLICATION SETUP
===================================================== */

validateEnvironment();


/* =====================================================
APPLICATION SETUP
===================================================== */

const app =
  express();


/*
Railway terminates HTTPS at its proxy and forwards the
request to the Node application.

This allows Express to correctly recognize the original
request as secure when setting production cookies.
*/

if (
  isProduction
) {

  app.set(
    'trust proxy',
    1
  );

}


/* =====================================================
ROUTES
===================================================== */

const sashaRoutes =
  require(
    './routes/sasharoutes'
  );


/* =====================================================
CSRF
===================================================== */

const {
  attachCsrfToken
} =
  require(
    './middleware/csrfProtection'
  );


/* =====================================================
VIEW ENGINE
===================================================== */

app.engine(
  'hbs',
  engine({

    extname:
      '.hbs',

    defaultLayout:
      'mainlayout',

    layoutsDir:
      path.join(
        __dirname,
        'views',
        'layouts'
      ),

    partialsDir: [
      path.join(
        __dirname,
        'views',
        'partials'
      ),

      path.join(
        __dirname,
        'views',
        'partials',
        'sasha_home'
      )
    ],

    helpers: {

      ifEquals(
        value1,
        value2,
        options
      ) {

        if (
          value1 ===
          value2
        ) {

          return options.fn(
            this
          );

        }


        return options.inverse(
          this
        );

      }

    }

  })
);


app.set(
  'view engine',
  'hbs'
);


app.set(
  'views',
  path.join(
    __dirname,
    'views'
  )
);


/* =====================================================
SECURITY
===================================================== */

app.disable(
  'x-powered-by'
);


app.use(
  helmet({

    /*
    Sasha currently loads page resources that may require
    further CSP configuration before CSP can be enabled.
    */

    contentSecurityPolicy:
      false

  })
);


app.use(
  compression()
);


/* =====================================================
REQUEST BODY PARSING
===================================================== */

app.use(
  express.urlencoded({

    extended:
      true,

    limit:
      '2mb'

  })
);


app.use(
  express.json({

    limit:
      '2mb'

  })
);


/* =====================================================
METHOD OVERRIDE
===================================================== */

app.use(
  methodOverride(
    '_method'
  )
);


/* =====================================================
STATIC FILES
===================================================== */

app.use(
  express.static(
    path.join(
      __dirname,
      'public'
    ),

    {

      maxAge:
        isProduction
          ? '1d'
          : 0,

      etag:
        true

    }
  )
);


/* =====================================================
SESSION STORE
===================================================== */

const sessionStore =
  MongoStore.create({

    mongoUrl:
      process.env.MONGODB_URI,

    collectionName:
      'sasha_sessions',

    ttl:
      60 *
      60 *
      24 *
      7,

    autoRemove:
      'native',

    touchAfter:
      60 *
      60

  });


sessionStore.on(
  'error',
  (error) => {

    console.error(
      'Session store error:',
      error
    );

  }
);


/* =====================================================
SESSION
===================================================== */

app.use(
  session({

    name:
      'sasha.sid',

    secret:
      process.env.SESSION_SECRET,

    store:
      sessionStore,

    resave:
      false,

    saveUninitialized:
      false,

    rolling:
      true,

    cookie: {

      httpOnly:
        true,

      secure:
        isProduction,

      sameSite:
        'lax',

      maxAge:
        1000 *
        60 *
        60 *
        24 *
        7

    }

  })
);


/* =====================================================
CSRF TOKEN FOR VIEWS
===================================================== */

/*
This middleware generates or retrieves the session's
CSRF token and makes it available to Handlebars as:

{{csrfToken}}

It must run after the session middleware.
*/

app.use(
  attachCsrfToken
);


/* =====================================================
GLOBAL TEMPLATE VARIABLES
===================================================== */

app.use(
  (
    req,
    res,
    next
  ) => {

    res.locals.isAuthenticated =
      Boolean(
        req.session
          .organizationId
      );


    res.locals.organizationName =
      req.session
        .organizationName ||
      null;


    res.locals.currentYear =
      new Date()
        .getFullYear();


    next();

  }
);


/* =====================================================
DEVELOPMENT REQUEST LOGGER
===================================================== */

app.use(
  (
    req,
    res,
    next
  ) => {

    if (
      !isProduction
    ) {

      console.log(
        '================================'
      );


      console.log(
        `${req.method} ${req.originalUrl}`
      );


      console.log(
        'Content-Type:',
        req.headers[
          'content-type'
        ] ||
        'none'
      );


      console.log(
        'Authenticated:',
        Boolean(
          req.session
            .organizationId
        )
      );


      console.log(
        '================================'
      );

    }


    next();

  }
);


/* =====================================================
APPLICATION ROUTES
===================================================== */

app.use(
  '/',
  sashaRoutes
);


/* =====================================================
404 HANDLER
===================================================== */

app.use(
  (
    req,
    res
  ) => {

    return res
      .status(
        404
      )
      .render(
        'not_found',
        {

          layout:
            'mainlayout',

          pageTitle:
            'Page Not Found'

        }
      );

  }
);


/* =====================================================
CSRF ERROR HANDLER
===================================================== */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    if (
      error.code !==
      'EBADCSRFTOKEN'
    ) {

      return next(
        error
      );

    }


    console.warn(
      'CSRF validation failed:',
      {

        method:
          req.method,

        path:
          req.originalUrl,

        organizationId:
          req.session
            ?.organizationId ||
          null

      }
    );


    return res
      .status(
        403
      )
      .render(
        'csrf_error',
        {

          layout:
            'mainlayout',

          pageTitle:
            'Form Expired'

        }
      );

  }
);


/* =====================================================
GENERAL ERROR HANDLER
===================================================== */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      'APPLICATION ERROR'
    );


    console.error(
      {

        method:
          req.method,

        path:
          req.originalUrl,

        message:
          error.message,

        stack:
          !isProduction
            ? error.stack
            : undefined

      }
    );


    if (
      res.headersSent
    ) {

      return next(
        error
      );

    }


    return res
      .status(
        500
      )
      .render(
        'error',
        {

          layout:
            'mainlayout',

          pageTitle:
            'Something Went Wrong',

          errorMessage:
            !isProduction
              ? error.message
              : null

        }
      );

  }
);


/* =====================================================
DATABASE CONNECTION
===================================================== */

async function connectDatabase() {

  await mongoose.connect(
    process.env.MONGODB_URI
  );


  console.log(
    `MongoDB connected to database: ${mongoose.connection.name}`
  );

}


/* =====================================================
DATABASE EVENT LOGGING
===================================================== */

mongoose.connection.on(
  'error',
  (error) => {

    console.error(
      'MongoDB connection error:',
      error
    );

  }
);


mongoose.connection.on(
  'disconnected',
  () => {

    console.warn(
      'MongoDB disconnected.'
    );

  }
);


/* =====================================================
SERVER REFERENCE
===================================================== */

let server;


/* =====================================================
START APPLICATION
===================================================== */

async function startApplication() {

  try {

    await connectDatabase();


    server =
      app.listen(
        PORT,
        () => {

          console.log(
            `Sasha is running on port ${PORT}.`
          );


          console.log(
            `Environment: ${process.env.NODE_ENV || 'development'}`
          );

        }
      );

  } catch (error) {

    console.error(
      'Sasha could not start:',
      error.message
    );


    process.exit(
      1
    );

  }

}


startApplication();


/* =====================================================
GRACEFUL SHUTDOWN
===================================================== */

let isShuttingDown =
  false;


async function shutDownApplication(
  signal
) {

  if (
    isShuttingDown
  ) {

    return;

  }


  isShuttingDown =
    true;


  console.log(
    `${signal} received. Closing Sasha.`
  );


  const forceShutdownTimer =
    setTimeout(
      () => {

        console.error(
          'Forced shutdown after timeout.'
        );


        process.exit(
          1
        );

      },

      10000
    );


  forceShutdownTimer.unref();


  try {

    if (
      server
    ) {

      await new Promise(
        (
          resolve,
          reject
        ) => {

          server.close(
            (error) => {

              if (
                error
              ) {

                return reject(
                  error
                );

              }


              return resolve();

            }
          );

        }
      );


      console.log(
        'HTTP server closed.'
      );

    }


    await mongoose
      .connection
      .close();


    console.log(
      'MongoDB connection closed.'
    );


    if (
      typeof sessionStore.close ===
      'function'
    ) {

      await sessionStore.close();


      console.log(
        'Session store connection closed.'
      );

    }


    clearTimeout(
      forceShutdownTimer
    );


    process.exit(
      0
    );

  } catch (error) {

    clearTimeout(
      forceShutdownTimer
    );


    console.error(
      'Error during shutdown:',
      error
    );


    process.exit(
      1
    );

  }

}


/* =====================================================
PROCESS SIGNALS
===================================================== */

process.on(
  'SIGINT',
  () => {

    shutDownApplication(
      'SIGINT'
    );

  }
);


process.on(
  'SIGTERM',
  () => {

    shutDownApplication(
      'SIGTERM'
    );

  }
);


/* =====================================================
UNHANDLED ERRORS
===================================================== */

process.on(
  'unhandledRejection',
  (reason) => {

    console.error(
      'Unhandled promise rejection:',
      reason
    );


    shutDownApplication(
      'UNHANDLED_REJECTION'
    );

  }
);


process.on(
  'uncaughtException',
  (error) => {

    console.error(
      'Uncaught exception:',
      error
    );


    shutDownApplication(
      'UNCAUGHT_EXCEPTION'
    );

  }
);