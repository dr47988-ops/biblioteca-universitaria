
const { csrfSync } = require('csrf-sync');

const {
  generateToken,
  csrfSynchronisedProtection
} = csrfSync({
  getTokenFromRequest: (req) => {
    return req.headers['x-csrf-token'];
  },
  getTokenFromState: (req) => {
    return req.session.csrfToken;
  },
  storeTokenInState: (req, token) => {
    req.session.csrfToken = token;
  },
  size: 32
});

module.exports = {
  generateToken,
  csrfSynchronisedProtection
};
