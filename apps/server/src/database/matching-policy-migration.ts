export const matchingPolicyMigration={version:12,sql:`
CREATE TABLE erp_matching_policy (
 id UUID PRIMARY KEY CHECK(id='00000000-0000-4000-8000-000000000012'),
 price_tolerance_bps INTEGER NOT NULL DEFAULT 0 CHECK(price_tolerance_bps BETWEEN 0 AND 10000),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
INSERT INTO erp_matching_policy(id) VALUES('00000000-0000-4000-8000-000000000012');
`};
