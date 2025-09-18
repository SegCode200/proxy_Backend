import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden: Admins only" });
  next();
};

export const modOrAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role !== "ADMIN" && req.user.role !== "MODERATOR")
    return res.status(403).json({ error: "Forbidden: Admin/Moderator only" });
  next();
};
