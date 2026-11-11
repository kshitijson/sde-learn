SD.register({
  id: "api-gateway-rate-limiting",
  html: String.raw`
    <p class="lead">An API gateway is the single front door for all your backend services. Clients send every request to the gateway, and it handles the boring but critical cross-cutting work (authentication, routing, rate limiting, TLS, logging) before passing the request to the right microservice. Rate limiting is one of its most important jobs: it caps how many requests a client can make in a time window, so one buggy script or attacker cannot take down the system for everyone.</p>

    <h2>What an API gateway is</h2>
    <p>Imagine Zomato's backend is 80 microservices: restaurants, menus, cart, orders, payments, delivery tracking, reviews. Without a gateway, the mobile app would need to know 80 addresses, and each service would re-implement login checks, throttling and logging. With a gateway, the app talks to <code>api.zomato.com</code> only. The gateway looks at the path, checks the token, and forwards to the right service.</p>
    <div data-diagram="gateway" data-caption="All clients go through one gateway, which applies shared policies and routes to the right service."></div>

    <h3>Responsibilities</h3>
    <table>
      <thead><tr><th>Responsibility</th><th>What it means</th></tr></thead>
      <tbody>
        <tr><td>Routing</td><td>Map <code>/v1/orders/*</code> to the order service, <code>/v1/menu/*</code> to the menu service. Also canary and A/B routing by header or percentage.</td></tr>
        <tr><td>Authentication and authorization</td><td>Validate the JWT or API key once, reject bad requests early, and pass the user id downstream in a header.</td></tr>
        <tr><td>Rate limiting and quotas</td><td>Cap requests per user, per API key or per IP; enforce paid-plan quotas (for example, 1,000 calls/day on a free tier).</td></tr>
        <tr><td>TLS termination</td><td>Decrypt HTTPS at the edge so internal services can speak plain HTTP or mTLS.</td></tr>
        <tr><td>Request aggregation</td><td>One client call fans out to several services and the gateway merges the results (the home screen needs user + offers + restaurants).</td></tr>
        <tr><td>Caching</td><td>Cache responses for public, rarely changing GETs such as city lists or menus.</td></tr>
        <tr><td>Protocol translation</td><td>REST from the client to gRPC internally; WebSocket upgrade handling.</td></tr>
        <tr><td>Logging, metrics, tracing</td><td>Access logs, per-route latency and error rates, and a trace id injected into every request.</td></tr>
        <tr><td>Request shaping</td><td>Header rewrite, payload size limits, CORS, IP allow/deny lists.</td></tr>
      </tbody>
    </table>
    <div class="callout warn"><strong>Keep business logic out</strong>The gateway should stay thin. Once teams start putting "if order total &gt; 500 then ..." into gateway config, it becomes a distributed monolith that every team must change and deploy. It is also a single point of failure, so run several instances behind a load balancer.</div>

    <h3>Backend for Frontend (BFF)</h3>
    <p>One general-purpose gateway often serves mobile, web and partner clients badly: the mobile app wants small payloads, the web app wants rich ones, and partners want stable, versioned APIs. The <strong>BFF pattern</strong> gives each client type its own thin gateway layer, owned by that client's team. The mobile BFF aggregates and trims data for the app; the web BFF shapes data for the browser. Netflix and SoundCloud popularised it, and many Indian consumer apps (Swiggy, Flipkart) run separate app and web BFFs.</p>
    <div data-diagram="bff" data-caption="Backend for Frontend: one tailored gateway per client type, all calling the same shared services."></div>

    <h3>Gateway vs load balancer vs reverse proxy</h3>
    <p>These overlap and one product (Nginx, Envoy) can play all three roles. The difference is the job you give it.</p>
    <table>
      <thead><tr><th></th><th>Reverse proxy</th><th>Load balancer</th><th>API gateway</th></tr></thead>
      <tbody>
        <tr><td>Main job</td><td>Stand in front of servers, hide them</td><td>Spread traffic across identical replicas</td><td>Manage APIs: route to many different services and apply policies</td></tr>
        <tr><td>Knows about</td><td>Upstream servers</td><td>Server pool health and load</td><td>Routes, consumers, API keys, plans, versions</td></tr>
        <tr><td>Typical features</td><td>TLS, caching, compression</td><td>Algorithms, health checks</td><td>Auth, rate limits, quotas, aggregation, transformations, developer portal</td></tr>
        <tr><td>Examples</td><td>Nginx, Varnish</td><td>AWS ALB/NLB, HAProxy</td><td>Kong, AWS API Gateway, Apigee, Spring Cloud Gateway, Envoy-based gateways</td></tr>
      </tbody>
    </table>
    <p>A load balancer is a kind of reverse proxy. An API gateway is a reverse proxy with API-management features. In a real system they stack: DNS, then a cloud LB, then a fleet of gateway instances, then per-service load balancing.</p>

    <h2>Rate limiting: why</h2>
    <ul>
      <li><strong>Protect against abuse</strong>: credential stuffing on <code>/login</code>, OTP flooding (each SMS costs money), scraping, and simple DoS attacks.</li>
      <li><strong>Fairness</strong>: one heavy customer should not starve others in a multi-tenant API (Razorpay merchants, for example).</li>
      <li><strong>Cost control</strong>: calls to paid third-party APIs (SMS, maps, LLMs) are capped.</li>
      <li><strong>Protect downstream services</strong>: a database that handles 5,000 queries/sec should never see 50,000, even during a flash sale. Shedding excess load early keeps the system up for the requests you do accept.</li>
      <li><strong>Monetisation</strong>: plans and quotas (free tier 100 req/min, paid 10,000 req/min).</li>
    </ul>

    <h3>Where to rate limit</h3>
    <div class="grid-3">
      <div class="card"><strong>Client side</strong><p>The app debounces taps and backs off on errors. Polite, cuts wasted traffic, but can never be trusted: attackers ignore it.</p></div>
      <div class="card"><strong>Gateway / edge</strong><p>The usual answer. Rejects bad traffic before it costs anything downstream. Limits per user, API key or IP in one central place.</p></div>
      <div class="card"><strong>Service level</strong><p>Each service protects itself (concurrency limits, per-endpoint limits) with knowledge the gateway lacks, such as "max 3 payment attempts per order".</p></div>
    </div>
    <p>Use the gateway as the main layer and add service-level limits for expensive or sensitive operations. Limits are keyed by something: user id (logged-in APIs), API key (public APIs), IP (anonymous endpoints such as login), or a combination, like <code>user:42:/send-otp</code>.</p>

    <h2>Rate limiting algorithms</h2>
    <p>Try the algorithms below: fire bursts of requests and watch which get through.</p>
    <div data-widget="rate-limiter"></div>

    <h3>Token bucket</h3>
    <p>A bucket holds up to <em>capacity</em> tokens and refills at a fixed <em>rate</em> (say 10 tokens/sec). Each request takes one token. No token, no entry. A full bucket lets a burst of <em>capacity</em> requests through instantly, then the long-run rate is capped at the refill rate. You do not need a timer: store <code>tokens</code> and <code>lastRefillTime</code>, and on each request add <code>elapsed × rate</code> tokens (capped at capacity). Used by AWS API Gateway, Stripe and most cloud APIs.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 230">
        <rect class="s-box" x="20" y="20" width="150" height="50" rx="10"/>
        <text class="s-title" x="95" y="44" text-anchor="middle">Refiller</text>
        <text class="s-muted" x="95" y="61" text-anchor="middle">+10 tokens/sec</text>
        <line class="s-line" x1="170" y1="45" x2="248" y2="80" marker-end="url(#arrow)"/>
        <rect class="s-accent" x="250" y="60" width="140" height="130" rx="10"/>
        <text class="s-title" x="320" y="88" text-anchor="middle">Bucket</text>
        <text class="s-muted" x="320" y="106" text-anchor="middle">capacity 20</text>
        <circle class="s-green" cx="290" cy="140" r="10"/>
        <circle class="s-green" cx="320" cy="140" r="10"/>
        <circle class="s-green" cx="350" cy="140" r="10"/>
        <circle class="s-green" cx="305" cy="168" r="10"/>
        <circle class="s-green" cx="335" cy="168" r="10"/>
        <rect class="s-box" x="20" y="150" width="150" height="50" rx="10"/>
        <text class="s-title" x="95" y="180" text-anchor="middle">Requests</text>
        <line class="s-line" x1="170" y1="175" x2="248" y2="160" marker-end="url(#arrow)"/>
        <line class="s-line" x1="390" y1="100" x2="468" y2="70" marker-end="url(#arrow)"/>
        <rect class="s-green" x="470" y="40" width="150" height="50" rx="10"/>
        <text class="s-title" x="545" y="62" text-anchor="middle">Token taken</text>
        <text class="s-muted" x="545" y="79" text-anchor="middle">forward request</text>
        <line class="s-line" x1="390" y1="160" x2="468" y2="170" marker-end="url(#arrow)"/>
        <rect class="s-red" x="470" y="145" width="150" height="50" rx="10"/>
        <text class="s-title" x="545" y="167" text-anchor="middle">Bucket empty</text>
        <text class="s-muted" x="545" y="184" text-anchor="middle">429 Too Many Requests</text>
      </svg>
      <figcaption>Token bucket: tokens drip in at a fixed rate up to a cap; each request spends one, and an empty bucket means rejection.</figcaption>
    </figure>

    <h3>Leaking bucket</h3>
    <p>Requests enter a fixed-size FIFO queue and are processed at a constant rate, like water leaking from a hole. If the queue is full, new requests are dropped. Output is perfectly smooth, which is great for protecting a fragile downstream system (a bank API that accepts only 50 calls/sec). The downside: bursts wait in the queue (added latency), and a burst of old requests can block fresh ones. Shopify and Nginx's <code>limit_req</code> use variants of it.</p>

    <h3>Fixed window counter</h3>
    <p>Split time into fixed windows (12:00:00 to 12:00:59) and keep one counter per key per window. Increment on each request; reject when it exceeds the limit. Tiny memory and trivial to build with Redis <code>INCR</code>. The flaw is the <strong>boundary burst</strong>: with a limit of 100/min, a client can send 100 at 12:00:59 and another 100 at 12:01:00, so 200 requests pass in two seconds.</p>

    <h3>Sliding window log</h3>
    <p>Store the timestamp of every request (for example, in a Redis sorted set). On each request, drop timestamps older than one window and count the rest. Perfectly accurate, no boundary problem. The cost is memory: a limit of 10,000/hour means up to 10,000 timestamps per user. Rejected requests may also be logged, depending on the implementation.</p>

    <h3>Sliding window counter</h3>
    <p>A hybrid that keeps just two counters: the current window and the previous one. It estimates the count in the last rolling window by weighting the previous window by how much of it still overlaps:</p>
    <p><code>estimate = previous × (1 − elapsed / window) + current</code></p>
    <p>Example: limit 100/min, the previous minute had 80 requests, the current minute has 30, and we are 15 seconds (25%) into it. Estimate = 80 × 0.75 + 30 = 90, so the request is allowed. It assumes requests in the previous window were evenly spread, so it is approximate, but Cloudflare measured only about 0.003% of requests wrongly allowed or limited. This is the best default for most APIs.</p>

    <table>
      <thead><tr><th>Algorithm</th><th>Memory per key</th><th>Bursts</th><th>Accuracy</th><th>Good for</th></tr></thead>
      <tbody>
        <tr><td>Token bucket</td><td>2 numbers</td><td>Allows up to capacity</td><td>Good</td><td>Most public APIs; bursty but bounded clients</td></tr>
        <tr><td>Leaking bucket</td><td>Queue of size N</td><td>Smoothed out (queued)</td><td>Good</td><td>Steady outflow to a fragile downstream</td></tr>
        <tr><td>Fixed window</td><td>1 counter</td><td>2× limit at window edges</td><td>Weak at boundaries</td><td>Simple quotas (per day), low-stakes limits</td></tr>
        <tr><td>Sliding window log</td><td>1 timestamp per request</td><td>None</td><td>Exact</td><td>Low limits where exactness matters (login, OTP)</td></tr>
        <tr><td>Sliding window counter</td><td>2 counters</td><td>Small</td><td>Approximate, very close</td><td>High-scale general API limiting</td></tr>
      </tbody>
    </table>

    <h3>Code: token bucket and sliding window counter</h3>
    <p>Both classes take the current time in milliseconds as an argument, which keeps the demo deterministic and makes them easy to unit test. In production you pass a monotonic clock reading. Each class guards its state with a lock so it is safe to share across threads.</p>
    <div data-code="limiters"></div>

    <h2>Telling the client: HTTP 429 and headers</h2>
    <p>When a request is rejected, return <code>429 Too Many Requests</code> (not 500 or 503) so clients know it is their fault and can retry later. Add headers so well-behaved clients can slow down before they hit the wall:</p>
    <table>
      <thead><tr><th>Header</th><th>Meaning</th><th>Example</th></tr></thead>
      <tbody>
        <tr><td><code>X-RateLimit-Limit</code></td><td>Requests allowed in the window</td><td><code>100</code></td></tr>
        <tr><td><code>X-RateLimit-Remaining</code></td><td>Requests left in the current window</td><td><code>0</code></td></tr>
        <tr><td><code>X-RateLimit-Reset</code></td><td>When the window resets (epoch seconds or seconds from now)</td><td><code>1767225600</code></td></tr>
        <tr><td><code>Retry-After</code></td><td>Seconds to wait before retrying (standard HTTP header)</td><td><code>30</code></td></tr>
      </tbody>
    </table>
    <p>An IETF draft standardises these as <code>RateLimit-Limit</code>, <code>RateLimit-Remaining</code> and <code>RateLimit-Reset</code> without the <code>X-</code> prefix; GitHub and many others still use the <code>X-</code> names. Clients should respond to a 429 with <strong>exponential backoff plus jitter</strong> (random delay) so that thousands of clients do not all retry at the same instant.</p>
    <div data-diagram="flow429" data-caption="A rejected request gets a 429 with headers telling the client when to retry."></div>
    <div class="callout tip"><strong>Hard vs soft limits</strong>You do not always have to reject. For trusted internal callers you might queue (leaking bucket), degrade (serve cached data), or allow a small overshoot and alert. For login and OTP endpoints, always hard-reject.</div>

    <h2>Distributed rate limiting with Redis</h2>
    <p>With 20 gateway instances behind a load balancer, a per-instance in-memory counter is wrong: a user limited to 100/min could get 100 on each instance, so 2,000. You need a <strong>shared counter</strong>, and Redis is the standard choice: it is in-memory (sub-millisecond), single-threaded per shard (each command is atomic) and has key expiry built in.</p>
    <div data-diagram="redis" data-caption="All gateway instances share counters in Redis, so the limit is global rather than per instance."></div>
    <h3>Fixed window with INCR and EXPIRE</h3>
    <p>Key: <code>rl:{userId}:{windowStart}</code>. On each request, <code>INCR</code> the key; if the result is 1 (first request in this window), set <code>EXPIRE</code> to the window length so the key cleans itself up. If the result is greater than the limit, reject.</p>
    <p>The bug: <code>INCR</code> and <code>EXPIRE</code> are two separate commands. If the gateway crashes between them, the key never expires and the user is blocked forever. A read-then-write ("GET, check, then INCR") version has a race: two instances both read 99 and both allow. The fix is to run the logic atomically inside Redis with a <strong>Lua script</strong> (Redis runs a script without interleaving other commands):</p>
    <pre><code>-- KEYS[1] = rate limit key, ARGV[1] = window in ms, ARGV[2] = limit
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
if count &gt; tonumber(ARGV[2]) then
  return 0   -- reject
end
return 1     -- allow</code></pre>
    <p>A token bucket in Redis works the same way: a Lua script reads <code>tokens</code> and <code>last_refill</code> from a hash, refills, decrements and writes back in one atomic step. A sliding window log uses a sorted set: <code>ZREMRANGEBYSCORE</code> to drop old entries, <code>ZCARD</code> to count, <code>ZADD</code> to record, all in one script or <code>MULTI</code> transaction.</p>

    <h3>Practical concerns</h3>
    <ul>
      <li><strong>Latency</strong>: a Redis round trip adds about 0.5 to 1 ms per request. To cut it, keep a small local token allowance per instance and sync with Redis in batches (accepting slight over-admission).</li>
      <li><strong>Redis down</strong>: decide to <em>fail open</em> (allow traffic, risk overload) or <em>fail closed</em> (reject everything). Most products fail open for general APIs and fail closed for security-sensitive endpoints like login.</li>
      <li><strong>Hot keys and scale</strong>: shard counters across a Redis Cluster by key; one key per user spreads naturally.</li>
      <li><strong>Clock skew</strong>: use Redis server time (<code>TIME</code>) inside the script rather than each gateway's clock, or keep windows coarse.</li>
      <li><strong>Multi-region</strong>: a single global Redis adds cross-region latency. Usually each region limits locally with a share of the global quota.</li>
    </ul>

    <h2>Real-world examples</h2>
    <ul>
      <li><strong>GitHub API</strong>: 5,000 requests/hour per authenticated user, returned in <code>X-RateLimit-*</code> headers.</li>
      <li><strong>Stripe</strong>: token buckets per merchant plus a concurrency limiter and load shedder that drops low-priority traffic first.</li>
      <li><strong>OTP endpoints in Indian fintech</strong>: typically 3 to 5 OTPs per phone number per 15 minutes, plus per-IP and per-device limits, because each SMS costs money and OTP bombing is common.</li>
      <li><strong>Kong / Envoy / AWS API Gateway</strong>: built-in rate-limit plugins backed by Redis or a central rate-limit service.</li>
    </ul>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"Rate limiting happens at the API gateway, keyed by user id for logged-in calls and by IP for anonymous ones, with stricter per-endpoint rules for login and OTP."</li>
        <li>"I'll use a token bucket because it allows short bursts while capping the average rate. If I need a strict rolling window, a sliding window counter gives near-exact results with two counters per key."</li>
        <li>"Counters live in Redis so the limit is global across gateway instances, and the check-and-increment runs in a Lua script so it's atomic. If Redis is unavailable we fail open for normal APIs."</li>
        <li>"Rejected calls get 429 with <code>Retry-After</code>, and clients back off exponentially with jitter."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Per-instance counters that silently multiply the limit; non-atomic read-then-write; returning 500 instead of 429; forgetting that IP-based limits punish everyone behind a shared NAT (college campus, office, mobile carrier).</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>What is the difference between an API gateway and a load balancer?</summary><div>A load balancer spreads traffic across identical replicas of one service using health checks and balancing algorithms. An API gateway routes requests to many <em>different</em> services and applies API policies: auth, rate limits, quotas, transformations and aggregation. A gateway is usually behind a load balancer and may itself balance across instances.</div></details>
      <details><summary>A limit is 100 requests/minute using a fixed window. How can a client send 200 requests in about one second?</summary><div>Send 100 at the very end of one window (12:00:59.5) and 100 at the start of the next (12:01:00.0). Both windows see only 100, so all 200 pass. Sliding window log or counter fixes this.</div></details>
      <details><summary>Compute the sliding window counter estimate: limit 50/min, previous window 40, current 20, 30 s into the current minute. Allow or reject?</summary><div>Estimate = 40 × (1 − 30/60) + 20 = 20 + 20 = 40. 40 &lt; 50, so allow.</div></details>
      <details><summary>Why does running INCR then EXPIRE from the application cause problems, and how do you fix it?</summary><div>They are two commands. A crash between them leaves a counter with no expiry, blocking the user forever; read-then-write logic also races across instances. Run the logic in a Lua script (or use <code>SET key 0 EX 60 NX</code> followed by <code>INCR</code>) so it executes atomically inside Redis.</div></details>
      <details><summary>Which algorithm would you choose to protect a partner bank API that accepts at most 50 calls/sec at a steady rate?</summary><div>Leaking bucket: it queues requests and releases them at a constant rate, so the downstream never sees a burst. Token bucket would allow bursts up to its capacity.</div></details>
      <details><summary>What is the BFF pattern and when is it worth it?</summary><div>Backend for Frontend: a separate thin gateway per client type (mobile, web, partner) that tailors aggregation and payloads to that client. Worth it when client needs diverge a lot and separate teams own them; overkill for a single client.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>An API gateway is the single entry point that handles routing, auth, rate limiting, TLS, aggregation, caching and observability. Keep it thin and redundant.</li>
      <li>BFF gives each client type its own tailored gateway.</li>
      <li>Rate limit mainly at the gateway, keyed by user, API key or IP, with stricter limits on sensitive endpoints.</li>
      <li>Token bucket allows bounded bursts; leaking bucket smooths output; fixed window is simple but bursts at edges; sliding log is exact but memory-hungry; sliding window counter is the practical sweet spot.</li>
      <li>Return 429 with <code>X-RateLimit-*</code> and <code>Retry-After</code>; clients back off with jitter.</li>
      <li>Distributed limits need shared counters in Redis, updated atomically with Lua, with a clear fail-open or fail-closed policy.</li>
    </ul></div>
  `,
  code: {
    limiters: {
      title: "Token bucket and sliding window counter (time passed in as milliseconds)",
      java: String.raw`public class Main {
    static class TokenBucket {
        private final long capacity;
        private final double refillPerMs;
        private double tokens;
        private long lastRefillMs;

        TokenBucket(long capacity, double refillPerSecond, long nowMs) {
            this.capacity = capacity;
            this.refillPerMs = refillPerSecond / 1000.0;
            this.tokens = capacity;      // start full
            this.lastRefillMs = nowMs;
        }

        synchronized boolean tryAcquire(long nowMs) {
            long elapsed = Math.max(0, nowMs - lastRefillMs);
            tokens = Math.min(capacity, tokens + elapsed * refillPerMs);
            lastRefillMs = nowMs;
            if (tokens >= 1) {
                tokens -= 1;
                return true;
            }
            return false;
        }
    }

    static class SlidingWindowCounter {
        private final long limit;
        private final long windowMs;
        private long currentStart = 0;
        private long currentCount = 0;
        private long previousCount = 0;

        SlidingWindowCounter(long limit, long windowMs) {
            this.limit = limit;
            this.windowMs = windowMs;
        }

        synchronized boolean tryAcquire(long nowMs) {
            long windowStart = nowMs - (nowMs % windowMs);
            if (windowStart != currentStart) {
                // Roll over: the old "current" becomes "previous" only if it is the adjacent window.
                previousCount = (windowStart - currentStart == windowMs) ? currentCount : 0;
                currentCount = 0;
                currentStart = windowStart;
            }
            double weight = 1.0 - (double) (nowMs - windowStart) / windowMs;
            double estimate = previousCount * weight + currentCount;
            if (estimate + 1 <= limit) {
                currentCount++;
                return true;
            }
            return false;
        }
    }

    static String run(java.util.function.LongPredicate limiter, long nowMs, int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) sb.append(limiter.test(nowMs) ? 'Y' : 'n');
        return sb.toString();
    }

    public static void main(String[] args) {
        TokenBucket tb = new TokenBucket(5, 1, 0);   // burst 5, refill 1 token/sec
        System.out.println("Token bucket   t=0s : " + run(tb::tryAcquire, 0, 7));      // YYYYYnn
        System.out.println("Token bucket   t=2s : " + run(tb::tryAcquire, 2000, 3));   // YYn

        SlidingWindowCounter sw = new SlidingWindowCounter(4, 1000); // 4 per second
        System.out.println("Sliding window t=0.1s: " + run(sw::tryAcquire, 100, 5));   // YYYYn
        // At t=1.5s the previous window (4 requests) still counts 50%: estimate starts at 2.
        System.out.println("Sliding window t=1.5s: " + run(sw::tryAcquire, 1500, 3));  // YYn
    }
}
`,
      python: String.raw`import threading


class TokenBucket:
    def __init__(self, capacity: int, refill_per_second: float, now_ms: int):
        self.capacity = capacity
        self.refill_per_ms = refill_per_second / 1000.0
        self.tokens = float(capacity)  # start full
        self.last_refill_ms = now_ms
        self.lock = threading.Lock()

    def try_acquire(self, now_ms: int) -> bool:
        with self.lock:
            elapsed = max(0, now_ms - self.last_refill_ms)
            self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_per_ms)
            self.last_refill_ms = now_ms
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False


class SlidingWindowCounter:
    def __init__(self, limit: int, window_ms: int):
        self.limit = limit
        self.window_ms = window_ms
        self.current_start = 0
        self.current_count = 0
        self.previous_count = 0
        self.lock = threading.Lock()

    def try_acquire(self, now_ms: int) -> bool:
        with self.lock:
            window_start = now_ms - (now_ms % self.window_ms)
            if window_start != self.current_start:
                # The old "current" becomes "previous" only if it is the adjacent window.
                adjacent = window_start - self.current_start == self.window_ms
                self.previous_count = self.current_count if adjacent else 0
                self.current_count = 0
                self.current_start = window_start
            weight = 1 - (now_ms - window_start) / self.window_ms
            estimate = self.previous_count * weight + self.current_count
            if estimate + 1 <= self.limit:
                self.current_count += 1
                return True
            return False


def run(acquire, now_ms: int, n: int) -> str:
    return "".join("Y" if acquire(now_ms) else "n" for _ in range(n))


if __name__ == "__main__":
    tb = TokenBucket(capacity=5, refill_per_second=1, now_ms=0)
    print("Token bucket   t=0s :", run(tb.try_acquire, 0, 7))       # YYYYYnn
    print("Token bucket   t=2s :", run(tb.try_acquire, 2000, 3))    # YYn

    sw = SlidingWindowCounter(limit=4, window_ms=1000)
    print("Sliding window t=0.1s:", run(sw.try_acquire, 100, 5))    # YYYYn
    # At t=1.5s the previous window (4 requests) still counts 50%: estimate starts at 2.
    print("Sliding window t=1.5s:", run(sw.try_acquire, 1500, 3))   # YYn
`,
      cpp: String.raw`#include <algorithm>
#include <cstdint>
#include <functional>
#include <iostream>
#include <mutex>
#include <string>

class TokenBucket {
    const double capacity_;
    const double refillPerMs_;
    double tokens_;
    int64_t lastRefillMs_;
    std::mutex mu_;
public:
    TokenBucket(int capacity, double refillPerSecond, int64_t nowMs)
        : capacity_(capacity), refillPerMs_(refillPerSecond / 1000.0),
          tokens_(capacity), lastRefillMs_(nowMs) {}

    bool tryAcquire(int64_t nowMs) {
        std::lock_guard<std::mutex> lock(mu_);
        int64_t elapsed = std::max<int64_t>(0, nowMs - lastRefillMs_);
        tokens_ = std::min(capacity_, tokens_ + elapsed * refillPerMs_);
        lastRefillMs_ = nowMs;
        if (tokens_ >= 1) {
            tokens_ -= 1;
            return true;
        }
        return false;
    }
};

class SlidingWindowCounter {
    const int64_t limit_;
    const int64_t windowMs_;
    int64_t currentStart_ = 0;
    int64_t currentCount_ = 0;
    int64_t previousCount_ = 0;
    std::mutex mu_;
public:
    SlidingWindowCounter(int64_t limit, int64_t windowMs) : limit_(limit), windowMs_(windowMs) {}

    bool tryAcquire(int64_t nowMs) {
        std::lock_guard<std::mutex> lock(mu_);
        int64_t windowStart = nowMs - (nowMs % windowMs_);
        if (windowStart != currentStart_) {
            // The old "current" becomes "previous" only if it is the adjacent window.
            previousCount_ = (windowStart - currentStart_ == windowMs_) ? currentCount_ : 0;
            currentCount_ = 0;
            currentStart_ = windowStart;
        }
        double weight = 1.0 - static_cast<double>(nowMs - windowStart) / windowMs_;
        double estimate = previousCount_ * weight + currentCount_;
        if (estimate + 1 <= limit_) {
            currentCount_++;
            return true;
        }
        return false;
    }
};

std::string run(const std::function<bool(int64_t)>& acquire, int64_t nowMs, int n) {
    std::string out;
    for (int i = 0; i < n; i++) out += acquire(nowMs) ? 'Y' : 'n';
    return out;
}

int main() {
    TokenBucket tb(5, 1, 0);  // burst 5, refill 1 token/sec
    auto tbFn = [&](int64_t t) { return tb.tryAcquire(t); };
    std::cout << "Token bucket   t=0s : " << run(tbFn, 0, 7) << "\n";     // YYYYYnn
    std::cout << "Token bucket   t=2s : " << run(tbFn, 2000, 3) << "\n";  // YYn

    SlidingWindowCounter sw(4, 1000);  // 4 per second
    auto swFn = [&](int64_t t) { return sw.tryAcquire(t); };
    std::cout << "Sliding window t=0.1s: " << run(swFn, 100, 5) << "\n";   // YYYYn
    // At t=1.5s the previous window (4 requests) still counts 50%: estimate starts at 2.
    std::cout << "Sliding window t=1.5s: " << run(swFn, 1500, 3) << "\n";  // YYn
}
`,
      javascript: String.raw`class TokenBucket {
  constructor(capacity, refillPerSecond, nowMs) {
    this.capacity = capacity;
    this.refillPerMs = refillPerSecond / 1000;
    this.tokens = capacity; // start full
    this.lastRefillMs = nowMs;
  }

  tryAcquire(nowMs) {
    const elapsed = Math.max(0, nowMs - this.lastRefillMs);
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefillMs = nowMs;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

class SlidingWindowCounter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.currentStart = 0;
    this.currentCount = 0;
    this.previousCount = 0;
  }

  tryAcquire(nowMs) {
    const windowStart = nowMs - (nowMs % this.windowMs);
    if (windowStart !== this.currentStart) {
      // The old "current" becomes "previous" only if it is the adjacent window.
      const adjacent = windowStart - this.currentStart === this.windowMs;
      this.previousCount = adjacent ? this.currentCount : 0;
      this.currentCount = 0;
      this.currentStart = windowStart;
    }
    const weight = 1 - (nowMs - windowStart) / this.windowMs;
    const estimate = this.previousCount * weight + this.currentCount;
    if (estimate + 1 <= this.limit) {
      this.currentCount++;
      return true;
    }
    return false;
  }
}

// Node.js is single-threaded, so no lock is needed inside one process.
function run(limiter, nowMs, n) {
  let out = "";
  for (let i = 0; i < n; i++) out += limiter.tryAcquire(nowMs) ? "Y" : "n";
  return out;
}

const tb = new TokenBucket(5, 1, 0); // burst 5, refill 1 token/sec
console.log("Token bucket   t=0s :", run(tb, 0, 7));      // YYYYYnn
console.log("Token bucket   t=2s :", run(tb, 2000, 3));   // YYn

const sw = new SlidingWindowCounter(4, 1000); // 4 per second
console.log("Sliding window t=0.1s:", run(sw, 100, 5));   // YYYYn
// At t=1.5s the previous window (4 requests) still counts 50%: estimate starts at 2.
console.log("Sliding window t=1.5s:", run(sw, 1500, 3));  // YYn
`,
      go: String.raw`package main

import (
	"fmt"
	"math"
	"strings"
	"sync"
)

type TokenBucket struct {
	mu           sync.Mutex
	capacity     float64
	refillPerMs  float64
	tokens       float64
	lastRefillMs int64
}

func NewTokenBucket(capacity int, refillPerSecond float64, nowMs int64) *TokenBucket {
	return &TokenBucket{
		capacity:     float64(capacity),
		refillPerMs:  refillPerSecond / 1000,
		tokens:       float64(capacity), // start full
		lastRefillMs: nowMs,
	}
}

func (b *TokenBucket) TryAcquire(nowMs int64) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	elapsed := nowMs - b.lastRefillMs
	if elapsed < 0 {
		elapsed = 0
	}
	b.tokens = math.Min(b.capacity, b.tokens+float64(elapsed)*b.refillPerMs)
	b.lastRefillMs = nowMs
	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

type SlidingWindowCounter struct {
	mu            sync.Mutex
	limit         int64
	windowMs      int64
	currentStart  int64
	currentCount  int64
	previousCount int64
}

func NewSlidingWindowCounter(limit, windowMs int64) *SlidingWindowCounter {
	return &SlidingWindowCounter{limit: limit, windowMs: windowMs}
}

func (s *SlidingWindowCounter) TryAcquire(nowMs int64) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	windowStart := nowMs - nowMs%s.windowMs
	if windowStart != s.currentStart {
		// The old "current" becomes "previous" only if it is the adjacent window.
		if windowStart-s.currentStart == s.windowMs {
			s.previousCount = s.currentCount
		} else {
			s.previousCount = 0
		}
		s.currentCount = 0
		s.currentStart = windowStart
	}
	weight := 1 - float64(nowMs-windowStart)/float64(s.windowMs)
	estimate := float64(s.previousCount)*weight + float64(s.currentCount)
	if estimate+1 <= float64(s.limit) {
		s.currentCount++
		return true
	}
	return false
}

func run(acquire func(int64) bool, nowMs int64, n int) string {
	var sb strings.Builder
	for i := 0; i < n; i++ {
		if acquire(nowMs) {
			sb.WriteByte('Y')
		} else {
			sb.WriteByte('n')
		}
	}
	return sb.String()
}

func main() {
	tb := NewTokenBucket(5, 1, 0) // burst 5, refill 1 token/sec
	fmt.Println("Token bucket   t=0s :", run(tb.TryAcquire, 0, 7))    // YYYYYnn
	fmt.Println("Token bucket   t=2s :", run(tb.TryAcquire, 2000, 3)) // YYn

	sw := NewSlidingWindowCounter(4, 1000) // 4 per second
	fmt.Println("Sliding window t=0.1s:", run(sw.TryAcquire, 100, 5)) // YYYYn
	// At t=1.5s the previous window (4 requests) still counts 50%: estimate starts at 2.
	fmt.Println("Sliding window t=1.5s:", run(sw.TryAcquire, 1500, 3)) // YYn
}
`,
    },
  },
  diagrams: {
    gateway: String.raw`flowchart LR
      M[Mobile app] --> LB["Load balancer"]
      W[Web app] --> LB
      P[Partner] --> LB
      LB --> GW["API gateway (auth, rate limit, routing)"]
      GW -->|"/v1/menu"| MS[Menu service]
      GW -->|"/v1/orders"| OS[Order service]
      GW -->|"/v1/pay"| PS[Payment service]
      GW --> RL[("Redis counters")]`,
    bff: String.raw`flowchart TB
      MA[Mobile app] --> MB[Mobile BFF]
      WA[Web app] --> WB[Web BFF]
      PA[Partner] --> PB[Public API gateway]
      MB --> U[User service]
      MB --> O[Order service]
      WB --> U
      WB --> O
      WB --> R[Reco service]
      PB --> O`,
    flow429: String.raw`sequenceDiagram
      participant C as Client
      participant G as API gateway
      participant S as Service
      C->>G: GET /v1/orders
      G->>G: check limit (99 of 100 used)
      G->>S: forward
      S-->>G: 200 OK
      G-->>C: 200, X-RateLimit-Remaining 0
      C->>G: GET /v1/orders
      G->>G: check limit (100 of 100 used)
      G-->>C: 429, Retry-After 30
      Note over C: wait 30 s plus jitter, then retry`,
    redis: String.raw`flowchart LR
      C[Clients] --> LB["Load balancer"]
      LB --> G1[Gateway 1]
      LB --> G2[Gateway 2]
      LB --> G3[Gateway 3]
      G1 -->|"Lua: INCR + PEXPIRE"| R[("Redis cluster")]
      G2 --> R
      G3 --> R
      G1 --> SVC[Services]
      G2 --> SVC
      G3 --> SVC`,
  },
});
