/**
 * Frontend Hub — admin panel.
 *
 * A local tool for placing designs. It talks to the content API that the dev
 * server exposes (see plugins/content.js) and autosaves every change into
 * plain files under content/. There is no build step and no account.
 */

import { $, $$, escapeHtml, icon, toast } from '../core/dom.js';
import { DESIGN_TYPES, codeDocument } from '../core/designs-data.js';

const KINDS = ['image', 'video', 'link', 'code'];
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';

const isImage = (file) => /^image\/(png|jpeg|webp|avif|gif|svg\+xml)$/.test(file.type) || /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(file.name || '');
const isVideo = (file) => /^video\/(mp4|webm|quicktime)$/.test(file.type) || /\.(mp4|webm|mov)$/i.test(file.name || '');

const els = {
  list: $('[data-list]'),
  main: $('[data-main]'),
  total: $('[data-total]'),
  status: $('[data-status]'),
  veil: $('[data-veil]'),
  confirm: $('[data-confirm]'),
  sampleNote: $('[data-sample-note]'),
};

const store = { designs: [], selected: null };
const current = () => store.designs.find((design) => design.id === store.selected) || null;

const imagesOf = (design) => design.media.filter((item) => item.kind === 'image');
const videoOf = (design) => design.media.find((item) => item.kind === 'video');
const fileName = (src) => src.split('/').pop();
const titleFromFile = (name) => {
  const stem = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return stem ? stem[0].toUpperCase() + stem.slice(1) : 'Untitled design';
};

/* ================= API ================= */

// The custom header is what tells the dev server this request comes from the admin page.
const HEADERS = { 'X-FH-Admin': '1' };

async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body ? { ...HEADERS, 'Content-Type': 'application/json' } : HEADERS,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('The dev server is not answering. Is it still running?');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

/** XHR rather than fetch, because uploads need progress events. */
function uploadFile(id, file, { name = file.name, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `./api/upload/${id}?name=${encodeURIComponent(name)}`);
    xhr.setRequestHeader('X-FH-Admin', '1');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Is the dev server still running?'));
    xhr.send(file);
  });
}

const trashFile = (design, src) =>
  api(`./api/media/${design.id}/${encodeURIComponent(fileName(src))}`, { method: 'DELETE' }).catch(() => {});

/* ================= Status + autosave ================= */

function setStatus(text, kind = '') {
  els.status.textContent = text;
  els.status.dataset.kind = kind;
}

const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const saveTimers = new Map();
const saveChains = new Map();

/** Everything the editor can change. The server ignores anything else. */
const editable = (design) => ({
  title: design.title,
  summary: design.summary,
  type: design.type,
  tags: design.tags,
  url: design.url,
  code: design.code,
  media: design.media,
  cover: design.cover,
  published: design.published,
  featured: design.featured,
});

function save(design) {
  clearTimeout(saveTimers.get(design.id));
  saveTimers.delete(design.id);
  setStatus('Saving', 'busy');

  // One save at a time per design, in order, so a slow request can never overwrite a newer one.
  const run = (saveChains.get(design.id) || Promise.resolve())
    .then(() => api(`./api/designs/${design.id}`, { method: 'PUT', body: editable(design) }))
    .then(({ design: saved }) => {
      design.slug = saved.slug;
      design.updatedAt = saved.updatedAt;
      if (!saveTimers.size) setStatus(`Saved ${clock()}`, 'ok');
      if (design.id === store.selected) refreshViewLink(design);
    })
    .catch((error) => setStatus(`Not saved: ${error.message}`, 'error'));
  saveChains.set(design.id, run);
  return run;
}

function scheduleSave(design, delay = 650) {
  clearTimeout(saveTimers.get(design.id));
  setStatus('Editing', 'busy');
  saveTimers.set(
    design.id,
    setTimeout(() => save(design), delay),
  );
}

window.addEventListener('beforeunload', (e) => {
  if (saveTimers.size) e.preventDefault(); // a change is still waiting to be written
});

/* ================= Sidebar list ================= */

