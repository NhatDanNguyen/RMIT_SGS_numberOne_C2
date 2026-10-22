import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';

test('SQLite rolls back stale updates without changing the original ciphertext', () => {
  const store = createStore(':memory:');
  try {
    store.saveQuote('design', 'cipher-one', 'string', 0, 'supplier');
    assert.throws(() => store.saveQuote('design', 'stale', 'string', 0, 'supplier'), { status: 409 });
    assert.equal(store.quote('design').ciphertext, 'cipher-one');
    store.saveQuote('design', 'cipher-two', 'string', 1, 'supplier');
    assert.equal(store.quote('design').version, 2);
  } finally { store.close(); }
});
test('proof replay history persists for its validity period', () => {
  const store = createStore(':memory:');
  try {
    assert.equal(store.claimProof('proof', Date.now() + 5000), true);
    assert.equal(store.claimProof('proof', Date.now() + 5000), false);
    store.claimProof('expired', Date.now() - 5000);
    assert.equal(store.claimProof('expired', Date.now() + 5000), true);
  } finally { store.close(); }
});
