// Thin namespaced localStorage wrapper. Never throws: quota errors and
// corrupt JSON fall back silently so the game keeps running.
const NS = 'obu.v2.'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function loadWithGuard<T>(key: string, fallback: T, guard: (value: unknown) => value is T): T {
  const value = load<unknown>(key, fallback)
  return guard(value) ? value : fallback
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value))
  } catch {
    // storage full or unavailable: skip, meta progress is best-effort
  }
}
