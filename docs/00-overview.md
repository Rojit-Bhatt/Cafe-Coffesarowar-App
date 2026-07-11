docs/00-overview.md
Markdown
# Document 00: Project Overview, ADRs, & Scope

## 1. Project Description
A secure, mobile-responsive full-stack digital loyalty platform for a café consisting of two distinct interfaces: a Customer Web App and an Admin Web App. The system replaces paper punch cards with a zero-fraud digital alternative. The Admin App generates a short-lived (30s), single-use dynamic token encoded in a counter-displayed QR code. The customer scans this via their device camera to securely claim 1 daily stamp. Upon accumulating 5 stamps, the system automatically converts the card into a digital Free Coffee Voucher and resets the stamp balance to 0.

## 2. Architectural Decision Records (ADRs)
To maintain structural consistency, the application must use these exact architectural choices:

* **Authentication:** JSON Web Tokens (JWT) stored securely via HTTP-Only Cookies or standard Authorization Headers.
* **Database:** MongoDB via Mongoose ODM using atomic operations (`findOneAndUpdate`).
* **Frontend Framework:** React.js (compiled via Vite) optimized for mobile viewports using Tailwind CSS.
* **Backend Framework:** Node.js with Express.js REST APIs.
* **State Management:** React Context API for global session state; TanStack Query for server state caching.
* **QR Token Generation:** Cryptographically secure string tokens generated via UUID v4.
* **Notifications:** Simple synchronous application-layer UI toasts. No external mailers or notification loops.
* **Payments / Gateways:** None. 100% free loyalty tracking.

## 3. Out of Scope (Strict Exclusions)
The AI agent must not build, scaffold, or plan for the following features:
* No native mobile applications (iOS/Android App Stores).
* No Apple Wallet or Google Wallet pass integrations.
* No push notifications or SMS/Email communication microservices.
* No payment gateways, checkout lines, or point-of-sale (POS) processing.
* No multi-store, franchise, or multi-tenant database routing.
* No offline database synchronization or local-first service workers.
* No customer referral code frameworks or peer-to-peer stamp sharing.
* No generalized item rewards marketplace (Only the 5-stamp free coffee voucher loop).

## 4. Future Roadmap (Version 2)
Do not write logic for these features. Keep them listed here strictly to prevent code structures that block future expansions:
* Multi-tier customer points accrual balances ($1 = 1 Point).
* Dynamic admin data analytics dashboards for business tracking.
* Direct API integration hooks for physical POS restaurant cash registers.
* Employee management modules with detailed action logging histories.
* Peer-to-peer digital gift card validation systems.
