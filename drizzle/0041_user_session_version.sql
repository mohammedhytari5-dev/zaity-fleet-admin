-- Session revocation support.
--
-- Session tokens are stateless JWTs with a one-year lifetime, and `logout` only
-- cleared the browser cookie, so a leaked token stayed valid until it expired -
-- including after a password reset or a permission change. Tokens now carry the
-- `sessionVersion` they were issued with, and `authenticateRequest` rejects a
-- token whose version no longer matches the account.
--
-- Existing tokens have no `sv` claim and are treated as version 1 (the default
-- below), so active sessions keep working while any future bump still revokes
-- them.

ALTER TABLE `users` ADD `sessionVersion` int DEFAULT 1 NOT NULL;
