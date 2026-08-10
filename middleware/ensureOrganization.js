function ensureOrganization(
  req,
  res,
  next
) {
  if (
    req.session &&
    req.session.organizationId
  ) {
    return next();
  }

  return res.redirect('/login');
}


module.exports = ensureOrganization;