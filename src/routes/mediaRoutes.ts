import { Router, Request, Response } from 'express';
import { MOAMediaStorageService } from '../services/mediaStorageService';

export const mediaRouter = Router();
const mediaService = new MOAMediaStorageService();

/**
 * POST /api/media/presign
 * Generates direct S3 / Cloudflare R2 presigned upload URL
 * Offloads heavy voice notes & photos directly to object storage
 */
mediaRouter.post('/presign', (req: Request, res: Response) => {
  try {
    const { filename, fileType, fileSize, sessionToken } = req.body;

    if (!filename || !fileType || !sessionToken) {
      return res.status(400).json({ error: 'Missing required upload parameters' });
    }

    const presigned = mediaService.generatePresignedUpload({
      filename,
      fileType,
      fileSize: Number(fileSize) || 0,
      sessionToken
    });

    return res.json({
      success: true,
      data: presigned
    });
  } catch (error: any) {
    console.error('Presign media error:', error);
    return res.status(500).json({ error: 'Failed to generate presigned upload URL' });
  }
});
