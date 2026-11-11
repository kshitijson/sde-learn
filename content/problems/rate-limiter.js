SD.register({
  id: "rate-limiter",
  html: String.raw`
<p class="lead">A rate limiter caps how many requests a client can make in a time window, for example "100 requests per minute per API key". It protects services from abuse (bots, brute-force login, scraping), from accidental overload (a buggy client in a retry loop), and from runaway costs (every OTP SMS costs money). Designing one that works across dozens of gateway servers, adds only a millisecond or two, and stays correct under concurrency is a favourite SDE 1 and SDE 2 interview problem at companies like Razorpay, PhonePe, Flipkart, Stripe and Amazon.</p>

<h2>Problem statement</h2>
<p>Design a distributed rate limiter for a public API platform. Every request passes through a fleet of API gateway servers. The limiter must enforce rules such as:</p>
<ul>
<li>A free-tier API key may make <strong>100 requests per minute</strong>; a paid key 5,000 per minute.</li>
<li>An IP address may attempt <strong>login 5 times per minute</strong>.</li>
<li>A user may request <strong>3 OTPs per 10 minutes</strong>.</li>
</ul>
<p>Requests over the limit are rejected with HTTP <code>429 Too Many Requests</code>. Assume about <strong>10 million active users</strong> and <strong>1 million requests per second</strong> at peak across all gateways.</p>

<div class="callout tip"><strong>Try it first</strong>Before reading on, decide: (1) where in the request path the limiter lives, (2) which algorithm you would use and why, (3) where the counters are stored so that 50 gateway servers see the same count, and (4) what happens when that store is down. Sketch the boxes and write the check as pseudo-code.</div>

<details class="hint"><summary>Hint 1: where do counters live?</summary>
<p>If each gateway counts only its own traffic, a client spread across 50 servers gets 50× the limit. You need a shared, very fast store. What in-memory store supports atomic increments and expiry?</p>
</details>
<details class="hint"><summary>Hint 2: race conditions</summary>
<p>Two gateways read "99", both decide "under 100", both write "100". The client got 101. How do you make read-check-increment a single atomic step in that store?</p>
</details>
<details class="hint"><summary>Hint 3: picking an algorithm</summary>
<p>Fixed windows allow a 2× burst at the window boundary. Storing every timestamp is accurate but memory-hungry. Is there a cheap approximation that uses just two counters per client?</p>
</details>

<h2>Requirements</h2>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li>Limit requests by a <strong>key</strong>: user id, API key, IP address, or a combination (user + endpoint).</li>
<li>Support <strong>multiple rules</strong> per request (per-second burst rule and per-day quota) and per-endpoint rules.</li>
<li>Rules are <strong>configurable</strong> without redeploying gateways.</li>
<li>Rejected requests get <strong>429</strong> with headers telling the client when to retry.</li>
<li>Optional: <strong>shadow mode</strong> (log but do not block) to test new rules safely.</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Low latency</strong>: the check adds under ~2 ms at p99. It runs on every request.</li>
<li><strong>Distributed</strong>: limits are global across all gateway nodes, not per node.</li>
<li><strong>Highly available</strong>: a limiter failure must not take the API down.</li>
<li><strong>Accurate enough</strong>: small over-admission (a few %) is fine; large is not.</li>
<li><strong>Fail-open vs fail-closed</strong> decided per rule (see below).</li>
<li>Scales to 1M checks/s and 10M+ keys.</li>
</ul>
</div>
</div>

<div class="callout warn"><strong>Fail-open or fail-closed?</strong>If the counter store is unreachable, <em>fail-open</em> lets requests through (protects availability; you briefly lose protection). <em>Fail-closed</em> rejects them (protects the backend or your wallet; you cause an outage). Most general API limits fail open, usually with a fallback in-memory limiter. Security and cost rules (login attempts, OTP sends, payment retries) fail closed.</div>

<div class="callout interview"><strong>Say this in the interview</strong>"Let me pin down the requirements. The limiter is server-side, enforces per-API-key, per-user and per-IP rules, must be global across all gateway nodes, and must add only a millisecond or two. When the counter store is down I will fail open for normal traffic and fail closed for sensitive endpoints like login and OTP. Slight over-admission is acceptable; exact precision is not required."</div>

<h2>Capacity estimation</h2>
<table>
<thead><tr><th>Quantity</th><th>Arithmetic</th><th>Result</th></tr></thead>
<tbody>
<tr><td>Checks per second</td><td>given</td><td><strong>1M /s</strong> peak</td></tr>
<tr><td>Active keys</td><td>10M users × ~2 rules each (per-minute + per-day)</td><td><strong>~20M counters</strong></td></tr>
<tr><td>Memory per key (sliding window counter)</td><td>2 counters (current + previous window) × (key ~40 B + value 8 B + Redis overhead ~50 B)</td><td><strong>~200 B</strong></td></tr>
<tr><td>Total memory (counter)</td><td>20M × 200 B</td><td><strong>~4 GB</strong>; with replicas ~8 GB</td></tr>
<tr><td>Memory if we used a sliding log</td><td>20M keys × up to 100 timestamps × ~64 B per sorted-set entry</td><td><strong>~128 GB</strong> (30× more)</td></tr>
<tr><td>Redis operations</td><td>1M checks/s × 1 script call each</td><td><strong>1M script calls/s</strong></td></tr>
<tr><td>Redis nodes</td><td>~100K short script calls/s per node, run at ~50% headroom</td><td><strong>~20 primary shards</strong> + replicas</td></tr>
<tr><td>Network</td><td>1M/s × ~200 B (request + reply)</td><td>~200 MB/s across the cluster</td></tr>
</tbody>
</table>
<p>The memory is small. The real constraint is <strong>operations per second and latency</strong>, which is why we shard Redis and keep each check to a single round trip.</p>

<h2>Where to place the limiter</h2>
<div data-diagram="placement" data-caption="Limits live at several layers; the API gateway is the main enforcement point"></div>
<table>
<thead><tr><th>Placement</th><th>Pros</th><th>Cons</th></tr></thead>
<tbody>
<tr><td>Client-side (mobile app, SDK)</td><td>Saves network calls</td><td>Cannot be trusted; easily bypassed. Only a courtesy.</td></tr>
<tr><td>Edge / CDN / WAF (Cloudflare, AWS WAF)</td><td>Stops floods before they reach you; IP-based DDoS defence</td><td>Coarse; does not know users or plans</td></tr>
<tr><td><mark>API gateway middleware</mark> (Kong, Envoy, Nginx, Spring Cloud Gateway)</td><td>One place for all services; knows API key and user after auth</td><td>Gateway becomes critical; needs a shared store</td></tr>
<tr><td>Inside each service (library)</td><td>Fine-grained, business-aware limits (e.g. per merchant per payment method)</td><td>Duplicated logic across services and languages</td></tr>
<tr><td>Sidecar (Envoy + rate limit service)</td><td>Language-neutral, central policy</td><td>Extra hop and operational complexity</td></tr>
</tbody>
</table>
<p>In practice you layer them: IP-based limits at the edge, per-key and per-user limits at the gateway, and a few business limits inside services.</p>

<h2>Rules configuration</h2>
<p>Rules are data, not code. A typical format (Envoy's and Lyft's open-source ratelimit service use a similar idea) is YAML stored in a config repo or a rules database:</p>
<pre><code>domain: public_api
rules:
  - name: free_tier
    match: { plan: free }
    key: api_key
    limit: { requests: 100, per: 1m, algorithm: sliding_window }
    fail_mode: open
  - name: paid_tier
    match: { plan: paid }
    key: api_key
    limit: { requests: 5000, per: 1m, algorithm: token_bucket, burst: 500 }
    fail_mode: open
  - name: login_bruteforce
    match: { endpoint: /v1/login }
    key: ip
    limit: { requests: 5, per: 1m, algorithm: sliding_window }
    fail_mode: closed
  - name: otp_cost_guard
    match: { endpoint: /v1/otp }
    key: user_id
    limit: { requests: 3, per: 10m, algorithm: sliding_window }
    fail_mode: closed</code></pre>
<ul>
<li>A <strong>rules service</strong> stores and validates rules. Gateways pull them every 30 s (or watch for changes) and cache them in memory, so evaluating which rule applies is a local, sub-microsecond lookup.</li>
<li>Each request may match several rules (per-second burst + per-day quota). All must pass. Check them in one Redis script call if their keys share a slot, or in a pipeline.</li>
<li>Overrides: per-customer exceptions (an enterprise merchant during a Big Billion Days sale) are just more specific rules.</li>
</ul>

<h2>Algorithms recap</h2>
<p>Try each algorithm in the simulator: send bursts and watch which requests get rejected.</p>
<div data-widget="rate-limiter"></div>
<table>
<thead><tr><th>Algorithm</th><th>How it works</th><th>Memory / key</th><th>Bursts</th><th>Accuracy</th><th>Used by</th></tr></thead>
<tbody>
<tr><td>Token bucket</td><td>Bucket holds up to <em>b</em> tokens, refilled at <em>r</em>/s. Each request takes one token.</td><td>2 numbers (tokens, last refill time)</td><td>Allows bursts up to <em>b</em>, then rate <em>r</em></td><td>Good</td><td>AWS API Gateway, Stripe</td></tr>
<tr><td>Leaky bucket</td><td>Requests join a FIFO queue drained at a fixed rate; overflow is dropped.</td><td>Queue (or a counter + time)</td><td>Smooths bursts into a steady output</td><td>Good</td><td>Nginx <code>limit_req</code>, traffic shaping</td></tr>
<tr><td>Fixed window counter</td><td>One counter per window (e.g. per minute), reset at the boundary.</td><td>1 counter</td><td>Up to 2× limit across a boundary</td><td>Weak at edges</td><td>Simple quotas</td></tr>
<tr><td>Sliding window log</td><td>Store each request timestamp; count those within the last window.</td><td>One entry per request (heavy)</td><td>Exact</td><td>Exact</td><td>Low-volume, high-value limits</td></tr>
<tr><td>Sliding window counter</td><td>Current count + previous count × fraction of previous window still in view.</td><td>2 counters</td><td>Smooth, approximate</td><td>Very good (assumes even spread in previous window)</td><td>Cloudflare, many gateways</td></tr>
</tbody>
</table>
<p><strong>Sliding window counter maths</strong>: limit 100/min. The previous minute had 80 requests, the current minute has 30 so far, and we are 25% into the current minute. The sliding window covers 75% of the previous minute, so the estimate is 80 × 0.75 + 30 = <strong>90</strong>. One more request makes 91 ≤ 100, so allow it.</p>
<div class="callout interview"><strong>Say this in the interview</strong>"I will use the sliding window counter for per-minute limits: two integers per key, no boundary burst problem, and it maps cleanly to Redis. For APIs where we want to allow short bursts, like a payment SDK retrying, I would use a token bucket. Fixed window is fine for coarse daily quotas."</div>

<h2>High-level design</h2>
<div data-diagram="arch" data-caption="Gateways evaluate rules locally and keep counters in a sharded Redis cluster"></div>
<ol class="steps">
<li><strong>Request arrives</strong> at any gateway node behind the load balancer. Auth middleware identifies the API key, user and plan.</li>
<li><strong>Rule matching</strong>: the rate-limit middleware looks up matching rules in its in-memory rules cache.</li>
<li><strong>Counter check</strong>: for each rule, build a key like <code>rl:{key:abc123}:min</code> and run one atomic Lua script on the Redis shard that owns that key. The script returns allowed/denied and the remaining count.</li>
<li><strong>Decision</strong>: if allowed, forward to the backend and add <code>X-RateLimit-*</code> headers. If denied, return 429 immediately; the backend never sees it.</li>
<li><strong>Telemetry</strong>: emit allowed/denied metrics per rule asynchronously (StatsD/Prometheus, or Kafka for audit logs).</li>
<li><strong>Rules service</strong> pushes or serves rule changes; gateways refresh without restarts.</li>
</ol>
<div data-diagram="flow" data-caption="One check: rule lookup is local, the counter update is one Redis round trip"></div>

<h2>Deep dive 1: race conditions and atomicity</h2>
<p>The naive implementation is "GET count; if count &lt; limit then SET count+1". Under concurrency it breaks:</p>
<div data-diagram="race" data-caption="Read-check-write from two gateways lets 101 requests through a limit of 100"></div>
<h3>Fix 1: atomic INCR (fixed window)</h3>
<p><code>INCR</code> is atomic in Redis, so "increment then compare" is safe: <code>n = INCR key; if n == 1: EXPIRE key 60; allow = n &lt;= limit</code>. But <code>INCR</code> and <code>EXPIRE</code> are two commands. If the gateway crashes between them, the key never expires and the client is blocked forever. Fix that with <code>MULTI/EXEC</code>, <code>SET key 0 EX 60 NX</code> before <code>INCR</code>, or (best) a Lua script.</p>
<h3>Fix 2: Lua script (sliding window counter)</h3>
<p>Redis runs a Lua script atomically: no other command runs on that shard while it executes. So read, compute and write happen as one step, in one network round trip.</p>
<pre><code>-- KEYS[1] = current window key   e.g. rl:{key:abc123}:29380841
-- KEYS[2] = previous window key  e.g. rl:{key:abc123}:29380840
-- ARGV[1] = limit, ARGV[2] = window size in ms, ARGV[3] = now in ms
local limit   = tonumber(ARGV[1])
local window  = tonumber(ARGV[2])
local now     = tonumber(ARGV[3])
local elapsed = now % window                           -- ms into current window

local curr = tonumber(redis.call('GET', KEYS[1]) or '0')
local prev = tonumber(redis.call('GET', KEYS[2]) or '0')
local estimated = prev * (window - elapsed) / window + curr

if estimated + 1 &gt; limit then
  return {0, 0, window - elapsed}                      -- denied, remaining, retry-after ms
end

curr = redis.call('INCR', KEYS[1])
if curr == 1 then
  redis.call('PEXPIRE', KEYS[1], window * 2)           -- keep it alive for the next window too
end
return {1, math.floor(limit - estimated - 1), 0}       -- allowed, remaining, 0</code></pre>
<ul>
<li>The gateway computes the window number (<code>now / window</code>, here with a 60,000 ms window) to build the two key names and passes <code>now</code> in. Gateway clocks are NTP-synced to within a few ms; near a boundary a request may land in the adjacent window, which the sliding estimate absorbs.</li>
<li>For a token bucket the state is one hash key, so the script can call <code>redis.call('TIME')</code> and use the Redis server clock instead (allowed in Redis 5+ with effects replication). That removes gateway clock skew completely.</li>
<li><strong>Redis Cluster</strong>: a script may only touch keys in one hash slot. The <code>{key:abc123}</code> hash tag forces both window keys onto the same slot.</li>
<li>Load the script once with <code>SCRIPT LOAD</code> and call <code>EVALSHA</code> to avoid sending the script body every time.</li>
<li>A token bucket script looks similar: <code>HMGET</code> tokens and last-refill time, refill, decide, <code>HSET</code>, <code>PEXPIRE</code>.</li>
</ul>

<h3>Code: in-process sliding window counter and token bucket</h3>
<p>The same logic, in memory, keyed per client. This is what you would write in a machine-coding round, and what a gateway uses as its local fallback when Redis is unreachable. Time is passed in so the demo is deterministic.</p>
<div data-code="limiters"></div>

<h2>Deep dive 2: local vs centralised counting</h2>
<div class="grid-3">
<div class="card"><strong>Local only</strong><p>Each gateway keeps counters in memory and enforces <code>limit / N</code> for N nodes. Zero network hops. But load balancing is never perfectly even, nodes come and go (autoscaling changes N), and sticky clients get the wrong share. Accuracy is poor.</p></div>
<div class="card"><strong>Centralised (Redis)</strong><p>Every check goes to Redis. Accurate and simple to reason about. Costs one round trip (~0.5 to 1 ms in the same zone) and puts Redis on the critical path. This is the default answer.</p></div>
<div class="card"><strong>Hybrid (batching / leasing)</strong><p>A gateway reserves a batch of tokens from Redis (say 10% of the limit), spends them locally, and asks for more when it runs out. Or it counts locally and syncs deltas every 100 ms. Far fewer Redis calls, small temporary over-admission. Good for very high-QPS keys.</p></div>
</div>
<p>A common production setup: centralised Redis for normal keys, local pre-filtering for extreme hot keys (a single partner sending 50K req/s), and an in-memory limiter as fallback when Redis fails.</p>

<h2>Deep dive 3: multiple data centres</h2>
<p>Suppose Razorpay runs in Mumbai and Hyderabad regions, and a merchant's traffic is split across both. Cross-region round trips are 20 to 150 ms, which blows the latency budget if every check goes to a single global Redis.</p>
<div data-diagram="multidc" data-caption="Each region enforces locally and shares counts asynchronously"></div>
<table>
<thead><tr><th>Approach</th><th>How</th><th>Trade-off</th></tr></thead>
<tbody>
<tr><td>Split the quota</td><td>Give each region a share of the limit (e.g. 60/40 by traffic).</td><td>Simple, no cross-region calls. Wasteful if traffic shifts between regions.</td></tr>
<tr><td>Async replication</td><td>Each region counts locally and broadcasts its counts every few hundred ms; the effective count is local + last known remote (a G-counter, a simple CRDT).</td><td>Fast; over-admits by at most one sync interval's worth of traffic.</td></tr>
<tr><td>Home-region routing</td><td>Route each client to one home region (by API key), so its counter lives in one place.</td><td>Accurate; relies on routing and needs failover handling.</td></tr>
<tr><td>Global strongly consistent store</td><td>One counter with synchronous cross-region writes.</td><td>Accurate but slow; rarely worth it for rate limiting.</td></tr>
</tbody>
</table>

<h2>Deep dive 4: responses, headers and client behaviour</h2>
<p>Tell clients where they stand so well-behaved ones slow down on their own:</p>
<pre><code>HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 100          # requests allowed per window
X-RateLimit-Remaining: 0        # left in the current window
X-RateLimit-Reset: 1762850460   # unix time when the window resets
Retry-After: 18                 # seconds to wait before retrying

{ "error": "rate_limited", "message": "Limit of 100 requests/min exceeded. Retry after 18s." }</code></pre>
<ul>
<li>Send <code>X-RateLimit-Limit</code> and <code>X-RateLimit-Remaining</code> on successful responses too. (An IETF draft standardises <code>RateLimit-Policy</code> and <code>RateLimit</code> headers; mention it if asked.)</li>
<li>Clients should retry with <strong>exponential backoff and jitter</strong>, honouring <code>Retry-After</code>, otherwise everyone retries at the same second and creates a new spike.</li>
<li>Rejected requests can be <strong>dropped</strong> (most APIs) or <strong>queued</strong> for later processing (order placement, webhooks) if the business prefers delay over failure.</li>
<li>Some systems return 503 for server-side load shedding to separate "you sent too much" (429) from "we are overloaded" (503).</li>
</ul>

<h2>Deep dive 5: monitoring and safe rollout</h2>
<ul>
<li><strong>Metrics</strong>: allowed vs rejected per rule and per top key, Redis latency (p50/p99), script errors, fail-open events. Alert when the reject rate for a rule jumps, which could be an attack or a bad rule.</li>
<li><strong>Shadow mode</strong>: new rules first run in "log only" mode for a few days. You see who <em>would</em> be blocked before blocking a large merchant.</li>
<li><strong>Hot keys</strong>: one key sending 100K req/s hammers a single Redis shard. Detect it and switch that key to local pre-filtering or token leasing.</li>
<li><strong>Audit</strong>: log rejections (sampled) so support can answer "why did my integration get 429s at 9 pm?".</li>
</ul>

<h2>Scaling and bottlenecks</h2>
<table>
<thead><tr><th>Concern</th><th>Mitigation</th></tr></thead>
<tbody>
<tr><td>Redis throughput (1M ops/s)</td><td>Redis Cluster with ~20 primary shards, keys spread by hash slot; <code>EVALSHA</code> to keep calls small; pipelining when a request matches several rules.</td></tr>
<tr><td>Redis as a single point of failure</td><td>Replicas with automatic failover (Sentinel or Cluster). On timeout (set it low, ~5 ms), fall back to the per-node in-memory limiter, fail-open or fail-closed per rule.</td></tr>
<tr><td>Replica failover loses recent counts</td><td>Async replication may lose a few increments: brief over-admission. Acceptable for rate limiting.</td></tr>
<tr><td>Gateway latency</td><td>Connection pooling to Redis, same-zone placement, local rules cache, one round trip per request.</td></tr>
<tr><td>Memory growth</td><td>Every key has a TTL (2 × window), so idle clients disappear automatically.</td></tr>
<tr><td>Rule changes</td><td>Versioned rules, validated by the rules service, rolled out to gateways gradually.</td></tr>
</tbody>
</table>

<h2>Trade-offs</h2>
<div class="grid-2">
<div class="card good"><strong>What this design gets right</strong>
<ul>
<li>Global, accurate limits with one Redis round trip per check.</li>
<li>Atomic Lua scripts remove race conditions.</li>
<li>Sliding window counter: O(1) memory, no boundary bursts.</li>
<li>Rules change without deploys; shadow mode makes them safe.</li>
</ul>
</div>
<div class="card bad"><strong>What it costs</strong>
<ul>
<li>Redis is on the hot path of every request: adds ~1 ms and a dependency.</li>
<li>Sliding window counter is an approximation (assumes even spread in the previous window).</li>
<li>Multi-region limits are approximate unless you accept big latency.</li>
<li>Fail-open means a short window with no protection during Redis outages.</li>
</ul>
</div>
</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>Why not just use a fixed window counter with INCR? It is simpler.</summary><div>It allows up to 2× the limit around a window boundary: 100 requests at 12:00:59 and 100 more at 12:01:00 all pass, so 200 requests within two seconds. For login or OTP limits that matters. The sliding window counter fixes this with one extra counter.</div></details>
<details><summary>Redis is down. What does the gateway do?</summary><div>Calls to Redis have a tight timeout (a few ms). On failure, the gateway consults the rule's fail mode: fail-open rules use a local in-memory limiter (limit divided by the number of nodes, roughly) so there is still some protection; fail-closed rules (login, OTP) return 429 or 503. Emit a metric and alert.</div></details>
<details><summary>How do you rate limit by IP when many users share one IP (office NAT, mobile carrier CGNAT)?</summary><div>IP limits must be generous, and used mainly for unauthenticated endpoints and abuse. Prefer user id or API key once the request is authenticated. For Indian mobile networks with carrier-grade NAT, thousands of users can share an IP, so tight IP limits would block real users.</div></details>
<details><summary>A client should get 1,000 requests per day and 10 per second. How do you enforce both?</summary><div>Two rules, two keys: a per-second token bucket or sliding window, and a per-day fixed window counter. Check both in one Lua script (hash tag both keys to the same slot) and allow only if both pass; only increment if both pass so that rejected requests do not consume the daily quota.</div></details>
<details><summary>Why might a token bucket script use the Redis server time instead of the gateway's time?</summary><div>Gateway clocks drift by milliseconds or more. If each gateway passes its own time, a request from a gateway whose clock is behind can make <code>now - lastRefill</code> negative, so the refill goes backwards, or a fast clock can mint extra tokens. Redis <code>TIME</code> is one clock per shard, so every decision for a key uses the same time source. For the sliding window counter small skew matters less, because it only shifts which window a request is counted in.</div></details>
<details><summary>How would you limit concurrent requests rather than requests per second?</summary><div>Use a concurrency limiter: increment a counter when a request starts and decrement when it finishes (with a TTL or a sorted set of request ids with expiry, to clean up after crashes). Reject when the in-flight count exceeds the limit. Stripe runs this alongside rate limits to protect expensive endpoints.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2>
<ul>
<li>Place the main limiter in the API gateway, with coarse IP limits at the edge and business limits in services.</li>
<li>Store counters in a shared, sharded Redis; one atomic Lua script per check avoids races and costs one round trip.</li>
<li>Sliding window counter = 2 counters per key, no boundary burst; token bucket when bursts are acceptable.</li>
<li>Estimate: 20M keys × ~200 B ≈ 4 GB; 1M checks/s needs ~20 Redis shards. Ops/s, not memory, is the constraint.</li>
<li>Decide fail-open vs fail-closed per rule, with an in-memory fallback.</li>
<li>Return 429 with <code>Retry-After</code> and <code>X-RateLimit-*</code> headers; clients back off with jitter.</li>
<li>Multi-region: split quotas or sync counts asynchronously; accept small over-admission.</li>
</ul>
</div>
`,
  code: {
    limiters: {
      title: "Sliding window counter + token bucket, keyed per client",
      java: String.raw`import java.util.HashMap;
import java.util.Map;

/** Sliding window counter: weights the previous fixed window by how much of it
 *  still overlaps the sliding window. O(1) memory per client. */
final class SlidingWindowCounter {
    private static final class State {
        long start;
        int prev, curr;
        State(long start) { this.start = start; }
    }

    private final int limit;
    private final long windowMs;
    private final Map<String, State> state = new HashMap<>();

    SlidingWindowCounter(int limit, long windowMs) {
        this.limit = limit;
        this.windowMs = windowMs;
    }

    synchronized boolean allow(String client, long nowMs) {
        long start = nowMs - nowMs % windowMs;
        State st = state.get(client);
        if (st == null) {
            st = new State(start);
            state.put(client, st);
        } else if (st.start != start) {
            // roll over: the old current window becomes "previous" only if adjacent
            st.prev = (start - st.start == windowMs) ? st.curr : 0;
            st.curr = 0;
            st.start = start;
        }
        double elapsed = (double) (nowMs - start) / windowMs; // 0.0 .. <1.0
        double estimated = st.prev * (1 - elapsed) + st.curr;
        if (estimated + 1 > limit) return false;
        st.curr++;
        return true;
    }
}

/** Token bucket: up to capacity tokens, refilled at ratePerSec.
 *  Each request spends one token. Allows short bursts up to capacity. */
final class TokenBucket {
    private static final class Bucket {
        double tokens;
        long last;
        Bucket(double tokens, long last) { this.tokens = tokens; this.last = last; }
    }

    private final double capacity, rate;
    private final Map<String, Bucket> buckets = new HashMap<>();

    TokenBucket(int capacity, double ratePerSec) {
        this.capacity = capacity;
        this.rate = ratePerSec;
    }

    synchronized boolean allow(String client, long nowMs) {
        Bucket b = buckets.computeIfAbsent(client, k -> new Bucket(capacity, nowMs)); // new clients start full
        b.tokens = Math.min(capacity, b.tokens + (nowMs - b.last) * rate / 1000.0);
        b.last = nowMs;
        if (b.tokens >= 1) {
            b.tokens -= 1;
            return true;
        }
        return false;
    }
}

public class Main {
    static String verdict(boolean ok) { return ok ? "allowed" : "REJECTED"; }

    public static void main(String[] args) {
        SlidingWindowCounter sw = new SlidingWindowCounter(5, 1000);
        System.out.println("sliding window, limit 5/s");
        for (long t = 0; t < 700; t += 100) // 7 requests in the first 700 ms
            System.out.println("  t=" + t + " alice -> " + verdict(sw.allow("alice", t)));
        System.out.println("  t=600 bob   -> " + verdict(sw.allow("bob", 600)));     // separate key
        System.out.println("  t=1500 alice -> " + verdict(sw.allow("alice", 1500))); // 5*0.5 + 0 = 2.5
        System.out.println("  t=1600 alice -> " + verdict(sw.allow("alice", 1600))); // 5*0.4 + 1 = 3.0
        System.out.println("  t=1700 alice -> " + verdict(sw.allow("alice", 1700))); // 5*0.3 + 2 = 3.5
        System.out.println("  t=1710 alice -> " + verdict(sw.allow("alice", 1710))); // 5*0.29 + 3 = 4.45

        TokenBucket tb = new TokenBucket(3, 1);
        System.out.println("token bucket, capacity 3, refill 1/s");
        for (int i = 1; i <= 5; i++) // burst of 5 at t=0
            System.out.println("  t=0 req" + i + " -> " + verdict(tb.allow("alice", 0)));
        for (int i = 1; i <= 3; i++) // 2 s later: 2 tokens refilled
            System.out.println("  t=2000 req" + i + " -> " + verdict(tb.allow("alice", 2000)));
    }
}`,
      python: String.raw`import time


class SlidingWindowCounter:
    """Sliding window counter: weights the previous fixed window by how much of it
    still overlaps the sliding window. O(1) memory per client."""

    def __init__(self, limit: int, window_ms: int):
        self.limit = limit
        self.window_ms = window_ms
        self.state = {}  # client -> [window_start, prev_count, curr_count]

    def allow(self, client: str, now_ms=None) -> bool:
        now = int(time.time() * 1000) if now_ms is None else now_ms
        window_start = now - now % self.window_ms
        st = self.state.get(client)
        if st is None:
            st = [window_start, 0, 0]
            self.state[client] = st
        elif st[0] != window_start:
            # roll over: the old current window becomes "previous" only if adjacent
            st[1] = st[2] if window_start - st[0] == self.window_ms else 0
            st[2] = 0
            st[0] = window_start
        elapsed = (now - window_start) / self.window_ms     # 0.0 .. <1.0
        estimated = st[1] * (1 - elapsed) + st[2]
        if estimated + 1 > self.limit:
            return False
        st[2] += 1
        return True


class TokenBucket:
    """Token bucket: holds up to capacity tokens, refilled at rate_per_sec.
    Each request spends one token. Allows short bursts up to capacity."""

    def __init__(self, capacity: int, rate_per_sec: float):
        self.capacity = capacity
        self.rate = rate_per_sec
        self.buckets = {}  # client -> [tokens, last_refill_ms]

    def allow(self, client: str, now_ms=None) -> bool:
        now = int(time.time() * 1000) if now_ms is None else now_ms
        b = self.buckets.get(client)
        if b is None:
            b = [float(self.capacity), now]   # new clients start with a full bucket
            self.buckets[client] = b
        b[0] = min(self.capacity, b[0] + (now - b[1]) * self.rate / 1000.0)
        b[1] = now
        if b[0] >= 1:
            b[0] -= 1
            return True
        return False


def verdict(ok: bool) -> str:
    return "allowed" if ok else "REJECTED"


if __name__ == "__main__":
    sw = SlidingWindowCounter(limit=5, window_ms=1000)
    print("sliding window, limit 5/s")
    for t in range(0, 700, 100):            # 7 requests in the first 700 ms
        print(f"  t={t} alice -> {verdict(sw.allow('alice', t))}")
    print(f"  t=600 bob   -> {verdict(sw.allow('bob', 600))}")     # separate key
    print(f"  t=1500 alice -> {verdict(sw.allow('alice', 1500))}")  # 5*0.5 + 0 = 2.5 -> allowed
    print(f"  t=1600 alice -> {verdict(sw.allow('alice', 1600))}")  # 5*0.4 + 1 = 3.0 -> allowed
    print(f"  t=1700 alice -> {verdict(sw.allow('alice', 1700))}")  # 5*0.3 + 2 = 3.5 -> allowed
    print(f"  t=1710 alice -> {verdict(sw.allow('alice', 1710))}")  # 5*0.29 + 3 = 4.45 -> rejected

    tb = TokenBucket(capacity=3, rate_per_sec=1)
    print("token bucket, capacity 3, refill 1/s")
    for i in range(5):                      # burst of 5 at t=0
        print(f"  t=0 req{i + 1} -> {verdict(tb.allow('alice', 0))}")
    for i in range(3):                      # 2 s later: 2 tokens refilled
        print(f"  t=2000 req{i + 1} -> {verdict(tb.allow('alice', 2000))}")`,
      cpp: String.raw`#include <algorithm>
#include <cstdint>
#include <iostream>
#include <mutex>
#include <string>
#include <unordered_map>

// Sliding window counter: weights the previous fixed window by how much of it
// still overlaps the sliding window. O(1) memory per client.
class SlidingWindowCounter {
    struct State {
        int64_t start;
        int prev = 0, curr = 0;
    };
    int limit_;
    int64_t windowMs_;
    std::unordered_map<std::string, State> state_;
    std::mutex mu_;

public:
    SlidingWindowCounter(int limit, int64_t windowMs) : limit_(limit), windowMs_(windowMs) {}

    bool allow(const std::string& client, int64_t nowMs) {
        std::lock_guard<std::mutex> lock(mu_);
        int64_t start = nowMs - nowMs % windowMs_;
        auto [it, inserted] = state_.try_emplace(client, State{start});
        State& st = it->second;
        if (!inserted && st.start != start) {
            // roll over: the old current window becomes "previous" only if adjacent
            st.prev = (start - st.start == windowMs_) ? st.curr : 0;
            st.curr = 0;
            st.start = start;
        }
        double elapsed = double(nowMs - start) / double(windowMs_);  // 0.0 .. <1.0
        double estimated = st.prev * (1.0 - elapsed) + st.curr;
        if (estimated + 1 > limit_) return false;
        st.curr++;
        return true;
    }
};

// Token bucket: up to capacity tokens, refilled at ratePerSec.
// Each request spends one token. Allows short bursts up to capacity.
class TokenBucket {
    struct Bucket {
        double tokens;
        int64_t last;
    };
    double capacity_, rate_;
    std::unordered_map<std::string, Bucket> buckets_;
    std::mutex mu_;

public:
    TokenBucket(int capacity, double ratePerSec) : capacity_(capacity), rate_(ratePerSec) {}

    bool allow(const std::string& client, int64_t nowMs) {
        std::lock_guard<std::mutex> lock(mu_);
        auto [it, inserted] = buckets_.try_emplace(client, Bucket{capacity_, nowMs});  // new clients start full
        Bucket& b = it->second;
        b.tokens = std::min(capacity_, b.tokens + (nowMs - b.last) * rate_ / 1000.0);
        b.last = nowMs;
        if (b.tokens >= 1) {
            b.tokens -= 1;
            return true;
        }
        return false;
    }
};

const char* verdict(bool ok) { return ok ? "allowed" : "REJECTED"; }

int main() {
    SlidingWindowCounter sw(5, 1000);
    std::cout << "sliding window, limit 5/s\n";
    for (int64_t t = 0; t < 700; t += 100)  // 7 requests in the first 700 ms
        std::cout << "  t=" << t << " alice -> " << verdict(sw.allow("alice", t)) << "\n";
    std::cout << "  t=600 bob   -> " << verdict(sw.allow("bob", 600)) << "\n";      // separate key
    std::cout << "  t=1500 alice -> " << verdict(sw.allow("alice", 1500)) << "\n";  // 5*0.5 + 0 = 2.5
    std::cout << "  t=1600 alice -> " << verdict(sw.allow("alice", 1600)) << "\n";  // 5*0.4 + 1 = 3.0
    std::cout << "  t=1700 alice -> " << verdict(sw.allow("alice", 1700)) << "\n";  // 5*0.3 + 2 = 3.5
    std::cout << "  t=1710 alice -> " << verdict(sw.allow("alice", 1710)) << "\n";  // 5*0.29 + 3 = 4.45

    TokenBucket tb(3, 1);
    std::cout << "token bucket, capacity 3, refill 1/s\n";
    for (int i = 1; i <= 5; i++)  // burst of 5 at t=0
        std::cout << "  t=0 req" << i << " -> " << verdict(tb.allow("alice", 0)) << "\n";
    for (int i = 1; i <= 3; i++)  // 2 s later: 2 tokens refilled
        std::cout << "  t=2000 req" << i << " -> " << verdict(tb.allow("alice", 2000)) << "\n";
}`,
      javascript: String.raw`// Sliding window counter: weights the previous fixed window by how much of it
// still overlaps the sliding window. O(1) memory per client.
class SlidingWindowCounter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.state = new Map(); // client -> { start, prev, curr }
  }

  allow(client, now = Date.now()) {
    const start = now - (now % this.windowMs);
    let st = this.state.get(client);
    if (!st) {
      st = { start, prev: 0, curr: 0 };
      this.state.set(client, st);
    } else if (st.start !== start) {
      // roll over: the old current window becomes "previous" only if adjacent
      st.prev = start - st.start === this.windowMs ? st.curr : 0;
      st.curr = 0;
      st.start = start;
    }
    const elapsed = (now - start) / this.windowMs; // 0.0 .. <1.0
    const estimated = st.prev * (1 - elapsed) + st.curr;
    if (estimated + 1 > this.limit) return false;
    st.curr++;
    return true;
  }
}

// Token bucket: up to capacity tokens, refilled at ratePerSec.
// Each request spends one token. Allows short bursts up to capacity.
class TokenBucket {
  constructor(capacity, ratePerSec) {
    this.capacity = capacity;
    this.rate = ratePerSec;
    this.buckets = new Map(); // client -> { tokens, last }
  }

  allow(client, now = Date.now()) {
    let b = this.buckets.get(client);
    if (!b) {
      b = { tokens: this.capacity, last: now }; // new clients start full
      this.buckets.set(client, b);
    }
    b.tokens = Math.min(this.capacity, b.tokens + ((now - b.last) * this.rate) / 1000);
    b.last = now;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return true;
    }
    return false;
  }
}

const verdict = (ok) => (ok ? "allowed" : "REJECTED");

const sw = new SlidingWindowCounter(5, 1000);
console.log("sliding window, limit 5/s");
for (let t = 0; t < 700; t += 100) {          // 7 requests in the first 700 ms
  console.log("  t=" + t + " alice -> " + verdict(sw.allow("alice", t)));
}
console.log("  t=600 bob   -> " + verdict(sw.allow("bob", 600)));     // separate key
console.log("  t=1500 alice -> " + verdict(sw.allow("alice", 1500))); // 5*0.5 + 0 = 2.5
console.log("  t=1600 alice -> " + verdict(sw.allow("alice", 1600))); // 5*0.4 + 1 = 3.0
console.log("  t=1700 alice -> " + verdict(sw.allow("alice", 1700))); // 5*0.3 + 2 = 3.5
console.log("  t=1710 alice -> " + verdict(sw.allow("alice", 1710))); // 5*0.29 + 3 = 4.45

const tb = new TokenBucket(3, 1);
console.log("token bucket, capacity 3, refill 1/s");
for (let i = 1; i <= 5; i++) {                // burst of 5 at t=0
  console.log("  t=0 req" + i + " -> " + verdict(tb.allow("alice", 0)));
}
for (let i = 1; i <= 3; i++) {                // 2 s later: 2 tokens refilled
  console.log("  t=2000 req" + i + " -> " + verdict(tb.allow("alice", 2000)));
}`,
      go: String.raw`package main

import (
	"fmt"
	"math"
	"sync"
)

// SlidingWindowCounter weights the previous fixed window by how much of it
// still overlaps the sliding window. O(1) memory per client.
type SlidingWindowCounter struct {
	mu       sync.Mutex
	limit    int
	windowMs int64
	state    map[string]*swState
}

type swState struct {
	start      int64
	prev, curr int
}

func NewSlidingWindowCounter(limit int, windowMs int64) *SlidingWindowCounter {
	return &SlidingWindowCounter{limit: limit, windowMs: windowMs, state: map[string]*swState{}}
}

func (s *SlidingWindowCounter) Allow(client string, nowMs int64) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	start := nowMs - nowMs%s.windowMs
	st, ok := s.state[client]
	if !ok {
		st = &swState{start: start}
		s.state[client] = st
	} else if st.start != start {
		// roll over: the old current window becomes "previous" only if adjacent
		if start-st.start == s.windowMs {
			st.prev = st.curr
		} else {
			st.prev = 0
		}
		st.curr = 0
		st.start = start
	}
	elapsed := float64(nowMs-start) / float64(s.windowMs) // 0.0 .. <1.0
	estimated := float64(st.prev)*(1-elapsed) + float64(st.curr)
	if estimated+1 > float64(s.limit) {
		return false
	}
	st.curr++
	return true
}

// TokenBucket holds up to capacity tokens, refilled at ratePerSec.
// Each request spends one token. Allows short bursts up to capacity.
type TokenBucket struct {
	mu       sync.Mutex
	capacity float64
	rate     float64
	buckets  map[string]*bucket
}

type bucket struct {
	tokens float64
	last   int64
}

func NewTokenBucket(capacity int, ratePerSec float64) *TokenBucket {
	return &TokenBucket{capacity: float64(capacity), rate: ratePerSec, buckets: map[string]*bucket{}}
}

func (t *TokenBucket) Allow(client string, nowMs int64) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	b, ok := t.buckets[client]
	if !ok {
		b = &bucket{tokens: t.capacity, last: nowMs} // new clients start full
		t.buckets[client] = b
	}
	b.tokens = math.Min(t.capacity, b.tokens+float64(nowMs-b.last)*t.rate/1000)
	b.last = nowMs
	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

func verdict(ok bool) string {
	if ok {
		return "allowed"
	}
	return "REJECTED"
}

func main() {
	sw := NewSlidingWindowCounter(5, 1000)
	fmt.Println("sliding window, limit 5/s")
	for t := int64(0); t < 700; t += 100 { // 7 requests in the first 700 ms
		fmt.Printf("  t=%d alice -> %s\n", t, verdict(sw.Allow("alice", t)))
	}
	fmt.Println("  t=600 bob   -> " + verdict(sw.Allow("bob", 600)))     // separate key
	fmt.Println("  t=1500 alice -> " + verdict(sw.Allow("alice", 1500))) // 5*0.5 + 0 = 2.5
	fmt.Println("  t=1600 alice -> " + verdict(sw.Allow("alice", 1600))) // 5*0.4 + 1 = 3.0
	fmt.Println("  t=1700 alice -> " + verdict(sw.Allow("alice", 1700))) // 5*0.3 + 2 = 3.5
	fmt.Println("  t=1710 alice -> " + verdict(sw.Allow("alice", 1710))) // 5*0.29 + 3 = 4.45

	tb := NewTokenBucket(3, 1)
	fmt.Println("token bucket, capacity 3, refill 1/s")
	for i := 1; i <= 5; i++ { // burst of 5 at t=0
		fmt.Printf("  t=0 req%d -> %s\n", i, verdict(tb.Allow("alice", 0)))
	}
	for i := 1; i <= 3; i++ { // 2 s later: 2 tokens refilled
		fmt.Printf("  t=2000 req%d -> %s\n", i, verdict(tb.Allow("alice", 2000)))
	}
}`,
    },
  },
  diagrams: {
    placement: String.raw`flowchart LR
      C[Client] --> E["CDN / WAF<br/>IP limits"]
      E --> LB[Load balancer]
      LB --> G["API gateway<br/>per-key limits"]
      G --> S1["Payments service<br/>business limits"]
      G --> S2[Orders service]
      G -. 429 .-> C`,
    arch: String.raw`flowchart LR
      C[Clients] --> LB[Load balancer]
      LB --> G1["Gateway 1<br/>limiter middleware"]
      LB --> G2["Gateway 2<br/>limiter middleware"]
      LB --> G3["Gateway N<br/>limiter middleware"]
      RS[Rules service] --> RDB[(Rules DB)]
      RS -. push rules .-> G1
      RS -. push rules .-> G2
      RS -. push rules .-> G3
      G1 --> R[("Redis cluster<br/>sharded counters")]
      G2 --> R
      G3 --> R
      G1 --> B[Backend services]
      G2 --> B
      G3 --> B
      G1 -. metrics .-> M[Monitoring]`,
    flow: String.raw`sequenceDiagram
      participant C as Client
      participant G as Gateway
      participant R as Redis shard
      participant B as Backend
      C->>G: GET /v1/orders (api key)
      G->>G: auth and match rules (local cache)
      G->>R: EVALSHA sliding_window keys, limit
      R-->>G: allowed, remaining
      alt allowed
        G->>B: forward request
        B-->>G: 200 OK
        G-->>C: 200 with X-RateLimit headers
      else over limit
        G-->>C: 429 with Retry-After
      end`,
    race: String.raw`sequenceDiagram
      participant G1 as Gateway 1
      participant R as Redis
      participant G2 as Gateway 2
      G1->>R: GET count
      G2->>R: GET count
      R-->>G1: 99
      R-->>G2: 99
      Note over G1,G2: both see 99 which is below 100
      G1->>R: SET count 100
      G2->>R: SET count 100
      Note over R: count is 100 but 101 requests were allowed`,
    multidc: String.raw`flowchart LR
      subgraph Mumbai
        GM[Gateways] --> RM[("Redis Mumbai")]
      end
      subgraph Hyderabad
        GH[Gateways] --> RH[("Redis Hyderabad")]
      end
      RM -.->|async count sync| RH
      RH -.-> RM`,
  },
});
