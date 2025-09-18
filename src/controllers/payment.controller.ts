import { Response } from "express";
import prisma from "../lib/prisma";
import cloudinary from "../lib/cloudinary";
import { AuthRequest } from "../middleware/auth";

// Create a meetup transaction
export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { listingId, method, amountCents } = req.body;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    if (listing.sellerId === req.user!.id) {
      return res.status(400).json({ error: "Seller cannot buy their own listing" });
    }

    const tx = await prisma.transaction.create({
      data: {
        listingId,
        buyerId: req.user!.id,
        sellerId: listing.sellerId,
        amountCents: Number(amountCents) || listing.priceCents,
        method,
        status: "PENDING",
      },
    });

    res.json({ message: "Transaction created", transaction: tx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Transaction creation failed" });
  }
};

// Upload receipt (buyer or seller)
export const uploadReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const file = (req.files as any)?.file;
    const { transactionId } = req.body;

    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    if (![tx.buyerId, tx.sellerId].includes(req.user!.id)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      resource_type: "auto",
      folder: `transactions/${transactionId}`,
    });

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: { receiptUrl: result.secure_url },
    });

    res.json({ message: "Receipt uploaded", transaction: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Receipt upload failed" });
  }
};

// Mark transaction completed (manual for MVP)
export const completeTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { transactionId } = req.body;

    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    if (![tx.buyerId, tx.sellerId].includes(req.user!.id)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "COMPLETED" },
    });

    res.json({ message: "Transaction marked completed", transaction: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to complete transaction" });
  }
};
