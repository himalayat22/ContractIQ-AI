# ContractIQ AI — MongoDB Schema Design

**Document Version:** 1.0  
**Date:** June 1, 2026  
**Status:** Draft  
**Parent Documents:** [PROJECT_BLUEPRINT.md](./PROJECT_BLUEPRINT.md), [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Global Conventions](#2-global-conventions)
3. [Entity Relationship Model](#3-entity-relationship-model)
4. [Database: contractiq_auth](#4-database-contractiq_auth)
5. [Database: contractiq_user](#5-database-contractiq_user)
6. [Database: contractiq_contract](#6-database-contractiq_contract)
7. [Database: contractiq_ai](#7-database-contractiq_ai)
8. [Database: contractiq_search](#8-database-contractiq_search)
9. [Database: contractiq_notification](#9-database-contractiq_notification)
10. [Database: contractiq_audit](#10-database-contractiq_audit)
11. [Database: contractiq_billing](#11-database-contractiq_billing-phase-2)
12. [Database: contractiq_playbook](#12-database-contractiq_playbook-phase-2)
13. [Cross-Database Reference Map](#13-cross-database-reference-map)
14. [Sharding & Growth Strategy](#14-sharding--growth-strategy)
15. [Migration & Versioning](#15-migration--versioning)

---

## 1. Overview

### 1.1 Purpose

This document defines the complete MongoDB schema for ContractIQ AI across all microservice databases. It specifies collections, field types, relationships, indexes, and validation rules enforced at the application layer and via MongoDB JSON Schema validation (where noted).

### 1.2 Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Database per service** | Logical separation; no cross-database joins at runtime |
| **Tenant isolation** | `tenantId` on every tenant-scoped document; leading field in compound indexes |
| **ObjectId references** | Foreign keys stored as `ObjectId`; integrity enforced in services |
| **Timestamps** | `createdAt`, `updatedAt` on mutable collections (UTC `Date`) |
| **Soft delete** | `deletedAt` where business requires recovery (contracts, users) |
| **Append-only** | `audit_logs`, `stripe_events`, `ai_usage_logs` — no updates/deletes |
| **Outbox pattern** | `outbox_events` in publishing services for RabbitMQ reliability |
| **Schema version** | `schemaVersion` field (number) on collections for migrations |

### 1.3 Type Notation

| Notation | BSON Type |
|----------|-----------|
| `ObjectId` | ObjectId |
| `String` | UTF-8 string |
| `Number` | double/int |
| `Boolean` | bool |
| `Date` | UTC datetime |
| `Array<T>` | array of T |
| `Object` | embedded document |
| `Decimal` | Decimal128 (billing only) |
| `BinData` | Binary (not used MVP) |

---

## 2. Global Conventions

### 2.1 Standard Field Patterns

| Field | Present On | Rules |
|-------|------------|-------|
| `_id` | All collections | Auto-generated ObjectId (default) |
| `tenantId` | Tenant-scoped collections | Required; must match authenticated tenant |
| `createdAt` | Mutable collections | Set on insert; immutable |
| `updatedAt` | Mutable collections | Set on insert/update |
| `deletedAt` | Soft-deletable collections | `null` when active; ISO Date when deleted |
| `schemaVersion` | All collections | Default `1`; increment on breaking migration |

### 2.2 Shared Enumerations

#### `UserRole`
`tenant_admin` | `legal_reviewer` | `business_user` | `viewer`

#### `MembershipStatus`
`active` | `invited` | `suspended` | `removed`

#### `PlanTier`
`free` | `pro` | `enterprise`

#### `ContractStatus`
`uploading` | `processing` | `analyzed` | `failed` | `deleted`

#### `ContractType`
`nda` | `msa` | `sow` | `employment` | `vendor` | `other`

#### `RiskLevel`
`low` | `medium` | `high`

#### `AnalysisStatus`
`pending` | `processing` | `completed` | `failed`

#### `ClauseType`
`parties_definitions` | `term_termination` | `payment_fees` | `confidentiality` | `intellectual_property` | `indemnification` | `limitation_liability` | `warranties_disclaimers` | `governing_law` | `assignment_change_of_control` | `force_majeure` | `data_protection` | `non_compete` | `insurance` | `miscellaneous`

#### `NotificationType`
`analysis_complete` | `analysis_failed` | `high_risk` | `mention` | `task_assigned` | `member_invited` | `member_joined`

#### `SubscriptionStatus`
`active` | `trialing` | `past_due` | `canceled` | `incomplete`

### 2.3 Index Naming Convention

Format: `idx_{collection}_{fields}_{unique?}`

Examples: `idx_contracts_tenantId_status`, `idx_users_email_unique`

### 2.4 Validation Enforcement Layers

| Layer | Responsibility |
|-------|----------------|
| **MongoDB JSON Schema** | Type, required fields, enums, min/max (collections marked `Validator: Yes`) |
| **Application (Zod)** | Business rules, cross-field logic, FK existence |
| **API Gateway** | Request shape before persistence |

---

## 3. Entity Relationship Model

### 3.1 Logical ER Diagram (Cross-Service)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           contractiq_auth                                    │
│  users ◄────── refresh_tokens, sessions, password_reset_tokens, oauth_accounts│
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ userId (logical FK)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           contractiq_user                                      │
│  organizations ◄── memberships ──► user_profiles                            │
│       │                    ▲                                                   │
│       └── invites ─────────┘         notification_preferences (per user/tenant)│
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ tenantId
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│contractiq_    │      │contractiq_ai  │      │contractiq_    │
│contract       │      │               │      │search         │
│               │      │ analyses      │      │ search_       │
│ contracts     │◄────►│ clauses       │      │ documents     │
│ contract_     │      │ embedding_    │      └───────────────┘
│ versions      │      │ chunks        │
│ comments      │      │ qa_sessions   │      ┌───────────────┐
└───────────────┘      │ qa_messages   │      │contractiq_    │
                       │ ai_usage_logs │      │notification   │
                       └───────────────┘      │ notifications │
                                              │ email_outbox  │
┌───────────────┐      ┌───────────────┐      └───────────────┘
│contractiq_    │      │contractiq_    │
│audit          │      │billing (Ph2)  │      ┌───────────────┐
│ audit_logs    │      │ subscriptions │      │contractiq_    │
└───────────────┘      │ api_keys      │      │playbook (Ph2) │
                       └───────────────┘      │ playbooks     │
                                              └───────────────┘
```

### 3.2 Cardinality Summary

| Parent | Child | Relationship | FK Location |
|--------|-------|--------------|-------------|
| organizations | memberships | 1:N | memberships.tenantId |
| users | memberships | 1:N | memberships.userId |
| organizations | contracts | 1:N | contracts.tenantId |
| contracts | contract_versions | 1:N | contract_versions.contractId |
| contracts | comments | 1:N | comments.contractId |
| contract_versions | analyses | 1:1 per run | analyses.versionId |
| analyses | clauses | 1:N | clauses.versionId + analysis context |
| contracts | embedding_chunks | 1:N | embedding_chunks.contractId |
| contracts | qa_sessions | 1:N | qa_sessions.contractId |
| qa_sessions | qa_messages | 1:N | qa_messages.sessionId |
| users | notifications | 1:N | notifications.userId |
| organizations | playbooks | 1:N | playbooks.tenantId |
| organizations | subscriptions | 1:1 | subscriptions.tenantId |

---

## 4. Database: contractiq_auth

**Service:** auth-service  
**Purpose:** Authentication credentials, sessions, tokens

---

### 4.1 Collection: `users`

**Description:** Canonical identity and credential store. Profile display fields are duplicated in `contractiq_user.user_profiles`.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | Primary key |
| `email` | String | Yes | — | Lowercased; unique globally |
| `emailNormalized` | String | Yes | — | `email.toLowerCase().trim()` for lookups |
| `passwordHash` | String | Cond. | — | bcrypt hash; null if OAuth-only |
| `firstName` | String | Yes | — | Max 100 chars |
| `lastName` | String | Yes | — | Max 100 chars |
| `isSuperAdmin` | Boolean | Yes | `false` | Platform operator flag |
| `emailVerified` | Boolean | Yes | `false` | |
| `emailVerifiedAt` | Date | No | `null` | |
| `status` | String | Yes | `active` | `active` \| `suspended` \| `deleted` |
| `failedLoginAttempts` | Number | Yes | `0` | Reset on success |
| `lockedUntil` | Date | No | `null` | Account lockout expiry |
| `lastLoginAt` | Date | No | `null` | |
| `schemaVersion` | Number | Yes | `1` | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |
| `deletedAt` | Date | No | `null` | Soft delete |

**Relationships:**
- Referenced by: `refresh_tokens.userId`, `sessions.userId`, `memberships.userId` (user DB), `oauth_accounts.userId`
- On register: publishes `user.created` with `userId`

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_users_emailNormalized_unique` | `{ emailNormalized: 1 }` | unique |
| `idx_users_status` | `{ status: 1, createdAt: -1 }` | |
| `idx_users_isSuperAdmin` | `{ isSuperAdmin: 1 }` | sparse |

**Validation Rules:**
- `email`: valid email format; max length 255
- `emailNormalized`: must equal normalized form of `email`
- `passwordHash`: required when no `oauth_accounts` linked (application rule)
- `passwordHash`: bcrypt prefix `$2`; length ≥ 60 when present
- `firstName`, `lastName`: non-empty; trim whitespace; max 100
- `status`: enum `active`, `suspended`, `deleted`
- `failedLoginAttempts`: integer 0–10
- `isSuperAdmin`: only settable via internal admin API
- **Validator:** Yes

---

### 4.2 Collection: `refresh_tokens`

**Description:** Opaque refresh tokens for session renewal; stored hashed.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `userId` | ObjectId | Yes | — | FK → users._id |
| `tokenHash` | String | Yes | — | SHA-256 of token |
| `familyId` | String | Yes | — | UUID; rotation family |
| `expiresAt` | Date | Yes | — | Typically +7 days |
| `revokedAt` | Date | No | `null` | Set on logout/compromise |
| `replacedByTokenId` | ObjectId | No | `null` | Rotation chain |
| `userAgent` | String | No | — | Max 512 |
| `ipAddress` | String | No | — | Max 45 (IPv6) |
| `createdAt` | Date | Yes | now | |

**Relationships:**
- `userId` → `users._id` (many tokens per user allowed; one active family recommended)

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_refresh_tokens_tokenHash_unique` | `{ tokenHash: 1 }` | unique |
| `idx_refresh_tokens_userId` | `{ userId: 1, createdAt: -1 }` | |
| `idx_refresh_tokens_expiresAt_ttl` | `{ expiresAt: 1 }` | TTL: 0s after expiresAt |
| `idx_refresh_tokens_familyId` | `{ familyId: 1 }` | |

**Validation Rules:**
- `tokenHash`: 64-char hex (SHA-256)
- `familyId`: UUID v4 format
- `expiresAt`: must be > `createdAt`
- `revokedAt`: if set, must be ≤ now
- **Validator:** Yes

---

### 4.3 Collection: `sessions`

**Description:** Active session metadata for optional server-side session tracking.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `userId` | ObjectId | Yes | — | FK → users._id |
| `refreshTokenId` | ObjectId | Yes | — | FK → refresh_tokens._id |
| `lastActiveAt` | Date | Yes | now | Updated on API activity |
| `userAgent` | String | No | — | |
| `ipAddress` | String | No | — | |
| `createdAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_sessions_userId` | `{ userId: 1, lastActiveAt: -1 }` | |
| `idx_sessions_lastActiveAt_ttl` | `{ lastActiveAt: 1 }` | TTL: 30 days |

**Validation Rules:**
- `userId`, `refreshTokenId`: valid ObjectId
- **Validator:** Yes

---

### 4.4 Collection: `password_reset_tokens`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `userId` | ObjectId | Yes | — | FK → users._id |
| `tokenHash` | String | Yes | — | SHA-256 |
| `expiresAt` | Date | Yes | — | +1 hour from creation |
| `usedAt` | Date | No | `null` | Single use |
| `createdAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_password_reset_tokenHash_unique` | `{ tokenHash: 1 }` | unique |
| `idx_password_reset_expiresAt_ttl` | `{ expiresAt: 1 }` | TTL: 0s after expiresAt |

**Validation Rules:**
- `usedAt`: can only be set once
- Token invalid if `usedAt` set or `expiresAt` < now
- **Validator:** Yes

---

### 4.5 Collection: `oauth_accounts` (Phase 2)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `userId` | ObjectId | Yes | — | FK → users._id |
| `provider` | String | Yes | — | `google` \| `microsoft` |
| `providerUserId` | String | Yes | — | Subject from IdP |
| `accessTokenEncrypted` | String | No | — | AES encrypted |
| `refreshTokenEncrypted` | String | No | — | |
| `expiresAt` | Date | No | — | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_oauth_provider_providerUserId_unique` | `{ provider: 1, providerUserId: 1 }` | unique |
| `idx_oauth_userId` | `{ userId: 1 }` | |

**Validation Rules:**
- `provider`: enum `google`, `microsoft`
- Unique per provider account globally
- **Validator:** Yes

---

### 4.6 Collection: `outbox_events`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `eventId` | String | Yes | — | UUID v4; unique |
| `exchange` | String | Yes | — | RabbitMQ exchange |
| `routingKey` | String | Yes | — | |
| `payload` | Object | Yes | — | Full event envelope |
| `status` | String | Yes | `pending` | `pending` \| `published` \| `failed` |
| `attempts` | Number | Yes | `0` | Publish retry count |
| `lastError` | String | No | — | |
| `publishedAt` | Date | No | — | |
| `createdAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_outbox_eventId_unique` | `{ eventId: 1 }` | unique |
| `idx_outbox_status_createdAt` | `{ status: 1, createdAt: 1 }` | |

**Validation Rules:**
- `status`: enum `pending`, `published`, `failed`
- `attempts`: max 10 before manual intervention
- **Validator:** Yes

---

## 5. Database: contractiq_user

**Service:** user-service  
**Purpose:** Organizations, memberships, profiles, invites

---

### 5.1 Collection: `organizations`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | Primary key (= tenantId) |
| `name` | String | Yes | — | Display name; max 200 |
| `slug` | String | Yes | — | URL slug; globally unique |
| `plan` | String | Yes | `free` | PlanTier enum |
| `status` | String | Yes | `active` | `active` \| `suspended` \| `deleted` |
| `settings` | Object | Yes | `{}` | See embedded schema |
| `settings.retentionDays` | Number | No | `365` | Contract retention |
| `settings.allowedDomains` | Array\<String\> | No | `[]` | Email domain allowlist |
| `settings.defaultPlaybookId` | ObjectId | No | `null` | Phase 2 |
| `settings.timezone` | String | No | `UTC` | IANA timezone |
| `billingEmail` | String | No | — | |
| `createdBy` | ObjectId | Yes | — | FK → auth users (creator) |
| `schemaVersion` | Number | Yes | `1` | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |
| `deletedAt` | Date | No | `null` | |

**Relationships:**
- Parent of: `memberships`, `invites` (via tenantId)
- Referenced by: all tenant-scoped collections via `tenantId`

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_organizations_slug_unique` | `{ slug: 1 }` | unique |
| `idx_organizations_status` | `{ status: 1 }` | |
| `idx_organizations_plan` | `{ plan: 1 }` | |

**Validation Rules:**
- `slug`: lowercase alphanumeric + hyphens; 3–50 chars; regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- `name`: trim; min 2; max 200
- `plan`: enum `free`, `pro`, `enterprise`
- `status`: enum `active`, `suspended`, `deleted`
- `settings.retentionDays`: integer 30–3650
- **Validator:** Yes

---

### 5.2 Collection: `user_profiles`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `userId` | ObjectId | Yes | — | FK → auth users._id; unique |
| `email` | String | Yes | — | Denormalized from auth |
| `firstName` | String | Yes | — | |
| `lastName` | String | Yes | — | |
| `avatarUrl` | String | No | `null` | HTTPS URL |
| `jobTitle` | String | No | — | Max 100 |
| `phone` | String | No | — | Max 20 |
| `locale` | String | No | `en-US` | BCP 47 |
| `schemaVersion` | Number | Yes | `1` | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |

**Relationships:**
- `userId` → auth `users._id` (1:1)
- Synced on `user.created` event

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_user_profiles_userId_unique` | `{ userId: 1 }` | unique |
| `idx_user_profiles_email` | `{ email: 1 }` | |

**Validation Rules:**
- `userId`: unique; immutable after insert
- `email`: valid email format
- `avatarUrl`: must be `https://` or null
- **Validator:** Yes

---

### 5.3 Collection: `memberships`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | FK → organizations._id |
| `userId` | ObjectId | Yes | — | FK → auth users._id |
| `role` | String | Yes | — | UserRole enum |
| `status` | String | Yes | `active` | MembershipStatus |
| `invitedBy` | ObjectId | No | — | FK → users._id |
| `invitedAt` | Date | No | — | |
| `joinedAt` | Date | No | — | Set when invite accepted |
| `suspendedAt` | Date | No | — | |
| `schemaVersion` | Number | Yes | `1` | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |

**Relationships:**
- `(tenantId, userId)` uniquely identifies membership
- At least one `tenant_admin` per active tenant (application rule)

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_memberships_tenantId_userId_unique` | `{ tenantId: 1, userId: 1 }` | unique |
| `idx_memberships_tenantId_status` | `{ tenantId: 1, status: 1 }` | |
| `idx_memberships_userId` | `{ userId: 1 }` | |
| `idx_memberships_tenantId_role` | `{ tenantId: 1, role: 1 }` | |

**Validation Rules:**
- `role`: enum UserRole values
- `status`: enum `active`, `invited`, `suspended`, `removed`
- `joinedAt`: required when `status` = `active` (unless bootstrap creator)
- Cannot demote last `tenant_admin` (application rule)
- **Validator:** Yes

---

### 5.4 Collection: `invites`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | FK → organizations._id |
| `email` | String | Yes | — | Invitee email |
| `emailNormalized` | String | Yes | — | Lowercased |
| `role` | String | Yes | — | UserRole |
| `tokenHash` | String | Yes | — | SHA-256 of invite token |
| `status` | String | Yes | `pending` | `pending` \| `accepted` \| `expired` \| `revoked` |
| `invitedBy` | ObjectId | Yes | — | FK → users._id |
| `expiresAt` | Date | Yes | — | +7 days default |
| `acceptedAt` | Date | No | — | |
| `acceptedByUserId` | ObjectId | No | — | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_invites_tenantId_email_pending_unique` | `{ tenantId: 1, emailNormalized: 1, status: 1 }` | partial: `{ status: "pending" }`, unique |
| `idx_invites_tokenHash_unique` | `{ tokenHash: 1 }` | unique |
| `idx_invites_expiresAt_ttl` | `{ expiresAt: 1 }` | TTL on expired docs (optional) |

**Validation Rules:**
- `role`: cannot be `viewer` for domain-restricted tenants if email domain not allowed
- `status`: transitions: pending → accepted|expired|revoked only
- One pending invite per email per tenant
- **Validator:** Yes

---

### 5.5 Collection: `notification_preferences`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `userId` | ObjectId | Yes | — | |
| `emailEnabled` | Boolean | Yes | `true` | Master email switch |
| `inAppEnabled` | Boolean | Yes | `true` | |
| `preferences` | Object | Yes | `{}` | Per-type toggles |
| `preferences.analysis_complete` | Boolean | No | `true` | |
| `preferences.analysis_failed` | Boolean | No | `true` | |
| `preferences.high_risk` | Boolean | No | `true` | |
| `preferences.mention` | Boolean | No | `true` | |
| `preferences.member_invited` | Boolean | No | `true` | |
| `updatedAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_notification_prefs_tenantId_userId_unique` | `{ tenantId: 1, userId: 1 }` | unique |

**Validation Rules:**
- One document per (tenantId, userId)
- **Validator:** Yes

---

### 5.6 Collection: `outbox_events`

Same schema as [§4.6](#46-collection-outbox_events).

---

## 6. Database: contractiq_contract

**Service:** contract-service  
**Purpose:** Contract metadata, versions, collaboration

---

### 6.1 Collection: `contracts`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | FK → organizations._id |
| `title` | String | Yes | — | Max 500 |
| `counterparty` | String | Yes | — | Max 300 |
| `contractType` | String | Yes | — | ContractType enum |
| `status` | String | Yes | `uploading` | ContractStatus |
| `currentVersionId` | ObjectId | No | `null` | FK → contract_versions._id |
| `currentAnalysisId` | ObjectId | No | `null` | Denormalized; FK → ai analyses |
| `riskScore` | Number | No | `null` | 0–100; from AI event |
| `riskLevel` | String | No | `null` | RiskLevel enum |
| `keyDates` | Array\<Object\> | No | `[]` | See embedded |
| `keyDates[].label` | String | Yes | — | e.g. "Renewal Date" |
| `keyDates[].date` | Date | Yes | — | |
| `keyDates[].sourceClauseId` | ObjectId | No | — | FK → clauses (ai DB) |
| `effectiveDate` | Date | No | `null` | User-provided metadata |
| `expirationDate` | Date | No | `null` | |
| `tags` | Array\<String\> | No | `[]` | Max 20 tags; each max 50 chars |
| `createdBy` | ObjectId | Yes | — | FK → users._id |
| `updatedBy` | ObjectId | No | — | |
| `schemaVersion` | Number | Yes | `1` | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |
| `deletedAt` | Date | No | `null` | Soft delete |

**Relationships:**
- 1:N → `contract_versions`, `comments`
- Denormalizes `riskScore`, `riskLevel`, `keyDates` from AI on `contract.analysis.completed`

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_contracts_tenantId_id` | `{ tenantId: 1, _id: 1 }` | |
| `idx_contracts_tenantId_status` | `{ tenantId: 1, status: 1, createdAt: -1 }` | |
| `idx_contracts_tenantId_riskLevel` | `{ tenantId: 1, riskLevel: 1, updatedAt: -1 }` | |
| `idx_contracts_tenantId_contractType` | `{ tenantId: 1, contractType: 1 }` | |
| `idx_contracts_tenantId_createdBy` | `{ tenantId: 1, createdBy: 1 }` | |
| `idx_contracts_tenantId_createdAt` | `{ tenantId: 1, createdAt: -1 }` | |
| `idx_contracts_tenantId_updatedAt` | `{ tenantId: 1, updatedAt: -1 }` | |
| `idx_contracts_tenantId_text` | `{ title: "text", counterparty: "text", tags: "text" }` | Atlas Search preferred |
| `idx_contracts_tenantId_deletedAt` | `{ tenantId: 1, deletedAt: 1 }` | partial: `{ deletedAt: null }` |

**Validation Rules:**
- `title`: min 1; max 500; trim
- `counterparty`: min 1; max 300
- `contractType`: enum ContractType values
- `status`: enum ContractStatus values
- `riskScore`: integer or null; range 0–100 when set
- `riskLevel`: enum `low`, `medium`, `high` or null
- `tags`: max 20 items; each lowercase trimmed
- `status` transitions: uploading → processing → analyzed|failed; any → deleted
- Cannot set `analyzed` without `currentVersionId` (application rule)
- **Validator:** Yes

---

### 6.2 Collection: `contract_versions`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `contractId` | ObjectId | Yes | — | FK → contracts._id |
| `versionNumber` | Number | Yes | — | Starts at 1; increments |
| `fileName` | String | Yes | — | Original filename |
| `fileSize` | Number | Yes | — | Bytes |
| `mimeType` | String | Yes | — | `application/pdf` \| DOCX types |
| `storageKey` | String | Yes | — | S3 object key |
| `checksum` | String | No | — | SHA-256 hex |
| `extractedText` | String | No | — | Large; consider GridFS Phase 2 |
| `extractedTextLength` | Number | No | — | Denormalized char count |
| `pageCount` | Number | No | — | |
| `ingestionStatus` | String | Yes | `pending` | `pending` \| `completed` \| `failed` |
| `ocrUsed` | Boolean | No | `false` | |
| `uploadedBy` | ObjectId | Yes | — | |
| `uploadedAt` | Date | Yes | now | |
| `schemaVersion` | Number | Yes | `1` | |
| `createdAt` | Date | Yes | now | |

**Relationships:**
- `contractId` → `contracts._id`
- Unique `(contractId, versionNumber)`

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_versions_contractId_versionNumber_unique` | `{ contractId: 1, versionNumber: 1 }` | unique |
| `idx_versions_tenantId_contractId` | `{ tenantId: 1, contractId: 1, uploadedAt: -1 }` | |
| `idx_versions_storageKey_unique` | `{ storageKey: 1 }` | unique |

**Validation Rules:**
- `versionNumber`: positive integer
- `fileSize`: 1–52,428,800 (50 MB)
- `mimeType`: whitelist `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `storageKey`: must match pattern `tenants/{tenantId}/contracts/{contractId}/{_id}/...`
- `checksum`: 64-char hex when present
- **Validator:** Yes

---

### 6.3 Collection: `comments`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `contractId` | ObjectId | Yes | — | FK → contracts._id |
| `clauseId` | ObjectId | No | `null` | FK → ai clauses (cross-DB) |
| `userId` | ObjectId | Yes | — | Author |
| `body` | String | Yes | — | Max 5000 chars |
| `mentions` | Array\<ObjectId\> | No | `[]` | Phase 2 |
| `parentCommentId` | ObjectId | No | `null` | Threading Phase 2 |
| `isEdited` | Boolean | Yes | `false` | |
| `schemaVersion` | Number | Yes | `1` | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |
| `deletedAt` | Date | No | `null` | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_comments_tenantId_contractId` | `{ tenantId: 1, contractId: 1, createdAt: -1 }` | |
| `idx_comments_tenantId_clauseId` | `{ tenantId: 1, clauseId: 1 }` | sparse |
| `idx_comments_userId` | `{ userId: 1 }` | |

**Validation Rules:**
- `body`: min 1 after trim; max 5000
- `contractId` must belong to same `tenantId`
- `mentions`: max 20 user IDs
- **Validator:** Yes

---

### 6.4 Collection: `outbox_events`

Same schema as [§4.6](#46-collection-outbox_events).

---

## 7. Database: contractiq_ai

**Service:** ai-service  
**Purpose:** Analysis results, clauses, embeddings, Q&A, usage tracking

---

### 7.1 Collection: `analyses`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `contractId` | ObjectId | Yes | — | Logical FK |
| `versionId` | ObjectId | Yes | — | Logical FK |
| `status` | String | Yes | `pending` | AnalysisStatus |
| `progress` | Number | No | `0` | 0–100 |
| `stage` | String | No | — | Pipeline stage label |
| `summary` | String | No | — | Max 5000 chars |
| `riskScore` | Number | No | — | 0–100 |
| `riskLevel` | String | No | — | RiskLevel |
| `riskFactors` | Array\<Object\> | No | `[]` | |
| `riskFactors[].factor` | String | Yes | — | |
| `riskFactors[].weight` | Number | Yes | — | 0–1 |
| `riskFactors[].score` | Number | Yes | — | 0–100 |
| `riskFactors[].explanation` | String | Yes | — | |
| `keyDates` | Array\<Object\> | No | `[]` | Same shape as contracts.keyDates |
| `modelUsed` | String | No | — | e.g. `gpt-4o` |
| `promptHash` | String | No | — | SHA-256 of system prompt |
| `tokensUsed` | Number | No | — | Total tokens |
| `processingTimeMs` | Number | No | — | |
| `retryCount` | Number | Yes | `0` | Max 3 |
| `errorCode` | String | No | — | |
| `errorMessage` | String | No | — | Max 1000 |
| `startedAt` | Date | No | — | |
| `completedAt` | Date | No | — | |
| `schemaVersion` | Number | Yes | `1` | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |

**Relationships:**
- One active analysis per `(contractId, versionId)` recommended (application)
- 1:N → `clauses` (same versionId)

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_analyses_tenantId_contractId` | `{ tenantId: 1, contractId: 1, createdAt: -1 }` | |
| `idx_analyses_versionId` | `{ versionId: 1 }` | |
| `idx_analyses_tenantId_status` | `{ tenantId: 1, status: 1 }` | |
| `idx_analyses_contractId_versionId_unique` | `{ contractId: 1, versionId: 1 }` | unique partial: active statuses |

**Validation Rules:**
- `status`: enum AnalysisStatus
- `riskScore`: 0–100 when present
- `progress`: 0–100
- `retryCount`: 0–3
- `summary`: max 5000 when completed
- **Validator:** Yes

---

### 7.2 Collection: `clauses`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `contractId` | ObjectId | Yes | — | |
| `versionId` | ObjectId | Yes | — | |
| `analysisId` | ObjectId | Yes | — | FK → analyses._id |
| `clauseType` | String | Yes | — | ClauseType enum |
| `title` | String | No | — | Max 300 |
| `text` | String | Yes | — | Full clause text |
| `startOffset` | Number | Yes | — | Char offset in extractedText |
| `endOffset` | Number | Yes | — | |
| `pageNumber` | Number | No | — | 1-based |
| `riskLevel` | String | Yes | — | RiskLevel |
| `riskNote` | String | No | — | Max 2000 |
| `playbookDeviation` | Boolean | Yes | `false` | Phase 2 |
| `playbookDeviationDetail` | Object | No | — | `{ ruleId, severity, suggestion }` |
| `orderIndex` | Number | Yes | — | Display order 0..n |
| `schemaVersion` | Number | Yes | `1` | |
| `createdAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_clauses_tenantId_contractId` | `{ tenantId: 1, contractId: 1, orderIndex: 1 }` | |
| `idx_clauses_versionId` | `{ versionId: 1, orderIndex: 1 }` | |
| `idx_clauses_tenantId_clauseType` | `{ tenantId: 1, clauseType: 1 }` | |
| `idx_clauses_tenantId_riskLevel` | `{ tenantId: 1, riskLevel: 1 }` | |
| `idx_clauses_analysisId` | `{ analysisId: 1 }` | |

**Validation Rules:**
- `clauseType`: enum ClauseType values
- `startOffset` < `endOffset`; both ≥ 0
- `text`: min 1; max 100,000
- `orderIndex`: non-negative integer
- `riskLevel`: enum RiskLevel
- **Validator:** Yes

---

### 7.3 Collection: `embedding_chunks`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `contractId` | ObjectId | Yes | — | |
| `versionId` | ObjectId | Yes | — | |
| `chunkIndex` | Number | Yes | — | 0-based sequence |
| `text` | String | Yes | — | Chunk content |
| `tokenCount` | Number | No | — | |
| `embedding` | Array\<Number\> | Yes | — | 1536 dimensions (text-embedding-3-small) |
| `embeddingModel` | String | Yes | — | Model identifier |
| `metadata` | Object | No | `{}` | |
| `metadata.pageNumber` | Number | No | — | |
| `metadata.clauseId` | ObjectId | No | — | |
| `metadata.startOffset` | Number | No | — | |
| `createdAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_embedding_tenantId_contractId` | `{ tenantId: 1, contractId: 1, chunkIndex: 1 }` | |
| `idx_embedding_versionId_chunkIndex_unique` | `{ versionId: 1, chunkIndex: 1 }` | unique |
| `idx_embedding_vector` | `{ embedding: "vector" }` | Atlas Vector Search index: `vector_index_chunks` |

**Vector Index Definition (Atlas):**
- Field: `embedding`
- Dimensions: 1536
- Similarity: cosine
- Filter fields: `tenantId`, `contractId`

**Validation Rules:**
- `embedding`: array length exactly 1536
- `chunkIndex`: non-negative integer
- `text`: max 4000 chars
- Unique chunk per version
- **Validator:** Yes

---

### 7.4 Collection: `qa_sessions`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `contractId` | ObjectId | Yes | — | |
| `userId` | ObjectId | Yes | — | |
| `title` | String | No | — | Auto from first question |
| `messageCount` | Number | Yes | `0` | |
| `schemaVersion` | Number | Yes | `1` | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_qa_sessions_tenantId_contractId_userId` | `{ tenantId: 1, contractId: 1, userId: 1, updatedAt: -1 }` | |
| `idx_qa_sessions_createdAt_ttl` | `{ createdAt: 1 }` | TTL: 90 days |

**Validation Rules:**
- **Validator:** Yes

---

### 7.5 Collection: `qa_messages`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `sessionId` | ObjectId | Yes | — | FK → qa_sessions._id |
| `contractId` | ObjectId | Yes | — | Denormalized |
| `role` | String | Yes | — | `user` \| `assistant` |
| `content` | String | Yes | — | |
| `citations` | Array\<Object\> | No | `[]` | |
| `citations[].clauseId` | ObjectId | Yes | — | |
| `citations[].excerpt` | String | Yes | — | |
| `citations[].pageNumber` | Number | No | — | |
| `confidence` | String | No | — | `low` \| `medium` \| `high` |
| `tokensUsed` | Number | No | — | |
| `promptHash` | String | No | — | |
| `createdAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_qa_messages_sessionId` | `{ sessionId: 1, createdAt: 1 }` | |
| `idx_qa_messages_tenantId_contractId` | `{ tenantId: 1, contractId: 1 }` | |

**Validation Rules:**
- `role`: enum `user`, `assistant`
- `content`: max 10000
- **Validator:** Yes

---

### 7.6 Collection: `ai_usage_logs` (append-only)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `userId` | ObjectId | No | — | |
| `contractId` | ObjectId | No | — | |
| `operation` | String | Yes | — | `analysis` \| `qa` \| `embedding` \| `comparison` |
| `modelUsed` | String | Yes | — | |
| `promptHash` | String | Yes | — | SHA-256; no raw prompt |
| `inputTokens` | Number | Yes | — | |
| `outputTokens` | Number | Yes | — | |
| `totalTokens` | Number | Yes | — | |
| `durationMs` | Number | Yes | — | |
| `correlationId` | String | No | — | |
| `timestamp` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_ai_usage_tenantId_timestamp` | `{ tenantId: 1, timestamp: -1 }` | |
| `idx_ai_usage_timestamp_ttl` | `{ timestamp: 1 }` | TTL: 90 days |

**Validation Rules:**
- Immutable: no updates or deletes (application enforced)
- **Validator:** Yes

---

### 7.7 Collection: `outbox_events`

Same schema as [§4.6](#46-collection-outbox_events).

---

## 8. Database: contractiq_search

**Service:** search-service  
**Purpose:** Denormalized search documents (Atlas Search or Elasticsearch sync)

---

### 8.1 Collection: `search_documents`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `contractId` | ObjectId | Yes | — | Unique per tenant |
| `title` | String | Yes | — | Denormalized |
| `counterparty` | String | Yes | — | |
| `contractType` | String | Yes | — | |
| `status` | String | Yes | — | |
| `riskLevel` | String | No | — | |
| `riskScore` | Number | No | — | |
| `tags` | Array\<String\> | No | `[]` | |
| `summaryPreview` | String | No | — | First 500 chars of analysis |
| `extractedTextPreview` | String | No | — | First 2000 chars |
| `clauseTypes` | Array\<String\> | No | `[]` | Distinct clause types present |
| `effectiveDate` | Date | No | — | |
| `expirationDate` | Date | No | — | |
| `indexedAt` | Date | Yes | now | |
| `sourceUpdatedAt` | Date | Yes | — | From contract.updatedAt |
| `schemaVersion` | Number | Yes | `1` | |

**Relationships:**
- `contractId` mirrors `contractiq_contract.contracts`
- Updated on `contract.analysis.completed`, deleted on `contract.deleted`

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_search_tenantId_contractId_unique` | `{ tenantId: 1, contractId: 1 }` | unique |
| `idx_search_tenantId_riskLevel` | `{ tenantId: 1, riskLevel: 1, indexedAt: -1 }` | |
| `idx_search_tenantId_contractType` | `{ tenantId: 1, contractType: 1 }` | |
| `idx_search_atlas` | Atlas Search index `search_index_contracts` on title, counterparty, summaryPreview, extractedTextPreview, tags | |

**Atlas Search Index Fields:**
- `title`, `counterparty`: autocomplete + text
- `summaryPreview`, `extractedTextPreview`: text
- `tags`: token
- Facets: `riskLevel`, `contractType`, `status`

**Validation Rules:**
- `contractId`: unique per tenant
- **Validator:** Yes

---

## 9. Database: contractiq_notification

**Service:** notification-service  
**Purpose:** In-app notifications and reliable email delivery

---

### 9.1 Collection: `notifications`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `userId` | ObjectId | Yes | — | Recipient |
| `type` | String | Yes | — | NotificationType |
| `title` | String | Yes | — | Max 200 |
| `body` | String | Yes | — | Max 1000 |
| `resourceType` | String | Yes | — | `contract` \| `member` \| `task` |
| `resourceId` | ObjectId | Yes | — | |
| `read` | Boolean | Yes | `false` | |
| `readAt` | Date | No | — | |
| `metadata` | Object | No | `{}` | Extra context |
| `createdAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_notifications_tenantId_userId_createdAt` | `{ tenantId: 1, userId: 1, createdAt: -1 }` | |
| `idx_notifications_tenantId_userId_read` | `{ tenantId: 1, userId: 1, read: 1 }` | |
| `idx_notifications_read_ttl` | `{ readAt: 1 }` | TTL: 180 days; partial `{ read: true }` |
| `idx_notifications_unread_ttl` | `{ createdAt: 1 }` | TTL: 365 days; partial `{ read: false }` |

**Validation Rules:**
- `type`: enum NotificationType
- `title`, `body`: non-empty after trim
- **Validator:** Yes

---

### 9.2 Collection: `email_outbox`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | No | — | |
| `to` | String | Yes | — | Recipient email |
| `templateId` | String | Yes | — | e.g. `analysis_complete` |
| `templateData` | Object | Yes | `{}` | Variables |
| `subject` | String | Yes | — | Rendered or static |
| `status` | String | Yes | `pending` | `pending` \| `sent` \| `failed` |
| `attempts` | Number | Yes | `0` | |
| `lastError` | String | No | — | |
| `sentAt` | Date | No | — | |
| `scheduledAt` | Date | No | now | |
| `createdAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_email_outbox_status_scheduledAt` | `{ status: 1, scheduledAt: 1 }` | |
| `idx_email_outbox_createdAt_ttl` | `{ createdAt: 1 }` | TTL: 30 days for sent |

**Validation Rules:**
- `to`: valid email
- `status`: enum `pending`, `sent`, `failed`
- `attempts`: max 5
- **Validator:** Yes

---

### 9.3 Collection: `email_templates`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `templateId` | String | Yes | — | Unique slug |
| `subject` | String | Yes | — | Handlebars template |
| `htmlBody` | String | Yes | — | |
| `textBody` | String | No | — | |
| `version` | Number | Yes | `1` | |
| `active` | Boolean | Yes | `true` | |
| `updatedAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_email_templates_templateId_unique` | `{ templateId: 1 }` | unique |

**Validation Rules:**
- System-seeded templates; admin updates only
- **Validator:** Yes

---

### 9.4 Collection: `outbox_events`

Same schema as [§4.6](#46-collection-outbox_events).

---

## 10. Database: contractiq_audit

**Service:** audit-service  
**Purpose:** Immutable compliance and security audit trail

---

### 10.1 Collection: `audit_logs` (append-only)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | No | — | Null for platform-level events |
| `userId` | ObjectId | No | — | Null for system actions |
| `actorType` | String | Yes | — | `user` \| `system` \| `service` |
| `serviceName` | String | No | — | Originating microservice |
| `action` | String | Yes | — | e.g. `contract.upload` |
| `resourceType` | String | Yes | — | `contract` \| `user` \| `member` |
| `resourceId` | ObjectId | No | — | |
| `outcome` | String | Yes | `success` | `success` \| `failure` |
| `metadata` | Object | No | `{}` | |
| `metadata.ipAddress` | String | No | — | |
| `metadata.userAgent` | String | No | — | |
| `metadata.changes` | Object | No | — | Before/after diff |
| `metadata.eventId` | String | No | — | Correlation to RabbitMQ |
| `correlationId` | String | No | — | Request trace ID |
| `timestamp` | Date | Yes | now | Event time |

**Relationships:**
- Logical references only; no FK enforcement
- Consumes all domain events via `audit.record` or dedicated consumer

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_audit_tenantId_timestamp` | `{ tenantId: 1, timestamp: -1 }` | |
| `idx_audit_tenantId_action` | `{ tenantId: 1, action: 1, timestamp: -1 }` | |
| `idx_audit_tenantId_userId` | `{ tenantId: 1, userId: 1, timestamp: -1 }` | |
| `idx_audit_resource` | `{ tenantId: 1, resourceType: 1, resourceId: 1, timestamp: -1 }` | |
| `idx_audit_correlationId` | `{ correlationId: 1 }` | sparse |
| `idx_audit_timestamp_ttl` | `{ timestamp: 1 }` | TTL: per-tenant `retentionDays` (default 2555 days ≈ 7 years) |

**Validation Rules:**
- **No updates or deletes** — collection is append-only
- `action`: max 100 chars; lowercase dot notation
- `timestamp`: immutable
- `actorType`: enum `user`, `system`, `service`
- **Validator:** Yes

---

## 11. Database: contractiq_billing (Phase 2)

**Service:** billing-service

---

### 11.1 Collection: `subscriptions`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | Unique |
| `plan` | String | Yes | — | PlanTier |
| `status` | String | Yes | — | SubscriptionStatus |
| `stripeCustomerId` | String | Yes | — | |
| `stripeSubscriptionId` | String | No | — | |
| `currentPeriodStart` | Date | Yes | — | |
| `currentPeriodEnd` | Date | Yes | — | |
| `cancelAtPeriodEnd` | Boolean | Yes | `false` | |
| `usage` | Object | Yes | `{}` | |
| `usage.contractsThisMonth` | Number | Yes | `0` | |
| `usage.aiTokensUsed` | Number | Yes | `0` | |
| `usage.seatsUsed` | Number | Yes | `0` | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_subscriptions_tenantId_unique` | `{ tenantId: 1 }` | unique |
| `idx_subscriptions_stripeCustomerId` | `{ stripeCustomerId: 1 }` | unique |

**Validation Rules:**
- One subscription per tenant
- **Validator:** Yes

---

### 11.2 Collection: `usage_counters`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `period` | String | Yes | — | `YYYY-MM` |
| `metric` | String | Yes | — | `contracts` \| `ai_tokens` \| `qa_requests` |
| `count` | Number | Yes | `0` | |
| `updatedAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_usage_tenantId_period_metric_unique` | `{ tenantId: 1, period: 1, metric: 1 }` | unique |

---

### 11.3 Collection: `stripe_events` (append-only)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | |
| `stripeEventId` | String | Yes | Unique Stripe event ID |
| `type` | String | Yes | e.g. `invoice.paid` |
| `payload` | Object | Yes | Raw webhook body |
| `processedAt` | Date | Yes | |
| `createdAt` | Date | Yes | |

**Indexes:** `stripeEventId` unique

---

### 11.4 Collection: `api_keys`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | |
| `tenantId` | ObjectId | Yes | |
| `name` | String | Yes | User label |
| `keyPrefix` | String | Yes | First 8 chars for display |
| `keyHash` | String | Yes | SHA-256 of full key |
| `scopes` | Array\<String\> | Yes | `contracts:read`, `contracts:write` |
| `createdBy` | ObjectId | Yes | |
| `lastUsedAt` | Date | No | |
| `revokedAt` | Date | No | |
| `expiresAt` | Date | No | |
| `createdAt` | Date | Yes | |

**Indexes:** `{ keyHash: 1 }` unique; `{ tenantId: 1, revokedAt: 1 }`

---

## 12. Database: contractiq_playbook (Phase 2)

**Service:** playbook-service

---

### 12.1 Collection: `playbooks`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | auto | |
| `tenantId` | ObjectId | Yes | — | |
| `name` | String | Yes | — | Max 200 |
| `description` | String | No | — | |
| `isDefault` | Boolean | Yes | `false` | One default per tenant |
| `status` | String | Yes | `active` | `active` \| `archived` |
| `createdBy` | ObjectId | Yes | — | |
| `schemaVersion` | Number | Yes | `1` | |
| `createdAt` | Date | Yes | now | |
| `updatedAt` | Date | Yes | now | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_playbooks_tenantId` | `{ tenantId: 1, status: 1 }` | |
| `idx_playbooks_tenantId_isDefault` | `{ tenantId: 1, isDefault: 1 }` | partial: `{ isDefault: true }`, unique |

**Validation Rules:**
- Only one `isDefault: true` per tenant
- **Validator:** Yes

---

### 12.2 Collection: `clause_rules`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | |
| `tenantId` | ObjectId | Yes | |
| `playbookId` | ObjectId | Yes | FK → playbooks._id |
| `clauseType` | String | Yes | ClauseType enum |
| `standardText` | String | Yes | Reference language |
| `severity` | String | Yes | `low` \| `medium` \| `high` |
| `fallbackText` | String | No | Suggested replacement |
| `embedding` | Array\<Number\> | No | For similarity match |
| `orderIndex` | Number | Yes | |
| `createdAt` | Date | Yes | |
| `updatedAt` | Date | Yes | |

**Indexes:**

| Name | Keys | Options |
|------|------|---------|
| `idx_clause_rules_playbookId` | `{ playbookId: 1, orderIndex: 1 }` | |
| `idx_clause_rules_tenantId_clauseType` | `{ tenantId: 1, clauseType: 1 }` | |

**Validation Rules:**
- `standardText`: min 10; max 50,000
- **Validator:** Yes

---

## 13. Cross-Database Reference Map

| Source Collection | Field | Target Database.Collection | Enforcement |
|-------------------|-------|------------------------------|-------------|
| memberships.userId | userId | contractiq_auth.users | Event + API |
| memberships.tenantId | tenantId | contractiq_user.organizations | Same DB |
| contracts.tenantId | tenantId | contractiq_user.organizations | API on create |
| contracts.createdBy | createdBy | contractiq_auth.users | JWT sub |
| contract_versions.contractId | contractId | contractiq_contract.contracts | Same DB |
| analyses.contractId | contractId | contractiq_contract.contracts | Event payload |
| analyses.versionId | versionId | contractiq_contract.contract_versions | Event payload |
| clauses.analysisId | analysisId | contractiq_ai.analyses | Same DB |
| comments.clauseId | clauseId | contractiq_ai.clauses | API validate |
| search_documents.contractId | contractId | contractiq_contract.contracts | Event sync |
| notifications.userId | userId | contractiq_auth.users | API |
| subscriptions.tenantId | tenantId | contractiq_user.organizations | API |

**No foreign key constraints across databases** — referential integrity is eventual via events and synchronous validation at write time where critical.

---

## 14. Sharding & Growth Strategy

### 14.1 Shard Key Candidates (Future)

| Collection | Shard Key | Rationale |
|------------|-----------|-----------|
| contracts | `{ tenantId: 1, _id: 1 }` | Tenant-locality |
| audit_logs | `{ tenantId: 1, timestamp: 1 }` | Tenant audit queries |
| embedding_chunks | `{ tenantId: 1, contractId: 1 }` | Large volume per tenant |

### 14.2 Collection Size Estimates (Year 1, 500 tenants)

| Collection | Est. Documents | Avg Doc Size |
|------------|----------------|--------------|
| contracts | 250,000 | 2 KB |
| contract_versions | 300,000 | 5 KB (+ text externalized) |
| clauses | 5,000,000 | 3 KB |
| embedding_chunks | 10,000,000 | 8 KB |
| audit_logs | 50,000,000 | 1 KB |
| notifications | 2,000,000 | 0.5 KB |

### 14.3 Archival

| Collection | Strategy |
|------------|----------|
| contracts (deleted) | Move to `contracts_archive` after 30 days |
| extractedText | GridFS or S3 after 90 days |
| audit_logs | TTL + cold storage export |

---

## 15. Migration & Versioning

### 15.1 Schema Version Field

All collections include `schemaVersion: 1`. Migration scripts:

1. Add new optional fields (backward compatible)
2. Backfill via batch job
3. Increment `schemaVersion`
4. Tighten validators in subsequent release

### 15.2 Migration Order (Fresh Deploy)

1. contractiq_auth  
2. contractiq_user  
3. contractiq_contract  
4. contractiq_ai  
5. contractiq_search  
6. contractiq_notification  
7. contractiq_audit  
8. contractiq_billing (Phase 2)  
9. contractiq_playbook (Phase 2)

### 15.3 Seed Data

| Database | Collection | Seeds |
|----------|------------|-------|
| notification | email_templates | 8 system templates |
| user | — | None (runtime) |
| auth | — | Super admin via env (one-time) |

---

## Appendix A: Standard Action Codes (audit_logs)

| Action | Resource Type |
|--------|---------------|
| `user.register` | user |
| `user.login` | user |
| `user.logout` | user |
| `user.password_reset` | user |
| `member.invited` | member |
| `member.joined` | member |
| `member.removed` | member |
| `contract.created` | contract |
| `contract.uploaded` | contract |
| `contract.viewed` | contract |
| `contract.updated` | contract |
| `contract.deleted` | contract |
| `analysis.started` | analysis |
| `analysis.completed` | analysis |
| `analysis.failed` | analysis |
| `qa.asked` | contract |
| `comment.created` | comment |
| `export.pdf` | contract |
| `playbook.updated` | playbook |

---

## Appendix B: Collection Summary

| Database | Collections | Phase |
|----------|-------------|-------|
| contractiq_auth | users, refresh_tokens, sessions, password_reset_tokens, oauth_accounts, outbox_events | MVP (+ OAuth Ph2) |
| contractiq_user | organizations, user_profiles, memberships, invites, notification_preferences, outbox_events | MVP |
| contractiq_contract | contracts, contract_versions, comments, outbox_events | MVP |
| contractiq_ai | analyses, clauses, embedding_chunks, qa_sessions, qa_messages, ai_usage_logs, outbox_events | MVP |
| contractiq_search | search_documents | MVP |
| contractiq_notification | notifications, email_outbox, email_templates, outbox_events | MVP |
| contractiq_audit | audit_logs | MVP |
| contractiq_billing | subscriptions, usage_counters, stripe_events, api_keys | Phase 2 |
| contractiq_playbook | playbooks, clause_rules | Phase 2 |

**Total MVP collections:** 28  
**Total Phase 2 collections:** 35

---

## Appendix C: Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-01 | Principal Architect | Initial MongoDB schema design |

---

*This schema is authoritative for ContractIQ AI data modeling. Application implementations must align field names, types, indexes, and validation rules defined herein.*
