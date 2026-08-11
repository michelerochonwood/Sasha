const Organization =
  require(
    '../models/organization'
  );


/* =====================================================
LOGIN VIEW
===================================================== */

function showLogin(
  req,
  res
) {

  if (
    req.session.organizationId
  ) {

    return res.redirect(
      '/'
    );

  }


  return res.render(
    'login_view',
    {

      layout:
        'mainlayout',

      pageTitle:
        'Organization Login',

      successMessage:
        req.query.loggedOut ===
        'true'
          ? 'You have been signed out.'
          : null,

      formData: {
        username:
          ''
      }

    }
  );

}


/* =====================================================
LOGIN
===================================================== */

async function login(
  req,
  res,
  next
) {

  try {

    const username =
      cleanOptionalString(
        req.body.username
      )?.toLowerCase() ||
      '';


    const password =
      typeof req.body.password ===
      'string'
        ? req.body.password
        : '';


    /* =================================================
       BASIC VALIDATION
    ================================================== */

    if (
      !username ||
      !password
    ) {

      return renderLoginError(
        res,
        400,
        'Enter your organization username and password.',
        username
      );

    }


    /* =================================================
       FIND SHARED ORGANIZATION
    ================================================== */

    const organization =
      await Organization.findOne({
        username
      })
        .select(
          [
            '+password',
            'organizationName',
            'username',
            'accountStatus',
            'isActive',
            'loginLockedUntil',
            'failedLoginAttempts',
            'totalLoginCount',
            'lastLoginAt',
            'lastActivityAt'
          ].join(' ')
        );


    if (
      !organization
    ) {

      return renderLoginError(
        res,
        401,
        'The username or password is incorrect.',
        username
      );

    }


    /* =================================================
       CHECK ACCOUNT ACCESS
    ================================================== */

    if (
      typeof organization.canSignIn !==
      'function'
    ) {

      throw new Error(
        'The organization model is missing the canSignIn method.'
      );

    }


    if (
      !organization.canSignIn()
    ) {

      return renderLoginError(
        res,
        403,
        'This organization account is not currently available. Please contact Twennie Support.',
        username
      );

    }


    /* =================================================
       VERIFY PASSWORD
    ================================================== */

    const passwordMatches =
      await organization
        .comparePassword(
          password
        );


    if (
      !passwordMatches
    ) {

      organization.failedLoginAttempts =
        (
          organization.failedLoginAttempts ||
          0
        ) +
        1;


      try {

        await organization.save();

      } catch (saveError) {

        console.error(
          'Unable to record failed login attempt:',
          saveError
        );

      }


      return renderLoginError(
        res,
        401,
        'The username or password is incorrect.',
        username
      );

    }


    /* =================================================
       REGENERATE SESSION
    ================================================== */

    return req.session.regenerate(
      async (
        sessionError
      ) => {

        if (
          sessionError
        ) {

          return next(
            sessionError
          );

        }


        req.session.organizationId =
          organization._id
            .toString();


        req.session.organizationName =
          organization
            .organizationName;


        req.session.isAuthenticated =
          true;


        /* ===============================================
           UPDATE ACTIVITY
        ================================================ */

        try {

          organization.lastLoginAt =
            new Date();


          organization.lastActivityAt =
            new Date();


          organization.totalLoginCount =
            (
              organization.totalLoginCount ||
              0
            ) +
            1;


          organization.failedLoginAttempts =
            0;


          organization.loginLockedUntil =
            undefined;


          await organization.save();

        } catch (
          updateError
        ) {

          console.error(
            'Unable to update login activity:',
            updateError
          );

        }


        return req.session.save(
          (
            saveError
          ) => {

            if (
              saveError
            ) {

              return next(
                saveError
              );

            }


            return res.redirect(
              '/'
            );

          }
        );

      }
    );

  } catch (
    error
  ) {

    return next(
      error
    );

  }

}


