const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');

if (navToggle && siteNav) {
  const closeNav = () => {
    siteNav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  };

  navToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = siteNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close the menu after choosing a link, clicking away, or pressing Escape.
  siteNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeNav);
  });

  document.addEventListener('click', (event) => {
    if (
      siteNav.classList.contains('open') &&
      !siteNav.contains(event.target) &&
      !navToggle.contains(event.target)
    ) {
      closeNav();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNav();
    }
  });
}

// Accessibility: inject a skip-to-content link as the first focusable element.
const mainContent = document.querySelector('main');
if (mainContent && !document.querySelector('.skip-link')) {
  if (!mainContent.id) {
    mainContent.id = 'main-content';
  }
  const skipLink = document.createElement('a');
  skipLink.className = 'skip-link';
  skipLink.href = `#${mainContent.id}`;
  skipLink.textContent = 'Skip to content';
  document.body.prepend(skipLink);
}

// Add a subtle shadow to the sticky header once the page is scrolled.
const siteHeader = document.querySelector('.site-header');
if (siteHeader) {
  const setHeaderState = () => {
    siteHeader.classList.toggle('scrolled', window.scrollY > 8);
  };
  setHeaderState();
  window.addEventListener('scroll', setHeaderState, { passive: true });
}

// Back-to-top button.
const backToTop = document.createElement('button');
backToTop.type = 'button';
backToTop.className = 'back-to-top';
backToTop.setAttribute('aria-label', 'Back to top');
backToTop.innerHTML = '&uarr;';
document.body.appendChild(backToTop);

backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

window.addEventListener(
  'scroll',
  () => {
    backToTop.classList.toggle('show', window.scrollY > 500);
  },
  { passive: true }
);

// Reveal sections as they enter the viewport (skipped for reduced-motion users).
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReducedMotion && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('main > section').forEach((section, index) => {
    // Leave the first/hero section visible immediately to avoid an above-the-fold flash.
    if (
      index === 0 ||
      section.classList.contains('hero') ||
      section.classList.contains('page-hero')
    ) {
      return;
    }
    section.classList.add('reveal');
    revealObserver.observe(section);
  });
}

document.querySelectorAll('.js-form').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type="submit"]');
    const successMessage = 'Thank you for your message, we will be in touch with you shortly.';

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
        status.textContent = successMessage;
      }

      form.reset();
    } catch (error) {
      if (form.action.includes('formsubmit.co')) {
        if (status) {
          status.textContent = 'Sending through secure email service...';
        }
        HTMLFormElement.prototype.submit.call(form);
        return;
      }

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
