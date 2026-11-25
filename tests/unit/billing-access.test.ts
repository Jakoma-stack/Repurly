import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPaidWorkspaceAccess } from '../../src/lib/billing/access-policy';

for (const status of ['active', 'trialing'] as const) {
  test(`billing accepts explicit ${status} subscription`, () => {
    assert.equal(hasPaidWorkspaceAccess({ stripeSubscriptionId: 'sub_test', stripeSubscriptionStatus: status }), true);
  });
}

for (const status of [null, 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'canceled']) {
  test(`billing refuses unverified status ${status}`, () => {
    assert.equal(hasPaidWorkspaceAccess({ stripeSubscriptionId: 'sub_test', stripeSubscriptionStatus: status }), false);
  });
}

test('billing refuses absent subscription', () => {
  assert.equal(hasPaidWorkspaceAccess({ stripeSubscriptionId: null, stripeSubscriptionStatus: null }), false);
});

test('billing refuses active status without a subscription ID', () => {
  assert.equal(hasPaidWorkspaceAccess({ stripeSubscriptionId: null, stripeSubscriptionStatus: 'active' }), false);
});
