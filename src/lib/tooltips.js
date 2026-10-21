// Custom tooltips for the extension's pages (editor, popup, side panel), instead of the
// browser's, which take about a second to appear. Every `title` attribute is moved to
// `data-tooltip`, also ones Vue sets or changes later, so the native tooltip never shows;
// hovering or keyboard-focusing the element shows this one after a short delay.
// The page HUD has its own copy (src/inject/hud.js), as it lives in other sites' pages.

const SHOW_DELAY_MS = 120;
const GAP = 6;
const EDGE = 6;

let tip = null;
let anchor = null;
let showTimer = null;

// The title moves to data-tooltip; it still names icon-only controls for screen readers.
const adopt = (el) => {
  const title = el.getAttribute('title');
  el.removeAttribute('title');
  if (!title) {
    el.removeAttribute('data-tooltip');
    return;
  }
  el.setAttribute('data-tooltip', title);
  if (!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', title.split('\n')[0]);
};

// <option> titles stay native: they show inside the browser's own dropdown.
const adoptAll = (root) => {
  if (root.nodeType !== 1) return;
  if (root.hasAttribute('title') && root.tagName !== 'OPTION') adopt(root);
  root.querySelectorAll('[title]:not(option)').forEach(adopt);
};

const position = () => {
  if (!tip || !anchor) return;
  const box = anchor.getBoundingClientRect();
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const left = Math.min(Math.max(box.left + box.width / 2 - width / 2, EDGE), vw - width - EDGE);
  // Above the element, or below it when there's no room above.
  const above = box.top - GAP - height;
  const top = above >= EDGE ? above : Math.min(box.bottom + GAP, vh - height - EDGE);
  tip.style.left = `${Math.max(left, EDGE)}px`;
  tip.style.top = `${Math.max(top, EDGE)}px`;
};

const hide = () => {
  clearTimeout(showTimer);
  showTimer = null;
  anchor = null;
  if (tip) tip.classList.remove('is-visible');
};

const show = (el) => {
  const text = el.getAttribute('data-tooltip');
  if (!text) return;
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'app-tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }
  anchor = el;
  tip.textContent = text;
  tip.classList.add('is-visible');
  position();
};

const schedule = (el) => {
  if (el === anchor) return;
  hide();
  if (!el) return;
  showTimer = setTimeout(() => show(el), SHOW_DELAY_MS);
};

const tooltipTarget = (node) => (node instanceof Element ? node.closest('[data-tooltip], [title]:not(option)') : null);

export function installTooltips() {
  adoptAll(document.body);
  new MutationObserver((all) => {
    // Changes to the tooltip itself would otherwise come back here.
    const mutations = all.filter(mutation => !tip || !tip.contains(mutation.target));
    if (mutations.length === 0) return;
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        if (mutation.target.hasAttribute('title') && mutation.target.tagName !== 'OPTION') adopt(mutation.target);
      } else {
        mutation.addedNodes.forEach(adoptAll);
      }
    });
    // The element under the pointer may have been replaced or its text changed.
    if (anchor && !anchor.isConnected) hide();
    else if (anchor && tip) {
      const text = anchor.getAttribute('data-tooltip') || '';
      if (!text) hide();
      else if (text !== tip.textContent) {
        tip.textContent = text;
        position();
      }
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });

  document.addEventListener('pointerover', (e) => {
    const el = tooltipTarget(e.target);
    if (el?.hasAttribute('title')) adopt(el);
    schedule(el);
  }, true);
  document.addEventListener('pointerout', (e) => {
    if (anchor && !anchor.contains(e.relatedTarget)) hide();
  }, true);
  document.addEventListener('focusin', (e) => {
    if (e.target.matches?.(':focus-visible')) schedule(tooltipTarget(e.target));
  }, true);
  document.addEventListener('focusout', hide, true);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', hide, true);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
}
