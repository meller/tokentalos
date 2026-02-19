# Track: TokenTalos - Multi-Project Analytics & Multi-Tenancy

## Overview
As TokenTalos evolves into a potentially public service, it must support multi-tenancy. This track adds **Organizations** as the top-level hierarchy and **API Key Authentication** to secure data ingestion.

## Functional Requirements

### 1. Multi-Tenant Hierarchy
*   **Organization:** Top-level entity that owns multiple projects.
*   **Schema Update:** Add `organizations` and `api_keys` tables.
*   **Data Segregation:** All `usage_data` must be linked to both a `project_id` and an `org_id`.

### 2. Ingestion Authorization
*   **API Keys:** Clients must provide an `X-TokenTalos-Key` header.
*   **Validation:** The server must verify the key and determine the associated `org_id` before accepting data.
*   **SDK:** Update `TokenTalos` constructor to accept an `apiKey`.

### 3. Dashboard Access Control
*   **User Context:** (Future) Users will log in and only see projects belonging to their `org_id`.
*   **Filter Update:** The Project Selector will now only show projects authorized for the current organization.

## Non-Functional Requirements
- **Security:** API keys must be hashed in the database.
- **Performance:** Fast lookup of Org/Project during the high-volume ingestion path.
