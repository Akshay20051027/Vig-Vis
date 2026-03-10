export function cacheRead(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === 'object' && 'expiresAt' in parsed) {
      const expiresAt = Number(parsed.expiresAt);
      if (Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() > expiresAt) {
        sessionStorage.removeItem(key);
        return fallback;
      }
      return parsed.value ?? fallback;
    }

    return parsed;
  } catch {
    return fallback;
  }
}

export function cacheWrite(key, value, ttlMs = null) {
  try {
    if (typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0) {
      sessionStorage.setItem(
        key,
        JSON.stringify({ value, expiresAt: Date.now() + ttlMs })
      );
      return;
    }

    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function cacheReadNumber(key, fallback = 0) {
  const value = cacheRead(key, fallback);
  const numberValue = Math.trunc(Number(value));
  return Number.isFinite(numberValue) ? numberValue : fallback;
}
