// Optional MongoDB Atlas persistence for run history. Never on the judge critical path:
// if MONGODB_URI is unset or Atlas is unreachable, the API behaves exactly the same.

import { MongoClient } from 'mongodb';

let runs = null;

export function initMongo(uri = process.env.MONGODB_URI, dbName = process.env.MONGODB_DB || 'gridwise') {
  if (!uri) return null;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  return client
    .connect()
    .then(() => {
      runs = client.db(dbName).collection('runs');
      console.log(`[mongo] connected, history enabled (db: ${dbName})`);
      return client;
    })
    .catch((err) => {
      console.warn(`[mongo] unavailable, continuing without history: ${err.message}`);
      return null;
    });
}

/** Fire-and-forget: awaited by nobody, failures are swallowed. */
export function recordRun(doc) {
  if (!runs) return;
  runs.insertOne({ ...doc, created_at: new Date() }).catch((err) => console.warn(`[mongo] write skipped: ${err.message}`));
}

export const listRuns = (limit = 20) =>
  runs ? runs.find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(limit).toArray() : Promise.resolve([]);
