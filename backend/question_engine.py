from __future__ import annotations

import random
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any


def role_family(role: str) -> str:
    value = role.casefold()
    if any(word in value for word in ("devops", "platform", "site reliability", "sre", "infrastructure", "cloud engineer")):
        return "devops"
    if any(word in value for word in ("frontend", "front-end", "ui engineer", "web engineer")):
        return "frontend"
    if any(word in value for word in ("quality", "qa", "test engineer", "test automation")):
        return "quality"
    if any(word in value for word in ("architect", "cloud architect", "solutions architect")):
        return "architecture"
    if any(word in value for word in ("application", "backend", "back-end", "software", "api engineer")):
        return "backend"
    return "general"


def _item(
    question_id: str,
    *values: Any,
    difficulty: str = "Intermediate",
    options: dict[str, str] | None = None,
    correct: str | None = None,
    explanation: str = "",
    tags: tuple[str, ...] = (),
) -> dict[str, Any]:
    if values[0] in {"devops", "backend", "frontend", "quality", "architecture", "general"}:
        role, text, focus, category, question_type, concept, scenario, expected, criteria = values
    else:
        role = question_id.split("-", 1)[0]
        text, focus, category, question_type, concept, scenario, expected, criteria = values
    return {
        "question_id": question_id,
        "question": text,
        "role_family": role,
        "experience_level": "adaptive",
        "interview_category": category,
        "focus_area": focus,
        "difficulty": difficulty,
        "question_type": question_type,
        "format": "multiple_choice" if options else "open_ended",
        "concept_id": concept,
        "scenario_id": scenario,
        "follow_up_to_question_id": "",
        "expected_answer": expected,
        "explanation": explanation or expected,
        "evaluation_criteria": criteria,
        "tags": list(tags),
        "source": "curated_question_bank",
        "options": options or {},
        "correct_option": correct or "",
    }


