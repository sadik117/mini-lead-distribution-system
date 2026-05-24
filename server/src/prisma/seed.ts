import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed..");

  const service1 = await prisma.service.upsert({
    where: { name: "Service 1" },
    update: {},
    create: { name: "Service 1" },
  });

  const service2 = await prisma.service.upsert({
    where: { name: "Service 2" },
    update: {},
    create: { name: "Service 2" },
  });

  const service3 = await prisma.service.upsert({
    where: { name: "Service 3" },
    update: {},
    create: { name: "Service 3" },
  });

  console.log("Services seeded:", service1.name, service2.name, service3.name);


  const providerNames = [
    "Provider 1",
    "Provider 2",
    "Provider 3",
    "Provider 4",
    "Provider 5",
    "Provider 6",
    "Provider 7",
    "Provider 8",
  ];

  for (const name of providerNames) {
    await prisma.provider.upsert({
      where: { name },
      update: {},
      create: {
        name,
        monthlyQuota: 10,
        leadsReceivedThisMonth: 0,
      },
    });
  }

  console.log("Providers seeded: Provider 1 through Provider 8");


  for (const service of [service1, service2, service3]) {
    await prisma.allocationState.upsert({
      where: { serviceId: service.id },
      update: {},
      create: {
        serviceId: service.id,
        pointer: 0,
      },
    });
  }

  console.log("AllocationState seeded for all 3 services");
  console.log("Seed complete!");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
