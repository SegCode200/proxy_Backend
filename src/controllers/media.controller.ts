import { Response } from "express";
import prisma from "../lib/prisma";
import cloudinary from "../lib/cloudinary";
import { AuthRequest } from "../middleware/auth";

export const uploadMedia = async (req: AuthRequest, res: Response) => {
  try {
    const file = (req.files as any)?.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      resource_type: "auto",
      folder: `marketplace/${req.user!.id}`,
    });

    const media = await prisma.media.create({
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        mimeType: `${result.resource_type}/${result.format}`,
        size: result.bytes,
        user: { connect: { id: req.user!.id } },
      },
    });

    res.json({ media });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
};
