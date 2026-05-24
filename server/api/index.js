// src/app.ts
import express from "express";
import cors from "cors";

// src/middleware/errorHandler.ts
function errorHandler(err, _req, res, _next) {
  console.error("Error:", err.message, err.stack);
  if (err.code === "P2002") {
    res.status(409).json({
      error: "Duplicate entry",
      message: "A lead with this phone number already exists for the selected service."
    });
    return;
  }
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal Server Error"
  });
}

// src/routes/leads.ts
import { Router } from "express";
import { PrismaClient as PrismaClient2 } from "@prisma/client";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

// src/services/allocationService.ts
import { PrismaClient } from "@prisma/client";

// src/services/sseService.ts
var clients = /* @__PURE__ */ new Set();
function addClient(res) {
  clients.add(res);
}
function removeClient(res) {
  clients.delete(res);
}
function broadcast(eventName, payload) {
  const message = `event: ${eventName}
data: ${JSON.stringify(payload)}

`;
  let deadClients = 0;
  clients.forEach((client) => {
    try {
      client.write(message);
    } catch {
      clients.delete(client);
      deadClients++;
    }
  });
  if (deadClients > 0) {
    console.log(`Removed ${deadClients} dead SSE clients`);
  }
  console.log(
    `Broadcast "${eventName}" to ${clients.size} clients`
  );
}

