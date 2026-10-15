# FixFlow build progress (snapshot)

Legend: DONE = written and syntax-checked, TODO = not written yet.
Nothing has been run end-to-end: the build workspace could not reach the npm registry, so
`npm install`, the server and the React build were never executed there. Run the commands in README.md
on your machine.

## Server (server/)
- DONE config (env, db, constants), 12 Mongoose models, utils (geo, time, crypto, file validation, mutex)
- DONE middleware (JWT auth, roles, zod validation, NoSQL sanitiser, rate limits, uploads, errors)
- DONE services: assignmentService (core engine), scoring, dispatchService, requestService, paymentService,
  notificationService, technicianService, pricingService, settingsService, documentService, auditService
- DONE controllers: auth, service, technician, job, request, payment, notification, support
- DONE controllers: admin; routes, app.js, server.js, seed.js, .env.example
- DONE unit tests (14 passing, `npm test`) for scoring, distance, file validation, mutex

## Client (client/)
- DONE all public, customer, technician and admin pages, layouts, contexts, shared components
- Statically checked only (imports resolve, JSX parses); `vite build` never run

## Docs
- DONE README.md
