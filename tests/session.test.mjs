import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionGuard } from '../src/lib/session.mjs';

for (const scenario of ['sign out', 'identity change', 'permission change', 'close view', 'refresh access']) {
  test('late decryption cannot repopulate a view after ' + scenario, async () => {
    const gate = createSessionGuard();
    gate.update('supplier-1:quote-design,decrypt');
    const current = gate.ticket();
    let finish;
    const plaintext = new Promise(resolve => { finish = resolve; });
    let displayed = null;
    const operation = plaintext.then(value => { if (current()) displayed = value; });
    if (scenario === 'sign out') gate.update('');
    else if (scenario === 'identity change') gate.update('buyer-1:quote-design,decrypt');
    else if (scenario === 'permission change') gate.update('supplier-1:');
    else gate.invalidate();
    finish('synthetic confidential quote');
    await operation;
    assert.equal(displayed, null);
  });
}
test('an unchanged signed-in session may display its completed result', async () => {
  const gate = createSessionGuard();
  gate.update('supplier-1:quote-design');
  const current = gate.ticket();
  gate.update('supplier-1:quote-design');
  assert.equal(current(), true);
  gate.update('');
  assert.equal(gate.ticket()(), false);
});
