const {
  getCallbackUrl,
  getPublicPlans,
  getTrialAuthorizationAmount,
  getTrialDays,
  sendJson,
  setCors,
} = require('../../lib/paystack');

module.exports = function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, message: 'Method not allowed.' });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    mode: process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_SECRET_KEY.startsWith('sk_live_')
      ? 'live'
      : 'test',
    public_key: process.env.PAYSTACK_PUBLIC_KEY || '',
    currency: 'ZAR',
    trial_days: getTrialDays(),
    trial_authorization_amount: getTrialAuthorizationAmount(),
    callback_url: getCallbackUrl(req),
    webhook_url: `${process.env.SITE_URL || 'https://www.florantops.com'}/api/paystack/webhook`,
    plans: getPublicPlans(),
  });
};
