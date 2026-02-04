/*
  Local ICS proxy for Expo Web.

  Why:
  - Browsers enforce CORS, and public proxies like api.allorigins.win are rate-limited/unreliable.
  - This proxy fetches the ICS server-side and returns it with permissive CORS.
  - NOTE: This proxy DOES NOT save to the database. It is a "pipe" only. The App (syncService) reads from here and saves to Firestore.

  Run:
    node scripts/icsProxyServer.js

  Then set (PowerShell):
    $env:EXPO_PUBLIC_ICS_PROXY="http://localhost:8787/ics"; npm run web

  Or rely on the default http://localhost:8787/ics if env var is not set.
*/

const express = require('express');
const cors = require('cors');

const PORT = Number(process.env.PORT || 8787);
const CACHE_TTL_MS = Number(process.env.ICS_PROXY_CACHE_TTL_MS || 1000 * 60 * 10); // 10 min
const FETCH_TIMEOUT_MS = Number(process.env.ICS_PROXY_TIMEOUT_MS || 15000);
const MAX_CONCURRENT = Number(process.env.ICS_PROXY_MAX_CONCURRENT || 6);

/** @type {Map<string, { expiresAt: number, body: string, contentType: string }>} */
const cache = new Map();

let active = 0;
/** @type {Array<() => void>} */
const queue = [];

function acquire() {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve)).then(() => {
    active += 1;
  });
}

function release() {
  active = Math.max(0, active - 1);
  const next = queue.shift();
  if (next) next();
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Some endpoints behave better with a UA.
        'User-Agent': 'trobar-ics-proxy/1.0',
        'Accept': 'text/calendar,text/plain,*/*'
      }
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

const app = express();
app.use(cors({ 
  origin: true,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With']
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true, active, queued: queue.length, cacheSize: cache.size });
});

app.get('/ics', async (req, res) => {
  const url = String(req.query.url || '');

  if (!url || !isHttpUrl(url)) {
    res.status(400).json({ error: 'Missing or invalid url parameter' });
    return;
  }

  const cached = cache.get(url);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    res.setHeader('Content-Type', cached.contentType || 'text/calendar; charset=utf-8');
    res.setHeader('X-ICS-Proxy', 'cache');
    res.send(cached.body);
    return;
  }

  await acquire();
  try {
    // Re-check cache after waiting for slot.
    const cached2 = cache.get(url);
    const now2 = Date.now();
    if (cached2 && cached2.expiresAt > now2) {
      res.setHeader('Content-Type', cached2.contentType || 'text/calendar; charset=utf-8');
      res.setHeader('X-ICS-Proxy', 'cache');
      res.send(cached2.body);
      return;
    }

    // Simple retry for transient failures.
    const retryDelays = [0, 500, 1200];
    let lastErr = null;
    for (let i = 0; i < retryDelays.length; i++) {
      if (retryDelays[i] > 0) {
        await new Promise((r) => setTimeout(r, retryDelays[i]));
      }

      try {
        const upstream = await fetchWithTimeout(url);

        // Pass through upstream status.
        if (!upstream.ok) {
          // If upstream rate-limits, avoid stampede by caching negative briefly.
          const body = await upstream.text().catch(() => '');
          if (upstream.status === 429) {
            cache.set(url, {
              expiresAt: Date.now() + 1000 * 30,
              body,
              contentType: upstream.headers.get('content-type') || 'text/plain; charset=utf-8'
            });
          }
          res.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'text/plain; charset=utf-8');
          res.setHeader('X-ICS-Proxy', 'upstream-error');
          res.send(body);
          return;
        }

        const contentType = upstream.headers.get('content-type') || 'text/calendar; charset=utf-8';
        const body = await upstream.text();

        cache.set(url, {
          expiresAt: Date.now() + CACHE_TTL_MS,
          body,
          contentType
        });

        res.setHeader('Content-Type', contentType);
        res.setHeader('X-ICS-Proxy', 'live');
        res.send(body);
        return;
      } catch (e) {
        lastErr = e;
      }
    }

    res.status(502).json({ error: 'Failed to fetch upstream', details: String(lastErr || 'unknown') });
  } finally {
    release();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`ICS proxy listening on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
