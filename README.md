# Frontend Hub

**Interface references that run in your browser. Open one, tune it, read the source.**

Live site: **https://frontendhub.site**

Frontend Hub is a place for frontend developers, designers and UI makers to find references, examples and inspiration. Instead of screenshots it shows working code: every example runs live on the page, next to the source that drives it.

## What's inside

- **Landing page:** a photo-led hero, a 3D scroll descent through the five regions of the library, and a live stage that plays the examples one after another.
- **Library:** 12 running examples across five regions (Layout, Type, Motion, Interaction and WebGL), with search, filters and the full source of each one.
- **Designs:** a gallery of my own work, including images, videos, links to live sites and runnable code.
- **Admin panel (local only):** lets me add and publish designs from my own machine. It is never part of the deployed site.

## Built with

- [Vite](https://vite.dev/) with plain JavaScript. There is no framework.
- [GSAP](https://gsap.com/) for animation and [Lenis](https://lenis.darkroom.engineering/) for smooth scrolling.
- [Three.js](https://threejs.org/) for the 3D scenes, loaded only where a scene needs it.
- [Prism](https://prismjs.com/) for syntax highlighting.
- Fonts: Archivo, Big Shoulders Display, Newsreader and Geist Mono, all through Fontsource.

## Run it locally

You need Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Then open the address Vite prints, usually http://localhost:5173.

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Starts the dev server, admin panel included    |
| `npm run build`   | Builds the public site into `dist/`           |
| `npm run preview` | Serves the built `dist/` folder for a check   |

## Adding designs

1. Run `npm run dev` and open `/admin.html`.
2. Add a design: upload an image or video, or add a link or a code snippet.
3. Mark it as published. Drafts never go into the public build.
4. Commit and push. The live site updates on its own.

Designs are stored as plain files: the list is in `content/designs.json` and uploads go in `content/media/`.

## Project structure

```
index.html, library.html, designs.html   the three public pages
admin.html                               the local admin panel (left out of builds)
src/home/        landing page
src/library/     library page
src/designs/     designs page
src/specimens/   the 12 live examples and the runtime that runs them
src/core/        shared code: scrolling, motion, navigation, footer
src/styles/      CSS; design tokens are in tokens.css
src/media/       photographs
plugins/content.js   serves and saves designs in dev, copies published ones at build
content/         design data and uploaded media
```

## Deployment

Every push to `main` triggers [the GitHub Pages workflow](.github/workflows/deploy.yml). It installs dependencies, runs `npm run build` and publishes `dist/`. A deploy usually takes about a minute.

## License

Copyright © 2026 Khurshidbek Urazaliev. All rights reserved. You may view the code, but you may not copy, reuse or redistribute it without permission. See [LICENSE](LICENSE) for the details.
