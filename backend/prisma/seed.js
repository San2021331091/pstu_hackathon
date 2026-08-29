"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
    console.log(`Seeded validators. Total online nodes: ${count}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map