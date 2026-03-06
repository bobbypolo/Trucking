# KCI TruckLogix Pro: Independent Owner Operator (Automation Pro) PRD

## 1. Overview
The "Automation Pro" tier (Tier 2) is designed for independent Owner Operators who require high-efficiency operations with minimal manual data entry. It focuses on 95% automation, deep analytics, and streamlined compliance.

## 2. Feature List

### MVP (Phase 1)
- **Multi-Step Onboarding**: 7-step wizard capturing identity, authority, equipment, financial settings, IFTA, and automation templates.
- **Rate Confirmation Parsing**: Automated load creation from PDF/Email uploads.
- **Document Management**: Auto-filing for fuel, scale, and receipts based on OCR.
- **IFTA Automation**: Jurisdictional mileage tracking and automated quarterly summaries.
- **Tier-Based Limits**: 1 Truck, 2 Users (Owner + Accountant), 50 GB Storage.
- **Financial Dashboard**: RPM, Profit per Load, Lane Analytics, and Fuel Trends.

### Phase 2 (Future)
- **ELD/GPS Integration**: Automatic mileage capture for IFTA.
- **Direct Banking Integration**: Automated expense reconciliation.
- **AI Route Optimization**: Suggestions based on previous lane performance.
- **Maintenance Predictive Alerts**: Based on real-time mileage.

## 3. Screens & UI Layout

### A. Onboarding Wizard
- **Stepper UI**: Vertical or Horizontal progress bar.
- **Step 1 (Identity)**: Legal Name, DBA, EIN (Masked), Address, Logo Upload.
- **Step 2 (Authority)**: MC/DOT#, Insurance Policy, Retention Settings, Audit Toggle.
- **Step 3 (Equipment)**: Truck/Trailer Registry (VIN, Plate, Maintenance intervals).
- **Step 4 (Money)**: Expense categories, Reimbursement rules, Pay structure.
- **Step 5 (IFTA)**: Base jurisdiction, Quarter tracking.
- **Step 6 (Templates)**: Rule engine for Document Naming and Load Intake.
- **Step 7 (Invites)**: Accountant/Auditor access management.

### B. Automation Pro Dashboard
- **Active Operational Streams**: Refined Live Comm Queue.
- **Financial Tiles**: High-fidelity widgets for RPM and Profitability.
- **Compliance Center**: Reminders for Insurance/Registration.

## 4. Permissions Matrix

| Module | Owner | Accountant | Assistant | Auditor (Read-only) |
| :--- | :--- | :--- | :--- | :--- |
| **Loads** | Full Access | View Only | Create/Edit | View Only |
| **Financials** | Full Access | Full Access | View Only | View Only |
| **Safety/IFTA** | Full Access | View (Audit) | View Only | View Only |
| **Settings** | Full Access | None | Limited | None |

## 5. SQL Schema Starter (Key Tables)

### `accounts` / `workspaces`
- `id` (UUID, PK)
- `company_name` (String)
- `tier` (Enum: 'Records Vault', 'Automation Pro', 'Fleet Core', 'Fleet Command')
- `limits_config` (JSONB)
- `automation_settings` (JSONB)

### `document_links`
- `id` (UUID, PK)
- `doc_id` (FK to `document_vault`)
- `entity_type` (Enum: 'Load', 'Expense', 'Equipment')
- `entity_id` (UUID)

### `automation_rules`
- `id` (UUID, PK)
- `workspace_id` (FK)
- `trigger_type` (Enum: 'Upload', 'Email', 'Scan')
- `action_type` (Enum: 'CreateLoad', 'TagDoc', 'FileExpense')
- `configuration` (JSONB)

## 6. Automation Rules Library (Starter Templates)
1. **RateCon Intake**: `IF (DocType == 'RateCon') THEN (Extract Fields -> Create Load -> Status: 'Pending Review')`
2. **Fuel Receipt Auto-File**: `IF (DocType == 'FuelReceipt') THEN (Extract State/Gallery -> Link to IFTA Quarter -> Create Expense)`
3. **POD to Load**: `IF (DocType == 'POD' AND ReferenceFound) THEN (Attach to Load -> Update Load Status: 'Delivered')`
