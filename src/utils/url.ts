/**
 * Base-path aware URL helpers.
 *
 * Production is served from the site root, but pull-request previews are
 * served from a sub-path such as `/pr-preview/pr-12/`. Astro exposes the
 * configured base as `import.meta.env.BASE_URL`; every internal link must be
 * built through `withBase` so it resolves correctly in both cases.
 */

const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Prefix a root-relative path (e.g. "/robot") with the site base path. */
export function withBase(path: string): string {
  if (!path.startsWith('/')) return path;
  return path === '/' ? `${base}/` : `${base}${path}`;
}

/** Strip the site base path from a pathname so routes can be compared. */
export function stripBase(pathname: string): string {
  if (base && pathname.startsWith(base)) {
    const rest = pathname.slice(base.length);
    return rest === '' ? '/' : rest;
  }
  return pathname;
}
