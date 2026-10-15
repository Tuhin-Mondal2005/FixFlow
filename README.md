# FixFlow — Smart Hyperlocal Home Service & Technician Assignment Platform

MERN app (MongoDB, Express, React + Vite + Tailwind, Node) with Socket.IO. **Service-only** platform: no products, parts, cart or inventory. Roles: CUSTOMER, TECHNICIAN, ADMIN.

## Run it
Requirements: Node 18+ (22 recommended), MongoDB running locally or an Atlas URI.

```bash
# 1. API
cd server
cp .env.example .env        # set MONGO_URI, JWT_SECRET, DOC_ENCRYPTION_KEY
npm install
npm run seed                # 25 services
npm run dev                 # http://localhost:5000
npm test                    # 14 unit tests (scoring, distance, file validation, mutex)

# 2. Web app (new terminal)
cd client
cp .env.example .env        # optional: Google Maps key, Razorpay key id
npm install
npm run dev                 # http://localhost:5173
```
Default admin (created on first boot): `admin@fixflow.local` / `Admin@12345` — log in at `/admin/login` and change it.

Without a Google Maps key the app uses OpenStreetMap previews and manual coordinates. Without Razorpay keys the server uses a **mock checkout** that goes through the same signature-verification path (development only; set real keys in production).

## What is where
- `server/services/assignmentService.js` — the engine: hard filters → weighted score → atomic auto-assign; reject / timeout / no-show auto-reassign; emergency priority queue. `scoring.js` holds the pure scoring maths. `dispatchService.js` is the admin manual assign / reassign.
- `server/services/paymentService.js` — Razorpay order + backend signature/webhook verification, commission, earnings ledger, refunds, cash flow.
- `server/services/documentService.js` — Aadhaar/certificates: magic-byte validation, AES-256-GCM at rest, admin-only authenticated viewing (each view audit-logged).
- Admin-tunable rules (weights, commission, timeouts, workload cap, radius) live in the Settings page, not in code.
- `client/src/pages/{public,customer,technician,admin}` — all pages from section 55 plus support, invoice, audit log and settings.

## Aadhaar and certificate copies are kept
- Removing (soft-deleting) a technician no longer erases the Aadhaar document, certificates or Aadhaar number.
- Removed technicians stay viewable by the admin. The technician list has a "Removed (records kept)" option.
- Removed technicians still cannot log in.

## Clickable dashboard cards (all 12)
Each card opens the list that matches its number, using the same filters the server counts with:
- Total requests -> all requests
- Pending requests -> status SUBMITTED
- Completed / Cancelled -> their status
- Total technicians -> approved technicians
- Available / Busy technicians -> approved, active and in that availability
- Emergency requests -> HIGH urgency and still open
- Active jobs -> accepted and in progress
- Pending verification -> verification queue
- Average rating -> all customer reviews (new page `/admin/reviews`)
- Platform commission -> paid payments
Lists read their filters from the URL and show a banner ("Showing Pending requests · 7 results") with a clear button.

## Honest notes
- The build environment had no npm registry access, so `npm install`, the server run and `vite build` were **never executed** by the author. Server code is syntax-checked and its pure logic unit-tested; the client was statically checked (all imports resolve, JSX parses). Expect to fix small runtime issues on first run.
- Assignment locking is an in-process mutex: fine for one server instance. Running several instances needs a distributed lock (e.g. Redis).
- Cloud storage for documents: files are stored encrypted on local disk (`server/private_uploads`); swap `documentService` for S3/Cloudinary in production.
