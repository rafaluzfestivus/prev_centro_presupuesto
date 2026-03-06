
import { processProposalWithAIAction } from './src/actions/proposal';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    const proposalId = 'd13fce02-7c9a-49ab-a1ed-ebb8bf85a3c1';
    console.log('Testing AI Processing for:', proposalId);
    const result = await processProposalWithAIAction(proposalId);
    console.log('Result:', JSON.stringify(result, null, 2));
}

test().catch(console.error);
