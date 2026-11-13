/**
 * Frontend Hub content plugin.
 *
 * Designs placed through the admin panel are plain files in the project:
 *
 *   content/designs.json          the index (one record per design)
 *   content/media/<id>/<file>     uploaded images and videos
 *
 * In development this plugin serves those files at /content/* and exposes a
 * small write API at /api/* for the admin panel. At build time it copies only
 * the PUBLISHED designs and their media into the output folder, so drafts
 * never ship. There is no write API in a production build.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov']);
const TYPES = new Set(['image', 'video', 'link', 'code']);
const ID_PATTERN = /^d-[a-z0-9]{8,16}$/;
const MAX_UPLOAD = 300 * 1024 * 1024; // 300 MB
const MAX_JSON = 2 * 1024 * 1024;

const text = (value, max) => String(value ?? '').trim().slice(0, max);
const slugify = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export default function contentPlugin() {
  let root = process.cwd();
  let outDir = 'dist';
  let command = 'serve';

  const paths = () => {
    const contentDir = path.join(root, 'content');
    return {
      contentDir,
      dataFile: path.join(contentDir, 'designs.json'),
      mediaDir: path.join(contentDir, 'media'),
      trashDir: path.join(root, '.trash', 'designs'),
    };
  };

  /* ---------- data file ---------- */

  async function readData() {
    try {
      const data = JSON.parse(await fsp.readFile(paths().dataFile, 'utf8'));
      return { version: 1, designs: Array.isArray(data.designs) ? data.designs : [] };
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, designs: [] };
      throw error;
    }
  }

  // Writes are serialised and atomic: a crash can never leave half a file.
  let queue = Promise.resolve();
  function mutate(change) {
    const run = queue.then(async () => {
      const data = await readData();
      const result = await change(data);
      const { contentDir, dataFile } = paths();
      await fsp.mkdir(contentDir, { recursive: true });
      const temp = `${dataFile}.${randomBytes(4).toString('hex')}.tmp`;
      await fsp.writeFile(temp, `${JSON.stringify(data, null, 2)}\n`);
      await fsp.rename(temp, dataFile);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  const mediaPrefix = (id) => `./content/media/${id}/`;
  const ownsMedia = (src, id) =>
    typeof src === 'string' && src.startsWith(mediaPrefix(id)) && !src.includes('..') && !src.includes('\\');

  /** Accept only known fields, in known shapes. */
  function applyFields(design, input) {
    if ('title' in input) design.title = text(input.title, 140) || 'Untitled design';
    if ('summary' in input) design.summary = text(input.summary, 2000);
    if ('type' in input && TYPES.has(input.type)) design.type = input.type;
    if ('tags' in input) {
      const tags = (Array.isArray(input.tags) ? input.tags : []).map((tag) => text(tag, 32).toLowerCase());
      design.tags = [...new Set(tags.filter(Boolean))].slice(0, 12);
    }
    if ('url' in input) {
      const url = text(input.url, 2000);
      design.url = /^https?:\/\//i.test(url) ? url : '';
    }
    if ('code' in input) {
      design.code = {
        html: String(input.code?.html ?? '').slice(0, 200_000),
        css: String(input.code?.css ?? '').slice(0, 200_000),
        js: String(input.code?.js ?? '').slice(0, 200_000),
      };
    }
    if ('media' in input) {
      design.media = (Array.isArray(input.media) ? input.media : [])
        .filter((item) => ownsMedia(item?.src, design.id))
        .slice(0, 40)
        .map((item) => ({
          src: item.src,
          kind: item.kind === 'video' ? 'video' : 'image',
          width: Math.max(0, Math.round(Number(item.width) || 0)),
          height: Math.max(0, Math.round(Number(item.height) || 0)),
          alt: text(item.alt, 300),
        }));
    }
    if ('cover' in input) design.cover = ownsMedia(input.cover, design.id) ? input.cover : '';
    if ('published' in input) design.published = Boolean(input.published);
    if ('featured' in input) design.featured = Boolean(input.featured);
    return design;
  }

  function uniqueSlug(designs, design) {
    const base = slugify(design.title) || 'design';
    const taken = new Set(designs.filter((other) => other.id !== design.id).map((other) => other.slug));
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    return slug;
  }

  /* ---------- http helpers ---------- */

  const send = (res, status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };

  function readJson(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_JSON) {
          reject(Object.assign(new Error('Request body too large'), { status: 413 }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
        } catch {
          reject(Object.assign(new Error('Body is not valid JSON'), { status: 400 }));
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * The write API is for the admin page only. A custom header means a foreign
   * website cannot call it without a CORS preflight, which is never granted;
   * the origin checks reject anything that is not this dev server itself.
   */
  function fromAdmin(req) {
    if (req.headers['x-fh-admin'] !== '1') return false;
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin') return false;
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) return false;
      } catch {
        return false;
      }
    }
    return true;
  }

  /* ---------- static: /content/* ---------- */

  async function serveContent(pathname, req, res) {
    const { contentDir } = paths();
    const relative = pathname.slice('/content/'.length);
    const file = path.join(contentDir, relative);
    if (path.relative(contentDir, file).startsWith('..')) return send(res, 403, { error: 'Forbidden' });

    if (relative === 'designs.json') {
      // The public pages only ever receive published designs.
      const data = await readData();
      const all = fromAdmin(req);
      return send(res, 200, { version: 1, designs: all ? data.designs : data.designs.filter((d) => d.published) });
    }

    let stat;
    try {
      stat = await fsp.stat(file);
    } catch {
      return send(res, 404, { error: 'Not found' });
    }
    const type = MIME[path.extname(file).toLowerCase()];
    if (!stat.isFile() || !type) return send(res, 404, { error: 'Not found' });

    res.setHeader('Content-Type', type);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
    // An uploaded SVG opened directly must not be able to run script on this origin.
    if (type === 'image/svg+xml') res.setHeader('Content-Security-Policy', "script-src 'none'; sandbox");

    // Range requests, so videos can seek.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : stat.size - 1;
      start = Math.max(0, start);
      end = Math.min(stat.size - 1, end);
      if (start > end) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${stat.size}`);
        return res.end();
      }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', end - start + 1);
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }

    res.statusCode = 200;
    res.setHeader('Content-Length', stat.size);
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file).pipe(res);
  }

  /* ---------- api: /api/* ---------- */

  async function moveToTrash(source, label) {
    try {
      await fsp.access(source);
    } catch {
      return null;
    }
    const { trashDir } = paths();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(trashDir, `${stamp}-${label}`);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.rename(source, target);
    return target;
  }

  async function saveUpload(id, originalName, req) {
    const rawExtension = path.extname(originalName);
    const extension = rawExtension.toLowerCase();
    const kind = IMAGE_EXT.has(extension) ? 'image' : VIDEO_EXT.has(extension) ? 'video' : null;
    if (!kind) throw Object.assign(new Error(`Files of type "${extension || 'unknown'}" are not accepted`), { status: 415 });
    if (Number(req.headers['content-length'] || 0) > MAX_UPLOAD) {
      throw Object.assign(new Error('File is larger than 300 MB'), { status: 413 });
    }

    const dir = path.join(paths().mediaDir, id);
    await fsp.mkdir(dir, { recursive: true });

    const stem = slugify(path.basename(originalName, rawExtension)) || 'file';
    let name = `${stem}${extension}`;
    for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${stem}-${n}${extension}`;

    const file = path.join(dir, name);
    const partial = `${file}.part`;
    let size = 0;

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(partial);
      const fail = (error) => {
        out.destroy();
        fsp.rm(partial, { force: true }).finally(() => reject(error));
      };
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_UPLOAD) {
          req.destroy();
          fail(Object.assign(new Error('File is larger than 300 MB'), { status: 413 }));
        }
      });
      req.on('aborted', () => fail(Object.assign(new Error('Upload was interrupted'), { status: 400 })));
      req.on('error', fail);
      out.on('error', fail);
      out.on('finish', resolve);
      req.pipe(out);
    });

    if (!size) {
      await fsp.rm(partial, { force: true });
      throw Object.assign(new Error('The file was empty'), { status: 400 });
    }
    await fsp.rename(partial, file);
    return { src: `${mediaPrefix(id)}${name}`, name, size, kind };
  }

  async function api(url, req, res) {
    if (!fromAdmin(req)) return send(res, 403, { error: 'The content API only answers the local admin panel.' });

    const parts = url.pathname.split('/').filter(Boolean).slice(1); // after "api"
    const [resource, id, extra] = parts;
    const method = req.method;

    if (resource === 'designs' && !id && method === 'GET') {
      return send(res, 200, await readData());
    }

    if (resource === 'designs' && !id && method === 'POST') {
      const input = await readJson(req);
      const design = await mutate((data) => {
        const now = new Date().toISOString();
        const created = applyFields(
          {
            id: `d-${randomBytes(6).toString('hex')}`,
            slug: '',
            type: 'image',
            title: 'Untitled design',
            summary: '',
            tags: [],
            url: '',
            code: { html: '', css: '', js: '' },
            media: [],
            cover: '',
            published: false,
            featured: false,
            order: Math.min(0, ...data.designs.map((d) => d.order ?? 0)) - 1, // newest first
            createdAt: now,
            updatedAt: now,
          },
          input,
        );
        created.slug = uniqueSlug(data.designs, created);
        data.designs.push(created);
        return created;
      });
      return send(res, 201, { design });
    }

    if (resource === 'designs' && id === 'reorder' && method === 'POST') {
      const { ids } = await readJson(req);
      if (!Array.isArray(ids)) return send(res, 400, { error: 'Expected { ids: [...] }' });
      await mutate((data) => {
        const position = new Map(ids.map((value, index) => [value, index]));
        for (const design of data.designs) {
          if (position.has(design.id)) design.order = position.get(design.id);
        }
      });
      return send(res, 200, { ok: true });
    }

    if (!ID_PATTERN.test(id || '')) return send(res, 404, { error: 'Not found' });

    if (resource === 'designs' && method === 'PUT') {
      const input = await readJson(req);
      const design = await mutate((data) => {
        const existing = data.designs.find((d) => d.id === id);
        if (!existing) return null;
        applyFields(existing, input);
        existing.slug = uniqueSlug(data.designs, existing);
        existing.updatedAt = new Date().toISOString();
        return existing;
      });
      return design ? send(res, 200, { design }) : send(res, 404, { error: 'No such design' });
    }

    if (resource === 'designs' && method === 'DELETE') {
      const removed = await mutate((data) => {
        const index = data.designs.findIndex((d) => d.id === id);
        return index < 0 ? null : data.designs.splice(index, 1)[0];
      });
      if (!removed) return send(res, 404, { error: 'No such design' });

      // Nothing is destroyed: the record and its media go to .trash in the project.
      const { mediaDir, trashDir } = paths();
      const moved = await moveToTrash(path.join(mediaDir, id), id);
      const folder = moved || path.join(trashDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${id}`);
      await fsp.mkdir(folder, { recursive: true });
      await fsp.writeFile(path.join(folder, 'design.json'), `${JSON.stringify(removed, null, 2)}\n`);
      return send(res, 200, { ok: true, trash: path.relative(root, folder) });
    }

    if (resource === 'upload' && method === 'POST') {
      const data = await readData();
      if (!data.designs.some((d) => d.id === id)) return send(res, 404, { error: 'No such design' });
      const saved = await saveUpload(id, url.searchParams.get('name') || 'file', req);
      return send(res, 201, saved);
    }

    if (resource === 'media' && method === 'DELETE' && extra) {
      const name = path.basename(decodeURIComponent(extra));
      const file = path.join(paths().mediaDir, id, name);
      const moved = await moveToTrash(file, `${id}-${name}`);
      return send(res, moved ? 200 : 404, moved ? { ok: true } : { error: 'No such file' });
    }

    return send(res, 404, { error: 'Not found' });
  }

  /* ---------- plugin ---------- */

  return {
    name: 'frontend-hub-content',

    configResolved(config) {
      root = config.root;
      outDir = path.resolve(root, config.build.outDir);
      command = config.command;
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        let url;
        try {
          url = new URL(req.url, 'http://localhost');
        } catch {
          return next();
        }
        const pathname = decodeURIComponent(url.pathname);
        const isContent = pathname.startsWith('/content/');
        const isApi = pathname.startsWith('/api/');
        if (!isContent && !isApi) return next();

        try {
          if (isContent) await serveContent(pathname, req, res);
          else await api(url, req, res);
        } catch (error) {
          if (!res.headersSent) send(res, error.status || 500, { error: error.message || 'Something went wrong' });
          else res.end();
          if (!error.status) console.error('[content]', error);
        }
      });
    },

    // Ship published designs with the build; drafts stay on this machine.
    async closeBundle() {
      if (command !== 'build') return;
      const { mediaDir } = paths();
      const data = await readData();
      const published = data.designs.filter((design) => design.published);
      const target = path.join(outDir, 'content');
      await fsp.mkdir(target, { recursive: true });
      await fsp.writeFile(path.join(target, 'designs.json'), JSON.stringify({ version: 1, designs: published }));
      for (const design of published) {
        const source = path.join(mediaDir, design.id);
        if (fs.existsSync(source)) await fsp.cp(source, path.join(target, 'media', design.id), { recursive: true });
      }
    },
  };
}
