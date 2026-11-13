SD.register({
  id: "http-versions",
  html: String.raw`
    <p class="lead">HTTP is the language browsers, apps and services use to ask for things and get answers. Its meaning (methods, status codes, headers) has barely changed since the 1990s, but the way it travels over the network has been rebuilt three times. HTTP/1.1 sends one request at a time per connection. HTTP/2 multiplexes many requests over one TCP connection. HTTP/3 moves to QUIC over UDP to escape TCP's head-of-line blocking and to survive network changes on mobile. This page covers each version, HTTPS, and the cheat sheets (status codes, idempotent methods, caching headers) that interviewers expect you to know cold.</p>

    <h2>What HTTP is</h2>
    <p>HTTP is a <strong>request-response</strong> protocol. The client sends a method (<code>GET</code>, <code>POST</code>…), a path, headers and an optional body. The server returns a status code, headers and an optional body. It is <strong>stateless</strong>: each request carries everything needed (cookies or tokens identify the user), which is what lets you put any number of identical servers behind a <a href="#/p/load-balancers">load balancer</a>.</p>
    <div data-diagram="evolution" data-caption="The same HTTP semantics over three different wire formats and transports."></div>
    <table>
      <thead><tr><th>Version</th><th>Year</th><th>Transport</th><th>Big idea</th></tr></thead>
      <tbody>
        <tr><td>HTTP/1.0</td><td>1996</td><td>TCP</td><td>One request per connection</td></tr>
        <tr><td>HTTP/1.1</td><td>1997 (RFC 2068, revised 1999 and 2022)</td><td>TCP</td><td>Persistent connections, Host header, chunked transfer</td></tr>
        <tr><td>HTTP/2</td><td>2015 (from Google's SPDY)</td><td>TCP + TLS</td><td>Binary frames, many streams on one connection</td></tr>
        <tr><td>HTTP/3</td><td>2022 (RFC 9114)</td><td>QUIC over UDP</td><td>Independent streams, built-in TLS 1.3, connection migration</td></tr>
      </tbody>
    </table>

    <h2>HTTP/1.0 and HTTP/1.1</h2>
    <h3>HTTP/1.0: one request, one connection</h3>
    <p>Each request opened a new TCP connection and closed it after the response. A page with 30 images paid 30 TCP handshakes, and each new connection started in TCP slow start, so it never got up to full speed. Painful on 1990s networks; unworkable today.</p>
    <h3>HTTP/1.1: keep-alive</h3>
    <ul>
      <li><strong>Persistent connections (keep-alive)</strong> are the default: after a response, the connection stays open for the next request. Handshakes are paid once.</li>
      <li><strong>Host header</strong> is required, so many websites can share one IP (virtual hosting).</li>
      <li><strong>Chunked transfer encoding</strong>: the server can stream a response without knowing its length up front.</li>
      <li><strong>Pipelining</strong>: in theory, the client can send several requests without waiting, but responses must come back <em>in the same order</em>. One slow response blocks all the ones behind it. Buggy proxies broke it, so every major browser shipped with it off. It is effectively dead.</li>
    </ul>
    <h3>Head-of-line blocking and 6 connections per host</h3>
    <p>Without pipelining, one HTTP/1.1 connection carries one request at a time. If <code>/big-report.json</code> takes 2 seconds, the small <code>/logo.png</code> queued behind it waits 2 seconds too. This is <strong>application-level head-of-line (HOL) blocking</strong>.</p>
    <p>Browsers work around it by opening <strong>up to 6 parallel TCP connections per host</strong>. That gives 6 requests in flight; the 7th waits. Web developers added more hacks: <strong>domain sharding</strong> (<code>img1.example.com</code>, <code>img2.example.com</code> to get 6 connections each), <strong>sprites</strong> (many icons in one image) and <strong>bundling</strong> all JS into one file. Each extra connection costs its own handshakes and slow start, and they compete with each other for bandwidth.</p>

    <h2>HTTP/2: one connection, many streams</h2>
    <p>HTTP/2 keeps the same methods, headers and status codes, but changes how they are put on the wire.</p>
    <ul>
      <li><strong>Binary framing</strong>: instead of text lines, everything is split into small binary <strong>frames</strong> (HEADERS, DATA, SETTINGS, WINDOW_UPDATE, RST_STREAM…), each with a 9-byte header. Faster and less error-prone to parse than text.</li>
      <li><strong>Streams</strong>: each request-response pair is a <strong>stream</strong> with an id. Client-started streams use odd ids (1, 3, 5…).</li>
      <li><strong>Multiplexing</strong>: frames from many streams are interleaved on <em>one</em> TCP connection. 100 requests can be in flight at once (servers usually allow 100 to 250 concurrent streams), and a slow response no longer blocks fast ones. Application-level HOL blocking is gone.</li>
      <li><strong>Stream priorities</strong>: the client can hint that CSS matters more than images. The original scheme was complex and poorly used; RFC 9218 replaced it with a simpler <code>priority</code> header.</li>
      <li><strong>HPACK header compression</strong>: headers like <code>cookie</code> and <code>user-agent</code> are often 500 to 1,000+ bytes and identical on every request. HPACK keeps a table of previously sent headers on both sides, so a repeated header is sent as a tiny index, plus Huffman coding for new values. Headers often shrink by 85 to 90%.</li>
      <li><strong>Server push (deprecated)</strong>: the server could send <code>style.css</code> before the browser asked for it. In practice it often pushed files the browser already had cached, wasting bandwidth. Chrome removed support in 2022. Use <code>103 Early Hints</code> or <code>&lt;link rel="preload"&gt;</code> instead.</li>
    </ul>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 260">
        <text class="s-title" x="20" y="26">HTTP/1.1: 6 connections, one request each at a time</text>
        <rect class="s-box" x="20" y="38" width="290" height="26" rx="10"/><text class="s-muted" x="165" y="56" text-anchor="middle">conn 1: [ big JSON ........ ] [ img ]</text>
        <rect class="s-box" x="20" y="70" width="290" height="26" rx="10"/><text class="s-muted" x="165" y="88" text-anchor="middle">conn 2: [ css ] [ js ] [ img ]</text>
        <rect class="s-box" x="20" y="102" width="290" height="26" rx="10"/><text class="s-muted" x="165" y="120" text-anchor="middle">conns 3 to 6 ... request 7 waits</text>
        <text class="s-title" x="340" y="26">HTTP/2: 1 connection, interleaved frames</text>
        <rect class="s-accent" x="340" y="38" width="44" height="26" rx="10"/><text class="s-text" x="362" y="56" text-anchor="middle">1</text>
        <rect class="s-green" x="390" y="38" width="44" height="26" rx="10"/><text class="s-text" x="412" y="56" text-anchor="middle">3</text>
        <rect class="s-amber" x="440" y="38" width="44" height="26" rx="10"/><text class="s-text" x="462" y="56" text-anchor="middle">5</text>
        <rect class="s-accent" x="490" y="38" width="44" height="26" rx="10"/><text class="s-text" x="512" y="56" text-anchor="middle">1</text>
        <rect class="s-green" x="540" y="38" width="44" height="26" rx="10"/><text class="s-text" x="562" y="56" text-anchor="middle">3</text>
        <text class="s-muted" x="462" y="88" text-anchor="middle">frames of streams 1, 3, 5 share one pipe</text>
        <text class="s-muted" x="462" y="108" text-anchor="middle">a slow stream no longer blocks the others</text>
        <text class="s-title" x="20" y="160">But one lost TCP packet still stalls every stream</text>
        <rect class="s-accent" x="20" y="176" width="70" height="34" rx="10"/><text class="s-text" x="55" y="198" text-anchor="middle">s1</text>
        <rect class="s-red" x="100" y="176" width="70" height="34" rx="10"/><text class="s-text" x="135" y="198" text-anchor="middle">s3 lost</text>
        <rect class="s-amber" x="180" y="176" width="70" height="34" rx="10"/><text class="s-text" x="215" y="198" text-anchor="middle">s5</text>
        <rect class="s-amber" x="260" y="176" width="70" height="34" rx="10"/><text class="s-text" x="295" y="198" text-anchor="middle">s1</text>
        <line class="s-line" x1="335" y1="193" x2="375" y2="193" marker-end="url(#arrow)"/>
        <rect class="s-box" x="380" y="176" width="240" height="34" rx="10"/><text class="s-muted" x="500" y="198" text-anchor="middle">TCP holds s5 and s1 until s3 is re-sent</text>
        <text class="s-muted" x="20" y="240">HTTP/3 (QUIC) only stalls stream 3; streams 1 and 5 keep flowing.</text>
      </svg>
      <figcaption>HTTP/1.1 spreads requests over 6 connections; HTTP/2 interleaves them on one; TCP loss still blocks all HTTP/2 streams.</figcaption>
    </figure>
    <h3>The catch: TCP-level head-of-line blocking</h3>
    <p>HTTP/2 fixed HOL blocking at the HTTP layer but not at the TCP layer. TCP only knows one ordered byte stream. If one packet carrying a frame of stream 3 is lost, the operating system holds back every later byte, including complete frames of streams 1 and 5, until the retransmit arrives. With 2% packet loss on a mobile network, one HTTP/2 connection can perform <em>worse</em> than HTTP/1.1's six connections, because a single loss now stalls everything. See <a href="#/p/tcp-udp">TCP vs UDP</a>.</p>

    <h2>HTTP/3 over QUIC</h2>
    <p><strong>QUIC</strong> is a transport protocol, started at Google in 2012 and standardised by the IETF in 2021 (RFC 9000). It runs on <strong>UDP</strong> and rebuilds what TCP does (reliability, ordering, congestion control) plus TLS 1.3, in user space. HTTP/3 is HTTP mapped onto QUIC.</p>
    <div data-diagram="quic" data-caption="QUIC folds the transport and TLS 1.3 handshakes into one round trip; a resumed connection can send the request in the first packet (0-RTT)."></div>
    <ul>
      <li><strong>Per-stream loss recovery</strong>: QUIC knows about streams. A lost packet only blocks the stream whose data it carried. Other streams keep being delivered. This removes TCP-level HOL blocking.</li>
      <li><strong>Faster setup</strong>: transport and crypto handshakes are combined: <strong>1 RTT</strong> for a new connection (TCP + TLS 1.3 takes 2). For a server the client has seen before, <strong>0-RTT</strong> lets the request ride in the very first packet. 0-RTT data can be replayed, so only idempotent requests should use it.</li>
      <li><strong>Always encrypted</strong>: TLS 1.3 is built in, and even most transport headers are encrypted, so middleboxes cannot meddle with them (they froze TCP's evolution for decades).</li>
      <li><strong>Connection migration</strong>: a TCP connection is tied to the 4-tuple (IPs and ports). When your phone moves from home Wi-Fi to Jio 4G, the IP changes and every TCP connection dies, so the app must reconnect and redo handshakes. QUIC identifies connections by a <strong>connection ID</strong>, so the same connection continues on the new network. Great for someone watching a stream in an auto-rickshaw.</li>
      <li><strong>QPACK</strong>: a version of HPACK that works when header frames arrive out of order.</li>
      <li><strong>User space</strong>: QUIC ships inside browsers and server libraries, so Google and Cloudflare can improve congestion control without waiting for OS kernels to update.</li>
    </ul>
    <p>Discovery: the browser first connects over TCP (HTTP/1.1 or 2) and the server advertises <code>Alt-Svc: h3=":443"</code>, or a DNS <code>HTTPS</code> record says HTTP/3 is available. Next time the browser tries QUIC on UDP 443 and falls back to TCP if UDP is blocked (some corporate networks do this).</p>
    <div class="callout warn"><strong>QUIC costs</strong>UDP processing in user space uses more CPU than kernel TCP (often 2 to 3 times per byte, improving with optimisations like GSO). Some networks block or throttle UDP. Load balancers must route by connection ID, not by 4-tuple, to support migration. That is why many internal services still use HTTP/2 over TCP.</div>

    <h2>Comparing the versions</h2>
    <table>
      <thead><tr><th>Feature</th><th>HTTP/1.1</th><th>HTTP/2</th><th>HTTP/3</th></tr></thead>
      <tbody>
        <tr><td>Transport</td><td>TCP</td><td>TCP</td><td>QUIC over UDP</td></tr>
        <tr><td>Format</td><td>Text</td><td>Binary frames</td><td>Binary frames</td></tr>
        <tr><td>Concurrency per connection</td><td>1 request at a time</td><td>Many streams, multiplexed</td><td>Many streams, independent</td></tr>
        <tr><td>Connections per origin</td><td>Up to 6</td><td>1</td><td>1</td></tr>
        <tr><td>HOL blocking</td><td>HTTP level and TCP level</td><td>TCP level only</td><td>None across streams</td></tr>
        <tr><td>Header compression</td><td>None</td><td>HPACK</td><td>QPACK</td></tr>
        <tr><td>Encryption</td><td>Optional (HTTPS)</td><td>Optional by spec; browsers require TLS</td><td>Always (TLS 1.3 built in)</td></tr>
        <tr><td>New connection setup (with TLS 1.3)</td><td>2 RTT</td><td>2 RTT</td><td>1 RTT (0-RTT on resume)</td></tr>
        <tr><td>Survives network change</td><td>No</td><td>No</td><td>Yes (connection IDs)</td></tr>
        <tr><td>Server push</td><td>No</td><td>Yes (deprecated)</td><td>In spec, rarely supported</td></tr>
      </tbody>
    </table>
    <p>Adoption: by 2025, HTTP/2 carried the majority of web requests and HTTP/3 was used on roughly a quarter to a third of them, mainly from Google, Meta, Cloudflare and other big CDNs. Inside data centres, <strong>gRPC</strong> runs on HTTP/2 (see <a href="#/p/api-styles">REST vs GraphQL vs gRPC</a>).</p>

    <h2>HTTPS and TLS basics</h2>
    <p><strong>HTTPS</strong> is HTTP sent inside a <strong>TLS</strong> tunnel. TLS provides encryption (nobody on the path can read it), integrity (nobody can change it) and authentication (the server proves its identity with a certificate signed by a trusted Certificate Authority). The handshake uses public-key crypto (ECDHE) to agree on a session key, then switches to fast symmetric encryption (AES-GCM, ChaCha20).</p>
    <ul>
      <li><strong>TLS 1.2</strong>: 2-RTT handshake. <strong>TLS 1.3</strong>: 1 RTT, fewer and safer ciphers, forward secrecy always on. Turn off TLS 1.0 and 1.1.</li>
      <li><strong>Certificates</strong>: free and automated with Let's Encrypt (90-day lifetime, renewed by a cron job or by your load balancer or CDN).</li>
      <li><strong>TLS termination</strong>: usually done at the load balancer or CDN, which then talks to backends over a private network or re-encrypts (mTLS in a service mesh). See <a href="#/p/proxies">Proxies</a>.</li>
      <li><strong>HSTS</strong>: a header that tells the browser "only ever use HTTPS for this domain".</li>
    </ul>
    <p>The full handshake with round-trip counts is walked through in <a href="#/p/url-to-page">What happens when you type a URL</a>.</p>

    <h2>Cheat sheet: status codes</h2>
    <table>
      <thead><tr><th>Code</th><th>Meaning</th><th>When you use it</th></tr></thead>
      <tbody>
        <tr><td>200 OK</td><td>Success with a body</td><td>Normal GET, or a POST that returns data</td></tr>
        <tr><td>201 Created</td><td>Resource created</td><td>POST /orders; include a <code>Location</code> header</td></tr>
        <tr><td>202 Accepted</td><td>Queued for later processing</td><td>Async jobs: video upload processing, bulk export</td></tr>
        <tr><td>204 No Content</td><td>Success, no body</td><td>DELETE, or PUT that returns nothing</td></tr>
        <tr><td>301 / 308</td><td>Moved permanently (308 keeps the method)</td><td>Old URL to new URL; browsers and search engines remember it</td></tr>
        <tr><td>302 / 307</td><td>Temporary redirect (307 keeps the method)</td><td>Login redirects; URL shortener redirects you want counted every time</td></tr>
        <tr><td>304 Not Modified</td><td>Your cached copy is still valid</td><td>Reply to a conditional GET with <code>If-None-Match</code></td></tr>
        <tr><td>400 Bad Request</td><td>Malformed or invalid input</td><td>Validation failures</td></tr>
        <tr><td>401 Unauthorized</td><td>Not authenticated</td><td>Missing or expired token</td></tr>
        <tr><td>403 Forbidden</td><td>Authenticated but not allowed</td><td>User tries to view another user's order</td></tr>
        <tr><td>404 Not Found</td><td>No such resource</td><td>Unknown id</td></tr>
        <tr><td>409 Conflict</td><td>State conflict</td><td>Duplicate username, version mismatch</td></tr>
        <tr><td>429 Too Many Requests</td><td>Rate limited</td><td>With <code>Retry-After</code>; see <a href="#/p/api-gateway-rate-limiting">rate limiting</a></td></tr>
        <tr><td>500 Internal Server Error</td><td>Bug or unhandled failure</td><td>Server-side exception</td></tr>
        <tr><td>502 Bad Gateway</td><td>Proxy got a bad response from upstream</td><td>Backend crashed or closed the connection</td></tr>
        <tr><td>503 Service Unavailable</td><td>Overloaded or in maintenance</td><td>Load shedding, often with <code>Retry-After</code></td></tr>
        <tr><td>504 Gateway Timeout</td><td>Upstream did not answer in time</td><td>Backend too slow for the proxy's timeout</td></tr>
      </tbody>
    </table>
    <div class="callout tip"><strong>Rule of thumb</strong>4xx = the client should change something before retrying. 5xx = the server failed; a retry (with backoff) might work. 429 and 503 are the "slow down" codes.</div>

    <h2>Cheat sheet: methods, safety and idempotency</h2>
    <p>A method is <strong>safe</strong> if it does not change server state. It is <strong>idempotent</strong> if doing it once or ten times leaves the server in the same state. Idempotency decides what clients, proxies and retry libraries may retry automatically after a timeout.</p>
    <table>
      <thead><tr><th>Method</th><th>Purpose</th><th>Safe</th><th>Idempotent</th><th>Cacheable</th></tr></thead>
      <tbody>
        <tr><td>GET</td><td>Read a resource</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
        <tr><td>HEAD</td><td>GET without the body</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
        <tr><td>OPTIONS</td><td>Ask what is allowed (CORS preflight)</td><td>Yes</td><td>Yes</td><td>No</td></tr>
        <tr><td>PUT</td><td>Replace the resource with this full version</td><td>No</td><td>Yes</td><td>No</td></tr>
        <tr><td>DELETE</td><td>Remove the resource</td><td>No</td><td>Yes</td><td>No</td></tr>
        <tr><td>POST</td><td>Create, or run an action</td><td>No</td><td><strong>No</strong></td><td>Rarely</td></tr>
        <tr><td>PATCH</td><td>Partial update</td><td>No</td><td><strong>Not guaranteed</strong></td><td>No</td></tr>
      </tbody>
    </table>
    <p>Why: <code>PUT /users/7 {name: "Asha"}</code> twice gives the same result. <code>DELETE /cart/items/3</code> twice: the item is gone either way (the second call may return 404, but the state is the same). <code>POST /payments</code> twice charges twice. <code>PATCH {"op": "increment", "field": "qty"}</code> twice adds 2.</p>
    <div class="callout warn"><strong>Making POST safe to retry</strong>Payment APIs like Razorpay and Stripe accept an <strong>idempotency key</strong>: the client generates a unique id per logical operation and sends it in a header. The server stores the key with the result and returns the stored result for any retry with the same key. Use this for any "create order" or "pay" endpoint.</div>

    <h2>Cheat sheet: caching headers</h2>
    <div data-diagram="etag" data-caption="Revalidation with ETag: if nothing changed, the server sends a tiny 304 and the browser reuses its copy."></div>
    <table>
      <thead><tr><th>Header</th><th>What it does</th><th>Example</th></tr></thead>
      <tbody>
        <tr><td><code>Cache-Control: max-age=N</code></td><td>Fresh for N seconds; no request at all until then</td><td><code>max-age=31536000, immutable</code> for <code>app.3f9a1c.js</code> (file name changes on every deploy)</td></tr>
        <tr><td><code>Cache-Control: s-maxage=N</code></td><td>Like max-age but only for shared caches (CDN, proxy)</td><td>CDN caches a product page 60 s, browser 0 s</td></tr>
        <tr><td><code>no-cache</code></td><td>May store, but must revalidate with the server before each use</td><td>HTML pages that change often</td></tr>
        <tr><td><code>no-store</code></td><td>Never store anywhere</td><td>Bank statements, OTP pages</td></tr>
        <tr><td><code>private</code> / <code>public</code></td><td>Only the browser may cache / any cache may</td><td><code>private</code> for a logged-in user's cart</td></tr>
        <tr><td><code>stale-while-revalidate=N</code></td><td>Serve stale for N s while refreshing in the background</td><td>Feeds and listings</td></tr>
        <tr><td><code>ETag</code> + <code>If-None-Match</code></td><td>Version tag of the content; client asks "changed since this tag?"</td><td>Reply 304 with no body if the tag matches</td></tr>
        <tr><td><code>Last-Modified</code> + <code>If-Modified-Since</code></td><td>Same idea using a timestamp (1-second resolution)</td><td>Static files</td></tr>
        <tr><td><code>Vary</code></td><td>Which request headers change the response</td><td><code>Vary: Accept-Encoding</code> so gzip and Brotli copies are cached separately</td></tr>
      </tbody>
    </table>
    <p>More on cache layers in <a href="#/p/caching">Caching</a> and <a href="#/p/cdn">CDNs</a>.</p>

    <h2>Real-world examples</h2>
    <ul>
      <li><strong>Google and YouTube</strong>: pioneered SPDY (which became HTTP/2) and QUIC. QUIC reduced YouTube rebuffering noticeably, most on slow and lossy networks such as those common in India.</li>
      <li><strong>Cloudflare and Akamai</strong>: enable HTTP/3 at the edge with a toggle, while still talking HTTP/1.1 or HTTP/2 to your origin servers.</li>
      <li><strong>Meta</strong>: serves most Facebook and Instagram app traffic over QUIC, which helps on flaky mobile networks.</li>
      <li><strong>gRPC microservices</strong>: Swiggy, Uber and Google use HTTP/2 inside the data centre, where packet loss is low and long-lived multiplexed connections save handshakes.</li>
    </ul>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"HTTP/1.1 allows one outstanding request per connection, so browsers open 6 connections per host and still hit head-of-line blocking."</li>
        <li>"HTTP/2 multiplexes streams over one TCP connection with binary frames and HPACK, but a single lost TCP packet stalls every stream."</li>
        <li>"HTTP/3 runs on QUIC over UDP: loss only affects one stream, setup is 1 RTT (0-RTT on resume) and connections survive Wi-Fi to 4G switches by connection ID."</li>
        <li>"Payment creation is a POST, which is not idempotent, so the client sends an idempotency key and retries are safe."</li>
        <li>"Static assets get content-hashed names and <code>max-age=31536000, immutable</code>; HTML gets <code>no-cache</code> with an ETag."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Saying HTTP/2 fully solves head-of-line blocking (only at the HTTP layer). Calling PATCH idempotent. Confusing <code>no-cache</code> (revalidate) with <code>no-store</code> (never store). Using 401 when you mean 403. Retrying POSTs blindly on timeout.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>What is head-of-line blocking in HTTP/1.1, and how did browsers work around it?</summary><div>One connection handles one request at a time, so a slow response delays every request queued behind it (pipelining had the same problem because responses had to be in order). Browsers open up to 6 connections per host; developers added domain sharding, sprites and bundling.</div></details>
      <details><summary>HTTP/2 multiplexes streams. Why can it still be slower than HTTP/1.1 on a lossy mobile network?</summary><div>All streams share one TCP connection, and TCP delivers bytes strictly in order. One lost packet blocks delivery of all later bytes from every stream until it is re-sent. With six HTTP/1.1 connections, a loss only stalls one of them, and the congestion window cut also affects only one.</div></details>
      <details><summary>Name three things QUIC gives HTTP/3 that TCP cannot.</summary><div>Per-stream loss recovery (no cross-stream HOL blocking); combined transport and TLS 1.3 handshake (1 RTT, 0-RTT on resume); connection migration via connection IDs when the client's IP changes. Also: encrypted transport headers and fast evolution in user space.</div></details>
      <details><summary>Which of GET, PUT, DELETE, POST and PATCH are idempotent, and why does it matter?</summary><div>GET, PUT and DELETE (plus HEAD and OPTIONS) are idempotent; POST is not and PATCH is not guaranteed. It decides whether a client or proxy can safely retry after a timeout. For non-idempotent operations, use idempotency keys.</div></details>
      <details><summary>What is the difference between <code>Cache-Control: no-cache</code> and <code>no-store</code>?</summary><div><code>no-cache</code> lets caches keep a copy but requires revalidation (for example with ETag, answered by 304) before each use. <code>no-store</code> forbids storing the response at all, for sensitive data.</div></details>
      <details><summary>Why was HTTP/2 server push removed from Chrome, and what replaced it?</summary><div>The server cannot know what the browser already has cached, so it often pushed files that were not needed, wasting bandwidth and competing with more important responses. Measured gains were small. <code>103 Early Hints</code> and <code>&lt;link rel="preload"&gt;</code> let the browser decide what to fetch.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>HTTP semantics (methods, headers, status codes) are stable; the wire format and transport changed.</li>
      <li>HTTP/1.1: keep-alive, one request at a time per connection, 6 connections per host, HOL blocking; pipelining is dead.</li>
      <li>HTTP/2: binary frames, multiplexed streams on one TCP connection, HPACK; server push is deprecated; TCP-level HOL blocking remains.</li>
      <li>HTTP/3: QUIC over UDP, per-stream loss recovery, TLS 1.3 built in, 1-RTT or 0-RTT setup, connection migration for mobile.</li>
      <li>Know the status codes, which methods are idempotent, and use idempotency keys for POST.</li>
      <li>Cache-Control, ETag and Vary control browser and CDN caching: long max-age for hashed static files, revalidation for HTML.</li>
    </ul></div>
  `,
  diagrams: {
    evolution: String.raw`flowchart LR
      S["HTTP semantics: methods, headers, status codes"] --> H1["HTTP/1.1: text"]
      S --> H2["HTTP/2: binary frames"]
      S --> H3["HTTP/3: frames on QUIC streams"]
      H1 --> T1["TLS (optional)"] --> TCP1["TCP"]
      H2 --> T2["TLS"] --> TCP2["TCP"]
      H3 --> Q["QUIC with TLS 1.3 inside"] --> U["UDP"]`,
    quic: String.raw`sequenceDiagram
      participant C as Client
      participant S as Server
      Note over C,S: TCP + TLS 1.3 = 2 RTT before the request
      C->>S: QUIC Initial (ClientHello, key share)
      S-->>C: Initial + Handshake (ServerHello, cert, Finished)
      C->>S: Finished + HTTP/3 GET
      S-->>C: HTTP/3 response
      Note over C,S: QUIC new connection = 1 RTT
      C->>S: Later visit: 0-RTT packet with GET (resumed keys)
      S-->>C: response in the first round trip`,
    etag: String.raw`sequenceDiagram
      participant B as Browser
      participant S as Server or CDN
      B->>S: GET /products/42
      S-->>B: 200 OK, ETag "v7", Cache-Control no-cache
      Note over B: stores body with tag v7
      B->>S: GET /products/42, If-None-Match "v7"
      alt unchanged
        S-->>B: 304 Not Modified (no body)
      else changed
        S-->>B: 200 OK, ETag "v8", new body
      end`,
  },
});
