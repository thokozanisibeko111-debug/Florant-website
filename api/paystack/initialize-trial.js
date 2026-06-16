const {
  getCallbackUrl,
  getPlan,
  getTrialAuthorizationAmount,
  getTrialDays,
  handleError,
  paystackRequest,
  readJsonBody,
  safeUrl,
  sendJson,
  setCors,
} = require('../../lib/paystack');

function validateEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, message: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = validateEmail(body.email);

    if (!email) {
      sendJson(res, 400, { ok: false, message: 'A valid email address is required.' });
      return;
    }

    const plan = getPlan(body.plan, body.billing);
    const callbackUrl = getCallbackUrl(req);
    const returnUrl = safeUrl(body.return_url);
    const trialDays = getTrialDays();
    const authorizationAmount = getTrialAuthorizationAmount();

    const metadata = {
      source: 'florantops_trial_authorization',
      customer_name: String(body.name || '').trim(),
      bakery_name: String(body.bakery_name || '').trim(),
      plan: plan.slug,
      billing: plan.billing,
      plan_label: plan.label,
      subscription_amount: plan.amount,
      subscription_currency: plan.currency,
      trial_days: trialDays,
      return_url: returnUrl,
    };

    const payload = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: {
        email,
        amount: authorizationAmount,
        currency: 'ZAR',
        callback_url: callbackUrl,
        metadata,
      },
    });

    sendJson(res, 200, {
      ok: true,
      message: 'Paystack trial authorization created.',
      authorization_url: payload.data.authorization_url,
      access_code: payload.data.access_code,
      reference: payload.data.reference,
      plan: {
        slug: plan.slug,
        billing: plan.billing,
        label: plan.label,
        amount: plan.amount,
        currency: plan.currency,
        plan_code_configured: Boolean(plan.planCode),
      },
      trial: {
        days: trialDays,
        authorization_amount: authorizationAmount,
        currency: 'ZAR',
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
