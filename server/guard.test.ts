import { describe, expect, it } from 'vitest'
import { isBlockedAddress } from './guard'

describe('isBlockedAddress', () => {
  it.each(['127.0.0.1', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'fe80::1%eth0', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '64:ff9b::10.0.0.1', '2001:db8::1', 'ff02::1', 'not-an-ip', ''])(
    'blocks %s',
    (ip) => expect(isBlockedAddress(ip)).toBe(true),
  )
  it.each(['93.184.215.14', '1.1.1.1', '8.8.8.8', '172.32.0.1', '2606:2800:21f:cb07:6820:80da:af6b:8b2c', '2a00:1450:4001:82a::200e', '::ffff:93.184.215.14', '[2606:4700::1111]'])(
    'allows %s',
    (ip) => expect(isBlockedAddress(ip)).toBe(false),
  )
})
