import { createCaustics } from './caustics.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function intersectionRatio(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return (width * height) / (a.width * a.height);
}

export function createIntro({ onReveal }) {
  const intro = document.querySelector('#intro');
  const site = document.querySelector('#site');
  const logo = document.querySelector('#intro-logo');
  const prompt = document.querySelector('#intro-prompt');
  const status = document.querySelector('#intro-status');
  const selection = document.querySelector('#selection');
  const skip = document.querySelector('#skip-intro');
  const caustics = createCaustics(document.querySelector('#selection-canvas'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let state = 'idle';
  let origin = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };
  let activePointer = null;
  let revealed = false;
  let quoteTimer;
  let revealTimer;

  function selectionRect() {
    return {
      left: Math.min(origin.x, current.x),
      top: Math.min(origin.y, current.y),
      right: Math.max(origin.x, current.x),
      bottom: Math.max(origin.y, current.y),
      width: Math.abs(current.x - origin.x),
      height: Math.abs(current.y - origin.y),
    };
  }

  function updateSelection() {
    const rect = selectionRect();
    selection.style.left = `${rect.left}px`;
    selection.style.top = `${rect.top}px`;
    selection.style.width = `${rect.width}px`;
    selection.style.height = `${rect.height}px`;
    if (state === 'dragging') caustics.update(rect);
  }

  function moveQuoteToHero() {
    const quote = document.querySelector('#intro-quote');
    const target = document.querySelector('#hero-title');
    if (!quote || !target || reducedMotion.matches || !quote.animate) {
      finishReveal();
      return;
    }

    const from = quote.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    quote.style.left = `${from.left}px`;
    quote.style.top = `${from.top}px`;
    quote.style.width = `${from.width}px`;
    quote.style.transform = 'none';

    // The real title stays hidden until the flying copy lands, so the two are
    // never visible at the same time.
    target.classList.add('is-awaiting-quote');

    const animation = quote.animate(
      [
        { transform: 'translate3d(0, 0, 0)' },
        { transform: `translate3d(${to.left - from.left}px, ${to.top - from.top}px, 0)` },
      ],
      { duration: 1050, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', fill: 'forwards' },
    );
    animation.addEventListener(
      'finish',
      () => {
        target.classList.remove('is-awaiting-quote');
        finishReveal();
      },
      { once: true },
    );
  }

  function finishReveal() {
    intro.classList.add('is-gone');
    skip.classList.add('is-gone');
    window.setTimeout(() => site.classList.remove('is-entering'), 1200);
  }

  function reveal({ animateQuote = false } = {}) {
    if (revealed) return;
    revealed = true;
    window.clearTimeout(quoteTimer);
    window.clearTimeout(revealTimer);
    caustics.stop();

    site.inert = false;
    site.setAttribute('aria-hidden', 'false');
    site.classList.add('is-visible', 'is-entering');
    document.body.classList.remove('intro-active');
    intro.classList.add('is-leaving');
    skip.classList.add('is-gone');

    if (animateQuote) moveQuoteToHero();
    else finishReveal();

    onReveal?.();
  }

  function succeed() {
    if (state === 'success' || revealed) return;
    state = 'success';
    caustics.stop();
    selection.classList.remove('is-dragging', 'is-missed');
    selection.classList.add('is-settling', 'is-found');
    intro.classList.add('is-selected');
    status.textContent = 'Logo selected. Welcome to Glint.';

    quoteTimer = window.setTimeout(() => intro.classList.add('show-quote'), 420);
    revealTimer = window.setTimeout(() => reveal({ animateQuote: true }), 1580);
  }

  function miss() {
    state = 'idle';
    selection.classList.remove('is-dragging');
    selection.classList.add('is-settling', 'is-missed');
    prompt.textContent = 'Missed it. Try dragging around the mark';
    status.textContent = 'The selection did not include the Glint logo. Try again.';
    window.setTimeout(() => {
      if (state === 'idle') selection.classList.remove('is-settling', 'is-missed');
    }, 680);
  }

  intro.addEventListener('pointerdown', (event) => {
    if (state !== 'idle' || revealed || (event.pointerType === 'mouse' && event.button !== 0)) return;

    state = 'dragging';
    prompt.textContent = 'Release when the mark is inside';
    activePointer = event.pointerId;
    origin = { x: event.clientX, y: event.clientY };
    current = { ...origin };
    selection.classList.remove('is-settling', 'is-missed', 'is-found');
    selection.classList.add('is-dragging');
    updateSelection();
    intro.setPointerCapture(event.pointerId);
    caustics.start();
  });

  intro.addEventListener('pointermove', (event) => {
    if (state !== 'dragging' || event.pointerId !== activePointer) return;

    current = {
      x: clamp(event.clientX, 0, window.innerWidth),
      y: clamp(event.clientY, 0, window.innerHeight),
    };
    updateSelection();
  });

  function endDrag(event) {
    if (state !== 'dragging' || event.pointerId !== activePointer) return;

    if (intro.hasPointerCapture(event.pointerId)) intro.releasePointerCapture(event.pointerId);
    activePointer = null;
    caustics.stop();

    const logoRect = logo.querySelector('svg').getBoundingClientRect();
    const rect = selectionRect();
    const selected = rect.width > 24 && rect.height > 24 && intersectionRatio(logoRect, rect) > 0.62;
    if (selected) succeed();
    else miss();
  }

  intro.addEventListener('pointerup', endDrag);
  intro.addEventListener('pointercancel', (event) => {
    if (event.pointerId === activePointer && state === 'dragging') miss();
    activePointer = null;
    caustics.stop();
  });

  logo.addEventListener('pointerdown', (event) => event.stopPropagation());
  logo.addEventListener('click', (event) => {
    event.stopPropagation();
    const bounds = logo.getBoundingClientRect();
    origin = { x: bounds.left - 16, y: bounds.top - 16 };
    current = { x: bounds.right + 16, y: bounds.bottom + 16 };
    updateSelection();
    selection.classList.add('is-dragging');
    succeed();
  });

  skip.addEventListener('click', (event) => {
    event.preventDefault();
    reveal();
    document.querySelector('#main-content')?.focus({ preventScroll: true });
  });

  return { reveal };
}
