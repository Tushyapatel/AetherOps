import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { runSecurityAnalysis, runProjectOverview, runCostAnalysis, runAttackPathAnalysis } from './src/modules/ai/ai.service';
import { runChat } from './src/modules/ai/ai.chat';

const projectId = '7'; // Live project
const userId = 11; // Admin user

async function run() {
  try {
    console.log('\n--- 1. OVERVIEW ---');
    let res = await runProjectOverview(projectId, userId);
    console.log('Overview Success:', !!res);
    console.log('Result:', JSON.stringify(res).substring(0, 100) + '...');
    
    console.log('\n--- 2. SECURITY ---');
    res = await runSecurityAnalysis(projectId, userId);
    console.log('Security Success:', !!res);
    
    console.log('\n--- 3. COST ---');
    res = await runCostAnalysis(projectId, userId);
    console.log('Cost Success:', !!res);
    
    console.log('\n--- 4. ATTACK PATH ---');
    res = await runAttackPathAnalysis(projectId, userId);
    console.log('Attack Path Success:', !!res);
    
    console.log('\n--- 5. CHAT: General ---');
    res = await runChat(projectId, userId, 'Give me a general overview of my project.');
    console.log('Chat General Success:', !!res);
    
    console.log('\n--- 6. CHAT: Cost ---');
    res = await runChat(projectId, userId, 'Why are my costs zero?');
    console.log('Chat Cost Success:', !!res);
    
  } catch (err: any) {
    console.error('Error during AI tests:', err.message || err);
  } finally {
    process.exit(0);
  }
}

run();
