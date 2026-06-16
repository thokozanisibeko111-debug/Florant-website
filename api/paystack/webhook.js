const {
  handleError,
  readRawBody,
  sendJson,
  verifyPaystackSignature,
} = require('../../lib/paystack');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, message: 'Method not allowed.' });
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['x-paystack-signature'];

    if (!verifyPaystackSignature(rawBody, signature)) {
      sendJson(res, 401, { ok: false, message: 'Invalid Paystack signature.' });
      return;
    }

    const event = JSON.parse(rawBody.toString('utf8'));

    console.log('Paystack webhook received', {
      event: event.event,
      reference: event.data && event.data.reference,
      subscription_code: event.data && event.data.subscription_code,
      customer_code: event.data && event.data.customer && event.data.customer.customer_code,
    });

    sendJson(res, 200, { ok: true, received: true });
  } catch (error) {
    handleError(res, error);
  }
};
