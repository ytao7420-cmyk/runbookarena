import {scenario as frozenScenario} from './scenario.js';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
export const canonical=v=>JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)):value);
export const digest=v=>bytesToHex(sha256(new TextEncoder().encode(typeof v==='string'?v:canonical(v))));
export function stateDigest(record){return digest({id:record.id,commander:record.commander,responder:record.responder,scenario_digest:record.scenario_digest,state:record.state,previous_event:record.events.at(-1)?.digest??null});}
export function advance(state,action,role,scenario){
 const s=structuredClone(state),cost=scenario.costs[action]??1;
 if(s.elapsed+cost>scenario.time_budget){s.elapsed=scenario.time_budget;s.status='EXHAUSTED';return {state:s,applied:false,reason:'TIME_BUDGET'};}
 s.elapsed+=cost;let applied=false,reason='UNKNOWN_ACTION';
 if(action!=='UNKNOWN'){
  if(!Object.hasOwn(scenario.cards,action))throw Error('Unknown action vocabulary');
  if(scenario.roles[action]!==role)reason='ACTION_ROLE';
  else if(s.turn!==role)reason='TURN_ROLE';
  else if(s.flags[action.toLowerCase()])reason='ALREADY_APPLIED';
  else if(action==='ISOLATE'&&!s.flags.inspect)reason='NEEDS_INSPECTION';
  else if(action==='ROLLBACK'&&!(s.flags.inspect&&s.flags.isolate))reason='NEEDS_INSPECTION_AND_ISOLATION';
  else if(action==='ROLLBACK'&&s.rollback_tokens===0)reason='NO_ROLLBACK_TOKEN';
  else if(action==='VERIFY'&&!s.flags.rollback)reason='NEEDS_ROLLBACK';
  else if(action==='RESTORE'&&!s.flags.verify)reason='NEEDS_VERIFICATION';
  else {applied=true;reason='APPLIED';s.flags[action.toLowerCase()]=true;if(action==='ROLLBACK')s.rollback_tokens--;s.turn=role==='COMMANDER'?'RESPONDER':'COMMANDER';if(action==='RESTORE')s.status='RECOVERED';}
 }
 if(s.status==='ACTIVE'&&s.elapsed>=scenario.time_budget)s.status='EXHAUSTED';
 return {state:s,applied,reason};
}
export function verifyDrill(record){
 if(!record||canonical(record.scenario)!==canonical(frozenScenario)||record.scenario_digest!==digest(record.scenario)||record.state_digest!==stateDigest(record))throw Error('Drill or scenario digest mismatch');
 let state={status:'ACTIVE',elapsed:0,turn:'COMMANDER',rollback_tokens:1,flags:Object.fromEntries(Object.keys(record.scenario.cards).map(k=>[k.toLowerCase(),false]))},previous=null;
 for(let i=0;i<record.events.length;i++){
  const e=record.events[i],{digest:stored,...body}=e;
  if(e.number!==i+1||e.previous_event!==previous||stored!==digest(body)||canonical(e.before)!==canonical(state))throw Error('Broken action history');
  const before={...record,state,events:record.events.slice(0,i)};
  if(e.scenario_digest!==record.scenario_digest||e.base_digest!==stateDigest(before))throw Error('Event scope or state mismatch');
  const role=e.actor===record.commander?'COMMANDER':e.actor===record.responder?'RESPONDER':null;
  if(role!==e.role||role!==state.turn||state.status!=='ACTIVE')throw Error('Invalid action actor or turn');
  const semantic=e.semantics;
  if(!e.instruction.includes(semantic.instruction_quote)||!semantic.instruction_quote)throw Error('Action citation missing');
  if(semantic.action==='UNKNOWN'){if(semantic.certainty!=='AMBIGUOUS'||semantic.card_quote!=='')throw Error('Invalid unknown interpretation');}
  else if(semantic.certainty!=='EXPLICIT'||!semantic.card_quote||!record.scenario.cards[semantic.action]?.includes(semantic.card_quote))throw Error('Card citation missing');
  const derived=advance(state,semantic.action,role,record.scenario);
  if(canonical(derived.state)!==canonical(e.after)||derived.applied!==e.applied||derived.reason!==e.reason)throw Error('State transition mismatch');
  state=e.after;previous=e.digest;
 }
 if(canonical(state)!==canonical(record.state))throw Error('Final state is not the replayed state');
 return {events:record.events.length,status:state.status,elapsed:state.elapsed};
}
