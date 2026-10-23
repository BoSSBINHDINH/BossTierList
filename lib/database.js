'use strict';

const { MongoClient } = require('mongodb');

let clientPromise;

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured.');

  if (!clientPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB_NAME || 'bosstier');
}

async function ensureIndexes() {
  const db = await connectDatabase();
  await db.collection('players').createIndex(
    { discordId: 1 },
    {
      unique: true,
      name: 'unique_nonempty_discord_id',
      partialFilterExpression: { discordId: { $type: 'string', $gt: '' } }
    }
  );
  await db.collection('players').createIndex({ username: 1 }, { name: 'username_lookup' });
}

async function closeDatabase() {
  if (!clientPromise) return;
  const client = await clientPromise;
  await client.close();
  clientPromise = undefined;
}

module.exports = { connectDatabase, ensureIndexes, closeDatabase };