function thumbOf(design) {
  if (design.type !== 'code' && design.cover) return `<img src="${escapeHtml(design.cover)}" alt="" />`;
  return icon(design.type);
}

function renderList() {
  els.total.textContent = store.designs.length;
  els.sampleNote.hidden = !store.designs.some((design) => design.tags?.includes('sample'));
  els.list.innerHTML = store.designs
    .map((design) => {
      const selected = design.id === store.selected;
      return `
      <li class="row${selected ? ' is-selected' : ''}" data-id="${design.id}" draggable="true">
        <button class="row__main" type="button"${selected ? ' aria-current="true"' : ''}>
          <span class="row__thumb">${thumbOf(design)}</span>
          <span class="row__text">
            <span class="row__title">${escapeHtml(design.title || 'Untitled design')}</span>
            <span class="label row__meta"><i class="dot${design.published ? ' dot--live' : ''}"></i>${DESIGN_TYPES[design.type]} · ${design.published ? 'Published' : 'Draft'}</span>
          </span>
        </button>
        ${design.published && design.featured ? `<span class="row__star" title="Shown on the landing page">${icon('star')}</span>` : ''}
      </li>`;
    })
    .join('');
}

function select(id) {
  store.selected = id;
  window.history.replaceState(null, '', id ? `#${id}` : window.location.pathname);
  renderList();
  renderMain();
}

async function persistOrder() {
  store.designs.forEach((design, index) => (design.order = index));
  renderList();
  try {
    await api('./api/designs/reorder', { method: 'POST', body: { ids: store.designs.map((design) => design.id) } });
    setStatus(`Saved ${clock()}`, 'ok');
  } catch (error) {
    setStatus(`Order not saved: ${error.message}`, 'error');
  }
}

function moveDesign(id, toIndex) {
  const from = store.designs.findIndex((design) => design.id === id);
  if (from < 0) return;
  const [design] = store.designs.splice(from, 1);
  store.designs.splice(Math.max(0, Math.min(store.designs.length, toIndex)), 0, design);
  persistOrder();
}

els.list.addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (row && row.dataset.id !== store.selected) select(row.dataset.id);
});

// Alt + arrows reorder from the keyboard.
els.list.addEventListener('keydown', (e) => {
  const row = e.target.closest('.row');
  const step = { ArrowUp: -1, ArrowDown: 1 }[e.key];
  if (!row || !step || !e.altKey) return;
  e.preventDefault();
  const index = store.designs.findIndex((design) => design.id === row.dataset.id);
  moveDesign(row.dataset.id, index + step);
  $(`.row[data-id="${row.dataset.id}"] .row__main`, els.list)?.focus();
});

// Drag rows to reorder.
let draggedRow = null;
const clearRowMarks = () => $$('.row', els.list).forEach((row) => row.classList.remove('is-over-before', 'is-over-after'));

els.list.addEventListener('dragstart', (e) => {
  const row = e.target.closest('.row');
  if (!row) return;
  draggedRow = row.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedRow);
  requestAnimationFrame(() => row.classList.add('is-dragging'));
});
els.list.addEventListener('dragover', (e) => {
  const row = e.target.closest('.row');
  if (!draggedRow || !row) return;
  e.preventDefault();
  clearRowMarks();
  const box = row.getBoundingClientRect();
  row.classList.add(e.clientY < box.top + box.height / 2 ? 'is-over-before' : 'is-over-after');
});
els.list.addEventListener('drop', (e) => {
  const row = e.target.closest('.row');
  if (!draggedRow || !row) return;
  e.preventDefault();
  const after = row.classList.contains('is-over-after');
  const id = draggedRow;
  if (row.dataset.id !== id) {
    const without = store.designs.filter((design) => design.id !== id);
    const target = without.findIndex((design) => design.id === row.dataset.id) + (after ? 1 : 0);
    moveDesign(id, target);
  }
});
els.list.addEventListener('dragend', () => {
  draggedRow = null;
  clearRowMarks();
  $$('.row', els.list).forEach((row) => row.classList.remove('is-dragging'));
});

/* ================= Media helpers ================= */

function imageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const done = (width, height) => {
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    image.onload = () => done(image.naturalWidth, image.naturalHeight);
    image.onerror = () => done(0, 0);
    image.src = url;
  });
}

function captureFrame(video) {
  return new Promise((resolve) => {
    const scale = Math.min(1, 1600 / (video.videoWidth || 1600));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    if (!canvas.width || !canvas.height) return resolve(null);
    try {
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.86);
    } catch {
      resolve(null);
    }
  });
}

/** Read a video's size and grab an early frame to use as its cover. */
function probeVideo(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let settled = false;
    const done = (poster) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ width: video.videoWidth || 0, height: video.videoHeight || 0, poster });
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => done(null), 8000); // some codecs will not decode here; carry on without a cover
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('loadeddata', () => (video.currentTime = Math.min(1, (video.duration || 2) * 0.15)), {
      once: true,
    });
    video.addEventListener('seeked', () => captureFrame(video).then(done), { once: true });
    video.addEventListener('error', () => done(null), { once: true });
    video.src = url;
  });
}

/** For image designs the cover is simply the first frame. */
function syncCover(design) {
  if (design.type === 'image') design.cover = imagesOf(design)[0]?.src || '';
}

/** Swap in a new stand-alone cover file, binning the one it replaces. */
function replaceCover(design, src) {
  const old = design.cover;
  design.cover = src;
  if (old && old !== src && !design.media.some((item) => item.src === old)) trashFile(design, old);
}

/* ---------- upload feedback in the active drop zone ---------- */

function showProgress(text, fraction) {
  const zone = $('[data-dropzone]', els.main);
  if (!zone) return;
  const title = $('.drop__title', zone);
  if (title) title.textContent = text;
  let bar = $('.drop__progress', zone);
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'drop__progress';
    bar.innerHTML = '<i></i>';
    zone.append(bar);
  }
  bar.firstElementChild.style.setProperty('--p', fraction.toFixed(3));
}

async function addImages(design, files) {
  const images = files.filter(isImage);
  if (!images.length) {
    toast('Those files are not images');
    return;
  }
  setStatus('Uploading', 'busy');
  try {
    for (let i = 0; i < images.length; i++) {
      const label = images.length > 1 ? `Uploading ${i + 1} of ${images.length}` : 'Uploading';
      showProgress(label, 0);
      const [saved, size] = await Promise.all([
        uploadFile(design.id, images[i], { onProgress: (p) => showProgress(label, p) }),
        imageSize(images[i]),
      ]);
      design.media.push({ src: saved.src, kind: 'image', width: size.width, height: size.height, alt: '' });
    }
  } catch (error) {
    toast(error.message);
  }
  syncCover(design);
  refreshMedia(design);
  await save(design);
  renderList();
}

async function setVideo(design, file) {
  if (!isVideo(file)) {
    toast('That file is not a video');
    return;
  }
  setStatus('Uploading', 'busy');
  try {
    showProgress('Uploading video', 0);
    const probing = probeVideo(file);
    const saved = await uploadFile(design.id, file, { onProgress: (p) => showProgress('Uploading video', p) });
    const info = await probing;

    const previous = videoOf(design);
    if (previous) {
      design.media = design.media.filter((item) => item !== previous);
      trashFile(design, previous.src);
    }
    design.media.push({ src: saved.src, kind: 'video', width: info.width, height: info.height, alt: '' });

    if (info.poster) {
      const cover = await uploadFile(design.id, info.poster, { name: 'cover.jpg' });
      replaceCover(design, cover.src);
    }
  } catch (error) {
    toast(error.message);
  }
  refreshMedia(design);
  await save(design);
  renderList();
}

async function setCoverImage(design, file) {
  if (!isImage(file)) {
    toast('A cover has to be an image');
    return;
  }
  setStatus('Uploading', 'busy');
  try {
    showProgress('Uploading cover', 0);
    const saved = await uploadFile(design.id, file, {
      name: `cover-${file.name || 'image.png'}`,
      onProgress: (p) => showProgress('Uploading cover', p),
    });
    replaceCover(design, saved.src);
  } catch (error) {
    toast(error.message);
  }
  refreshMedia(design);
  await save(design);
  renderList();
}

