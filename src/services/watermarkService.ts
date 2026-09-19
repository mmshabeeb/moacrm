import fs from 'fs';
import path from 'path';
import sharp, { OverlayOptions } from 'sharp';

export interface WatermarkRule {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'inactive';
  hasTextWatermark: boolean;
  textConfig?: {
    text: string;
    fontSize: number;
    fontColor: string;
    fontFamily: string;
    opacity: number; // 0 - 100
    position: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'tile';
    rotation: number;
  };
  hasImageWatermark: boolean;
  imageConfig?: {
    imageUrl: string;
    layout: 'single' | 'tile';
    position: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    opacity: number; // 0 - 100
    sizePx: number; // e.g. 500
    sizeUnit: 'px' | '%';
    rotation?: number;
    blendMode?: string;
  };
  appliesTo: {
    products: 'all' | 'collection' | 'specific' | 'tags';
    productIds?: string[];
    collectionIds?: string[];
    tags?: string[];
    images: 'all' | 'first' | 'exclude-first';
    skipAlreadyWatermarked: boolean;
    applyToNewImages: boolean;
  };
  stats?: {
    productsCount: number;
    imagesProcessed: number;
    lastAppliedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProtectionSettings {
  enabled: boolean;
  disableRightClick: boolean;
  disableDragAndDrop: boolean;
  disableInspectShortcuts: boolean;
  watermarkStorefrontPage: boolean;
  watermarkPageText?: string;
  customWarningMessage?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'scratch');
const RULES_FILE = path.join(DATA_DIR, 'watermark_rules.json');
const PROTECTION_FILE = path.join(DATA_DIR, 'protection_settings.json');

// Ensure scratch directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Sample initial products for preview & demo
export const SAMPLE_PRODUCTS = [
  {
    id: 'prod_001',
    title: 'Black Velvet Cuff Embroidered Abaya',
    handle: 'black-velvet-cuff-embroidered-abaya',
    images: [
      {
        id: 'img_001_1',
        name: 'Image 1',
        url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
        watermarked: true
      },
      {
        id: 'img_001_2',
        name: 'Image 2',
        url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
        watermarked: false
      },
      {
        id: 'img_001_3',
        name: 'Image 3',
        url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
        watermarked: false
      }
    ],
    collection: 'Velvet Collection',
    tags: ['luxury', 'embroidery', 'velvet', 'best-seller'],
    totalImages: 3
  },
  {
    id: 'prod_002',
    title: 'Sage Green Silk Embellished Kimono Abaya',
    handle: 'sage-green-silk-embellished-kimono',
    images: [
      {
        id: 'img_002_1',
        name: 'Image 1',
        url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80',
        watermarked: false
      },
      {
        id: 'img_002_2',
        name: 'Image 2',
        url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
        watermarked: false
      }
    ],
    collection: 'Silk Edit',
    tags: ['silk', 'kimono', 'pastel'],
    totalImages: 2
  },
  {
    id: 'prod_003',
    title: 'Midnight Floral Organza Layered Abaya',
    handle: 'midnight-floral-organza-layered-abaya',
    images: [
      {
        id: 'img_003_1',
        name: 'Image 1',
        url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80',
        watermarked: true
      }
    ],
    collection: 'Evening Wear',
    tags: ['organza', 'evening', 'floral'],
    totalImages: 1
  }
];

export class WatermarkService {
  private static defaultLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80">
    <rect width="200" height="80" rx="10" fill="none"/>
    <circle cx="35" cy="40" r="22" fill="#c59b27" opacity="0.9"/>
    <text x="35" y="47" font-family="'Playfair Display', Georgia, serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">M</text>
    <text x="70" y="38" font-family="'Montserrat', sans-serif" font-size="14" font-weight="700" letter-spacing="2" fill="#c59b27">MALL OF ABAYAS</text>
    <text x="70" y="54" font-family="'Montserrat', sans-serif" font-size="9" font-weight="500" letter-spacing="3" fill="#888888">OFFICIAL STORE</text>
  </svg>`;

  public static getRules(): WatermarkRule[] {
    if (!fs.existsSync(RULES_FILE)) {
      const defaultRules: WatermarkRule[] = [
        {
          id: '251',
          name: 'Logo',
          status: 'active',
          hasTextWatermark: false,
          hasImageWatermark: true,
          imageConfig: {
            imageUrl: '/extensions-assets/watermark-logo.png',
            layout: 'single',
            position: 'center-right',
            opacity: 100,
            sizePx: 500,
            sizeUnit: 'px',
            rotation: 0
          },
          appliesTo: {
            products: 'all',
            images: 'all',
            skipAlreadyWatermarked: true,
            applyToNewImages: true
          },
          stats: {
            productsCount: 68,
            imagesProcessed: 204,
            lastAppliedAt: new Date().toISOString()
          },
          createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      fs.writeFileSync(RULES_FILE, JSON.stringify(defaultRules, null, 2));
      return defaultRules;
    }
    try {
      const raw = fs.readFileSync(RULES_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Failed to read watermark rules file:', err);
      return [];
    }
  }

  public static getRuleById(id: string): WatermarkRule | undefined {
    const rules = this.getRules();
    return rules.find((r) => r.id === id);
  }

  public static saveRule(rule: WatermarkRule): WatermarkRule {
    const rules = this.getRules();
    const index = rules.findIndex((r) => r.id === rule.id);
    rule.updatedAt = new Date().toISOString();

    if (index >= 0) {
      rules[index] = { ...rules[index], ...rule };
    } else {
      rule.id = rule.id || String(Date.now());
      rule.createdAt = new Date().toISOString();
      rules.push(rule);
    }

    fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
    return rule;
  }

  public static deleteRule(id: string): boolean {
    const rules = this.getRules();
    const filtered = rules.filter((r) => r.id !== id);
    if (filtered.length !== rules.length) {
      fs.writeFileSync(RULES_FILE, JSON.stringify(filtered, null, 2));
      return true;
    }
    return false;
  }

  public static getProtectionSettings(): ProtectionSettings {
    if (!fs.existsSync(PROTECTION_FILE)) {
      const defaults: ProtectionSettings = {
        enabled: true,
        disableRightClick: true,
        disableDragAndDrop: true,
        disableInspectShortcuts: true,
        watermarkStorefrontPage: false,
        watermarkPageText: 'MALL OF ABAYAS © ALL RIGHTS RESERVED',
        customWarningMessage: 'Product images on Mall of Abayas are protected by copyright law.'
      };
      fs.writeFileSync(PROTECTION_FILE, JSON.stringify(defaults, null, 2));
      return defaults;
    }
    try {
      return JSON.parse(fs.readFileSync(PROTECTION_FILE, 'utf-8'));
    } catch (err) {
      return {
        enabled: true,
        disableRightClick: true,
        disableDragAndDrop: true,
        disableInspectShortcuts: true,
        watermarkStorefrontPage: false
      };
    }
  }

  public static saveProtectionSettings(settings: ProtectionSettings): ProtectionSettings {
    fs.writeFileSync(PROTECTION_FILE, JSON.stringify(settings, null, 2));
    return settings;
  }

  /**
   * Process and apply watermark to an image buffer using sharp
   */
  public static async applyWatermarkToBuffer(
    inputBuffer: Buffer,
    rule: WatermarkRule,
    watermarkImageBuffer?: Buffer
  ): Promise<Buffer> {
    const metadata = await sharp(inputBuffer).metadata();
    const width = metadata.width || 1000;
    const height = metadata.height || 1500;

    const composites: OverlayOptions[] = [];

    // 1. Text Watermark overlay
    if (rule.hasTextWatermark && rule.textConfig && rule.textConfig.text) {
      const { text, fontSize, fontColor, opacity, rotation } = rule.textConfig;
      const alpha = ((opacity || 100) / 100).toFixed(2);
      
      const svgText = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <style>
            .wm-text {
              font-family: 'Montserrat', sans-serif;
              font-size: ${fontSize || 32}px;
              font-weight: 700;
              fill: ${fontColor || '#ffffff'};
              fill-opacity: ${alpha};
            }
          </style>
          <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
                class="wm-text" transform="rotate(${rotation || 0}, ${width / 2}, ${height / 2})">
            ${text}
          </text>
        </svg>
      `;

      composites.push({
        input: Buffer.from(svgText),
        top: 0,
        left: 0
      });
    }

    // 2. Image / Logo Watermark overlay
    if (rule.hasImageWatermark && rule.imageConfig) {
      const { layout, position, sizePx } = rule.imageConfig;
      let logoBuf = watermarkImageBuffer;

      if (!logoBuf) {
        logoBuf = Buffer.from(this.defaultLogoSvg);
      }

      const wmWidth = Math.min(sizePx || 300, Math.round(width * 0.45));
      const resizedLogo = await sharp(logoBuf)
        .resize({ width: wmWidth, fit: 'inside' })
        .toBuffer();

      const logoMeta = await sharp(resizedLogo).metadata();
      const lWidth = logoMeta.width || wmWidth;
      const lHeight = logoMeta.height || 80;

      if (layout === 'tile') {
        const cols = Math.ceil(width / (lWidth + 100));
        const rows = Math.ceil(height / (lHeight + 100));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            composites.push({
              input: resizedLogo,
              left: c * (lWidth + 100) + 40,
              top: r * (lHeight + 100) + 40,
              blend: 'over'
            });
          }
        }
      } else {
        let left = 20;
        let top = 20;
        const padding = 40;

        switch (position) {
          case 'top-left':
            left = padding;
            top = padding;
            break;
          case 'top-center':
            left = Math.round((width - lWidth) / 2);
            top = padding;
            break;
          case 'top-right':
            left = width - lWidth - padding;
            top = padding;
            break;
          case 'center-left':
            left = padding;
            top = Math.round((height - lHeight) / 2);
            break;
          case 'center':
            left = Math.round((width - lWidth) / 2);
            top = Math.round((height - lHeight) / 2);
            break;
          case 'center-right':
            left = width - lWidth - padding;
            top = Math.round((height - lHeight) / 2);
            break;
          case 'bottom-left':
            left = padding;
            top = height - lHeight - padding;
            break;
          case 'bottom-center':
            left = Math.round((width - lWidth) / 2);
            top = height - lHeight - padding;
            break;
          case 'bottom-right':
          default:
            left = width - lWidth - padding;
            top = height - lHeight - padding;
            break;
        }

        composites.push({
          input: resizedLogo,
          left: Math.max(0, left),
          top: Math.max(0, top),
          blend: 'over'
        });
      }
    }

    if (composites.length > 0) {
      return await sharp(inputBuffer)
        .composite(composites)
        .jpeg({ quality: 92 })
        .toBuffer();
    }

    return inputBuffer;
  }
}
