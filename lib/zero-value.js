/** SDK 1.1.8 may normalize numeric Studionet value:0 to undefined. */
export async function assertZeroValue(client,receipt,hash){
  let value=receipt?.value??receipt?.data?.value??receipt?.txDataDecoded?.value;
  if(value===undefined){
    const raw=await client.request({method:'eth_getTransactionByHash',params:[hash]});
    if(String(raw?.hash??'').toLowerCase()!==String(hash).toLowerCase())throw Error('Raw value receipt hash differs');
    value=raw.value;
  }
  if(!['string','number','bigint'].includes(typeof value)||(typeof value==='number'&&!Number.isSafeInteger(value)))throw Error('Transaction value is not observable as an integer');
  let parsed;try{parsed=BigInt(value);}catch{throw Error('Transaction value cannot be parsed');}
  if(parsed!==0n)throw Error('Recovered transaction was not zero-value');
  return true;
}
