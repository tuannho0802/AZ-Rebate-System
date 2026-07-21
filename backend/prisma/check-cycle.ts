import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCycle() {
  const users = await prisma.user.findMany({
    select: { id: true, parentId: true, email: true },
  });

  const adj = new Map<string, string>();
  for (const u of users) {
    if (u.parentId) {
      adj.set(u.id, u.parentId);
    }
  }

  for (const u of users) {
    let curr: string | undefined = u.id;
    const path: string[] = [];
    const localVisited = new Set<string>();
    while (curr) {
      if (localVisited.has(curr)) {
        console.error(`Cycle detected: ${path.join(' -> ')} -> ${curr}`);
        process.exit(1);
      }
      localVisited.add(curr);
      path.push(curr);
      curr = adj.get(curr);
    }
  }
  console.log('No cycles detected in User parentId hierarchy!');
  process.exit(0);
}

checkCycle().catch((err) => {
  console.error(err);
  process.exit(1);
});
