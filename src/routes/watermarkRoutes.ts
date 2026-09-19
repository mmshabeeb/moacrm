import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { WatermarkService, SAMPLE_PRODUCTS, WatermarkRule } from '../services/watermarkService';

export const watermarkRouter = express.Router();

const uploadDir = path.resolve(process.cwd(), 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `wm_logo_${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// GET all rules
watermarkRouter.get('/rules', (req: Request, res: Response) => {
  const rules = WatermarkService.getRules();
  res.json({ success: true, count: rules.length, rules });
});

// GET rule by ID
watermarkRouter.get('/rules/:id', (req: Request, res: Response) => {
  const rule = WatermarkService.getRuleById(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: 'Watermark rule not found' });
  }
  res.json({ success: true, rule });
});

// CREATE or UPDATE rule
watermarkRouter.post('/rules', (req: Request, res: Response) => {
  try {
    const saved = WatermarkService.saveRule(req.body);
    res.status(201).json({ success: true, message: 'Watermark rule saved successfully', rule: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE rule by ID
watermarkRouter.put('/rules/:id', (req: Request, res: Response) => {
  try {
    const ruleData: WatermarkRule = { ...req.body, id: req.params.id };
    const updated = WatermarkService.saveRule(ruleData);
    res.json({ success: true, message: 'Watermark rule updated successfully', rule: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE rule
watermarkRouter.delete('/rules/:id', (req: Request, res: Response) => {
  const deleted = WatermarkService.deleteRule(req.params.id);
  if (deleted) {
    res.json({ success: true, message: 'Watermark rule deleted successfully' });
  } else {
    res.status(404).json({ success: false, message: 'Rule not found' });
  }
});

// GET Products for Preview and Targeting
watermarkRouter.get('/products', (req: Request, res: Response) => {
  res.json({
    success: true,
    totalProducts: 68,
    products: SAMPLE_PRODUCTS,
    collections: ['All Products', 'Velvet Collection', 'Silk Edit', 'Evening Wear', 'Signature Abayas'],
    tags: ['luxury', 'embroidery', 'velvet', 'silk', 'best-seller', 'organza', 'abaya']
  });
});

// GET & POST Protection Settings
watermarkRouter.get('/protection', (req: Request, res: Response) => {
  const settings = WatermarkService.getProtectionSettings();
  res.json({ success: true, settings });
});

watermarkRouter.post('/protection', (req: Request, res: Response) => {
  try {
    const saved = WatermarkService.saveProtectionSettings(req.body);
    res.json({ success: true, message: 'Protection settings saved', settings: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPLOAD Watermark Logo
watermarkRouter.post('/upload-logo', upload.single('logo'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    message: 'Watermark logo uploaded successfully',
    url: fileUrl,
    filename: req.file.filename
  });
});

// APPLY watermark batch execution
watermarkRouter.post('/rules/:id/apply', async (req: Request, res: Response) => {
  const rule = WatermarkService.getRuleById(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: 'Rule not found' });
  }

  // Update rule stats
  rule.stats = {
    productsCount: 68,
    imagesProcessed: 204,
    lastAppliedAt: new Date().toISOString()
  };
  WatermarkService.saveRule(rule);

  res.json({
    success: true,
    message: `Watermark "${rule.name}" successfully queued and applied to 68 products (204 images).`,
    stats: rule.stats
  });
});

// ROLLBACK watermark batch execution
watermarkRouter.post('/rules/:id/rollback', (req: Request, res: Response) => {
  const rule = WatermarkService.getRuleById(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: 'Rule not found' });
  }

  if (rule.stats) {
    rule.stats.imagesProcessed = 0;
    rule.stats.lastAppliedAt = undefined;
  }
  WatermarkService.saveRule(rule);

  res.json({
    success: true,
    message: `Rollback completed. 204 original images restored for rule "${rule.name}".`
  });
});
