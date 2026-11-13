SD.register({
  id: "cdn",
  html: String.raw`
    <p class="lead">A CDN (content delivery network) is a large fleet of caching servers spread across hundreds of cities. Instead of every user in India fetching an image from your servers in Mumbai, or worse, Virginia, they fetch a copy from an edge server a few milliseconds away. That cuts latency, takes most of the traffic off your origin servers, and absorbs spikes and attacks. Every large consumer product, from Flipkart product images to Hotstar's IPL streams, sits behind a CDN, and it is often the first box you draw in a design interview.</p>

    <h2>What a CDN is</h2>
    <p>Your <strong>origin</strong> is where the real content lives: your web servers, or an <a href="#/p/object-storage">object store</a> such as S3. The CDN runs <strong>edge servers</strong> grouped into <strong>PoPs</strong> (points of presence), each a cluster of machines in a data center close to users, often inside or next to large ISPs like Jio and Airtel. Users talk to the nearest PoP. The PoP serves from its cache when it can, and only goes back to the origin on a miss.</p>
    <div data-diagram="flow" data-caption="Users hit the nearest edge PoP. Misses go to a regional shield cache, and only then to the origin."></div>
    <p>Why this matters, in numbers: light in fiber covers about 200 km per millisecond, so a Bengaluru to US East Coast round trip is around 200 to 250 ms before any server work. A TCP plus TLS 1.3 setup needs two round trips before the first byte, so that is half a second just to start. From a PoP in Bengaluru the round trip is 5 to 10 ms. Multiply by the dozens of images, scripts and fonts on a page and the difference is seconds. See <a href="#/p/latency-throughput">latency numbers</a> and <a href="#/p/url-to-page">what happens when you type a URL</a>.</p>
    <div class="grid-3">
      <div class="card"><strong>Faster</strong><p>Content served from a few milliseconds away; TCP and TLS terminate at the edge.</p></div>
      <div class="card"><strong>Cheaper and safer origin</strong><p>A 95% cache hit ratio means the origin sees 1 in 20 requests and far less egress bandwidth.</p></div>
      <div class="card"><strong>Resilient</strong><p>Huge spread-out capacity absorbs traffic spikes and DDoS attacks; can serve stale content if the origin is down.</p></div>
    </div>

    <h2>How requests reach the nearest edge</h2>
    <p>You point your domain at the CDN (for example a <code>CNAME</code> from <code>img.example.com</code> to <code>example.cdn-provider.net</code>). The CDN then steers each user to a good PoP in one of two ways.</p>
    <div class="tabs">
      <section data-tab="DNS-based (GeoDNS)">
        <p>The CDN's DNS servers answer with a <em>different IP address</em> depending on where the query comes from. A resolver in Chennai gets the IP of the Chennai PoP; one in Delhi gets the Delhi PoP. The CDN can also weigh PoP load and health. The catch: DNS sees the location of the user's <em>resolver</em>, not the user. If someone in Kolkata uses a public resolver whose nearest site is Singapore, they may be sent to Singapore. The <strong>EDNS Client Subnet</strong> extension fixes this by passing part of the user's IP to the CDN's DNS. Akamai is the classic example of DNS-based steering. Answers use short TTLs (often 20 to 60 seconds) so traffic can be moved quickly.</p>
      </section>
      <section data-tab="Anycast">
        <p>Every PoP announces the <em>same IP address</em> to the internet using BGP, the routing protocol between networks. Routers send each packet to the "closest" PoP in network terms. There is nothing to configure per user and no resolver problem, and during a DDoS the attack traffic is automatically spread across all PoPs instead of piling onto one. If a PoP goes down it stops announcing, and traffic flows to the next one within seconds. Cloudflare is the classic Anycast CDN. The trade-off: BGP's idea of "closest" is about network paths and policies, not always latency, and route changes can move a long-lived TCP connection to a different PoP.</p>
      </section>
    </div>

    <figure class="svg-fig">
      <svg viewBox="0 0 640 260">
        <rect class="s-box" x="20" y="30" width="140" height="44" rx="10"/>
        <text class="s-text" x="90" y="57" text-anchor="middle">User, Delhi</text>
        <rect class="s-box" x="20" y="108" width="140" height="44" rx="10"/>
        <text class="s-text" x="90" y="135" text-anchor="middle">User, Chennai</text>
        <rect class="s-box" x="20" y="186" width="140" height="44" rx="10"/>
        <text class="s-text" x="90" y="213" text-anchor="middle">User, Singapore</text>
        <rect class="s-green" x="240" y="30" width="150" height="44" rx="10"/>
        <text class="s-text" x="315" y="57" text-anchor="middle">PoP Delhi</text>
        <rect class="s-green" x="240" y="108" width="150" height="44" rx="10"/>
        <text class="s-text" x="315" y="135" text-anchor="middle">PoP Chennai</text>
        <rect class="s-green" x="240" y="186" width="150" height="44" rx="10"/>
        <text class="s-text" x="315" y="213" text-anchor="middle">PoP Singapore</text>
        <line class="s-line" x1="160" y1="52" x2="238" y2="52" marker-end="url(#arrow)"/>
        <line class="s-line" x1="160" y1="130" x2="238" y2="130" marker-end="url(#arrow)"/>
        <line class="s-line" x1="160" y1="208" x2="238" y2="208" marker-end="url(#arrow)"/>
        <text class="s-muted" x="200" y="22" text-anchor="middle">all dial 104.16.0.1</text>
        <rect class="s-accent" x="470" y="108" width="150" height="44" rx="10"/>
        <text class="s-text" x="545" y="135" text-anchor="middle">Origin, Mumbai</text>
        <line class="s-dash" x1="390" y1="52" x2="468" y2="122"/>
        <line class="s-dash" x1="390" y1="130" x2="468" y2="130"/>
        <line class="s-dash" x1="390" y1="208" x2="468" y2="138"/>
        <text class="s-muted" x="545" y="180" text-anchor="middle">only cache misses</text>
        <text class="s-muted" x="545" y="198" text-anchor="middle">travel this far</text>
      </svg>
      <figcaption>Anycast: every PoP announces the same IP, so each user's packets land at the nearest PoP. Only misses (dashed) reach the origin.</figcaption>
    </figure>

    <h2>Pull vs push CDNs</h2>
    <table>
      <thead><tr><th></th><th>Pull (origin pull)</th><th>Push</th></tr></thead>
      <tbody>
        <tr><td>How content gets to the edge</td><td>Edge fetches from origin on the first request (a miss), then caches it</td><td>You upload content to the CDN ahead of time</td></tr>
        <tr><td>Setup</td><td>Just point the CDN at your origin</td><td>Upload pipeline; you manage what is stored</td></tr>
        <tr><td>First request</td><td>Slow (miss goes to origin)</td><td>Fast; already there</td></tr>
        <tr><td>Storage</td><td>Only popular content stays (evicted by LRU)</td><td>Everything you push, whether requested or not</td></tr>
        <tr><td>Best for</td><td>Websites, APIs, images, most traffic</td><td>Large files with known demand: game patches, app updates, a film releasing at midnight</td></tr>
      </tbody>
    </table>
    <p>Almost all CDN usage today is pull. When you know a huge spike is coming, you can still <strong>pre-warm</strong> a pull CDN by requesting the key files from each region before the event starts.</p>
    <div data-diagram="pull" data-caption="Pull CDN: the first request in a region misses and fills the edge; later requests are hits until the TTL expires."></div>

    <h2>Cache keys</h2>
    <p>The <strong>cache key</strong> decides when two requests count as "the same object". By default it is roughly the host plus path plus query string: <code>img.example.com/p/42.jpg?w=400</code>. Getting it right drives your hit ratio.</p>
    <ul>
      <li><strong>Too specific, low hit ratio</strong>: tracking parameters (<code>?utm_source=whatsapp</code>) create a separate copy per campaign. Strip or ignore them in the key.</li>
      <li><strong>Too broad, wrong content</strong>: if the response depends on something not in the key (language, device type, a logged-in cookie), one user can get another's version. The <code>Vary</code> header tells caches which request headers change the response (<code>Vary: Accept-Encoding</code> for gzip vs Brotli). Varying on high-cardinality headers like <code>User-Agent</code> or <code>Cookie</code> destroys the hit ratio; normalize to a few buckets (mobile/desktop) instead.</li>
      <li><strong>Never cache personal data publicly</strong>: responses with a user's cart or profile must be <code>Cache-Control: private</code> or <code>no-store</code>. A misconfigured cache serving one user's account page to others is a real and embarrassing class of incident.</li>
    </ul>

    <h2>TTL and Cache-Control</h2>
    <p>The origin tells the browser and the CDN how long to keep a response using HTTP headers. This is the same idea as TTLs in <a href="#/p/caching">application caching</a>, but standardised.</p>
    <table>
      <thead><tr><th>Directive</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><code>max-age=3600</code></td><td>Fresh for 3,600 seconds in any cache (browser and CDN)</td></tr>
        <tr><td><code>s-maxage=86400</code></td><td>Overrides max-age for shared caches (CDNs, proxies) only</td></tr>
        <tr><td><code>public</code> / <code>private</code></td><td>May be stored by shared caches / only by the user's browser</td></tr>
        <tr><td><code>no-cache</code></td><td>May store, but must revalidate with the origin (ETag / Last-Modified) before each use</td></tr>
        <tr><td><code>no-store</code></td><td>Do not store at all (payment pages, OTPs)</td></tr>
        <tr><td><code>immutable</code></td><td>Will never change; the browser does not even revalidate on reload</td></tr>
        <tr><td><code>stale-while-revalidate=60</code></td><td>Serve the stale copy for up to 60 s while fetching a fresh one in the background</td></tr>
        <tr><td><code>stale-if-error=86400</code></td><td>If the origin errors, keep serving the stale copy for up to a day</td></tr>
      </tbody>
    </table>
    <p>When a cached copy expires, the edge does not have to download it again. It sends a <strong>conditional request</strong> (<code>If-None-Match: "etag"</code>), and if nothing changed the origin replies <code>304 Not Modified</code> with no body. Many CDNs also let you set an edge TTL separately in their own config or with headers like <code>CDN-Cache-Control</code> and <code>Surrogate-Control</code>, so the CDN can cache for a day while browsers cache for a minute (you can purge the CDN, but not users' browsers).</p>

    <h2>Invalidation: purge vs versioned file names</h2>
    <p>You deploy a new <code>app.js</code>. Edges around the world still hold the old one for hours. Two fixes:</p>
    <ul>
      <li><strong>Purge (invalidation)</strong>: call the CDN API to delete a URL, a prefix, or everything tagged with a <strong>cache tag</strong> (<code>product-42</code>) from all PoPs. Cloudflare and Fastly purge globally in well under a few seconds; CloudFront invalidations usually take a minute or more and are billed per path beyond a free monthly quota. Purges do not reach browser caches, and purging everything at once sends a stampede of misses to your origin.</li>
      <li><strong>Versioned (fingerprinted) file names</strong>: build tools put a hash of the file's contents in its name: <code>app.3f9a1c.js</code>, <code>logo.8b2e.png</code>. A changed file gets a new name, so it is a brand new cache key; the old one simply stops being requested. Serve these with <code>Cache-Control: public, max-age=31536000, immutable</code> (one year). Only the small HTML page that references them gets a short TTL or <code>no-cache</code>.</li>
    </ul>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 180">
        <rect class="s-box" x="20" y="20" width="250" height="140" rx="10"/>
        <text class="s-title" x="145" y="46" text-anchor="middle">index.html</text>
        <text class="s-muted" x="145" y="68" text-anchor="middle">Cache-Control: no-cache</text>
        <text class="s-text" x="145" y="104" text-anchor="middle">src="app.3f9a1c.js"</text>
        <text class="s-text" x="145" y="132" text-anchor="middle">src="app.c71d02.js" (after deploy)</text>
        <rect class="s-red" x="360" y="30" width="260" height="50" rx="10"/>
        <text class="s-text" x="490" y="52" text-anchor="middle">app.3f9a1c.js (old)</text>
        <text class="s-muted" x="490" y="70" text-anchor="middle">no longer referenced, ages out</text>
        <rect class="s-green" x="360" y="100" width="260" height="50" rx="10"/>
        <text class="s-text" x="490" y="122" text-anchor="middle">app.c71d02.js (new)</text>
        <text class="s-muted" x="490" y="140" text-anchor="middle">max-age=1 year, immutable</text>
        <line class="s-dash" x1="270" y1="100" x2="358" y2="60"/>
        <line class="s-line" x1="270" y1="128" x2="358" y2="125" marker-end="url(#arrow)"/>
      </svg>
      <figcaption>Fingerprinted assets: the HTML is revalidated on every load, and points to new file names after a deploy. No purge needed.</figcaption>
    </figure>
    <div class="callout tip"><strong>Rule of thumb</strong>Long TTL plus versioned names for static assets; short TTL (or <code>no-cache</code> with ETag) for HTML and API responses; purge by tag for content that changes in place, such as a product image that a seller replaces.</div>

    <h2>Origin shield</h2>
    <p>With 300 PoPs, a new file can cause 300 separate misses to your origin, one per PoP, and a purge can cause 300 times your normal load. An <strong>origin shield</strong> (also called a mid-tier or regional edge cache) is an extra cache layer between the edges and the origin. Edge misses go to the shield; only the shield's misses reach the origin. Together with <strong>request collapsing</strong> (if 1,000 users ask a PoP for the same uncached file at once, it sends <em>one</em> request upstream and serves all 1,000 from the result), this keeps the origin calm during a live event. CloudFront calls it Origin Shield on top of its Regional Edge Caches; Cloudflare calls it Tiered Cache.</p>

    <h2>Beyond static files</h2>
    <h3>Dynamic content acceleration</h3>
    <p>Responses that cannot be cached (a personalised cart, a checkout API) still benefit from a CDN. The user's TCP and TLS handshakes end at a nearby PoP (a few ms instead of hundreds). The PoP then forwards the request over the CDN's own backbone using connections to the origin that are already open and warmed up, and often an optimised route. Users far from the origin often see API latency drop noticeably even with zero caching. Short <strong>micro-caching</strong> (caching for 1 to 5 seconds) of semi-dynamic pages, like a flash sale's stock count, can absorb huge read spikes.</p>
    <h3>Edge compute</h3>
    <p>Modern CDNs run your code at the PoP. <strong>Cloudflare Workers</strong> run JavaScript or WebAssembly in lightweight V8 isolates that start in milliseconds in every PoP. AWS offers <strong>CloudFront Functions</strong> (tiny, very fast JavaScript at the edge, for header and URL rewrites) and <strong>Lambda@Edge</strong> (fuller Node.js/Python functions running at regional edge locations). Typical uses: auth token checks before the origin, A/B test bucketing, redirects and geo-routing, resizing images on the fly, rewriting cache keys, and serving simple API responses from an edge key-value store.</p>
    <h3>Video streaming via CDN</h3>
    <p>Video is mostly CDN traffic. With <strong>HLS</strong> (HTTP Live Streaming) or <strong>DASH</strong>, a video is encoded at several qualities (say 240p to 1080p, an "ABR ladder") and cut into small segments of 2 to 6 seconds. A playlist file (<code>.m3u8</code> for HLS) lists the segments. The player downloads the playlist and then fetches segments one by one over plain HTTP, switching quality based on measured bandwidth (adaptive bitrate). Because segments are ordinary files, every PoP can cache them.</p>
    <div data-diagram="hls" data-caption="Live streaming: the encoder produces segments and playlists; millions of players fetch the same few files from edges."></div>
    <p>For live sport this is ideal: at any moment, all viewers want the <em>same</em> few latest segments. Disney+ Hotstar served tens of millions of concurrent viewers during IPL and cricket World Cup matches (peaks above 50 million were reported during the 2023 World Cup). Each edge fetches each new segment once (through the shield, with request collapsing) and serves it to everyone in its area. The live playlist itself gets a TTL of about one segment duration, segments get a long TTL, and capacity is pre-booked with several CDN providers, with traffic split across them.</p>

    <h2>Security at the edge</h2>
    <ul>
      <li><strong>DDoS protection</strong>: a CDN has far more total bandwidth than any attacker can aim at one PoP, and Anycast spreads attack traffic across all of them. Network-level floods (SYN floods, UDP amplification) are dropped at the edge and never reach your origin.</li>
      <li><strong>WAF</strong> (web application firewall): rules at the edge block SQL injection, cross-site scripting, bad bots and credential-stuffing patterns, plus <a href="#/p/api-gateway-rate-limiting">rate limiting</a> per IP or token.</li>
      <li><strong>Hide and lock the origin</strong>: allow only the CDN's IP ranges (or an authenticated tunnel) to reach the origin, or attackers will simply bypass the CDN.</li>
      <li><strong>Signed URLs and cookies</strong>: for paid or private content, the app issues a URL with an expiry time and an HMAC signature (<code>?expires=1731300000&amp;sig=...</code>). The edge checks the signature without calling the origin. This is how paid video and private downloads are protected, similar to S3 presigned URLs in <a href="#/p/object-storage">object storage</a>.</li>
      <li><strong>TLS everywhere</strong>: the CDN manages certificates and terminates TLS at the edge; use TLS on the edge-to-origin leg too.</li>
    </ul>

    <h2>Costs</h2>
    <p>CDNs mostly charge for <strong>data transferred out</strong> to users (per GB, cheaper at higher volume and varying by region; India and South America typically cost more per GB than the US or Europe), plus per-request fees, plus extras such as edge compute, WAF and invalidations. At large volume, prices are negotiated contracts. Some points to raise:</p>
    <ul>
      <li>CDN egress is usually cheaper than cloud origin egress, so a high hit ratio saves money twice: fewer origin servers and less origin bandwidth.</li>
      <li>Optimising bytes is optimising cost: WebP/AVIF images, Brotli compression, right-sized thumbnails (do not send a 4000 px photo to a 400 px phone slot).</li>
      <li>Big streaming and e-commerce players use <strong>multi-CDN</strong>: several providers at once for price negotiation, capacity and failover. Very large companies (Netflix Open Connect, Google, Meta) build their own and place cache boxes inside ISPs.</li>
    </ul>

    <h2>Real-world examples</h2>
    <ul>
      <li><strong>Flipkart Big Billion Days</strong>: tens of millions of users browse product pages in the first hours. Product images, thumbnails, JavaScript and CSS come from CDN edges with long TTLs and fingerprinted names; images are resized per device by an image service behind the CDN. The origin and databases handle only the truly dynamic parts: price, stock, cart and checkout. Pre-warming popular sale images before midnight avoids a wall of misses.</li>
      <li><strong>Hotstar IPL</strong>: live HLS/DASH segments through multiple CDNs, origin shielding and request collapsing so a new segment is fetched from origin a handful of times, not millions; the scorecard and "key moments" use short-TTL caching.</li>
      <li><strong>Swiggy and Zomato</strong>: restaurant and dish images on a CDN with on-the-fly resizing; menus and availability stay dynamic.</li>
    </ul>

    <h2>Akamai vs Cloudflare vs CloudFront</h2>
    <table>
      <thead><tr><th></th><th>Akamai</th><th>Cloudflare</th><th>Amazon CloudFront</th></tr></thead>
      <tbody>
        <tr><td>Footprint (approximate)</td><td>Largest, most distributed: about 4,000 PoPs, many inside ISPs</td><td>Over 300 cities, all services in every PoP</td><td>600+ PoPs plus regional edge caches</td></tr>
        <tr><td>Routing</td><td>Mainly DNS-based mapping</td><td>Anycast</td><td>DNS-based (latency-based routing)</td></tr>
        <tr><td>Edge compute</td><td>EdgeWorkers</td><td>Workers (V8 isolates), KV, Durable Objects</td><td>CloudFront Functions, Lambda@Edge</td></tr>
        <tr><td>Strengths</td><td>Large enterprises, media and banking, long history in video</td><td>Security (DDoS, WAF), developer platform, generous free tier, fast purge</td><td>Tight AWS integration (S3, ALB, Shield, WAF), pay as you go</td></tr>
        <tr><td>Typical choice</td><td>Big media and enterprise contracts</td><td>Startups to large sites wanting security plus CDN</td><td>Teams already on AWS</td></tr>
      </tbody>
    </table>
    <p>Others you may hear: Fastly (fast purge, VCL/Compute, popular with media and developer platforms), Google Cloud CDN and Azure Front Door. Footprint numbers change every year; quote them as rough sizes, not exact facts.</p>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"All static assets and media go through a CDN with S3 as the origin. Assets have content-hashed file names and a one-year immutable TTL, so deploys never need a purge."</li>
        <li>"I'll put an origin shield in front of the origin and rely on request collapsing, so a new popular object causes one origin fetch, not one per PoP."</li>
        <li>"For private content I'll issue short-lived signed URLs that the edge verifies without calling our servers."</li>
        <li>"With a 95% hit ratio, 2 Gbps of peak image traffic means only about 100 Mbps reaches the origin."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Caching personalised responses as public; putting tracking parameters or cookies into the cache key; relying on purges for every deploy instead of versioned names; leaving the origin reachable directly; forgetting that the first request per PoP is a miss (cold cache at the start of a big event).</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>What is the difference between DNS-based routing and Anycast for finding the nearest PoP?</summary><div>DNS-based: the CDN's DNS returns different PoP IPs depending on the resolver's location (better with EDNS Client Subnet). Anycast: all PoPs announce the same IP via BGP and the internet's routing delivers packets to the nearest one. Anycast also spreads DDoS traffic across PoPs automatically.</div></details>
      <details><summary>Pull vs push CDN: which would you use for a news site, and which for a 60 GB game update released at a fixed time?</summary><div>News site: pull, since content is fetched on demand and popular pages stay cached. Game update: push (or pre-warm a pull CDN), because demand is known, files are huge, and you do not want millions of first requests to miss and hit the origin at release time.</div></details>
      <details><summary>Why are fingerprinted file names like app.3f9a1c.js better than purging?</summary><div>A content change produces a new URL, which is a new cache key everywhere, including users' browsers, which a CDN purge cannot reach. Assets can be cached for a year as immutable; only the short-lived HTML needs to update. No purge delay, no stampede on the origin.</div></details>
      <details><summary>A new IPL highlight goes viral. Without an origin shield, what load does the origin see, and how does a shield help?</summary><div>Each of the hundreds of PoPs misses independently, so the origin gets roughly one request per PoP (more without request collapsing). With a shield, edges miss into the shield, which collapses them into a single origin fetch.</div></details>
      <details><summary>How does a CDN speed up an uncacheable checkout API?</summary><div>TCP and TLS handshakes terminate at a nearby PoP (a few ms), and the PoP forwards the request over the CDN's backbone on pre-opened, warm connections to the origin with optimised routing. Fewer long round trips mean lower latency even with no caching.</div></details>
      <details><summary>Which Cache-Control header would you send for (a) a hashed JS bundle, (b) the HTML page, (c) a user's order history API?</summary><div>(a) <code>public, max-age=31536000, immutable</code>. (b) <code>no-cache</code> (store but revalidate with ETag) or a short max-age. (c) <code>private, no-store</code> (or private with a short max-age), never public.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>A CDN caches content in PoPs near users, cutting latency and origin load; the origin only handles misses.</li>
      <li>Users reach the nearest PoP through GeoDNS or Anycast (same IP everywhere, routed by BGP).</li>
      <li>Pull CDNs are the default; push or pre-warm for huge, predictable releases.</li>
      <li>Control caching with good cache keys and Cache-Control (max-age, s-maxage, private, no-store, immutable, stale-while-revalidate).</li>
      <li>Prefer versioned file names over purges; add an origin shield and request collapsing for big events.</li>
      <li>CDNs also accelerate dynamic APIs, run edge code, stream video as HLS/DASH segments, and stop DDoS and web attacks; signed URLs protect paid content.</li>
    </ul></div>
  `,
  diagrams: {
    flow: String.raw`flowchart LR
      U1["User, Delhi"] --> E1["Edge PoP Delhi"]
      U2["User, Chennai"] --> E2["Edge PoP Chennai"]
      U3["User, Guwahati"] --> E3["Edge PoP Kolkata"]
      E1 -->|miss| SH["Origin shield (Mumbai)"]
      E2 -->|miss| SH
      E3 -->|miss| SH
      SH -->|miss| O["Origin: S3 / web servers"]`,
    pull: String.raw`sequenceDiagram
      participant A as User A
      participant B as User B
      participant E as Edge PoP
      participant O as Origin
      A->>E: GET /p/42.jpg
      E->>O: miss: fetch /p/42.jpg
      O-->>E: 200, Cache-Control: max-age=86400
      E-->>A: image (stored at edge)
      B->>E: GET /p/42.jpg
      E-->>B: hit, served from edge`,
    hls: String.raw`flowchart LR
      CAM["Live feed"] --> ENC["Encoder: 240p to 1080p"]
      ENC --> PK["Packager: 4 s segments + .m3u8"]
      PK --> OR["Origin"]
      OR --> SH["Shield"]
      SH --> E1["Edge PoPs"]
      E1 --> P["Millions of players"]`,
  },
});
