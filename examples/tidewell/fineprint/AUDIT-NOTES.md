# Audit notes

- **Audit:** IBM Bob, Fine Print Auditor mode (Bob IDE), 27 Sep 2026. 9 testable promises were extracted and a proof was written for each.
- **Harness hardening after the audit:** the mutation check found that two kept proofs (3.1 and 5.3) could not fail. The harness now matches subdomains in host rules and captures cookies at the network layer. Bob's proofs were not edited; all 4 kept proofs now fail when their promise is deliberately broken.
- **Re-audit of 4.3:** with subdomain matching fixed, the 4.3 proof turned out to include `graph.facebook.com` in its allowlist of "providers listed in section 7", but Meta is not listed there. Its original "broken" verdict had come from an unrelated host mismatch. The proofs were unlocked (tag `fineprint-audit-baseline` removed), and Bob re-audited 4.3 alone (Bob Shell, Auditor mode, 0.40 Bobcoins). The allowlist is now exactly the listed providers, and the proofs were re-locked. On the original code 4.3 is broken because data goes to Meta; after the fix it is kept.
- **Fix:** IBM Bob, Fine Print Engineer mode (Bob Shell). All promises kept, app tests pass, and the proofs are unchanged by the fix.
