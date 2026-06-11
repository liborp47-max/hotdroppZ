/**
 * ssrf-guard.ts — AUD-SEC-002. Reject URLs that point at loopback, link-local
 * cloud-metadata, private ranges, or internal-only hostnames before the server
 * fetches them (RSS scout, source health test, image enrichment).
 *
 * Scope/limitation (honest): this checks the URL's literal host. It does NOT
 * resolve DNS, so a public hostname that resolves to a private IP (DNS rebinding)
 * is not caught here — full protection needs resolve-then-pin at the socket layer.
 * This blocks the common, direct SSRF targets (169.254.169.254, localhost, RFC1918).
 */

export interface SsrfVerdict {
  ok: boolean
  reason?: string
}

function checkIpv4(host: string): SsrfVerdict | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return null
  const [a, b] = [Number(m[1]), Number(m[2])]
  if (a === 127) return { ok: false, reason: 'loopback' }
  if (a === 0) return { ok: false, reason: 'this-network' }
  if (a === 10) return { ok: false, reason: 'private-10/8' }
  if (a === 172 && b >= 16 && b <= 31) return { ok: false, reason: 'private-172.16/12' }
  if (a === 192 && b === 168) return { ok: false, reason: 'private-192.168/16' }
  if (a === 169 && b === 254) return { ok: false, reason: 'link-local/metadata' }
  if (a >= 224) return { ok: false, reason: 'multicast/reserved' }
  return { ok: true }
}

export function isUrlSafe(rawUrl: string): SsrfVerdict {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'invalid-url' }
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: `protocol-${u.protocol.replace(':', '')}` }
  }

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 brackets

  // Loopback / unspecified
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '::') {
    return { ok: false, reason: 'loopback' }
  }
  // IPv6 ULA (fc00::/7) + link-local (fe80::/10)
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')) {
    if (host.includes(':')) return { ok: false, reason: 'ipv6-private' }
  }

  const v4 = checkIpv4(host)
  if (v4) return v4

  // Internal-only hostnames: no dot (bare host), or known internal TLDs.
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host.endsWith('.home')) {
    return { ok: false, reason: 'internal-host' }
  }

  return { ok: true }
}
