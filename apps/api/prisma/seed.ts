// Local dev seed. Creates a verified demo user with a few habits so the app
// can be explored right after `bun run db:reset`. Safe to re-run: the demo
// user is deleted first (cascade removes their habits, entries, chats).
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const DEMO_EMAIL = "demo@clickyhabits.local";
const DEMO_PASSWORD = "demo12345";

if (process.env.NODE_ENV === "production") {
  console.error("[seed] refusing to run with NODE_ENV=production");
  process.exit(1);
}

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function main() {
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const userId = crypto.randomUUID();
  await prisma.user.create({
    data: {
      id: userId,
      name: "Demo User",
      email: DEMO_EMAIL,
      emailVerified: true,
      // better-auth email/password login reads the "credential" account.
      accounts: {
        create: {
          id: crypto.randomUUID(),
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(DEMO_PASSWORD),
        },
      },
    },
  });

  await prisma.habit.create({
    data: {
      userId,
      name: "Read 10 pages",
      type: "CALENDAR",
      entries: { create: [0, 1, 2, 4, 5].map((n) => ({ date: daysAgo(n) })) },
    },
  });

  await prisma.habit.create({
    data: {
      userId,
      name: "Drink water",
      type: "JAR",
      entries: { create: [0, 1, 2].map((n) => ({ date: daysAgo(n), count: 3 + n })) },
    },
  });

  console.log(`[seed] demo user ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
