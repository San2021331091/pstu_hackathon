import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed the validator set. F3 vote-to-ban runs 2-of-3 supermajority consensus,
 * so we need three independent nodes present before any transfer finalizes.
 */
async function main() {
  const names = ['Validator-Dhaka', 'Validator-Chattogram', 'Validator-Sylhet'];
  for (const name of names) {
    await prisma.validator.upsert({
      where: { name },
      update: { online: true },
      create: { name, online: true },
    });
  }
  const count = await prisma.validator.count();
  // eslint-disable-next-line no-console
  console.log(`Seeded validators. Total online nodes: ${count}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
