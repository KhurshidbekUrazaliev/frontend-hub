/**
 * Designs placed through the admin panel live in content/designs.json.
 * The public pages only ever see the published ones.
 */

export const DESIGN_TYPES = {
  image: 'Image',
  video: 'Video',
  link: 'Live site',
  code: 'Live code',
};

/** A design keeps every file it was given; each kind of design reads the ones it needs. */
export const imagesOf = (design) => (design.media || []).filter((item) => item.kind === 'image');
export const videoOf = (design) => (design.media || []).find((item) => item.kind === 'video') || null;

export async function loadDesigns({ drafts = false } = {}) {
  try {
    const response = await fetch('./content/designs.json', { cache: 'no-cache' });
    if (!response.ok) return [];
    const data = await response.json();
    const list = Array.isArray(data?.designs) ? data.designs : [];
    return list.filter((design) => drafts || design.published).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch {
    return [];
  }
}

/**
 * A complete HTML document for a "live code" design. It runs in a sandboxed
 * frame with no access to this site: scripts allowed, same-origin not.
 */
export function codeDocument(code = {}) {
  const { html = '', css = '', js = '' } = code;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
html, body { height: 100%; margin: 0; }
body { display: grid; place-items: center; background: #0a1014; color: #eef3f4; font-family: system-ui, sans-serif; }
${css}
</style>
</head>
<body>
${html}
<script type="module">
${js.replace(/<\/script/gi, '<\\/script')}
</script>
</body>
</html>`;
}

export const hostOf = (url) => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/* ---------- pieces for showing a few designs outside the gallery ---------- */

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** Featured designs first; if none are featured, the first published ones. */
export async function featuredDesigns(limit = 3) {
  const all = await loadDesigns();
  const featured = all.filter((design) => design.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

export const designType = (design) => DESIGN_TYPES[design.type] || design.type;
export const designHref = (design) => `./designs.html#${design.slug}`;

/** The picture for a design: its cover, a muted video, or a sandboxed live preview. */
export function designMedia(design) {
  const title = escapeHtml(design.title);

  if (design.type === 'code') {
    // Sandboxed: scripts may run, but the frame cannot reach this site.
    return `<iframe sandbox="allow-scripts" loading="lazy" tabindex="-1" title="${title} preview" srcdoc="${escapeHtml(codeDocument(design.code))}"></iframe>`;
  }

  const video = design.type === 'video' ? videoOf(design) : null;
  if (video) {
    const poster = design.cover ? ` poster="${escapeHtml(design.cover)}"` : '';
    return `<video src="${escapeHtml(video.src)}"${poster} muted loop playsinline preload="metadata" aria-label="${title}"></video>`;
  }

  if (design.cover) {
    const alt = escapeHtml(imagesOf(design)[0]?.alt || design.title);
    return `<img src="${escapeHtml(design.cover)}" alt="${alt}" loading="lazy" decoding="async" />`;
  }

  return `<span class="design-blank">${escapeHtml(hostOf(design.url) || 'No cover yet')}</span>`;
}
