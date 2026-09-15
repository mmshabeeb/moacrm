import dotenv from 'dotenv';
dotenv.config();
import { FreeAiModelService } from '../src/services/freeAiModelService';

async function testTraining() {
  const service = new FreeAiModelService();
  console.log('--- Testing AI Training Scenarios ---');
  const scenarios = service.getTrainingScenarios();
  console.log(`Loaded ${scenarios.length} training scenarios.`);
  console.log('Sample scenario:', scenarios[0]?.scenario, '->', scenarios[0]?.ideal_response);

  console.log('--- Testing Live AI Execution with Master Prompt ---');
  const result = await service.executeTurn({
    userMessage: "Salam! Can you make the sleeves looser and add a feeding zip?",
    chatHistory: [],
    currentRecord: {},
    productTitle: "Dusty Rose Serenity Open Abaya",
    productCategory: "abaya_standard"
  });

  console.log('AI Response:', JSON.stringify(result, null, 2));
}

testTraining();
