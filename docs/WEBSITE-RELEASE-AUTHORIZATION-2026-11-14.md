# Website release authorization — 14 November 2026

The business owner personally tested the website and explicitly authorized committing, pushing, and releasing the current website improvements to the existing Authentic Media production project. They directed that typecheck, lint, unit tests, Playwright, and the local build must not be rerun for this release.

This authorization supersedes the release hold recorded in `PRODUCTION-RELEASE-ATTEMPT-2026-11-14.md` for publishing the website. It does not approve the legal policies as final, supply missing merchant details, or authorize bank re-screening.

The policies remain drafts with no effective date. Outstanding legal review, company disclosures, merchant-account ownership, KKChat relationship/routing disclosures, GST/invoicing, and service-scope decisions remain recorded in `LEGAL-APPROVAL-CHECKLIST.md`, `MERCHANT-DETAILS-REQUIRED.md`, and `PHASE-4-RELEASE-CANDIDATE.md`. Earlier reports describe their respective review attempts and are historical records.

Release scope: website pages, navigation, light theme, service browsing/details, cart amount safeguards, related tests and documentation. No production database changes, migrations, payment gateway configuration, callback route changes, environment-secret changes, or real payment transactions are authorized by this release.

The existing production deployment is Git-triggered from `main` in `vishnuweb-a/authenticMedia`, under Vercel project `authentic-media` (`prj_vo30Dal4Nb9XAT3RvfAO0ChMpqdK`). Release completion requires confirming that the resulting deployment is READY and the production domain is assigned to the new commit.
