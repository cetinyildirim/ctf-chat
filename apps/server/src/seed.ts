/**
 * SYDT seed — produces a believable CTF event state.
 *
 * Run: `pnpm seed`
 */
import { PRIORITY_ORDER } from '@sydt/shared';
import { prisma } from './prisma.js';
import { hashPassword } from './lib/password.js';
import { ensureDefaultChatServer } from './lib/migrate-default-server.js';
import { ensureCompetitionDefaults } from './lib/ticket-defaults.js';
import { provisionTeamRoomsForNonStaffCategories } from './modules/categories/category-team-rooms.service.js';

const CHALLENGE_BLUEPRINTS: Array<{
  title: string;
  category: 'WEB' | 'PWN' | 'REV' | 'CRYPTO' | 'FORENSICS' | 'OSINT' | 'MISC';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'INSANE';
  points: number;
  description: string;
  tags: string[];
  hints: Array<{ text: string; cost: number }>;
}> = [
  {
    title: 'Cookie Crumbles',
    category: 'WEB',
    difficulty: 'EASY',
    points: 100,
    description:
      'A login portal hands out a curiously-formatted session cookie. Inspect the structure and you might find your way to the admin dashboard.',
    tags: ['jwt', 'auth-bypass', 'beginner'],
    hints: [
      { text: 'Have you actually decoded the cookie?', cost: 10 },
      { text: 'The algorithm header is suspicious.', cost: 25 },
    ],
  },
  {
    title: 'SQL of Theseus',
    category: 'WEB',
    difficulty: 'MEDIUM',
    points: 250,
    description: 'A search endpoint sanitizes "quotes" but forgets a few edge cases. Find the right payload and exfiltrate the flag from the `secrets` table.',
    tags: ['sqli', 'web', 'union'],
    hints: [
      { text: 'Try injecting after the comma.', cost: 20 },
    ],
  },
  {
    title: 'Server-Side Whispers',
    category: 'WEB',
    difficulty: 'HARD',
    points: 400,
    description: 'A Jinja-templated profile page reflects more than it should. SSTI gives you RCE — but the sandbox is tight.',
    tags: ['ssti', 'jinja', 'sandbox-escape'],
    hints: [
      { text: 'You can iterate over `__subclasses__`.', cost: 50 },
    ],
  },
  {
    title: 'Babys First Heap',
    category: 'PWN',
    difficulty: 'EASY',
    points: 150,
    description: 'A minimal heap challenge with no PIE and a juicy double-free.',
    tags: ['heap', 'double-free', 'libc'],
    hints: [],
  },
  {
    title: 'Stack Necromancy',
    category: 'PWN',
    difficulty: 'HARD',
    points: 500,
    description: 'Stack canary, NX, PIE, full RELRO. Find the leak primitive in the seemingly-unused debug menu.',
    tags: ['ret2libc', 'rop', 'leak'],
    hints: [{ text: 'The debug menu is not actually unused.', cost: 75 }],
  },
  {
    title: 'Reverse Karaoke',
    category: 'REV',
    difficulty: 'EASY',
    points: 100,
    description: 'A small binary that prints song lyrics. Some of the verses are an obfuscated flag check.',
    tags: ['x86-64', 'static-analysis'],
    hints: [],
  },
  {
    title: 'VM Within a VM',
    category: 'REV',
    difficulty: 'HARD',
    points: 450,
    description: 'A custom VM implementing a small ISA. The flag check runs inside two nested instances.',
    tags: ['custom-vm', 'unicorn'],
    hints: [{ text: 'Unicorn engine is your friend.', cost: 60 }],
  },
  {
    title: 'Curveball',
    category: 'CRYPTO',
    difficulty: 'MEDIUM',
    points: 300,
    description: 'ECDSA signatures with reused nonces. Recover the private key, forge the JWT, win the round.',
    tags: ['ecdsa', 'nonce-reuse'],
    hints: [],
  },
  {
    title: 'Cipher 1987',
    category: 'CRYPTO',
    difficulty: 'INSANE',
    points: 700,
    description: 'A custom block cipher with a tiny key schedule. Differential cryptanalysis applies — barely.',
    tags: ['differential', 'spn'],
    hints: [{ text: 'Look at the differential of S-box 3.', cost: 100 }],
  },
  {
    title: 'Cold Boot',
    category: 'FORENSICS',
    difficulty: 'MEDIUM',
    points: 250,
    description: 'A memory dump from an analyst workstation. Recover the password from a half-zeroed key schedule.',
    tags: ['volatility', 'memory'],
    hints: [],
  },
  {
    title: 'Packets in the Attic',
    category: 'FORENSICS',
    difficulty: 'EASY',
    points: 150,
    description: 'A pcap that looks calm. There is a beacon hiding in the DNS noise.',
    tags: ['pcap', 'dns-tunneling'],
    hints: [
      { text: 'Look at unusually long TXT records.', cost: 15 },
    ],
  },
  {
    title: 'Ghost on the Wire',
    category: 'FORENSICS',
    difficulty: 'HARD',
    points: 450,
    description: 'A Sysmon log + Zeek capture. Reconstruct the kill chain and recover the flag from the exfiltrated archive.',
    tags: ['sysmon', 'zeek', 'kill-chain'],
    hints: [],
  },
  {
    title: 'Cafe Coordinates',
    category: 'OSINT',
    difficulty: 'EASY',
    points: 100,
    description: 'A photo of a latte. Find the cafe.',
    tags: ['geoint'],
    hints: [],
  },
  {
    title: 'Persona Non Grata',
    category: 'OSINT',
    difficulty: 'MEDIUM',
    points: 250,
    description: 'Unmask the alias behind three social profiles. The flag is their high-school nickname (lowercase).',
    tags: ['username', 'pivot'],
    hints: [],
  },
  {
    title: 'Tiny Box of Holding',
    category: 'MISC',
    difficulty: 'EASY',
    points: 100,
    description: 'A nicely-formatted ZIP that decompresses to 1.3TB. The flag is in there. Somewhere.',
    tags: ['zip-bomb', 'fun'],
    hints: [],
  },
  {
    title: 'Sudoku as a Service',
    category: 'MISC',
    difficulty: 'MEDIUM',
    points: 200,
    description: 'An API serves sudoku puzzles. Solve a thousand in under a minute to unlock the flag endpoint.',
    tags: ['automation', 'speed'],
    hints: [],
  },
  {
    title: 'GraphQL Goldmine',
    category: 'WEB',
    difficulty: 'MEDIUM',
    points: 250,
    description: 'An exposed introspection schema reveals a forgotten `internalAuditLog` query.',
    tags: ['graphql', 'introspection'],
    hints: [],
  },
  {
    title: 'Padding the Bill',
    category: 'CRYPTO',
    difficulty: 'EASY',
    points: 150,
    description: 'A padding oracle that responds politely with different timings.',
    tags: ['padding-oracle', 'cbc'],
    hints: [{ text: 'Timing differences matter.', cost: 20 }],
  },
  {
    title: 'Use After Tea',
    category: 'PWN',
    difficulty: 'MEDIUM',
    points: 300,
    description: 'A multithreaded server with a subtle UAF in the cleanup path. Race conditions are your friend.',
    tags: ['uaf', 'race'],
    hints: [],
  },
  {
    title: 'Polyglot Files',
    category: 'MISC',
    difficulty: 'HARD',
    points: 400,
    description: 'Craft a single file that is simultaneously a valid PNG, ZIP, and PDF, all containing different chapters of the flag.',
    tags: ['polyglot', 'fileformat'],
    hints: [],
  },
  {
    title: 'Whispers from the BIOS',
    category: 'FORENSICS',
    difficulty: 'INSANE',
    points: 600,
    description: 'A firmware dump with planted persistence. Identify the implant and recover the C2 secret.',
    tags: ['firmware', 'implant'],
    hints: [{ text: 'EFI variables hold more than they say.', cost: 120 }],
  },
  {
    title: 'Lateral Thinking',
    category: 'OSINT',
    difficulty: 'HARD',
    points: 400,
    description: 'Identify the operator from a leaked CDN log fragment.',
    tags: ['log-analysis'],
    hints: [],
  },
  {
    title: 'Tower of Hashes',
    category: 'CRYPTO',
    difficulty: 'HARD',
    points: 500,
    description: 'Three layered hash schemes; one of them collides cheaply.',
    tags: ['collision', 'merkle-damgard'],
    hints: [],
  },
  {
    title: 'Beep Boop Boot',
    category: 'REV',
    difficulty: 'MEDIUM',
    points: 250,
    description: 'A bootloader that plays a tune. The tune is the flag.',
    tags: ['16-bit', 'real-mode'],
    hints: [],
  },
  {
    title: 'Ransom in Reverse',
    category: 'REV',
    difficulty: 'INSANE',
    points: 700,
    description: 'A sample that decrypts itself stage-by-stage. Each stage embeds a flag fragment.',
    tags: ['unpacking', 'multi-stage'],
    hints: [{ text: 'IDA + dynamic. Patience.', cost: 150 }],
  },
];

