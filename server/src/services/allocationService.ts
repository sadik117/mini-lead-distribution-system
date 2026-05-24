import { PrismaClient } from "@prisma/client";
import { broadcast } from "./sseService";

const prisma = new PrismaClient();

const MANDATORY_PROVIDERS: Record<number, string[]> = {
  1: ["Provider 1"],
  2: ["Provider 5"],
  3: ["Provider 1", "Provider 4"],
};

const FAIR_POOL: Record<number, string[]> = {
  1: ["Provider 2", "Provider 3", "Provider 4"],
  2: ["Provider 6", "Provider 7", "Provider 8"],
  3: ["Provider 2", "Provider 3", "Provider 5", "Provider 6", "Provider 7", "Provider 8"],
};

const REQUIRED_ASSIGNMENTS = 3;


export async function allocateProviders(
  leadId: string,
  serviceId: number
): Promise<string[]> {
  const assignedNames: string[] = [];

  await prisma.$transaction(async (tx:any) => {
    const stateRows = await tx.$queryRaw<{ id: number; pointer: number }[]>`
      SELECT id, pointer
      FROM "AllocationState"
      WHERE "serviceId" = ${serviceId}
      FOR UPDATE
    `;

    if (stateRows.length === 0) {
      throw new Error(`AllocationState not found for service ${serviceId}`);
    }

    const state = stateRows[0];
    let pointer = state.pointer;

    const mandatoryNames = MANDATORY_PROVIDERS[serviceId] || [];
    const fairPoolNames = FAIR_POOL[serviceId] || [];

    // Pre-lock all potentially needed providers in strictly ascending ID order 
    // to prevent deadlocks between concurrent allocations across different services.
    const allProviderNames = Array.from(new Set([...mandatoryNames, ...fairPoolNames]));
    if (allProviderNames.length > 0) {
      await tx.$queryRaw`
        SELECT id
        FROM "Provider"
        WHERE name = ANY(${allProviderNames}::text[])
        ORDER BY id ASC
        FOR UPDATE
      `;
    }

    const mandatoryProviders = await tx.$queryRaw<
      { id: number; name: string; "leadsReceivedThisMonth": number; "monthlyQuota": number }[]
    >`
      SELECT id, name, "leadsReceivedThisMonth", "monthlyQuota"
      FROM "Provider"
      WHERE name = ANY(${mandatoryNames}::text[])
      FOR UPDATE
    `;

    const assignedIds = new Set<number>();

    for (const provider of mandatoryProviders) {
      if (provider.leadsReceivedThisMonth < provider.monthlyQuota) {
        assignedIds.add(provider.id);
        assignedNames.push(provider.name);
      } else {
        console.warn(
          `Mandatory ${provider.name} is at quota (${provider.leadsReceivedThisMonth}/${provider.monthlyQuota}). Skipping.`
        );
      }
    }

    const slotsNeeded = REQUIRED_ASSIGNMENTS - assignedIds.size;

    if (slotsNeeded > 0 && fairPoolNames.length > 0) {

      const fairPoolProviders = await tx.$queryRaw<
        { id: number; name: string; "leadsReceivedThisMonth": number; "monthlyQuota": number }[]
      >`
        SELECT id, name, "leadsReceivedThisMonth", "monthlyQuota"
        FROM "Provider"
        WHERE name = ANY(${fairPoolNames}::text[])
        FOR UPDATE
      `;

      const poolMap = new Map(fairPoolProviders.map((p:any) => [p.name, p]));
      const orderedPool = fairPoolNames
        .map((name) => poolMap.get(name))
        .filter((p:any): p is NonNullable<typeof p> => p !== undefined);

      let filled = 0;
      let attempts = 0;
      const maxAttempts = orderedPool.length;

      while (filled < slotsNeeded && attempts < maxAttempts) {
        const idx = pointer % orderedPool.length;
        const candidate = orderedPool[idx];

        pointer++;

        if (
          assignedIds.has(candidate.id) ||
          candidate.leadsReceivedThisMonth >= candidate.monthlyQuota
        ) {
          attempts++;
          continue;
        }
        assignedIds.add(candidate.id);
        assignedNames.push(candidate.name);
        filled++;
        attempts++;
      }
    }

    const now = new Date();
    if (assignedIds.size > 0) {
      await tx.leadAssignment.createMany({
        data: Array.from(assignedIds).map((providerId) => ({
          leadId,
          providerId,
          assignedAt: now,
        })),
      });
    }

    if (assignedIds.size > 0) {
      await tx.provider.updateMany({
        where: { id: { in: Array.from(assignedIds) } },
        data: { leadsReceivedThisMonth: { increment: 1 } },
      });
    }

    await tx.allocationState.update({
      where: { id: state.id },
      data: { pointer },
    });
  }, {
    maxWait: 20000,
    timeout: 40000, 
  });

  const providers = await prisma.provider.findMany({
    include: {
      assignments: {
        include: {
          lead: { include: { service: true } },
        },
        orderBy: { assignedAt: "desc" },
      },
    },
    orderBy: { id: "asc" },
  });

  broadcast("dashboard_update", { providers });
  // console.log(`Lead ${leadId} assigned to: ${assignedNames.join(", ")}`);

  return assignedNames;
}
