SD.register({
  id: "scaling",
  html: String.raw`
<p class="lead">When traffic grows, you have two choices. <strong>Vertical scaling</strong> (scale up) means buying a bigger machine: more CPU, more RAM, faster disks. <strong>Horizontal scaling</strong> (scale out) means adding more machines and splitting the work between them. Scaling up is simple but hits a ceiling; scaling out is nearly unlimited but only works if your servers are <strong>stateless</strong>. Almost every large system, from Flipkart to Netflix, ends up scaling out.</p>

<h2>What it is</h2>
<figure class="svg-fig">
<svg viewBox="0 0 740 270" role="img" aria-label="Vertical scaling grows one server; horizontal scaling adds servers behind a load balancer">
  <text class="s-title" x="180" y="26" text-anchor="middle">Vertical: one bigger box</text>
  <rect class="s-box" x="60" y="170" width="70" height="60" rx="10"/>
  <text class="s-text" x="95" y="198" text-anchor="middle">4 CPU</text>
  <text class="s-muted" x="95" y="216" text-anchor="middle">16 GB</text>
  <line class="s-line" x1="140" y1="200" x2="188" y2="160" marker-end="url(#arrow)"/>
  <rect class="s-accent" x="200" y="60" width="120" height="170" rx="10"/>
  <text class="s-title" x="260" y="135" text-anchor="middle">64 CPU</text>
  <text class="s-text" x="260" y="157" text-anchor="middle">512 GB</text>
  <text class="s-muted" x="260" y="250" text-anchor="middle">has a ceiling and a SPOF</text>

  <line class="s-dash" x1="370" y1="40" x2="370" y2="250"/>

  <text class="s-title" x="560" y="26" text-anchor="middle">Horizontal: many small boxes</text>
  <rect class="s-box" x="500" y="50" width="120" height="40" rx="10"/>
  <text class="s-text" x="560" y="75" text-anchor="middle">Load balancer</text>
  <rect class="s-box" x="400" y="150" width="70" height="60" rx="10"/>
  <text class="s-text" x="435" y="185" text-anchor="middle">App 1</text>
  <rect class="s-box" x="480" y="150" width="70" height="60" rx="10"/>
  <text class="s-text" x="515" y="185" text-anchor="middle">App 2</text>
  <rect class="s-box" x="560" y="150" width="70" height="60" rx="10"/>
  <text class="s-text" x="595" y="185" text-anchor="middle">App 3</text>
  <rect class="s-green" x="640" y="150" width="70" height="60" rx="10"/>
  <text class="s-text" x="675" y="185" text-anchor="middle">+ App N</text>
  <line class="s-line" x1="540" y1="90" x2="440" y2="148" marker-end="url(#arrow)"/>
  <line class="s-line" x1="552" y1="90" x2="517" y2="148" marker-end="url(#arrow)"/>
  <line class="s-line" x1="568" y1="90" x2="593" y2="148" marker-end="url(#arrow)"/>
  <line class="s-line" x1="580" y1="90" x2="672" y2="148" marker-end="url(#arrow)"/>
  <text class="s-muted" x="555" y="250" text-anchor="middle">near-linear growth, needs stateless servers</text>
</svg>
<figcaption>Scale up by growing one machine; scale out by adding machines behind a load balancer.</figcaption>
</figure>

<h2>Vertical vs horizontal</h2>
<div class="grid-2">
<div class="card">
<h3>Vertical scaling (scale up)</h3>
<ul>
  <li>Change the instance type: 4 vCPU → 96 vCPU, 16 GB → 768 GB RAM.</li>
  <li>No code changes, no distributed-systems problems.</li>
  <li>Great first step, and the right answer for many databases for a long time.</li>
  <li>Hard ceiling (the biggest cloud machines), price rises faster than capacity at the top end, often needs a restart, and the box is still a single point of failure.</li>
</ul>
</div>
<div class="card">
<h3>Horizontal scaling (scale out)</h3>
<ul>
  <li>Add more identical servers behind a load balancer.</li>
  <li>Nearly unlimited; uses cheap commodity machines; autoscaling adds and removes servers with load.</li>
  <li>Built-in redundancy: lose one of 20 servers and you lose 5% of capacity, not 100%.</li>
  <li>Needs stateless services, a load balancer, and for data: replication and sharding, which bring consistency challenges.</li>
</ul>
</div>
</div>
<table>
  <thead><tr><th>Aspect</th><th>Vertical</th><th>Horizontal</th></tr></thead>
  <tbody>
    <tr><td>Limit</td><td>Largest available machine</td><td>Practically none for stateless tiers</td></tr>
    <tr><td>Complexity</td><td>Low</td><td>Higher: LB, service discovery, distributed data</td></tr>
    <tr><td>Failure impact</td><td>Whole system down</td><td>Partial capacity loss</td></tr>
    <tr><td>Cost curve</td><td>Gets expensive at the top end</td><td>Roughly linear</td></tr>
    <tr><td>Downtime to scale</td><td>Often a restart</td><td>None (add nodes live)</td></tr>
    <tr><td>Best for</td><td>Early stage, relational DB primary, quick wins</td><td>Web/app tiers, caches, NoSQL stores, workers</td></tr>
  </tbody>
</table>
<div class="callout tip">
<strong>Do not dismiss vertical scaling</strong>
Stack Overflow famously served huge traffic from a small number of powerful SQL Server machines for years. A modern 64-core server with 512 GB RAM and NVMe disks can handle tens of thousands of queries per second. In an interview, saying "we can scale the DB vertically first and shard only when we hit ~X" shows maturity.
</div>

<h2>Stateless services: the key to scaling out</h2>
<p>A service is <strong>stateless</strong> when any server can handle any request, because nothing about the user's session lives only in that server's memory or local disk. State is pushed out to shared stores: databases, caches, object storage. Then the load balancer can send each request anywhere, servers can be added or killed at will, and autoscaling just works.</p>
<p>Typical state that must be moved out:</p>
<ul>
  <li><strong>Session data</strong> (logged-in user, cart) → shared store or token.</li>
  <li><strong>Uploaded files</strong> written to local disk → object storage (S3).</li>
  <li><strong>In-memory caches</strong> that must be consistent → Redis/Memcached.</li>
  <li><strong>Scheduled jobs</strong> that run "on this box" → a job scheduler or queue so they run once, not on every server.</li>
</ul>

<h3>Where to keep session state</h3>
<div class="tabs">
<section data-tab="Sticky sessions">
<p>The load balancer pins each user to one server (using a cookie or IP hash), and the session lives in that server's memory.</p>
<ul>
  <li><strong>Pros:</strong> zero code change; fast (local memory).</li>
  <li><strong>Cons:</strong> if the server dies, its users lose their sessions (logged out, cart gone); uneven load ("hot" servers); scaling down or deploying means draining users. It is really a stateful design wearing a load balancer.</li>
  <li><strong>Use when:</strong> legacy apps, or as a short-term bridge.</li>
</ul>
</section>
<section data-tab="Shared session store">
<p>Sessions live in a central fast store such as Redis or Memcached, keyed by a session id stored in a cookie. Every server reads from it.</p>
<ul>
  <li><strong>Pros:</strong> servers are fully stateless; sessions survive server restarts; easy to revoke a session (delete the key).</li>
  <li><strong>Cons:</strong> one extra network hop (~1 ms) per request; the store must itself be highly available (Redis with replicas).</li>
  <li><strong>Use when:</strong> the default choice for most web apps, e.g. a Flipkart cart or a Zomato login session.</li>
</ul>
</section>
<section data-tab="Tokens (JWT)">
<p>The session data (user id, roles, expiry) is put into a signed token that the client sends on each request. The server verifies the signature; no lookup needed.</p>
<ul>
  <li><strong>Pros:</strong> no session store at all; works well across many microservices and mobile clients.</li>
  <li><strong>Cons:</strong> hard to revoke before expiry (needs short expiry plus refresh tokens, or a deny-list, which re-introduces a store); tokens grow if you stuff data in them; secret/key rotation needs care.</li>
  <li><strong>Use when:</strong> APIs consumed by mobile apps and many services; keep access tokens short-lived (5–15 minutes).</li>
</ul>
</section>
</div>

<h2>The classic evolution: from one server to millions of users</h2>
<p>This story is a favourite in interviews ("how would this system grow?"). Each stage fixes the bottleneck of the previous one. Do not jump to the end state for a small system.</p>

<h3>Stage 1: a single server</h3>
<div data-diagram="s1" data-caption="Web app and database on one machine. Fine for a prototype or a few hundred users."></div>
<p>Everything (web server, app, DB) on one VM. Cheap and simple. Problems: the app and DB fight for CPU and RAM, and any failure takes everything down.</p>

<h3>Stage 2: separate the database</h3>
<div data-diagram="s2" data-caption="App tier and data tier scale independently."></div>
<p>Move the database to its own machine (or a managed service like Amazon RDS). Now you can scale each tier separately and tune the DB machine for I/O. Still two single points of failure.</p>

<h3>Stage 3: load balancer and multiple app servers</h3>
<div data-diagram="s3" data-caption="Stateless app servers behind a load balancer. Sessions move to a shared store."></div>
<p>Make the app stateless and run several copies behind a load balancer. This handles more traffic and survives a server crash. Now the database becomes the bottleneck.</p>

<h3>Stage 4: database replication</h3>
<div data-diagram="s4" data-caption="Writes to the primary; reads spread across replicas."></div>
<p>Most apps are read-heavy (10:1 or more). Add read replicas: writes go to the primary, reads go to replicas. If the primary dies, a replica is promoted. Trade-off: replication lag means a replica may return slightly stale data, so read-your-own-writes paths (e.g. "show my just-placed order") should read from the primary.</p>

<h3>Stage 5: add a cache</h3>
<div data-diagram="s5" data-caption="A cache absorbs most reads before they reach the database."></div>
<p>Put Redis or Memcached in front of the DB for hot data: product details, user profiles, restaurant menus. A 90% hit ratio cuts DB reads by 10×. New problems: cache invalidation and stampedes when a hot key expires.</p>

<h3>Stage 6: add a CDN</h3>
<div data-diagram="s6" data-caption="Static and media content served from edge locations close to users."></div>
<p>Images, JS, CSS and videos move to object storage and are served by a CDN (CloudFront, Akamai, Cloudflare) from edge servers near users. A shopper in Guwahati gets product images from a nearby edge instead of a Mumbai data centre. This removes a huge share of bandwidth from your servers.</p>

<h3>Stage 7: sharding (and beyond)</h3>
<div data-diagram="s7" data-caption="Data split across shards by a key such as user_id. Each shard has its own replicas."></div>
<p>When write volume or data size outgrows one primary, split data across several databases (<strong>shards</strong>) by a key such as <code>user_id</code> or <code>order_id</code>. Each shard holds a subset and has its own replicas. Writes now scale horizontally. Costs: cross-shard queries and transactions become hard, re-sharding is painful (consistent hashing helps), and hot shards appear (a celebrity user, a Big Billion Days bestseller).</p>
<p>Beyond this: message queues for async work (send emails, generate invoices), splitting the monolith into services owned by separate teams, multiple data centres or regions with geo-DNS, and autoscaling groups that add servers before the 8 pm dinner rush.</p>

<table>
  <thead><tr><th>Stage</th><th>Fixes</th><th>Introduces</th></tr></thead>
  <tbody>
    <tr><td>Separate DB</td><td>Resource contention</td><td>Network hop to DB</td></tr>
    <tr><td>LB + app servers</td><td>App CPU limit, app SPOF</td><td>Need for statelessness, LB as a component</td></tr>
    <tr><td>Read replicas</td><td>DB read load, DB SPOF</td><td>Replication lag, stale reads</td></tr>
    <tr><td>Cache</td><td>Read latency and DB load</td><td>Invalidation, stampedes, consistency</td></tr>
    <tr><td>CDN</td><td>Bandwidth and latency for static/media</td><td>Purging stale content, cost</td></tr>
    <tr><td>Sharding</td><td>Write throughput, data size</td><td>Cross-shard queries, rebalancing, hot shards</td></tr>
  </tbody>
</table>

<h2>Trade-offs at a glance</h2>
<div class="grid-3">
<div class="card good">
<h3>Scale up first when</h3>
<ul>
  <li>Traffic is modest and predictable.</li>
  <li>The component is hard to distribute (relational DB primary).</li>
  <li>The team is small and time matters.</li>
</ul>
</div>
<div class="card good">
<h3>Scale out when</h3>
<ul>
  <li>Traffic is large, spiky or growing fast.</li>
  <li>You need high availability (N+1 or N+2 spare capacity).</li>
  <li>The tier is stateless (web, API, workers).</li>
</ul>
</div>
<div class="card bad">
<h3>Watch out for</h3>
<ul>
  <li>Hidden state (local files, in-memory caches, cron on every node).</li>
  <li>The database becoming the real bottleneck after the app scales.</li>
  <li>Over-engineering: sharding at 200 QPS.</li>
</ul>
</div>
</div>

<h2>Real-world examples</h2>
<ul>
  <li><strong>Flipkart Big Billion Days</strong>: app tiers are scaled out well in advance with load tests and pre-provisioned capacity, because autoscaling alone may not react fast enough to a midnight spike.</li>
  <li><strong>Swiggy and Zomato</strong>: traffic follows meal times, so stateless services autoscale up for lunch and dinner and down at night to save cost.</li>
  <li><strong>Netflix</strong>: stateless microservices on AWS autoscaling groups, with data in horizontally scalable Cassandra and content on its own CDN.</li>
  <li><strong>Instagram</strong> (early days): scaled a PostgreSQL setup with sharding by user id, plus heavy use of Memcached, with a very small team.</li>
</ul>

<h2>Common interview questions and pitfalls</h2>
<div class="callout interview">
<strong>Say this in the interview</strong>
"I'll keep the app servers stateless, with sessions in Redis, so we can scale them horizontally behind the load balancer and autoscale for the dinner peak. The database will start as a single primary with read replicas, scaled vertically. Once writes exceed what one primary handles, roughly 10k writes per second, I'll shard by user_id."
</div>
<ul>
  <li>Saying "just add more servers" without making them stateless.</li>
  <li>Forgetting the data tier: scaling the app 10× just moves the bottleneck to the DB.</li>
  <li>Choosing sticky sessions without discussing what happens when a server dies.</li>
  <li>Sharding too early, or not explaining the shard key and its hot-spot risk.</li>
</ul>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>What makes a service stateless, and why does it matter for scaling?</summary><div>No per-user state lives only on one server; all state is in shared stores (DB, cache, object storage) or in the request itself (token). Any server can handle any request, so the load balancer can spread traffic freely, and servers can be added, removed or restarted without users noticing.</div></details>
<details><summary>Give two drawbacks of sticky sessions.</summary><div>(1) If the pinned server crashes, its users lose their sessions. (2) Load can become uneven, and scaling in or deploying requires draining users. They also complicate autoscaling.</div></details>
<details><summary>Why is JWT revocation hard, and how is it usually handled?</summary><div>The server does not look tokens up; it only verifies the signature, so a stolen token stays valid until it expires. Usual fix: short-lived access tokens (minutes) with refresh tokens that can be revoked, and optionally a small deny-list of revoked token ids for urgent cases.</div></details>
<details><summary>You added read replicas, and a user does not see the order they just placed. Why, and how do you fix it?</summary><div>Replication lag: the read went to a replica that had not yet received the write. Fix with read-your-own-writes: route that user's reads to the primary for a short time after a write, or read from the primary for critical pages like "my orders".</div></details>
<details><summary>In what order would you typically add these as a system grows: CDN, sharding, read replicas, load balancer?</summary><div>Load balancer (with multiple stateless app servers) → read replicas → CDN (can come earlier if media-heavy) → sharding last, since it is the most complex and only needed when one primary cannot handle writes or data size.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
  <li>Vertical = bigger machine (simple, capped, SPOF); horizontal = more machines (scalable, resilient, more complex).</li>
  <li>Horizontal scaling requires stateless services; move sessions, files and caches into shared stores.</li>
  <li>Session options: sticky sessions (simple, fragile), shared store like Redis (default), JWT (no lookup, hard to revoke).</li>
  <li>The usual growth path: single server → separate DB → LB + app servers → replicas → cache → CDN → sharding.</li>
  <li>Each stage fixes one bottleneck and introduces a new trade-off; add complexity only when the numbers demand it.</li>
  <li>The database is usually the last and hardest tier to scale out.</li>
</ul></div>
`,
  diagrams: {
    s1: String.raw`flowchart LR
      U["Users"] --> S["Single server: web + app + DB"]`,
    s2: String.raw`flowchart LR
      U["Users"] --> A["App server"] --> D[("Database")]`,
    s3: String.raw`flowchart LR
      U["Users"] --> LB["Load balancer"]
      LB --> A1["App 1"]
      LB --> A2["App 2"]
      LB --> A3["App 3"]
      A1 --> D[("Database")]
      A2 --> D
      A3 --> D
      A1 -.-> R["Session store (Redis)"]`,
    s4: String.raw`flowchart LR
      LB["Load balancer"] --> A["App servers"]
      A -- "writes" --> P[("Primary")]
      A -- "reads" --> R1[("Replica 1")]
      A -- "reads" --> R2[("Replica 2")]
      P -. "replication" .-> R1
      P -. "replication" .-> R2`,
    s5: String.raw`flowchart LR
      LB["Load balancer"] --> A["App servers"]
      A -- "1. check" --> C["Cache (Redis)"]
      A -- "2. on miss" --> DB[("Primary + replicas")]`,
    s6: String.raw`flowchart LR
      U["Users"] -- "images, JS, video" --> CDN["CDN edge"]
      CDN -- "on miss" --> OS["Object storage (S3)"]
      U -- "API calls" --> LB["Load balancer"] --> A["App servers"]
      A --> C["Cache"]
      A --> DB[("Database")]`,
    s7: String.raw`flowchart LR
      A["App servers"] --> RT["Shard router"]
      RT -- "user_id 0-33%" --> S1[("Shard 1 + replicas")]
      RT -- "user_id 34-66%" --> S2[("Shard 2 + replicas")]
      RT -- "user_id 67-100%" --> S3[("Shard 3 + replicas")]`,
  },
});
