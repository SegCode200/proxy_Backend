import express from 'express';
import authRoutes from "./routes/auth.routes";
import listingsRoutes from "./routes/listings.route";
import mediaRoutes from "./routes/media.route";
import searchRoutes from "./routes/search.route";
import kycRoutes from "./routes/kyc.routes";
import reportRoutes from "./routes/report.routes";
import paymentRoutes from "./routes/payment.routes";
import messageRoutes from "./routes/message.route";
import sessionRoutes from "./routes/session.routes";
import http from "http";
import { Server } from "socket.io";
import prisma from "./lib/prisma"
import { sendExpo, sendFcm } from "./lib/notifications";
import adminRoutes from "./routes/admin.routes";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import xss from "xss-clean";
import rateLimit from 'express-rate-limit';


const app = express();
const PORT = process.env.PORT || 4321;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // change to your frontend URL later
  },
});
// const onlineUsers = new Map<string, string>();

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/admin", adminRoutes);
// Cookie parser
app.use(cookieParser());

// Security headers
app.use(helmet());

// Prevent XSS attacks
app.use(xss());

// HTTP request logging
app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use(limiter);

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  // user joins with a sessionId and userId
  socket.on("join", async (data: { sessionId: string; userId: string }) => {
    try {
      const session = await prisma.session.findUnique({
        where: { id: data.sessionId },
      });

      if (!session || session.userId !== data.userId) {
        return socket.emit("error", { message: "Invalid session" });
      }

      // mark session online
      await prisma.session.update({
        where: { id: data.sessionId },
        data: { socketId: socket.id, isOnline: true, lastSeen: new Date() },
      });

      socket.data.userId = data.userId;
      socket.data.sessionId = data.sessionId;

      console.log(`User ${data.userId} is online via session ${data.sessionId}`);
      socket.emit("joined", { message: "You are online" });
    } catch (err) {
      console.error("Join error:", err);
      socket.emit("error", { message: "Failed to join" });
    }
  });

  // typing events
  socket.on("typing", async ({ to }: { to: string }) => {
    const sessions = await prisma.session.findMany({
      where: { userId: to, isOnline: true, socketId: { not: null } },
    });
    for (const s of sessions) {
      io.to(s.socketId!).emit("typing", { from: socket.data.userId });
    }
  });

  socket.on("stop_typing", async ({ to }: { to: string }) => {
    const sessions = await prisma.session.findMany({
      where: { userId: to, isOnline: true, socketId: { not: null } },
    });
    for (const s of sessions) {
      io.to(s.socketId!).emit("stop_typing", { from: socket.data.userId });
    }
  });

  // send message realtime
  socket.on("send_message", async (payload: { receiverId: string; listingId?: string; content: string; tempId?: string }) => {
    try {
      const senderId = socket.data.userId;
      if (!senderId) return socket.emit("error", { message: "Not joined" });

      // Save message (status = SENT)
      const message = await prisma.message.create({
        data: {
          senderId,
          recipientId: payload.receiverId,
          listingId: payload.listingId,
          content: payload.content,
          status: "SENT",
        },
      });

      // Find all online sessions for receiver
      const receiverSessions = await prisma.session.findMany({
        where: { userId: payload.receiverId, isOnline: true, socketId: { not: null } },
      });

      if (receiverSessions.length > 0) {
        // Deliver to all online sessions
        for (const s of receiverSessions) {
          io.to(s.socketId!).emit("receive_message", message);
        }

        // Update status to DELIVERED
        const delivered = await prisma.message.update({
          where: { id: message.id },
          data: { status: "DELIVERED", deliveredAt: new Date() },
        });

        // Notify sender about delivery
        socket.emit("message_delivered", { id: delivered.id, deliveredAt: delivered.deliveredAt, tempId: payload.tempId });
      } else {
        // Receiver offline → send push notifications
        const sessions = await prisma.session.findMany({
          where: { userId: payload.receiverId, deviceToken: { not: null } },
        });
        for (const s of sessions) {
          if (s.devicePlatform === "expo") {
            await sendExpo(s.deviceToken!, "New message", payload.content, {
              type: "message",
              senderId,
              listingId: payload.listingId,
            });
          } else {
            await sendFcm(s.deviceToken!, "New message", payload.content, {
              type: "message",
              senderId,
              listingId: payload.listingId ?? "",
            });
          }
        }
        socket.emit("message_sent", message);
      }
    } catch (err) {
      console.error("socket send_message error", err);
      socket.emit("error", { message: "send_message failed" });
    }
  });

  // mark delivered
  socket.on("ack_delivered", async (data: { messageId: string }) => {
    try {
      const msg = await prisma.message.findUnique({ where: { id: data.messageId } });
      if (!msg) return;

      if (msg.status === "SENT") {
        const delivered = await prisma.message.update({
          where: { id: data.messageId },
          data: { status: "DELIVERED", deliveredAt: new Date() },
        });

        // notify sender if online
        const senderSessions = await prisma.session.findMany({
          where: { userId: msg.senderId, isOnline: true, socketId: { not: null } },
        });
        for (const s of senderSessions) {
          io.to(s.socketId!).emit("message_delivered", {
            id: delivered.id,
            deliveredAt: delivered.deliveredAt,
          });
        }
      }
    } catch (err) {
      console.error("ack_delivered error", err);
    }
  });

  // mark read
  socket.on("ack_read", async (data: { messageIds: string[]; senderId: string }) => {
    try {
      const now = new Date();
      await prisma.message.updateMany({
        where: {
          id: { in: data.messageIds },
          recipientId: socket.data.userId,
          status: { in: ["SENT", "DELIVERED"] },
        },
        data: { status: "READ", readAt: now },
      });

      // notify sender
      const senderSessions = await prisma.session.findMany({
        where: { userId: data.senderId, isOnline: true, socketId: { not: null } },
      });
      for (const s of senderSessions) {
        io.to(s.socketId!).emit("messages_read", {
          by: socket.data.userId,
          messageIds: data.messageIds,
          readAt: now,
        });
      }
    } catch (err) {
      console.error("ack_read error", err);
    }
  });

  // disconnect cleanup
  socket.on("disconnect", async () => {
    if (socket.data.sessionId) {
      await prisma.session.update({
        where: { id: socket.data.sessionId },
        data: { isOnline: false, socketId: null, lastSeen: new Date() },
      });
      console.log(`User ${socket.data.userId} went offline`);
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
process.on("uncaughtException", (error) => {
  console.log("Server is shutting downn because of uncaughtException");
  console.log(error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.log("server is shutting down because of unhandledRejection");
  console.log(reason);
  server.close(() => {
    process.exit(1);
  });
});