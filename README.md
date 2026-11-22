# AssertNow_SFDC

AssertNow Salesforce Integration & Flow Automation Studio.

## Architecture
- `Backend/Backend/`: Node.js / Express service interfacing with Salesforce via jsforce and Client Credentials OAuth flow.
- `frontend/`: React + TypeScript + Vite + Tailwind CSS Studio canvas with dynamic Salesforce sObject introspection, picklist binding, upstream token interpolation, and live DML execution.
