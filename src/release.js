// Release metadata comes from the public releases repo, so publishing a new
// version never requires redeploying the site.

const OWNER = 'blueinredout';
const REPO = 'glint-releases';

const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;

export const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases`;

// Fallback for no-JS visitors and API failures. GitHub's "latest" alias
// requires the installer to keep the same filename between releases.
export const DOWNLOAD_URL = `https://github.com/${OWNER}/${REPO}/releases/latest/download/Glint-Setup.exe`;

function installerUrl(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const executables = assets.filter((asset) => /\.exe$/i.test(asset.name));
  const preferred = executables.find((asset) => /setup|install/i.test(asset.name)) ?? executables[0] ?? assets[0];
  return preferred?.browser_download_url ?? DOWNLOAD_URL;
}

function applyVersion(version) {
  for (const node of document.querySelectorAll('[data-release-version]')) {
    node.textContent = version;
    if (node.tagName === 'DATA') node.value = version;
  }
}

function applyLinks({ download, changelog }) {
  for (const link of document.querySelectorAll('[data-download]')) {
    if (download) link.href = download;
  }
  for (const link of document.querySelectorAll('[data-changelog]')) {
    if (changelog) link.href = changelog;
  }
}

export async function syncRelease() {
  applyLinks({ download: DOWNLOAD_URL, changelog: RELEASES_URL });

  let response;
  try {
    response = await fetch(API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: AbortSignal.timeout?.(8000),
    });
  } catch {
    return;
  }

  // Public repo without a published release: link to the list instead of a
  // download that would 404.
  if (response.status === 404) {
    applyLinks({ download: RELEASES_URL });
    return;
  }
  if (!response.ok) return;

  let release;
  try {
    release = await response.json();
  } catch {
    return;
  }

  const version = String(release?.tag_name ?? '').replace(/^v/i, '');
  if (!version) return;

  applyVersion(version);
  applyLinks({ download: installerUrl(release), changelog: release.html_url ?? RELEASES_URL });
}
