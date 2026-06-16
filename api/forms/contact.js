const { handleForm } = require('../../lib/form-handler');

module.exports = function handler(req, res) {
  return handleForm(req, res, 'contact');
};
