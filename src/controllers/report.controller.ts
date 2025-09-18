import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

// User submits report
export const createReport = async (req: AuthRequest, res: Response) => {
  try {
    const { targetType, targetId, reason } = req.body;

    const report = await prisma.report.create({
      data: {
        reporterId: req.user!.id,
        targetType,
        targetId,
        reason,
      },
    });

    res.json({ message: "Report submitted", report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Report submission failed" });
  }
};

// Admin fetch reports
export const getReports = async (req: Request, res: Response) => {
  try {
    const reports = await prisma.report.findMany({
      where: { status: "PENDING" },
      include: { reporter: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
};

// Admin resolve report
export const resolveReport = async (req: AuthRequest, res: Response) => {
  try {
    const { reportId, action, note } = req.body;

    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: action === "approve" ? "ACTIONED" : "REJECTED",
        adminNote: note,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "REPORT_" + action.toUpperCase(),
        meta: { reportId, note },
      },
    });

    res.json({ message: "Report resolved", report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to resolve report" });
  }
};