/* =====================================================
LOGOUT
===================================================== */

function logout(
  req,
  res,
  next
) {

  req.session.destroy(
    (
      error
    ) => {

      if (
        error
      ) {

        return next(
          error
        );

      }


      res.clearCookie(
        'sasha.sid',
        {

          httpOnly:
            true,

          sameSite:
            'lax',

          secure:
            process.env.NODE_ENV ===
            'production'

        }
      );


      return res.redirect(
        '/login?loggedOut=true'
      );

    }
  );

}


/* =====================================================
SETUP ORGANIZATION VIEW
===================================================== */

function showSetupForm(
  req,
  res
) {

  if (
    req.session.organizationId
  ) {

    return res.redirect(
      '/'
    );

  }


  return res.render(
    'setup_organization_form',
    {

      layout:
        'mainlayout',

      pageTitle:
        'Set Up Your Organization',

      formData:
        getDefaultOrganizationFormData()

    }
  );

}


/* =====================================================
CREATE ORGANIZATION
===================================================== */

async function createOrganization(
  req,
  res,
  next
) {

  try {

    const organizationName =
      cleanOptionalString(
        req.body.organizationName
      );


    const username =
      cleanOptionalString(
        req.body.username
      )?.toLowerCase();


    const password =
      typeof req.body.password ===
      'string'
        ? req.body.password
        : '';


    const confirmPassword =
      typeof req.body.confirmPassword ===
      'string'
        ? req.body.confirmPassword
        : '';


    const errors =
      [];


    /* =================================================
       VALIDATE
    ================================================== */

    if (
      !organizationName
    ) {

      errors.push({
        msg:
          'Organization name is required.'
      });

    }


    if (
      !username
    ) {

      errors.push({
        msg:
          'A shared username is required.'
      });

    }


    if (
      username &&
      username.length <
      4
    ) {

      errors.push({
        msg:
          'The shared username must contain at least four characters.'
      });

    }


    if (
      password.length <
      8
    ) {

      errors.push({
        msg:
          'The password must contain at least eight characters.'
      });

    }


    if (
      password !==
      confirmPassword
    ) {

      errors.push({
        msg:
          'The passwords do not match.'
      });

    }


    /* =================================================
       CHECK SHARED DATABASE
    ================================================== */

    if (
      username
    ) {

      const existingOrganization =
        await Organization
          .findOne({
            username
          })
          .select(
            '_id'
          )
          .lean();


      if (
        existingOrganization
      ) {

        errors.push({
          msg:
            'That organization username already exists. If your organization was set up through Phil, sign in instead.'
        });

      }

    }


    if (
      errors.length >
      0
    ) {

      return res
        .status(
          400
        )
        .render(
          'setup_organization_form',
          {

            layout:
              'mainlayout',

            pageTitle:
              'Set Up Your Organization',

            errors,

            formData:
              req.body

          }
        );

    }


    /* =================================================
       CREATE SLUG
    ================================================== */

    const baseSlug =
      createSlug(
        organizationName
      );


    let slug =
      baseSlug;


    let suffix =
      2;


    while (
      await Organization.exists({
        slug
      })
    ) {

      slug =
        `${baseSlug}-${suffix}`;

      suffix +=
        1;

    }


    /* =================================================
       CREATE SHARED ORGANIZATION
    ================================================== */

    const organization =
      new Organization({

        organizationName,

        slug,

        username,

        password,

        organizationType:
          cleanOptionalString(
            req.body.organizationType
          ) ||
          'engineering',

        website:
          cleanOptionalString(
            req.body.website
          ),

        primaryContactName:
          cleanOptionalString(
            req.body.primaryContactName
          ),

        primaryContactEmail:
          normalizeEmail(
            req.body.primaryContactEmail
          ),

        primaryContactPhone:
          cleanOptionalString(
            req.body.primaryContactPhone
          ),

        headquartersCity:
          cleanOptionalString(
            req.body.headquartersCity
          ),

        headquartersProvinceState:
          cleanOptionalString(
            req.body.headquartersProvinceState
          ),

        headquartersCountry:
          cleanOptionalString(
            req.body.headquartersCountry
          ) ||
          'Canada',

        operatingRegions:
          commaSeparatedToArray(
            req.body.operatingRegions
          ),

        marketSectors:
          commaSeparatedToArray(
            req.body.marketSectors
          ),

        disciplines:
          commaSeparatedToArray(
            req.body.disciplines
          ),

        services:
          commaSeparatedToArray(
            req.body.services
          ),

        defaultWritingStyle:
          cleanOptionalString(
            req.body.defaultWritingStyle
          ) ||
          'professional',

        spellingPreference:
          cleanOptionalString(
            req.body.spellingPreference
          ) ||
          'canadian',

        /*
        For now we make manually-created Sasha organizations
        usable immediately. When Sasha billing is wired in,
        activation should move into the payment workflow.
        */

        accountStatus:
          'active',

        isActive:
          true,

        activatedAt:
          new Date(),

        onboardingStatus:
          'in_progress'

      });


    await organization.save();


    /* =================================================
       LOG INTO SASHA
    ================================================== */

    return req.session.regenerate(
      (
        sessionError
      ) => {

        if (
          sessionError
        ) {

          return next(
            sessionError
          );

        }


        req.session.organizationId =
          organization._id
            .toString();


        req.session.organizationName =
          organization
            .organizationName;


        req.session.isAuthenticated =
          true;


        return req.session.save(
          (
            saveError
          ) => {

            if (
              saveError
            ) {

              return next(
                saveError
              );

            }


            return res.redirect(
              '/'
            );

          }
        );

      }
    );

  } catch (
    error
  ) {

    if (
      error.code ===
      11000
    ) {

      return res
        .status(
          400
        )
        .render(
          'setup_organization_form',
          {

            layout:
              'mainlayout',

            pageTitle:
              'Set Up Your Organization',

            errors: [
              {
                msg:
                  'An organization with that username or identifier already exists.'
              }
            ],

            formData:
              req.body

          }
        );

    }


    return next(
      error
    );

  }

}


