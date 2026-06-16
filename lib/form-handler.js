const FORM_RECIPIENT = process.env.FORM_RECIPIENT_EMAIL || 'Info@florantops.com';

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;

      if (body.length > 256 * 1024) {
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

function clean(value) {
  return String(value || '').trim();
}

function validateEmail(value) {
  const email = clean(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function getBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.florantops.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function buildSubmission(type, body, req) {
  const now = new Date().toISOString();
  const page = clean(body.page_url) || getBaseUrl(req);

  if (clean(body._honey)) {
    const error = new Error('Spam submission ignored.');
    error.statusCode = 200;
    error.ignored = true;
    throw error;
  }

  if (type === 'demo') {
    const email = validateEmail(body.email);
    const name = clean(body.name);
    const bakery = clean(body.bakery);

    if (!name || !bakery || !email) {
      const error = new Error('Name, bakery name, and email are required.');
      error.statusCode = 400;
      throw error;
    }

    return {
      _subject: `New Florantops demo request - ${bakery}`,
      _template: 'table',
      _captcha: 'false',
      'Form type': 'Book a Demo',
      Name: name,
      'Bakery name': bakery,
      Email: email,
      Phone: clean(body.phone),
      'Business type': clean(body['business-type']),
      'Number of staff': clean(body.staff),
      'Main challenge': clean(body.challenge),
      'Preferred demo date': clean(body['demo-date']),
      Message: clean(body.message),
      'Submitted from': page,
      'Submitted at': now,
    };
  }

  const email = validateEmail(body.email);
  const name = clean(body.name);
  const message = clean(body.message);

  if (!name || !email || !message) {
    const error = new Error('Name, email, and message are required.');
    error.statusCode = 400;
    throw error;
  }

  return {
    _subject: `New Florantops contact message - ${name}`,
    _template: 'table',
    _captcha: 'false',
    'Form type': 'Contact',
    Name: name,
    Email: email,
    Phone: clean(body.phone),
    'Bakery name': clean(body.bakery),
    Message: message,
    'Submitted from': page,
    'Submitted at': now,
  };
}

async function forwardToInbox(submission) {
  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(FORM_RECIPIENT)}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(submission),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'The message could not be sent.');
    error.statusCode = response.status || 502;
    throw error;
  }

  return payload;
}

async function handleForm(req, res, type) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, message: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const submission = buildSubmission(type, body, req);
    await forwardToInbox(submission);

    console.log('Florantops form sent', {
      type,
      email: submission.Email,
      subject: submission._subject,
    });

    sendJson(res, 200, {
      ok: true,
      message: 'Thank you for your message, we will be in touch with you shortly.',
    });
  } catch (error) {
    if (error.ignored) {
      sendJson(res, 200, {
        ok: true,
        message: 'Thank you for your message, we will be in touch with you shortly.',
      });
      return;
    }

    console.error('Florantops form error', {
      type,
      message: error.message,
    });

    sendJson(res, error.statusCode || 500, {
      ok: false,
      message: error.statusCode && error.statusCode < 500
        ? error.message
        : 'The message could not be sent. Please email Info@florantops.com directly.',
    });
  }
}

module.exports = {
  handleForm,
};
