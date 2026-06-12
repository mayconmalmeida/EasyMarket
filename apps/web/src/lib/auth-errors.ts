export function normalizeAuthErrorMessage(message?: unknown) {
  const raw = String(message ?? '').trim();
  if (!raw) return 'Falha no login';

  return raw
    .replace(/\bcpf\b/gi, 'código')
    .replace(/\bsenha\b/gi, 'PIN')
    .replace(/\bcódigo e PIN\b/gi, 'código e PIN')
    .replace(/\s+/g, ' ')
    .trim();
}
