import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { allocateProviders } from "../services/allocationService";

const router = Router();
const prisma = new PrismaClient();

const CreateLeadSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  city: z.string().min(1, "City is required"),
  serviceId: z.number().int().min(1).max(3),
  description: z.string().min(5, "Description must be at least 5 characters"),
});


router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = CreateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { customerName, phone, city, serviceId, description } = parsed.data;

    try {
      const lead = await prisma.lead.create({
        data: {
          id: uuidv4(),
          customerName,
          phone,
          city,
          serviceId,
          description,
        },
      });

      const assignedProviders = await allocateProviders(lead.id, serviceId);

      res.status(201).json({
        message: "Lead created and assigned successfully",
        lead,
        assignedProviders,
      });
    } catch (err) {
      next(err);
    }
  }
);


router.get(
  "/",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const leads = await prisma.lead.findMany({
        include: {
          service: true,
          assignments: {
            include: { provider: true },
            orderBy: { assignedAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(leads);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
