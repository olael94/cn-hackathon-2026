export const demoRoom = new URLSearchParams(location.search).get('room') ?? 'k8s7fa'
export const demoPath = (import.meta.env.VITE_API_URL ?? '/api') + '/demo/' + encodeURIComponent(demoRoom)

// getRandomValues also works on phones using a local HTTP address.
export function newId() {
  const data = crypto.getRandomValues(new Uint8Array(16))
  data[6] = (data[6] & 15) | 64
  data[8] = (data[8] & 63) | 128
  const hex = Array.from(data, (n) => n.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}
