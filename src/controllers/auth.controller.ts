import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name },
    });

    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err: any) {
    if (err.code === "P2002") return res.status(409).json({ error: "Email already exists" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
export const sendOtp = async (req: any, res: Response) => {
  const { email, phone } = req.body;
  if (!email && !phone) return res.status(400).json({ error: "Email or phone required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

  const user = await prisma.user.upsert({
    where: email ? { email } : { phone },
    update: { otpCode: otp, otpExpiresAt: expiresAt },
    create: { email, phone, otpCode: otp, otpExpiresAt: expiresAt },
  });

  // TODO: integrate email (nodemailer) or SMS (Twilio) here
  console.log("OTP for", email || phone, "is", otp);

  res.json({ message: "OTP sent" });
};

// Verify OTP (login)
export const verifyOtp = async (req: any, res: Response) => {
  const { email, phone, otp } = req.body;
  if (!otp) return res.status(400).json({ error: "OTP required" });

  const user = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });

  if (!user || user.otpCode !== otp || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  // clear OTP after success
  await prisma.user.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpiresAt: null },
  });

  // issue JWT
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });

  res.json({ token, user });
};