function handleFiles(design, files, purpose) {
  if (purpose === 'video') return setVideo(design, files.find(isVideo) || files[0]);
  if (purpose === 'cover') return setCoverImage(design, files.find(isImage) || files[0]);
  return addImages(design, files);
}

/* ================= Editor ================= */

function tagsMarkup(design) {
  return `${design.tags
    .map(
      (tag, i) =>
        `<span class="tagchip">${escapeHtml(tag)}<button type="button" data-remove-tag="${i}" aria-label="Remove tag ${escapeHtml(tag)}">${icon('close')}</button></span>`,
    )
    .join('')}<input class="tags__input" type="text" maxlength="32" aria-labelledby="tags-label"
      placeholder="${design.tags.length ? 'Add another' : 'Type a tag, press Enter'}" data-tag-input />`;
}

const dropZone = (purpose, title, hint, accept, multiple = false) => `
  <div class="drop" data-dropzone="${purpose}" role="button" tabindex="0">
    <p class="drop__title">${title}</p>
    <p class="label">${hint}</p>
    <input type="file" accept="${accept}"${multiple ? ' multiple' : ''} hidden data-file="${purpose}" />
  </div>`;

function imageArea(design) {
  const frames = imagesOf(design);
  return `
    ${dropZone('image', frames.length ? 'Add more images' : 'Drop images here', 'Paste from the clipboard, or <u>browse</u> · PNG, JPG, WebP, AVIF, GIF, SVG', IMAGE_ACCEPT, true)}
    ${
      frames.length
        ? `<ol class="frames">${frames
            .map(
              (item, i) => `
        <li class="frame">
          <div class="frame__img">
            <img src="${escapeHtml(item.src)}" alt="" />
            ${i === 0 ? '<span class="label frame__badge">Cover</span>' : ''}
          </div>
          <input class="input input--sm" type="text" maxlength="300" value="${escapeHtml(item.alt || '')}"
            placeholder="Alt text: what is in this image?" aria-label="Alt text for image ${i + 1}" data-alt="${escapeHtml(item.src)}" />
          <div class="frame__tools">
            <button class="tool" type="button" data-move-frame="-1" data-src="${escapeHtml(item.src)}" aria-label="Move image ${i + 1} earlier"${i === 0 ? ' disabled' : ''}>${icon('back')}</button>
            <button class="tool" type="button" data-move-frame="1" data-src="${escapeHtml(item.src)}" aria-label="Move image ${i + 1} later"${i === frames.length - 1 ? ' disabled' : ''}>${icon('arrow')}</button>
            <button class="tool tool--danger" type="button" data-remove-media="${escapeHtml(item.src)}" aria-label="Remove image ${i + 1}">Remove</button>
          </div>
        </li>`,
            )
            .join('')}</ol>
        <p class="hint">The first image is the cover. Use the arrows to change the order.</p>`
        : ''
    }`;
}

function videoArea(design) {
  const video = videoOf(design);
  if (!video) return dropZone('video', 'Drop a video here', 'Or <u>browse</u> · MP4, WebM, MOV · up to 300 MB', VIDEO_ACCEPT);
  return `
    <div class="vid">
      <video src="${escapeHtml(video.src)}" controls playsinline preload="metadata" data-video></video>
      <div class="vid__tools">
        <button class="tool" type="button" data-capture>Use this frame as the cover</button>
        <button class="tool" type="button" data-browse="video">Replace video</button>
        <input type="file" accept="${VIDEO_ACCEPT}" hidden data-file="video" />
      </div>
      ${
        design.cover
          ? `<figure class="cover cover--small"><img src="${escapeHtml(design.cover)}" alt="" /><figcaption class="label">Cover</figcaption></figure>`
          : '<p class="hint">No cover yet. Pause on a good frame and press the button above.</p>'
      }
    </div>`;
}

