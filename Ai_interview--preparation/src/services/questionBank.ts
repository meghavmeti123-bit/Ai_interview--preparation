import { Question, PracticeSetup } from '../types';

export function roleFamily(role: string): string {
  const value = role.toLowerCase();
  if (['devops', 'platform', 'site reliability', 'sre', 'infrastructure', 'cloud engineer'].some(w => value.includes(w))) {
    return 'devops';
  }
  if (['frontend', 'front-end', 'ui engineer', 'web engineer'].some(w => value.includes(w))) {
    return 'frontend';
  }
  if (['quality', 'qa', 'test engineer', 'test automation'].some(w => value.includes(w))) {
    return 'quality';
  }
  if (['architect', 'cloud architect', 'solutions architect'].some(w => value.includes(w))) {
    return 'architecture';
  }
  if (['application', 'backend', 'back-end', 'software', 'api engineer'].some(w => value.includes(w))) {
    return 'backend';
  }
  return 'general';
}

export const FOCUS_ALIASES: Record<string, string[]> = {
  'communication': ['communication', 'collaboration', 'leadership'],
  'problem solving': ['problem solving', 'troubleshooting', 'reliability', 'security & reliability', 'security'],
  'leadership': ['leadership', 'collaboration', 'communication'],
  'technical depth': ['technical depth', 'performance', 'reliability', 'troubleshooting', 'security & reliability', 'security', 'system design'],
  'impact & results': ['impact & results', 'performance', 'reliability'],
  'collaboration': ['collaboration', 'communication', 'leadership'],
};

export function matchesFocus(questionFocus: string, selectedFocus: Set<string>): boolean {
  const qf = questionFocus.toLowerCase();
  for (const focus of selectedFocus) {
    const aliases = FOCUS_ALIASES[focus.toLowerCase()] || [focus.toLowerCase()];
    if (aliases.some(a => a === qf)) {
      return true;
    }
  }
  return false;
}

