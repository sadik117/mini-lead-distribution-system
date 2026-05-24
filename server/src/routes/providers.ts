import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.get(
  "/",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const providers = await prisma.provider.findMany({
        orderBy: { id: "asc" },
        include: {
          assignments: {
            orderBy: { assignedAt: "desc" },
            include: {
              lead: {
                include: {
                  service: true,
                },
              },
            },
          },
        },
      });

      const result = providers.map((p:any) => ({
        id: p.id,
        name: p.name,
        monthlyQuota: p.monthlyQuota,
        leadsReceivedThisMonth: p.leadsReceivedThisMonth,
        remainingQuota: Math.max(0, p.monthlyQuota - p.leadsReceivedThisMonth),
        assignments: p.assignments,
      }));

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