function linkArea(design) {
  if (!design.cover) {
    return dropZone('cover', 'Drop a cover image', 'A screenshot of the site works well · or <u>browse</u>', IMAGE_ACCEPT);
  }
  return `
    <figure class="cover">
      <img src="${escapeHtml(design.cover)}" alt="" />
      <figcaption class="cover__tools">
        <button class="tool" type="button" data-browse="cover">Replace cover</button>
        <button class="tool tool--danger" type="button" data-remove-cover>Remove cover</button>
        <input type="file" accept="${IMAGE_ACCEPT}" hidden data-file="cover" />
      </figcaption>
    </figure>`;
}

let codeTab = 'html';

function codeArea(design) {
  const labels = { html: 'HTML', css: 'CSS', js: 'JS' };
  return `
    <div class="code-ed">
      <div class="code-ed__tabs" role="tablist" aria-label="Source files">
        ${Object.keys(labels)
          .map(
            (key) =>
              `<button class="code-ed__tab" type="button" role="tab" aria-selected="${key === codeTab}" data-code-tab="${key}">${labels[key]}</button>`,
          )
          .join('')}
      </div>
      ${Object.keys(labels)
        .map(
          (key) =>
            `<textarea data-code="${key}" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${labels[key]} source"${key === codeTab ? '' : ' hidden'}>${escapeHtml(design.code?.[key] || '')}</textarea>`,
        )
        .join('')}
    </div>
    <p class="hint">Runs in an isolated frame with no access to the site. Load a library with a script tag or an import from a CDN. Tab indents; press Esc, then Tab, to leave the editor.</p>
    <div class="preview">
      <p class="label">Live preview</p>
      <iframe sandbox="allow-scripts" title="Live preview" data-preview></iframe>
    </div>`;
}

const AREAS = { image: imageArea, video: videoArea, link: linkArea, code: codeArea };

function refreshPreview(design) {
  const frame = $('[data-preview]', els.main);
  if (frame) frame.srcdoc = codeDocument(design.code);
}

function refreshMedia(design) {
  if (design.id !== store.selected) return;
  const area = $('[data-media]', els.main);
  if (!area) return;
  area.innerHTML = AREAS[design.type](design);
  if (design.type === 'code') refreshPreview(design);
}

function refreshViewLink(design) {
  const link = $('[data-view]', els.main);
  if (!link) return;
  link.href = `./designs.html#${design.slug}`;
  link.setAttribute('aria-disabled', String(!design.published));
  $('span', link).textContent = design.published ? 'View on the site' : 'Publish to view on the site';
}

function renderEditor(design) {
  els.main.innerHTML = `
    <form class="ed" data-editor novalidate autocomplete="off">
      <header class="ed__head">
        <div class="seg" role="radiogroup" aria-label="Kind of design">
          ${KINDS.map(
            (kind) => `
            <label class="seg__opt">
              <input type="radio" name="type" value="${kind}"${design.type === kind ? ' checked' : ''} />
              <span>${icon(kind)}${DESIGN_TYPES[kind]}</span>
            </label>`,
          ).join('')}
        </div>
        <div class="ed__flags">
          <label class="switch">
            <input type="checkbox" name="published"${design.published ? ' checked' : ''} />
            <span class="switch__ui"></span><span class="switch__text">Published</span>
          </label>
          <label class="switch">
            <input type="checkbox" name="featured"${design.featured ? ' checked' : ''}${design.published ? '' : ' disabled'} />
            <span class="switch__ui"></span><span class="switch__text">On the landing page</span>
          </label>
        </div>
      </header>

      <div class="ed__cols">
        <div class="ed__fields">
          <label class="field">
            <span class="label">Title</span>
            <input class="input input--title" name="title" type="text" maxlength="140" value="${escapeHtml(design.title)}" />
          </label>
          <label class="field" data-url-field${design.type === 'link' ? '' : ' hidden'}>
            <span class="label">Site address</span>
            <input class="input" name="url" type="url" inputmode="url" placeholder="https://" value="${escapeHtml(design.url || '')}" />
          </label>
          <label class="field">
            <span class="label">Summary<i>optional</i></span>
            <textarea class="input" name="summary" maxlength="2000" rows="5" placeholder="What is it, and what should someone notice?">${escapeHtml(design.summary || '')}</textarea>
          </label>
          <div class="field">
            <span class="label" id="tags-label">Tags</span>
            <div class="tags" data-tags>${tagsMarkup(design)}</div>
          </div>
        </div>
        <div class="ed__media" data-media></div>
      </div>

      <footer class="ed__foot">
        <a class="link" data-view target="_blank" rel="noopener"><span></span>${icon('out')}</a>
        <button class="link link--danger" type="button" data-delete>Delete design</button>
      </footer>
    </form>`;

  refreshMedia(design);
  refreshViewLink(design);
}