export function normalizeQuestion(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isDuplicate(candidate: Partial<Question>, history: Partial<Question>[]): boolean {
  const candText = candidate.question || '';
  const candNorm = normalizeQuestion(candText);

  for (const prev of history) {
    if (candidate.question_id && (candidate.question_id === prev.question_id || candidate.question_id === (prev as any).bank_question_id)) {
      return true;
    }
    const prevText = prev.question || '';
    const prevNorm = normalizeQuestion(prevText);
    if (candNorm && candNorm === prevNorm) {
      return true;
    }
    const sameScenario = candidate.scenario_id && candidate.scenario_id === prev.scenario_id;
    const sameConcept = candidate.concept_id && candidate.concept_id === prev.concept_id;
    const sameRole = !candidate.role_family || !prev.role_family || candidate.role_family === prev.role_family;
    if (sameRole && (sameScenario || sameConcept)) {
      return true;
    }
  }
  return false;
}

export const CURATED_QUESTION_BANK: Question[] = [
  {
    question_id: 'backend-idempotency',
    question: 'A client retries a payment request after a timeout, and the first request may already have committed. What API and persistence guarantees would prevent a duplicate charge?',
    role_family: 'backend',
    interview_category: 'Technical',
    focus_area: 'Reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'idempotent-payment-write',
    scenario_id: 'payment-timeout-retry',
    expected_answer: 'Use an idempotency key scoped to the caller/request, persist its result atomically with the operation, and return the original outcome for safe retries.',
    explanation: 'An idempotency key lets the server return the original result without repeating the side effect.',
    options: {
      A: 'Increase the client timeout so it never retries',
      B: 'Use an idempotency key and atomically store the operation result',
      C: 'Ignore requests received within one second',
      D: 'Retry the database write until it returns success'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Timeouts can still occur, and a longer timeout does not make a committed operation safe to repeat.',
      B: 'The stable key lets the server return the already-committed result without charging again.',
      C: 'A time window can reject a legitimate later request and cannot reliably identify the same operation.',
      D: 'Blind retries can repeat the payment side effect when the first commit succeeded but its response was lost.'
    },
    tags: ['api', 'idempotency', 'payments']
  },
  {
    question_id: 'frontend-accessible-dialog',
    question: 'A modal works with a mouse but keyboard users can tab behind it and lose their place when it closes. What behaviors should the implementation provide?',
    role_family: 'frontend',
    interview_category: 'Technical',
    focus_area: 'Accessibility',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'dialog-focus-management',
    scenario_id: 'modal-keyboard-navigation',
    expected_answer: 'A modal should move focus inside, trap focus while open, close on the agreed keyboard action, expose dialog semantics, and restore focus to the trigger when closed.',
    explanation: 'Focus management and semantic dialog behavior make the modal operable without a mouse.',
    options: {
      A: 'Add a visible close icon and leave tab order unchanged',
      B: 'Move focus into the dialog, contain it while open, and restore it on close',
      C: 'Disable keyboard input while the dialog is visible',
      D: 'Rely on users to click the backdrop to exit'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'A visible close control helps mouse users but does not prevent keyboard focus from escaping or restore it.',
      B: 'This keeps keyboard focus in the modal and returns the user to the control that opened it.',
      C: 'Disabling keyboard input makes the dialog unusable rather than accessible.',
      D: 'Backdrop clicks are not keyboard-operable and do not restore focus.'
    },
    tags: ['accessibility', 'keyboard', 'focus']
  },
  {
    question_id: 'devops-k8s-readiness',
    question: 'A Kubernetes rollout is healthy, but users receive intermittent 503 responses while new pods start. Which change best addresses traffic reaching pods before they can serve requests?',
    role_family: 'devops',
    interview_category: 'Technical',
    focus_area: 'Reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'kubernetes-readiness-gating',
    scenario_id: 'startup-traffic-before-ready',
    expected_answer: 'Use a readiness probe that reflects application readiness so the Service excludes pods until they can handle traffic.',
    explanation: 'Readiness controls whether a pod receives Service traffic; liveness controls whether Kubernetes restarts it.',
    options: {
      A: 'Increase the liveness probe failure threshold only',
      B: 'Add a readiness probe tied to application readiness',
      C: 'Disable health probes during rollout',
      D: 'Increase the pod restart count'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Liveness controls restarts and does not keep a pod out of service endpoints when it cannot yet serve.',
      B: 'A readiness failure removes the pod from service endpoints until the application is ready.',
      C: 'Disabling health checks removes useful protection and does not route around unready pods safely.',
      D: 'More restarts can worsen availability and do not define when a pod should receive traffic.'
    },
    tags: ['kubernetes', 'probes', 'availability']
  },
  {
    question_id: 'devops-pipeline-identity',
    question: 'A deployment pipeline works from a developer laptop but receives AccessDenied in CI after a cloud role change. What is the safest first diagnostic step?',
    role_family: 'devops',
    interview_category: 'Technical',
    focus_area: 'Security & reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'cloud-workload-identity',
    scenario_id: 'ci-role-access-denied',
    expected_answer: 'Inspect the CI workload\'s effective identity and denied action/resource from audit logs, then compare it with the least-privilege role policy.',
    explanation: 'The effective identity and specific denied action reveal the missing permission without expanding access broadly.',
    options: {
      A: 'Grant administrator access to the CI runner',
      B: 'Inspect the CI identity and the denied action in audit logs',
      C: 'Copy a developer\'s personal credentials into CI',
      D: 'Disable permission checks for the deployment'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Administrator access is excessive and can conceal the actual missing action while increasing blast radius.',
      B: 'The effective identity and denied action identify the exact permission issue without broadening privileges.',
      C: 'Personal credentials are hard to audit, may be long-lived, and should not be shared with CI.',
      D: 'Disabling authorization removes a security boundary rather than diagnosing the role change.'
    },
    tags: ['iam', 'ci-cd', 'cloud-security']
  },
  {
    question_id: 'quality-flake-triage-choice',
    question: 'A critical CI test fails intermittently after running in parallel with unrelated tests. Which first experiment best distinguishes shared-state leakage from a timing issue?',
    role_family: 'quality',
    interview_category: 'Technical',
    focus_area: 'Problem solving',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'test-flake-isolation',
    scenario_id: 'parallel-test-failure',
    expected_answer: 'Run the test repeatedly in isolation and in the same parallel shard while capturing order and shared resources; compare the failure rate across conditions.',
    explanation: 'Comparing controlled isolated and parallel runs provides evidence about shared state versus timing.',
    options: {
      A: 'Increase every test timeout and merge',
      B: 'Compare repeated isolated runs with the same parallel shard and capture execution order',
      C: 'Delete the test because it is flaky',
      D: 'Rerun only the full suite once'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'A longer timeout may hide a symptom and does not isolate shared state or scheduling.',
      B: 'Controlled isolated and parallel runs with order/resource artifacts provide evidence about both hypotheses.',
      C: 'Deleting a critical test removes coverage without identifying or fixing the defect.',
      D: 'One full-suite rerun is not enough to compare conditions or estimate failure patterns.'
    },
    tags: ['testing', 'ci', 'flaky-tests']
  },
  {
    question_id: 'architecture-failover-choice',
    question: 'A customer-facing service has a 30-minute recovery objective and a strict cloud budget. Which design is the most reasonable starting point for a regional outage?',
    role_family: 'architecture',
    interview_category: 'System design',
    focus_area: 'Reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'regional-recovery-tier',
    scenario_id: 'budgeted-regional-failover',
    expected_answer: 'A warm standby or pilot-light design may fit if data replication, documented failover, and regular recovery tests can satisfy the RTO at lower cost than active-active.',
    explanation: 'A tested standby tier can balance recovery time and cost when active-active is not required.',
    options: {
      A: 'Active-active in every region regardless of budget',
      B: 'A tested warm standby or pilot light sized to meet the recovery objective',
      C: 'Backups with no restore testing',
      D: 'Manual rebuild from source code after the outage'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Active-active may exceed the stated budget and is not automatically required by a 30-minute objective.',
      B: 'A tested standby tier can meet the recovery target at lower cost if data and failover procedures are validated.',
      C: 'Untested backups do not demonstrate the recovery time or data recovery objectives can be met.',
      D: 'Rebuilding manually after an outage is unlikely to meet the recovery objective reliably.'
    },
    tags: ['cloud', 'disaster-recovery', 'cost']
  },
  {
    question_id: 'backend-index-plan',
    question: 'A query that used to meet its latency objective now scans millions of rows after tenant data grew. Which first step is most likely to identify a targeted fix?',
    role_family: 'backend',
    interview_category: 'Technical',
    focus_area: 'Performance',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'query-plan-index-selectivity',
    scenario_id: 'tenant-query-table-growth',
    expected_answer: 'Compare the actual query plan and row estimates, inspect filter and join selectivity, then test a composite index aligned with the access pattern and write cost.',
    explanation: 'The execution plan reveals where rows are scanned or estimates diverge; an index should match measured predicates and workload.',
    options: {
      A: 'Add an index to every column in the query',
      B: 'Inspect the actual plan and cardinality, then test an index matching the predicates',
      C: 'Increase connection-pool size',
      D: 'Cache all query results indefinitely'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Unselective or redundant indexes increase storage and write cost and may not improve the plan.',
      B: 'Plan and cardinality evidence guide a focused index experiment that can be checked against write overhead.',
      C: 'More connections do not reduce the amount of work performed by this query.',
      D: 'Unbounded caching risks stale tenant data and avoids diagnosing the regression.'
    },
    tags: ['database', 'query-plans', 'indexing']
  },
  {
    question_id: 'backend-cache-stampede',
    question: 'A hot cache key expires during a traffic spike, and many requests simultaneously recompute the same expensive result. Which mitigation best reduces duplicate work while keeping data freshness bounded?',
    role_family: 'backend',
    interview_category: 'Technical',
    focus_area: 'Reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'cache-stampede-coalescing',
    scenario_id: 'hot-key-expiration-burst',
    expected_answer: 'Use request coalescing or a short-lived refresh lock, optionally serve a bounded stale value, and retain a maximum staleness policy.',
    explanation: 'Single-flight refreshes prevent a thundering herd while an explicit staleness bound protects correctness.',
    options: {
      A: 'Increase every cache TTL to several days',
      B: 'Coalesce refreshes per key and permit bounded stale reads if the product allows',
      C: 'Disable caching for all endpoints',
      D: 'Retry the expensive computation more aggressively'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'A much longer TTL can exceed freshness requirements and does not address coordinated refresh behavior.',
      B: 'Coalescing limits duplicate work, and bounded stale serving is an explicit latency/freshness trade-off.',
      C: 'Removing the cache can push the same workload directly onto the expensive dependency.',
      D: 'More retries amplify the same concurrent work and can worsen saturation.'
    },
    tags: ['caching', 'concurrency', 'reliability']
  },
  {
    question_id: 'backend-rate-limit-tenant',
    question: 'One tenant sends a burst of expensive export requests and begins starving other tenants. Which control best protects shared capacity while allowing normal traffic to recover?',
    role_family: 'backend',
    interview_category: 'Decision making',
    focus_area: 'Reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'tenant-fair-rate-limits',
    scenario_id: 'noisy-tenant-export-burst',
    expected_answer: 'Apply a per-tenant quota or token bucket weighted by request cost, return retry guidance, and monitor fairness and queue pressure.',
    explanation: 'Per-tenant cost-aware limits contain noisy neighbors while leaving capacity available to other tenants.',
    options: {
      A: 'Set one global request limit for all tenants',
      B: 'Apply per-tenant cost-aware limits and return a retry-after signal',
      C: 'Let requests queue without a bound',
      D: 'Block all export requests permanently'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'A global cap can still let one tenant consume most of the allowed traffic.',
      B: 'Tenant-scoped limits and retry guidance protect fairness and let clients pace their work.',
      C: 'An unbounded queue converts overload into growing latency and memory pressure.',
      D: 'A permanent block is disproportionate and prevents legitimate recovery.'
    },
    tags: ['api', 'multi-tenancy', 'capacity']
  },
  {
    question_id: 'frontend-layout-shift',
    question: 'A settings page shifts when a validation message appears, causing the primary button to move below the user\'s pointer. Which change best reduces this interaction instability without hiding the error?',
    role_family: 'frontend',
    interview_category: 'Technical',
    focus_area: 'Accessibility',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'form-error-layout-stability',
    scenario_id: 'validation-message-layout-shift',
    expected_answer: 'Reserve space for inline validation or position the message in a stable form layout, keeping the text visible and associated with its field.',
    explanation: 'A reserved error region prevents disruptive reflow while preserving visible, field-specific feedback.',
    options: {
      A: 'Hide validation messages after one second',
      B: 'Reserve a stable message area and associate it with the invalid field',
      C: 'Shrink all text to make the form shorter',
      D: 'Show errors only in the browser console'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Transient errors may disappear before users can understand or correct them.',
      B: 'Stable space prevents the action from jumping and keeps feedback perceivable and associated.',
      C: 'Smaller text harms readability and does not reliably prevent layout shifts.',
      D: 'Console messages are unavailable to most users and do not explain what to fix.'
    },
    tags: ['frontend', 'accessibility', 'forms']
  },
  {
    question_id: 'frontend-stale-response',
    question: 'Two search requests are in flight; the older request completes last and overwrites newer results. Which client-side behavior directly prevents stale results from winning?',
    role_family: 'frontend',
    interview_category: 'Technical',
    focus_area: 'Technical depth',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'search-request-ordering',
    scenario_id: 'out-of-order-query-response',
    expected_answer: 'Abort superseded requests or compare a monotonically increasing request ID before applying a response.',
    explanation: 'Cancellation or request sequencing ensures an older query cannot overwrite results for newer input.',
    options: {
      A: 'Increase the timeout for every request',
      B: 'Abort the prior request or ignore responses with an older request ID',
      C: 'Render whichever response arrives last',
      D: 'Disable search until the page reloads'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Longer timeouts allow stale requests to remain active even longer.',
      B: 'The client explicitly cancels obsolete work or rejects its response before updating the UI.',
      C: 'Arrival order is unrelated to query recency and is the source of this bug.',
      D: 'Disabling search avoids the feature rather than correcting response ordering.'
    },
    tags: ['frontend', 'async', 'api']
  },
  {
    question_id: 'frontend-dom-injection',
    question: 'A user-generated comment is rendered into an admin dashboard. Which approach best reduces script injection risk while preserving normal text formatting?',
    role_family: 'frontend',
    interview_category: 'Technical',
    focus_area: 'Security & reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'safe-user-content-rendering',
    scenario_id: 'admin-comment-script-injection',
    expected_answer: 'Render the value as text by default; if rich text is required, sanitize it with a maintained allowlist-based sanitizer and a restrictive content security policy.',
    explanation: 'Safe text rendering avoids interpreting input as markup; rich content requires context-aware sanitization rather than ad hoc filtering.',
    options: {
      A: 'Insert the comment with an HTML injection API',
      B: 'Render as text, or sanitize explicitly if rich content is required',
      C: 'Strip angle brackets with a regular expression',
      D: 'Trust the admin-only page because customers cannot access it'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'HTML insertion interprets attacker-controlled content as markup or script.',
      B: 'Text rendering is safe by default; a proven allowlist sanitizer is appropriate for intentional rich text.',
      C: 'Regex filtering is incomplete and may miss alternate encodings or parser edge cases.',
      D: 'Admin pages are high-value targets and user-generated content remains untrusted.'
    },
    tags: ['frontend', 'security', 'xss']
  },
  {
    question_id: 'quality-release-permission',
    question: 'A release changes a role-based permission check, but the existing suite covers only authorized users. Which additional test most directly catches an authorization regression?',
    role_family: 'quality',
    interview_category: 'Technical',
    focus_area: 'Security & reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'authorization-negative-test',
    scenario_id: 'role-change-unauthorized-user',
    expected_answer: 'Add negative boundary tests for users without the role and for cross-tenant access, asserting both the response and absence of side effects.',
    explanation: 'Negative authorization tests exercise the boundary most likely to regress and verify no protected operation occurred.',
    options: {
      A: 'Repeat the authorized happy-path test ten times',
      B: 'Assert unauthorized and cross-tenant requests are denied without side effects',
      C: 'Check only that the page renders',
      D: 'Skip permission tests because the change is small'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Repeated allowed-path checks do not test whether forbidden callers are denied.',
      B: 'Denied and cross-tenant cases directly cover the changed boundary and unintended writes.',
      C: 'A rendered page does not establish access-control correctness.',
      D: 'Permission changes are security-sensitive regardless of diff size.'
    },
    tags: ['qa', 'authorization', 'security']
  },
  {
    question_id: 'quality-contract-null',
    question: 'A producer changes an API field from always-present to nullable. Which compatibility test best protects consumers that distinguish a missing field from an explicit null?',
    role_family: 'quality',
    interview_category: 'Technical',
    focus_area: 'Technical depth',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'api-null-contract-test',
    scenario_id: 'nullable-provider-field',
    expected_answer: 'Add contract cases for a concrete value, explicit null, and absent field, then verify documented consumer behavior for each.',
    explanation: 'Null, missing, and concrete values are distinct wire states and should be asserted against the agreed contract.',
    options: {
      A: 'Test only a normal non-null payload',
      B: 'Validate present, null, and absent-field cases against the contract',
      C: 'Remove type validation from every consumer',
      D: 'Mock the field as an empty string in all tests'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'A normal value never exercises the newly introduced compatibility behavior.',
      B: 'The three cases reveal whether producer and consumer semantics remain aligned.',
      C: 'Removing validation can hide invalid data and spread the risk to unrelated fields.',
      D: 'An empty string is a fourth distinct value and does not model null or absence.'
    },
    tags: ['qa', 'api', 'contracts']
  },
  {
    question_id: 'architecture-event-delivery',
    question: 'An order service must publish an event after committing a database transaction. A direct broker publish can fail after the order commits. Which design most reliably prevents lost events?',
    role_family: 'architecture',
    interview_category: 'System design',
    focus_area: 'Reliability',
    difficulty: 'Intermediate',
    question_type: 'System design',
    format: 'multiple_choice',
    concept_id: 'transactional-outbox',
    scenario_id: 'database-commit-broker-failure',
    expected_answer: 'Write the business change and an outbox record in one database transaction, then publish outbox records asynchronously with idempotent consumers.',
    explanation: 'The outbox makes event intent atomic with the business commit; asynchronous publishing can retry without losing the event.',
    options: {
      A: 'Publish to the broker before beginning the database transaction',
      B: 'Write an outbox row in the same transaction and publish it asynchronously',
      C: 'Assume the broker is always available',
      D: 'Retry the entire order transaction forever'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'The event could publish even if the database transaction later rolls back.',
      B: 'A committed outbox record survives broker outages and supports controlled, idempotent delivery.',
      C: 'Availability assumptions do not resolve the commit/publish dual-write failure window.',
      D: 'Unbounded transaction retries can exhaust resources and still do not atomically coordinate the broker.'
    },
    tags: ['architecture', 'distributed-systems', 'events']
  },
  {
    question_id: 'architecture-read-model',
    question: 'A reporting endpoint needs expensive joins across operational tables, and reporting traffic is beginning to affect checkout latency. Which architectural change best isolates the workloads while keeping the report reasonably fresh?',
    role_family: 'architecture',
    interview_category: 'System design',
    focus_area: 'Performance',
    difficulty: 'Intermediate',
    question_type: 'System design',
    format: 'multiple_choice',
    concept_id: 'reporting-read-model-isolation',
    scenario_id: 'reporting-query-checkout-contention',
    expected_answer: 'Build a separately scaled read model or replica fed by a reliable change stream, define acceptable lag, and monitor freshness and replication health.',
    explanation: 'A read model separates expensive reporting from the transactional workload while exposing the consistency trade-off as measurable lag.',
    options: {
      A: 'Run the report at higher priority on the production primary',
      B: 'Create a separately scaled read model with an explicit freshness target',
      C: 'Add more checkout application threads',
      D: 'Cache the report forever'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Higher priority increases competition on the same database and can worsen checkout impact.',
      B: 'A separately scaled model isolates query cost; a freshness target makes the trade-off visible.',
      C: 'More application threads can increase database contention rather than isolate it.',
      D: 'An unbounded cache cannot meet changing report freshness needs.'
    },
    tags: ['architecture', 'read-model', 'performance']
  },
  {
    question_id: 'architecture-idempotent-consumer',
    question: 'A queue can redeliver a message when a worker commits its database update but crashes before acknowledging it. What consumer behavior prevents the repeated delivery from applying the business change twice?',
    role_family: 'architecture',
    interview_category: 'System design',
    focus_area: 'Reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'idempotent-message-consumer',
    scenario_id: 'commit-before-ack-redelivery',
    expected_answer: 'Record a durable message or operation ID in the same transaction as the business update and treat an already-processed ID as a no-op.',
    explanation: 'A transactional deduplication record makes the consumer safe under at-least-once delivery and crash recovery.',
    options: {
      A: 'Acknowledge the message before applying the update',
      B: 'Persist the message ID atomically with the business update and ignore duplicates',
      C: 'Assume the broker never redelivers acknowledged messages',
      D: 'Delay every acknowledgement by a fixed interval'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'A crash after acknowledgement but before the update loses the business operation.',
      B: 'The transaction makes the operation and processed marker atomic, so a redelivery is harmless.',
      C: 'At-least-once brokers can redeliver when acknowledgement is lost or delayed.',
      D: 'A delay does not establish whether the side effect already committed.'
    },
    tags: ['architecture', 'messaging', 'idempotency']
  },
  {
    question_id: 'architecture-db-saturation',
    question: 'An application tier scales out during a traffic spike, but database queue time and connection waits rise sharply while CPU on each app instance remains low. What should you change first?',
    role_family: 'architecture',
    interview_category: 'System design',
    focus_area: 'Reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'database-saturation-scale-boundary',
    scenario_id: 'replica-scale-db-connection-pressure',
    expected_answer: 'Measure database saturation and per-instance pool multiplication, then bound concurrency and optimize the dominant query before deciding whether database capacity should scale.',
    explanation: 'Low application CPU with rising database queue and connection waits points to a downstream bottleneck; adding clients can worsen it.',
    options: {
      A: 'Increase application replicas again to spread database work',
      B: 'Measure database and pool saturation, cap concurrency, then test the query bottleneck',
      C: 'Increase every connection pool to its maximum',
      D: 'Disable database monitoring to reduce overhead'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'More replicas can multiply connections and push more concurrent work to the constrained database.',
      B: 'Resource and query evidence identify whether bounded concurrency or a measured database change addresses the bottleneck.',
      C: 'Larger pools can increase contention and do not create database capacity.',
      D: 'Removing observability makes it harder to confirm the cause or verify recovery.'
    },
    tags: ['architecture', 'database', 'scaling']
  },
  {
    question_id: 'quality-test-data-isolation',
    question: 'Two parallel integration tests intermittently update the same customer record and fail depending on order. Which change best makes the suite deterministic without serializing all tests?',
    role_family: 'quality',
    interview_category: 'Technical',
    focus_area: 'Problem solving',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'parallel-test-data-isolation',
    scenario_id: 'shared-test-customer-record',
    expected_answer: 'Give each test an isolated fixture or unique tenant/data key and clean it up deterministically, while keeping shared dependencies read-only where possible.',
    explanation: 'Isolated fixtures remove order dependence while allowing unrelated tests to continue in parallel.',
    options: {
      A: 'Run the entire test suite sequentially forever',
      B: 'Use unique per-test records or tenants and deterministic cleanup',
      C: 'Add random sleeps before every update',
      D: 'Ignore failures if the next run passes'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Serial execution hides contention and slows every test even when most tests are independent.',
      B: 'Unique mutable state prevents cross-test interference and cleanup keeps runs repeatable.',
      C: 'Sleeps add time without guaranteeing ordering or isolation.',
      D: 'Intermittent failures still indicate a real reliability gap in the suite.'
    },
    tags: ['qa', 'testing', 'parallelism']
  },
  {
    question_id: 'quality-observability-assertion',
    question: 'A service returns HTTP 200 for a batch import even when some records fail validation. Which test assertion best verifies the API\'s partial-success contract?',
    role_family: 'quality',
    interview_category: 'Technical',
    focus_area: 'Technical depth',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'partial-import-contract',
    scenario_id: 'batch-import-invalid-records',
    expected_answer: 'Assert the documented status and response schema include accepted and rejected record counts plus stable per-record error identifiers, and verify valid records were processed once.',
    explanation: 'A status code alone cannot prove which records succeeded; the contract should make partial outcomes explicit and testable.',
    options: {
      A: 'Assert only that the response status is 200',
      B: 'Assert accepted/rejected counts, record-level errors, and valid-record side effects',
      C: 'Expect the entire batch to silently discard invalid rows',
      D: 'Check only server logs for validation errors'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'A successful transport status does not validate the partial result or record outcomes.',
      B: 'The response contract and persisted effects together verify both reporting and processing behavior.',
      C: 'Silent drops hide data loss and make client reconciliation impossible.',
      D: 'Logs are not the public contract and do not prove the response is correct.'
    },
    tags: ['qa', 'api', 'contracts']
  },
  {
    question_id: 'quality-flaky-network-test',
    question: 'A test calls a real third-party sandbox and fails during provider maintenance, despite unchanged application code. What is the most reliable CI strategy for this boundary?',
    role_family: 'quality',
    interview_category: 'Technical',
    focus_area: 'Reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'third-party-test-boundary',
    scenario_id: 'sandbox-provider-outage',
    expected_answer: 'Keep deterministic contract/component tests in the required CI path, use controlled stubs or a maintained local fake for normal runs, and run a smaller scheduled live compatibility check with clear ownership.',
    explanation: 'Separating deterministic contract coverage from a live dependency check preserves confidence without making every build depend on sandbox uptime.',
    options: {
      A: 'Retry every failing test indefinitely',
      B: 'Use deterministic contract tests in required CI and a separate scheduled live check',
      C: 'Remove all provider integration coverage',
      D: 'Treat provider outages as application regressions'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Unlimited retries waste CI capacity and can conceal a real deterministic defect.',
      B: 'The split keeps required feedback stable while still detecting real provider drift.',
      C: 'Removing all coverage loses evidence about the external contract.',
      D: 'A provider outage and an application regression require different owners and responses.'
    },
    tags: ['qa', 'integration', 'ci']
  },
  {
    question_id: 'devops-traffic-drain',
    question: 'A deployment replaces instances behind a load balancer, but active requests are cut off during shutdown. Which lifecycle behavior most directly enables safe connection draining?',
    role_family: 'devops',
    interview_category: 'Technical',
    focus_area: 'Reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'graceful-instance-drain',
    scenario_id: 'load-balancer-shutdown-requests',
    expected_answer: 'Mark the instance unready or deregister it before termination, allow in-flight requests to drain within a bounded grace period, then stop the process.',
    explanation: 'Deregistration prevents new requests while a bounded drain period lets active work finish before shutdown.',
    options: {
      A: 'Terminate immediately and rely on client retries',
      B: 'Remove the instance from service, drain in-flight work, then terminate',
      C: 'Keep routing new traffic until the process exits',
      D: 'Disable health checks during deployment'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Retries may be unsafe for writes and do not prevent avoidable request interruption.',
      B: 'This sequence separates new traffic from in-flight work and gives shutdown a controlled bound.',
      C: 'New requests can continue arriving while the process is stopping.',
      D: 'Removing health checks weakens traffic control rather than enabling graceful drain.'
    },
    tags: ['devops', 'deployment', 'reliability']
  },
  {
    question_id: 'architecture-sync-async',
    question: 'A new workflow calls three downstream services and currently holds a client request open for all of them. One dependency is often slow, but the user does not need an immediate final result. Which design is the strongest fit?',
    role_family: 'architecture',
    interview_category: 'System design',
    focus_area: 'System design',
    difficulty: 'Intermediate',
    question_type: 'System design',
    format: 'multiple_choice',
    concept_id: 'async-workflow-boundary',
    scenario_id: 'slow-downstream-long-request',
    expected_answer: 'Accept the request, persist a workflow state, process through a durable queue, and expose status or completion notification with bounded retries and idempotency.',
    explanation: 'Durable asynchronous processing avoids tying client latency to a slow dependency and provides recoverable progress.',
    options: {
      A: 'Increase the HTTP timeout to several minutes',
      B: 'Persist the workflow and process asynchronously with status tracking',
      C: 'Call all dependencies repeatedly until they respond',
      D: 'Return success before storing any work'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Longer timeouts retain resources and do not improve dependency reliability.',
      B: 'Persisted work, status, and bounded idempotent retries provide a clear recovery and user-feedback model.',
      C: 'Unbounded retries amplify load and can duplicate side effects.',
      D: 'Acknowledging unpersisted work risks silently losing the request.'
    },
    tags: ['architecture', 'queues', 'reliability']
  },
  {
    question_id: 'devops-dns-cache',
    question: 'A DNS record was corrected, but a subset of clients continues using the old endpoint. Authoritative DNS is correct. What is the most useful next check?',
    role_family: 'devops',
    interview_category: 'Technical',
    focus_area: 'Problem solving',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'dns-cache-ttl',
    scenario_id: 'stale-recursive-dns-record',
    expected_answer: 'Compare recursive resolver responses and TTLs from affected networks, then check client or local resolver caches before changing authoritative records again.',
    explanation: 'Correct authoritative data does not immediately invalidate cached recursive or client responses; compare resolver paths and TTLs.',
    options: {
      A: 'Change the authoritative record repeatedly',
      B: 'Inspect recursive/client resolver answers and remaining TTLs from affected clients',
      C: 'Disable all DNS caching globally',
      D: 'Restart every application server'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'The authoritative record is already correct, and repeated edits can create additional inconsistency.',
      B: 'Affected resolvers and clients may retain the prior response until expiry or explicit cache refresh.',
      C: 'Global cache removal is disruptive and disproportionate to a scoped stale record.',
      D: 'Restarting application servers does not necessarily clear client or recursive DNS caches.'
    },
    tags: ['devops', 'dns', 'networking']
  },
  {
    question_id: 'devops-rollback-threshold',
    question: 'A deployment is producing elevated errors for a small canary cohort, but the overall service error rate remains below its global alert threshold. What is the best release-control response?',
    role_family: 'devops',
    interview_category: 'Technical',
    focus_area: 'Reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'canary-cohort-health-gate',
    scenario_id: 'localized-canary-error-spike',
    expected_answer: 'Use cohort-specific rollout health gates and pause or roll back when the canary exceeds its agreed error budget, even if aggregate metrics dilute the signal.',
    explanation: 'Aggregate metrics can hide localized regression; the canary should be governed by its own health criteria.',
    options: {
      A: 'Continue rollout because global errors remain below threshold',
      B: 'Pause rollout and assess the canary against cohort-specific health criteria',
      C: 'Disable the error alert',
      D: 'Wait until every user is affected before rolling back'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Healthy traffic can dilute a severe regression limited to the canary cohort.',
      B: 'A cohort-specific gate preserves the purpose of a canary and limits blast radius.',
      C: 'Disabling detection removes evidence without improving the release.',
      D: 'Waiting for wider impact defeats staged rollout protection.'
    },
    tags: ['devops', 'deployment', 'observability']
  },
  {
    question_id: 'general-incident-signal',
    question: 'Several alerts fire during an outage, but they share the same downstream dependency. Which action best helps an incident commander establish a reliable picture before assigning parallel investigations?',
    role_family: 'general',
    interview_category: 'Technical',
    focus_area: 'Communication',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'incident-signal-correlation',
    scenario_id: 'correlated-alert-burst',
    expected_answer: 'Correlate alerts by service dependency and time, verify customer impact with primary service-level indicators, and establish a single incident timeline and owner.',
    explanation: 'Correlating dependent alerts and checking user impact reduces duplicated investigation and unsafe concurrent changes.',
    options: {
      A: 'Treat every alert as an unrelated incident',
      B: 'Correlate the alert burst, verify user-facing impact, and establish a shared timeline',
      C: 'Silence all alerts until the outage ends',
      D: 'Ask every team to change its service simultaneously'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Independent investigations can duplicate work and miss the shared failure source.',
      B: 'A shared evidence timeline and impact signal support coordinated, prioritized response.',
      C: 'Silencing alerts removes useful evidence and may hide new symptoms.',
      D: 'Uncoordinated changes make causal analysis and safe recovery harder.'
    },
    tags: ['incident', 'communication', 'reliability']
  },
  {
    question_id: 'general-risky-change',
    question: 'A production change is small in code size but alters a permission boundary. Which rollout evidence is most important before broad exposure?',
    role_family: 'general',
    interview_category: 'Technical',
    focus_area: 'Security & reliability',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'permission-boundary-rollout',
    scenario_id: 'small-authz-change',
    expected_answer: 'Verify positive and negative authorization tests, audit behavior, and a rollback path in a restricted cohort before expanding exposure.',
    explanation: 'Security impact is determined by the boundary changed, not line count; both grant and denial behavior need verification.',
    options: {
      A: 'Use code diff size as the primary risk measure',
      B: 'Validate allowed and denied access paths, monitor, and expand gradually with rollback ready',
      C: 'Skip staging because the code change is small',
      D: 'Rely only on a successful page load'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'A small change can have a large security impact if it changes an authorization decision.',
      B: 'Positive/negative checks and staged exposure validate the relevant behavior while limiting impact.',
      C: 'Skipping verification removes an important safeguard from a security-sensitive change.',
      D: 'A page rendering does not prove that protected resources are correctly authorized.'
    },
    tags: ['security', 'release', 'authorization']
  },
  {
    question_id: 'general-outcome-metric',
    question: 'A team claims a new feature improved onboarding, but only deployment counts and page views are available. Which next measurement best tests the intended user outcome?',
    role_family: 'general',
    interview_category: 'Behavioral',
    focus_area: 'Impact & results',
    difficulty: 'Intermediate',
    question_type: 'Multiple choice',
    format: 'multiple_choice',
    concept_id: 'outcome-metric-onboarding',
    scenario_id: 'feature-onboarding-impact',
    expected_answer: 'Define a cohort-based onboarding completion or time-to-first-value measure, compare against a baseline or control, and account for changes in traffic mix.',
    explanation: 'An outcome measure tied to user success and a comparable baseline tests whether the feature achieved its goal.',
    options: {
      A: 'Count additional commits after launch',
      B: 'Compare onboarding completion or time-to-value across comparable cohorts',
      C: 'Use total page views alone',
      D: 'Ask the delivery team whether the release felt successful'
    },
    correct_option: 'B',
    option_explanations: {
      A: 'Commit count measures engineering activity, not user onboarding impact.',
      B: 'Comparable cohorts and outcome metrics connect the feature to user behavior while reducing mix effects.',
      C: 'Page views show exposure but not whether users completed onboarding.',
      D: 'Team opinion is useful context but is not a measure of the intended user outcome.'
    },
    tags: ['metrics', 'product-impact', 'experimentation']
  }
];

export function countAvailableQuestions(setup: PracticeSetup, history: Partial<Question>[] = []): number {
  const family = roleFamily(setup.role);
  const families = new Set([family, 'general']);
  const selectedFocus = new Set(setup.focus_areas);

  const categoryMap: Record<string, string[]> = {
    'behavioral': ['Behavioral', 'Situational'],
    'technical': ['Technical', 'System design'],
    'situational': ['Situational', 'Technical', 'System design'],
    'hiring manager': ['Behavioral', 'System design', 'Situational'],
  };
  const allowedCategories = categoryMap[setup.interview_type.toLowerCase()];

  return CURATED_QUESTION_BANK.filter(item => {
    if (item.format !== 'multiple_choice') return false;
    if (!families.has(item.role_family)) return false;
    if (selectedFocus.size > 0 && !matchesFocus(item.focus_area, selectedFocus)) return false;
    if (allowedCategories && !allowedCategories.includes(item.interview_category)) return false;
    if (isDuplicate(item, history)) return false;
    return true;
  }).length;
}

export function selectBankQuestion(setup: PracticeSetup, history: Partial<Question>[] = [], questionNumber: number): Question | null {
  const family = roleFamily(setup.role);
  const availableFamilies = new Set([family, 'general']);
  const categoryMap: Record<string, string[]> = {
    'behavioral': ['Behavioral', 'Situational'],
    'technical': ['Technical', 'System design'],
    'situational': ['Situational', 'Technical', 'System design'],
    'hiring manager': ['Behavioral', 'System design', 'Situational'],
  };
  const allowedCategories = categoryMap[setup.interview_type.toLowerCase()];

  let pool = CURATED_QUESTION_BANK.filter(item => {
    if (!availableFamilies.has(item.role_family)) return false;
    if (item.format !== 'multiple_choice') return false;
    if (allowedCategories && !allowedCategories.includes(item.interview_category)) return false;
    if (isDuplicate(item, history)) return false;
    return true;
  });

  if (pool.length === 0) {
    pool = CURATED_QUESTION_BANK.filter(item => {
      if (!availableFamilies.has(item.role_family)) return false;
      if (item.format !== 'multiple_choice') return false;
      if (isDuplicate(item, history)) return false;
      return true;
    });
  }

  if (pool.length === 0) {
    return null;
  }

  const selectedFocus = new Set(setup.focus_areas);
  const focused = pool.filter(item => matchesFocus(item.focus_area, selectedFocus));
  const candidatePool = focused.length > 0 ? focused : pool;

  const raw = candidatePool[Math.floor(Math.random() * candidatePool.length)];

  // Shuffle options A, B, C, D to prevent position bias
  const letters = ['A', 'B', 'C', 'D'];
  const shuffled = [...letters].sort(() => Math.random() - 0.5);
  const labelMap: Record<string, string> = {};
  letters.forEach((letter, idx) => {
    labelMap[letter] = shuffled[idx];
  });

  const newOptions: Record<string, string> = {};
  const newOptionExplanations: Record<string, string> = {};
  let newCorrect = 'A';

  for (const letter of letters) {
    const prior = labelMap[letter];
    newOptions[letter] = raw.options[prior];
    newOptionExplanations[letter] = raw.option_explanations[prior];
    if (prior === raw.correct_option) {
      newCorrect = letter;
    }
  }

  return {
    ...raw,
    question_id: 'q-' + Math.random().toString(36).substring(2, 10),
    role: setup.role,
    experience_level: setup.experience,
    options: newOptions,
    option_explanations: newOptionExplanations,
    correct_option: newCorrect,
    question_number: questionNumber,
    question_count: setup.question_count,
  };
}
