import { Role } from '@sydt/shared';
import { prisma } from '../src/prisma.js';

const target = process.argv[2]; // optional username or email

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, username: true, role: true, platformRole: true },
  });

  console.log('Current users:');
  for (const u of users) {
    console.log(`  ${u.username} (${u.email}) role=${u.role} platformRole=${u.platformRole ?? 'null'}`);
  }

  const toFix = users.filter(
    (u) => u.role === Role.TEAM_CAPTAIN || u.role === Role.TEAM_MEMBER || !u.platformRole,
  );

  const restore = async (u: (typeof users)[0], role: Role) => {
    await prisma.user.update({
      where: { id: u.id },
      data: { role, platformRole: role },
    });
    console.log(`Restored ${u.username} (${u.email}) -> ${role}`);
  };

  if (target) {
    const key = target.toLowerCase();
    const one = users.find((u) => u.username === key || u.email.toLowerCase() === key);
    if (!one) {
      console.error(`User not found: ${target}`);
      process.exit(1);
    }
    await restore(one, Role.SUPER_ADMIN);
    return;
  }

  // Restore explicit admin account if downgraded
  for (const name of ['admin']) {
    const u = users.find((x) => x.username === name);
    if (u && u.role !== Role.SUPER_ADMIN && u.role !== Role.COMP_ADMIN) {
      await restore(u, Role.SUPER_ADMIN);
    }
  }

  // Real registrations (non-seed emails) that were downgraded to team roles
  for (const u of users) {
    if (u.email.endsWith('@sydt.local')) continue;
    if (u.role === Role.TEAM_CAPTAIN || u.role === Role.TEAM_MEMBER) {
      await restore(u, Role.SUPER_ADMIN);
    }
  }

  // Restore first account (bootstrap owner)
  const first = users[0];
  if (first && first.role !== Role.SUPER_ADMIN) {
    await restore(first, Role.SUPER_ADMIN);
  }

  // Restore anyone stuck as TEAM_CAPTAIN with platformRole staff hint
  for (const u of users) {
    if (
      u.platformRole &&
      (u.platformRole === Role.SUPER_ADMIN || u.platformRole === Role.COMP_ADMIN) &&
      u.role !== u.platformRole
    ) {
      await restore(u, u.platformRole as Role);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
