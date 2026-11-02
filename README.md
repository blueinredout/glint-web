# Glint

Marketing site for Glint, a Windows app that turns any screen selection into
text, a web search, a screenshot, or an image search.

Static HTML, CSS, and vanilla JavaScript, built with Vite. No framework. The
intro is a draggable selection with a WebGL caustics shader.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # writes dist/
npm run preview
```

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`, which builds `dist/` and
publishes it to GitHub Pages. `public/CNAME` pins the custom domain.

## Releases

The version shown on the page and the download links come from the latest
release in [`blueinredout/glint-releases`](https://github.com/blueinredout/glint-releases).
`src/release.js` reads it at runtime, so publishing a release updates the site
without a redeploy. If the API is unreachable or JavaScript is disabled, the
page falls back to the static version and the `releases/latest/download` URL.

## Layout

```
index.html          markup and copy
src/main.js         reveal animations, paging, keyboard shortcuts
src/intro.js        drag-selection intro and quote handoff
src/caustics.js     WebGL caustics for the selection
src/particles.js    hero particle field
src/release.js      GitHub release metadata
src/style.css       all styles
public/             fonts, favicon, CNAME
```
