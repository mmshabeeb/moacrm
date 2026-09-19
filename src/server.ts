import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { authRouter } from './routes/authRoutes';
import { chatRouter } from './routes/chatRoutes';
import { productionRouter } from './routes/productionRoutes';
import { settingsRouter } from './routes/settingsRoutes';
import { userRouter } from './routes/userRoutes';
import { mediaRouter } from './routes/mediaRoutes';
import { routingRouter } from './routes/routingRoutes';
import { aiTrainingRouter } from './routes/aiTrainingRoutes';
import { watermarkRouter } from './routes/watermarkRoutes';
import { handleShopifyOrderCreateWebhook } from './webhooks/shopifyOrderWebhook';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));

const extensionsAssetsDir = path.resolve(process.cwd(), 'extensions/moa-designer-block/assets');
app.use('/extensions-assets', express.static(extensionsAssetsDir));

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/production', productionRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/users', userRouter);
app.use('/api/media', mediaRouter);
app.use('/api/routing', routingRouter);
app.use('/api/ai', aiTrainingRouter);
app.use('/api/watermark', watermarkRouter);

// Shopify Webhook endpoint
app.post('/webhooks/shopify/orders/create', handleShopifyOrderCreateWebhook);

// Dedicated Login Page Route
app.get('/login', (req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

// Dedicated Watermark App Page & Shopify Embedded Routes
app.get(['/watermark', '/watermark/rules', '/watermark/rules/:id', '/apps/oh-watermark/app/rules/:id'], (req, res) => {
  res.sendFile(path.join(publicDir, 'watermark.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Mall of Abayas (MOA) AI Designer & Production CRM',
    timestamp: new Date().toISOString()
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🌸 MOA AI Designer & Production Server`);
    console.log(`🚀 Server listening on port ${PORT}`);
    console.log(`📦 Production Sheet: http://localhost:${PORT}/api/production/orders/MOA-CUS-000124/sheet`);
    console.log(`====================================================`);
  });
}

export default app;