QUESTION_BANK: list[dict[str, Any]] = [
    _item("devops-k8s-pending", "devops", "A newly deployed Kubernetes workload has several pods stuck in Pending. The cluster has healthy nodes, but the rollout is blocked. Walk me through the evidence you would gather and the order you would investigate it.", "Problem solving", "Technical", "Troubleshooting", "kubernetes-scheduling", "scheduler-pending-capacity", "Inspect pod events and scheduler messages, then check requests versus allocatable CPU/memory, taints, affinity, quotas, and storage constraints. Make one change at a time and verify scheduling.", ["Uses pod events and scheduler evidence", "Checks resource requests and constraints", "Describes a safe verification step"], tags=("kubernetes", "scheduling", "capacity")),
    _item("devops-dns-failure", "devops", "A service is reachable by IP from one subnet but fails by hostname from another. What checks would distinguish a DNS problem from routing, firewall, or application failure?", "Problem solving", "Technical", "Troubleshooting", "dns-resolution-path", "split-network-dns", "Compare resolver configuration and lookup results from both subnets, inspect authoritative and recursive DNS responses, then test routes and ports separately. Use TTL and recent record changes as evidence.", ["Tests name resolution from both locations", "Separates DNS from transport and application checks", "Considers resolver, records, and recent changes"], tags=("dns", "networking", "linux")),
    _item("devops-deploy-rollback", "A canary deployment increases p95 latency and error rate, while CPU remains normal. The release changed both application code and a database query. How do you contain impact and identify the regression?", "Reliability", "Situational", "Scenario", "canary-regression-triage", "canary-latency-query-regression", "Pause or roll back the canary using agreed health thresholds, compare traces and query plans across versions, check dependency saturation, and communicate impact. Reintroduce the change only after a measured fix.", ["Contains customer impact first", "Uses traces and query evidence to isolate the change", "Defines a measurable recovery check"], tags=("incident", "release", "latency")),
    _item("devops-iac-drift", "A Terraform plan proposes replacing a production database after an engineer reports manual changes. What do you verify before applying any plan, and how do you prevent this class of drift?", "Security & reliability", "Technical", "Decision making", "terraform-drift-review", "production-iac-drift", "Confirm workspace, state, provider, imports, and the exact diff; protect backups and data retention; reconcile out-of-band changes in a reviewed plan. Add policy checks and limit manual production changes.", ["Verifies state and exact destructive diff", "Protects data and recovery options", "Proposes a drift-prevention control"], tags=("terraform", "infrastructure-as-code", "state")),
    _item("devops-ci-secret", "A CI job can deploy successfully only when a long-lived cloud administrator key is added to the repository's shared variables. How would you replace that credential without interrupting deployments?", "Security & reliability", "Situational", "Scenario", "ci-workload-identity", "pipeline-long-lived-credential", "Use short-lived workload identity/OIDC with a least-privilege role, test it in a restricted pipeline, rotate and revoke the old key, and audit access. Never put credentials in source or logs.", ["Uses short-lived identity", "Applies least privilege and tests migration", "Rotates and audits the old secret safely"], tags=("secrets", "iam", "ci-cd")),
    _item("devops-observability-gap", "After a logging-agent upgrade, application logs disappear from the central platform, but node metrics still arrive. What signals would you compare to locate the break in the telemetry path?", "Observability", "Technical", "Troubleshooting", "telemetry-pipeline", "logging-agent-upgrade", "Check agent health and version, local input files and permissions, parser/queue errors, network delivery, and ingestion limits. Compare a known test event at each hop and preserve local logs during recovery.", ["Checks each stage of the telemetry path", "Uses a known event to isolate the failure", "Preserves evidence and local logs"], tags=("logging", "monitoring", "agents")),
    _item("devops-capacity-tradeoff", "Traffic is expected to triple for a short launch window. The service is already close to its database connection limit, and adding replicas raises cloud cost. What would you measure and change before the event?", "Reliability", "System design", "System design", "load-scaling-connection-pool", "launch-traffic-capacity", "Load-test representative traffic, measure pool wait and query latency, cap per-instance pools, validate database headroom, and scale in stages. Define cost limits and rollback/traffic-shed triggers.", ["Measures database and pool saturation", "Addresses connection multiplication", "Balances cost, staged scale, and fallback"], tags=("capacity", "cloud-cost", "load-testing")),
    _item("devops-linux-disk", "A Linux host is alerting on disk pressure, but `df` shows less usage than the monitoring alert. What commands and hypotheses would you use before deleting anything?", "Problem solving", "Technical", "Troubleshooting", "linux-disk-accounting", "deleted-open-files", "Compare filesystem and inode usage, inspect mount namespaces and directory usage, and look for deleted files still held open by processes. Identify the owner and service impact before safely rotating or restarting anything.", ["Checks blocks, inodes, and mount context", "Considers deleted-but-open files", "Avoids unsafe deletion"], tags=("linux", "filesystems", "troubleshooting")),
    _item("backend-api-latency", "An API's p95 latency doubled after traffic grew, but average latency barely changed. Explain how you would identify whether the bottleneck is the database, an external dependency, or application contention.", "Problem solving", "Technical", "Troubleshooting", "tail-latency-tracing", "api-p95-regression", "Segment latency by route and dependency, inspect distributed traces and queue/pool waits, compare slow-query plans, and correlate with traffic and saturation. Test a targeted change against p95 and error rate.", ["Distinguishes tail from average latency", "Uses traces and saturation evidence", "Validates a targeted intervention"], tags=("api", "performance", "tracing")),
    _item("backend-idempotency", "A client retries a payment request after a timeout, and the first request may already have committed. What API and persistence guarantees would prevent a duplicate charge?", "Reliability", "Technical", "Multiple choice", "idempotent-payment-write", "payment-timeout-retry", "Use an idempotency key scoped to the caller/request, persist its result atomically with the operation, and return the original outcome for safe retries.", ["Explains a stable idempotency key", "Stores the result atomically", "Handles repeated requests consistently"], options={"A": "Increase the client timeout so it never retries", "B": "Use an idempotency key and atomically store the operation result", "C": "Ignore requests received within one second", "D": "Retry the database write until it returns success"}, correct="B", explanation="An idempotency key lets the server return the original result without repeating the side effect.", tags=("api", "idempotency", "payments")),
    _item("backend-db-lock", "A schema migration adds a non-null column to a large, write-heavy table and the deploy window is short. How would you plan the change to limit locks and support rollback?", "Reliability", "System design", "System design", "expand-contract-migration", "large-table-schema-change", "Use an expand/contract rollout: add a backward-compatible nullable/defaulted field, backfill in batches, deploy dual-compatible code, validate, then enforce constraints and remove old paths in a later release.", ["Uses backward-compatible staged rollout", "Plans bounded backfill and monitoring", "Preserves rollback compatibility"], tags=("database", "migration", "availability")),
    _item("backend-cache-invalidation", "A product page is served from cache, but users sometimes see stale prices after an update. What consistency requirement would you clarify, and what invalidation strategy would you choose?", "Technical depth", "Situational", "Decision making", "cache-consistency-invalidation", "stale-price-cache", "Clarify acceptable staleness and correctness requirements, then use versioned keys or event-driven invalidation with bounded TTL and a source-of-truth read path for sensitive price operations.", ["Clarifies consistency needs", "Chooses invalidation aligned with update flow", "Protects correctness-sensitive reads"], tags=("caching", "consistency", "pricing")),
    _item("backend-concurrency-stock", "Two requests attempt to reserve the final unit of inventory at nearly the same time. Describe a database-level approach that prevents overselling and how you would test it under concurrency.", "Technical depth", "Technical", "Scenario", "atomic-inventory-reservation", "concurrent-last-item", "Use an atomic conditional update or transaction with a row lock/optimistic version check so only one reservation succeeds. Run concurrent integration tests and verify invariant, conflict handling, and retry behavior.", ["Identifies atomic transaction/conditional update", "States the invariant", "Tests concurrent requests and conflict handling"], tags=("concurrency", "transactions", "inventory")),
    _item("backend-authz-boundary", "A customer reports seeing another tenant's export after an API change. What is your immediate response, and how would you find and prevent the authorization gap?", "Security & reliability", "Situational", "Scenario", "tenant-authorization-boundary", "cross-tenant-export", "Contain exposure, preserve audit evidence, notify the incident owner, and inspect object-level authorization and tenant scoping. Add negative cross-tenant tests and enforce authorization at the data access boundary.", ["Contains and escalates exposure", "Checks object-level and tenant scoping", "Adds regression tests at the boundary"], tags=("authorization", "multi-tenancy", "security")),
    _item("backend-queue-backpressure", "A downstream dependency slows down and your worker queue grows continuously. What would you inspect first, and how would you prevent retries from amplifying the incident?", "Reliability", "Technical", "Troubleshooting", "queue-backpressure-retries", "downstream-slow-queue-growth", "Compare arrival and completion rates, queue age, concurrency, and downstream latency. Bound retries with backoff/jitter and limits, apply backpressure or load shedding, and protect in-flight work.", ["Measures queue age and throughput", "Avoids retry amplification", "Provides a backpressure or load-shedding action"], tags=("queues", "reliability", "backpressure")),
    _item("frontend-interaction-lag", "A dashboard feels slow only after several filters are selected. How would you determine whether time is spent in rendering, expensive computation, or repeated network requests?", "Performance", "Technical", "Troubleshooting", "browser-render-performance", "dashboard-filter-lag", "Profile a representative interaction in browser performance tools, inspect long tasks and render counts, measure computation, and correlate the network waterfall. Optimize the measured bottleneck and check responsiveness.", ["Profiles a representative interaction", "Separates render, computation, and network work", "Re-measures after a targeted change"], tags=("browser", "rendering", "performance")),
    _item("frontend-token-refresh", "Several API calls return 401 at once because an access token expired. The app currently starts one refresh request per call. How would you prevent refresh races and preserve failed requests safely?", "Reliability", "Technical", "Decision making", "single-flight-token-refresh", "parallel-401-refresh", "Use a single-flight refresh promise, queue eligible requests once, retry only after successful refresh, and clear session state on refresh failure. Avoid replaying non-idempotent writes without an idempotency mechanism.", ["Coordinates one refresh operation", "Defines retry and failure behavior", "Protects non-idempotent requests"], tags=("authentication", "api", "concurrency")),
    _item("frontend-accessible-dialog", "A modal works with a mouse but keyboard users can tab behind it and lose their place when it closes. What behaviors should the implementation provide?", "Accessibility", "Technical", "Multiple choice", "dialog-focus-management", "modal-keyboard-navigation", "A modal should move focus inside, trap focus while open, close on the agreed keyboard action, expose dialog semantics, and restore focus to the trigger when closed.", ["Moves and contains focus", "Restores focus", "Uses accessible dialog semantics"], options={"A": "Add a visible close icon and leave tab order unchanged", "B": "Move focus into the dialog, contain it while open, and restore it on close", "C": "Disable keyboard input while the dialog is visible", "D": "Rely on users to click the backdrop to exit"}, correct="B", explanation="Focus management and semantic dialog behavior make the modal operable without a mouse.", tags=("accessibility", "keyboard", "focus")),
    _item("frontend-stale-search", "A user types quickly into a search field and an older response sometimes overwrites the newest results. How would you address the race without making the UI feel unresponsive?", "Problem solving", "Technical", "Troubleshooting", "async-search-response-order", "out-of-order-search", "Debounce where appropriate and cancel or ignore stale requests using AbortController or a monotonically increasing request identifier. Keep loading and empty states stable and test out-of-order responses.", ["Identifies out-of-order completion", "Cancels or rejects stale responses", "Considers UX and testability"], tags=("async", "api", "state-management")),
    _item("frontend-large-list", "A table with several thousand rows causes long main-thread tasks when sorting. What data would you gather, and when would you choose virtualization, a worker, or server-side sorting?", "Performance", "System design", "System design", "large-list-render-strategy", "large-table-sort", "Profile render and sort cost, payload size, and interaction requirements. Virtualize DOM work, move CPU-heavy sorting to a worker, or sort/page server-side when data volume and consistency justify it.", ["Profiles before choosing an optimization", "Distinguishes DOM from compute/network cost", "Explains trade-offs among approaches"], tags=("frontend", "performance", "architecture")),
    _item("frontend-error-boundary", "A route renders a blank screen when one optional widget fails to load. How should the UI isolate that failure while still communicating a useful recovery path?", "Reliability", "Situational", "Decision making", "component-failure-isolation", "optional-widget-failure", "Isolate the widget with an error boundary or local failure state, retain the surrounding route, provide retry or fallback content, and record diagnostic context without exposing sensitive data.", ["Limits the failure blast radius", "Provides a meaningful fallback and retry", "Captures safe diagnostic context"], tags=("frontend", "resilience", "error-handling")),
    _item("quality-flaky-test", "A test fails intermittently only in CI, and rerunning it usually passes. How would you investigate the flake and decide whether it blocks a release?", "Problem solving", "Situational", "Troubleshooting", "flaky-test-diagnosis", "ci-only-test-flake", "Capture failure artifacts and environment, identify shared state, timing, network, and ordering dependencies, reproduce with controlled repetition, and assess affected coverage/risk before quarantine or release decisions.", ["Collects reproducible artifacts and environment", "Investigates timing, state, and ordering", "Makes an explicit risk-based release decision"], tags=("testing", "ci", "reliability")),
    _item("quality-test-pyramid", "A critical checkout path has many slow end-to-end tests but few service-level checks. How would you rebalance coverage without losing confidence in cross-service behavior?", "Technical depth", "System design", "System design", "test-layer-allocation", "checkout-test-coverage", "Map risks to unit/component, contract/integration, and a small number of high-value end-to-end tests. Keep critical user journeys and service contracts covered while moving deterministic logic to faster layers.", ["Maps test layers to risk", "Preserves contract and critical journey coverage", "Addresses speed and flake cost"], tags=("testing", "test-strategy", "quality")),
    _item("quality-release-ambiguity", "A release candidate passes the suite, but a new requirement has no acceptance criteria and the affected behavior is hard to observe. What would you do before sign-off?", "Communication", "Behavioral", "Behavioral", "quality-risk-clarification", "ambiguous-release-criteria", "Clarify expected behavior with product and engineering, document risk and testability, add observable acceptance criteria, and make a transparent release recommendation based on impact.", ["Clarifies behavior with stakeholders", "Creates testable acceptance criteria", "Communicates residual risk"], tags=("communication", "release", "requirements")),
    _item("quality-contract-break", "A provider changes an optional API field to null for some customers. Consumer tests pass locally but production clients fail. How would you reproduce the issue and strengthen the test boundary?", "Problem solving", "Technical", "Troubleshooting", "contract-nullability-compatibility", "optional-api-field-null", "Capture representative payloads, compare schema and consumer assumptions, reproduce null and missing-field cases, and add provider/consumer contract tests for compatibility before deployment.", ["Distinguishes null from absent", "Reproduces with representative payloads", "Adds contract-level regression coverage"], tags=("api", "contracts", "compatibility")),
    _item("quality-risk-based", "You have one day to test a release containing a low-risk copy change and a high-risk permission change. How would you choose coverage and explain what remains untested?", "Communication", "Behavioral", "Decision making", "risk-based-test-prioritization", "limited-release-test-time", "Prioritize permission boundaries and affected flows, use targeted regression and negative tests, validate the copy change proportionately, and state residual risks and coverage transparently.", ["Prioritizes by impact and likelihood", "Targets security-sensitive negative cases", "Communicates residual test risk"], tags=("risk", "security", "test-planning")),
    _item("architecture-region-failure", "A service must remain available during a regional cloud outage, but the business cannot fund active-active operation everywhere. What availability target and recovery design would you propose?", "Reliability", "System design", "System design", "regional-disaster-recovery", "regional-outage-budget", "Clarify RTO/RPO and criticality, compare warm standby or pilot-light cost with recovery time, define data replication and failover tests, and make degraded-mode behavior explicit.", ["Elicits RTO/RPO", "Balances cost and recovery objectives", "Includes tested data/failover behavior"], tags=("cloud", "availability", "disaster-recovery")),
    _item("architecture-tenant-isolation", "A multi-tenant service is moving from shared tables to customer-specific encryption keys. What are the key isolation, rotation, and operational trade-offs you would review?", "Security & reliability", "System design", "System design", "tenant-key-isolation", "tenant-specific-key-migration", "Define key ownership and access boundaries, map data to tenant identity, plan rotation and revocation, measure KMS latency/quotas/cost, and test recovery and cross-tenant isolation.", ["Covers identity-bound access and isolation", "Plans rotation/revocation and recovery", "Considers latency, quotas, and cost"], tags=("cloud", "security", "multi-tenancy")),
    _item("architecture-cache-cost", "A read-heavy service needs lower latency, but the current cache has high memory cost and stale values have caused support incidents. How would you choose a cache boundary and freshness policy?", "Technical depth", "Technical", "Decision making", "cache-boundary-freshness", "read-heavy-cache-cost", "Measure hot-key and working-set behavior, clarify freshness per data class, cache derived/read-heavy data with bounded TTL or invalidation, and track hit rate, staleness, and cost.", ["Uses workload data to choose cache boundary", "Defines freshness per data type", "Measures staleness and operating cost"], tags=("cloud-cost", "caching", "latency")),
    _item("architecture-event-versioning", "Two teams consume the same event, and one team needs to change the schema without coordinating every deployment. What compatibility contract and rollout plan would you establish?", "Collaboration", "System design", "System design", "event-schema-evolution", "independent-event-consumers", "Use an explicit versioned schema and compatibility rules, additive-first evolution, tolerant consumers, contract tests, and staged producer/consumer rollout with deprecation telemetry.", ["Defines a compatibility contract", "Plans staged rollout and deprecation", "Accounts for independent consumer teams"], tags=("distributed-systems", "events", "collaboration")),
    _item("application-user-report", "A customer says a workflow is failing, but application logs show no errors. What questions and evidence would you gather before deciding whether this is a product, data, or infrastructure issue?", "Communication", "Situational", "Scenario", "customer-report-triage", "workflow-failure-no-logs", "Clarify user, time, workflow, expected versus actual behavior, and scope; correlate request IDs and client/server telemetry; check data state and dependency health while keeping the customer informed.", ["Asks for reproducible context", "Correlates client, request, data, and service evidence", "Communicates progress without guessing"], tags=("application-support", "diagnostics", "communication")),
    _item("application-data-reconciliation", "A scheduled integration reports success, but a subset of records is missing downstream. How would you find where records were lost and make reprocessing safe?", "Problem solving", "Technical", "Troubleshooting", "integration-reconciliation", "partial-sync-success", "Trace records with stable IDs across extract, queue, transform, and load stages; inspect checkpoints and dead-letter items; make replay idempotent and reconcile counts before and after.", ["Traces records across pipeline stages", "Checks checkpoints and dead-letter paths", "Makes replay idempotent and verifies reconciliation"], tags=("integration", "data", "reliability")),
    _item("application-dependency-timeout", "A third-party API starts timing out sporadically and your application has a fixed request deadline. How should the application degrade while protecting its own capacity?", "Reliability", "Situational", "Decision making", "dependency-timeout-degradation", "third-party-timeout", "Set bounded timeouts within the request budget, use limited retries with jitter only for safe operations, apply circuit breaking/bulkheads, and return a useful degraded response while monitoring recovery.", ["Respects end-to-end deadline", "Avoids retry amplification", "Defines graceful degradation and recovery signals"], tags=("integrations", "timeouts", "resilience")),
    _item("devops-k8s-readiness", "A Kubernetes rollout is healthy, but users receive intermittent 503 responses while new pods start. Which change best addresses traffic reaching pods before they can serve requests?", "Reliability", "Technical", "Multiple choice", "kubernetes-readiness-gating", "startup-traffic-before-ready", "Use a readiness probe that reflects application readiness so the Service excludes pods until they can handle traffic.", ["Distinguishes readiness from liveness", "Keeps unready pods out of service endpoints", "Does not hide a persistent startup failure"], options={"A": "Increase the liveness probe failure threshold only", "B": "Add a readiness probe tied to application readiness", "C": "Disable health probes during rollout", "D": "Increase the pod restart count"}, correct="B", explanation="Readiness controls whether a pod receives Service traffic; liveness controls whether Kubernetes restarts it.", tags=("kubernetes", "probes", "availability")),
    _item("devops-pipeline-identity", "A deployment pipeline works from a developer laptop but receives AccessDenied in CI after a cloud role change. What is the safest first diagnostic step?", "Security & reliability", "Technical", "Multiple choice", "cloud-workload-identity", "ci-role-access-denied", "Inspect the CI workload's effective identity and denied action/resource from audit logs, then compare it with the least-privilege role policy.", ["Verifies effective CI identity", "Uses denied action/resource evidence", "Avoids broad administrator permissions"], options={"A": "Grant administrator access to the CI runner", "B": "Inspect the CI identity and the denied action in audit logs", "C": "Copy a developer's personal credentials into CI", "D": "Disable permission checks for the deployment"}, correct="B", explanation="The effective identity and specific denied action reveal the missing permission without expanding access broadly.", tags=("iam", "ci-cd", "cloud-security")),
    _item("quality-flake-triage-choice", "A critical CI test fails intermittently after running in parallel with unrelated tests. Which first experiment best distinguishes shared-state leakage from a timing issue?", "Problem solving", "Technical", "Multiple choice", "test-flake-isolation", "parallel-test-failure", "Run the test repeatedly in isolation and in the same parallel shard while capturing order and shared resources; compare the failure rate across conditions.", ["Separates isolated and parallel execution", "Captures order and shared resources", "Uses repeated controlled runs"], options={"A": "Increase every test timeout and merge", "B": "Compare repeated isolated runs with the same parallel shard and capture execution order", "C": "Delete the test because it is flaky", "D": "Rerun only the full suite once"}, correct="B", explanation="Comparing controlled isolated and parallel runs provides evidence about shared state versus timing.", tags=("testing", "ci", "flaky-tests")),
    _item("architecture-failover-choice", "A customer-facing service has a 30-minute recovery objective and a strict cloud budget. Which design is the most reasonable starting point for a regional outage?", "Reliability", "System design", "Multiple choice", "regional-recovery-tier", "budgeted-regional-failover", "A warm standby or pilot-light design may fit if data replication, documented failover, and regular recovery tests can satisfy the RTO at lower cost than active-active.", ["Uses stated recovery objective", "Balances cost and failover time", "Requires tested data recovery"], options={"A": "Active-active in every region regardless of budget", "B": "A tested warm standby or pilot light sized to meet the recovery objective", "C": "Backups with no restore testing", "D": "Manual rebuild from source code after the outage"}, correct="B", explanation="A tested standby tier can balance recovery time and cost when active-active is not required.", tags=("cloud", "disaster-recovery", "cost")),
    _item("general-incident-communication", "During an incident, a stakeholder asks for an exact recovery time before the team has isolated the cause. How would you respond while keeping the response coordinated?", "Communication", "Behavioral", "Behavioral", "incident-status-uncertainty", "incident-unknown-eta", "State confirmed impact and current actions, avoid inventing an ETA, provide the next update time, identify an incident communication owner, and update the estimate as evidence changes.", ["Separates facts from assumptions", "Provides a reliable update cadence", "Coordinates ownership and follow-up"], tags=("incident", "communication", "leadership")),
    _item("general-tradeoff", "Tell me about a technical decision where you had to balance delivery speed against reliability or maintainability. What alternatives did you consider, and what evidence changed your decision?", "Leadership", "Behavioral", "Behavioral", "engineering-tradeoff-evidence", "delivery-reliability-tradeoff", "A strong response gives the context and constraints, compares alternatives, explains evidence and risk, communicates the decision, and reflects on the outcome.", ["Gives a specific situation and constraints", "Compares alternatives using evidence", "Explains outcome and learning"], tags=("behavioral", "decision-making", "trade-offs")),
]


