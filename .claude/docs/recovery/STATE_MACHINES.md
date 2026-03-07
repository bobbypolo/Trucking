# State Machines

> Defines the authoritative state machines for LoadPilot entities.
> Generated from analysis of schema.sql, types.ts, and server/index.ts.
> Last updated: 2026-03-07 (R-P0-02)

## Current State: No Enforcement

The codebase has **zero server-side state machine enforcement**. The PATCH /api/loads/:id/status route accepts any status string and writes it directly to MySQL:

```typescript
// server/index.ts line 666 -- current (broken) implementation
await pool.query('UPDATE loads SET status = ? WHERE id = ?', [status, loadId]);
```

Additionally, the client-side storageService.ts writes status changes directly to localStorage, bypassing the server entirely. The schema ENUM and types.ts definitions are misaligned:

| Source | Status Values | Count |
| --- | --- | --- |
| **schema.sql** ENUM | Planned, Booked, Active, Departed, Arrived, Docked, Unloaded, Delivered, Invoiced, Settled, Cancelled, CorrectionRequested | 12 |
| **types.ts** LoadStatus | Unassigned, Assigned, Dispatched, In-Transit, At_Pickup, Loaded, At_Delivery, Delivered, Closed, Settled, Cancelled, Active, Booked, Planned, Completed | 15 |

The recovery program must define canonical state machines and enforce them server-side.

---

## 1. Load State Machine

### States (Canonical -- Recovery Target)

| State | Description | Terminal? |
| --- | --- | --- |
| **planned** | Load created, not yet assigned to driver/equipment | No |
| **booked** | Driver and equipment assigned, ready for dispatch | No |
| **dispatched** | Driver notified, en route to pickup | No |
| **in_transit** | Picked up, moving toward delivery | No |
| **delivered** | Arrived at final stop, POD obtained | No |
| **invoiced** | Customer invoice generated | No |
| **settled** | Driver settlement calculated and approved | No |
| **completed** | All financial obligations closed, load archived | Yes |
| **cancelled** | Load cancelled before completion | Yes |

### Transition Table (8 Forward Transitions)

| # | From | To | Trigger | Guard Conditions | Side Effects |
| --- | --- | --- | --- | --- | --- |
| T1 | planned | booked | Assign driver + equipment | driver_id NOT NULL, at least 1 load_leg exists | dispatch_event logged |
| T2 | booked | dispatched | Dispatcher confirms dispatch | Driver compliance_status = Eligible | Notification sent to driver; dispatch_event logged |
| T3 | dispatched | in_transit | Driver confirms pickup | At least 1 Pickup leg marked completed = true | GPS tracking activated; dispatch_event logged |
| T4 | in_transit | delivered | Driver confirms delivery | All Dropoff legs marked completed = true, POD uploaded (pod_urls NOT empty) | Notification sent to customer; dispatch_event logged |
| T5 | delivered | invoiced | Invoice generated | ar_invoice record created for this load_id | journal_entry posted (AR debit, Revenue credit) |
| T6 | invoiced | settled | Settlement approved | driver_settlement record with status = Approved exists for this load | journal_entry posted (Driver Pay debit, AP credit) |
| T7 | settled | completed | All financials closed | ar_invoice balance_due = 0, no pending adjustment_entries | Load archived; dispatch_event logged |
| T8 | (any non-terminal) | cancelled | Dispatcher or admin cancels | Not in invoiced/settled/completed state | Reversal entries if past delivered; dispatch_event logged |

### State Diagram

```
  planned --T1--> booked --T2--> dispatched --T3--> in_transit
                                                        |
                                                       T4
                                                        |
                                                        v
  completed <--T7-- settled <--T6-- invoiced <--T5-- delivered

  Any non-terminal state --T8--> cancelled
```

### Forbidden Transitions

These transitions MUST be rejected by the server with HTTP 422 and a descriptive error:

