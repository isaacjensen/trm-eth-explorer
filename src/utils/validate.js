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

// A transaction hash is 0x followed by 64 hex chars (32 bytes). Same format-only stance
// as addresses: we validate shape here and let the node be the source of truth for
// whether the transaction actually exists.
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

function isValidTxHash(hash) {
  return typeof hash === 'string' && TX_HASH_RE.test(hash);
}

module.exports = { isValidAddress, isValidTxHash };
