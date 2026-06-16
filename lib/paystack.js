const crypto = require('crypto');

const PLAN_CONFIG = {
  starter: {
    label: 'Starter',
    bestFor: 'Home bakery, side bakery, very small shop',
    monthly: {
      amount: 19900,
      interval: 'monthly',
      env: 'PAYSTACK_PLAN_STARTER_MONTHLY',
    },
    yearly: {
      amount: 214920,
      interval: 'annually',
      env: 'PAYSTACK_PLAN_STARTER_YEARLY',
    },
  },
  'bakery-core': {
    label: 'Bakery Core',
    bestFor: 'Small bakery with regular daily sales',
    monthly: {
      amount: 29900,
      interval: 'monthly',
      env: 'PAYSTACK_PLAN_BAKERY_CORE_MONTHLY',
    },
    yearly: {
      amount: 322920,
      interval: 'annually',
      env: 'PAYSTACK_PLAN_BAKERY_CORE_YEARLY',
    },
  },
  growth: {
    label: 'Growth',
    bestFor: 'Busy bakery with staff/drivers',
    monthly: {
      amount: 39900,
      interval: 'monthly',
      env: 'PAYSTACK_PLAN_GROWTH_MONTHLY',
    },
    yearly: {
      amount: 430920,
      interval: 'annually',
      env: 'PAYSTACK_PLAN_GROWTH_YEARLY',
    },
  },
  'multi-branch': {
    label: 'Multi-Branch',
    bestFor: 'Bakery with 2 outlets or stronger controls',
    monthly: {
      amount: 64900,
      interval: 'monthly',
      env: 'PAYSTACK_PLAN_MULTI_BRANCH_MONTHLY',
    },
    yearly: {
      amount: 700920,
      interval: 'annually',
      env: 'PAYSTACK_PLAN_MULTI_BRANCH_YEARLY',
    },
  },
};

const ALLOWED_ORIGINS = new Set([
  'https://www.florantops.com',
  'https://florantops.com',
  'https://florantops-website.vercel.app',
  'https://app.florantops.com',
]);

function normalizePlanSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/_/g, '-');
}

function normalizeBilling(value) {
  const billing = String(value || 'monthly').trim().toLowerCase();
  return billing === 'annual' || billing === 'annually' ? 'yearly' : billing;
}

function getPlan(planSlug, billingValue) {
  const slug = normalizePlanSlug(planSlug);
  const billing = normalizeBilling(billingValue);
  const plan = PLAN_CONFIG[slug];

  if (!plan || !plan[billing]) {
    const error = new Error('Invalid Florantops plan or billing interval.');
    error.statusCode = 400;
    throw error;
  }

  const billingPlan = plan[billing];

  return {
    slug,
    billing,
    label: plan.label,
    bestFor: plan.bestFor,
    amount: billingPlan.amount,
    currency: 'ZAR',
    interval: billingPlan.interval,
    planCode: process.env[billingPlan.env] || '',
    env: billingPlan.env,
  };
}

function formatRand(amount, includeCents) {
  return `R${(amount / 100).toLocaleString('en-US', {
    minimumFractionDigits: includeCents ? 2 : 0,
    maximumFractionDigits: includeCents ? 2 : 0,
  })}`;
}

function getPublicPlans() {
  return Object.entries(PLAN_CONFIG).map(([slug, plan]) => ({
    slug,
    label: plan.label,
    best_for: plan.bestFor,
    monthly: {
      amount: plan.monthly.amount,
      display: formatRand(plan.monthly.amount, false),
      currency: 'ZAR',
      interval: 'monthly',
      configured: Boolean(process.env[plan.monthly.env]),
    },
    yearly: {
      amount: plan.yearly.amount,
      display: formatRand(plan.yearly.amount, true),
      currency: 'ZAR',
      interval: 'annually',
      configured: Boolean(process.env[plan.yearly.env]),
    },
  }));
}

function getTrialDays() {
  const days = Number.parseInt(process.env.PAYSTACK_TRIAL_DAYS || '7', 10);
  return Number.isFinite(days) && days > 0 ? days : 7;
}

function getTrialAuthorizationAmount() {
  const amount = Number.parseInt(process.env.PAYSTACK_TRIAL_AUTH_AMOUNT || '100', 10);
  return Number.isFinite(amount) && amount >= 100 ? amount : 100;
}

function getBaseUrl(req) {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/$/, '');
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function getCallbackUrl(req) {
  return process.env.PAYSTACK_CALLBACK_URL || `${getBaseUrl(req)}/api/paystack/callback`;
}

function setCors(req, res) {
  const origin = req.headers.origin;
  const isLocalhost = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (origin && (ALLOWED_ORIGINS.has(origin) || isLocalhost)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.florantops.com');
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Florantops-Platform-Secret');
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        error.statusCode = 400;
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;

      if (size > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;

  if (!key) {
    const error = new Error('Paystack secret key is not configured.');
    error.statusCode = 500;
    throw error;
  }

  return key;
}

async function paystackRequest(path, options = {}) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.status === false) {
    const error = new Error(payload.message || 'Paystack request failed.');
    error.statusCode = response.status || 502;
    error.details = payload;
    throw error;
  }

  return payload;
}

function verifyPaystackSignature(rawBody, signature) {
  if (!signature) {
    return false;
  }

  const hash = crypto.createHmac('sha512', getSecretKey()).update(rawBody).digest('hex');
  const hashBuffer = Buffer.from(hash);
  const signatureBuffer = Buffer.from(signature);

  if (hashBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, signatureBuffer);
}

function safeUrl(value) {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch (_) {
    return '';
  }
}

function handleError(res, error) {
  sendJson(res, error.statusCode || 500, {
    ok: false,
    message: error.statusCode && error.statusCode < 500
      ? error.message
      : 'The Paystack request could not be completed.',
  });
}

module.exports = {
  getBaseUrl,
  getCallbackUrl,
  getPlan,
  getPublicPlans,
  getSecretKey,
  getTrialAuthorizationAmount,
  getTrialDays,
  handleError,
  paystackRequest,
  readJsonBody,
  readRawBody,
  safeUrl,
  sendHtml,
  sendJson,
  setCors,
  verifyPaystackSignature,
};
