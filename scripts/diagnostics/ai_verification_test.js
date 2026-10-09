const http = require('http');
require('dotenv').config();
const { Pool } = require('pg');

const projectId = '7'; // Live project

const token = 'valid'; // The API might require authentication. Wait, how do I get a valid session token?
// In AtherOps, if I can't get a token easily, I can create a temporary admin token if we use JWT, or I can bypass auth by running this directly via service functions.

async function run() {
  const { runSecurityAnalysis, runProjectOverview, runCostAnalysis, runAttackPathAnalysis } = require('./src/modules/ai/ai.service');
  const { runChat } = require('./src/modules/ai/ai.chat');
  
  // Create a mock user ID
  const userId = 1; // Assuming 1 is the platform admin or owner of project 7
  
  try {
    console.log('\n--- 1. OVERVIEW ---');
    let res = await runProjectOverview(projectId, userId);
    console.log('Overview Success:', !!res);
    
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
    
    console.log('\n--- 6. CHAT: Security ---');
    res = await runChat(projectId, userId, 'What are my top security findings?');
    console.log('Chat Security Success:', !!res);
    
    console.log('\n--- 7. CHAT: Cost ---');
    res = await runChat(projectId, userId, 'Why are my costs zero?');
    console.log('Chat Cost Success:', !!res);
    
  } catch (err) {
    console.error('Error during AI tests:', err.message || err);
  }
}

run().catch(console.error);