/* =====================================================
LOGIN ERROR
===================================================== */

function renderLoginError(
  res,
  statusCode,
  errorMessage,
  username
) {

  return res
    .status(
      statusCode
    )
    .render(
      'login_view',
      {

        layout:
          'mainlayout',

        pageTitle:
          'Organization Login',

        errorMessage,

        formData: {
          username
        }

      }
    );

}


/* =====================================================
HELPERS
===================================================== */

function cleanOptionalString(
  value
) {

  if (
    typeof value !==
    'string' ||
    !value.trim()
  ) {

    return undefined;

  }


  return value.trim();

}


function normalizeEmail(
  value
) {

  return cleanOptionalString(
    value
  )?.toLowerCase();

}


function commaSeparatedToArray(
  value
) {

  if (
    Array.isArray(
      value
    )
  ) {

    return value
      .map(
        (
          item
        ) => {

          return typeof item ===
            'string'
            ? item.trim()
            : '';

        }
      )
      .filter(
        Boolean
      );

  }


  if (
    typeof value !==
      'string' ||
    !value.trim()
  ) {

    return [];

  }


  return value
    .split(
      ','
    )
    .map(
      (
        item
      ) =>
        item.trim()
    )
    .filter(
      Boolean
    );

}


function createSlug(
  value
) {

  return value
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    );

}


function getDefaultOrganizationFormData() {

  return {

    headquartersCountry:
      'Canada',

    organizationType:
      'engineering',

    defaultWritingStyle:
      'professional',

    spellingPreference:
      'canadian'

  };

}


/* =====================================================
EXPORTS
===================================================== */

module.exports = {

  showLogin,
  login,
  logout,

  showSetupForm,
  createOrganization

};