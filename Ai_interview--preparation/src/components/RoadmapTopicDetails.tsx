import React from 'react';

export interface TopicDetailData {
  id: string;
  moduleNum: string;
  moduleTitle: string;
  title: string;
  summary: string;
  practiceFocus?: string;
  bulletPoints: string[];
  keyQuestions: string[];
  commonPitfalls: string[];
  diagramSvg: React.ReactNode;
}

export const ROADMAP_TOPIC_DATA: Record<string, TopicDetailData> = {
  'interview-basics': {
    id: 'interview-basics',
    moduleNum: '01',
    moduleTitle: 'Interview Fundamentals',
    title: 'Interview preparation basics',
    summary: 'Systematic structured progression from role targeting to diagnostic gap analysis and deliberate mock practice.',
    bulletPoints: [
      'Role Leveling: Calibrate whether target role requires IC3, Senior IC5, or Staff-level systems leadership.',
      'Diagnostic Assessment: Complete a diagnostic MCQ set to pinpoint whether systems, communication, or code logic is weakest.',
      'Deliberate Practice: Practice under timed conditions rather than passive reading.',
      'Loop Retrospective: Log every incorrect question and review the root cause explanation.',
    ],
    keyQuestions: [
      '"Tell me about a high-stakes engineering problem you resolved under tight deadlines."',
      '"How do you prioritize between technical debt and speed to market?"',
    ],
    commonPitfalls: [
      'Memorizing question answers verbatim instead of understanding first-principle trade-offs.',
      'Ignoring time constraints during solo practice.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 160" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="160" rx="8" fill="#141822" stroke="#252f44" />
        {/* Step 1 */}
        <rect x="20" y="35" width="105" height="90" rx="6" fill="#1b2333" stroke="#3b82f6" strokeWidth="1.5" />
        <text x="72" y="62" fill="#93c5fd" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">STAGE 01</text>
        <text x="72" y="82" fill="#ffffff" fontSize="12" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">Role Target</text>
        <text x="72" y="102" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="sans-serif">Leveling &amp; Rubrics</text>

        <path d="M 125 80 L 145 80" stroke="#475569" strokeWidth="2" markerEnd="url(#arrow)" />

        {/* Step 2 */}
        <rect x="150" y="35" width="105" height="90" rx="6" fill="#1b2333" stroke="#10b981" strokeWidth="1.5" />
        <text x="202" y="62" fill="#86efac" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">STAGE 02</text>
        <text x="202" y="82" fill="#ffffff" fontSize="12" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">Diagnostic</text>
        <text x="202" y="102" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="sans-serif">Identify Weak Gaps</text>

        <path d="M 255 80 L 275 80" stroke="#475569" strokeWidth="2" />

        {/* Step 3 */}
        <rect x="280" y="35" width="105" height="90" rx="6" fill="#1b2333" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="332" y="62" fill="#fde68a" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">STAGE 03</text>
        <text x="332" y="82" fill="#ffffff" fontSize="12" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">Mock Rounds</text>
        <text x="332" y="102" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="sans-serif">Proctor + Voice Sim</text>

        <path d="M 385 80 L 405 80" stroke="#475569" strokeWidth="2" />

        {/* Step 4 */}
        <rect x="410" y="35" width="110" height="90" rx="6" fill="#1b2333" stroke="#a855f7" strokeWidth="1.5" />
        <text x="465" y="62" fill="#d8b4fe" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">STAGE 04</text>
        <text x="465" y="82" fill="#ffffff" fontSize="12" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">Retrospective</text>
        <text x="465" y="102" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="sans-serif">Score Calibration</text>
      </svg>
    ),
  },

  'resume': {
    id: 'resume',
    moduleNum: '01',
    moduleTitle: 'Interview Fundamentals',
    title: 'Resume-based questions',
    summary: 'Mastering the XYZ resume formula to defend architectural choices and demonstrate direct business impact.',
    bulletPoints: [
      'The Google XYZ Formula: "Accomplished [X] as measured by [Y] by doing [Z]."',
      'Ownership Clarity: Distinguish your personal individual contribution from what the whole team built.',
      'Architectural Justification: Be ready to answer "Why did you choose PostgreSQL over MongoDB for that service?"',
      'Scaling Numbers: Know your request throughput, latency p99, database table sizes, and team size.',
    ],
    keyQuestions: [
      '"Walk me through the system you designed on bullet point #2 of your resume."',
      '"If you had to rewrite this service today with 10x traffic, what would break first?"',
    ],
    commonPitfalls: [
      'Using vague phrases like "assisted with" or "involved in" instead of concrete actions.',
      'Listing technologies you only copied-and-pasted without understanding the underlying design.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="26" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">HIGH-IMPACT RESUME ARCHITECTURE</text>
        
        <rect x="25" y="45" width="145" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" />
        <text x="97" y="70" fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">ACTION VERB [Z]</text>
        <text x="97" y="90" fill="#e2e8f0" fontSize="11" textAnchor="middle" fontFamily="sans-serif">Architected, Sharded,</text>
        <text x="97" y="105" fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="sans-serif">Automated, Optimized</text>

        <text x="185" y="90" fill="#64748b" fontSize="20" fontWeight="bold" textAnchor="middle">+</text>

        <rect x="200" y="45" width="145" height="80" rx="6" fill="#1e293b" stroke="#10b981" />
        <text x="272" y="70" fill="#10b981" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">OUTCOME [X]</text>
        <text x="272" y="90" fill="#e2e8f0" fontSize="11" textAnchor="middle" fontFamily="sans-serif">Distributed Cache</text>
        <text x="272" y="105" fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="sans-serif">Resilient Event Bus</text>

        <text x="360" y="90" fill="#64748b" fontSize="20" fontWeight="bold" textAnchor="middle">=</text>

        <rect x="375" y="45" width="140" height="80" rx="6" fill="#1e293b" stroke="#f59e0b" />
        <text x="445" y="70" fill="#f59e0b" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">METRIC [Y]</text>
        <text x="445" y="90" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">-42% Latency p99</text>
        <text x="445" y="105" fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="sans-serif">$120k/yr Cloud Savings</text>
      </svg>
    ),
  },

  'self-introduction': {
    id: 'self-introduction',
    moduleNum: '01',
    moduleTitle: 'Interview Fundamentals',
    title: 'Self-introduction',
    summary: 'The 90-second elevator pitch connecting your engineering identity to the target role requirements.',
    bulletPoints: [
      'The 3-Act Structure: Present (current focus & strengths) -> Past (key milestone) -> Future (why this role).',
      'Hook the Interviewer: Mention one standout project or specialization in the first 20 seconds.',
      'Avoid Biography Dump: Skip kindergarten or non-relevant coursework; focus on software engineering impact.',
      'Pacing: Aim for 75 to 90 seconds (around 150-180 spoken words).',
    ],
    keyQuestions: [
      '"Tell me about yourself and what brought you to our team."',
      '"What is your engineering superpower?"',
    ],
    commonPitfalls: [
      'Reading verbatim from memory with flat robotic intonation.',
      'Trailing off at the end without connecting back to why you are excited for this specific role.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="24" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">90-SECOND ELEVATOR PITCH TIMELINE</text>
        
        {/* Timeline Bar */}
        <line x1="40" y1="75" x2="500" y2="75" stroke="#334155" strokeWidth="4" />

        {/* Phase 1 */}
        <circle cx="90" cy="75" r="14" fill="#3b82f6" />
        <text x="90" y="80" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">1</text>
        <text x="90" y="108" fill="#93c5fd" fontSize="11" fontWeight="bold" textAnchor="middle">PRESENT (0-30s)</text>
        <text x="90" y="124" fill="#cbd5e1" fontSize="9" textAnchor="middle">Current Role &amp; Core Stack</text>

        {/* Phase 2 */}
        <circle cx="270" cy="75" r="14" fill="#10b981" />
        <text x="270" y="80" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">2</text>
        <text x="270" y="108" fill="#86efac" fontSize="11" fontWeight="bold" textAnchor="middle">PAST (30-60s)</text>
        <text x="270" y="124" fill="#cbd5e1" fontSize="9" textAnchor="middle">Key Architectural Win</text>

        {/* Phase 3 */}
        <circle cx="450" cy="75" r="14" fill="#f59e0b" />
        <text x="450" y="80" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">3</text>
        <text x="450" y="108" fill="#fde68a" fontSize="11" fontWeight="bold" textAnchor="middle">FUTURE (60-90s)</text>
        <text x="450" y="124" fill="#cbd5e1" fontSize="9" textAnchor="middle">Alignment with Team Goals</text>
      </svg>
    ),
  },

  'communication': {
    id: 'communication',
    moduleNum: '01',
    moduleTitle: 'Interview Fundamentals',
    title: 'Communication and HR preparation',
    summary: 'The STAR framework (Situation, Task, Action, Result) with precise quantitative time allocation.',
    practiceFocus: 'Communication',
    bulletPoints: [
      'Situation (15%): Set company, scale, and problem context without unnecessary backstory.',
      'Task (10%): Clearly define the challenge or goal you were accountable for solving.',
      'Action (60%): The meat of your answer—decisions made, trade-offs weighed, and obstacles overcome.',
      'Result (15%): Concrete numbers, lessons learned, and systemic improvements created.',
    ],
    keyQuestions: [
      '"Tell me about a time you disagreed with a principal engineer or product manager."',
      '"Describe a situation where a production deployment caused unexpected downtime."',
    ],
    commonPitfalls: [
      'Spending 70% of the time describing the situation and running out of time for your personal action.',
      'Claiming "we did this" without highlighting what you specifically engineered.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="22" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">THE STAR METHOD ANSWER ALLOCATION</text>
        
        <rect x="30" y="42" width="105" height="85" rx="6" fill="#1e293b" stroke="#3b82f6" />
        <text x="82" y="65" fill="#60a5fa" fontSize="14" fontWeight="bold" textAnchor="middle">S</text>
        <text x="82" y="82" fill="#f1f5f9" fontSize="10" fontWeight="600" textAnchor="middle">Situation</text>
        <text x="82" y="98" fill="#94a3b8" fontSize="9" textAnchor="middle">Context &amp; Scale</text>
        <text x="82" y="115" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">~15% time</text>

        <rect x="150" y="42" width="105" height="85" rx="6" fill="#1e293b" stroke="#10b981" />
        <text x="202" y="65" fill="#34d399" fontSize="14" fontWeight="bold" textAnchor="middle">T</text>
        <text x="202" y="82" fill="#f1f5f9" fontSize="10" fontWeight="600" textAnchor="middle">Task</text>
        <text x="202" y="98" fill="#94a3b8" fontSize="9" textAnchor="middle">Your Target Goal</text>
        <text x="202" y="115" fill="#34d399" fontSize="9" fontWeight="bold" textAnchor="middle">~10% time</text>

        <rect x="270" y="38" width="125" height="92" rx="6" fill="#172554" stroke="#60a5fa" strokeWidth="2" />
        <text x="332" y="63" fill="#93c5fd" fontSize="16" fontWeight="bold" textAnchor="middle">A (Core)</text>
        <text x="332" y="82" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">Action Taken</text>
        <text x="332" y="98" fill="#cbd5e1" fontSize="9" textAnchor="middle">Decisions &amp; Trade-offs</text>
        <text x="332" y="116" fill="#93c5fd" fontSize="10" fontWeight="bold" textAnchor="middle">~60% of answer</text>

        <rect x="410" y="42" width="100" height="85" rx="6" fill="#1e293b" stroke="#f59e0b" />
        <text x="460" y="65" fill="#fbbf24" fontSize="14" fontWeight="bold" textAnchor="middle">R</text>
        <text x="460" y="82" fill="#f1f5f9" fontSize="10" fontWeight="600" textAnchor="middle">Result</text>
        <text x="460" y="98" fill="#94a3b8" fontSize="9" textAnchor="middle">Metrics &amp; Impact</text>
        <text x="460" y="115" fill="#fbbf24" fontSize="9" fontWeight="bold" textAnchor="middle">~15% time</text>
      </svg>
    ),
  },

  'variables': {
    id: 'variables',
    moduleNum: '02',
    moduleTitle: 'Programming Fundamentals',
    title: 'Variables and data types',
    summary: 'Memory allocation mechanics: Stack execution frames vs Heap object storage, mutability, and pointer semantics.',
    bulletPoints: [
      'Stack Allocation: Fixed-size primitive values, local variables, and function call frames (fast LIFO, auto-deallocated).',
      'Heap Allocation: Dynamic-size objects, arrays, and closures (managed by garbage collector or manual dealloc).',
      'Pass by Value vs Reference: Primitive values copied by value; object variables store pointers/references.',
      'Overflow & Boundary: Integer overflow, floating point 0.1+0.2 !== 0.3 precision, null/undefined safety.',
    ],
    keyQuestions: [
      '"Explain the difference between stack and heap memory in runtime environments."',
      '"How do closures retain references to enclosing scope variables?"',
    ],
    commonPitfalls: [
      'Mutating function argument objects directly without copying, causing hidden side effects.',
      'Assuming primitive numbers and strings take heap references in all languages.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 160" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="160" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="24" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">STACK (LIFO) VS HEAP MEMORY</text>
        
        {/* Stack Box */}
        <rect x="40" y="40" width="200" height="105" rx="6" fill="#1e293b" stroke="#38bdf8" />
        <text x="140" y="60" fill="#38bdf8" fontSize="12" fontWeight="bold" textAnchor="middle">STACK MEMORY</text>
        <rect x="55" y="72" width="170" height="20" rx="3" fill="#0f172a" />
        <text x="65" y="86" fill="#94a3b8" fontSize="10">int x = 42 (Primitive)</text>
        <rect x="55" y="98" width="170" height="20" rx="3" fill="#0f172a" />
        <text x="65" y="112" fill="#38bdf8" fontSize="10">ptr -&gt; 0x7FFF80 (Pointer)</text>

        {/* Pointer Arrow */}
        <path d="M 225 108 L 295 85" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" />

        {/* Heap Box */}
        <rect x="300" y="40" width="200" height="105" rx="6" fill="#1e293b" stroke="#10b981" />
        <text x="400" y="60" fill="#10b981" fontSize="12" fontWeight="bold" textAnchor="middle">HEAP MEMORY</text>
        <rect x="315" y="72" width="170" height="55" rx="3" fill="#0f172a" stroke="#f59e0b" />
        <text x="325" y="90" fill="#e2e8f0" fontSize="10">Object @ 0x7FFF80</text>
        <text x="325" y="105" fill="#94a3b8" fontSize="9">&#123; user: "Alex", role: "Eng" &#125;</text>
        <text x="325" y="118" fill="#86efac" fontSize="8">Dynamic GC Managed</text>
      </svg>
    ),
  },

  'conditions-loops': {
    id: 'conditions-loops',
    moduleNum: '02',
    moduleTitle: 'Programming Fundamentals',
    title: 'Conditions and loops',
    summary: 'Branch prediction, loop invariants, early exit patterns, and avoiding infinite iterations.',
    bulletPoints: [
      'Early Return Pattern: Guard clauses eliminate nested if/else pyramids and reduce cognitive load.',
      'Loop Invariants: A condition that holds true before loop starts, during each iteration, and after termination.',
      'Off-by-One Guard: Distinguish `<=` vs `<` when iterating 0-indexed arrays.',
      'Time Complexity: Nested loops O(N^2) vs single pass O(N) with hash map lookups.',
    ],
    keyQuestions: [
      '"How do you structure code to avoid the Arrow Anti-Pattern of deeply nested if-statements?"',
      '"What is a loop invariant, and how does it guarantee algorithm correctness?"',
    ],
    commonPitfalls: [
      'Modifying an array or collection while iterating over it, causing skipped elements.',
      'Failing to verify termination condition on while loops with complex counter updates.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="24" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">GUARD CLAUSE VS NESTED CONDITION FLOW</text>
        
        {/* Guard Clause Path */}
        <rect x="40" y="45" width="210" height="85" rx="6" fill="#142820" stroke="#10b981" />
        <text x="145" y="66" fill="#86efac" fontSize="11" fontWeight="bold" textAnchor="middle">GUARD CLAUSE (RECOMMENDED)</text>
        <text x="55" y="86" fill="#e2e8f0" fontSize="10" fontFamily="monospace">if (!isValid) return error;</text>
        <text x="55" y="102" fill="#e2e8f0" fontSize="10" fontFamily="monospace">if (cache.has(k)) return cache;</text>
        <text x="55" y="118" fill="#86efac" fontSize="10" fontFamily="monospace">return computeResult();</text>

        {/* Nested anti-pattern */}
        <rect x="290" y="45" width="210" height="85" rx="6" fill="#2e1418" stroke="#ef4444" />
        <text x="395" y="66" fill="#fca5a5" fontSize="11" fontWeight="bold" textAnchor="middle">NESTED PYRAMID (AVOID)</text>
        <text x="305" y="86" fill="#e2e8f0" fontSize="10" fontFamily="monospace">if (isValid) &#123;</text>
        <text x="320" y="102" fill="#e2e8f0" fontSize="10" fontFamily="monospace">if (!cache) &#123; if (x) ... &#125;&#125;</text>
        <text x="305" y="118" fill="#fca5a5" fontSize="9">Deep indentation &amp; bugs</text>
      </svg>
    ),
  },

  'functions': {
    id: 'functions',
    moduleNum: '02',
    moduleTitle: 'Programming Fundamentals',
    title: 'Functions and problem-solving',
    summary: 'Decomposing complex business workflows into idempotent, testable, pure functions.',
    practiceFocus: 'Problem solving',
    bulletPoints: [
      'Idempotency: An operation that produces the same system state when executed multiple times (e.g. payment processing).',
      'Pure Functions: Return value determined only by input arguments with zero observable side effects.',
      'Single Responsibility Principle: A function should do one thing, do it well, and do it only.',
      'Recursion vs Iteration: Tail-call optimization, stack overflow depth, and memoization trees.',
    ],
    keyQuestions: [
      '"How do you make an API endpoint idempotent when payment webhooks can retry multiple times?"',
      '"What are the trade-offs of recursion versus iterative loops with an explicit stack?"',
    ],
    commonPitfalls: [
      'Writing monolithic 200-line functions with mixed concerns (database queries + business logic + HTTP rendering).',
      'Hidden global state mutation inside utility functions.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="24" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">IDEMPOTENT FUNCTION PIPELINE</text>
        
        <rect x="25" y="55" width="95" height="60" rx="6" fill="#1e293b" stroke="#94a3b8" />
        <text x="72" y="82" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">Input Data</text>
        <text x="72" y="98" fill="#94a3b8" fontSize="9" textAnchor="middle">Idempotency Key</text>

        <path d="M 120 85 L 145 85" stroke="#3b82f6" strokeWidth="2" />

        <rect x="145" y="50" width="110" height="70" rx="6" fill="#1e293b" stroke="#3b82f6" />
        <text x="200" y="78" fill="#60a5fa" fontSize="11" fontWeight="bold" textAnchor="middle">Validate</text>
        <text x="200" y="96" fill="#cbd5e1" fontSize="9" textAnchor="middle">Schema &amp; Auth</text>

        <path d="M 255 85 L 280 85" stroke="#10b981" strokeWidth="2" />

        <rect x="280" y="50" width="115" height="70" rx="6" fill="#1e293b" stroke="#10b981" />
        <text x="337" y="78" fill="#86efac" fontSize="11" fontWeight="bold" textAnchor="middle">Pure Transform</text>
        <text x="337" y="96" fill="#cbd5e1" fontSize="9" textAnchor="middle">Zero Side Effects</text>

        <path d="M 395 85 L 420 85" stroke="#f59e0b" strokeWidth="2" />

        <rect x="420" y="55" width="95" height="60" rx="6" fill="#1e293b" stroke="#f59e0b" />
        <text x="467" y="82" fill="#fde68a" fontSize="11" fontWeight="bold" textAnchor="middle">Safe Output</text>
        <text x="467" y="98" fill="#94a3b8" fontSize="9" textAnchor="middle">Consistent State</text>
      </svg>
    ),
  },

  'arrays-strings': {
    id: 'arrays-strings',
    moduleNum: '03',
    moduleTitle: 'Data Structures and Algorithms',
    title: 'Arrays and strings',
    summary: 'Contiguous memory layout, two-pointer paradigms, sliding window technique, and string immutability.',
    bulletPoints: [
      'Two-Pointer Pattern: Opposite ends moving toward center for sorted pairs; fast/slow pointers for cycle/partitioning.',
      'Sliding Window: Expanding and shrinking subarray window to track maximum sum or substring with constraint in O(N).',
      'Prefix Sum: Precomputing cumulative sums enables O(1) subarray range query evaluations.',
      'String Builder: String concatenation in loops creates O(N^2) copies; use string buffers or array joins.',
    ],
    keyQuestions: [
      '"Find the length of the longest substring without repeating characters in O(N) time."',
      '"How does a sliding window optimize a brute force O(N^2) search down to linear O(N) time?"',
    ],
    commonPitfalls: [
      'Forgetting that strings in languages like Java, Python, and JavaScript are immutable.',
      'Re-computing window sums from scratch inside each step instead of incrementing right and decrementing left.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="24" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">SLIDING WINDOW &amp; TWO-POINTER ARRAY</text>
        
        {/* Array Cells */}
        {[2, 1, 5, 2, 8, 1, 4].map((num, i) => {
          const inWindow = i >= 2 && i <= 4;
          return (
            <g key={i}>
              <rect
                x={80 + i * 55}
                y={55}
                width={45}
                height={45}
                rx={4}
                fill={inWindow ? '#1e3a5f' : '#1e293b'}
                stroke={inWindow ? '#38bdf8' : '#334155'}
                strokeWidth={inWindow ? 2 : 1}
              />
              <text x={80 + i * 55 + 22} y={83} fill="#ffffff" fontSize="14" fontWeight="bold" textAnchor="middle">
                {num}
              </text>
              <text x={80 + i * 55 + 22} y={118} fill="#64748b" fontSize="9" textAnchor="middle">
                [{i}]
              </text>
            </g>
          );
        })}

        {/* Window Marker */}
        <text x={245} y={45} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">Left Pointer [2]</text>
        <text x={355} y={45} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">Right Pointer [4]</text>
        <path d="M 190 50 L 355 50" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    ),
  },

  'search-sort': {
    id: 'search-sort',
    moduleNum: '03',
    moduleTitle: 'Data Structures and Algorithms',
    title: 'Searching and sorting',
    summary: 'Binary search invariants, merge sort divide-and-conquer, quicksort partition pivot choices, and stability.',
    bulletPoints: [
      'Binary Search Invariant: `low <= high` with `mid = low + (high - low) / 2` to prevent 32-bit integer overflow.',
      'Merge Sort: Guaranteed O(N log N) time complexity with stable ordering, trade-off is O(N) auxiliary memory.',
      'QuickSort: Average O(N log N) in-place sorting; worst-case O(N^2) mitigated via randomized pivot selection.',
      'Search on Answer: Binary search can be applied to monotonic predicates (e.g. "is capacity X sufficient?").',
    ],
    keyQuestions: [
      '"Search in a rotated sorted array in O(log N) time."',
      '"Why does quicksort frequently outperform mergesort in practice despite both having O(N log N) average time?"',
    ],
    commonPitfalls: [
      'Calculating `mid = (low + high) / 2` which overflows for large arrays in languages with fixed integers.',
      'Infinite loops caused by updating `high = mid` instead of `high = mid - 1`.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="24" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">BINARY SEARCH INVARIANT LOGIC</text>
        
        <rect x="40" y="48" width="460" height="35" rx="4" fill="#1e293b" stroke="#334155" />
        
        {/* Left half eliminated */}
        <rect x="40" y="48" width="220" height="35" rx="4" fill="#2d1d24" stroke="#7f1d1d" />
        <text x="150" y="70" fill="#fca5a5" fontSize="10" textAnchor="middle">Discarded: Target &gt; Mid</text>

        {/* Mid point */}
        <line x1="260" y1="40" x2="260" y2="92" stroke="#f59e0b" strokeWidth="2.5" />
        <text x="260" y="108" fill="#f59e0b" fontSize="11" fontWeight="bold" textAnchor="middle">MID [Index 4]</text>

        {/* Active search half */}
        <rect x="270" y="48" width="230" height="35" rx="4" fill="#142820" stroke="#10b981" />
        <text x="385" y="70" fill="#86efac" fontSize="10" textAnchor="middle">Search Space: [Mid+1 ... High]</text>

        <text x="50" y="40" fill="#94a3b8" fontSize="10">LOW [0]</text>
        <text x="490" y="40" fill="#94a3b8" fontSize="10">HIGH [8]</text>
      </svg>
    ),
  },

  'hashing-lists': {
    id: 'hashing-lists',
    moduleNum: '03',
    moduleTitle: 'Data Structures and Algorithms',
    title: 'Hashing and linked lists',
    summary: 'Hash functions, collision resolution via chaining/open addressing, and linked list cycle detection (Floyd\'s algorithm).',
    bulletPoints: [
      'Hash Map Mechanics: Key mapped via hash function to array bucket; collisions resolved via linked list or red-black tree.',
      'Amortized O(1): Average O(1) read/write; degrades to O(N) under severe collision or poor hash distributions.',
      'Floyd\'s Tortoise and Hare: Fast pointer moves 2 steps, slow moves 1 step; collision indicates a cycle.',
      'Dummy Head Technique: Simplifies edge cases when inserting or deleting nodes at the front of a linked list.',
    ],
    keyQuestions: [
      '"Design an LRU (Least Recently Used) cache with O(1) get and put operations."',
      '"Detect and return the node where a linked list cycle begins without extra memory."',
    ],
    commonPitfalls: [
      'Losing node pointer references before attaching the new next node during linked list reversal.',
      'Forgetting that objects used as hash keys must have stable, immutable hash and equality implementations.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="22" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">HASH TABLE BUCKETS &amp; LINKED LIST CHAINING</text>
        
        {/* Bucket Array */}
        <rect x="40" y="40" width="70" height="25" fill="#1e293b" stroke="#475569" />
        <text x="75" y="57" fill="#94a3b8" fontSize="9" textAnchor="middle">Bucket [0]</text>

        <rect x="40" y="65" width="70" height="25" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
        <text x="75" y="82" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">Bucket [1]</text>

        <rect x="40" y="90" width="70" height="25" fill="#1e293b" stroke="#475569" />
        <text x="75" y="107" fill="#94a3b8" fontSize="9" textAnchor="middle">Bucket [2]</text>

        {/* Chained Linked List Nodes */}
        <path d="M 110 77 L 150 77" stroke="#38bdf8" strokeWidth="1.5" />
        <rect x="150" y="62" width="110" height="30" rx="4" fill="#0f172a" stroke="#38bdf8" />
        <text x="205" y="81" fill="#f8fafc" fontSize="10" textAnchor="middle">Key: "user" | val: 42</text>

        <path d="M 260 77 L 300 77" stroke="#10b981" strokeWidth="1.5" />
        <rect x="300" y="62" width="115" height="30" rx="4" fill="#0f172a" stroke="#10b981" />
        <text x="357" y="81" fill="#f8fafc" fontSize="10" textAnchor="middle">Key: "token" | val: 89</text>

        <path d="M 415 77 L 445 77" stroke="#64748b" strokeWidth="1.5" />
        <text x="465" y="81" fill="#94a3b8" fontSize="11" fontFamily="monospace">NULL</text>
      </svg>
    ),
  },

  'oop': {
    id: 'oop',
    moduleNum: '04',
    moduleTitle: 'Core Computer Science & Systems',
    title: 'Object-oriented architecture',
    summary: 'SOLID principles, composition over inheritance, design patterns (Factory, Observer, Strategy), and decoupled domain design.',
    bulletPoints: [
      'Single Responsibility (SRP): A class should have only one reason to change.',
      'Open-Closed (OCP): Open for extension via interfaces, closed for direct source modification.',
      'Liskov Substitution (LSP): Subtypes must be substitutable for their base types without breaking invariants.',
      'Dependency Inversion (DIP): Depend upon abstractions (interfaces), never concrete implementations.',
    ],
    keyQuestions: [
      '"Design an extensible parking lot or payment processor using SOLID principles."',
      '"Why is composition generally favored over deep class inheritance hierarchies?"',
    ],
    commonPitfalls: [
      'Creating 5-level deep inheritance trees where child classes inherit irrelevant behaviors.',
      'Coupling domain services directly to concrete third-party SDKs instead of interface adapters.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="22" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">DEPENDENCY INVERSION &amp; DECOUPLED ARCHITECTURE</text>
        
        {/* High-level service */}
        <rect x="35" y="48" width="130" height="70" rx="6" fill="#1e293b" stroke="#38bdf8" />
        <text x="100" y="75" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">OrderService</text>
        <text x="100" y="93" fill="#94a3b8" fontSize="9" textAnchor="middle">Domain Logic</text>

        {/* Interface */}
        <path d="M 165 83 L 205 83" stroke="#f59e0b" strokeWidth="1.5" />
        <rect x="205" y="48" width="130" height="70" rx="6" fill="#1e293b" stroke="#f59e0b" />
        <text x="270" y="75" fill="#f59e0b" fontSize="11" fontWeight="bold" textAnchor="middle">&lt;&lt;IPaymentGateway&gt;&gt;</text>
        <text x="270" y="93" fill="#cbd5e1" fontSize="9" textAnchor="middle">+processPayment()</text>

        {/* Implementations */}
        <path d="M 335 70 L 375 58" stroke="#10b981" strokeWidth="1.5" />
        <rect x="375" y="42" width="130" height="34" rx="4" fill="#0f172a" stroke="#10b981" />
        <text x="440" y="63" fill="#86efac" fontSize="10" textAnchor="middle">StripeAdapter</text>

        <path d="M 335 95 L 375 105" stroke="#10b981" strokeWidth="1.5" />
        <rect x="375" y="90" width="130" height="34" rx="4" fill="#0f172a" stroke="#10b981" />
        <text x="440" y="111" fill="#86efac" fontSize="10" textAnchor="middle">PayPalAdapter</text>
      </svg>
    ),
  },

  'dbms': {
    id: 'dbms',
    moduleNum: '04',
    moduleTitle: 'Core Computer Science & Systems',
    title: 'Database management systems',
    summary: 'B+ Tree indexing mechanics, query execution plans, ACID transactions, and isolation levels (Read Committed vs Serializable).',
    bulletPoints: [
      'B+ Tree Indexing: Balanced tree with high fan-out; leaf nodes contain sorted keys and linked list for efficient range scans.',
      'Composite Index Order: Leftmost prefix rule dictates whether queries can utilize multi-column index `(tenant_id, created_at)`.',
      'ACID Guarantees: Atomicity, Consistency, Isolation (dirty reads, non-repeatable reads, phantom reads), Durability.',
      'Zero-Downtime Migration: Expand-contract pattern (add column -> dual write -> backfill -> read new -> drop old).',
    ],
    keyQuestions: [
      '"How do you optimize an SQL query performing a full table scan on 20 million rows?"',
      '"What is the difference between optimistic concurrency control and pessimistic locking?"',
    ],
    commonPitfalls: [
      'Applying functions to indexed columns in WHERE clauses (e.g. `WHERE YEAR(created_at) = 2026`), negating index usage.',
      'Assuming NoSQL automatically means faster performance without analyzing access patterns.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="22" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">B+ TREE INDEX LOOKUP TRAVERSAL</text>
        
        {/* Root Node */}
        <rect x="220" y="38" width="100" height="28" rx="4" fill="#1e293b" stroke="#38bdf8" />
        <text x="270" y="56" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">[ 50 | 100 ]</text>

        {/* Branch Lines */}
        <path d="M 240 66 L 140 85" stroke="#475569" strokeWidth="1.5" />
        <path d="M 300 66 L 400 85" stroke="#475569" strokeWidth="1.5" />

        {/* Leaf Nodes */}
        <rect x="70" y="85" width="140" height="34" rx="4" fill="#0f172a" stroke="#10b981" />
        <text x="140" y="106" fill="#86efac" fontSize="10" textAnchor="middle">Keys: [10, 20, 35, 48]</text>

        <rect x="330" y="85" width="140" height="34" rx="4" fill="#0f172a" stroke="#10b981" />
        <text x="400" y="106" fill="#86efac" fontSize="10" textAnchor="middle">Keys: [55, 72, 89, 99]</text>

        {/* Linked list between leaves */}
        <path d="M 210 102 L 330 102" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />
        <text x="270" y="125" fill="#f59e0b" fontSize="9" textAnchor="middle">Linked Leaf Range Scan</text>
      </svg>
    ),
  },

  'os-linux': {
    id: 'os-linux',
    moduleNum: '04',
    moduleTitle: 'Core Computer Science & Systems',
    title: 'Operating systems & Linux',
    summary: 'Virtual memory paging, MMU address translation, process vs thread scheduling, mutexes, and Linux cgroups/namespaces.',
    bulletPoints: [
      'Virtual Memory: Isolates process address spaces; Memory Management Unit (MMU) translates virtual addresses to physical RAM frames.',
      'Page Faults: Occur when referenced memory is not currently mapped into physical RAM (swapped to disk).',
      'Thread Synchronization: Race conditions, deadlocks (mutual exclusion, hold & wait, no preemption, circular wait).',
      'Linux Containers: Built using kernel cgroups (resource limits) and namespaces (isolated PID, network, mount views).',
    ],
    keyQuestions: [
      '"What happens under the hood when a process experiences a minor vs major page fault?"',
      '"How do you detect and prevent deadlocks in high-concurrency multi-threaded services?"',
    ],
    commonPitfalls: [
      'Confusing multi-processing (separate memory space) with multi-threading (shared memory address space).',
      'Holding locks across network calls or long I/O operations.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="22" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">VIRTUAL TO PHYSICAL MEMORY PAGING</text>
        
        {/* Virtual Address Space */}
        <rect x="35" y="45" width="130" height="85" rx="6" fill="#1e293b" stroke="#38bdf8" />
        <text x="100" y="65" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">Virtual Address</text>
        <rect x="45" y="75" width="110" height="20" fill="#0f172a" />
        <text x="100" y="89" fill="#e2e8f0" fontSize="9" textAnchor="middle">Page 0 (Code)</text>
        <rect x="45" y="100" width="110" height="20" fill="#0f172a" />
        <text x="100" y="114" fill="#e2e8f0" fontSize="9" textAnchor="middle">Page 1 (Heap)</text>

        {/* MMU & Page Table */}
        <path d="M 165 87 L 215 87" stroke="#f59e0b" strokeWidth="2" />
        <rect x="215" y="52" width="110" height="70" rx="6" fill="#1e293b" stroke="#f59e0b" />
        <text x="270" y="78" fill="#f59e0b" fontSize="11" fontWeight="bold" textAnchor="middle">MMU &amp; Page Table</text>
        <text x="270" y="98" fill="#cbd5e1" fontSize="9" textAnchor="middle">Virtual -&gt; Frame</text>

        {/* Physical RAM */}
        <path d="M 325 87 L 375 87" stroke="#10b981" strokeWidth="2" />
        <rect x="375" y="45" width="130" height="85" rx="6" fill="#1e293b" stroke="#10b981" />
        <text x="440" y="65" fill="#10b981" fontSize="11" fontWeight="bold" textAnchor="middle">Physical RAM</text>
        <rect x="385" y="75" width="110" height="20" fill="#0f172a" />
        <text x="440" y="89" fill="#86efac" fontSize="9" textAnchor="middle">Frame 42</text>
        <rect x="385" y="100" width="110" height="20" fill="#0f172a" />
        <text x="440" y="114" fill="#86efac" fontSize="9" textAnchor="middle">Frame 98</text>
      </svg>
    ),
  },

  'tech-sim': {
    id: 'tech-sim',
    moduleNum: '05',
    moduleTitle: 'Real-world Interview Simulation',
    title: 'Technical and architectural rounds',
    summary: 'Distributed system design: load balancing, microservice boundaries, caching strategies, replication, and failover.',
    practiceFocus: 'Technical depth',
    bulletPoints: [
      'CAP Theorem: Consistency vs Availability under network partitions (CP systems like Paxos/Raft vs AP like DynamoDB).',
      'Caching Strategies: Cache-aside, read-through, write-through, and cache stampede prevention (mutex locks / jitter TTL).',
      'Database Sharding: Consistent hashing prevents massive re-sharding when nodes are added or removed.',
      'Message Queues & Event Streaming: Decouple producers and consumers; handle backpressure with Kafka or SQS.',
    ],
    keyQuestions: [
      '"Design a URL shortening service (like Bitly) serving 100k requests/sec with 99.99% availability."',
      '"How do you prevent cache stampede during breaking news events in a high-traffic media application?"',
    ],
    commonPitfalls: [
      'Jumping into specific technology names (Kafka, Redis) before clarifying QPS, storage size, and latency requirements.',
      'Designing single points of failure without discussing active-active failover or disaster recovery.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="20" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">DISTRIBUTED HIGH-SCALE SYSTEM ARCHITECTURE</text>
        
        {/* Clients */}
        <rect x="20" y="45" width="70" height="75" rx="6" fill="#1e293b" stroke="#94a3b8" />
        <text x="55" y="80" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">Clients</text>
        <text x="55" y="96" fill="#64748b" fontSize="8" textAnchor="middle">Web / Mobile</text>

        <path d="M 90 82 L 120 82" stroke="#38bdf8" strokeWidth="2" />

        {/* Load Balancer */}
        <rect x="120" y="45" width="75" height="75" rx="6" fill="#1e293b" stroke="#38bdf8" />
        <text x="157" y="80" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">Load Balancer</text>
        <text x="157" y="96" fill="#94a3b8" fontSize="8" textAnchor="middle">Nginx / ALB</text>

        <path d="M 195 82 L 225 82" stroke="#10b981" strokeWidth="2" />

        {/* App Tier */}
        <rect x="225" y="40" width="90" height="85" rx="6" fill="#1e293b" stroke="#10b981" />
        <text x="270" y="70" fill="#10b981" fontSize="10" fontWeight="bold" textAnchor="middle">App Services</text>
        <text x="270" y="85" fill="#e2e8f0" fontSize="9" textAnchor="middle">Stateless API</text>
        <text x="270" y="105" fill="#86efac" fontSize="8" textAnchor="middle">Auto-scaling</text>

        {/* Cache & DB */}
        <path d="M 315 65 L 350 55" stroke="#f59e0b" strokeWidth="1.5" />
        <rect x="350" y="38" width="80" height="40" rx="4" fill="#0f172a" stroke="#f59e0b" />
        <text x="390" y="62" fill="#fde68a" fontSize="9" fontWeight="bold" textAnchor="middle">Redis Cache</text>

        <path d="M 315 95 L 350 105" stroke="#a855f7" strokeWidth="1.5" />
        <rect x="350" y="88" width="80" height="40" rx="4" fill="#0f172a" stroke="#a855f7" />
        <text x="390" y="112" fill="#d8b4fe" fontSize="9" fontWeight="bold" textAnchor="middle">Primary DB</text>

        <path d="M 430 108 L 460 108" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3 3" />
        <rect x="460" y="88" width="65" height="40" rx="4" fill="#0f172a" stroke="#64748b" />
        <text x="492" y="112" fill="#94a3b8" fontSize="8" textAnchor="middle">Read Replica</text>
      </svg>
    ),
  },

  'behavioral-sim': {
    id: 'behavioral-sim',
    moduleNum: '05',
    moduleTitle: 'Real-world Interview Simulation',
    title: 'Behavioral & Leadership scenarios',
    summary: 'Executive presence, blameless post-mortems, handling critical production outages, and driving engineering alignment.',
    practiceFocus: 'Leadership',
    bulletPoints: [
      'Blameless Culture: Focus on systemic process and tool improvements rather than individual finger-pointing.',
      'Constructive Disagreement: "Disagree and Commit"—articulate risks objectively, present empirical data, then back the consensus.',
      'Mentorship & Delegation: Demonstrating how you elevated junior colleagues and multiplied team throughput.',
      'Customer Empathy: Balancing pristine code perfectionism with immediate user value delivery.',
    ],
    keyQuestions: [
      '"Tell me about the worst production outage you experienced and how you led the mitigation."',
      '"Describe a situation where you had to influence an engineering team without direct managerial authority."',
    ],
    commonPitfalls: [
      'Blaming former colleagues, managers, or product stakeholders for project setbacks.',
      'Giving generic textbook answers without personal vulnerability or genuine self-reflection.',
    ],
    diagramSvg: (
      <svg viewBox="0 0 540 150" width="100%" height="auto" style={{ maxHeight: '180px' }}>
        <rect width="540" height="150" rx="8" fill="#141822" stroke="#252f44" />
        <text x="270" y="22" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="monospace">BLAMELESS INCIDENT RESOLUTION CYCLE</text>
        
        <circle cx="90" cy="85" r="32" fill="#1e293b" stroke="#ef4444" strokeWidth="1.5" />
        <text x="90" y="80" fill="#fca5a5" fontSize="10" fontWeight="bold" textAnchor="middle">1. TRIAGE</text>
        <text x="90" y="95" fill="#e2e8f0" fontSize="8" textAnchor="middle">Stop Bleeding</text>

        <path d="M 125 85 L 175 85" stroke="#64748b" strokeWidth="2" />

        <circle cx="210" cy="85" r="32" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="210" y="80" fill="#fde68a" fontSize="10" fontWeight="bold" textAnchor="middle">2. 5-WHYS</text>
        <text x="210" y="95" fill="#e2e8f0" fontSize="8" textAnchor="middle">Root Cause</text>

        <path d="M 245 85 L 295 85" stroke="#64748b" strokeWidth="2" />

        <circle cx="330" cy="85" r="32" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
        <text x="330" y="80" fill="#93c5fd" fontSize="10" fontWeight="bold" textAnchor="middle">3. REMEDY</text>
        <text x="330" y="95" fill="#e2e8f0" fontSize="8" textAnchor="middle">Guardrails &amp; CI</text>

        <path d="M 365 85 L 415 85" stroke="#64748b" strokeWidth="2" />

        <circle cx="450" cy="85" r="32" fill="#1e293b" stroke="#10b981" strokeWidth="1.5" />
        <text x="450" y="80" fill="#86efac" fontSize="10" fontWeight="bold" textAnchor="middle">4. SHARE</text>
        <text x="450" y="95" fill="#e2e8f0" fontSize="8" textAnchor="middle">Post-Mortem</text>
      </svg>
    ),
  },
};

// Aliases for compatibility with roadmap topic IDs
ROADMAP_TOPIC_DATA['databases'] = ROADMAP_TOPIC_DATA['dbms'];
ROADMAP_TOPIC_DATA['operating-systems'] = ROADMAP_TOPIC_DATA['os-linux'];
ROADMAP_TOPIC_DATA['technical-practice'] = ROADMAP_TOPIC_DATA['tech-sim'];
ROADMAP_TOPIC_DATA['behavioral-practice'] = ROADMAP_TOPIC_DATA['behavioral-sim'];

