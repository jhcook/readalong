# Agent Governance Framework

This directory contains the governance framework for the repo. It is designed to ensure strict adherence to architectural standards, compliance (SOC2/GDPR), and quality assurance through a "Governance by Code" approach.

## Core Concepts

### 1. The "Agent" CLI
The `agent` CLI (`.agent/bin/agent`) is the primary interface for this framework. It automates:
*   **Creation**: Scaffolding new Stories, ADRs, and Plans.
*   **Validation**: Checking content against schemas.
*   **Preflight**: Running heuristics (compliance, security, arch) before you commit.
*   **Governance Panel**: Simulating a multi-role review (Architect, QA, Security, Product, SRE).

### 2. Workflow
We follow a strict **Story-Driven Development** workflow:

1.  **Draft a Story**: `agent new-story` (Prompts for logical category: INFRA, WEB, MOBILE, BACKEND).
2.  **Plan (Optional)**: `agent new-plan` for complex Epics breaking down into multiple stories.
3.  **Implement**: Write code.
4.  **Document**: Update existing or create new documentation in accordance with the new code.
5.  **Preflight**: `agent preflight --story WEB-123` (Must pass before commit).
6.  **Commit**: `agent commit --story WEB-123` (Enforces commit message standards).

### 3. Directory Structure

*   `bin/`: The CLI executable.
*   `agents.yaml`: Definitions of the "Governance Panel" roles.
*   `cache/stories/`: User Stories organized by scope (`INFRA/`, `WEB/`, `MOBILE/`, `BACKEND/`).
*   `cache/plans/`: High-level plans for complex initiatives.
*   `adrs/`: Architecture Decision Records (immutable design documents).
*   `compliance/`: Checklists for SOC2, GDPR, etc.

## Usage Guide

### Setup
Ensure the CLI is executable:
```bash
chmod +x .agent/bin/agent
```
*(Optional) Add to PATH or aliased for convenience.*

### Creating Work
**Create a new Story:**
```bash
.agent/bin/agent new-story
# Select category (e.g., WEB) and enter ID (e.g., 001) -> Creates .agent/cache/stories/WEB/WEB-001.md
```

**Create a new Plan (for specific large features):**
```bash
./.agent/bin/agent new-plan INFRA-001
```

**Create an ADR (Architecture Decision Record):**
```bash
./.agent/bin/agent new-adr ADR-005
```

### Validation & Review
**Run Preflight Checks (REQUIRED before commit):**
```bash
git add .
./.agent/bin/agent preflight --story WEB-001-qa-setup
```
*This command runs:*
*   **Schema Check**: Is the Story valid?
*   **Arch Check**: Are you importing backend code in frontend?
*   **Security Scan**: Are there secrets in staged files?
*   **Compliance**: Does the story flag GDPR/SOC2?
*   **Panel Review**: Simulates sign-off from virtual agents.

**Commit Changes:**
```bash
./.agent/bin/agent commit --story WEB-001-qa-setup
```
*Automatically formats the commit message with Scope, Story ID, and verified status.*

### The Governance Panel
The `preflight` command convenes a panel of virtual agents defined in `.agent/agents.yaml`.
*   **Architect**: Checks for ADR compliance.
*   **QA**: Checks for Test Strategy.
*   **Security**: Scans for secrets and PII.
*   **Product**: Validates Acceptance Criteria.
*   **SRE**: Checks for OpenTelemetry instrumentation.
*   **Tech Writer**: Ensures matching documentation updates.

## Best Practices
*   **Monorepo Scoping**: Stories are now scoped (e.g., `WEB-xxx`, `MOBILE-xxx`). Use the correct prefix.
*   **Documentation**: If you change logic, you *must* update docs (README, ADRs), or the Tech Writer agent will complain.
*   **Compliance**: If your Story description mentions "GDPR" or "PII", the Security agent will strictly enforce checklist review.
