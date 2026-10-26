// Offline verification of public evidence. This module never broadcasts.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {abi} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {parseTransaction,recoverTransactionAddress,decodeFunctionData,fromRlp,hexToBytes,hexToString,keccak256,zeroAddress} from 'viem';
import {verifyDrill,digest} from '../lib/model.js';
import {assertExecutionSucceeded,assertExpectedRollback} from '../lib/receipt.js';

export const EXPECTED_ROLLBACK='Only the assigned drill participants may act';
const CHAIN_ID=61999,RPC='https://studio.genlayer.com/api';
const hash=value=>createHash('sha256').update(value).digest('hex');
const address=value=>{assert.match(value??'',/^0x[0-9a-f]{40}$/i);return value.toLowerCase();};
const transactionHash=value=>assert.match(value??'',/^0x[0-9a-f]{64}$/i);
const asHex=value=>'0x'+String(value??'').replace(/^0x/,'').toLowerCase();
const leaderOf=row=>row.consensus_data.leader_receipt.filter(entry=>entry.mode==='leader').at(-1);

function verifySummary(tx,expectedExecution='SUCCESS') {
  transactionHash(tx.hash);assert.ok(['ACCEPTED','FINALIZED'].includes(tx.status));
  assert.equal(tx.execution,expectedExecution);assert.equal(tx.executionResult,expectedExecution);
  assert.equal(tx.consensusResult,'MAJORITY_AGREE');assert.equal(tx.leaderOnly,false);
  assert.equal(tx.spec.value,'0');assert.equal(tx.spec.leaderOnly,false);
}

export function verifyArchive(demo,negative,config,sourceSha256) {
  assert.equal(config.deployed,true);assert.equal(config.chainId,CHAIN_ID);assert.equal(config.rpc,RPC);
  address(config.address);transactionHash(config.deploymentTransaction);assert.equal(config.sourceSha256,sourceSha256);
  for(const archive of [demo,negative]) {
    assert.equal(archive.verified,true);assert.equal(archive.chainId,CHAIN_ID);
    assert.equal(archive.contractAddress,config.address);assert.equal(archive.contractSourceSha256,sourceSha256);
  }
  assert.equal(demo.drills.length,1);assert.equal(demo.transactions.length,7);assert.equal(negative.transactions.length,1);
  const record=demo.drills[0];assert.deepEqual(verifyDrill(record),{events:6,status:'RECOVERED',elapsed:7});
  assert.equal(address(record.commander),address(demo.actors.commander));assert.equal(address(record.responder),address(demo.actors.responder));
  assert.equal(new Set(Object.values(demo.actors).map(address)).size,3);
  assert.deepEqual(demo.transactions.map(tx=>tx.label),['start','early-restore','inspect','isolate','rollback','verify','restore']);
  assert.deepEqual(record.events.map(event=>event.semantics.action),['RESTORE','INSPECT','ISOLATE','ROLLBACK','VERIFY','RESTORE']);
  assert.deepEqual(record.events.map(event=>event.applied),[false,true,true,true,true,true]);
  assert.equal(record.events[0].reason,'NEEDS_VERIFICATION');
  const hashes=new Set([config.deploymentTransaction]);
  for(const [index,tx]of demo.transactions.entries()) {
    verifySummary(tx);assert.equal(tx.spec.kind,'call');assert.equal(tx.spec.address,config.address);
    assert.ok(!hashes.has(tx.hash));hashes.add(tx.hash);
    if(index===0) {
      assert.equal(tx.spec.method,'start_drill');assert.equal(address(tx.spec.actor),address(demo.actors.commander));
      assert.equal(tx.spec.args.length,2);assert.equal(tx.spec.args[0],record.id);assert.equal(address(tx.spec.args[1]),address(record.responder));
    } else {
      const event=record.events[index-1];assert.equal(tx.spec.method,'attempt');assert.equal(address(tx.spec.actor),event.actor);
      assert.deepEqual(tx.spec.args,[record.id,event.base_digest,event.instruction]);
    }
  }
  const reject=negative.transactions[0];verifySummary(reject,'ERROR');assert.ok(!hashes.has(reject.hash));
  assert.equal(reject.label,'outsider-rejected');assert.equal(reject.spec.kind,'call');assert.equal(reject.spec.address,config.address);
  assert.equal(address(reject.spec.actor),address(demo.actors.outsider));assert.equal(reject.spec.method,'attempt');
  assert.deepEqual(reject.spec.args,[record.id,record.state_digest,'Inspect the error dashboard.']);
  assert.equal(reject.spec.expectedRollback,EXPECTED_ROLLBACK);assert.equal(reject.decodedRollback,EXPECTED_ROLLBACK);
  assert.equal(reject.expectedFailure,true);assert.equal(reject.expectedRollbackVerified,true);
  assert.equal(reject.leaderResultStatus,'rollback');assert.equal(reject.outcome,'EXPECTED_REJECTION');
  assert.ok(['ACCEPTED','FINALIZED'].includes(config.deploymentReceipt.status));
  assert.equal(config.deploymentReceipt.execution,'SUCCESS');assert.equal(config.deploymentReceipt.consensusResult,'MAJORITY_AGREE');
  assert.equal(config.deploymentReceipt.leaderOnly,false);
  return {verified:true,drills:1,events:6,status:'RECOVERED',elapsed:7,successfulWorkflowTransactions:7,expectedRejections:1};
}

