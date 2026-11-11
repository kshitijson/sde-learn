SD.register({
  id: "load-balancers",
  html: String.raw`
    <p class="lead">A load balancer (LB) sits in front of a group of servers and spreads incoming requests across them. It lets you add servers to handle more traffic (horizontal scaling), hides failed servers from users, and gives clients one stable address to talk to. Almost every HLD answer has a load balancer in it, so you need to know what it does, which kind to pick, and how it decides where each request goes.</p>

    <h2>What it is</h2>
    <p>Without a load balancer, clients talk to one server. When that server is full or dies, the product is down. With a load balancer, clients talk to one address (say <code>api.swiggy.com</code>), and the LB forwards each request to one of many identical backend servers. The backends are usually <strong>stateless</strong>: any server can handle any request because session data lives in a shared store such as Redis or a database.</p>
    <div data-diagram="what" data-caption="Clients hit one address; the load balancer spreads requests over a pool of identical servers."></div>
    <p>A load balancer gives you four things:</p>
    <ul>
      <li><strong>Scalability</strong>: add servers to the pool when traffic grows (for example, before a Big Billion Days sale on Flipkart).</li>
      <li><strong>Availability</strong>: health checks remove dead servers, so one crash does not become an outage.</li>
      <li><strong>Zero-downtime deploys</strong>: drain a server, upgrade it, put it back. Rolling and blue-green deploys depend on this.</li>
      <li><strong>One entry point</strong>: a single place to terminate TLS, add security rules and collect metrics.</li>
    </ul>
    <div class="callout info"><strong>Where load balancers appear</strong>Not only at the edge. You often have one in front of web servers, another between the web tier and internal services, and client-side balancing inside service meshes. Databases use a similar idea for read replicas.</div>

    <h2>L4 vs L7 load balancing</h2>
    <p>The "L" refers to the OSI network model layer the LB works at. This is the most common load-balancer interview question.</p>
    <ul>
      <li><strong>Layer 4 (transport)</strong>: the LB only looks at IP addresses and TCP/UDP ports. It picks a backend when a connection opens and then just forwards packets. It does not read the HTTP request.</li>
      <li><strong>Layer 7 (application)</strong>: the LB terminates the connection, reads the HTTP request (URL, headers, cookies) and then decides. It can send <code>/api/payments</code> to one pool and <code>/images</code> to another.</li>
    </ul>
    <table>
      <thead><tr><th>Aspect</th><th>L4 load balancer</th><th>L7 load balancer</th></tr></thead>
      <tbody>
        <tr><td>Sees</td><td>IP, port, protocol</td><td>Full HTTP: path, headers, cookies, body</td></tr>
        <tr><td>Routing decisions</td><td>Per connection</td><td>Per request (path, host, header based)</td></tr>
        <tr><td>Speed</td><td>Very fast, millions of packets/sec, low latency</td><td>Slower: must parse every request</td></tr>
        <tr><td>TLS</td><td>Usually passes it through untouched</td><td>Usually terminates it (decrypts)</td></tr>
        <tr><td>Features</td><td>Basic balancing, health checks</td><td>Path routing, header rewrite, retries, caching, compression, auth, WAF</td></tr>
        <tr><td>Protocols</td><td>Any TCP/UDP (DB, MQTT, gaming, video)</td><td>HTTP/1.1, HTTP/2, gRPC, WebSocket</td></tr>
        <tr><td>Examples</td><td>AWS NLB, HAProxy (TCP mode), LVS, Maglev</td><td>AWS ALB, Nginx, Envoy, HAProxy (HTTP mode)</td></tr>
      </tbody>
    </table>
    <div class="callout tip"><strong>Common combination</strong>Big companies stack them: an L4 layer at the edge (cheap, very high throughput, handles DDoS volume) forwards to a fleet of L7 proxies, which do the smart HTTP routing to microservices.</div>

    <h2>Balancing algorithms</h2>
    <p>The algorithm decides which backend gets the next request. Algorithms are either <strong>static</strong> (they ignore current server load) or <strong>dynamic</strong> (they use live load information).</p>
    <div data-widget="lb-sim"></div>

    <h3>Round robin</h3>
    <p>Send requests to servers in order: S1, S2, S3, S1, S2, S3, ... Simple, no state except a counter, and fair when all servers are the same and all requests cost about the same. It breaks down when one request takes 5 ms and another 5 seconds: a server can pile up slow requests while still getting its "fair" share.</p>

    <h3>Weighted round robin</h3>
    <p>Give each server a weight that matches its capacity. A 16-core box with weight 4 gets four times the requests of a 4-core box with weight 1. Useful when your fleet is mixed (old and new machine types) or during canary releases (send 5% to the new version). Nginx uses a "smooth" version that interleaves picks (A A B A C A rather than A A A A B C) so a big server is not hit in bursts.</p>

    <h3>Least connections</h3>
    <p>Send the request to the server with the fewest open connections right now. This adapts to slow requests automatically: a server stuck on heavy work keeps its connections open longer and gets fewer new ones. Good for long-lived connections such as WebSockets or database proxies. <em>Weighted least connections</em> divides open connections by weight.</p>

    <h3>Least response time</h3>
    <p>Pick the server with the lowest recent average response time (often combined with fewest active connections). It reacts to servers that are slow because of GC pauses, noisy neighbours or a bad disk. It needs the LB to measure latency, which costs a bit of work.</p>

    <h3>IP hash</h3>
    <p>Compute <code>hash(client IP) mod N</code> and always send that client to the same server. This gives a crude form of stickiness without cookies. Two problems: many users behind one office or mobile carrier NAT share an IP and all land on one server; and when N changes, almost every client is remapped.</p>

    <h3>Consistent hashing</h3>
    <p>Place servers and keys on a hash ring; each key goes to the next server clockwise. When a server is added or removed, only about <code>1/N</code> of the keys move. Used when the backend holds per-key state, such as cache servers (send all requests for user 42 to the node that has user 42 cached) or sharded WebSocket servers. See the consistent hashing page for details.</p>

    <h3>Random and power of two choices</h3>
    <p>Pure random works surprisingly well at scale but has noticeable imbalance on small pools. <strong>Power of two choices</strong> picks two servers at random and sends the request to the less loaded one. This tiny change cuts the worst-case load dramatically compared to random, and it needs no global ordering, so many independent LB instances can use it without coordinating. Envoy and Nginx (<code>random two least_conn</code>) both support it.</p>

    <table>
      <thead><tr><th>Algorithm</th><th>Type</th><th>Best for</th><th>Weakness</th></tr></thead>
      <tbody>
        <tr><td>Round robin</td><td>Static</td><td>Identical servers, uniform requests</td><td>Ignores load</td></tr>
        <tr><td>Weighted round robin</td><td>Static</td><td>Mixed hardware, canaries</td><td>Weights are manual</td></tr>
        <tr><td>Least connections</td><td>Dynamic</td><td>Varying request times, WebSockets</td><td>Needs connection tracking</td></tr>
        <tr><td>Least response time</td><td>Dynamic</td><td>Latency-sensitive APIs</td><td>Measurement overhead, can oscillate</td></tr>
        <tr><td>IP hash</td><td>Static</td><td>Simple stickiness</td><td>NAT hotspots, remaps on resize</td></tr>
        <tr><td>Consistent hashing</td><td>Static</td><td>Caches, stateful shards</td><td>Hot keys can overload one node</td></tr>
        <tr><td>Power of two choices</td><td>Dynamic</td><td>Many distributed LB instances</td><td>Slightly less optimal than global least-conn</td></tr>
      </tbody>
    </table>

    <h3>Code: a pluggable picker</h3>
    <p>Below, three strategies share one interface: <code>pick()</code> chooses a server and <code>release()</code> is called when the request finishes (needed for least connections). The weighted version is the smooth algorithm used by Nginx: every pick, each server adds its weight to a running score; the highest score wins and then subtracts the total weight.</p>
    <div data-code="picker"></div>

    <h2>Health checks</h2>
    <p>A load balancer must stop sending traffic to dead or sick servers. It learns about them in two ways.</p>
    <div class="grid-2">
      <div class="card"><strong>Active health checks</strong><p>The LB probes each server on a timer, for example <code>GET /health</code> every 5 seconds. After 3 failures in a row the server is marked unhealthy; after 2 successes it comes back. Detects failures even with no traffic, but adds probe load.</p></div>
      <div class="card"><strong>Passive health checks</strong><p>The LB watches real traffic. If a server returns many 5xx errors or connection timeouts, it is ejected for a while (Envoy calls this <em>outlier detection</em>). No extra traffic, but only works when requests are flowing.</p></div>
    </div>
    <div data-diagram="health" data-caption="Active health check: a server is removed after consecutive failures and added back after it recovers."></div>
    <div class="callout warn"><strong>Shallow vs deep health checks</strong>A shallow check (<code>/health</code> returns 200 if the process is up) is safe. A deep check that also pings the database sounds better, but if the DB blips, <em>every</em> server fails its check at once and the LB removes the whole fleet. Keep the LB check shallow and monitor dependencies separately. Many LBs also "fail open": if all backends look unhealthy, send traffic to all of them anyway.</div>
    <p>Related: <strong>connection draining</strong> (deregistration delay). When a server is being removed for a deploy, the LB stops sending new requests but lets in-flight requests finish, for example for up to 30 seconds.</p>

    <h2>Sticky sessions</h2>
    <p>Sticky sessions (session affinity) send all requests from one user to the same server, usually using a cookie the LB sets (AWS ALB uses <code>AWSALB</code>) or IP hash. You need them when the server keeps state in memory, such as a legacy shopping cart or a WebSocket connection.</p>
    <div class="grid-2">
      <div class="card good"><strong>Pros</strong><ul><li>Works with stateful legacy apps</li><li>Better local cache hit rate</li></ul></div>
      <div class="card bad"><strong>Cons</strong><ul><li>Uneven load: a few heavy users pin one server</li><li>Server dies, its users lose their session</li><li>Harder to scale down or deploy</li></ul></div>
    </div>
    <div class="callout interview"><strong>Say this in the interview</strong>"I'll keep the app servers stateless and store sessions in Redis, so I don't need sticky sessions. Any server can serve any request, which makes autoscaling and deploys simple. For WebSockets I accept stickiness for the life of the connection, since a connection is bound to one server anyway."</div>

    <h2>SSL/TLS termination</h2>
    <p>TLS handshakes and encryption cost CPU. With <strong>TLS termination</strong> the LB decrypts HTTPS, and talks plain HTTP to backends on a private network. Benefits: certificates live in one place, backends save CPU, and the L7 LB can read the request to route it. Variants:</p>
    <ul>
      <li><strong>TLS passthrough</strong>: an L4 LB forwards encrypted bytes; the backend decrypts. End-to-end encryption, but no L7 routing.</li>
      <li><strong>TLS re-encryption (bridging)</strong>: the LB decrypts, inspects, then opens a new TLS connection to the backend. Needed where compliance (PCI DSS for payment companies such as Razorpay) requires encryption inside the data centre too.</li>
    </ul>

    <h2>Load balancer redundancy</h2>
    <p>If every request goes through one load balancer, the LB itself becomes a single point of failure. The classic fix is an <strong>active-passive pair with a floating IP</strong> (also called a virtual IP, VIP). Both LBs run, but only the active one owns the VIP. They send heartbeats to each other (using a protocol such as VRRP via <code>keepalived</code>). If the passive one stops hearing heartbeats, it claims the VIP and announces it on the network (gratuitous ARP). Clients keep using the same IP and notice only a second or two of disruption.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 300">
        <rect class="s-box" x="250" y="10" width="140" height="44" rx="10"/>
        <text class="s-title" x="320" y="37" text-anchor="middle">Clients</text>
        <rect class="s-accent" x="235" y="84" width="170" height="40" rx="10"/>
        <text class="s-title" x="320" y="109" text-anchor="middle">Floating IP 10.0.0.100</text>
        <line class="s-line" x1="320" y1="54" x2="320" y2="82" marker-end="url(#arrow)"/>
        <rect class="s-green" x="90" y="150" width="170" height="54" rx="10"/>
        <text class="s-title" x="175" y="174" text-anchor="middle">LB-1 (active)</text>
        <text class="s-muted" x="175" y="192" text-anchor="middle">owns the VIP</text>
        <rect class="s-box" x="380" y="150" width="170" height="54" rx="10"/>
        <text class="s-title" x="465" y="174" text-anchor="middle">LB-2 (passive)</text>
        <text class="s-muted" x="465" y="192" text-anchor="middle">takes VIP on failure</text>
        <line class="s-line" x1="290" y1="124" x2="200" y2="148" marker-end="url(#arrow)"/>
        <line class="s-dash" x1="350" y1="124" x2="440" y2="148"/>
        <line class="s-dash" x1="262" y1="177" x2="378" y2="177"/>
        <text class="s-muted" x="320" y="170" text-anchor="middle">heartbeat</text>
        <rect class="s-box" x="60" y="240" width="140" height="44" rx="10"/>
        <text class="s-text" x="130" y="267" text-anchor="middle">Server 1</text>
        <rect class="s-box" x="250" y="240" width="140" height="44" rx="10"/>
        <text class="s-text" x="320" y="267" text-anchor="middle">Server 2</text>
        <rect class="s-box" x="440" y="240" width="140" height="44" rx="10"/>
        <text class="s-text" x="510" y="267" text-anchor="middle">Server 3</text>
        <line class="s-line" x1="160" y1="204" x2="130" y2="238" marker-end="url(#arrow)"/>
        <line class="s-line" x1="190" y1="204" x2="310" y2="238" marker-end="url(#arrow)"/>
        <line class="s-line" x1="230" y1="204" x2="490" y2="238" marker-end="url(#arrow)"/>
      </svg>
      <figcaption>Active-passive LB pair. Only the active LB holds the floating IP; the passive one watches heartbeats and takes over the IP if they stop.</figcaption>
    </figure>
    <p><strong>Active-active</strong> is the other option: both LBs serve traffic (for example, DNS returns both IPs, or routers spread traffic with ECMP). You use all the hardware, but each LB must be able to carry the full load alone if the other dies. Managed cloud LBs (AWS ELB, GCP Cloud Load Balancing) are already redundant across availability zones, so in a cloud design you usually just say "managed LB, multi-AZ".</p>

    <h2>Global server load balancing (GSLB)</h2>
    <p>Everything above balances inside one data centre. To balance across regions (Mumbai, Singapore, Virginia), you route users to the nearest healthy region before the regional LB sees them.</p>
    <ul>
      <li><strong>DNS-based GSLB</strong>: the authoritative DNS server returns different IPs depending on where the user is (geo DNS), region health, or latency measurements. AWS Route 53 latency/geolocation routing and Cloudflare load balancing work this way. Downside: DNS answers are cached for the TTL, and some resolvers ignore low TTLs, so failover can take minutes.</li>
      <li><strong>Anycast</strong>: many data centres announce the <em>same</em> IP address via BGP. Internet routers naturally deliver packets to the nearest one. Failover is fast (withdraw the route) and it absorbs DDoS traffic across sites. Used by Cloudflare, Google's front end and public DNS resolvers such as <code>8.8.8.8</code> and <code>1.1.1.1</code>.</li>
    </ul>
    <div data-diagram="gslb" data-caption="Global load balancing: DNS or Anycast picks a region, then a regional LB picks a server."></div>

    <h2>Real-world tools</h2>
    <table>
      <thead><tr><th>Tool</th><th>Layer</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td>Nginx</td><td>L7 (and L4 via stream module)</td><td>Web server + reverse proxy + LB. Very common first choice. Config based.</td></tr>
        <tr><td>HAProxy</td><td>L4 and L7</td><td>High-performance, battle-tested, rich health checks and stats.</td></tr>
        <tr><td>AWS ALB</td><td>L7</td><td>Managed HTTP/HTTPS/gRPC LB with path and host rules, WebSockets, autoscaling targets.</td></tr>
        <tr><td>AWS NLB</td><td>L4</td><td>Managed TCP/UDP LB, millions of requests/sec, static IP per AZ, very low latency.</td></tr>
        <tr><td>Envoy</td><td>L7 (and L4)</td><td>Modern proxy built for microservices, dynamic config via APIs, outlier detection; the data plane of Istio service mesh.</td></tr>
        <tr><td>Google Maglev, Meta Katran</td><td>L4</td><td>Software L4 LBs on commodity machines using consistent hashing; good to name-drop for SDE 2.</td></tr>
      </tbody>
    </table>

    <h2>Trade-offs and pitfalls</h2>
    <ul>
      <li><strong>Extra hop</strong>: an LB adds a little latency (well under a millisecond for L4, around 1 ms for L7) and is another component to operate.</li>
      <li><strong>Retries can amplify load</strong>: if the LB retries failed requests on another server during an overload, traffic multiplies. Cap retries and use retry budgets.</li>
      <li><strong>Long-lived connections</strong> (WebSocket, gRPC streams, HTTP/2) defeat per-request balancing at L4: a new server added to the pool gets no traffic until clients reconnect. Use L7 balancing per gRPC request, or periodically recycle connections.</li>
      <li><strong>Slow start</strong>: a freshly started server has cold caches and a cold JIT. Least connections will flood it because it has zero connections. Ramp its weight up over 30 to 60 seconds.</li>
    </ul>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"Clients hit a managed L7 load balancer across availability zones; it terminates TLS and routes by path to stateless service pools."</li>
        <li>"I'll use least connections because request durations vary a lot; for the cache tier I'll use consistent hashing so keys stay on the same node."</li>
        <li>"The LB isn't a single point of failure: it's an active-passive pair with a floating IP, or a managed multi-AZ LB. Across regions, I'll use latency-based DNS or Anycast."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls interviewers catch</strong>Drawing one LB box without mentioning its redundancy; using sticky sessions when the app could be stateless; using <code>hash mod N</code> for a cache tier and not noticing that adding a node remaps almost every key.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>You need to route /api/orders to the order service and /api/users to the user service. L4 or L7?</summary><div>L7. Routing by URL path requires reading the HTTP request, which only an L7 load balancer does. An L4 LB sees only IPs and ports.</div></details>
      <details><summary>Requests to your service take anywhere from 10 ms to 8 s. Why is round robin a poor choice, and what would you use?</summary><div>Round robin ignores how busy a server is, so one server can collect many slow requests. Least connections (or least response time) naturally sends new work to servers that are finishing quickly.</div></details>
      <details><summary>Why can IP hash cause one server to get overloaded on an Indian mobile network?</summary><div>Mobile carriers use carrier-grade NAT, so thousands of users share a small number of public IPs. All of them hash to the same server. IP hash also remaps most clients when the pool size changes.</div></details>
      <details><summary>Your health check calls the database. The DB has a 10-second blip. What happens?</summary><div>Every app server fails its health check at the same time, the LB marks them all unhealthy and the whole site goes down, even though the servers were fine. Keep LB health checks shallow (process liveness) or configure fail-open behaviour.</div></details>
      <details><summary>How do you avoid the load balancer being a single point of failure?</summary><div>Run an active-passive pair sharing a floating IP via VRRP/keepalived (passive takes over the IP when heartbeats stop), or run active-active behind DNS/ECMP, or use a managed multi-AZ cloud LB. Across regions, use DNS-based GSLB or Anycast.</div></details>
      <details><summary>What is "power of two choices" and why do distributed LBs like it?</summary><div>Pick two random servers and send to the less loaded one. It gets close to least-connections quality with no shared state, so many LB instances can each decide independently without herding onto the same "least loaded" server.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>A load balancer spreads traffic over stateless servers for scale, availability and safe deploys.</li>
      <li>L4 is fast and protocol-agnostic; L7 understands HTTP and can route by path, header or cookie.</li>
      <li>Round robin for uniform work, weighted for mixed capacity, least connections for variable work, consistent hashing for stateful or cache tiers.</li>
      <li>Active and passive health checks remove bad servers; keep checks shallow and drain connections on deploy.</li>
      <li>Avoid sticky sessions by storing session state in Redis; terminate TLS at the LB unless compliance needs re-encryption.</li>
      <li>Make the LB redundant (floating IP pair or managed multi-AZ) and use DNS or Anycast for global balancing.</li>
    </ul></div>
  `,
  code: {
    picker: {
      title: "Round robin, weighted round robin and least connections behind one interface",
      java: String.raw`import java.util.*;

public class Main {
    static class Server {
        final String name;
        final int weight;
        int activeConnections = 0;
        int currentWeight = 0; // used by smooth weighted round robin

        Server(String name, int weight) { this.name = name; this.weight = weight; }
    }

    interface Balancer {
        Server pick();
        default void release(Server s) { }
    }

    static class RoundRobin implements Balancer {
        private final List<Server> servers;
        private int next = 0;
        RoundRobin(List<Server> servers) { this.servers = servers; }

        public synchronized Server pick() {
            Server s = servers.get(next);
            next = (next + 1) % servers.size();
            return s;
        }
    }

    // Smooth weighted round robin (the algorithm Nginx uses).
    static class WeightedRoundRobin implements Balancer {
        private final List<Server> servers;
        private final int totalWeight;
        WeightedRoundRobin(List<Server> servers) {
            this.servers = servers;
            this.totalWeight = servers.stream().mapToInt(s -> s.weight).sum();
        }

        public synchronized Server pick() {
            Server best = null;
            for (Server s : servers) {
                s.currentWeight += s.weight;
                if (best == null || s.currentWeight > best.currentWeight) best = s;
            }
            best.currentWeight -= totalWeight;
            return best;
        }
    }

    static class LeastConnections implements Balancer {
        private final List<Server> servers;
        LeastConnections(List<Server> servers) { this.servers = servers; }

        public synchronized Server pick() {
            Server best = servers.get(0);
            for (Server s : servers) {
                if (s.activeConnections < best.activeConnections) best = s;
            }
            best.activeConnections++;
            return best;
        }

        public synchronized void release(Server s) { s.activeConnections--; }
    }

    static List<Server> pool() {
        return List.of(new Server("A", 5), new Server("B", 1), new Server("C", 1));
    }

    public static void main(String[] args) {
        Balancer rr = new RoundRobin(pool());
        Balancer wrr = new WeightedRoundRobin(pool());
        StringBuilder a = new StringBuilder(), b = new StringBuilder();
        for (int i = 0; i < 7; i++) {
            a.append(rr.pick().name);
            b.append(wrr.pick().name);
        }
        System.out.println("Round robin:          " + a); // ABCABCA
        System.out.println("Weighted round robin: " + b); // AABACAA

        Balancer lc = new LeastConnections(pool());
        Server s1 = lc.pick(), s2 = lc.pick(), s3 = lc.pick();
        lc.release(s2); // B finishes its request first
        System.out.println("Least connections:    " + s1.name + s2.name + s3.name
                + " then " + lc.pick().name); // ABC then B
    }
}
`,
      python: String.raw`from abc import ABC, abstractmethod
from threading import Lock


class Server:
    def __init__(self, name: str, weight: int = 1):
        self.name = name
        self.weight = weight
        self.active_connections = 0
        self.current_weight = 0  # used by smooth weighted round robin


class Balancer(ABC):
    def __init__(self, servers: list[Server]):
        self.servers = servers
        self.lock = Lock()

    @abstractmethod
    def pick(self) -> Server: ...

    def release(self, server: Server) -> None:
        pass


class RoundRobin(Balancer):
    def __init__(self, servers):
        super().__init__(servers)
        self.next = 0

    def pick(self):
        with self.lock:
            s = self.servers[self.next]
            self.next = (self.next + 1) % len(self.servers)
            return s


class WeightedRoundRobin(Balancer):
    """Smooth weighted round robin (the algorithm Nginx uses)."""

    def __init__(self, servers):
        super().__init__(servers)
        self.total = sum(s.weight for s in servers)

    def pick(self):
        with self.lock:
            best = None
            for s in self.servers:
                s.current_weight += s.weight
                if best is None or s.current_weight > best.current_weight:
                    best = s
            best.current_weight -= self.total
            return best


class LeastConnections(Balancer):
    def pick(self):
        with self.lock:
            best = min(self.servers, key=lambda s: s.active_connections)
            best.active_connections += 1
            return best

    def release(self, server):
        with self.lock:
            server.active_connections -= 1


def pool():
    return [Server("A", 5), Server("B", 1), Server("C", 1)]


if __name__ == "__main__":
    rr, wrr = RoundRobin(pool()), WeightedRoundRobin(pool())
    print("Round robin:         ", "".join(rr.pick().name for _ in range(7)))   # ABCABCA
    print("Weighted round robin:", "".join(wrr.pick().name for _ in range(7)))  # AABACAA

    lc = LeastConnections(pool())
    s1, s2, s3 = lc.pick(), lc.pick(), lc.pick()
    lc.release(s2)  # B finishes its request first
    print("Least connections:   ", s1.name + s2.name + s3.name, "then", lc.pick().name)  # ABC then B
`,
      cpp: String.raw`#include <iostream>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

struct Server {
    std::string name;
    int weight;
    int activeConnections = 0;
    int currentWeight = 0;  // used by smooth weighted round robin
    Server(std::string n, int w) : name(std::move(n)), weight(w) {}
};

class Balancer {
public:
    virtual ~Balancer() = default;
    virtual Server* pick() = 0;
    virtual void release(Server*) {}
};

class RoundRobin : public Balancer {
    std::vector<Server>& servers_;
    size_t next_ = 0;
    std::mutex mu_;
public:
    explicit RoundRobin(std::vector<Server>& s) : servers_(s) {}
    Server* pick() override {
        std::lock_guard<std::mutex> lock(mu_);
        Server* s = &servers_[next_];
        next_ = (next_ + 1) % servers_.size();
        return s;
    }
};

// Smooth weighted round robin (the algorithm Nginx uses).
class WeightedRoundRobin : public Balancer {
    std::vector<Server>& servers_;
    int total_ = 0;
    std::mutex mu_;
public:
    explicit WeightedRoundRobin(std::vector<Server>& s) : servers_(s) {
        for (auto& x : servers_) total_ += x.weight;
    }
    Server* pick() override {
        std::lock_guard<std::mutex> lock(mu_);
        Server* best = nullptr;
        for (auto& s : servers_) {
            s.currentWeight += s.weight;
            if (!best || s.currentWeight > best->currentWeight) best = &s;
        }
        best->currentWeight -= total_;
        return best;
    }
};

class LeastConnections : public Balancer {
    std::vector<Server>& servers_;
    std::mutex mu_;
public:
    explicit LeastConnections(std::vector<Server>& s) : servers_(s) {}
    Server* pick() override {
        std::lock_guard<std::mutex> lock(mu_);
        Server* best = &servers_[0];
        for (auto& s : servers_)
            if (s.activeConnections < best->activeConnections) best = &s;
        best->activeConnections++;
        return best;
    }
    void release(Server* s) override {
        std::lock_guard<std::mutex> lock(mu_);
        s->activeConnections--;
    }
};

std::vector<Server> pool() { return {{"A", 5}, {"B", 1}, {"C", 1}}; }

int main() {
    auto p1 = pool(), p2 = pool(), p3 = pool();
    std::unique_ptr<Balancer> rr = std::make_unique<RoundRobin>(p1);
    std::unique_ptr<Balancer> wrr = std::make_unique<WeightedRoundRobin>(p2);
    std::string a, b;
    for (int i = 0; i < 7; i++) {
        a += rr->pick()->name;
        b += wrr->pick()->name;
    }
    std::cout << "Round robin:          " << a << "\n";  // ABCABCA
    std::cout << "Weighted round robin: " << b << "\n";  // AABACAA

    std::unique_ptr<Balancer> lc = std::make_unique<LeastConnections>(p3);
    Server* s1 = lc->pick();
    Server* s2 = lc->pick();
    Server* s3 = lc->pick();
    lc->release(s2);  // B finishes its request first
    std::cout << "Least connections:    " << s1->name << s2->name << s3->name
              << " then " << lc->pick()->name << "\n";  // ABC then B
}
`,
      javascript: String.raw`class Server {
  constructor(name, weight = 1) {
    this.name = name;
    this.weight = weight;
    this.activeConnections = 0;
    this.currentWeight = 0; // used by smooth weighted round robin
  }
}

// Common interface: pick() returns a server, release() is called when a request ends.
class Balancer {
  constructor(servers) { this.servers = servers; }
  pick() { throw new Error("not implemented"); }
  release(server) {}
}

class RoundRobin extends Balancer {
  constructor(servers) { super(servers); this.next = 0; }
  pick() {
    const s = this.servers[this.next];
    this.next = (this.next + 1) % this.servers.length;
    return s;
  }
}

// Smooth weighted round robin (the algorithm Nginx uses).
class WeightedRoundRobin extends Balancer {
  constructor(servers) {
    super(servers);
    this.total = servers.reduce((sum, s) => sum + s.weight, 0);
  }
  pick() {
    let best = null;
    for (const s of this.servers) {
      s.currentWeight += s.weight;
      if (best === null || s.currentWeight > best.currentWeight) best = s;
    }
    best.currentWeight -= this.total;
    return best;
  }
}

class LeastConnections extends Balancer {
  pick() {
    let best = this.servers[0];
    for (const s of this.servers) {
      if (s.activeConnections < best.activeConnections) best = s;
    }
    best.activeConnections++;
    return best;
  }
  release(server) { server.activeConnections--; }
}

const pool = () => [new Server("A", 5), new Server("B", 1), new Server("C", 1)];

const rr = new RoundRobin(pool());
const wrr = new WeightedRoundRobin(pool());
let a = "", b = "";
for (let i = 0; i < 7; i++) {
  a += rr.pick().name;
  b += wrr.pick().name;
}
console.log("Round robin:         ", a); // ABCABCA
console.log("Weighted round robin:", b); // AABACAA

const lc = new LeastConnections(pool());
const s1 = lc.pick(), s2 = lc.pick(), s3 = lc.pick();
lc.release(s2); // B finishes its request first
console.log("Least connections:   ", s1.name + s2.name + s3.name, "then", lc.pick().name); // ABC then B
`,
      go: String.raw`package main

import (
	"fmt"
	"strings"
	"sync"
)

type Server struct {
	Name              string
	Weight            int
	ActiveConnections int
	currentWeight     int // used by smooth weighted round robin
}

// Balancer is the common interface for every strategy.
type Balancer interface {
	Pick() *Server
	Release(s *Server)
}

type RoundRobin struct {
	mu      sync.Mutex
	servers []*Server
	next    int
}

func (r *RoundRobin) Pick() *Server {
	r.mu.Lock()
	defer r.mu.Unlock()
	s := r.servers[r.next]
	r.next = (r.next + 1) % len(r.servers)
	return s
}

func (r *RoundRobin) Release(*Server) {}

// WeightedRoundRobin is smooth weighted round robin (the algorithm Nginx uses).
type WeightedRoundRobin struct {
	mu      sync.Mutex
	servers []*Server
	total   int
}

func NewWeightedRoundRobin(servers []*Server) *WeightedRoundRobin {
	w := &WeightedRoundRobin{servers: servers}
	for _, s := range servers {
		w.total += s.Weight
	}
	return w
}

func (w *WeightedRoundRobin) Pick() *Server {
	w.mu.Lock()
	defer w.mu.Unlock()
	var best *Server
	for _, s := range w.servers {
		s.currentWeight += s.Weight
		if best == nil || s.currentWeight > best.currentWeight {
			best = s
		}
	}
	best.currentWeight -= w.total
	return best
}

func (w *WeightedRoundRobin) Release(*Server) {}

type LeastConnections struct {
	mu      sync.Mutex
	servers []*Server
}

func (l *LeastConnections) Pick() *Server {
	l.mu.Lock()
	defer l.mu.Unlock()
	best := l.servers[0]
	for _, s := range l.servers {
		if s.ActiveConnections < best.ActiveConnections {
			best = s
		}
	}
	best.ActiveConnections++
	return best
}

func (l *LeastConnections) Release(s *Server) {
	l.mu.Lock()
	defer l.mu.Unlock()
	s.ActiveConnections--
}

func pool() []*Server {
	return []*Server{{Name: "A", Weight: 5}, {Name: "B", Weight: 1}, {Name: "C", Weight: 1}}
}

func main() {
	var rr Balancer = &RoundRobin{servers: pool()}
	var wrr Balancer = NewWeightedRoundRobin(pool())
	var a, b strings.Builder
	for i := 0; i < 7; i++ {
		a.WriteString(rr.Pick().Name)
		b.WriteString(wrr.Pick().Name)
	}
	fmt.Println("Round robin:         ", a.String()) // ABCABCA
	fmt.Println("Weighted round robin:", b.String()) // AABACAA

	var lc Balancer = &LeastConnections{servers: pool()}
	s1, s2, s3 := lc.Pick(), lc.Pick(), lc.Pick()
	lc.Release(s2) // B finishes its request first
	fmt.Println("Least connections:   ", s1.Name+s2.Name+s3.Name, "then", lc.Pick().Name) // ABC then B
}
`,
    },
  },
  diagrams: {
    what: String.raw`flowchart LR
      U1[Mobile app] --> LB["Load balancer"]
      U2[Browser] --> LB
      U3[Partner API] --> LB
      LB --> S1[App server 1]
      LB --> S2[App server 2]
      LB --> S3[App server 3]
      S1 --> R[("Redis sessions")]
      S2 --> R
      S3 --> R
      S1 --> DB[(Database)]
      S2 --> DB
      S3 --> DB`,
    health: String.raw`sequenceDiagram
      participant LB as Load balancer
      participant S2 as Server 2
      LB->>S2: GET /health
      S2-->>LB: 200 OK
      LB->>S2: GET /health
      S2--xLB: timeout (fail 1)
      LB->>S2: GET /health
      S2--xLB: timeout (fail 2)
      LB->>S2: GET /health
      S2--xLB: timeout (fail 3)
      Note over LB: Mark S2 unhealthy, stop routing
      LB->>S2: GET /health
      S2-->>LB: 200 OK (pass 1)
      LB->>S2: GET /health
      S2-->>LB: 200 OK (pass 2)
      Note over LB: Mark S2 healthy, route again`,
    gslb: String.raw`flowchart TB
      U[User in Pune] --> DNS["GeoDNS / Anycast"]
      DNS -->|nearest healthy| M["Mumbai region LB"]
      DNS -.->|failover| S["Singapore region LB"]
      M --> M1[Server]
      M --> M2[Server]
      S --> S1[Server]
      S --> S2[Server]`,
  },
});
