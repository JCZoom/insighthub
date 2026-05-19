/**
 * Freshworks suite — domain normalization.
 *
 * Users routinely paste the full URL into env vars even though we document
 * "domain only". This helper strips `https://`, `http://`, trailing slashes,
 * and any path components, leaving just the host. It also warns loudly when
 * normalization was required, so the env file gets fixed.
 *
 * Why centralize this? Bug 2026-05-19 14:14 ET: FRESHSALES_DOMAIN was set to
 * `https://ipostal1-org.myfreshworks.com`, and the connector built a baseUrl
 * of `https://https://...`. The fix was easy; the lesson was: trust nothing
 * about env-supplied URLs, normalize at every entry point.
 */

export function normalizeDomain(
  raw: string,
  envVarName: string
): string {
  let v = raw.trim();
  const original = v;
  if (v.startsWith('https://')) v = v.slice('https://'.length);
  else if (v.startsWith('http://')) v = v.slice('http://'.length);
  // Strip any trailing slashes and path components — we only want the host.
  v = v.replace(/\/.*$/, '');
  if (v !== original) {
    // eslint-disable-next-line no-console
    console.warn(
      `[freshworks/${envVarName}] env var contained extra characters and was normalized: "${original}" → "${v}". ` +
        'Update your env file to remove the scheme/slash for clarity.'
    );
  }
  return v;
}

/** Build an `https://<host>` base URL from a possibly-messy domain string. */
export function buildBaseUrl(domain: string, envVarName: string): string {
  return `https://${normalizeDomain(domain, envVarName)}`;
}
