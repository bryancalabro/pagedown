// which addresses the fetch function may connect to: public unicast only. checked against the
// resolved address of every hop, so a hostname that resolves to a private address, or a
// redirect to one, never gets a connection.
import { BlockList, isIP } from 'node:net'

const v4 = new BlockList()
for (const [net, bits] of [
  ['0.0.0.0', 8], // this network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade nat
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // ietf protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved and broadcast
] as const)
  v4.addSubnet(net, bits, 'ipv4')

const v6 = new BlockList()
for (const [net, bits] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['100::', 64], // discard
  ['2001::', 32], // teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local
  ['ff00::', 8], // multicast
] as const)
  v6.addSubnet(net, bits, 'ipv6')

/** the ipv4 address an ipv6 one carries (mapped, compatible or nat64), if it carries one */
function embeddedV4(addr: string): string | null {
  const lower = addr.toLowerCase()
  const dotted = /^(?:::ffff:|::|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
  if (dotted) return dotted[1]
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower)
  if (hex) {
    const hi = parseInt(hex[1], 16)
    const lo = parseInt(hex[2], 16)
    return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.')
  }
  return null
}

/** true for any address that is not public unicast; unparseable input counts as blocked */
export function isBlockedAddress(address: string): boolean {
  const addr = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '')
  const kind = isIP(addr)
  if (kind === 4) return v4.check(addr, 'ipv4')
  if (kind === 6) {
    const inner = embeddedV4(addr)
    if (inner) return isBlockedAddress(inner)
    // global unicast is 2000::/3; anything outside it is not a public host
    const first = parseInt(addr.split(':')[0] || '0', 16)
    if (Number.isNaN(first) || (first & 0xe000) !== 0x2000) return true
    return v6.check(addr, 'ipv6')
  }
  return true
}
