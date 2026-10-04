// Bump together with the HTML module URLs when publishing a data revision.
export const dataRevision = '20261004-9';

export function fetchData(path) {
  const url = new URL(path, document.baseURI);
  url.searchParams.set('rev', dataRevision);
  // Lyrics and catalog status must be read from the same current release.
  return fetch(url, { cache: 'no-store' });
}