def normalize_question(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").casefold()
    return " ".join(re.findall(r"[a-z0-9]+", normalized))


def _similarity(left: str, right: str) -> float:
    left_tokens = set(normalize_question(left).split())
    right_tokens = set(normalize_question(right).split())
    if not left_tokens or not right_tokens:
        return 0.0
    overlap = len(left_tokens & right_tokens) / len(left_tokens | right_tokens)
    sequence = SequenceMatcher(None, normalize_question(left), normalize_question(right)).ratio()
    return max(overlap, sequence)


def is_duplicate(candidate: dict[str, Any], history: list[dict[str, Any]]) -> bool:
    candidate_text = str(candidate.get("question", ""))
    normalized = normalize_question(candidate_text)
    for previous in history:
        if not isinstance(previous, dict):
            previous = {"question": str(previous)}
        prior_text = str(previous.get("question", ""))
        if normalized and normalized == normalize_question(prior_text):
            return True
        follows_this_question = (
            candidate.get("question_type") == "Follow-up"
            and candidate.get("follow_up_to_question_id") == previous.get("question_id")
            and candidate.get("scenario_id") != previous.get("scenario_id")
        )
        same_scenario = candidate.get("scenario_id") and candidate.get("scenario_id") == previous.get("scenario_id")
        same_concept = candidate.get("concept_id") and candidate.get("concept_id") == previous.get("concept_id")
        same_role = not candidate.get("role_family") or not previous.get("role_family") or candidate.get("role_family") == previous.get("role_family")
        if same_role and (same_scenario or (same_concept and not follows_this_question)):
            return True
        if prior_text and _similarity(candidate_text, prior_text) >= 0.84:
            return True
    return False


def validate_question(question: dict[str, Any]) -> dict[str, Any]:
    required = ("question_id", "question", "role_family", "interview_category", "focus_area", "difficulty", "question_type", "format", "concept_id", "scenario_id", "expected_answer", "explanation", "evaluation_criteria", "tags", "source", "options", "correct_option")
    if any(not question.get(key) for key in required if key not in {"options", "correct_option"}):
        raise ValueError("Question is missing required interview metadata.")
    if question["format"] == "multiple_choice":
        options = question["options"]
        if not isinstance(options, dict) or set(options) != {"A", "B", "C", "D"}:
            raise ValueError("Multiple-choice questions must have exactly four labeled options.")
        if any(not str(value).strip() for value in options.values()) or question["correct_option"] not in options:
            raise ValueError("Multiple-choice answer key is incomplete.")
    elif question["format"] == "open_ended":
        if question["options"] or question["correct_option"]:
            raise ValueError("Open-ended questions cannot expose multiple-choice answers.")
        if not isinstance(question["evaluation_criteria"], list) or not question["evaluation_criteria"]:
            raise ValueError("Open-ended questions need evaluation criteria.")
    else:
        raise ValueError("Unsupported question format.")
    return question


def requested_format(question_number: int, interview_type: str) -> str:
    if interview_type.casefold() == "behavioral":
        return "open_ended"
    return ("open_ended", "multiple_choice", "open_ended", "open_ended", "multiple_choice")[(question_number - 1) % 5]


def requested_question_type(question_number: int, interview_type: str = "Mixed practice") -> str:
    if interview_type.casefold() == "behavioral":
        return "Follow-up" if question_number == 3 else "Behavioral"
    return ("Troubleshooting", "Multiple choice", "Follow-up", "System design", "Multiple choice")[(question_number - 1) % 5]


def _difficulty(experience: str) -> str:
    value = experience.casefold()
    if any(term in value for term in ("entry", "early", "career change")):
        return "Entry"
    if any(term in value for term in ("senior", "lead", "principal", "8+")):
        return "Advanced"
    return "Intermediate"


def select_bank_question(
    setup: dict[str, Any], history: list[dict[str, Any]], question_number: int,
) -> dict[str, Any] | None:
    family = role_family(setup["role"])
    available_families = {family, "general"}
    desired_format = requested_format(question_number, setup["interview_type"])
    desired_type = requested_question_type(question_number, setup["interview_type"])
    category_map = {
        "behavioral": {"Behavioral", "Situational"},
        "technical": {"Technical", "System design"},
        "situational": {"Situational", "Technical", "System design"},
        "hiring manager": {"Behavioral", "System design", "Situational"},
    }
    allowed_categories = category_map.get(setup["interview_type"].casefold())
    type_candidates = [
        item for item in QUESTION_BANK
        if item["role_family"] in available_families and item["format"] == desired_format
        and (desired_type == "Follow-up" or item["question_type"] == desired_type)
        and (not allowed_categories or item["interview_category"] in allowed_categories)
        and not is_duplicate(item, history)
    ]
    if not type_candidates:
        type_candidates = [
            item for item in QUESTION_BANK
            if item["role_family"] in available_families and item["format"] == desired_format
            and not is_duplicate(item, history)
            and (not allowed_categories or item["interview_category"] in allowed_categories)
        ]
    if not type_candidates:
        type_candidates = [
            item for item in QUESTION_BANK
            if item["role_family"] in available_families and not is_duplicate(item, history)
            and (not allowed_categories or item["interview_category"] in allowed_categories)
        ]
    if not type_candidates:
        return None
    selected_focus = set(setup["focus_areas"])
    focused = [item for item in type_candidates if item["focus_area"] in selected_focus]
    pool = focused or type_candidates
    question = dict(random.choice(pool))
    question["experience_level"] = setup["experience"]
    question["difficulty"] = _difficulty(setup["experience"])
    question["role"] = setup["role"]
    return validate_question(question)


def validate_bank() -> None:
    seen: list[dict[str, Any]] = []
    ids: set[str] = set()
    for question in QUESTION_BANK:
        validate_question(question)
        if question["question_id"] in ids or is_duplicate(question, seen):
            raise ValueError(f"Duplicate curated question: {question['question_id']}")
        ids.add(question["question_id"])
        seen.append(question)


validate_bank()