const TEAM_BLUEPRINTS: Array<{ name: string; tagline: string; color: string }> = [
  { name: 'Null Pointers', tagline: 'segfault, but make it fashion', color: '#22d3ee' },
  { name: 'Schrodinger Daemons', tagline: 'both online and offline', color: '#a78bfa' },
  { name: 'Buffer the Vampire', tagline: 'one stack at a time', color: '#34d399' },
  { name: 'Stack Smashers', tagline: 'we love canary', color: '#fb7185' },
  { name: 'Heap Hawks', tagline: 'tcache enjoyers', color: '#fbbf24' },
  { name: 'Quantum Quokkas', tagline: 'cute & coherent', color: '#f472b6' },
  { name: 'Race Condition United', tagline: 'first one wins', color: '#60a5fa' },
  { name: 'Sigma Sigops', tagline: 'we read manpages for fun', color: '#f59e0b' },
  { name: 'The Wireshark Tank', tagline: 'follow tcp stream', color: '#22c55e' },
  { name: 'Pwntiff & Pwndefendant', tagline: 'arguing about scopes', color: '#e879f9' },
];

const STAFF_BLUEPRINTS = [
  { username: 'odin', displayName: 'Odin', role: 'SUPER_ADMIN' },
  { username: 'freya', displayName: 'Freya', role: 'COMP_ADMIN' },
  { username: 'loki', displayName: 'Loki', role: 'COMP_ADMIN' },
  { username: 'thor', displayName: 'Thor', role: 'CHALLENGE_AUTHOR' },
  { username: 'sif', displayName: 'Sif', role: 'CHALLENGE_AUTHOR' },
  { username: 'heimdall', displayName: 'Heimdall', role: 'MODERATOR' },
  { username: 'tyr', displayName: 'Tyr', role: 'MODERATOR' },
] as const;

