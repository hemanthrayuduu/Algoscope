// Encode/decode the full editor state into a URL hash so a run can be shared
// with a link. State is compressed with lz-string to keep URLs short.

import LZString from 'lz-string';
import type { Language } from '../engine/types';

export interface ShareState {
  code: string;
  language: Language;
  entryFunction: string;
  argsJson: string;
}

const HASH_PREFIX = '#s=';

export function encodeState(state: ShareState): string {
  const json = JSON.stringify(state);
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeState(token: string): ShareState | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(token);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (typeof parsed.code !== 'string' || (parsed.language !== 'javascript' && parsed.language !== 'python')) {
      return null;
    }
    return {
      code: parsed.code,
      language: parsed.language,
      entryFunction: String(parsed.entryFunction ?? ''),
      argsJson: String(parsed.argsJson ?? '[]'),
    };
  } catch {
    return null;
  }
}

export function readStateFromUrl(): ShareState | null {
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_PREFIX)) return null;
  return decodeState(hash.slice(HASH_PREFIX.length));
}

/** Builds a shareable absolute URL and writes it to the address bar. */
export function buildShareUrl(state: ShareState): string {
  const token = encodeState(state);
  const url = `${window.location.origin}${window.location.pathname}${HASH_PREFIX}${token}`;
  window.history.replaceState(null, '', url);
  return url;
}
