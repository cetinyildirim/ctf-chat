/**
 * Faz 0 + manual regression (M1–M4) — automated security checks.
 * Run: pnpm security:regression
 * Requires API on http://localhost:4000
 */
import 'dotenv/config';
import { io, type Socket } from 'socket.io-client';

const API = process.env.REGRESSION_API ?? 'http://localhost:4000/api';
const ORIGIN = API.replace(/\/api\/?$/, '');
const VICTIM_USER = 'null-p-1';
const VICTIM_PASS = 'Operator!2345';

type Result = { id: string; name: string; pass: boolean; detail: string; note?: string };

class Session {
  jar = new Map<string, string>();
  csrf = '';

  getCookie(name: string): string | undefined {
    return this.jar.get(name);
  }

  cookieHeader(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  absorb(setCookie: string | null): void {
    if (!setCookie) return;
    const parts = setCookie.split(/,(?=\s*[a-zA-Z_][\w-]*=)/);
    for (const part of parts) {
      const seg = part.trim().split(';')[0];
      if (!seg) continue;
      const eq = seg.indexOf('=');
      if (eq <= 0) continue;
      const name = seg.slice(0, eq).trim();
      const value = seg.slice(eq + 1).trim();
      if (value) this.jar.set(name, value);
      else this.jar.delete(name);
    }
    const csrfCookie = this.jar.get('sydt_csrf');
    if (csrfCookie) this.csrf = csrfCookie;
  }

  absorbAll(res: Response): void {
    const raw = res.headers.getSetCookie?.() ?? [];
    if (raw.length) {
      for (const c of raw) this.absorb(c);
    } else {
      this.absorb(res.headers.get('set-cookie'));
    }
  }

  async fetch(
    path: string,
    init: RequestInit & { skipCsrf?: boolean; cookieOverride?: string } = {},
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('cookie', init.cookieOverride ?? this.cookieHeader());
    if (
      init.method &&
      !['GET', 'HEAD', 'OPTIONS'].includes(init.method) &&
      !init.skipCsrf &&
      this.csrf
    ) {
      headers.set('X-CSRF-Token', this.csrf);
    }
    const res = await fetch(`${API}${path}`, { ...init, headers });
    this.absorbAll(res);
    return res;
  }

  async ensureCsrf(): Promise<void> {
    await this.fetch('/auth/csrf', { method: 'GET' });
  }

  async login(identifier: string, password: string): Promise<{ ok: boolean; status: number; body: string }> {
    await this.ensureCsrf();
    const res = await this.fetch('/auth/login', {
      method: 'POST',
      skipCsrf: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  }

  async json<T = unknown>(
    path: string,
    init?: RequestInit & { skipCsrf?: boolean; cookieOverride?: string },
  ): Promise<{ status: number; data: T; text: string }> {
    const res = await this.fetch(path, init);
    const text = await res.text();
    let data: T = undefined as T;
    try {
      data = text ? (JSON.parse(text) as T) : (undefined as T);
    } catch {
      /* non-json */
    }
    return { status: res.status, data, text };
  }
}

function parseRefreshFromResponse(res: Response): string | null {
  const raw = res.headers.getSetCookie?.() ?? [];
  const all = raw.length ? raw.join(',') : res.headers.get('set-cookie') ?? '';
  const match = all.match(/sydt_rt=([^;,\s]+)/);
  return match?.[1] ?? null;
}

async function rawRefresh(refreshToken: string): Promise<{ status: number; res: Response }> {
  const res = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: { cookie: `sydt_rt=${refreshToken}` },
  });
  return { status: res.status, res };
}

function pass(id: string, name: string, ok: boolean, detail: string, note?: string): Result {
  return { id, name, pass: ok, detail, note };
}

function socketConnect(cookieHeader: string, timeoutMs = 8000): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    let socket: Socket | null = null;
    const timer = setTimeout(() => {
      socket?.disconnect();
      resolve({ ok: false, error: 'timeout' });
    }, timeoutMs);

    socket = io(ORIGIN, {
      transports: ['websocket'],
      extraHeaders: { cookie: cookieHeader },
      reconnection: false,
      timeout: timeoutMs - 500,
    });

    socket.on('connect', () => {
      clearTimeout(timer);
      socket?.disconnect();
      resolve({ ok: true });
    });

    socket.on('connect_error', (err: Error) => {
      clearTimeout(timer);
      socket?.disconnect();
      resolve({ ok: false, error: err.message });
    });
  });
}

