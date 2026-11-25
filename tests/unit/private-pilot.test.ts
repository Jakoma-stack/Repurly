import assert from 'node:assert/strict';
import test from 'node:test';
import { isPrivatePilotEmailAllowed, isPrivatePilotMode, isPrivatePilotUserIdAllowed } from '../../src/lib/billing/private-pilot';

const staging = { enabled: 'true', environment: 'staging', allowedEmail: 'owner@example.com' };

test('private pilot requires explicit flag and Railway staging', () => {
  assert.equal(isPrivatePilotMode(staging), true);
  assert.equal(isPrivatePilotMode({ ...staging, environment: 'production' }), false);
  assert.equal(isPrivatePilotMode({ ...staging, enabled: 'false' }), false);
  assert.equal(isPrivatePilotMode({ ...staging, environment: undefined }), false);
});

test('private pilot email is an exact, case-insensitive approved account', () => {
  assert.equal(isPrivatePilotEmailAllowed('OWNER@example.com', staging), true);
  assert.equal(isPrivatePilotEmailAllowed('other@example.com', staging), false);
  assert.equal(isPrivatePilotEmailAllowed('owner@example.com.evil', staging), false);
  assert.equal(isPrivatePilotEmailAllowed(null, staging), false);
  assert.equal(isPrivatePilotEmailAllowed('owner@example.com', { ...staging, allowedEmail: '' }), false);
  assert.equal(isPrivatePilotEmailAllowed('owner@example.com', { ...staging, environment: 'production' }), false);
});

test('private pilot requires exact Clerk user ID when configured', () => {
  const config = { ...staging, allowedUserId: 'user_allowed' };
  assert.equal(isPrivatePilotUserIdAllowed('user_allowed', config), true);
  assert.equal(isPrivatePilotUserIdAllowed('user_other', config), false);
  assert.equal(isPrivatePilotUserIdAllowed(null, config), false);
  assert.equal(isPrivatePilotUserIdAllowed('user_allowed', { ...config, environment: 'production' }), false);
  assert.equal(isPrivatePilotUserIdAllowed('user_allowed', { ...config, enabled: 'false' }), false);
});
