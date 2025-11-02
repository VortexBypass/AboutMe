const crypto = require('crypto');
const UPSTASH_URL = process.env.UPSTASH_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REST_TOKEN;
function upstashRequest(path, body) {
  return fetch(`${UPSTASH_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }).then(r => r.json());
}
function sha256hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}
function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return xf.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || '';
}
module.exports = async (req, res) => {
  try {
    const op = (req.query && req.query.op) || (new URL(req.url, 'http://localhost')).searchParams.get('op') || null;
    if ((req.method === 'GET' && op === 'get')) {
      const r = await upstashRequest('/get', { 'key': 'afk:count' });
      const val = (r && typeof r.result !== 'undefined' && r.result !== null) ? Number(r.result) : 0;
      res.setHeader('Content-Type','application/json');
      res.status(200).send(JSON.stringify({ ok:true, count: val }));
      return;
    }
    const ip = getClientIp(req) || '';
    if (!ip) {
      const r0 = await upstashRequest('/get', { key: 'afk:count' });
      const v0 = (r0 && typeof r0.result !== 'undefined' && r0.result !== null) ? Number(r0.result) : 0;
      res.setHeader('Content-Type','application/json');
      res.status(200).send(JSON.stringify({ ok:true, count: v0 }));
      return;
    }
    const ipHash = sha256hex(ip);
    const sismem = await upstashRequest('/sismember', { key: 'afk:ips', member: ipHash });
    const isMember = sismem && sismem.result === 1;
    let countVal = 0;
    if (!isMember) {
      const multiBody = {
        commands: [
          ["sadd", "afk:ips", ipHash],
          ["incr", "afk:count"],
          ["get", "afk:count"]
        ]
      };
      const multires = await upstashRequest('/pipeline', multiBody);
      if (multires && Array.isArray(multires.result)) {
        const last = multires.result[multires.result.length - 1];
        countVal = Number(last);
      } else {
        const g = await upstashRequest('/get', { key: 'afk:count' });
        countVal = (g && typeof g.result !== 'undefined' && g.result !== null) ? Number(g.result) : 0;
      }
    } else {
      const g = await upstashRequest('/get', { key: 'afk:count' });
      countVal = (g && typeof g.result !== 'undefined' && g.result !== null) ? Number(g.result) : 0;
    }
    res.setHeader('Content-Type','application/json');
    res.status(200).send(JSON.stringify({ ok:true, count: countVal }));
  } catch (err) {
    console.error('visit api error', err);
    try {
      const g = await upstashRequest('/get', { key: 'afk:count' });
      const countVal = (g && typeof g.result !== 'undefined' && g.result !== null) ? Number(g.result) : 0;
      res.setHeader('Content-Type','application/json');
      res.status(200).send(JSON.stringify({ ok:false, count: countVal, error: String(err) }));
    } catch (_) {
      res.setHeader('Content-Type','application/json');
      res.status(500).send(JSON.stringify({ ok:false, error: 'internal' }));
    }
  }
};
