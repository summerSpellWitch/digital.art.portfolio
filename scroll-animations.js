(() => {
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canObserve = 'IntersectionObserver' in window;

  const observerOpts = { root: null, threshold: 0.15, rootMargin: '0px 0px -10% 0px' };

  /* ----- Image reveal ----- */
  const images = Array.from(document.querySelectorAll('img.reasonableImageSize.reveal-image'));
  for (const img of images) {
    const parentAnchor = img.closest('a');
    if (parentAnchor) parentAnchor.classList.add('reveal-imageLink');
  }

  if (images.length) {
    if (prefersReducedMotion || !canObserve) {
      for (const img of images) {
        img.classList.add('is-visible');
        const parentAnchor = img.closest('a');
        if (parentAnchor) parentAnchor.classList.add('is-visible');
      }
    } else {
      const imgObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target;
          target.classList.add('is-visible');
          const parentAnchor = target.closest('a');
          if (parentAnchor) parentAnchor.classList.add('is-visible');
          imgObserver.unobserve(target);
        }
      }, observerOpts);
      for (const img of images) imgObserver.observe(img);
    }
  }

  /* ----- Project description type-on reveal ----- */
  const paragraphs = Array.from(document.querySelectorAll('section .wrapper > p'));
  if (!paragraphs.length || prefersReducedMotion || !canObserve) return;

  function escapeHtmlText(ch) {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    return ch;
  }

  function escapeAttrValue(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function anchorOpenTag(el) {
    const parts = ['<a'];
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      parts.push(` ${attr.name}="${escapeAttrValue(attr.value)}"`);
    }
    parts.push('>');
    return parts.join('');
  }

  function walkTypingSteps(node, steps) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        for (const ch of child.textContent) steps.push({ type: 'char', ch });
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'A') {
        steps.push({ type: 'aOpen', openTag: anchorOpenTag(child) });
        walkTypingSteps(child, steps);
        steps.push({ type: 'aClose' });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walkTypingSteps(child, steps);
      }
    }
  }

  function buildTypingSteps(p) {
    const wrap = document.createElement('div');
    wrap.innerHTML = p.innerHTML;
    const steps = [];
    walkTypingSteps(wrap, steps);
    return steps;
  }

  const originalHtml = new WeakMap();
  const typingStepsFor = new WeakMap();
  const MS_PER_STEP = 10;
  const MAX_STEPS_PER_FRAME = 7;

  function playTyping(p, steps, fullHtml) {
    let pos = 0;
    let htmlBuf = '';
    let lastT = performance.now();
    p.classList.add('is-typing');

    function tick(now) {
      const elapsed = now - lastT;
      let budget = Math.min(MAX_STEPS_PER_FRAME, Math.max(1, Math.floor(elapsed / MS_PER_STEP)));
      lastT += budget * MS_PER_STEP;

      while (budget-- > 0 && pos < steps.length) {
        const s = steps[pos++];
        if (s.type === 'char') htmlBuf += escapeHtmlText(s.ch);
        else if (s.type === 'aOpen') htmlBuf += s.openTag;
        else if (s.type === 'aClose') htmlBuf += '</a>';
      }

      p.innerHTML = htmlBuf;

      if (pos >= steps.length) {
        p.innerHTML = fullHtml;
        p.style.minHeight = '';
        p.classList.remove('is-typing');
        p.classList.add('is-type-done');
        return;
      }
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  const typeObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const p = entry.target;
      typeObserver.unobserve(p);

      const fullHtml = originalHtml.get(p);
      const steps = typingStepsFor.get(p);
      if (!fullHtml || !steps || !steps.length) {
        if (fullHtml) p.innerHTML = fullHtml;
        p.style.minHeight = '';
        p.classList.add('is-type-done');
        continue;
      }
      playTyping(p, steps, fullHtml);
    }
  }, observerOpts);

  for (const p of paragraphs) {
    const fullHtml = p.innerHTML;
    const steps = buildTypingSteps(p);
    if (!steps.length) continue;

    originalHtml.set(p, fullHtml);
    typingStepsFor.set(p, steps);
    const h = p.offsetHeight;
    p.classList.add('reveal-type');
    p.innerHTML = '';
    p.style.minHeight = `${h}px`;
    typeObserver.observe(p);
  }
})();