export async function verifyPublicTranscripts(transcripts,demo,negative,config,sourceSha256) {
  assert.equal(transcripts.chainId,CHAIN_ID);assert.equal(transcripts.contractAddress,config.address);
  assert.equal(transcripts.contractSourceSha256,sourceSha256);
  assert.equal(transcripts.sourceReadBack.address,config.address);
  assert.equal(hash(transcripts.sourceReadBack.code),sourceSha256);assert.equal(transcripts.sourceReadBack.sha256,sourceSha256);
  const deployment=transcripts.deploymentSpec;
  assert.equal(deployment.kind,'deploy');assert.equal(deployment.sourceSha256,sourceSha256);
  assert.equal(deployment.value,'0');assert.equal(deployment.leaderOnly,false);assert.deepEqual(deployment.args,[]);address(deployment.actor);
  const references=[{label:'deploy',hash:config.deploymentTransaction,spec:deployment},...demo.transactions,...negative.transactions];
  assert.equal(transcripts.receipts.length,9);assert.equal(references.length,9);
  for(const [index,row]of transcripts.receipts.entries()) {
    const ref=references[index],spec=ref.spec;
    assert.equal(row.reference.label,ref.label);assert.equal(row.reference.hash,ref.hash);assert.equal(row.hash,ref.hash);
    if(ref.expectedRollbackVerified)assertExpectedRollback(row,EXPECTED_ROLLBACK);else assertExecutionSucceeded(row);
    assert.equal(address(row.from_address),address(spec.actor));assert.equal(row.leader_only,false);
    assert.ok(leaderOf(row),'An explicit leader receipt is required.');

    // Public signatures commit actual actor, chain, value and ABI calldata.
    const signed=row.signed_rollup_transaction;assert.match(signed??'',/^0x[0-9a-f]+$/i);
    assert.equal(keccak256(signed),row.hash);
    const envelope=parseTransaction(signed);
    assert.equal(envelope.chainId,CHAIN_ID);assert.equal(envelope.value??0n,0n);
    assert.equal(address(await recoverTransactionAddress({serializedTransaction:signed})),address(spec.actor));
    assert.equal(address(envelope.to),address(studionet.consensusMainContract.address));
    const submitted=decodeFunctionData({abi:studionet.consensusMainContract.abi,data:envelope.data});
    assert.equal(submitted.functionName,'addTransaction');assert.equal(address(submitted.args[0]),address(spec.actor));
    const appData=submitted.args[4];assert.equal(asHex(row.tx_data),asHex(appData));
    const app=fromRlp(appData),isDeployment=spec.kind==='deploy';
    assert.equal(app.length,isDeployment?3:2);
    const flag=app.at(-1);assert.ok(flag==='0x'||BigInt(flag)===0n,'Signed appdata requires leaderOnly:false.');
    const expected=abi.calldata.encode(abi.calldata.makeCalldataObject(isDeployment?undefined:spec.method,spec.args,undefined));
    assert.deepEqual(hexToBytes(app[isDeployment?1:0]),expected,'Signed ABI calldata differs from recorded intent.');
    assert.deepEqual(Uint8Array.from(row.data.calldata.raw),expected,'RPC calldata differs from signed calldata.');
    if(isDeployment) {
      assert.equal(address(submitted.args[1]),zeroAddress);assert.equal(address(row.data.contract_address),address(config.address));
      const code=hexToString(app[0]);assert.equal(hash(code),sourceSha256);assert.equal(code,transcripts.sourceReadBack.code);
    } else {
      assert.equal(address(submitted.args[1]),address(config.address));assert.equal(address(row.to_address),address(config.address));
      if(!ref.expectedRollbackVerified&&spec.method==='attempt') {
        const event=demo.drills[0].events[index-2],output=leaderOf(row).eq_outputs?.['0'];
        assert.equal(output?.status,'return');assert.ok(typeof output.payload?.readable==='string'&&output.payload.readable.length>0,'Public readable model output is required.');
        assert.deepEqual(Object.fromEntries(abi.calldata.decode(Uint8Array.from(output.payload.raw))),event.semantics,'Actual leader interpretation differs from the immutable event.');
      }
    }
  }
  assert.deepEqual(transcripts.drillReadBack,demo.drills[0]);verifyDrill(transcripts.drillReadBack);
  assert.equal(transcripts.postNegativeDrillDigest,digest(demo.drills[0]));
  return {verifiedPublicTranscripts:9,successfulDeployments:1,signedTransactionsVerified:9,readableModelOutputs:6,postNegativeStateUnchanged:true};
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url) {
  const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
  const [config,demo,negative,transcripts,source]=await Promise.all([read('public/deployment.json'),read('public/evidence/demo.json'),read('public/evidence/negative.json'),read('public/evidence/transcripts.json'),readFile(new URL('contracts/runbookarena.py',root))]);
  const sourceSha256=hash(source);
  console.log(JSON.stringify({...verifyArchive(demo,negative,config,sourceSha256),...await verifyPublicTranscripts(transcripts,demo,negative,config,sourceSha256)},null,2));
}