| From | To | Reason |
| --- | --- | --- |
| planned | dispatched | Cannot skip booking (driver/equipment assignment required) |
| planned | in_transit | Cannot skip booking and dispatch |
| planned | delivered | Cannot skip entire lifecycle |
| planned | invoiced | Cannot invoice without delivery |
| planned | settled | Cannot settle without invoice |
| planned | completed | Cannot complete without settlement |
| booked | in_transit | Cannot skip dispatch confirmation |
| booked | delivered | Cannot skip dispatch and transit |
| booked | invoiced | Cannot invoice without delivery |
| booked | settled | Cannot settle without invoice |
| booked | completed | Cannot complete without settlement |
| dispatched | delivered | Cannot skip transit (pickup confirmation required) |
| dispatched | invoiced | Cannot invoice without delivery |
| dispatched | settled | Cannot settle without invoice |
| dispatched | completed | Cannot complete without settlement |
| in_transit | invoiced | Cannot invoice without delivery confirmation |
| in_transit | settled | Cannot settle without invoice |
| in_transit | completed | Cannot complete without settlement |
| delivered | settled | Cannot skip invoicing |
| delivered | completed | Cannot complete without settlement |
| invoiced | completed | Cannot complete without settlement |
| completed | (any) | Terminal state -- no transitions allowed |
| cancelled | (any) | Terminal state -- no transitions allowed |
| invoiced | cancelled | Cannot cancel after invoice posted (use CorrectionRequested) |
| settled | cancelled | Cannot cancel after settlement (use adjustment) |
| (any) | planned | Cannot revert to planned (create new load instead) |
| delivered | dispatched | Cannot revert to dispatched |
| delivered | in_transit | Cannot revert to transit |
| invoiced | delivered | Cannot revert to delivered (use credit memo) |
| settled | invoiced | Cannot revert to invoiced (use adjustment) |

### Backward/Correction Transitions

For error correction, a separate **CorrectionRequested** mechanism is needed (not a status, but a flag/workflow):

| Scenario | Mechanism | Result |
| --- | --- | --- |
| Wrong delivery info | CorrectionRequested flag on load | Dispatcher reviews, updates data, clears flag (status unchanged) |
| Invoice error | Credit memo (new ar_invoice with negative amount) | Original invoice status unchanged; new reversing entry |
| Settlement error | Adjustment entry (adjustment_entries table) | Original settlement unchanged; adjustment posted to GL |

### Status Value Reconciliation (Current to Target)

| Current (types.ts) | Target | Action |
| --- | --- | --- |
| Unassigned | planned | Rename |
| Assigned | booked | Rename |
| Dispatched | dispatched | Keep (lowercase) |
| In-Transit | in_transit | Rename (remove hyphen) |
| At_Pickup | (removed) | Merge into dispatched/in_transit transition guard |
| Loaded | (removed) | Merge into in_transit (pickup confirmed) |
| At_Delivery | (removed) | Merge into delivered transition guard |
| Delivered | delivered | Keep (lowercase) |
| Closed | completed | Rename |
| Settled | settled | Keep (lowercase) |
| Cancelled | cancelled | Keep (lowercase) |
| Active | (removed) | Ambiguous -- map to dispatched or in_transit based on context |
| Booked | booked | Keep (lowercase) |
| Planned | planned | Keep (lowercase) |
| Completed | completed | Keep (lowercase) |

Migration query for existing data:

```sql
UPDATE loads SET status = CASE status
  WHEN 'Planned' THEN 'planned'
  WHEN 'Booked' THEN 'booked'
  WHEN 'Active' THEN 'dispatched'
  WHEN 'Departed' THEN 'in_transit'
  WHEN 'Arrived' THEN 'delivered'
  WHEN 'Docked' THEN 'delivered'
  WHEN 'Unloaded' THEN 'delivered'
  WHEN 'Delivered' THEN 'delivered'
  WHEN 'Invoiced' THEN 'invoiced'
  WHEN 'Settled' THEN 'settled'
  WHEN 'Cancelled' THEN 'cancelled'
  WHEN 'CorrectionRequested' THEN status  -- handle separately
  ELSE status
END;

ALTER TABLE loads MODIFY COLUMN status
  ENUM('planned','booked','dispatched','in_transit','delivered','invoiced','settled','completed','cancelled')
  DEFAULT 'planned';
```

---

## 2. Settlement State Machine

### Context

Driver settlements represent the pay calculation and disbursement lifecycle. The current codebase defines settlement status in types.ts as `Draft | Calculated | Approved | Paid` but the acceptance criteria specifies a different lifecycle aligned with the accounting workflow: `pending_generation -> generated -> reviewed -> posted`, with an `adjusted` state.

The target state machine below reconciles both views.

### States

| State | Description | Terminal? |
| --- | --- | --- |
| **pending_generation** | Settlement period closed, awaiting batch calculation | No |
| **generated** | System has calculated earnings, deductions, reimbursements, and net pay | No |
| **reviewed** | Payroll manager has reviewed and approved the settlement | No |
| **posted** | GL journal entries posted, payment issued to driver | Yes |
| **adjusted** | A correction has been applied after posting (reversing + new entry) | Yes |

### Transition Table (4 Forward Transitions + 1 Correction)

