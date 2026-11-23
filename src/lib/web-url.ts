export type WebUrlError = 'invalidUrl' | 'urlTooLong';
export type WebUrlResult = {ok: true; value: string} | {ok: false; error: WebUrlError};

/** Convert a pasted web address to a URL accepted by the browser and database. */
export function normalizeWebUrl(input: string): WebUrlResult {
  let value = input.trim();
  if (!value) return {ok: true, value: ''};

  // Chat apps/editors may copy a single link as Markdown or an autolink.
  const markdown = value.match(/^\[[^\]\r\n]*\]\(([^\s]+)\)$/);
  if (markdown) value = markdown[1];
  const autolink = value.match(/^<(https?:\/\/[^<>]+)>$/i);
  if (autolink) value = autolink[1];

  if (value.length > 2000) return {ok: false, error: 'urlTooLong'};
  if (/[\\\u0000-\u001F\u007F]/.test(value)) return {ok: false, error: 'invalidUrl'};

  if (value.startsWith('//')) value = 'https:' + value;
  else if (!/^https?:\/\//i.test(value)) {
    // Infer HTTPS only for a domain/IP, never for arbitrary text or another scheme.
    const host = value.split(/[/?#]/, 1)[0];
    if (!/^(?:[^\s:@]+\.[^\s:@]+|\[[0-9a-f:]+\])(?::\d+)?$/i.test(host)) {
      return {ok: false, error: 'invalidUrl'};
    }
    value = 'https://' + value;
  }

  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      return {ok: false, error: 'invalidUrl'};
    }
    const normalized = url.href;
    if (normalized.length > 2000) return {ok: false, error: 'urlTooLong'};
    return {ok: true, value: normalized};
  } catch {
    return {ok: false, error: 'invalidUrl'};
  }
}
