// Vercel serverless entry point. The judge endpoints and the demo console are all served by the
// same Express app used locally and in Docker; only the process model differs.
import { createApp } from '../server/index.js';
import { initMongo } from '../server/db.js';

// Optional history. Fire-and-forget, cached across warm invocations, never awaited on a request.
initMongo();

export default createApp();
