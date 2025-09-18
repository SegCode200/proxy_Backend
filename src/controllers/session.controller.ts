import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

export const registerDevice = async (req: AuthRequest, res: Response) => {
  try {
    const { device, deviceToken, devicePlatform } = req.body;
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // create session record or update existing by device name
    const sess = await prisma.session.upsert({
      where: { id: req.body.sessionId ?? '' }, // if sessionId provided update; else fallback create
      update: {
        device,
        deviceToken,
        devicePlatform,
        lastSeen: new Date(),
      },
      create: {
        userId: req.user.id,
        device,
        deviceToken,
        devicePlatform,
        ip: req.ip,
      },
    }).catch(async () => {
      // fallback if no sessionId or upsert fails: create new session
      return prisma.session.create({
        data: {
          userId: req.user!.id,
          device,
          deviceToken,
          devicePlatform,
          ip: req.ip,
        },
      });
    });

    res.json({ message: 'Device registered', session: sess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Device registration failed' });
  }
};
