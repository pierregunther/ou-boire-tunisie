// Fonction serveur Vercel : lit et enregistre les messages (base Upstash Redis).
const crypto = require('crypto');
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'comments', KEEP = 200, SHOW = 50, MAX_PER_HOUR = 5;
const LINKS = /(https?:|www\.|:\/\/|\b[\w-]+\.(com|net|org|ru|io|xyz|info|biz|top|click|shop)\b)/i;

async function redis(cmds) {
  const r = await fetch(URL_ + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  const out = await r.json();
  out.forEach(function (o) { if (o.error) throw new Error(o.error); });
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'storage' });
  try {
    if (req.method === 'GET') {
      const out = await redis([['LRANGE', KEY, 0, SHOW - 1]]);
      const items = (out[0].result || []).map(function (s) {
        try { return JSON.parse(s); } catch (e) { return null; }
      }).filter(Boolean);
      return res.status(200).json({ items: items });
    }
    if (req.method === 'POST') {
      let b = req.body || {};
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
      if (b.website) return res.status(200).json({ ok: true }); // piège anti-robots
      const text = String(b.text || '').replace(/\s+/g, ' ').trim();
      if (text.length < 5 || text.length > 500) return res.status(400).json({ error: 'length' });
      if (LINKS.test(text)) return res.status(400).json({ error: 'links' });
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnu';
      const rl = 'rl:' + crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
      const n = (await redis([['INCR', rl]]))[0].result;
      if (n === 1) await redis([['EXPIRE', rl, 3600]]);
      if (n > MAX_PER_HOUR) return res.status(429).json({ error: 'rate' });
      await redis([
        ['LPUSH', KEY, JSON.stringify({ t: text, d: new Date().toISOString() })],
        ['LTRIM', KEY, 0, KEEP - 1]
      ]);
      return res.status(201).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
};
