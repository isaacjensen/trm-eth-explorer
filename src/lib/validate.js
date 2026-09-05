'use strict';

// Format-level validation: 0x followed by 40 hex chars. We deliberately do NOT
// enforce EIP-55 mixed-case checksums here — that would reject otherwise-valid
// addresses whose casing isn't canonical (including the casing used in the exercise
// prompt). eth_getBalance is case-insensitive on the address, so format validation
// is the robust choice for an MVP. Stricter checksum validation is noted in the
// README as a follow-up.
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function isValidAddress(address) {
  return typeof address === 'string' && ADDRESS_RE.test(address);
}

module.exports = { isValidAddress };
