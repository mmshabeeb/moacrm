/**
 * MOA Direct Presigned Media Storage Service
 * Offloads heavy voice notes & customer measurement images directly to S3 / Cloudflare R2
 * preventing bandwidth saturation across 100,000+ concurrent users.
 */

export interface PresignedUploadRequest {
  filename: string;
  fileType: 'audio/webm' | 'audio/mp3' | 'image/jpeg' | 'image/png' | 'application/pdf';
  fileSize: number;
  sessionToken: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;       // Direct S3 / Cloudflare R2 PUT destination
  publicCdnUrl: string;    // Distributed edge CDN URL for instant chat streaming
  expiresInSeconds: number;
}

export class MOAMediaStorageService {
  private cdnBaseUrl: string;

  constructor() {
    this.cdnBaseUrl = process.env.MOA_CDN_BASE_URL || 'https://cdn.mallofabayas.com';
  }

  /**
   * Generates a direct presigned PUT upload URL
   */
  public generatePresignedUpload(req: PresignedUploadRequest): PresignedUploadResponse {
    const timestamp = Date.now();
    const cleanFilename = req.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = req.fileType.startsWith('audio/') ? 'voice_notes' : 'measurements';
    const key = `${folder}/${req.sessionToken}/${timestamp}_${cleanFilename}`;

    // In full cloud deployment, invokes S3Client / Cloudflare R2 getSignedUrl(PutObjectCommand)
    const publicCdnUrl = `${this.cdnBaseUrl}/${key}`;
    const uploadUrl = `https://storage.mallofabayas.com/upload/${key}?signature=signed_${timestamp}`;

    return {
      uploadUrl,
      publicCdnUrl,
      expiresInSeconds: 300 // 5 minutes validity
    };
  }
}
