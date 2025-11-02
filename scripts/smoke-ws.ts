/*
  WebSocket smoke test for collab-server
  Usage:
    pnpm smoke:ws -- --url http://localhost:4000 --users 10 --hz 10 --duration 60 --project smoke --session smoke-1
*/

import { WebSocket } from 'ws';

type Args = {
  url: string;
  users: number;
  hz: number;
  duration: number; // seconds
  project: string;
  session: string;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (key: string, def?: string) => {
    const idx = argv.indexOf(`--${key}`);
    if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
    return def;
  };
  const url = get('url', process.env.COLLAB_URL || 'http://localhost:4000')!;
  const users = parseInt(get('users', '10')!, 10);
  const hz = parseInt(get('hz', '10')!, 10);
  const duration = parseInt(get('duration', '60')!, 10);
  const project = get('project', 'smoke-project')!;
  const session = get('session', `smoke-${Date.now()}`)!;
  return { url, users, hz, duration, project, session };
}

async function login(baseUrl: string, email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const data = (await res.json()) as { session: { token: string } };
  return { token: data.session.token };
}

async function ensureSession(baseUrl: string, token: string, projectId: string, sessionId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ projectId, sessionId }),
  });
  if (!res.ok) throw new Error(`create session failed: ${res.status}`);
}

type ClientStats = {
  errors: number;
  received: number;
  pong: number;
};

async function runClient(idx: number, wsUrl: string, token: string, sessionId: string, hz: number, durationSec: number): Promise<ClientStats> {
  return new Promise((resolve) => {
    const stats: ClientStats = { errors: 0, received: 0, pong: 0 };
    const ws = new WebSocket(wsUrl);
    let interval: NodeJS.Timer | null = null;
    let pingInterval: NodeJS.Timer | null = null;

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'join-session', sessionId, token }));
      const periodMs = Math.max(1, Math.floor(1000 / Math.max(1, hz)));
      interval = setInterval(() => {
        const x = Math.sin(Date.now() / 1000 + idx);
        const y = Math.cos(Date.now() / 1000 + idx);
        const msg = { type: 'cursor-update', sessionId, position: [x, y, 0] };
        try { ws.send(JSON.stringify(msg)); } catch {}
      }, periodMs);
      pingInterval = setInterval(() => {
        try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
      }, 5000);
    });

    ws.on('message', (raw) => {
      stats.received++;
      try {
        const msg = JSON.parse(String(raw)) as { type?: string };
        if (msg.type === 'pong') stats.pong++;
      } catch {}
    });

    ws.on('error', () => { stats.errors++; });

    setTimeout(() => {
      if (interval) clearInterval(interval);
      if (pingInterval) clearInterval(pingInterval);
      try { ws.close(); } catch {}
      resolve(stats);
    }, durationSec * 1000);
  });
}

async function main(): Promise<void> {
  const args = parseArgs();
  const baseUrl = args.url;
  const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws`;

  console.log(`[smoke] baseUrl=${baseUrl} users=${args.users} hz=${args.hz} duration=${args.duration}s session=${args.session}`);

  // Prepare users and session
  const creds = await Promise.all(
    Array.from({ length: args.users }, async (_, i) => {
      const email = `smoke_${i}@example.test`;
      const password = `Test1234A!`;
      const { token } = await login(baseUrl, email, password);
      await ensureSession(baseUrl, token, args.project, args.session);
      return { token };
    })
  );

  // Run clients
  const results = await Promise.all(
    creds.map((c, i) => runClient(i, wsUrl, c.token, args.session, args.hz, args.duration))
  );

  // Aggregate
  const agg = results.reduce((a, r) => ({ errors: a.errors + r.errors, received: a.received + r.received, pong: a.pong + r.pong }), { errors: 0, received: 0, pong: 0 });
  console.log(`[smoke] done: clients=${args.users} totalReceived=${agg.received} totalPong=${agg.pong} errors=${agg.errors}`);
}

void main();


