// Read-only RPC collection. No wallet, writeContract, deployment or broadcast.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ROOT,CHAIN_ID,reader,readJson,readJsonContract,saveJson} from './runtime.mjs';
import {verifyArchive,verifyPublicTranscripts,EXPECTED_ROLLBACK} from './verify-evidence.mjs';
import {assertExecutionSucceeded,assertExpectedRollback,lifecycleStatus,consensusResult} from '../lib/receipt.js';
import {digest} from '../lib/model.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
async function rpcRead(label,operation) {
  for(let attempt=1;attempt<=3;attempt++) {
    try{return await operation();}
    catch(error){if(attempt===3)throw error;console.warn(JSON.stringify({readRetry:label,attempt}));await new Promise(resolve=>setTimeout(resolve,1500));}
  }
}
const [config,demo,negative,source]=await Promise.all([
  readJson(new URL('public/deployment.json',ROOT)),readJson(new URL('public/evidence/demo.json',ROOT)),
  readJson(new URL('public/evidence/negative.json',ROOT)),readFile(new URL('contracts/runbookarena.py',ROOT),'utf8')]);
const sourceSha256=hash(source);verifyArchive(demo,negative,config,sourceSha256);
const code=await rpcRead('getContractCode',()=>reader.getContractCode(config.address));assert.equal(code,source);
const deploymentTx=await rpcRead('deploy',()=>reader.getTransaction({hash:config.deploymentTransaction}));
const deploymentSpec={kind:'deploy',actor:deploymentTx.from_address,sourceSha256,args:[],value:'0',leaderOnly:false};
const refs=[{label:'deploy',hash:config.deploymentTransaction,spec:deploymentSpec},...demo.transactions,...negative.transactions],rows=[];
for(const ref of refs) {
  const tx=ref.label==='deploy'?deploymentTx:await rpcRead(ref.label,()=>reader.getTransaction({hash:ref.hash}));
  if(ref.expectedRollbackVerified)assertExpectedRollback(tx,EXPECTED_ROLLBACK);else assertExecutionSucceeded(tx);
  const raw=tx.consensus_data?.leader_receipt,leaders=Array.isArray(raw)?raw:raw?[raw]:[];
  rows.push({reference:{label:ref.label,hash:ref.hash},hash:tx.hash,from_address:tx.from_address,to_address:tx.to_address,
    data:{calldata:tx.data?.calldata,contract_address:tx.data?.contract_address},tx_data:tx.tx_data,
    signed_rollup_transaction:tx.sim_config?.signed_rollup_transaction,
    statusName:lifecycleStatus(tx),result_name:consensusResult(tx),leader_only:tx.leader_only,
    consensus_data:{votes:tx.consensus_data?.votes??{},leader_receipt:leaders.map(row=>({mode:row.mode,execution_result:row.execution_result,result:row.result,eq_outputs:row.eq_outputs})),
      validators:(tx.consensus_data?.validators??[]).map(row=>({mode:row.mode,vote:row.vote,execution_result:row.execution_result}))}});
}
const drillReadBack=await rpcRead('get_drill',()=>readJsonContract(config.address,'get_drill',[demo.drills[0].id]));
assert.deepEqual(drillReadBack,demo.drills[0]);
const transcripts={chainId:CHAIN_ID,contractAddress:config.address,contractSourceSha256:sourceSha256,recordedAt:new Date().toISOString(),
  notice:'Selected public RPC fields and signed public transactions only. Includes original readable leader model outputs; excludes node/model configuration and all wallet-key files. Expected outsider rejection remains VM ERROR.',
  deploymentSpec,sourceReadBack:{address:config.address,sha256:hash(code),code},
  drillReadBack,postNegativeDrillDigest:digest(drillReadBack),receipts:rows};
const result=await verifyPublicTranscripts(transcripts,demo,negative,config,sourceSha256);
await saveJson(new URL('public/evidence/transcripts.json',ROOT),transcripts);
console.log(JSON.stringify({readOnly:true,...result},null,2));
