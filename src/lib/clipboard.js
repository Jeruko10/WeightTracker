// Clipboard API where allowed; the hidden-textarea fallback covers older browsers and
// non-secure contexts (plain http) where navigator.clipboard is unavailable.
export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* unsupported */ }
    ta.remove();
    if (ok) resolve();
    else reject(new Error('copy failed'));
  });
}