function renderMain() {
  const design = current();
  if (design) {
    renderEditor(design);
    return;
  }
  els.main.innerHTML = `
    <section class="adm-empty">
      <p class="label">Nothing placed yet</p>
      <h1 class="display">Place your first design.</h1>
      <p>Drop images or a video anywhere in this window, or start with a blank one and fill it in.</p>
      <div class="adm-empty__kinds">
        ${KINDS.map((kind) => `<button class="btn" type="button" data-create="${kind}">${icon(kind)}${DESIGN_TYPES[kind]}</button>`).join('')}
      </div>
    </section>`;
}

/* ================= Creating and deleting ================= */

async function createDesign(fields = {}) {
  const { design } = await api('./api/designs', { method: 'POST', body: fields });
  store.designs.unshift(design); // the server places new designs first
  select(design.id);
  return design;
}

async function createAndFocus(type = 'image') {
  try {
    await createDesign({ type });
    const title = $('input[name="title"]', els.main);
    title?.focus();
    title?.select();
    setStatus('Draft created', 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

/** Dropping files outside an editor drop zone starts a new design. */
async function placeNew(files) {
  const images = files.filter(isImage);
  const videos = files.filter(isVideo);
  if (!images.length && !videos.length) {
    toast('Drop images or a video');
    return;
  }
  try {
    if (images.length) {
      const design = await createDesign({ type: 'image', title: titleFromFile(images[0].name) });
      await addImages(design, images);
    }
    for (const file of videos) {
      const design = await createDesign({ type: 'video', title: titleFromFile(file.name) });
      await setVideo(design, file);
    }
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function confirmDelete(design) {
  $('[data-confirm-title]', els.confirm).textContent = `Delete “${design.title || 'Untitled design'}”?`;
  els.confirm.returnValue = '';
  els.confirm.showModal();
  els.confirm.addEventListener(
    'close',
    async () => {
      if (els.confirm.returnValue !== 'delete') return;
      clearTimeout(saveTimers.get(design.id));
      saveTimers.delete(design.id);
      try {
        const result = await api(`./api/designs/${design.id}`, { method: 'DELETE' });
        const index = store.designs.indexOf(design);
        store.designs.splice(index, 1);
        select(store.designs[Math.min(index, store.designs.length - 1)]?.id || null);
        setStatus(`Moved to ${result.trash || '.trash'}`, 'ok');
      } catch (error) {
        setStatus(`Not deleted: ${error.message}`, 'error');
      }
    },
    { once: true },
  );
}

$('[data-new]').addEventListener('click', () => createAndFocus('image'));

/* ================= Editor events (delegated, bound once) ================= */

let previewTimer = 0;
let leaveEditor = false; // set by Esc so the next Tab moves focus instead of indenting

els.main.addEventListener('input', (e) => {
  const design = current();
  const target = e.target;
  if (!design) return;

  if (target.name === 'title') {
    design.title = target.value;
    const rowTitle = $(`.row[data-id="${design.id}"] .row__title`, els.list);
    if (rowTitle) rowTitle.textContent = design.title || 'Untitled design';
    scheduleSave(design);
  } else if (target.name === 'summary') {
    design.summary = target.value;
    scheduleSave(design);
  } else if (target.name === 'url') {
    design.url = target.value.trim();
    scheduleSave(design);
  } else if (target.dataset.code) {
    design.code = { ...design.code, [target.dataset.code]: target.value };
    leaveEditor = false;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => refreshPreview(design), 450);
    scheduleSave(design, 900);
  } else if (target.dataset.alt !== undefined) {
    const item = design.media.find((entry) => entry.src === target.dataset.alt);
    if (item) item.alt = target.value;
    scheduleSave(design);
  }
});

els.main.addEventListener('change', (e) => {
  const design = current();
  const target = e.target;
  if (!design) return;

  if (target.name === 'type') {
    design.type = target.value;
    syncCover(design);
    $('[data-url-field]', els.main).hidden = design.type !== 'link';
    refreshMedia(design);
    save(design).then(renderList);
  } else if (target.name === 'published') {
    design.published = target.checked;
    $('input[name="featured"]', els.main).disabled = !design.published;
    refreshViewLink(design);
    save(design).then(renderList);
  } else if (target.name === 'featured') {
    design.featured = target.checked;
    save(design).then(renderList);
  } else if (target.dataset.file) {
    const files = [...target.files];
    target.value = '';
    if (files.length) handleFiles(design, files, target.dataset.file);
  }
});

// An empty title becomes "Untitled design" once you leave the field.
els.main.addEventListener('focusout', (e) => {
  const design = current();
  if (!design || e.target.name !== 'title' || e.target.value.trim()) return;
  e.target.value = design.title = 'Untitled design';
  renderList();
  scheduleSave(design, 0);
});

function addTag(design, raw) {
  const tag = raw.trim().toLowerCase().replace(/,/g, '').slice(0, 32);
  if (!tag || design.tags.includes(tag) || design.tags.length >= 12) return;
  design.tags.push(tag);
}

function refreshTags(design) {
  const host = $('[data-tags]', els.main);
  host.innerHTML = tagsMarkup(design);
  $('[data-tag-input]', host).focus();
  els.sampleNote.hidden = !store.designs.some((entry) => entry.tags?.includes('sample'));
  scheduleSave(design, 200);
}

els.main.addEventListener('keydown', (e) => {
  const design = current();
  const target = e.target;
  if (!design) return;

  if (target.matches('[data-tag-input]')) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(design, target.value);
      refreshTags(design);
    } else if (e.key === 'Backspace' && !target.value && design.tags.length) {
      design.tags.pop();
      refreshTags(design);
    }
    return;
  }

  if (target.matches('[data-code]')) {
    if (e.key === 'Escape') {
      leaveEditor = true;
    } else if (e.key === 'Tab' && !e.shiftKey && !leaveEditor) {
      e.preventDefault();
      const { selectionStart, selectionEnd, value } = target;
      target.value = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
      target.selectionStart = target.selectionEnd = selectionStart + 2;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }

  if (target.matches('[data-dropzone]') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    $('input[type="file"]', target)?.click();
  }

  if (e.key === 'Enter' && target.matches('input:not([type="checkbox"]):not([type="radio"])')) e.preventDefault();
});

els.main.addEventListener('click', async (e) => {
  const target = e.target;
  const design = current();

  const create = target.closest('[data-create]');
  if (create) {
    createAndFocus(create.dataset.create);
    return;
  }
  if (!design) return;

  const zone = target.closest('[data-dropzone]');
  if (zone && !target.matches('input')) {
    $('input[type="file"]', zone)?.click();
    return;
  }

  const browse = target.closest('[data-browse]');
  if (browse) {
    $(`[data-file="${browse.dataset.browse}"]`, els.main)?.click();
    return;
  }

  const tagsBox = target.closest('[data-tags]');
  const removeTag = target.closest('[data-remove-tag]');
  if (removeTag) {
    design.tags.splice(Number(removeTag.dataset.removeTag), 1);
    refreshTags(design);
    return;
  }
  if (tagsBox) {
    $('[data-tag-input]', tagsBox)?.focus();
    return;
  }

  const tab = target.closest('[data-code-tab]');
  if (tab) {
    codeTab = tab.dataset.codeTab;
    $$('[data-code-tab]', els.main).forEach((button) => button.setAttribute('aria-selected', String(button === tab)));
    $$('[data-code]', els.main).forEach((area) => (area.hidden = area.dataset.code !== codeTab));
    $(`[data-code="${codeTab}"]`, els.main)?.focus();
    return;
  }

  const moveFrame = target.closest('[data-move-frame]');
  if (moveFrame) {
    const frames = imagesOf(design);
    const from = frames.findIndex((item) => item.src === moveFrame.dataset.src);
    const to = from + Number(moveFrame.dataset.moveFrame);
    if (from < 0 || to < 0 || to >= frames.length) return;
    frames.splice(to, 0, frames.splice(from, 1)[0]);
    design.media = [...frames, ...design.media.filter((item) => item.kind !== 'image')];
    syncCover(design);
    refreshMedia(design);
    save(design).then(renderList);
    return;
  }

  const removeMedia = target.closest('[data-remove-media]');
  if (removeMedia) {
    const src = removeMedia.dataset.removeMedia;
    design.media = design.media.filter((item) => item.src !== src);
    trashFile(design, src);
    syncCover(design);
    refreshMedia(design);
    save(design).then(renderList);
    return;
  }

  if (target.closest('[data-remove-cover]')) {
    replaceCover(design, '');
    refreshMedia(design);
    save(design).then(renderList);
    return;
  }

  if (target.closest('[data-capture]')) {
    const video = $('[data-video]', els.main);
    const blob = video && (await captureFrame(video));
    if (!blob) {
      toast('Could not read a frame from this video');
      return;
    }
    try {
      const saved = await uploadFile(design.id, blob, { name: 'cover.jpg' });
      replaceCover(design, saved.src);
      refreshMedia(design);
      save(design).then(renderList);
      toast('Cover updated');
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  if (target.closest('[data-delete]')) confirmDelete(design);
});

// ⌘S / Ctrl+S writes immediately instead of opening the browser's save dialog.
window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
  e.preventDefault();
  const design = current();
  if (design) save(design);
});

/* ================= Dropping and pasting files ================= */

const carriesFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
let dragDepth = 0;

const endFileDrag = () => {
  dragDepth = 0;
  els.veil.hidden = true;
  $$('.drop.is-over', els.main).forEach((zone) => zone.classList.remove('is-over'));
};

window.addEventListener('dragenter', (e) => {
  if (carriesFiles(e)) dragDepth += 1;
});
window.addEventListener('dragleave', (e) => {
  if (!carriesFiles(e)) return;
  dragDepth -= 1;
  if (dragDepth <= 0) endFileDrag();
});
window.addEventListener('dragover', (e) => {
  if (!carriesFiles(e)) return;
  e.preventDefault();
  // Over a drop zone the files join the open design; anywhere else they start a new one.
  const zone = e.target.closest?.('[data-dropzone]');
  $$('.drop', els.main).forEach((el) => el.classList.toggle('is-over', el === zone));
  els.veil.hidden = Boolean(zone);
});
window.addEventListener('drop', (e) => {
  if (!carriesFiles(e)) return;
  e.preventDefault();
  const files = [...e.dataTransfer.files];
  const zone = e.target.closest?.('[data-dropzone]');
  const design = current();
  endFileDrag();
  if (!files.length) return;
  if (zone && design) handleFiles(design, files, zone.dataset.dropzone);
  else placeNew(files);
});

window.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])].filter(isImage);
  if (!files.length) return;
  e.preventDefault();
  const design = current();
  if (!design) placeNew(files);
  else if (design.type === 'image') addImages(design, files);
  else if (design.type === 'link') setCoverImage(design, files[0]);
  else toast('Switch this design to Image to paste pictures into it');
});

/* ================= Start ================= */

async function start() {
  try {
    const data = await api('./api/designs');
    store.designs = (data.designs || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const wanted = window.location.hash.slice(1);
    store.selected = store.designs.some((design) => design.id === wanted) ? wanted : store.designs[0]?.id || null;
    renderList();
    renderMain();
    setStatus('Ready', 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
    els.main.innerHTML = `
      <section class="adm-empty">
        <p class="label">Admin unavailable</p>
        <h1 class="display">Local only.</h1>
        <p>The admin panel needs the local dev server. Start it with <code>npm run dev</code> and open this page from there. ${escapeHtml(error.message)}</p>
      </section>`;
  }
}

start();
