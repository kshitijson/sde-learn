SD.register({
  id: "interview-framework",
  html: String.raw`
<p class="lead">A system design round is a 45-minute conversation, not a quiz with one right answer. The interviewer wants to see how you turn a vague prompt like "Design Swiggy" into a working, scalable design while explaining your trade-offs out loud. A fixed six-step framework keeps you from freezing, rambling or running out of time: <strong>clarify → estimate → API → data model → high-level design → deep dives</strong>.</p>

<h2>Why a framework matters</h2>
<p>Most candidates who fail a design round do not fail because they lack knowledge. They fail because they jump straight to drawing Kafka and Redis boxes, spend 25 minutes on one component, and never reach the parts the interviewer actually wanted to discuss. A framework fixes three problems at once:</p>
<ul>
  <li><strong>Structure</strong>: the interviewer can follow you, and you can follow yourself when nervous.</li>
  <li><strong>Coverage</strong>: every round at Flipkart, Amazon, Razorpay or Google scores roughly the same areas. The framework touches each one.</li>
  <li><strong>Time control</strong>: each step has a budget. When you overshoot, you notice and move on.</li>
</ul>

<h2>The six steps at a glance</h2>
<div data-diagram="flow" data-caption="The six-step flow. Steps 1 to 4 are short but set up everything that follows."></div>

<h3>The 45-minute time budget</h3>
<figure class="svg-fig">
<svg viewBox="0 0 760 210" role="img" aria-label="Timeline of a 45 minute interview split into six steps">
  <text class="s-title" x="380" y="24" text-anchor="middle">A 45-minute round (minutes are approximate)</text>
  <rect class="s-box" x="20" y="50" width="84" height="64" rx="10"/>
  <text class="s-title" x="62" y="78" text-anchor="middle">Clarify</text>
  <text class="s-muted" x="62" y="98" text-anchor="middle">0–5</text>
  <rect class="s-box" x="110" y="50" width="68" height="64" rx="10"/>
  <text class="s-title" x="144" y="78" text-anchor="middle">Estimate</text>
  <text class="s-muted" x="144" y="98" text-anchor="middle">5–9</text>
  <rect class="s-box" x="184" y="50" width="68" height="64" rx="10"/>
  <text class="s-title" x="218" y="78" text-anchor="middle">API</text>
  <text class="s-muted" x="218" y="98" text-anchor="middle">9–13</text>
  <rect class="s-box" x="258" y="50" width="68" height="64" rx="10"/>
  <text class="s-title" x="292" y="78" text-anchor="middle">Data</text>
  <text class="s-muted" x="292" y="98" text-anchor="middle">13–17</text>
  <rect class="s-accent" x="332" y="50" width="168" height="64" rx="10"/>
  <text class="s-title" x="416" y="78" text-anchor="middle">High-level design</text>
  <text class="s-muted" x="416" y="98" text-anchor="middle">17–27</text>
  <rect class="s-amber" x="506" y="50" width="234" height="64" rx="10"/>
  <text class="s-title" x="623" y="78" text-anchor="middle">Deep dives &amp; bottlenecks</text>
  <text class="s-muted" x="623" y="98" text-anchor="middle">27–42</text>
  <line class="s-line" x1="20" y1="140" x2="740" y2="140" marker-end="url(#arrow)"/>
  <text class="s-muted" x="20" y="162">0 min</text>
  <text class="s-muted" x="332" y="162">~17 min: first full design on the board</text>
  <text class="s-muted" x="740" y="162" text-anchor="end">45 min</text>
  <line class="s-dash" x1="332" y1="40" x2="332" y2="150"/>
  <text class="s-text" x="380" y="196" text-anchor="middle">Keep the last 3 minutes for a wrap-up and your questions.</text>
</svg>
<figcaption>Roughly 40% of the time goes to setup, 60% to design and depth. If you are still clarifying at minute 12, you are behind.</figcaption>
</figure>

<table>
  <thead><tr><th>Step</th><th>Time</th><th>Output on the board</th></tr></thead>
  <tbody>
    <tr><td>1. Clarify requirements</td><td>~5 min</td><td>3–5 functional requirements, 3–4 non-functional, what is out of scope</td></tr>
    <tr><td>2. Estimate scale</td><td>~4 min</td><td>DAU, read/write QPS, peak QPS, storage for 5 years</td></tr>
    <tr><td>3. Define the API</td><td>~4 min</td><td>3–6 endpoints with request and response shape</td></tr>
    <tr><td>4. Data model</td><td>~4 min</td><td>Main entities, key fields, choice of SQL or NoSQL</td></tr>
    <tr><td>5. High-level design</td><td>~10 min</td><td>Boxes and arrows covering every functional requirement</td></tr>
    <tr><td>6. Deep dives &amp; bottlenecks</td><td>~15 min</td><td>2–3 hard parts solved in depth, failure handling, scaling</td></tr>
  </tbody>
</table>

<h2>Step by step</h2>
<div class="tabs">
<section data-tab="1. Clarify">
<p>Turn the vague prompt into a scoped problem. Ask about <strong>users and features</strong> (who uses it, what are the 3 most important actions), <strong>scale</strong> (how many users, read-heavy or write-heavy), and <strong>quality</strong> (latency target, can we lose data, is strong consistency needed). Write the answers on the board as two lists: functional and non-functional.</p>
<p>Example for "Design a URL shortener": create a short link, redirect to the long URL, optional custom alias, optional expiry. Out of scope: user accounts, analytics dashboards. Non-functional: redirects under 50 ms p99, 99.99% available, links never lost.</p>
<p>See <strong>Functional vs Non-Functional Requirements</strong> for a full question bank.</p>
</section>
<section data-tab="2. Estimate">
<p>Do quick arithmetic to decide what kind of system you need. The point is not precision but <em>order of magnitude</em>: is this 100 QPS (one server) or 100,000 QPS (a fleet plus caching plus sharding)?</p>
<p>Example: 100 M new URLs a month ≈ 40 writes/s. With a 100:1 read ratio that is 4,000 reads/s, peak ~8,000. Storage: 100 M × 12 months × 5 years × 500 bytes ≈ 3 TB. Conclusion: reads dominate, so caching matters; 3 TB fits in a sharded or even a single large database.</p>
<p>Say out loud what each number means for the design. Numbers you never use are wasted time. See <strong>Back-of-the-Envelope Estimation</strong>.</p>
</section>
<section data-tab="3. API">
<p>List the endpoints that cover each functional requirement. Keep it short: method, path, key parameters, response.</p>
<ul>
  <li><code>POST /v1/urls {longUrl, alias?, expiresAt?}</code> → <code>{shortUrl}</code></li>
  <li><code>GET /{code}</code> → <code>301/302 Location: longUrl</code></li>
  <li><code>DELETE /v1/urls/{code}</code></li>
</ul>
<p>Mention authentication (API key or token), pagination for list endpoints, and idempotency keys for anything involving money (Razorpay-style payment APIs always take an idempotency key).</p>
</section>
<section data-tab="4. Data model">
<p>Name the main entities and their important fields, then pick a storage type with one sentence of justification.</p>
<p>Example: <code>url(code PK, long_url, user_id, created_at, expires_at)</code>. Access pattern is a simple key lookup with huge read volume and no joins, so a key-value or wide-column store (DynamoDB, Cassandra) works well. A relational DB with a primary key index would also work at this scale; say why you prefer one.</p>
<p>The access pattern drives the choice, not fashion. "We need joins and transactions" points to PostgreSQL/MySQL. "We need 1 M writes/s on a simple key" points to Cassandra.</p>
</section>
<section data-tab="5. High-level design">
<p>Draw the simplest architecture that satisfies every functional requirement: client → load balancer → stateless app servers → cache → database, plus any async pieces (queue, workers, CDN, object storage). Walk through one request end to end for each main use case.</p>
<p>Do not optimise yet. A complete simple design beats a half-finished clever one. Once it is on the board, ask: "Does this cover everything? Shall I dive into the hardest parts?"</p>
</section>
<section data-tab="6. Deep dives">
<p>This is where SDE 2 candidates win or lose. Pick the 2–3 hardest problems in <em>this</em> system and solve them properly:</p>
<ul>
  <li>URL shortener: unique ID generation without collisions, cache hit ratio, hot links.</li>
  <li>Chat (WhatsApp): message ordering, delivery receipts, offline users, connection servers.</li>
  <li>Food delivery (Swiggy): live rider location updates, matching orders to riders, surge at 8 pm.</li>
  <li>Payments (Razorpay): exactly-once charging, idempotency, reconciliation.</li>
</ul>
<p>Then cover bottlenecks and failures: what if the cache dies, a DB shard gets hot, a whole data centre goes down? Often the interviewer steers this part; follow their lead.</p>
</section>
</div>

<h2>What interviewers score</h2>
<p>Scoring rubrics differ by company, but most cover the same five areas. The bar changes with level.</p>
<table>
  <thead><tr><th>Area</th><th><span class="tag s1">SDE 1</span> expectation</th><th><span class="tag s2">SDE 2</span> expectation</th></tr></thead>
  <tbody>
    <tr><td>Requirements</td><td>Asks sensible questions, writes down a clear scope</td><td>Drives scoping, identifies the NFRs that shape the design (e.g. "payments need strong consistency")</td></tr>
    <tr><td>Estimation</td><td>Gets order of magnitude right with some help</td><td>Fast and confident; links numbers to decisions (sharding, cache size)</td></tr>
    <tr><td>High-level design</td><td>A working end-to-end design with standard blocks</td><td>Clean design with justified choices and alternatives considered</td></tr>
    <tr><td>Depth</td><td>Can go deep on one area when prompted</td><td>Proactively picks the hard parts; covers failure modes, consistency, hot spots</td></tr>
    <tr><td>Trade-offs &amp; communication</td><td>Explains what each component does</td><td>States trade-offs unprompted ("we accept eventual consistency in the feed to keep reads fast")</td></tr>
  </tbody>
</table>
<div class="callout info">
<strong>The SDE 1 reality</strong>
At many Indian product companies (Flipkart, Swiggy, PhonePe), SDE 1 loops focus more on LLD or machine coding, and the HLD round, if present, is lighter. Being structured and correct on basics (load balancer, cache, DB choice, simple estimation) is usually enough. SDE 2 rounds expect you to lead the conversation and handle depth.
</div>

<h2>Do's and don'ts</h2>
<div class="grid-2">
<div class="card good">
<h3>Do</h3>
<ul>
  <li>Think out loud. Silence gives the interviewer nothing to score.</li>
  <li>Write requirements and numbers on the board; refer back to them.</li>
  <li>Start simple, then evolve: "Version 1 is a single DB; at 50k QPS it breaks, so..."</li>
  <li>State every trade-off: what you gain and what you give up.</li>
  <li>Check in every 8–10 minutes: "Should I go deeper here or move on?"</li>
  <li>Use real numbers (Redis does ~100k ops/s per node, a disk seek is ~10 ms).</li>
</ul>
</div>
<div class="card bad">
<h3>Don't</h3>
<ul>
  <li>Jump to drawing boxes in the first minute.</li>
  <li>Name-drop technologies without saying why ("Let's use Kafka" with no reason).</li>
  <li>Over-engineer: microservices, Kubernetes and three databases for 100 QPS.</li>
  <li>Spend 15 minutes on estimation precision. Round aggressively.</li>
  <li>Argue with hints. If the interviewer pushes, they are guiding you.</li>
  <li>Claim a design has no downsides. Every design has some.</li>
</ul>
</div>
</div>

<h2>Phrases that help</h2>
<div class="callout interview">
<strong>Say this in the interview</strong>
<ul>
  <li><em>Opening:</em> "Before I design anything, let me clarify the scope and the scale. Who are the users and what are the top three things they do?"</li>
  <li><em>Scoping:</em> "I'll treat payments and notifications as out of scope unless you want them. Is that okay?"</li>
  <li><em>Estimation:</em> "I'll round a day to 10<sup>5</sup> seconds to keep the maths simple."</li>
  <li><em>Moving on:</em> "This gives us a working design. The hardest parts are X and Y. Which would you like me to go deeper on?"</li>
  <li><em>Trade-off:</em> "Option A gives lower latency but risks stale data; option B is consistent but adds a network hop. Since this is a feed, I'll pick A."</li>
  <li><em>Unknown:</em> "I haven't used that in production, but here is how I would reason about it..."</li>
  <li><em>Wrap-up:</em> "To summarise: the design handles 20k peak QPS, survives a zone failure, and the main risk is the hot-key problem, which we mitigate with..."</li>
</ul>
</div>

<h2>Common pitfalls</h2>
<ul>
  <li><strong>The silent designer</strong>: draws for five minutes without talking. Narrate as you draw.</li>
  <li><strong>The technology tourist</strong>: lists every tool they know. Pick fewer components and justify each.</li>
  <li><strong>The never-finisher</strong>: perfect API design, no architecture at minute 30. Watch the clock.</li>
  <li><strong>The single-path thinker</strong>: never considers an alternative. Mention at least one option you rejected and why.</li>
  <li><strong>Ignoring failures</strong>: "What if this server dies?" should already be answered before it is asked at SDE 2.</li>
</ul>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>You are 20 minutes into the round and still discussing the API. What should you do?</summary><div>Wrap up the API quickly, state assumptions for the remaining details, and move to the high-level design. A complete design with a rough API scores better than a perfect API with no architecture. Say: "I'll keep the API at this level so we have time for the architecture."</div></details>
<details><summary>Why estimate scale before drawing the design?</summary><div>The numbers decide the architecture. 50 QPS fits on one server with one database; 500k QPS needs caching, replication and sharding. Without estimates you either over-engineer or under-design, and you cannot justify either choice.</div></details>
<details><summary>What is the main difference the interviewer looks for between SDE 1 and SDE 2?</summary><div>Ownership of the conversation and depth. SDE 1 needs a correct, structured design with standard blocks. SDE 2 should drive scoping, proactively find the hard parts, handle failure modes, and explain trade-offs without being asked.</div></details>
<details><summary>The interviewer says "What if the cache goes down?" What is a good structure for your answer?</summary><div>State the impact (all reads hit the DB, possibly 10× load, risk of cascading failure), then the mitigations: replicated cache cluster, request coalescing, rate limiting or load shedding at the DB, circuit breakers, and gradual cache warm-up. End with the trade-off (cost of replicas vs risk).</div></details>
<details><summary>Which deep dives would you pick for "Design WhatsApp"?</summary><div>Good choices: how messages reach online vs offline users (connection servers + message store + push), ordering and delivery receipts (sent/delivered/read), and group message fan-out. End-to-end encryption at a high level is a bonus.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
  <li>Use the same six steps every time: clarify, estimate, API, data model, high-level design, deep dives.</li>
  <li>Aim to have a full end-to-end design on the board by about minute 17–27.</li>
  <li>Spend the most time on the 2–3 parts that are genuinely hard for <em>this</em> system.</li>
  <li>Every number and every component should be tied to a decision or a requirement.</li>
  <li>Talk through trade-offs; SDE 2 candidates are expected to raise them unprompted.</li>
  <li>Check in with the interviewer regularly and follow their hints.</li>
</ul></div>
`,
  diagrams: {
    flow: String.raw`flowchart LR
      A["1. Clarify"] --> B["2. Estimate"] --> C["3. API"] --> D["4. Data model"] --> E["5. High-level design"] --> F["6. Deep dives"]
      F -. "revisit if needed" .-> A`,
  },
});
