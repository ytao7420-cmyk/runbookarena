import test from 'node:test';import assert from 'node:assert/strict';import {assertZeroValue} from '../lib/zero-value.js';
const hash='0x'+'a'.repeat(64);
test('observable zero needs no extra RPC',async()=>{for(const value of [0,0n,'0','0x0'])assert.equal(await assertZeroValue({request:()=>{throw Error('Should not read');}},{value},hash),true);});
test('SDK normalized zero is recovered only from same-hash raw transaction',async()=>{let calls=0;const reader={request:async req=>{calls++;assert.deepEqual(req,{method:'eth_getTransactionByHash',params:[hash]});return {hash,value:0};}};assert.equal(await assertZeroValue(reader,{value:undefined},hash),true);assert.equal(calls,1);});
test('nonzero raw, wrong hash, absent value and boolean cannot be assumed zero',async()=>{for(const raw of [{hash,value:1},{hash:'0x'+'b'.repeat(64),value:0},{hash},{hash,value:false}])await assert.rejects(assertZeroValue({request:async()=>raw},{},hash));});
test('unobservable/RPC errors stay unresolved',async()=>{await assert.rejects(assertZeroValue({request:async()=>{throw Error('Offline');}},{},hash),/Offline/);});
