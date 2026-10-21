# Agent 02 completion design

Date: 21 Oct 2026

## Decision

The owner asked to finish Agent 02 without stopping between plan, implementation, review, and deploy. Approved product rules stay those in `ASSUMPTIONS_AND_DECISIONS.md` and the A0 defaults. This cycle does not add a live Midtrans, Duitku, Biteship, Google, or GA4 account, because no credentials were supplied. Those calls fail closed. The dev server keeps the payment simulator.

## Already running

NestJS API on the dev server, database `tian` as role `tian_app`, MinIO bucket `tian-media`. Catalogue, cart pricing (reference total Rp587.250), shipping quotes, customer and staff sign-in, idempotent order create, stock reservation, simulated payment events, admin metrics (Rp2.097.000 / 8 / Rp262.125 / 88.9%), process, ship, refund, and a contact reveal that currently does not unmask on the next read.

## This cycle

1. Root gitignore so `.env` files are not committed. `server/.env.example` stays.
2. Pure rules, each with a unit test: Indonesian address (D13), notification consent (C11), payment and shipping providers refusing to run without a server key, contact visibility after a timed reveal (C2).
3. HTTP endpoints for cart merge, wishlist, addresses, a notification outbox, and the audit log read.
4. Security response headers on every response.
5. Fix contact reveal so a granted reveal is visible until it expires.
6. Review, fix defects, commit without secrets, deploy the image to the dev server.

## Not in this cycle

Replacing the React prototype's mock services, React Router 7, and calling real provider APIs. Those need a separate frontend pass and owner-supplied sandbox keys. The provider module exists so a later key turns the same check from "refused" to "configured" without changing callers.

## Approaches considered

- Finish only documentation. Rejected: the owner asked for a deployed server.
- Integrate live gateways with invented keys. Rejected: credentials must not be fabricated.
- Add the missing rules and endpoints on the current NestJS service, and keep the simulator. Chosen: it is testable on the existing Postgres and MinIO host.