async function main(): Promise<void> {
  const results: Result[] = [];
  const admin = new Session();
  const moderator = new Session();
  const compAdmin = new Session();
  const victim = new Session();

  const health = await fetch(`${ORIGIN}/health`);
  if (!health.ok) {
    console.error('API not reachable at', ORIGIN);
    process.exit(1);
  }

  for (const [label, s, id, pw] of [
    ['admin', admin, 'admin', 'Admin!2345'],
    ['moderator', moderator, 'heimdall', 'Admin!2345'],
    ['compAdmin', compAdmin, 'freya', 'Admin!2345'],
    ['victim', victim, VICTIM_USER, VICTIM_PASS],
  ] as const) {
    const login = await s.login(id, pw);
    if (!login.ok) {
      console.error(`${label} login failed:`, login.body);
      process.exit(1);
    }
  }

  const slug = `regtest-${Date.now().toString(36)}`;
  const createServer = await admin.json<{ server: { id: string } }>('/servers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'RegTest Isolated', slug, description: 'Faz0 regression' }),
  });
  const foreignServerId = createServer.data?.server?.id;
  if (!foreignServerId) {
    console.error('Could not create test server:', createServer.text);
    process.exit(1);
  }

  const chList = await moderator.json(`/channels?serverId=${foreignServerId}`);
  results.push(
    pass('F0-1', 'Non-member GET /channels?serverId=', chList.status === 403, `status=${chList.status}`),
  );

  const catMod = await moderator.json('/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'REGTEST', serverId: foreignServerId, staffOnly: false }),
  });
  results.push(
    pass('F0-2', 'Non-privileged user cannot create category', catMod.status === 403, `status=${catMod.status}`),
  );

  const catAdmin = await compAdmin.json('/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'REGTEST-ADMIN', serverId: foreignServerId, staffOnly: false }),
  });
  results.push(
    pass(
      'F0-2b',
      'COMP_ADMIN cross-server (ADMIN_DASHBOARD)',
      catAdmin.status === 201,
      `status=${catAdmin.status}`,
      'Documented accepted risk',
    ),
  );
  if (catAdmin.status === 201 && catAdmin.data) {
    const created = catAdmin.data as { category?: { id: string } };
    if (created.category?.id) {
      await admin.json(`/categories/${created.category.id}`, { method: 'DELETE' });
    }
  }

  const usersList = await admin.json<{ users: Array<{ id: string; username: string }> }>(
    `/admin/users?q=${VICTIM_USER}`,
  );
  const victimId = usersList.data?.users?.find((u) => u.username === VICTIM_USER)?.id;
  let banOk = false;
  let meAfterBan = 0;
  let socketAfterBan = { ok: true, error: 'not tested' };
  if (victimId) {
    const banRes = await admin.json(`/admin/users/${victimId}/moderation`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isBanned: true }),
    });
    banOk = banRes.status === 200;
    const me = await victim.json('/auth/me');
    meAfterBan = me.status;
    socketAfterBan = await socketConnect(victim.cookieHeader());
    await admin.json(`/admin/users/${victimId}/moderation`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isBanned: false }),
    });
    await victim.login(VICTIM_USER, VICTIM_PASS);
  }
  results.push(pass('F0-3a', 'Admin can ban user', banOk, victimId ? `ok=${banOk}` : 'user missing'));
  results.push(pass('F0-3b', 'Banned user GET /auth/me rejected', meAfterBan === 401, `status=${meAfterBan}`));
  results.push(
    pass(
      'M1',
      'Banned user Socket.IO connect rejected',
      !socketAfterBan.ok,
      socketAfterBan.ok ? 'connected unexpectedly' : `error=${socketAfterBan.error ?? 'rejected'}`,
    ),
  );

  let uploadStatus = 0;
  let uploadBody = '';
  const servers = await victim.json<{ servers: Array<{ id: string }> }>('/servers');
  const defaultServerId = servers.data?.servers?.[0]?.id;
  if (defaultServerId) {
    const channels = await victim.json<{ channels: Array<{ id: string; type: string }> }>(
      `/channels?serverId=${defaultServerId}`,
    );
    const channelId = channels.data?.channels?.find((c) => c.type !== 'DIRECT_MESSAGE')?.id;
    if (channelId) {
      const form = new FormData();
      form.append('content', 'regression upload test');
      form.append('files', new Blob(['<html><body>x</body></html>'], { type: 'text/html' }), 'evil.html');
      const uploadRes = await victim.fetch(`/channels/${channelId}/messages`, { method: 'POST', body: form });
      uploadStatus = uploadRes.status;
      uploadBody = await uploadRes.text();
    }
  }
  results.push(
    pass(
      'F0-4',
      'text/html message upload rejected (400)',
      uploadStatus === 400,
      `status=${uploadStatus} body=${uploadBody.slice(0, 100)}`,
    ),
  );

  const reuseUser = new Session();
  const reuseLogin = await reuseUser.login('tyr', 'Admin!2345');
  const stolenRefresh = reuseUser.getCookie('sydt_rt');
  if (!reuseLogin.ok || !stolenRefresh) {
    results.push(pass('F0-5a', 'Refresh rotation works', false, 'tyr login or refresh cookie missing'));
    results.push(pass('F0-5b', 'Revoked refresh reuse rejected', false, 'skipped'));
    results.push(pass('F0-5c', 'All sessions invalidated after reuse', false, 'skipped'));
  } else {
    const rotate = await rawRefresh(stolenRefresh);
    const newRefresh = parseRefreshFromResponse(rotate.res);
    results.push(pass('F0-5a', 'Refresh rotation works', rotate.status === 200, `status=${rotate.status}`));

    const reuse = await rawRefresh(stolenRefresh);
    results.push(
      pass('F0-5b', 'Revoked refresh reuse rejected', reuse.status === 401, `status=${reuse.status}`),
    );

    let thirdStatus = 0;
    if (newRefresh) {
      const third = await rawRefresh(newRefresh);
      thirdStatus = third.status;
    }
    results.push(
      pass(
        'F0-5c',
        'All sessions invalidated after reuse',
        thirdStatus === 401,
        newRefresh ? `status=${thirdStatus}` : 'no rotated token',
      ),
    );
  }

  await admin.login('admin', 'Admin!2345');

  const patchMe = await moderator.json(`/servers/${foreignServerId}/me`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nickname: 'intruder' }),
  });
  results.push(
    pass('F0-6', 'Non-member PATCH /servers/:id/me blocked', patchMe.status === 403, `status=${patchMe.status}`),
  );

  // M2: Server-scoped ban blocks channel access and hides server from rail list
  if (victimId && defaultServerId) {
    await admin.json(`/servers/${defaultServerId}/members/${victimId}/ban`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'regression' }),
    });
    const chAfterServerBan = await victim.json(`/channels?serverId=${defaultServerId}`);
    const serversAfterBan = await victim.json<{ servers: Array<{ id: string }> }>('/servers');
    const stillListed = serversAfterBan.data?.servers?.some((s) => s.id === defaultServerId) ?? false;
    results.push(
      pass(
        'M2a',
        'Server ban blocks GET /channels',
        chAfterServerBan.status === 403,
        `status=${chAfterServerBan.status}`,
      ),
    );
    results.push(
      pass('M2b', 'Server ban hides server from GET /servers', !stillListed, `listed=${stillListed}`),
    );
    await admin.json(`/servers/${defaultServerId}/members/${victimId}/ban`, { method: 'DELETE' });
    await victim.login(VICTIM_USER, VICTIM_PASS);
  } else {
    results.push(pass('M2a', 'Server ban blocks GET /channels', false, 'skipped'));
    results.push(pass('M2b', 'Server ban hides server from GET /servers', false, 'skipped'));
  }

  // M3: CSRF required on mutating requests
  const csrfRes = await victim.fetch('/servers', {
    method: 'POST',
    skipCsrf: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'CSRF Test', slug: `csrf-${Date.now()}`, description: null }),
  });
  results.push(
    pass('M3', 'POST without CSRF token rejected', csrfRes.status === 403, `status=${csrfRes.status}`),
  );

  // M4: Tampered access JWT rejected (API equivalent of edge invalid-token handling)
  const access = victim.getCookie('sydt_at');
  let tamperStatus = 0;
  if (access) {
    const tampered = access.slice(0, -1) + (access.endsWith('a') ? 'b' : 'a');
    const tamperRes = await victim.fetch('/auth/me', { cookieOverride: `sydt_at=${tampered}` });
    tamperStatus = tamperRes.status;
  }
  results.push(
    pass('M4', 'Tampered access JWT rejected', tamperStatus === 401, `status=${tamperStatus}`),
  );

  await admin.json(`/servers/${foreignServerId}`, { method: 'DELETE' });

  console.log('\n=== Faz 0 + M1–M4 Security Regression ===\n');
  console.log('| ID | Pass | Test | Detail |');
  console.log('|----|------|------|--------|');
  for (const r of results) {
    const note = r.note ? ` (${r.note})` : '';
    console.log(`| ${r.id} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}${note} |`);
  }
  const required = results.filter((r) => r.id !== 'F0-2b');
  const failed = required.filter((r) => !r.pass);
  console.log(`\n${required.length - failed.length}/${required.length} required checks passed`);
  if (results.find((r) => r.id === 'F0-2b')?.pass) {
    console.log('F0-2b: COMP_ADMIN cross-server access confirmed (accepted platform-admin behavior)');
  }
  if (failed.length) {
    console.error('\nFailed:', failed.map((f) => f.id).join(', '));
    process.exit(1);
  }
  console.log('\nAll required checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
