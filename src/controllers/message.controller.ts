import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { sendFcm, sendExpo } from "../lib/notifications";

// Send message
export const sendMessageRest = async (req: AuthRequest, res: Response) => {
  try {
    const { receiverId, listingId, content } = req.body;
    if (!receiverId || !content) return res.status(400).json({ error: 'receiverId and content required' });

    const message = await prisma.message.create({
      data: {
        senderId: req.user!.id,
        recipientId: receiverId,
        listingId,
        content,
        status: "SENT",
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    // find receiver device tokens
    const sessions = await prisma.session.findMany({ where: { userId: receiverId, deviceToken: { not: null } } });

    // If receiver offline (no active socket) we will notify them from Socket.IO code — but REST can attempt push too:
    for (const s of sessions) {
      if (s.devicePlatform === "expo") {
        await sendExpo(s.deviceToken!, "New message", content, { type: "message", listingId, senderId: req.user!.id });
      } else {
        await sendFcm(s.deviceToken!, "New message", content, { type: "message", listingId, senderId: req.user!.id });
      }
    }

    res.json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Send message failed' });
  }
};

// Get conversation between two users
export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const { otherUserId } = req.params;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user!.id, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: req.user!.id },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch conversation failed" });
  }
};

// Mark messages as read
export const markDelivered = async (req: AuthRequest, res: Response) => {
  try {
    const { messageIds } = req.body; // array of message ids
    if (!Array.isArray(messageIds)) return res.status(400).json({ error: 'messageIds array required' });

    const now = new Date();
    await prisma.message.updateMany({
      where: { id: { in: messageIds }, status: "SENT" },
      data: { status: "DELIVERED", deliveredAt: now },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mark delivered failed' });
  }
};

/** Mark messages from a sender as read (receiver calls) */
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { senderId } = req.body;
    if (!senderId) return res.status(400).json({ error: 'senderId required' });

    const now = new Date();
    const result = await prisma.message.updateMany({
      where: { senderId, recipientId: req.user!.id, status: { in: ["SENT", "DELIVERED"] } },
      data: { status: "READ", readAt: now },
    });

    // Optionally notify sender via push that messages were read (small UX improvement)
    const senderSessions = await prisma.session.findMany({ where: { userId: senderId, deviceToken: { not: null } } });
    for (const s of senderSessions) {
      const body = `${req.user!.id} read your messages`;
      if (s.devicePlatform === "expo") await sendExpo(s.deviceToken!, "Messages read", body, { type: "read", by: req.user!.id });
      else await sendFcm(s.deviceToken!, "Messages read", body, { type: "read", by: req.user!.id });
    }

    res.json({ updatedCount: result.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mark as read failed' });
  }
};

/** Unread count per chat for current user */
export const getUnreadCounts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // group by senderId producing unread count
    const raw = await prisma.$queryRawUnsafe(`
      SELECT senderId, COUNT(*) as unread
      FROM Message
      WHERE receiverId = '${userId}' AND status != 'READ'
      GROUP BY senderId
    `);

    res.json({ counts: raw });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Get unread counts failed' });
  }
};

