import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { allocateProviders } from "../services/allocationService";

const router = Router();
const prisma = new PrismaClient();

const TEST_CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Pune", "Hyderabad"];
const TEST_NAMES = [
  "Alice Test", "Bob Test", "Charlie Test", "Diana Test", "Eve Test",
  "Frank Test", "Grace Test", "Henry Test", "Iris Test", "Jack Test",
];


router.post(
  "/generate-leads",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const timestamp = Date.now();

      // Build 10 concurrent lead creation promises
      const promises = Array.from({ length: 10 }, async (_, i) => {
        const serviceId = (i % 3) + 1; 

        // Using timestamp + index to guarantee unique phone numbers across runs
        const phone = `${9000000000 + timestamp % 1000000 + i}`.slice(-10);

        // Create the lead
        const lead = await prisma.lead.create({
          data: {
            id: uuidv4(),
            customerName: TEST_NAMES[i],
            phone,
            city: TEST_CITIES[i % TEST_CITIES.length],
            serviceId,
            description: `Test lead ${i + 1} for concurrency testing (batch: ${timestamp})`,
          },
        });

        // Allocate providers this is where concurrency is tested
        const assignedProviders = await allocateProviders(lead.id, serviceId);

        return { lead: lead.id, service: serviceId, assignedProviders };
      });

      // Run ALL 10 lead creations simultaneously
      const results = await Promise.allSettled(promises);

      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<typeof r extends PromiseFulfilledResult<infer T> ? T : never> => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<{lead: string; service: number; assignedProviders: string[]}>).value);

      const failed = results
        .filter((r) => r.status === "rejected")
        .map((r) => (r as PromiseRejectedResult).reason?.message || "Unknown error");

      res.json({
        message: `Generated ${succeeded.length}/10 leads successfully`,
        succeeded,
        failed,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
