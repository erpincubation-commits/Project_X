# CF-03 identity recovery threat review

**Status:** Reviewed design, 19 November 2026. Two-administrator verification, a 15-minute single-use token, and the account restrictions were approved for this change. The source implements these controls; local identity evidence, private delivery channels and an emergency procedure still require organisational adoption and rehearsal. This document is not evidence of deployment or an operator rehearsal.

## Existing boundary

Users can sign in using their password and an unused MFA recovery code if they have one. Users who have lost the authenticator and all recovery codes can use the two-administrator recovery workflow after upgrading the client, server and schema. Existing sign-in, password change, session expiry and recovery-code behaviour are described in [Authentication](AUTHENTICATION.md). Privacy restriction makes an account inactive, and the access and privacy paths protect the last active administrator. Recovery preserves these protections; a source change does not establish that an installation was migrated or deployed.

## Threats and controls

| Threat | Controls and remaining policy decisions |
| --- | --- |
| Impersonation or social engineering | Independently verify the requester using customer-approved evidence and a channel established before the incident. Specify what evidence is acceptable, who verifies it, and how disputes are escalated. Do not record evidence or recovery secrets in the application audit trail. |
| Operator abuses recovery or targets their own account | Require named eligible operators, server-side authorisation, and independent approval by a different eligible person; neither actor may be the target. Both actors must be administrators; authorisation-version changes invalidate an outstanding attempt. An operator who can access the bearer secret may impersonate the user; decide how issuance and delivery constrain that risk. |
| Account enumeration | Return equivalent public responses for unknown, ineligible and invalid requests. Avoid exposing eligibility through error details, timing, delivery messages or logs. Authorised case views require a separate, reviewed disclosure scope. |
| Intercepted or compromised recovery token | Use a cryptographically random, short-lived, single-use bearer secret, store only its digest, deliver through an independently verified private channel, and provide cancellation. The operator and user need a way to report suspected compromise. The lifetime is 15 minutes; select an approved delivery channel locally. |
| Replay, simultaneous redemption, or role changes | Atomically validate and consume the recovery attempt and apply account changes under consistent locks. Revalidate account status, privacy restriction, role, the initiating and approving operators' eligibility, and relevant authorisation versions at issuance and redemption. An administrator can cancel an open case; version changes invalidate outstanding attempts. |
| Old credentials remain usable | Atomically revoke sessions and sign-in challenges, rotate the authentication version, retire affected MFA factors and require fresh MFA enrolment. Successful completion invalidates old recovery codes; fresh enrolment issues replacements; existing codes must continue to work for ordinary sign-in until a recovery actually invalidates them. A reset must not silently change the user's role or reactivate a restricted account. |
| Lockout of the last administrator | Preserve the current last-active-admin safeguards, including concurrent access and privacy operations. Define and rehearse a separate independently controlled emergency process when all eligible operators are locked out; do not create a permanent bypass or shared account. |
| Brute force and denial of service | Limit issuance, approval and redemption attempts without relying only on an account identifier supplied by an unauthenticated caller. The operator limit is ten requests or approvals per 15 minutes; redemption is limited to 20 per observed client address. Shared reverse-proxy addresses can cause collateral throttling; establish escalation and retention locally. |
| Secret disclosure in logs, audit, retry records, support cases or delivery | Never record passwords, bearer tokens, MFA seeds or recovery codes. Audit attributable decisions and state transitions with minimal non-secret metadata. Review error handling, network diagnostics, desktop state, request replay and retention. |
| Lost response after completion | Do not automatically replay secret-bearing requests. Provide neutral guidance for determining whether the change completed and for escalation if access still fails. Test both committed and uncommitted failures. |

## Evidence to collect before acceptance

- Document the approved policy and named accountability outside the source tree as appropriate, without publishing actual identity evidence, secrets or recovery material.
- Test authorised and denied access, self-recovery, independent approval, privacy restriction, last-admin protection, role and account changes, expiry, cancellation, token alteration, concurrent redemption, replay, throttling, redaction and lost responses through direct API and desktop paths.
- Exercise lost authenticator, lost recovery codes, suspected compromise and emergency access using synthetic accounts. Record the rehearsal date, participants' roles, outcomes and outstanding findings without recording credentials or recovery material.
- Review the design with the security and privacy owners, including the bearer-token delivery threat and any residual risk. Confirm deployment, migration and operational readiness separately from source-level tests.