const CATEGORIES = [
  { name: 'OPERATIONS', position: 0, staffOnly: false },
  { name: 'GENERAL', position: 1, staffOnly: false },
  { name: 'CHALLENGES', position: 2, staffOnly: false },
  { name: 'SUPPORT', position: 3, staffOnly: false },
  { name: 'TEAMS', position: 4, staffOnly: false },
  { name: 'STAFF', position: 5, staffOnly: true },
  { name: 'INCIDENTS', position: 6, staffOnly: true },
  { name: 'LOGS', position: 7, staffOnly: true },
];

const SAMPLE_MESSAGES: string[] = [
  'Anyone else seeing the SQL of Theseus rate-limit kicking in? Hits at exactly 14 reqs/sec.',
  '```bash\nnmap -p- --min-rate 2000 ctf.example.com\n```\nNothing interesting on the surface scan.',
  'Got first blood on Cookie Crumbles — the JWT alg confusion bit them again.',
  'Heads up: dropping a hint for **Stack Necromancy** in the next 10 min.',
  '```python\nimport requests\nfor payload in payloads:\n    r = requests.post(URL, data={"q": payload})\n    if "flag{" in r.text: print(payload)\n```',
  'IOC dump from the forensics challenge: `185.220.101.45` `8.8.8.8` and the hash `e99a18c428cb38d5f260853678922e03`.',
  'Anyone want to pair on Curveball? I have the lattice setup but the recovery keeps failing.',
  'Server reboot at 22:00 UTC — should only be a 90s blip. Will re-announce.',
  '```\n[+] connected to 10.0.5.13:9001\n[*] leaking libc... 0x7ffff7a0d000\n[*] one_gadget = 0x4527a\n```',
  'Friendly reminder: please do not DoS the platform :)',
  'GG to **Heap Hawks** on the blood for Babys First Heap.',
  'Hint for Persona Non Grata: their old MySpace is still indexed by archive.org.',
  '```json\n{"event": "login", "user": "shadowfax", "ip": "10.0.5.13", "ua": "sqlmap/1.6"}\n```',
  'I think the OSINT challenge expects a *very* specific casing. Try lowercase no spaces.',
  'Quick PSA: the discord-style mention syntax works in chat — try @captain.',
  '`SHA256: 6dcd4ce23d88e2ee9568ba546c007c63d9131c3aa19b7a4d8acb84ffa3b8b3b6`',
  'visit https://ctf.example.com/scoreboard for the live board',
  'we found the ssrf at /api/proxy?url= — gateway accepts file:// too',
  'okay the polyglot challenge is making me reconsider my life choices',
  'staff: please rotate the temporary creds for the forensics dropbox',
];

