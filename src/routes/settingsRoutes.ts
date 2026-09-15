import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export const settingsRouter = Router();

function getSettingsPath() {
  const directPath = path.join(__dirname, '../rules/addonsSettings.json');
  if (fs.existsSync(directPath)) return directPath;
  return path.resolve(process.cwd(), 'src/rules/addonsSettings.json');
}

function getSettingsData() {
  const settingsFilePath = getSettingsPath();
  const content = fs.readFileSync(settingsFilePath, 'utf-8');
  return JSON.parse(content);
}

function saveSettingsData(data: any) {
  const settingsFilePath = getSettingsPath();
  fs.writeFileSync(settingsFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * GET /api/settings/addons
 * Returns all configured add-ons and store settings
 */
settingsRouter.get('/addons', (req: Request, res: Response) => {
  try {
    const data = getSettingsData();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

/**
 * POST /api/settings/addons
 * Add or update an add-on item
 */
settingsRouter.post('/addons', (req: Request, res: Response) => {
  try {
    const { addon } = req.body;
    if (!addon || !addon.name || addon.price === undefined) {
      return res.status(400).json({ error: 'Invalid add-on payload' });
    }

    const data = getSettingsData();
    const existingIndex = data.addons.findIndex((a: any) => a.id === addon.id);

    if (existingIndex >= 0) {
      data.addons[existingIndex] = { ...data.addons[existingIndex], ...addon };
    } else {
      const newId = addon.id || `addon_${Date.now()}`;
      data.addons.push({
        id: newId,
        name: addon.name,
        description: addon.description || '',
        price: Number(addon.price),
        currency: addon.currency || 'AED',
        enabled: addon.enabled !== false,
        applicable_categories: addon.applicable_categories || ['abaya_standard', 'modest_set']
      });
    }

    saveSettingsData(data);
    res.json({ success: true, message: 'Add-on saved successfully', addons: data.addons });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save add-on' });
  }
});

/**
 * DELETE /api/settings/addons/:id
 * Delete an add-on item
 */
settingsRouter.delete('/addons/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = getSettingsData();
    data.addons = data.addons.filter((a: any) => a.id !== id);
    saveSettingsData(data);
    res.json({ success: true, message: 'Add-on removed', addons: data.addons });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete add-on' });
  }
});

/**
 * GET /api/settings/ai
 * Returns AI model configuration status
 */
settingsRouter.get('/ai', (req: Request, res: Response) => {
  const provider = process.env.AI_PROVIDER || 'gemini';
  const modelName = process.env.AI_MODEL_NAME || 'gemini-1.5-flash';
  const hasGeminiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  res.json({
    success: true,
    provider,
    modelName,
    configured: {
      geminiFreeApi: hasGeminiKey,
      groqFreeApi: hasGroqKey,
      ollamaLocal: !!process.env.OLLAMA_BASE_URL,
      deterministicRuleEngine: true
    },
    activeEngine: hasGeminiKey ? 'Gemini 1.5/2.0 Flash (Free Tier)' : (hasGroqKey ? 'Groq Llama 3.3 (Free Tier)' : 'MOA Trained Sizing Rule Engine')
  });
});

/**
 * POST /api/settings/ai
 * Updates AI model configuration in runtime environment
 */
settingsRouter.post('/ai', (req: Request, res: Response) => {
  try {
    const { provider, modelName, apiKey } = req.body;
    if (provider) process.env.AI_PROVIDER = provider;
    if (modelName) process.env.AI_MODEL_NAME = modelName;
    if (apiKey) {
      if (provider === 'groq') {
        process.env.GROQ_API_KEY = apiKey;
      } else {
        process.env.GEMINI_API_KEY = apiKey;
      }
    }

    res.json({
      success: true,
      message: 'AI Model configuration updated successfully',
      provider: process.env.AI_PROVIDER,
      modelName: process.env.AI_MODEL_NAME
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update AI configuration' });
  }
});
