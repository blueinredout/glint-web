import './style.css';
import { createIntro } from './intro.js';
import { createParticleField } from './particles.js';
import { syncRelease } from './release.js';

document.documentElement.classList.add('js');

const site = document.querySelector('#site');
site.inert = true;
site.setAttribute('aria-hidden', 'true');

createIntro({
  onReveal: () => {
    document.querySelector('#main-content')?.setAttribute('tabindex', '-1');
  },
});

createParticleField();

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      revealObserver.unobserve(entry.target);
    }
  },
  { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
);

document.querySelectorAll('[data-reveal], [data-reveal-group]').forEach((element) => {
  revealObserver.observe(element);
});

// Highlight the action row that matches the held modifier keys.
const actionSection = document.querySelector('#actions');
const actionList = document.querySelector('.action-list');
const actionHighlight = document.querySelector('.action-highlight');
const actionRows = [...document.querySelectorAll('[data-action]')];
let pressed = { shift: false, ctrl: false };

function actionInView() {
  const bounds = actionSection.getBoundingClientRect();
  return bounds.top < window.innerHeight * 0.8 && bounds.bottom > window.innerHeight * 0.2;
}

function placeActionHighlight() {
  const active = actionRows.find((row) => row.classList.contains('is-active'));
  if (!active || !actionHighlight) return;
  actionHighlight.style.setProperty('--highlight-y', `${active.offsetTop}px`);
  actionHighlight.style.setProperty('--highlight-height', `${active.offsetHeight}`);
}

function showActiveAction() {
  const action = pressed.ctrl && pressed.shift ? 'both' : pressed.ctrl ? 'ctrl' : pressed.shift ? 'shift' : 'none';
  actionRows.forEach((row) => row.classList.toggle('is-active', row.dataset.action === action));
  placeActionHighlight();
}

placeActionHighlight();
new ResizeObserver(placeActionHighlight).observe(actionList);

window.addEventListener('keydown', (event) => {
  if (!actionInView()) return;
  if (event.key === 'Shift') pressed.shift = true;
  if (event.key === 'Control') pressed.ctrl = true;
  showActiveAction();
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'Shift') pressed.shift = false;
  if (event.key === 'Control') pressed.ctrl = false;
  showActiveAction();
});

window.addEventListener('blur', () => {
  pressed = { shift: false, ctrl: false };
  showActiveAction();
});

syncRelease();

// In-page navigation for the header and footer links.
const scrollLinks = [...document.querySelectorAll('.nav a[href^="#"], .footer a[href^="#"]')];
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const slideLayout = window.matchMedia('(min-width: 801px) and (min-height: 720px)');
const slideSections = [...document.querySelectorAll('#top, .section')];
let scrollFrame = 0;
let scrollActive = false;

function animateScroll(targetY, { paging = false } = {}) {
  cancelAnimationFrame(scrollFrame);
  scrollActive = false;

  const startY = window.scrollY;
  const distance = targetY - startY;
  if (Math.abs(distance) < 1) return;

  if (prefersReducedMotion.matches) {
    window.scrollTo(0, targetY);
    return;
  }

  const root = document.documentElement;
  const duration = paging
    ? Math.min(700, 380 + Math.abs(distance) * 0.08)
    : Math.min(620, 240 + Math.abs(distance) * 0.09);
  const startTime = performance.now();
  const easeOut = (t) => 1 - (1 - t) ** 4;
  const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
  const ease = paging ? easeInOut : easeOut;

  // Native smooth scrolling and snap points would fight the animation.
  root.style.scrollBehavior = 'auto';
  root.style.scrollSnapType = 'none';
  scrollActive = true;

  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    window.scrollTo(0, startY + distance * ease(progress));

    if (progress < 1) {
      scrollFrame = requestAnimationFrame(step);
    } else {
      root.style.scrollBehavior = '';
      root.style.scrollSnapType = '';
      scrollActive = false;
    }
  }

  scrollFrame = requestAnimationFrame(step);
}

for (const link of scrollLinks) {
  link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    const href = link.getAttribute('href');
    const target = href && href.length > 1 ? document.querySelector(href) : null;
    if (!target) return;

    event.preventDefault();
    const top = Math.max(
      0,
      Math.min(
        target.getBoundingClientRect().top + window.scrollY,
        document.documentElement.scrollHeight - window.innerHeight,
      ),
    );

    history.pushState(null, '', href);
    animateScroll(top);
  });
}

// Space, PageDown, and PageUp move one full screen at a time.
function isInteractiveTarget(target) {
  return (
    target instanceof Element &&
    Boolean(target.closest('a, button, input, textarea, select, [contenteditable="true"]'))
  );
}

window.addEventListener('keydown', (event) => {
  if (!slideLayout.matches) return;

  const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
  const isPageUp = event.key === 'PageUp';
  const isPageDown = event.key === 'PageDown';
  if (!isSpace && !isPageUp && !isPageDown) return;
  if (isInteractiveTarget(event.target)) return;

  // Claim the gesture, otherwise the browser jumps instantly.
  event.preventDefault();

  if (event.repeat || scrollActive) return;
  if (document.body.classList.contains('intro-active')) return;
  if (site.classList.contains('is-entering')) return;

  const stops = slideSections.map((section) => Math.round(section.getBoundingClientRect().top + window.scrollY));
  let current = 0;
  for (let index = 1; index < stops.length; index += 1) {
    if (Math.abs(stops[index] - window.scrollY) < Math.abs(stops[current] - window.scrollY)) current = index;
  }

  const direction = isPageUp || (isSpace && event.shiftKey) ? -1 : 1;
  const next = Math.min(stops.length - 1, Math.max(0, current + direction));
  if (next === current) return;

  animateScroll(stops[next], { paging: true });
});
