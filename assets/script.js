const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');

if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

document.querySelectorAll('.js-form').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type="submit"]');

    if (status) {
      status.textContent = 'Sending your message...';
    }

    if (button) {
      button.disabled = true;
    }

    try {
      const formData = new FormData(form);
      formData.set('page_url', window.location.href);

      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok === false) {
        throw new Error(result.message || 'The message could not be sent.');
      }

      if (status) {
        status.textContent = result.message || 'Thank you for your message, we will be in touch with you shortly.';
      }

      form.reset();
    } catch (error) {
      if (status) {
        status.textContent = error.message || 'The message could not be sent. Please email Info@florantops.com directly.';
      }
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  });
});
