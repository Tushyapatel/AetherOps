import { config } from '../src/config';
import { GeminiProvider } from '../src/modules/ai/providers/gemini/gemini.provider';
import { buildProjectOverviewContext, serializeContext } from '../src/modules/ai/ai.context';
import { getPool } from '../src/database';
import { AIError } from '../src/modules/ai/ai.types';

async function run() {
  console.log('--- GEMINI LIVE VERIFICATION START ---');

  // 1. ENVIRONMENT / API KEY
  const hasKey = !!process.env.GEMINI_API_KEY || !!config.ai.geminiApiKey;
  console.log(`API KEY PRESENT: ${hasKey ? 'YES' : 'NO'}`);
  if (!hasKey) {
    console.error('GEMINI_API_KEY_MISSING');
    process.exit(1);
  }

  // 2. MODEL VERIFICATION
  console.log(`CONFIGURED MODEL: ${config.ai.model}`);

  const provider = new GeminiProvider(
    config.ai.geminiApiKey!,
    config.ai.model,
    30000,
    5 // Enable retries for 503
  );
  console.log(`PROVIDER SDK: ${provider.providerName}`);

  // 3. MINIMAL REAL API REQUEST (Bypassing validation just for basic connectivity)
  console.log('\n--- BASIC CONNECTIVITY TEST ---');
  try {
    const rawResponse = await provider['client'].models.generateContent({
      model: config.ai.model,
      contents: [{ role: 'user', parts: [{ text: "You are performing a connectivity test for AtherOps. Return a JSON object with exactly: { \"status\": \"ok\", \"provider\": \"gemini\" }" }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });
    console.log(`BASIC REQUEST: SUCCESS (Response length: ${rawResponse.text?.length})`);
  } catch (err) {
    console.error('BASIC REQUEST: FAILED');
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // 4. STRUCTURED OUTPUT TEST & ENDPOINT TEST
  console.log('\n--- STRUCTURED OUTPUT & DB SAFETY TEST ---');
  const pool = getPool();

  try {
    const getCounts = async () => {
      const p = await pool.query('SELECT id FROM projects LIMIT 1');
      if (p.rows.length === 0) throw new Error('No project');
      const projectId = p.rows[0].id;
      
      const acc = await pool.query('SELECT count(*) FROM cloud_accounts');
      const res = await pool.query('SELECT count(*) FROM resources');
      const rel = await pool.query('SELECT count(*) FROM relationships');
      
      return { 
        projectId,
        accounts: parseInt(acc.rows[0].count, 10),
        resources: parseInt(res.rows[0].count, 10),
        relationships: parseInt(rel.rows[0].count, 10)
      };
    };

    const before = await getCounts();
    console.log(`DB BEFORE: Accounts=${before.accounts}, Resources=${before.resources}, Relationships=${before.relationships}`);
    
    // Test context generation and Gemini structured output
    console.log(`Calling buildProjectOverviewContext for project ${before.projectId}...`);
    const ctx = await buildProjectOverviewContext(before.projectId, 1);
    const userPrompt = serializeContext(ctx!);
    
    const input = {
      operation: 'PROJECT_OVERVIEW' as any,
      systemInstruction: 'You are AtherOps AI. Return a structured overview of this project. Be concise. Only output valid JSON matching the schema.',
      userPrompt
    };
    
    console.log('Sending structured request via GeminiProvider...');
    const result = await provider.generateAnalysis(input);
    console.log('STRUCTURED OUTPUT: SUCCESS');
    console.log(`Summary length: ${result.summary.length}`);
    console.log(`Key insights count: ${result.keyInsights.length}`);

    const after = await getCounts();
    console.log(`DB AFTER: Accounts=${after.accounts}, Resources=${after.resources}, Relationships=${after.relationships}`);

    if (
      before.accounts !== after.accounts ||
      before.resources !== after.resources ||
      before.relationships !== after.relationships
    ) {
      console.error('DATABASE WAS MUTATED!');
      process.exit(1);
    }

  } catch (err) {
    console.error('STRUCTURED TEST FAILED:');
    if (err instanceof AIError) {
      console.error(`AIError: [${err.code}] ${err.message}`);
    } else {
      console.error(err instanceof Error ? err.message : err);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  console.log('\n--- GEMINI LIVE VERIFICATION COMPLETE ---');
}

run();
