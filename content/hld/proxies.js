SD.register({
  id: "proxies",
  html: String.raw`
    <p class="lead">A proxy is a server that sits in the middle of a conversation and forwards requests on someone's behalf. The only question that matters is <em>whose</em> behalf. A <strong>forward proxy</strong> acts for clients: it hides who is asking and controls where they can go (office proxies, VPN-like setups). A <strong>reverse proxy</strong> acts for servers: it hides what is behind it and does the heavy lifting at the front door (TLS, caching, compression, load balancing, filtering attacks). Almost every system you draw in an interview has a reverse proxy in it, usually Nginx, Envoy, HAProxy or a cloud load balancer, even if you call it something else.</p>

    <h2>What a proxy is</h2>
    <p>Without a proxy, a client opens a connection straight to the server. With a proxy, the client talks to the proxy, and the proxy opens its own connection to the server and relays the request and response. The proxy can read, change, block, cache or log what passes through (for HTTPS, only if it terminates TLS).</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 300">
        <text class="s-title" x="320" y="24" text-anchor="middle">Forward proxy: acts for the clients</text>
        <rect class="s-box" x="20" y="40" width="250" height="100" rx="10"/>
        <text class="s-muted" x="145" y="58" text-anchor="middle">Office network (clients known)</text>
        <rect class="s-box" x="36" y="70" width="70" height="34" rx="10"/><text class="s-text" x="71" y="92" text-anchor="middle">Laptop</text>
        <rect class="s-box" x="36" y="108" width="70" height="26" rx="10"/><text class="s-text" x="71" y="126" text-anchor="middle">Phone</text>
        <rect class="s-accent" x="150" y="80" width="100" height="44" rx="10"/><text class="s-text" x="200" y="107" text-anchor="middle">Fwd proxy</text>
        <line class="s-line" x1="106" y1="88" x2="148" y2="98" marker-end="url(#arrow)"/>
        <line class="s-line" x1="106" y1="121" x2="148" y2="110" marker-end="url(#arrow)"/>
        <rect class="s-box" x="400" y="62" width="220" height="74" rx="10"/>
        <text class="s-text" x="510" y="92" text-anchor="middle">Internet sites</text>
        <text class="s-muted" x="510" y="116" text-anchor="middle">see only the proxy's IP</text>
        <line class="s-line" x1="250" y1="102" x2="398" y2="100" marker-end="url(#arrow)"/>
        <text class="s-muted" x="325" y="92" text-anchor="middle">filter, log</text>
        <line class="s-dash" x1="20" y1="160" x2="620" y2="160"/>
        <text class="s-title" x="320" y="186" text-anchor="middle">Reverse proxy: acts for the servers</text>
        <rect class="s-box" x="20" y="214" width="150" height="64" rx="10"/>
        <text class="s-text" x="95" y="242" text-anchor="middle">Any client</text>
        <text class="s-muted" x="95" y="264" text-anchor="middle">sees only the proxy</text>
        <rect class="s-accent" x="230" y="222" width="110" height="48" rx="10"/><text class="s-text" x="285" y="251" text-anchor="middle">Rev proxy</text>
        <line class="s-line" x1="170" y1="246" x2="228" y2="246" marker-end="url(#arrow)"/>
        <rect class="s-box" x="390" y="196" width="230" height="96" rx="10"/>
        <text class="s-muted" x="505" y="214" text-anchor="middle">Private network (servers known)</text>
        <rect class="s-green" x="406" y="226" width="60" height="28" rx="10"/><text class="s-text" x="436" y="245" text-anchor="middle">App 1</text>
        <rect class="s-green" x="476" y="226" width="60" height="28" rx="10"/><text class="s-text" x="506" y="245" text-anchor="middle">App 2</text>
        <rect class="s-green" x="546" y="226" width="60" height="28" rx="10"/><text class="s-text" x="576" y="245" text-anchor="middle">App 3</text>
        <text class="s-muted" x="505" y="278" text-anchor="middle">TLS, cache, LB, WAF in front</text>
        <line class="s-line" x1="340" y1="246" x2="388" y2="246" marker-end="url(#arrow)"/>
      </svg>
      <figcaption>The same kind of box, two different jobs. A forward proxy hides and controls clients; a reverse proxy hides and protects servers.</figcaption>
    </figure>

    <h2>Forward proxy vs reverse proxy</h2>
    <table>
      <thead><tr><th></th><th>Forward proxy</th><th>Reverse proxy</th></tr></thead>
      <tbody>
        <tr><td>Acts for</td><td>Clients</td><td>Servers</td></tr>
        <tr><td>Who configures it</td><td>The client side (browser setting, OS, company IT)</td><td>The service owner (DNS points to it)</td></tr>
        <tr><td>Does the client know?</td><td>Yes, usually it is configured explicitly</td><td>No, it looks like the real server</td></tr>
        <tr><td>Hides</td><td>The client's identity and IP from websites</td><td>The servers' number, IPs and layout from clients</td></tr>
        <tr><td>Typical jobs</td><td>Content filtering, egress control, audit logs, shared caching, bypassing geo-restrictions</td><td>TLS termination, load balancing, caching, compression, WAF, rate limiting, routing</td></tr>
        <tr><td>Examples</td><td>Squid, Zscaler, corporate web gateways, egress proxies in a VPC</td><td>Nginx, HAProxy, Envoy, Traefik, AWS ALB, Cloudflare</td></tr>
      </tbody>
    </table>
    <div class="callout tip"><strong>A quick way to tell</strong>Ask "who would be upset if the proxy disappeared?" If it is the office IT team that loses control over employees' browsing, it is a forward proxy. If it is the website team whose servers are now exposed to the internet, it is a reverse proxy.</div>

    <h2>Forward proxies</h2>
    <p>A forward proxy sits at the edge of a client network. All outbound requests go through it.</p>
    <ul>
      <li><strong>Corporate proxies</strong>: an Infosys or TCS office routes all web traffic through a gateway (Zscaler, Blue Coat, Squid) that blocks malware and banned sites, logs access for compliance and scans downloads. To inspect HTTPS it must do "TLS interception": the company installs its own root certificate on every laptop so the proxy can decrypt and re-encrypt. This is why some apps with certificate pinning break on office Wi-Fi.</li>
      <li><strong>Egress proxies in the cloud</strong>: backend servers in a private subnet reach third-party APIs (a payment gateway, an SMS provider) only through an egress proxy with an allow-list. If a server is hacked, it cannot send data anywhere it likes. Razorpay-style fintechs often need this for audits.</li>
      <li><strong>Privacy and geo-access</strong>: the website sees the proxy's IP, not yours. Scrapers rotate through pools of proxies to avoid rate limits.</li>
      <li><strong>Shared cache</strong>: once common for saving bandwidth on slow links; much less useful now that almost everything is HTTPS.</li>
    </ul>
    <p>For HTTPS, a forward proxy usually does not decrypt. The browser sends <code>CONNECT example.com:443</code>, the proxy opens a TCP tunnel, and TLS runs end to end through it. The proxy sees only the hostname, not the content.</p>
    <h3>Proxy vs VPN</h3>
    <p>A <strong>VPN</strong> (virtual private network) is similar in spirit but works at the network layer: it tunnels <em>all</em> traffic from the device (every app, every protocol) inside an encrypted tunnel to the VPN server, and gives the device an address on the remote network. A proxy usually handles only the traffic of apps configured to use it (often just HTTP). Companies use a VPN to let remote employees reach internal systems as if they were in the office; "zero trust" access proxies (Google BeyondCorp, Cloudflare Access) are replacing VPNs by checking identity per request instead of trusting the whole network.</p>

    <h2>Reverse proxies: what they do</h2>
    <p>A reverse proxy is the front door of your service. Clients resolve <code>api.example.com</code> to the proxy, and the proxy forwards each request to one of many backend servers.</p>
    <div data-diagram="reverse" data-caption="A reverse proxy in front of a service: one public entry point that does shared work before requests reach the app."></div>
    <table>
      <thead><tr><th>Job</th><th>What it means</th><th>Why do it at the proxy</th></tr></thead>
      <tbody>
        <tr><td>TLS termination</td><td>The proxy holds the certificate, decrypts HTTPS and forwards plain HTTP (or re-encrypted traffic) to backends</td><td>One place to manage certificates; app servers save CPU on crypto; the proxy can read and route on HTTP headers</td></tr>
        <tr><td>Load balancing</td><td>Spread requests across healthy backends (round robin, least connections, consistent hashing)</td><td>Horizontal scaling and failover; see <a href="#/p/load-balancers">Load balancers</a></td></tr>
        <tr><td>Caching</td><td>Store full responses and serve repeats without touching the app</td><td>Cuts latency and backend load; see <a href="#/p/caching">Caching</a></td></tr>
        <tr><td>Compression</td><td>gzip or Brotli on the way out</td><td>Text shrinks 70 to 90%; apps do not each need to implement it</td></tr>
        <tr><td>WAF (web application firewall)</td><td>Block SQL injection, XSS payloads, bad bots, known attack patterns</td><td>Stops attacks before they reach your code</td></tr>
        <tr><td>Rate limiting, auth</td><td>Reject clients over quota; check tokens</td><td>Protects backends; see <a href="#/p/api-gateway-rate-limiting">API gateway and rate limiting</a></td></tr>
        <tr><td>Routing</td><td><code>/api/*</code> to the API service, <code>/static/*</code> to object storage, <code>/v2</code> to new servers</td><td>One domain for many services; canary and blue-green releases</td></tr>
        <tr><td>Connection handling</td><td>Accept thousands of slow mobile connections; keep a small pool of fast keep-alive connections to backends</td><td>App servers with limited threads are not tied up by slow clients ("slowloris" protection, request buffering)</td></tr>
        <tr><td>Hiding the backend</td><td>Clients see one IP; backends live in a private subnet</td><td>Smaller attack surface; you can change servers freely</td></tr>
      </tbody>
    </table>
    <div data-diagram="tls" data-caption="TLS termination: HTTPS from the client ends at the proxy, which adds client info headers and forwards to a backend."></div>
    <div class="callout warn"><strong>Losing the client's IP</strong>Behind a reverse proxy, the backend sees the proxy's IP as the source. The proxy must pass the real client IP in a header such as <code>X-Forwarded-For</code> (or the standard <code>Forwarded</code>), with <code>X-Forwarded-Proto: https</code> for the original scheme. Backends should trust these headers only from known proxies, or anyone can fake their IP. For non-HTTP (L4) proxying, the PROXY protocol does the same job.</div>

    <h2>Nginx, HAProxy, Envoy and friends</h2>
    <table>
      <thead><tr><th>Tool</th><th>Strengths</th><th>Typical use</th></tr></thead>
      <tbody>
        <tr><td>Nginx</td><td>Very fast event-driven web server and reverse proxy; static files, caching, TLS; simple config. Handles tens of thousands of connections per worker</td><td>The default reverse proxy in front of web apps; Kubernetes ingress (ingress-nginx)</td></tr>
        <tr><td>HAProxy</td><td>High-performance L4 and L7 load balancing; rich health checks and stats</td><td>Dedicated load balancer in front of app or database fleets</td></tr>
        <tr><td>Envoy</td><td>Built for microservices: dynamic config through APIs (xDS), HTTP/2 and gRPC, retries, circuit breaking, detailed metrics and tracing</td><td>Sidecar in a service mesh (Istio), edge gateway, ingress</td></tr>
        <tr><td>Traefik, Caddy</td><td>Auto-discovery from Docker or Kubernetes; automatic Let's Encrypt certificates</td><td>Smaller setups and developer-friendly ingress</td></tr>
        <tr><td>Managed: AWS ALB/NLB, Google Cloud LB, Cloudflare</td><td>No servers to run; auto-scaling; DDoS protection</td><td>Most production edges in the cloud</td></tr>
      </tbody>
    </table>
    <p>A minimal Nginx reverse proxy: a <code>server</code> block listens on 443 with the certificate, and <code>location / { proxy_pass http://app_servers; }</code> forwards to an <code>upstream app_servers</code> group of backend addresses. Adding <code>proxy_cache</code>, <code>gzip on</code> and <code>limit_req</code> gives caching, compression and rate limiting.</p>

    <h2>Sidecar proxies and service mesh</h2>
    <p>Reverse proxies at the edge handle traffic coming <em>into</em> the system (north-south). In a microservices system, most traffic is <em>between</em> services (east-west). A <strong>service mesh</strong> puts a small proxy (usually Envoy) next to every service instance, as a <strong>sidecar</strong> container in the same pod. The service talks to <code>localhost</code>; the sidecar handles the network.</p>
    <div data-diagram="mesh" data-caption="Sidecar proxies: services only talk to their local proxy; the proxies handle mTLS, retries and metrics, configured by a central control plane."></div>
    <ul>
      <li><strong>mTLS everywhere</strong> (mutual TLS: both sides present certificates), so every service-to-service call is encrypted and authenticated without changing app code.</li>
      <li><strong>Retries, timeouts, circuit breaking</strong>, and traffic splitting for canary releases (send 5% to v2).</li>
      <li><strong>Uniform metrics and tracing</strong> for every call, in every language.</li>
      <li><strong>Cost</strong>: an extra hop (around a millisecond or less per call), CPU and memory per pod, and real operational complexity. Worth it with dozens of services; overkill with five. Newer "sidecar-less" designs (Istio ambient mode, eBPF-based Cilium) cut that overhead.</li>
    </ul>
    <p>Istio and Linkerd are the common meshes. Large Indian tech companies with hundreds of microservices (Flipkart, PhonePe) run Envoy-based meshes or similar platforms.</p>

    <h2>Reverse proxy vs load balancer vs API gateway</h2>
    <p>These words overlap a lot, and the same software (Nginx, Envoy) can be all three. The difference is emphasis:</p>
    <table>
      <thead><tr><th></th><th>Reverse proxy</th><th>Load balancer</th><th>API gateway</th></tr></thead>
      <tbody>
        <tr><td>Core job</td><td>Front door for servers: TLS, caching, compression, routing</td><td>Spread traffic across many instances and route around failures</td><td>Front door for APIs: auth, rate limits, quotas, routing to microservices, request transformation</td></tr>
        <tr><td>Layer</td><td>L7 (HTTP)</td><td>L4 (TCP/UDP) or L7</td><td>L7 with business-aware rules</td></tr>
        <tr><td>Knows about</td><td>Hosts and paths</td><td>Backend health and load</td><td>API keys, users, plans, API versions</td></tr>
        <tr><td>Examples</td><td>Nginx, Varnish</td><td>AWS NLB/ALB, HAProxy</td><td>Kong, AWS API Gateway, Apigee</td></tr>
      </tbody>
    </table>
    <p>A load balancer is a reverse proxy whose main job is distribution; an API gateway is a reverse proxy specialised for APIs. Read more in <a href="#/p/load-balancers">Load balancers</a> and <a href="#/p/api-gateway-rate-limiting">API gateway and rate limiting</a>. A <a href="#/p/cdn">CDN</a> is, in effect, a globally distributed caching reverse proxy.</p>

    <h2>Trade-offs</h2>
    <div class="grid-2">
      <div class="card good"><strong>Benefits of a reverse proxy</strong><ul><li>One place for TLS, auth, rate limits and logs</li><li>Backends hidden and freely replaceable</li><li>Caching and compression reduce load and bandwidth</li><li>Absorbs slow clients and traffic spikes</li></ul></div>
      <div class="card bad"><strong>Costs</strong><ul><li>Extra network hop (usually under a millisecond in the same data centre)</li><li>Single point of failure unless you run several (with DNS, anycast or a floating IP between them)</li><li>Another system to configure, monitor and scale</li><li>Hides the client's real IP unless headers are set</li></ul></div>
    </div>
    <div class="callout info"><strong>Make the proxy highly available</strong>Run at least two proxy instances. Common setups: two Nginx boxes sharing a virtual IP with keepalived (if one dies the other takes over the IP), or a managed cloud load balancer that is redundant across availability zones by design.</div>

    <h2>Real-world examples</h2>
    <ul>
      <li><strong>Cloudflare</strong>: a reverse proxy for millions of sites. DNS points to Cloudflare; it terminates TLS at the nearest edge, caches, blocks DDoS and bots, then forwards to the origin.</li>
      <li><strong>Kubernetes ingress</strong>: an Nginx or Envoy ingress controller is the reverse proxy that routes <code>api.swiggy.com/orders</code> and <code>/menu</code> to different services.</li>
      <li><strong>Lyft and Envoy</strong>: Lyft built Envoy as a sidecar to fix unreliable service-to-service calls; it is now a CNCF project used by Istio, AWS App Mesh and many companies.</li>
      <li><strong>Office networks</strong>: Indian IT services firms route employee web traffic through cloud forward proxies like Zscaler for security and compliance.</li>
    </ul>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"A forward proxy acts on behalf of clients, like a corporate gateway. A reverse proxy acts on behalf of servers and is what sits in front of our service."</li>
        <li>"Clients hit a reverse proxy layer (Nginx or a cloud ALB) that terminates TLS, compresses, caches static responses and load balances to stateless app servers in a private subnet."</li>
        <li>"We run at least two proxy instances across availability zones so the proxy is not a single point of failure."</li>
        <li>"Backends read the client IP from <code>X-Forwarded-For</code>, set by our proxy, for rate limiting and audit logs."</li>
        <li>"With many microservices, a sidecar mesh like Istio with Envoy gives mTLS, retries and tracing without changing app code."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Mixing up forward and reverse. Drawing a single proxy with no redundancy. Forgetting that terminating TLS at the proxy means traffic behind it is plain text unless you re-encrypt (fine in a trusted VPC for many systems, not for strict compliance). Trusting <code>X-Forwarded-For</code> from anyone.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>In one sentence each, what is a forward proxy and what is a reverse proxy?</summary><div>A forward proxy sits in front of clients and makes requests to the internet on their behalf (hiding and controlling them). A reverse proxy sits in front of servers and receives requests from the internet on their behalf (hiding and protecting them).</div></details>
      <details><summary>List four things a reverse proxy commonly does.</summary><div>TLS termination, load balancing with health checks, response caching, compression, WAF and DDoS filtering, rate limiting and auth, path-based routing, buffering slow clients, hiding backend IPs. Any four.</div></details>
      <details><summary>Your app logs show every request coming from 10.0.1.5 after you added Nginx. Why, and how do you fix it?</summary><div>10.0.1.5 is the proxy: it opens its own connection to the backend, so it becomes the source IP. Configure the proxy to add <code>X-Forwarded-For</code> (and <code>X-Forwarded-Proto</code>) with the real client IP, and make the app read it only when the request comes from a trusted proxy.</div></details>
      <details><summary>How does a forward proxy handle HTTPS without breaking encryption, and when does it break it?</summary><div>Normally the client sends <code>CONNECT host:443</code> and the proxy just tunnels the encrypted bytes, seeing only the hostname. Corporate proxies that must inspect content do TLS interception: they decrypt using a company root certificate installed on employee devices and re-encrypt to the site. Apps with certificate pinning fail under interception.</div></details>
      <details><summary>What is a sidecar proxy and what problem does it solve?</summary><div>A proxy (usually Envoy) deployed next to each service instance, through which all its network traffic flows. It moves cross-cutting network concerns (mTLS, retries, timeouts, circuit breaking, metrics, tracing, traffic splitting) out of application code, consistently across languages, managed by a mesh control plane like Istio.</div></details>
      <details><summary>How are a reverse proxy, a load balancer and an API gateway related?</summary><div>All three are reverse proxies in the broad sense. A load balancer focuses on distributing traffic across healthy instances (L4 or L7). An API gateway focuses on API concerns: authentication, rate limits, quotas, versioning and routing to microservices. One product, like Envoy or Nginx, can play all three roles.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Forward proxy = acts for clients (filtering, egress control, privacy). Reverse proxy = acts for servers (front door of your system).</li>
      <li>Reverse proxies do TLS termination, load balancing, caching, compression, WAF, rate limiting and routing in one place.</li>
      <li>Pass the client's IP with <code>X-Forwarded-For</code> and trust it only from your own proxies.</li>
      <li>Nginx and HAProxy are classic choices; Envoy is built for dynamic microservice setups and powers service meshes.</li>
      <li>Sidecar proxies handle east-west traffic (mTLS, retries, metrics) at the cost of extra hops and complexity.</li>
      <li>Load balancers, API gateways and CDNs are specialised reverse proxies. Always run the proxy layer redundantly.</li>
    </ul></div>
  `,
  diagrams: {
    reverse: String.raw`flowchart LR
      C1["Mobile app"] --> RP["Reverse proxy: TLS, WAF, cache, gzip"]
      C2["Browser"] --> RP
      RP -->|"/api/*"| A1["API server 1"]
      RP -->|"/api/*"| A2["API server 2"]
      RP -->|"/static/*"| ST[("Object storage")]
      RP -.->|"cache hit"| C2`,
    tls: String.raw`sequenceDiagram
      participant C as Client
      participant P as Reverse proxy
      participant B as Backend
      C->>P: HTTPS GET /orders (encrypted)
      Note over P: decrypt with certificate, check WAF and rate limit
      P->>B: HTTP GET /orders + X-Forwarded-For, X-Forwarded-Proto
      B-->>P: 200 OK (JSON)
      Note over P: compress with Brotli, maybe cache
      P-->>C: HTTPS 200 OK (encrypted)`,
    mesh: String.raw`flowchart LR
      subgraph PodA["Pod: Orders"]
        OA["Orders service"] --> EA["Envoy sidecar"]
      end
      subgraph PodB["Pod: Payments"]
        EB["Envoy sidecar"] --> PB["Payments service"]
      end
      EA -->|"mTLS, retries, metrics"| EB
      CP["Control plane (Istio)"] -.->|"config, certs"| EA
      CP -.->|"config, certs"| EB`,
  },
});
