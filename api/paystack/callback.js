const {
  getBaseUrl,
  getPlan,
  handleError,
  paystackRequest,
  safeUrl,
  sendHtml,
  setCors,
} = require('../../lib/paystack');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendHtml(res, 405, '<h1>Method not allowed</h1>');
    return;
  }

  try {
    const requestUrl = new URL(req.url, getBaseUrl(req));
    const reference = String(requestUrl.searchParams.get('reference') || '').trim();

    if (!reference) {
      sendHtml(res, 400, '<h1>Missing Paystack reference</h1>');
      return;
    }

    const payload = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    const data = payload.data || {};
    const metadata = data.metadata || {};
    const returnUrl = safeUrl(metadata.return_url);
    const status = data.status === 'success' ? 'success' : 'failed';
    let planLabel = metadata.plan_label || '';

    try {
      const plan = getPlan(metadata.plan, metadata.billing);
      planLabel = plan.label;
    } catch (_) {
      // Metadata from older test payments may not contain a current plan slug.
    }

    if (returnUrl) {
      const redirectUrl = new URL(returnUrl);
      redirectUrl.searchParams.set('paystack_reference', reference);
      redirectUrl.searchParams.set('paystack_status', status);
      res.statusCode = 302;
      res.setHeader('Location', redirectUrl.toString());
      res.end();
      return;
    }

    sendHtml(res, status === 'success' ? 200 : 402, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paystack ${escapeHtml(status)} | Florantops</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f7f4ef; color: #1f2933; margin: 0; padding: 40px; }
    main { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e6dfd3; padding: 32px; border-radius: 8px; }
    h1 { margin-top: 0; color: #176b56; }
    p { line-height: 1.6; }
    code { background: #f1eee8; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>${status === 'success' ? 'Payment method confirmed' : 'Payment authorization failed'}</h1>
    <p>${status === 'success'
      ? 'Paystack confirmed the payment method for the Florantops trial setup.'
      : 'Paystack did not confirm this payment authorization.'}</p>
    <p><strong>Plan:</strong> ${escapeHtml(planLabel || 'Not specified')}</p>
    <p><strong>Reference:</strong> <code>${escapeHtml(reference)}</code></p>
    <p>Your Florantops platform should now use this verified reference to start the 7-day trial and create the subscription record.</p>
  </main>
</body>
</html>`);
  } catch (error) {
    handleError(res, error);
  }
};