| # | From | To | Trigger | Guard Conditions | Side Effects |
| --- | --- | --- | --- | --- | --- |
| S1 | pending_generation | generated | Batch settlement run | All loads in period have status >= invoiced; settlement_lines computed | driver_settlements record created with calculated amounts |
| S2 | generated | reviewed | Payroll manager approves | All settlement_lines have valid gl_account_id; net_pay > 0 or explicit zero-pay approval | Audit log entry |
| S3 | reviewed | posted | Finance posts to GL | Double-entry journal balanced (debits = credits) | journal_entry + journal_lines created; payment file generated |
| S4 | posted | adjusted | Correction required | adjustment_entry created with reason_code | Reversing journal_entry posted; new corrected settlement_lines; new journal_entry posted |
| S5 | adjusted | (none) | -- | -- | Terminal. If further correction needed, create new adjustment_entry |

### State Diagram

```
  pending_generation --S1--> generated --S2--> reviewed --S3--> posted --S4--> adjusted
```

### Forbidden Transitions

These transitions MUST be rejected by the server with HTTP 422:

| From | To | Reason |
| --- | --- | --- |
| pending_generation | reviewed | Cannot review before calculation |
| pending_generation | posted | Cannot post before calculation and review |
| pending_generation | adjusted | Cannot adjust what has not been posted |
| generated | posted | Cannot post before review/approval |
| generated | adjusted | Cannot adjust what has not been posted |
| generated | pending_generation | Cannot revert to pending (re-run calculation instead, which overwrites) |
| reviewed | generated | Cannot revert to generated (re-run calculation creates new version) |
| reviewed | pending_generation | Cannot revert to pending |
| reviewed | adjusted | Cannot adjust what has not been posted |
| posted | pending_generation | Cannot revert to pending |
| posted | generated | Cannot revert to generated |
| posted | reviewed | Cannot revert to reviewed (GL entries are immutable) |
| adjusted | (any) | Terminal state -- no further transitions. Create new adjustment if needed |

### Status Value Reconciliation (Current to Target)

| Current (types.ts) | Target | Action |
| --- | --- | --- |
| Draft | pending_generation | Rename -- a draft settlement is one awaiting calculation |
| Calculated | generated | Rename -- calculated means the system has generated the amounts |
| Approved | reviewed | Rename -- approved by payroll manager |
| Paid | posted | Rename -- paid means GL posted and payment issued |
| (new) | adjusted | Add -- correction state for post-posting adjustments |

Migration query for existing data:

```sql
ALTER TABLE driver_settlements MODIFY COLUMN status
  ENUM('pending_generation','generated','reviewed','posted','adjusted')
  DEFAULT 'pending_generation';

UPDATE driver_settlements SET status = CASE status
  WHEN 'Draft' THEN 'pending_generation'
  WHEN 'Calculated' THEN 'generated'
  WHEN 'Approved' THEN 'reviewed'
  WHEN 'Paid' THEN 'posted'
  ELSE status
END;
```

---

## 3. Implementation Requirements

### Server-Side Enforcement Pattern

All state transitions must be validated server-side before the database write. The recommended pattern:

```typescript
// Pseudocode for the transition validator
const LOAD_TRANSITIONS: Record<string, string[]> = {
  planned:    ['booked', 'cancelled'],
  booked:     ['dispatched', 'cancelled'],
  dispatched: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered:  ['invoiced'],
  invoiced:   ['settled'],
  settled:    ['completed'],
  completed:  [],  // terminal
  cancelled:  [],  // terminal
};

function validateTransition(current: string, next: string): boolean {
  const allowed = LOAD_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.includes(next);
}
```

### Audit Requirements

Every state transition must produce:

1. A `dispatch_events` record (for loads) or audit log entry (for settlements)
2. The previous state, new state, actor (user_id), and timestamp
3. Guard condition evaluation result (which conditions passed/failed)

### Client-Side Changes

1. Remove all localStorage status writes from storageService.ts
2. Client may only request transitions via PATCH /api/loads/:id/status
3. Client must handle HTTP 422 responses gracefully (show which transition was rejected and why)
4. UI should only render valid next-state buttons based on current state

### Testing Strategy

For each state machine:

1. **Happy path**: Walk through all forward transitions T1-T7 (load) / S1-S4 (settlement)
2. **Forbidden transitions**: Attempt every forbidden pair, verify HTTP 422
3. **Guard conditions**: Test each guard (e.g., missing POD blocks T4)
4. **Concurrency**: Two simultaneous transition requests on same entity -- one must fail
5. **Idempotency**: Same valid transition requested twice -- second returns current state, no error
