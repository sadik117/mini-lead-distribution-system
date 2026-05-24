import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { broadcast } from "../services/sseService";

const router = Router();
const prisma = new PrismaClient();


router.post(
  "/reset-quota",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { idempotencyKey } = req.body;

    // Idempotency key is REQUIRED — without it we can't guarantee deduplication
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      res.status(400).json({
        error: "idempotencyKey is required in the request body",
      });
      return;
    }

    try {
      // Idempotency check and processing in a single transaction 

      let alreadyProcessed = false;

      await prisma.$transaction(async (tx:any) => {
        // Checked if webhook event was already processed
        const existing = await tx.webhookEvent.findUnique({
          where: { id: idempotencyKey },
        });

        if (existing) {
          // Already processed — mark flag and exit transaction without changes
          alreadyProcessed = true;
          return;
        }

        // Record this event FIRST (before processing) to prevent duplicate execution
        // even if the server crashes mid-reset
        await tx.webhookEvent.create({
          data: {
            id: idempotencyKey,
            type: "quota_reset",
          },
        });

        // Reset all providers: quota back to 10, count back to 0
        await tx.provider.updateMany({
          data: {
            monthlyQuota: 10,
            leadsReceivedThisMonth: 0,
          },
        });
      });

      if (alreadyProcessed) {
        res.status(200).json({
          message: "Webhook already processed",
          idempotencyKey,
          processed: false,
        });
        return;
      }

      // Broadcast updated provider data via SSE 
      const providers = await prisma.provider.findMany({
        include: {
          assignments: {
            include: { lead: { include: { service: true } } },
            orderBy: { assignedAt: "desc" },
          },
        },
        orderBy: { id: "asc" },
      });

      broadcast("dashboard_update", { providers });

      res.status(200).json({
        message: "Provider quotas reset successfully",
        idempotencyKey,
        processed: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