const STAFF_MESSAGES = [
  'Mod rotation: I will cover the next 2 hours.',
  '@tyr can you keep an eye on the SSRF complaints in #challenge-graphql?',
  'Audit: 4 hint unlocks since the announcement.',
  '/admin/audit looks healthy. Nothing weird in the last 30 min.',
  'I am going to extend the Stack Necromancy challenge by 30 minutes due to the infra hiccup.',
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  console.log('🌱 Seeding SYDT database...');
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.ticketEvent.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.incident.deleteMany(),
    prisma.solve.deleteMany(),
    prisma.hintUnlock.deleteMany(),
    prisma.hint.deleteMany(),
    prisma.reaction.deleteMany(),
    prisma.pin.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.message.deleteMany(),
    prisma.friendship.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.channel.deleteMany(),
    prisma.category.deleteMany(),
    prisma.challenge.deleteMany(),
    prisma.user.deleteMany(),
    prisma.team.deleteMany(),
  ]);

  console.log('  · Creating teams...');
  const teams = await Promise.all(
    TEAM_BLUEPRINTS.map((t) =>
      prisma.team.create({
        data: {
          name: t.name,
          slug: slugify(t.name),
          tagline: t.tagline,
          color: t.color,
          inviteCode: `INV-${slugify(t.name).toUpperCase().slice(0, 6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        },
      }),
    ),
  );

  console.log('  · Creating staff and admin users...');
  const passwordHash = await hashPassword('Admin!2345');
  const staff = [];
  for (const s of STAFF_BLUEPRINTS) {
    staff.push(
      await prisma.user.create({
        data: {
          email: `${s.username}@sydt.local`,
          username: s.username,
          displayName: s.displayName,
          passwordHash,
          role: s.role,
          status: 'ONLINE',
        },
      }),
    );
  }

  // additionally create a super admin alias "admin"
  const admin = await prisma.user.create({
    data: {
      email: 'admin@sydt.local',
      username: 'admin',
      displayName: 'SYDT Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ONLINE',
    },
  });

  console.log('  · Creating team members...');
  const memberPasswordHash = await hashPassword('Operator!2345');
  const teamMembers: { teamId: string; user: { id: string; username: string; teamId: string | null } }[] = [];
  for (let ti = 0; ti < teams.length; ti++) {
    const team = teams[ti]!;
    const captainName = `cap-${slugify(team.name).slice(0, 8)}`;
    const captain = await prisma.user.create({
      data: {
        email: `${captainName}@sydt.local`,
        username: captainName,
        displayName: `${team.name} Captain`,
        passwordHash: memberPasswordHash,
        role: 'TEAM_CAPTAIN',
        teamId: team.id,
        status: 'ONLINE',
      },
    });
    await prisma.team.update({ where: { id: team.id }, data: { captainId: captain.id } });
    teamMembers.push({ teamId: team.id, user: captain });

    for (let mi = 0; mi < 3; mi++) {
      const username = `${slugify(team.name).slice(0, 6)}-${mi + 1}`;
      const u = await prisma.user.create({
        data: {
          email: `${username}@sydt.local`,
          username,
          displayName: `${team.name} #${mi + 1}`,
          passwordHash: memberPasswordHash,
          role: 'TEAM_MEMBER',
          teamId: team.id,
          status: mi === 0 ? 'ONLINE' : mi === 1 ? 'IDLE' : 'OFFLINE',
        },
      });
      teamMembers.push({ teamId: team.id, user: u });
    }
  }

  console.log('  · Creating categories and channels...');
  const categories: Record<string, { id: string }> = {};
  for (const c of CATEGORIES) {
    const cat = await prisma.category.create({ data: c });
    categories[c.name] = { id: cat.id };
  }

  const channels: Record<string, { id: string }> = {};
  async function makeChannel(opts: {
    name: string;
    type: string;
    categoryKey: string;
    topic?: string;
    iconKey?: string;
    isPrivate?: boolean;
    teamId?: string | null;
    isLocked?: boolean;
    challengeId?: string;
    position?: number;
  }) {
    const slug = slugify(opts.name) + '-' + Math.random().toString(36).slice(2, 5);
    const channel = await prisma.channel.create({
      data: {
        name: opts.name,
        slug,
        type: opts.type,
        topic: opts.topic ?? null,
        iconKey: opts.iconKey ?? null,
        categoryId: categories[opts.categoryKey]?.id,
        isPrivate: opts.isPrivate ?? false,
        teamId: opts.teamId ?? null,
        isLocked: opts.isLocked ?? false,
        challengeId: opts.challengeId ?? null,
        position: opts.position ?? 0,
      },
    });
    channels[opts.name] = { id: channel.id };
    return channel;
  }

  await makeChannel({ name: 'announcements', type: 'GLOBAL_ANNOUNCEMENT', categoryKey: 'OPERATIONS', topic: 'Global announcements from staff', iconKey: 'megaphone', isLocked: false });
  await makeChannel({ name: 'live-ops', type: 'GLOBAL_CHAT', categoryKey: 'OPERATIONS', topic: 'Realtime ops chatter', iconKey: 'activity' });
  await makeChannel({ name: 'lobby', type: 'GLOBAL_CHAT', categoryKey: 'GENERAL', topic: 'General chatter', iconKey: 'hash' });
  await makeChannel({ name: 'introductions', type: 'GLOBAL_CHAT', categoryKey: 'GENERAL', topic: 'Say hello', iconKey: 'user-plus' });
  await makeChannel({ name: 'voice-stage', type: 'VOICE_PLACEHOLDER', categoryKey: 'GENERAL', topic: 'Voice (coming soon)', iconKey: 'volume-2', isLocked: true });

  console.log('  · Creating challenges + per-challenge channels + hints...');
  const challengeAuthors = staff.filter((s) => s.role === 'CHALLENGE_AUTHOR' || s.role === 'SUPER_ADMIN');
  const challenges = [];
  for (let i = 0; i < CHALLENGE_BLUEPRINTS.length; i++) {
    const c = CHALLENGE_BLUEPRINTS[i]!;
    const author = challengeAuthors[i % challengeAuthors.length]!;
    const slug = slugify(c.title);
    const challenge = await prisma.challenge.create({
      data: {
        title: c.title,
        slug,
        description: c.description,
        category: c.category,
        difficulty: c.difficulty,
        points: c.points,
        tagsJson: JSON.stringify(c.tags),
        flag: `flag{seed_${slug}_${Math.random().toString(36).slice(2, 10)}}`,
        authorId: author.id,
        hints: {
          create: c.hints.map((h, idx) => ({ order: idx, text: h.text, cost: h.cost })),
        },
      },
    });
    challenges.push(challenge);

    await makeChannel({
      name: `chal-${slug}`,
      type: 'CHALLENGE_DISCUSSION',
      categoryKey: 'CHALLENGES',
      topic: `Discussion for ${c.title}`,
      iconKey: 'flag',
      challengeId: challenge.id,
    });
  }

  await makeChannel({ name: 'support', type: 'TEAM_SUPPORT', categoryKey: 'SUPPORT', topic: 'Need help? Open a ticket from /tickets', iconKey: 'life-buoy' });
  await makeChannel({ name: 'tickets', type: 'STAFF_COORD', categoryKey: 'STAFF', topic: 'Live ticket stream (staff)', iconKey: 'ticket' });
  await makeChannel({ name: 'staff-coord', type: 'STAFF_COORD', categoryKey: 'STAFF', topic: 'Staff coordination', iconKey: 'shield' });
  await makeChannel({ name: 'organizer-internal', type: 'ORGANIZER_INTERNAL', categoryKey: 'STAFF', topic: 'Organizer only', iconKey: 'lock' });
  await makeChannel({ name: 'incidents', type: 'INCIDENT', categoryKey: 'INCIDENTS', topic: 'Active incidents', iconKey: 'alert-triangle' });
  await makeChannel({ name: 'audit-log', type: 'LOGS', categoryKey: 'LOGS', topic: 'Live audit events', iconKey: 'scroll-text', isLocked: true });

  console.log('  · Provisioning team rooms per non-staff category...');
  await provisionTeamRoomsForNonStaffCategories(prisma);

  console.log('  · Seeding messages...');
  const lobby = channels['lobby']!;
  const liveOps = channels['live-ops']!;
  const announcementCh = channels['announcements']!;
  const staffCoord = channels['staff-coord']!;
  const allChatChannels = [lobby, liveOps];
  const allUsersFlat = [...teamMembers.map((m) => m.user), ...staff, admin];

  async function postMessage(channelId: string, authorId: string, content: string, daysAgo = 0) {
    const createdAt = new Date(Date.now() - daysAgo * 60_000);
    const mentionMatches = Array.from(content.matchAll(/@([a-z0-9_.-]{3,24})/gi));
    const mentions = Array.from(new Set(mentionMatches.map((m) => m[1]!.toLowerCase())));
    return prisma.message.create({
      data: {
        channelId,
        authorId,
        content,
        mentionsJson: JSON.stringify(mentions),
        createdAt,
      },
    });
  }

  for (let i = 0; i < 220; i++) {
    const author = allUsersFlat[Math.floor(Math.random() * allUsersFlat.length)]!;
    const ch = allChatChannels[Math.floor(Math.random() * allChatChannels.length)]!;
    const content = SAMPLE_MESSAGES[i % SAMPLE_MESSAGES.length]!;
    await postMessage(ch.id, author.id, content, Math.floor(Math.random() * 180));
  }

  for (const challenge of challenges) {
    const slug = challenge.slug;
    const ch = channels[`chal-${slug}`]!;
    const recentParticipants = allUsersFlat.slice(0, 8);
    for (let i = 0; i < 6; i++) {
      const author = recentParticipants[i % recentParticipants.length]!;
      const content =
        i % 3 === 0
          ? `Anyone seeing weird behavior on **${challenge.title}**? My exploit hangs after the second stage.`
          : i % 3 === 1
          ? '```bash\ncurl -s https://chal.example.com/api/v1/check | jq\n```'
          : `IOCs so far: \`185.220.101.45\` and \`6dcd4ce23d88e2ee9568ba546c007c63d9131c3aa19b7a4d8acb84ffa3b8b3b6\``;
      await postMessage(ch.id, author.id, content, 240 - i * 5);
    }
  }

  for (let i = 0; i < STAFF_MESSAGES.length; i++) {
    const author = staff[i % staff.length]!;
    await postMessage(staffCoord.id, author.id, STAFF_MESSAGES[i]!, 30 - i);
  }

  await postMessage(
    announcementCh.id,
    admin.id,
    '**Welcome to SYDT CTF 2026.** Read the rules pinned in #lobby. Good luck!',
    300,
  );

  console.log('  · Simulating solves...');
  const captains = teamMembers.filter((m) => m.user.username.startsWith('cap-'));
  for (let i = 0; i < challenges.length; i++) {
    const challenge = challenges[i]!;
    const teamCount = Math.min(7, 1 + Math.floor(Math.random() * teams.length));
    const shuffled = [...captains].sort(() => Math.random() - 0.5);
    for (let t = 0; t < teamCount; t++) {
      const captain = shuffled[t]!;
      try {
        await prisma.solve.create({
          data: {
            challengeId: challenge.id,
            teamId: captain.user.teamId!,
            userId: captain.user.id,
            firstBlood: t === 0,
            solvedAt: new Date(Date.now() - (challenges.length - i) * 5 * 60_000 - t * 90_000),
          },
        });
        if (t === 0) {
          await prisma.challenge.update({
            where: { id: challenge.id },
            data: { firstBloodTeamId: captain.user.teamId! },
          });
        }
      } catch {
        // unique constraint hit; skip
      }
    }
  }

  console.log('  · Ensuring default competition + ticket metadata...');
  const defaultServerId = await ensureDefaultChatServer();
  const { competition, categories: ticketCategories } = await ensureCompetitionDefaults(defaultServerId);
  const ticketCategoryByKey = new Map(ticketCategories.map((c) => [c.key, c.id]));

  console.log('  · Creating tickets...');
  const supportTickets = [
    { title: 'Web challenge not loading', body: 'The Cookie Crumbles challenge returns 502.', priority: 'HIGH', status: 'OPEN' as const, category: 'CHALLENGE_ISSUE' },
    { title: 'Hint unlock failed', body: 'Tried to unlock hint 2 on Curveball, got 500.', priority: 'MEDIUM', status: 'IN_PROGRESS' as const, category: 'TECHNICAL_ISSUE' },
    { title: 'Flag accepted but no points', body: 'Submitted flag for Reverse Karaoke, got Correct but score did not change.', priority: 'CRITICAL', status: 'WAITING_FOR_COMPETITOR' as const, category: 'SCORE_ISSUE' },
    { title: 'VPN drops every few minutes', body: 'Our whole team keeps losing the lab VPN tunnel.', priority: 'LOW', status: 'RESOLVED' as const, category: 'INFRASTRUCTURE' },
    { title: 'Cannot see #announcements', body: 'Channel is missing from sidebar.', priority: 'LOW', status: 'CLOSED' as const, category: 'OTHER' },
  ];

  for (let i = 0; i < supportTickets.length; i++) {
    const t = supportTickets[i]!;
    const opener = teamMembers[i % teamMembers.length]!.user;
    const moderator = staff.find((s) => s.role === 'MODERATOR') ?? staff[0]!;
    const seq = i + 1;
    const assigned = t.status !== 'OPEN';
    const ticket = await prisma.ticket.create({
      data: {
        serverId: defaultServerId,
        seq,
        code: `${competition.ticketPrefix}-${String(seq).padStart(6, '0')}`,
        title: t.title,
        body: t.body,
        priority: t.priority,
        priorityRank: PRIORITY_ORDER[t.priority as keyof typeof PRIORITY_ORDER] ?? 1,
        status: t.status,
        categoryId: ticketCategoryByKey.get(t.category) ?? null,
        openedById: opener.id,
        teamId: opener.teamId,
        assignedToId: assigned ? moderator.id : null,
        firstResponseAt: assigned ? new Date() : null,
        lastOrganizerReplyAt: assigned ? new Date() : null,
        resolvedAt: t.status === 'RESOLVED' || t.status === 'CLOSED' ? new Date() : null,
        closedAt: t.status === 'CLOSED' ? new Date() : null,
        events: {
          create: [
            { type: 'CREATED', authorId: opener.id, body: t.body },
            ...(assigned
              ? [{ type: 'ASSIGNED' as const, authorId: moderator.id, body: null }]
              : []),
            ...(t.status === 'IN_PROGRESS'
              ? [{
                  type: 'COMMENT' as const,
                  authorId: moderator.id,
                  body: 'Looking into the scoring service now — will report back in a few.',
                }]
              : []),
            ...(t.status === 'RESOLVED' || t.status === 'CLOSED'
              ? [{
                  type: 'RESOLVED' as const,
                  authorId: moderator.id,
                  body: 'Fixed — please re-test and let us know.',
                }]
              : []),
          ],
        },
      },
    });
    if (i === 2) {
      await prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          type: 'INTERNAL_NOTE',
          authorId: moderator.id,
          body: 'Scoring worker missed an enqueue — restarted; will rerun reconcile job.',
        },
      });
    }
  }

  console.log('  · Creating incidents + announcements...');
  await prisma.incident.create({
    data: {
      title: 'Scoring service degradation',
      description: 'Flag submissions briefly experienced 5-10s latency between 19:42 and 19:48 UTC. Backlog drained, no submissions lost.',
      severity: 'HIGH',
      status: 'MITIGATED',
      openedById: staff[1]!.id,
      assignedToId: staff[1]!.id,
    },
  });
  await prisma.incident.create({
    data: {
      title: 'Pwn challenge instance crash loop',
      description: 'Stack Necromancy instance OOMing. Increased container memory limit and restarted.',
      severity: 'MEDIUM',
      status: 'RESOLVED',
      openedById: staff[5]!.id,
      assignedToId: staff[5]!.id,
      resolvedAt: new Date(),
    },
  });

  await prisma.announcement.create({
    data: {
      title: 'Welcome to SYDT CTF 2026',
      body: 'Read the rules pinned in #lobby. Submit flags via the challenge page. Have fun.',
      severity: 'INFO',
      authorId: admin.id,
    },
  });
  await prisma.announcement.create({
    data: {
      title: 'Round 2 challenges drop in 30 minutes',
      body: 'Five new challenges across WEB / PWN / FORENSICS will release at the top of the hour. Good luck!',
      severity: 'INFO',
      authorId: admin.id,
    },
  });
  await prisma.announcement.create({
    data: {
      title: 'Brief scoring delay (resolved)',
      body: 'Flag submissions between 19:42 and 19:48 UTC were delayed up to 10s. All submissions were processed; scoreboard is consistent.',
      severity: 'MEDIUM',
      authorId: staff[1]!.id,
    },
  });

  console.log('✓ Seed complete.');
  console.log('');
  console.log('Login credentials:');
  console.log('  Super admin   : admin / Admin!2345');
  console.log('  Staff users   : odin, freya, loki, thor, sif, heimdall, tyr / Admin!2345');
  console.log('  Team captains : cap-null-pointers, cap-stack-smashers, ... / Operator!2345');
  console.log('  Team members  : null-p-1, stack--1, ... / Operator!2345');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
