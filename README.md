# RunbookArena

A collaborative synthetic incident drill on GenLayer. Two designated wallets coordinate inspection, isolation, rollback, smoke verification and traffic restoration. GenLayer validators independently interpret each natural-language instruction into a fixed action vocabulary; a deterministic engine enforces roles, turn order, prerequisites and finite simulated resources.

**No real infrastructure, money, prizes or operational certification are involved.** Demonstration wallets are project-controlled. The application is a simulation of coordination and an auditable interpretation boundary, not proof that a real service recovered or that a participant is a qualified operator.

## Workflow

1. Connect MetaMask to Studionet 61999 and create a uniquely named drill with a distinct responder address.
2. The commander inspects; the responder isolates writes; the commander rolls back; the responder verifies; the commander restores traffic.
3. Each actor submits one instruction against the exact current state digest. Validators independently classify the intended action and substantively check quoted instruction/card evidence.
4. Premature, wrong-action-role or unknown instructions are recorded as denied attempts and consume bounded simulated time. An unassigned or out-of-turn wallet cannot spend the team's budget. An unknown intent never executes a guessed action.
5. Inspect the immutable before/after trail. Export the public drill record, or read it again from the chain and independently replay all deterministic transitions in JavaScript.

The default scenario has ten simulated minutes and one rollback token. A recovered drill is terminal; an exhausted drill is terminal. Failed calls, unknown broadcast outcomes, and consensus disagreement remain distinct from successful state changes.

## State and consensus

`start_drill(id,responder)` freezes the scenario and participants. `attempt(id,base_digest,instruction)` binds the instruction to current state; it cannot replay against an old turn. Each event stores actor, role, original instruction, independently audited semantic interpretation, before/after states, denial reason and digest links. `get_drill(id)` returns the record; `get_scenario()` returns the frozen finite profile.

The model cannot run shell commands, choose costs, advance time, create new action IDs or change prerequisites. Recognition is intentionally separate from authorization: a premature explicit restoration request can mean RESTORE while deterministic execution records NEEDS_VERIFICATION. Validators must agree on the bounded action/certainty pair and independently audit substantive citations; leader wording alone is not the decision rule.

The browser saves broadcast intent before invoking the wallet and saves the returned hash before polling. Recovery verifies sender, destination and exact calldata. It never silently rebroadcasts a missing response. EIP-1193 user rejection, a terminal failed execution and an uncertain broadcast have different recovery paths.

## Development

```sh
npm ci
npm run test:contract
npm test
npm run build
npm run dev
node scripts/live-test.mjs --plan
```

The SDK is pinned to `genlayer-js@1.1.8`, Studionet 61999 and zero-value calls with `leaderOnly:false`. The default harness does not create wallets or broadcast. Reviewed exact source hashes are required for deployment. Local test keys live only in ignored `.local/` files with restricted permissions; no funded/mainnet key is needed.

The reviewed V2 deployment at `0x3b0f631aE7Aacaf418212B7dE1974922aA7Fef02` completed one synthetic drill with **6 recorded events, `RECOVERED`, and 7 simulated minutes**. The early restore was recorded as denied with `NEEDS_VERIFICATION`; the remaining five actions recovered the drill. The outsider call produced the exact expected VM rollback and left the drill unchanged.

`npm run verify` now checks **9 public RPC transcripts: 1 deployment, 7 successful workflow writes and 1 expected failed execution**. It independently replays the drill, recovers each public transaction's signer, verifies chain 61999 and actual zero value, binds signed calldata and `leaderOnly:false`, checks deployed source SHA-256, and matches all 6 ABI-decoded model outputs to immutable events. Original readable model outputs and vote maps are retained; node configuration and wallet keys are excluded. These are majority consensus results, with some disagreeing votes, not unanimous model agreement.

```sh
npm run verify                         # offline public-evidence checks; no RPC or writes
node scripts/archive-transcripts.mjs   # read-only RPC refresh; saves selected public evidence
```

Current evidence is in `public/deployment.json`, `public/evidence/demo.json`, `negative.json` and `transcripts.json`. The source hash is `160a126d768de5def571ff85e19649336041b1259bb604952ebf7c2ff6325d52`. The original V1 majority disagreement, its source and selected receipt remain under `public/evidence/attempts/`; V2 uses a separate deployment. See [validation](docs/validation.md) for exact results and historical limits. Browser checks and publication are separate from these chain-evidence checks.

## Attribution

Wallet transport, receipt checking, pacing and journal recovery are adapted from the same author's IncidentDesk. The synthetic scenario, action interpreter, deterministic drill engine, replay verifier, tests and application workflow are new. This is not a resubmission of IncidentDesk or a renamed starter.
