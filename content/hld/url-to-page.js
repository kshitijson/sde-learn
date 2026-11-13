SD.register({
  id: "url-to-page",
  html: String.raw`
    <p class="lead">You type <code>flipkart.com</code> and press Enter. About a second later a page appears. In between, your browser checks its caches, asks DNS for an IP address, opens a TCP connection, sets up encryption with TLS, sends an HTTP request that passes through a CDN and load balancer to an application server, and then turns the HTML that comes back into pixels. It is the most common warm-up question in interviews because it touches every layer of the web. Answer it as a story with numbers: each step costs round trips, and a good design removes as many as possible.</p>

    <h2>The whole journey at a glance</h2>
    <div data-diagram="overview" data-caption="The path of one page load. Each arrow can cost one or more network round trips."></div>
    <ol class="steps">
      <li><strong>Parse the URL</strong> and check browser caches (HSTS list, DNS cache, HTTP cache, open connections).</li>
      <li><strong>DNS</strong>: turn the hostname into an IP address.</li>
      <li><strong>TCP</strong>: 3-way handshake with that IP on port 443.</li>
      <li><strong>TLS</strong>: agree on keys and verify the server's certificate.</li>
      <li><strong>HTTP</strong>: send the request, receive the response.</li>
      <li><strong>Server side</strong>: CDN edge, load balancer, app server, caches, database.</li>
      <li><strong>Render</strong>: parse HTML, fetch CSS/JS/images, lay out and paint.</li>
    </ol>
    <div class="callout info"><strong>One number to remember</strong>RTT (round-trip time) is the time for a packet to reach the server and a reply to come back. On Indian 4G it is often 50 to 100 ms to a nearby data centre, and 200+ ms to a server in the US. Setup steps are measured in RTTs, so the same page can take 300 ms or 1.5 s depending on distance alone.</div>

    <h2>Step 1: Parse the URL and check the browser</h2>
    <p>The browser first decides whether you typed a URL or a search query. <code>flipkart.com</code> becomes <code>https://flipkart.com/</code>: scheme <code>https</code>, host <code>flipkart.com</code>, default port 443, path <code>/</code>.</p>
    <ul>
      <li><strong>HSTS</strong> (HTTP Strict Transport Security): if the site is on the browser's built-in preload list, or sent a <code>Strict-Transport-Security</code> header before, the browser goes straight to HTTPS and never sends a plain HTTP request that could be intercepted.</li>
      <li><strong>HTTP cache</strong>: if a fresh copy of the resource is cached (<code>Cache-Control: max-age</code> not expired), there is no network request at all. For a page's HTML this is rare; for its CSS, JS and images it is common.</li>
      <li><strong>Service worker</strong>: a site's offline script can answer the request itself.</li>
      <li><strong>Connection reuse</strong>: if the browser already has an open connection to this host, it skips DNS, TCP and TLS entirely. This is the biggest win of all.</li>
    </ul>

    <h2>Step 2: DNS resolution</h2>
    <p>Computers route by IP address, not by name. <strong>DNS</strong> (the Domain Name System) is a distributed, hierarchical, heavily cached directory that maps names to addresses.</p>
    <h3>Cache layers first</h3>
    <p>The lookup stops at the first cache that has a fresh answer: the browser's DNS cache, then the operating system cache (and the <code>/etc/hosts</code> file), then the home router, then the <strong>recursive resolver</strong>. Most lookups end here and take 0 to 20 ms.</p>
    <h3>The full lookup</h3>
    <p>On a complete miss, the recursive resolver (your ISP's, like Jio's, or a public one like Google <code>8.8.8.8</code> or Cloudflare <code>1.1.1.1</code>) does the walking for you:</p>
    <div data-diagram="dns" data-caption="DNS resolution on a full cache miss. The stub resolver asks once; the recursive resolver walks root, TLD and authoritative servers."></div>
    <table>
      <thead><tr><th>Server</th><th>Knows</th><th>Answers with</th></tr></thead>
      <tbody>
        <tr><td>Root servers (13 named a to m, well over 1,500 instances worldwide via anycast)</td><td>Who runs each top-level domain</td><td>"Ask the .com servers at these IPs"</td></tr>
        <tr><td>TLD servers (.com run by Verisign, .in by NIXI)</td><td>Which name servers own each domain</td><td>"flipkart.com is served by these name servers"</td></tr>
        <tr><td>Authoritative name servers (Route 53, Cloudflare DNS, NS1)</td><td>The actual records for the domain</td><td>"flipkart.com A 203.0.113.10, TTL 60" (example IP)</td></tr>
      </tbody>
    </table>
    <p>The browser's own query to the resolver is <strong>recursive</strong> ("give me the final answer"). The resolver's queries to root, TLD and authoritative servers are <strong>iterative</strong> ("tell me who to ask next"). Root and TLD answers are cached for a day or two, so in practice the resolver usually only needs the last step.</p>
    <h3>Records and TTL</h3>
    <table>
      <thead><tr><th>Record</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><code>A</code> / <code>AAAA</code></td><td>Name to IPv4 / IPv6 address</td></tr>
        <tr><td><code>CNAME</code></td><td>Alias to another name (<code>www.example.com</code> to <code>example.cdn.cloudflare.net</code>)</td></tr>
        <tr><td><code>NS</code></td><td>Which servers are authoritative for a zone</td></tr>
        <tr><td><code>MX</code> / <code>TXT</code></td><td>Mail servers / free text (domain verification, SPF)</td></tr>
      </tbody>
    </table>
    <p>Every record has a <strong>TTL</strong> (time to live) in seconds: how long caches may keep it. A long TTL (1 day) means fewer lookups but slow changes; a short TTL (30 to 60 s) lets you fail over quickly but sends more queries. Before a planned migration, teams lower the TTL a day ahead so the switch spreads fast. Some resolvers ignore very low TTLs, so DNS changes are never perfectly instant.</p>
    <h3>DNS as a load balancer</h3>
    <ul>
      <li><strong>Round-robin DNS</strong>: return several A records and rotate their order, so clients spread across servers. Crude: no health awareness, and caches pin users to one IP until the TTL ends.</li>
      <li><strong>GeoDNS / latency-based routing</strong>: the authoritative server looks at where the query came from and returns the IP of the nearest region. A user in Chennai gets the Mumbai data centre; one in Frankfurt gets eu-central. Route 53 latency routing and CDNs do this.</li>
      <li><strong>Health-checked failover</strong>: if a region fails its health checks, DNS stops returning its IP. Recovery is bounded by the TTL.</li>
      <li><strong>Anycast</strong> (related, not DNS): the same IP is announced from many locations and the internet routes you to the closest. Cloudflare's <code>1.1.1.1</code> and root servers use it.</li>
    </ul>
    <p>More on this in <a href="#/p/load-balancers">Load balancers</a>.</p>
    <div class="callout tip"><strong>DNS is usually UDP</strong>A DNS query is one small UDP datagram to port 53, with a retry on timeout. No handshake, so it is fast. Large answers fall back to TCP. Modern browsers can also use DNS over HTTPS (DoH) for privacy. See <a href="#/p/tcp-udp">TCP vs UDP</a>.</div>

    <h2>Step 3: TCP handshake</h2>
    <p>With the IP in hand, the browser opens a TCP connection to port 443: SYN, SYN-ACK, ACK. That is <strong>1 RTT</strong> before anything useful is sent. TCP gives a reliable, ordered byte stream; the details (sequence numbers, slow start, teardown) are on the <a href="#/p/tcp-udp">TCP vs UDP</a> page.</p>

    <h2>Step 4: TLS handshake</h2>
    <p><strong>TLS</strong> (Transport Layer Security, the "S" in HTTPS) gives three things: <strong>encryption</strong> (nobody on the café Wi-Fi can read your UPI PIN), <strong>integrity</strong> (nobody can change bytes in flight) and <strong>authentication</strong> (you are really talking to flipkart.com, not an impostor).</p>
    <h3>Certificates</h3>
    <p>The server sends a <strong>certificate</strong>: its public key plus its domain name, signed by a <strong>Certificate Authority</strong> (CA) like Let's Encrypt, DigiCert or Sectigo. The browser checks the chain of signatures up to a root CA it already trusts (built into the OS or browser), checks the name matches and the certificate has not expired. Then the two sides use a key exchange (ECDHE, elliptic-curve Diffie-Hellman) to agree on a shared secret that was never sent over the wire. All further data is encrypted with fast symmetric ciphers like AES-GCM or ChaCha20.</p>
    <h3>SNI</h3>
    <p>One IP address often hosts thousands of sites (a CDN edge, a shared load balancer). <strong>SNI</strong> (Server Name Indication) puts the hostname in the very first TLS message, so the server knows which certificate to present. SNI is sent in plain text, so a network observer can see which site you visit (but not the path or content). Encrypted Client Hello (ECH) is the newer fix.</p>
    <h3>TLS 1.2 vs TLS 1.3</h3>
    <div data-diagram="tls" data-caption="TLS 1.3 needs one round trip after TCP; TLS 1.2 needs two. Resumed TLS 1.3 sessions can even send data immediately (0-RTT)."></div>
    <table>
      <thead><tr><th></th><th>TLS 1.2 (2008)</th><th>TLS 1.3 (2018)</th></tr></thead>
      <tbody>
        <tr><td>Full handshake</td><td>2 RTT</td><td>1 RTT (client sends key share in the first message)</td></tr>
        <tr><td>Resumed session</td><td>1 RTT</td><td>0-RTT possible (early data)</td></tr>
        <tr><td>Ciphers</td><td>Many, some weak (RSA key exchange, CBC)</td><td>Only 5 modern suites; forward secrecy always on</td></tr>
        <tr><td>Certificate</td><td>Sent in plain text</td><td>Encrypted</td></tr>
      </tbody>
    </table>
    <div class="callout warn"><strong>0-RTT has a catch</strong>0-RTT early data can be <em>replayed</em> by an attacker who captures it. Servers should only accept it for safe, idempotent requests like a <code>GET</code> of a product page, never for "place order" or "pay".</div>

    <h3>Count the round trips</h3>
    <p>Pick an RTT and a protocol below and see how the setup cost adds up before the first byte of HTML arrives. Try 150 ms (a user in Delhi hitting a US server) with TLS 1.2, then switch to TLS 1.3, then to QUIC.</p>
    <div data-widget="handshake"></div>
    <table>
      <thead><tr><th>Setup (new connection)</th><th>DNS</th><th>TCP</th><th>TLS</th><th>HTTP request</th><th>Total RTTs</th><th>At 100 ms RTT</th></tr></thead>
      <tbody>
        <tr><td>HTTP/1.1 or 2 + TLS 1.2</td><td>1</td><td>1</td><td>2</td><td>1</td><td>5</td><td>~500 ms</td></tr>
        <tr><td>HTTP/1.1 or 2 + TLS 1.3</td><td>1</td><td>1</td><td>1</td><td>1</td><td>4</td><td>~400 ms</td></tr>
        <tr><td>HTTP/3 (QUIC, new)</td><td>1</td><td colspan="2">1 (combined)</td><td>1</td><td>3</td><td>~300 ms</td></tr>
        <tr><td>HTTP/3 (QUIC, 0-RTT resume)</td><td>0 to 1</td><td colspan="2">0</td><td>1</td><td>1 to 2</td><td>~100 to 200 ms</td></tr>
        <tr><td>Reused keep-alive connection</td><td>0</td><td>0</td><td>0</td><td>1</td><td>1</td><td>~100 ms</td></tr>
      </tbody>
    </table>
    <p>The DNS cost assumes the resolver is about one RTT away and has the answer cached; it can be zero (browser cache) or several RTTs (full miss). Server processing time is extra.</p>

    <h2>Step 5: The HTTP request and response</h2>
    <div data-diagram="http" data-caption="The request goes out on the encrypted connection, the response comes back, and the connection stays open for the next request."></div>
    <p>The request is text in HTTP/1.1 and binary frames in HTTP/2 and HTTP/3, but the content is the same:</p>
    <ul>
      <li><strong>Request line</strong>: method and path, <code>GET / HTTP/1.1</code> (HTTP/2 and 3 use <code>:method</code> and <code>:path</code> pseudo-headers).</li>
      <li><strong>Headers</strong>: <code>Host: flipkart.com</code> (which site, required in HTTP/1.1), <code>User-Agent</code>, <code>Accept-Encoding: gzip, br</code> (I can take compressed bodies), <code>Accept-Language</code>, <code>Cookie</code>.</li>
      <li><strong>Cookies</strong>: small key-value pairs the server set earlier with <code>Set-Cookie</code>, sent back on every request to that domain. They carry the session id that keeps you logged in and your cart. Flags: <code>HttpOnly</code> (JavaScript cannot read it, limits XSS damage), <code>Secure</code> (HTTPS only), <code>SameSite</code> (limits cross-site sending, protects against CSRF).</li>
    </ul>
    <p>The response has a <strong>status code</strong> (200 OK, 301 redirect, 304 not modified, 404, 500), headers such as <code>Content-Type: text/html</code>, <code>Content-Encoding: br</code>, <code>Cache-Control</code> and <code>Set-Cookie</code>, and the body.</p>
    <p><strong>Keep-alive</strong>: HTTP/1.1 keeps the TCP+TLS connection open by default, so the next 50 requests for CSS, JS and images skip the handshakes. HTTP/2 goes further and sends them all in parallel over one connection. Details in <a href="#/p/http-versions">HTTP/1.1 vs HTTP/2 vs HTTP/3</a>.</p>

    <h2>Step 6: Inside the data centre</h2>
    <p>The IP your browser connected to is rarely an application server. Usually it is a CDN edge or a load balancer:</p>
    <div data-diagram="server" data-caption="A typical server-side path. Static files often never leave the CDN; dynamic requests travel all the way to the app tier."></div>
    <ol class="steps">
      <li><strong>CDN edge</strong> (Akamai, Cloudflare, CloudFront): a server in a nearby city terminates TCP and TLS close to you, which makes handshakes cheap. Images, JS and CSS are served straight from its cache. See <a href="#/p/cdn">CDNs</a> and <a href="#/p/caching">Caching</a>.</li>
      <li><strong>Load balancer / reverse proxy</strong> (AWS ALB, Nginx, Envoy): picks a healthy app server, often terminates TLS, adds headers like <code>X-Forwarded-For</code>. See <a href="#/p/load-balancers">Load balancers</a> and <a href="#/p/proxies">Proxies</a>.</li>
      <li><strong>API gateway</strong>: authentication, rate limiting, routing to the right microservice. See <a href="#/p/api-gateway-rate-limiting">API gateway</a>.</li>
      <li><strong>Application server</strong>: runs your code; reads the session from Redis, queries caches and databases, calls other services, renders HTML or JSON.</li>
      <li>The response travels back the same way, and may be cached at the CDN for the next user.</li>
    </ol>

    <h2>Step 7: Rendering the page</h2>
    <p>Bytes are not a page yet. The browser builds it in stages, called the <strong>critical rendering path</strong>:</p>
    <ol class="steps">
      <li><strong>Parse HTML into the DOM</strong> (the tree of elements), streaming as bytes arrive.</li>
      <li><strong>Fetch subresources</strong>: as it sees <code>&lt;link rel="stylesheet"&gt;</code>, <code>&lt;script&gt;</code> and <code>&lt;img&gt;</code>, it requests them (a preload scanner looks ahead to start these early).</li>
      <li><strong>Build the CSSOM</strong> from CSS. CSS is <em>render-blocking</em>: nothing is painted until it is loaded, otherwise the page would flash unstyled.</li>
      <li><strong>Run JavaScript</strong>. A plain <code>&lt;script&gt;</code> is <em>parser-blocking</em>: HTML parsing stops while it downloads and runs. <code>defer</code> and <code>async</code> avoid this.</li>
      <li><strong>Layout</strong>: compute the size and position of every element.</li>
      <li><strong>Paint and composite</strong>: draw pixels, often on the GPU.</li>
    </ol>
    <p>Metrics that product teams track: <strong>TTFB</strong> (time to first byte: network setup plus server time), <strong>FCP</strong> (first contentful paint), <strong>LCP</strong> (largest contentful paint, Google wants under 2.5 s) and <strong>INP</strong> (how quickly the page reacts to taps).</p>
    <div class="callout tip"><strong>How real sites make it fast</strong>Fewer round trips (TLS 1.3, HTTP/2 or 3, keep-alive, CDN edges near users), <code>dns-prefetch</code> and <code>preconnect</code> hints for third-party domains, smaller bytes (Brotli compression, WebP/AVIF images), inline critical CSS, <code>defer</code> scripts, server-side rendering for the first view, and long cache lifetimes for fingerprinted static files (<code>app.3f9a1c.js</code> with <code>max-age=31536000, immutable</code>).</div>

    <h2>Real-world examples</h2>
    <ul>
      <li><strong>Flipkart Big Billion Days</strong>: most static content is served from CDN edges inside India, so the TCP and TLS handshakes complete in a few milliseconds instead of crossing to a far data centre.</li>
      <li><strong>Google</strong>: serves search and YouTube over HTTP/3 (QUIC) with 0-RTT resumption, cutting setup for returning users to almost nothing.</li>
      <li><strong>Live sports streaming (Hotstar during IPL)</strong>: large streaming platforms use several CDNs at once with short DNS TTLs, so traffic can be shifted away from a provider that degrades within minutes.</li>
      <li><strong>Mobile apps</strong>: the same steps happen inside Swiggy or Zomato apps, minus rendering; they keep a warm connection pool to the API domain and often prefetch DNS at launch.</li>
    </ul>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"The browser checks its caches, then resolves DNS through the recursive resolver, which walks root, TLD and authoritative servers if nothing is cached. TTLs control how long each answer lives."</li>
        <li>"Then a TCP handshake (1 RTT) and a TLS handshake (1 RTT in TLS 1.3, 2 in TLS 1.2) where the server proves its identity with a CA-signed certificate. SNI tells a shared server which certificate to use."</li>
        <li>"The HTTP request goes to the nearest CDN edge picked by GeoDNS or anycast; misses go to a load balancer, then the app servers, caches and databases."</li>
        <li>"Setup costs about 4 round trips on a new connection, so we cut them with CDNs near users, keep-alive, HTTP/2 or 3, and TLS 1.3."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Saying DNS always goes to the root servers (it is almost always cached). Mixing up recursive and iterative queries. Forgetting TLS or saying it is encrypted with the certificate's key (the certificate authenticates; ECDHE creates the session keys). Skipping the load balancer and CDN. Not mentioning connection reuse.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>What is the difference between a recursive resolver and an authoritative name server?</summary><div>The recursive resolver (your ISP's, 8.8.8.8, 1.1.1.1) finds answers on your behalf by asking other servers and caching what it learns. The authoritative name server holds the actual records for a domain (Route 53 for your zone) and is the final source of truth. Root and TLD servers sit in between and only point to the next server.</div></details>
      <details><summary>You need to move your site to a new IP with minimal disruption. What do you do with DNS?</summary><div>Lower the record's TTL (for example from 1 day to 60 s) at least one old-TTL period before the move, so caches pick up the short TTL. Then change the record; most clients switch within a minute. Keep the old server running for a while for resolvers that ignore TTLs. Raise the TTL again afterwards.</div></details>
      <details><summary>How many round trips before the first byte of HTML on a brand-new HTTPS connection with TLS 1.3, and how does HTTP/3 improve it?</summary><div>About 4 RTTs: DNS (1, if the resolver has it cached), TCP (1), TLS 1.3 (1) and the HTTP request (1). With TLS 1.2 it is 5. HTTP/3 merges the transport and TLS handshakes into one QUIC handshake (3 RTTs total), and with 0-RTT resumption a returning client can send the request in its very first packet.</div></details>
      <details><summary>What is SNI and why is it needed?</summary><div>Server Name Indication: the client puts the hostname in its TLS ClientHello. A single IP (a CDN edge or shared load balancer) can host thousands of domains, and the server must choose the right certificate before encryption starts. Without SNI, each HTTPS site would need its own IP.</div></details>
      <details><summary>Why is CSS render-blocking, and what does <code>defer</code> do for scripts?</summary><div>The browser will not paint until it has the CSS, because painting first would show unstyled content and then jump. A normal script blocks HTML parsing while it downloads and runs; <code>defer</code> downloads it in parallel and runs it after parsing finishes, in order, so the page can render sooner.</div></details>
      <details><summary>How does GeoDNS send an Indian user to the Mumbai region?</summary><div>The authoritative DNS server sees the query's source (the resolver's IP, or the client subnet via the EDNS Client Subnet option), maps it to a location, and returns the IP of the nearest or lowest-latency healthy region. The answer is cached for its TTL, so failover speed depends on the TTL.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>The journey: browser caches, DNS, TCP, TLS, HTTP, CDN, load balancer, app server, then the critical rendering path.</li>
      <li>DNS is a cached hierarchy: stub, recursive resolver, root, TLD, authoritative. TTL trades freshness for fewer lookups. GeoDNS and health checks make DNS a coarse load balancer.</li>
      <li>TCP costs 1 RTT; TLS 1.2 costs 2 more, TLS 1.3 costs 1, QUIC combines both into 1, and 0-RTT resumption can remove setup entirely (for idempotent requests only).</li>
      <li>Certificates prove identity via a CA chain; ECDHE makes the session keys; SNI picks the certificate on shared IPs.</li>
      <li>Keep-alive and connection reuse are the biggest wins: a reused connection costs just 1 RTT per request.</li>
      <li>CDN edges near users shrink every RTT; render-blocking CSS and parser-blocking JS decide how fast pixels appear.</li>
    </ul></div>
  `,
  diagrams: {
    overview: String.raw`flowchart LR
      U["Browser"] -->|"1. cache check"| BC["Browser caches"]
      U -->|"2. hostname"| DNS["DNS resolver"]
      DNS -->|"IP"| U
      U -->|"3. TCP + 4. TLS"| EDGE["CDN edge / LB"]
      U -->|"5. HTTP request"| EDGE
      EDGE --> APP["App servers"]
      APP --> DATA[("Cache + DB")]
      EDGE -->|"HTML, CSS, JS"| U
      U -->|"7. render"| PX["Pixels"]`,
    dns: String.raw`sequenceDiagram
      participant B as Browser / OS
      participant R as Recursive resolver
      participant Root as Root server
      participant T as .com TLD server
      participant A as Authoritative NS
      B->>R: flipkart.com A? (recursive)
      Note over R: cache miss
      R->>Root: flipkart.com? (iterative)
      Root-->>R: ask .com servers
      R->>T: flipkart.com?
      T-->>R: ask the domain name servers
      R->>A: flipkart.com?
      A-->>R: 203.0.113.10, TTL 60
      Note over R: cache for 60 s
      R-->>B: 203.0.113.10`,
    tls: String.raw`sequenceDiagram
      participant C as Client
      participant S as Server
      Note over C,S: TCP handshake done (1 RTT)
      C->>S: ClientHello (SNI, ciphers, key share)
      S-->>C: ServerHello, key share, certificate, Finished
      Note over C: verify cert chain, derive keys
      C->>S: Finished + HTTP GET (encrypted)
      S-->>C: HTTP 200 response
      Note over C,S: TLS 1.3: 1 RTT. TLS 1.2 needs an extra round trip for the key exchange.`,
    http: String.raw`sequenceDiagram
      participant B as Browser
      participant E as CDN edge
      participant O as Origin (LB + app)
      B->>E: GET / (Host, Cookie, Accept-Encoding)
      alt cached at edge
        E-->>B: 200 OK (from edge cache)
      else miss or dynamic
        E->>O: GET / (reused connection)
        O-->>E: 200 OK, Set-Cookie, Cache-Control
        E-->>B: 200 OK (Brotli compressed HTML)
      end
      B->>E: GET /app.js, /style.css (same connection)
      E-->>B: 200 OK (cached, max-age 1 year)`,
    server: String.raw`flowchart LR
      B["Browser"] --> CDN["CDN edge (TLS ends here)"]
      CDN -->|"static: cache hit"| B
      CDN -->|"dynamic or miss"| LB["Load balancer"]
      LB --> GW["API gateway"]
      GW --> A1["App server 1"]
      GW --> A2["App server 2"]
      A1 --> R[("Redis")]
      A1 --> DB[("Database")]
      A2 --> R
      A2 --> DB`,
  },
});
