import { Router, Request, Response } from 'express';
import { FreeAiModelService } from '../services/freeAiModelService';
import sizeMatrixData from '../rules/sizeMatrix.json';
import productCategoriesData from '../rules/productCategories.json';
import addonsData from '../rules/addonsSettings.json';
import trainingScenariosData from '../rules/conversationTrainingScenarios.json';

export const aiTrainingRouter = Router();
const aiService = new FreeAiModelService();

/**
 * GET /api/ai/training-spec
 * Fetch master training spec, prompt, size matrix, and training scenarios
 */
aiTrainingRouter.get('/training-spec', (req: Request, res: Response) => {
  return res.json({
    success: true,
    provider: process.env.AI_PROVIDER || 'gemini',
    modelName: process.env.AI_MODEL_NAME || 'gemini-3.6-flash',
    systemPrompt: aiService.getTrainedSystemPrompt('Royal Silk Velvet Abaya', 'occasion_luxury'),
    customPromptOverride: aiService.getCustomPromptOverride(),
    trainingScenarios: aiService.getTrainingScenarios(),
    sizeChart: sizeMatrixData,
    productCategories: productCategoriesData,
    addons: addonsData
  });
});

/**
 * PUT /api/ai/training-spec
 * Update custom prompt override or add training scenarios
 */
aiTrainingRouter.put('/training-spec', (req: Request, res: Response) => {
  const { customPromptOverride, newScenario } = req.body;

  if (customPromptOverride !== undefined) {
    aiService.setCustomPromptOverride(customPromptOverride);
  }

  if (newScenario && newScenario.scenario && newScenario.ideal_response) {
    aiService.addTrainingScenario(newScenario);
  }

  return res.json({
    success: true,
    message: 'AI Training Specification updated successfully.'
  });
});

/**
 * POST /api/ai/test-turn
 * Live playground to test customer turns and observe Gemini's output & extracted parameters
 */
aiTrainingRouter.post('/test-turn', async (req: Request, res: Response) => {
  try {
    const { userMessage, productTitle = 'Royal Silk Velvet Abaya', productCategory = 'occasion_luxury', history = [], currentRecord = {} } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const result = await aiService.executeTurn({
      userMessage,
      chatHistory: history,
      currentRecord,
      productTitle,
      productCategory
    });

    return res.json({
      success: true,
      result
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});
