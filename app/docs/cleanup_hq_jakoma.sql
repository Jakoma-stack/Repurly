-- Run this against the live Render SQLite database if you want to fully reset the failed onboarding for hq@jakoma.org.
-- Take a backup first.

SELECT * FROM users WHERE lower(email)=lower('hq@jakoma.org');
SELECT * FROM founding_user_signups WHERE lower(email)=lower('hq@jakoma.org');
SELECT * FROM subscriptions WHERE lower(billing_email)=lower('hq@jakoma.org');

DELETE FROM workspace_memberships
WHERE user_id IN (
  SELECT id FROM users WHERE lower(email)=lower('hq@jakoma.org')
);

DELETE FROM subscriptions
WHERE lower(billing_email)=lower('hq@jakoma.org')
   OR user_id IN (
     SELECT id FROM users WHERE lower(email)=lower('hq@jakoma.org')
   );

DELETE FROM founding_user_signups
WHERE lower(email)=lower('hq@jakoma.org');

DELETE FROM users
WHERE lower(email)=lower('hq@jakoma.org');