// src/services/allocationService.ts
var prisma = new PrismaClient();
var MANDATORY_PROVIDERS = {
  1: ["Provider 1"],
  2: ["Provider 5"],
  3: ["Provider 1", "Provider 4"]
};
var FAIR_POOL = {
  1: ["Provider 2", "Provider 3", "Provider 4"],
  2: ["Provider 6", "Provider 7", "Provider 8"],
  3: ["Provider 2", "Provider 3", "Provider 5", "Provider 6", "Provider 7", "Provider 8"]
};
var REQUIRED_ASSIGNMENTS = 3;
async function allocateProviders(leadId, serviceId) {
  const assignedNames = [];
  await prisma.$transaction(async (tx) => {
    const stateRows = await tx.$queryRaw`
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
    const allProviderNames = Array.from(/* @__PURE__ */ new Set([...mandatoryNames, ...fairPoolNames]));
    if (allProviderNames.length > 0) {
      await tx.$queryRaw`
        SELECT id
        FROM "Provider"
        WHERE name = ANY(${allProviderNames}::text[])
        ORDER BY id ASC
        FOR UPDATE
      `;
    }
    const mandatoryProviders = await tx.$queryRaw`
      SELECT id, name, "leadsReceivedThisMonth", "monthlyQuota"
      FROM "Provider"
      WHERE name = ANY(${mandatoryNames}::text[])
      FOR UPDATE
    `;
    const assignedIds = /* @__PURE__ */ new Set();
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
      const fairPoolProviders = await tx.$queryRaw`
        SELECT id, name, "leadsReceivedThisMonth", "monthlyQuota"
        FROM "Provider"
        WHERE name = ANY(${fairPoolNames}::text[])
        FOR UPDATE
      `;
      const poolMap = new Map(fairPoolProviders.map((p) => [p.name, p]));
      const orderedPool = fairPoolNames.map((name) => poolMap.get(name)).filter((p) => p !== void 0);
      let filled = 0;
      let attempts = 0;
      const maxAttempts = orderedPool.length;
      while (filled < slotsNeeded && attempts < maxAttempts) {
        const idx = pointer % orderedPool.length;
        const candidate = orderedPool[idx];
        pointer++;
        if (assignedIds.has(candidate.id) || candidate.leadsReceivedThisMonth >= candidate.monthlyQuota) {
          attempts++;
          continue;
        }
        assignedIds.add(candidate.id);
        assignedNames.push(candidate.name);
        filled++;
        attempts++;
      }
    }
    const now = /* @__PURE__ */ new Date();
    if (assignedIds.size > 0) {
      await tx.leadAssignment.createMany({
        data: Array.from(assignedIds).map((providerId) => ({
          leadId,
          providerId,
          assignedAt: now
        }))
      });
    }
    if (assignedIds.size > 0) {
      await tx.provider.updateMany({
        where: { id: { in: Array.from(assignedIds) } },
        data: { leadsReceivedThisMonth: { increment: 1 } }
      });
    }
    await tx.allocationState.update({
      where: { id: state.id },
      data: { pointer }
    });
  }, {
    maxWait: 2e4,
    timeout: 4e4
  });
  const providers = await prisma.provider.findMany({
    include: {
      assignments: {
        include: {
          lead: { include: { service: true } }
        },
        orderBy: { assignedAt: "desc" }
      }
    },
    orderBy: { id: "asc" }
  });
  broadcast("dashboard_update", { providers });
  return assignedNames;
}

// src/routes/leads.ts
var router = Router();
var prisma2 = new PrismaClient2();
var CreateLeadSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  city: z.string().min(1, "City is required"),
  serviceId: z.number().int().min(1).max(3),
  description: z.string().min(5, "Description must be at least 5 characters")
});
router.post(
  "/",
  async (req, res, next) => {
    const parsed = CreateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors
      });
      return;
    }
    const { customerName, phone, city, serviceId, description } = parsed.data;
    try {
      const lead = await prisma2.lead.create({
        data: {
          id: uuidv4(),
          customerName,
          phone,
          city,
          serviceId,
          description
        }
      });
      const assignedProviders = await allocateProviders(lead.id, serviceId);
      res.status(201).json({
        message: "Lead created and assigned successfully",
        lead,
        assignedProviders
      });
    } catch (err) {
      next(err);
    }
  }
);
router.get(
  "/",
  async (_req, res, next) => {
    try {
      const leads = await prisma2.lead.findMany({
        include: {
          service: true,
          assignments: {
            include: { provider: true },
            orderBy: { assignedAt: "asc" }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      res.json(leads);
    } catch (err) {
      next(err);
    }
  }
);
var leads_default = router;

// src/routes/providers.ts
import { Router as Router2 } from "express";
import { PrismaClient as PrismaClient3 } from "@prisma/client";
var router2 = Router2();
var prisma3 = new PrismaClient3();
router2.get(
  "/",
  async (_req, res, next) => {
    try {
      const providers = await prisma3.provider.findMany({
        orderBy: { id: "asc" },
        include: {
          assignments: {
            orderBy: { assignedAt: "desc" },
            include: {
              lead: {
                include: {
                  service: true
                }
              }
            }
          }
        }
      });
      const result = providers.map((p) => ({
        id: p.id,
        name: p.name,
        monthlyQuota: p.monthlyQuota,
        leadsReceivedThisMonth: p.leadsReceivedThisMonth,
        remainingQuota: Math.max(0, p.monthlyQuota - p.leadsReceivedThisMonth),
        assignments: p.assignments
      }));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
var providers_default = router2;

// src/routes/webhook.ts
import { Router as Router3 } from "express";
import { PrismaClient as PrismaClient4 } from "@prisma/client";
var router3 = Router3();
var prisma4 = new PrismaClient4();
router3.post(
  "/reset-quota",
  async (req, res, next) => {
    const { idempotencyKey } = req.body;
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      res.status(400).json({
        error: "idempotencyKey is required in the request body"
      });
      return;
    }
    try {
      let alreadyProcessed = false;
      try {
        await prisma4.$transaction(async (tx) => {
          await tx.webhookEvent.create({
            data: {
              id: idempotencyKey,
              type: "quota_reset"
            }
          });
          await tx.provider.updateMany({
            data: {
              monthlyQuota: 10,
              leadsReceivedThisMonth: 0
            }
          });
        }, {
          maxWait: 1e4,
          timeout: 2e4
        });
      } catch (err) {
        if (err.code === "P2002") {
          alreadyProcessed = true;
        } else {
          throw err;
        }
      }
      if (alreadyProcessed) {
        res.status(200).json({
          message: "Webhook already processed",
          idempotencyKey,
          processed: false
        });
        return;
      }
      const providers = await prisma4.provider.findMany({
        include: {
          assignments: {
            include: { lead: { include: { service: true } } },
            orderBy: { assignedAt: "desc" }
          }
        },
        orderBy: { id: "asc" }
      });
      broadcast("dashboard_update", { providers });
      res.status(200).json({
        message: "Provider quotas reset successfully",
        idempotencyKey,
        processed: true
      });
    } catch (err) {
      next(err);
    }
  }
);
var webhook_default = router3;

// src/routes/sse.ts
import { Router as Router4 } from "express";
var router4 = Router4();
router4.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(`event: connected
data: ${JSON.stringify({ message: "SSE connected" })}

`);
  addClient(res);
  const pingInterval = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(pingInterval);
    }
  }, 3e4);
  req.on("close", () => {
    clearInterval(pingInterval);
    removeClient(res);
  });
});
var sse_default = router4;

// src/routes/test.ts
import { Router as Router5 } from "express";
import { PrismaClient as PrismaClient5 } from "@prisma/client";
import { v4 as uuidv42 } from "uuid";
var router5 = Router5();
var prisma5 = new PrismaClient5();
var TEST_CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Pune", "Hyderabad"];
var TEST_NAMES = [
  "Alice Test",
  "Bob Test",
  "Charlie Test",
  "Diana Test",
  "Eve Test",
  "Frank Test",
  "Grace Test",
  "Henry Test",
  "Iris Test",
  "Jack Test"
];
router5.post(
  "/generate-leads",
  async (_req, res, next) => {
    try {
      const timestamp = Date.now();
      const promises = Array.from({ length: 10 }, async (_, i) => {
        const serviceId = i % 3 + 1;
        const phone = `${9e9 + timestamp % 1e6 + i}`.slice(-10);
        const lead = await prisma5.lead.create({
          data: {
            id: uuidv42(),
            customerName: TEST_NAMES[i],
            phone,
            city: TEST_CITIES[i % TEST_CITIES.length],
            serviceId,
            description: `Test lead ${i + 1} for concurrency testing (batch: ${timestamp})`
          }
        });
        const assignedProviders = await allocateProviders(lead.id, serviceId);
        return { lead: lead.id, service: serviceId, assignedProviders };
      });
      const results = await Promise.allSettled(promises);
      const succeeded = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      const failed = results.filter((r) => r.status === "rejected").map((r) => r.reason?.message || "Unknown error");
      res.json({
        message: `Generated ${succeeded.length}/10 leads successfully`,
        succeeded,
        failed
      });
    } catch (err) {
      next(err);
    }
  }
);
var test_default = router5;

// src/app.ts
var app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
  })
);
app.get("/", (_req, res) => {
  res.send("Lead Distribution System is running..");
});
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.use("/api/leads", leads_default);
app.use("/api/providers", providers_default);
app.use("/api/webhook", webhook_default);
app.use("/api/events", sse_default);
app.use("/api/test", test_default);
app.use(errorHandler);
var app_default = app;

// src/index.ts
var index_default = app_default;
export {
  index_default as default
};
