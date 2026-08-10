const path =
require('path');

const express =
require('express');

const { engine } =
require('express-handlebars');

require('dotenv')
.config();


/* =====================================================
APP
===================================================== */

const app =
express();


/* =====================================================
ROUTES
===================================================== */

const sasharoutes =
require(
  './routes/sasharoutes'
);


/* =====================================================
HANDLEBARS
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

partialsDir:
  path.join(
    __dirname,
    'views',
    'partials'
  )
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
MIDDLEWARE
===================================================== */

app.use(
express.urlencoded({
extended:
true
})
);

app.use(
express.json()
);

app.use(
express.static(
  path.join(
    __dirname,
    'public'
  )
)
);


/* =====================================================
SASHA ROUTES
===================================================== */

app.use(
'/',
sasharoutes
);


/* =====================================================
404
===================================================== */

app.use(
(
req,
res
) => {

res.status(
  404
);

res.send(
  'Page not found.'
);

}
);


/* =====================================================
SERVER
===================================================== */

const PORT =
process.env.PORT ||
3000;

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