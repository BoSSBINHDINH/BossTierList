'use strict';

require('dotenv').config();

const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const { ObjectId } = require('mongodb');
const { connectDatabase, ensureIndexes } = require('./lib/database');

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.WEB_ORIGIN || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Admin-Key']
}));
app.use(express.json({ limit: '100kb' }));

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_KEY || '';
  const supplied = req.get('x-admin-key') || '';
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  if (!expected) {
    return res.status(503).json({ error: 'Admin writes are not configured on the server.' });
  }
  if (expectedBuffer.length !== suppliedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return res.status(401).json({ error: 'Admin key is missing or incorrect.' });
  }
  return next();
}

function parseTiers(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {}
    const separator = value.indexOf(':');
    if (separator > 0) {
      return { [value.slice(0, separator).trim()]: value.slice(separator + 1).trim() };
    }
    return { sword: value.trim() };
  }
  return {};
}

function toPublicPlayer(document) {
  const { _id, ...fields } = document;
  return { ...fields, id: String(_id) };
}

function cleanPlayerInput(body) {
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  if (!username || username.length > 40) {
    const error = new Error('Username is required and must be 40 characters or fewer.');
    error.status = 400;
    throw error;
  }
  return {
    username,
    tiers: parseTiers(body.tiers),
    region: typeof body.region === 'string' ? body.region.trim().slice(0, 12) : 'AS',
    ...(typeof body.avatarUrl === 'string' ? { avatarUrl: body.avatarUrl.slice(0, 500) } : {})
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/players', async (_req, res, next) => {
  try {
    const db = await connectDatabase();
    const documents = await db.collection('players')
      .find({})
      .project({ _id: 1, username: 1, points: 1, tiers: 1, region: 1, avatarUrl: 1, history: 1, discordId: 1, testDates: 1 })
      .sort({ username: 1 })
      .toArray();
    res.json({ players: documents.map(toPublicPlayer) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/players', requireAdmin, async (req, res, next) => {
  try {
    const db = await connectDatabase();
    const player = cleanPlayerInput(req.body || {});
    const result = await db.collection('players').insertOne({
      ...player,
      points: Number.isFinite(Number(req.body.points)) ? Number(req.body.points) : 0,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const created = await db.collection('players').findOne({ _id: result.insertedId });
    res.status(201).json({ player: toPublicPlayer(created) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/players/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid player id.' });
    const db = await connectDatabase();
    const _id = new ObjectId(req.params.id);
    const player = cleanPlayerInput(req.body || {});
    const result = await db.collection('players').updateOne(
      { _id },
      { $set: { ...player, updatedAt: new Date() } }
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'Player not found.' });
    const updated = await db.collection('players').findOne({ _id });
    res.json({ player: toPublicPlayer(updated) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/players/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid player id.' });
    const db = await connectDatabase();
    const result = await db.collection('players').deleteOne({ _id: new ObjectId(req.params.id) });
    if (!result.deletedCount) return res.status(404).json({ error: 'Player not found.' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === 11000) return res.status(409).json({ error: 'That Discord account is already linked to a player.' });
  console.error('[api] Request failed:', error.name || 'Error', error.code || '');
  return res.status(500).json({ error: 'Server could not complete the request. Check API and database configuration.' });
});

async function start() {
  await ensureIndexes();
  app.listen(port, '0.0.0.0', () => {
    console.log(`BossTier API listening on port ${port}`);
  });
}

if (require.main === module) {
  start().catch(error => {
    console.error('[startup] Could not start API:', error.name || 'Error', error.code || '');
    process.exit(1);
  });
}

module.exports = { app, start };
