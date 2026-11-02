export function createParticleField() {
  const canvas = document.querySelector('#particle-canvas');
  const host = document.querySelector('#shortcut-visual');
  if (!canvas || !host) return;

  const context = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = Array.from({ length: 38 }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() * 1.25 + 0.35,
    speed: Math.random() * 0.000018 + 0.000006,
    phase: Math.random() * Math.PI * 2,
    amber: index % 9 === 0,
  }));
  const pointer = { x: 0.5, y: 0.5, active: false };
  let width = 0;
  let height = 0;
  let frame = 0;
  let visible = true;
  let lastTime = 0;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(performance.now(), true);
  }

  function draw(time, still = false) {
    context.clearRect(0, 0, width, height);
    for (const particle of particles) {
      if (!still && !reducedMotion.matches) {
        particle.y -= particle.speed * Math.min(40, time - lastTime || 16);
        if (particle.y < -0.04) {
          particle.y = 1.04;
          particle.x = Math.random();
        }
      }

      let x = particle.x * width + Math.sin(time * 0.00035 + particle.phase) * 7;
      let y = particle.y * height;
      if (pointer.active && !reducedMotion.matches) {
        const dx = x - pointer.x * width;
        const dy = y - pointer.y * height;
        const distance = Math.hypot(dx, dy);
        if (distance < 120 && distance > 0) {
          const force = (1 - distance / 120) * 18;
          x += (dx / distance) * force;
          y += (dy / distance) * force;
        }
      }

      const shimmer = reducedMotion.matches ? 0.5 : 0.35 + Math.sin(time * 0.0012 + particle.phase) * 0.22;
      context.beginPath();
      context.fillStyle = particle.amber
        ? `rgba(255, 176, 32, ${Math.max(0.15, shimmer + 0.15)})`
        : `rgba(244, 243, 239, ${Math.max(0.08, shimmer * 0.55)})`;
      context.arc(x, y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    lastTime = time;
  }

  function tick(time) {
    if (visible && !document.hidden) draw(time);
    frame = requestAnimationFrame(tick);
  }

  host.addEventListener('pointermove', (event) => {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - bounds.left) / bounds.width;
    pointer.y = (event.clientY - bounds.top) / bounds.height;
    pointer.active = true;
  });
  host.addEventListener('pointerleave', () => { pointer.active = false; });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  visibilityObserver.observe(host);

  resize();
  if (!reducedMotion.matches) frame = requestAnimationFrame(tick);
  reducedMotion.addEventListener('change', (event) => {
    cancelAnimationFrame(frame);
    if (event.matches) draw(performance.now(), true);
    else frame = requestAnimationFrame(tick);
  });
}
