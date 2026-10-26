# Validation and limits

## Offline checks

- 22 Python tests execute actual contract rule functions with explicit mocked model responses. These cover designated roles, turn ownership, stale state, denial history, resource exhaustion, immutable digests, substantive citation failure and model disagreement.
- 7 JavaScript tests independently replay a Python-generated contract history, reject mutations and substituted final states, and check budget/role boundaries.
- The Vite production build is checked. Browser checks and live chain evidence are recorded separately below; these tests are not claims of real validator consensus.
- The evidence verifier also passed 12 in-memory tamper checks covering source/calldata/actor substitution, altered model output, missing deployment evidence, changed consensus/mode, incorrect rollback, changed signed bytes, nonzero signed value, relabelled negative execution and post-negative state mutation. These are offline artifact checks, separate from the 22 Python and 7 JavaScript suite counts.

## Live evidence status

The reviewed V2 contract is deployed at `0x3b0f631aE7Aacaf418212B7dE1974922aA7Fef02`, source SHA-256 `160a126d768de5def571ff85e19649336041b1259bb604952ebf7c2ff6325d52`, on Studionet 61999. `demo.json` and `negative.json` are verified. The single recorded drill has six events, final status `RECOVERED`, elapsed simulation time 7, and zero remaining rollback tokens.

`npm run verify` validates **9 selected public RPC transcripts: one deployment, seven successful workflow transactions and one exact expected rollback**. All nine public signed transactions independently verify sender, chain ID 61999, actual value 0, consensus destination, intended contract, exact ABI calldata and `leaderOnly:false`. The deployment's signed source bytes match both the local source hash and `getContractCode` read-back. Six leader `eq_outputs` retain original public readable output; their ABI-decoded values match the immutable event interpretations exactly. The latest post-negative `get_drill` read-back equals the complete archived record.

| Evidence | Observed result |
| --- | --- |
| Deployment `0xf8659e4e969754d0431902e688eeb9a1762faa224234a1be341f9652b1c6e526` | Validator majority agreement and successful constructor execution; signed source verified |
| Early restore `0xb443d3c3eabd263bf1139b641c13b286e37961c16fb642bb8d92a7e7913a6ccd` | Successful transaction; immutable denied event `NEEDS_VERIFICATION`, one simulated minute consumed |
| Five subsequent actions | INSPECT, ISOLATE, ROLLBACK, VERIFY, RESTORE; all applied and replayed independently |
| Final restore `0x42211675860f67022b4300ab51b190e3f543403d4adbbe2c0526679ed50265d9` | `RECOVERED`, six events, seven simulated minutes |
| Outsider `0x07cdc270188a4dd6f52d23488009185824e8d26dfcbb8e249238883aabc7dc36` | Validator `MAJORITY_AGREE`, VM `ERROR`, exact rollback `Only the assigned drill participants may act` |
| Post-negative record | Unchanged state digest `211468dfae106a0ac8e24f3fc6727c987b67decb77f5c9d21e38ad5e5aaf6455`; no outsider event added |

A denied recorded attempt and an outsider rollback are different outcomes. The early restore transaction succeeded and appended a denial event. The outsider transaction failed execution and appended no event. The latter is counted only as an expected rejection.

The successful semantic transactions establish majority agreement, not unanimity. Public vote maps include disagreeing validators for early restore, verify and final restore. No exact reason for those validators' disagreement is claimed because V2 does not log their independent response or audit rejection branch. One completed synthetic run is not proof of universal model reliability or real service recovery.

Public evidence files are `public/deployment.json`, `public/evidence/demo.json`, `public/evidence/negative.json` and `public/evidence/transcripts.json`. The transcript collector is read-only on chain, uses public RPC receipts and source/state views, and does not load wallet files or ask for signatures. The verifier is entirely offline. Browser interaction and external publication are verified separately.

## History: V1 consensus failure

The first deployment at `0x3113fA0Bf35aa4330711CE3117F7F3D725E9705e` succeeded, but its first interpreted action `0x0d641f81cb1fe3b606f6b8abe83c18938409bff0a3d1c33a680a3f162922c49e` was observed as `UNDETERMINED / MAJORITY_DISAGREE`. It did not commit a successful drill action. The original source SHA-256 is `e3e3fa48e2105fc868add6f1377d7217cf14e1bac723834eadaec6da883420a3`; source and selected failure receipt are retained in `public/evidence/attempts/`, and its separate deployment record remains in `public/evidence/deployment-0x3113fA0Bf35aa4330711CE3117F7F3D725E9705e.json`.

V2 clarifies action-intent interpretation versus deterministic prerequisite permission in its prompt and audit. The changed source was separately reviewed and deployed. The old receipt is not relabelled as success, and the later completed V2 run does not establish the exact cause of V1's disagreement or unanimous agreement.

## Reproduction

```sh
node scripts/live-test.mjs --plan
node scripts/live-test.mjs --deploy --source-sha=<reviewed exact contract SHA-256>
node scripts/live-test.mjs --run
node scripts/live-test.mjs --negative
npm run verify
node scripts/archive-transcripts.mjs  # optional read-only refresh; no broadcast
```

The recorded demo completed the denied premature restoration followed by the two-wallet five-action recovery. The separate outsider write produced the exact expected rollback. The failed execution is preserved as a negative test, never counted as a successful action. Rechecking the existing public evidence needs only `npm run verify`; the live harness commands above create transactions and are not part of the read-only verification process.

## Boundaries

The scenario and all actor wallets are controlled by this project. Instruction text is caller-asserted input. GenLayer interpretation is not authority to act on a real system. Time is a deterministic simulation counter, not wall-clock duration. No external production server, secret, real transfer, skill credential, financial payoff or prize mechanism is connected.
