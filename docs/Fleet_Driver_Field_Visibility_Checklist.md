# Fleet Driver Load Detail: Field Visibility Checklist

This document defines the data leakage prevention rules for the Fleet Driver Mobile App.

| Field Name | Data Type | Driver Visibility | Toggle Dependency | Source Table |
| :--- | :--- | :--- | :--- | :--- |
| **Load ID / Trip ID** | String | Always | None | `loads.load_number` |
| **Status** | Enum | Always | None | `loads.status` |
| **Dispatcher Name/Contact** | Object | Always | None | `users.name` (Dispatcher) |
| **Stop Facility Name** | String | Toggle | `mask_broker_customer_name` | `load_legs.facility_name` |
| **Stop Address** | String | Always | None | `load_legs.address` |
| **Appointment Window** | String | Always | None | `load_legs.date`, `load_legs.appointment_time` |
| **Reference Numbers** | String | Always | None | `loads.reference_number`, `loads.po_number` |
| **Special Instructions** | String | Always | None | `loads.special_instructions` |
| **Commodity** | String | Toggle | `hide_load_rates_financials` (Contextual) | `loads.commodity` |
| **Weight** | Number | Toggle | `hide_load_rates_financials` (Contextual) | `loads.weight` |
| **Hazmat Flag** | Boolean | Always | None | `loads.is_hazmat` |
| **Seal Number/Inst** | String | Always | None | `loads.seal_number` |
| **Required Docs List** | Array | Always | None | `document_checklist` / `load_requirements` |
| **Carrier Rate (Total)** | Number | **Never** | N/A | `loads.carrier_rate` |
| **Linehaul Amount** | Number | **Never** | N/A | `loads.linehaul` |
| **Accessorial Billings** | Number | **Never** | N/A | `loads.accessorials` |
| **Broker Name** | String | Toggle | `hide_broker_customer_contacts` | `brokers.name` |
| **Broker Phone/Email** | String | **Never** (Default) | `hide_broker_customer_contacts` | `brokers.phone`, `brokers.email` |
| **Driver Estimated Pay** | Number | Toggle | `show_driver_pay_without_rate` | `loads.driver_pay` |
| **Rate Confirmation PDF** | File | **Never** (Default) | `allow_rate_con_to_driver` | `document_vault.url` |
| **Driver Load Sheet** | File | Always | None | Auto-generated DTO |

## Visibility Logic (Backend Enforcement)
- **Always**: Included in `LoadDriverDTO`.
- **Toggle**: Subject to `company.driver_visibility_policies`. If toggled OFF, field is Null/Empty in DTO.
- **Never**: Hard-excluded from `LoadDriverDTO`. Under no circumstances should these fields reach the Driver Mobile App memory.
