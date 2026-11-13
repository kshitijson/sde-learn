SD.register({
  id: "tcp-udp",
  html: String.raw`
    <p class="lead">TCP and UDP are the two transport protocols almost every application uses. Both carry your bytes between two programs over IP, but they make opposite promises. TCP gives you a reliable, ordered stream of bytes over a connection, and pays for it with a handshake, acknowledgements and retransmissions. UDP just sends independent packets (datagrams) with no promises at all, which makes it light and fast. Web pages, APIs and databases run on TCP. DNS, video calls, online games and QUIC (the base of HTTP/3) run on UDP. Knowing why is a favourite SDE 1 interview question.</p>

    <h2>What they are</h2>
    <p>The internet delivers <strong>IP packets</strong> from one machine to another on a best-effort basis: packets can be lost, duplicated, delayed or arrive out of order. The <strong>transport layer</strong> sits on top of IP and adds two things: <strong>ports</strong> (so many programs on one machine can share the network) and, optionally, <strong>reliability</strong>.</p>
    <div data-diagram="stack" data-caption="Where TCP and UDP sit. Application protocols pick one of them; both ride on IP."></div>
    <div class="grid-2">
      <div class="card"><strong>TCP (Transmission Control Protocol)</strong><ul><li>Connection-oriented: a handshake first</li><li>Reliable: lost data is re-sent</li><li>Ordered byte stream: no message boundaries</li><li>Flow and congestion control built in</li><li>Header 20 to 60 bytes</li></ul></div>
      <div class="card"><strong>UDP (User Datagram Protocol)</strong><ul><li>Connectionless: just send</li><li>No delivery, order or duplicate guarantees</li><li>Message-oriented: each datagram stands alone</li><li>No flow or congestion control</li><li>Header 8 bytes</li></ul></div>
    </div>

    <h3>Ports and sockets</h3>
    <p>An IP address finds the machine; a <strong>port</strong> (a 16-bit number, 0 to 65535) finds the program on it. Well-known ports: 80 (HTTP), 443 (HTTPS), 22 (SSH), 53 (DNS), 5432 (PostgreSQL), 3306 (MySQL), 6379 (Redis). When your browser connects, the OS gives it a random <strong>ephemeral port</strong> (on Linux, 32768 to 60999 by default).</p>
    <p>A <strong>socket</strong> is the operating system's handle for one end of the conversation. A TCP connection is identified by a <strong>4-tuple</strong>: (source IP, source port, destination IP, destination port). That is why one server port 443 can hold a million connections at once: each one differs in the client IP or client port. The limit is memory and file descriptors, not ports.</p>
    <div class="callout info"><strong>Jargon</strong><strong>Segment</strong>: a TCP packet. <strong>Datagram</strong>: a UDP packet. <strong>RTT</strong> (round-trip time): time for a packet to go and a reply to come back, for example about 20 to 40 ms between Mumbai and Chennai, about 60 ms between Mumbai and Singapore, and about 200 ms between Mumbai and the US East Coast. <strong>MSS</strong>: the largest payload in one segment, usually about 1460 bytes on Ethernet.</div>

    <h2>How TCP works</h2>
    <h3>The 3-way handshake</h3>
    <p>Before any data flows, the client and server agree to talk and exchange their starting <strong>sequence numbers</strong> (random 32-bit numbers that label every byte, so the receiver can put bytes in order and spot gaps).</p>
    <div data-diagram="handshake" data-caption="TCP 3-way handshake: one full round trip before the client can send its request."></div>
    <ol class="steps">
      <li><strong>SYN</strong>: client says "I want to connect, my sequence number starts at x".</li>
      <li><strong>SYN-ACK</strong>: server says "OK, I got x, mine starts at y".</li>
      <li><strong>ACK</strong>: client confirms y. The client can put its first data (the HTTP request) in the same packet as this ACK.</li>
    </ol>
    <p>Cost: <strong>1 RTT</strong> before the first byte of the request leaves. On a 100 ms mobile link, that is 100 ms of nothing. Add TLS on top and you pay more (see <a href="#/p/url-to-page">What happens when you type a URL</a>). This is why connection reuse (keep-alive, connection pools) matters so much.</p>

    <h3>Reliability: ACKs and retransmission</h3>
    <p>The receiver sends <strong>acknowledgements</strong> saying "I have every byte up to N". If the sender does not get an ACK within the <strong>retransmission timeout</strong> (RTO, computed from measured RTT, at least 200 ms on Linux and 1 s by the RFC), it sends the data again. Three duplicate ACKs for the same byte trigger a <strong>fast retransmit</strong> without waiting for the timer. A checksum catches corrupted segments, which are dropped and re-sent.</p>

    <h3>Ordering</h3>
    <p>Because every byte has a sequence number, the receiver holds back out-of-order segments in a buffer and hands bytes to the application only in order. Your <code>read()</code> call never sees a gap. This is great for correctness and is also the source of <strong>head-of-line blocking</strong> (below).</p>

    <h3>Flow control</h3>
    <p>Flow control stops a fast sender from overwhelming a slow <em>receiver</em>. Each ACK carries a <strong>receive window</strong> (rwnd): "I have this many bytes of buffer free". The sender never has more unacknowledged bytes in flight than that. If the app stops reading, the window drops to zero and the sender pauses.</p>

    <h3>Congestion control</h3>
    <p>Congestion control stops senders from overwhelming the <em>network</em> (routers in between). The sender keeps a <strong>congestion window</strong> (cwnd) and sends at most min(cwnd, rwnd) unacknowledged bytes.</p>
    <ul>
      <li><strong>Slow start</strong>: a new connection starts with cwnd of 10 segments (about 14 KB) and doubles it every RTT until loss or a threshold. So a fresh connection cannot use full bandwidth at once; a 1 MB download needs several round trips just to ramp up.</li>
      <li><strong>Congestion avoidance</strong>: after the threshold, grow by about one segment per RTT (additive increase); on loss, cut sharply (multiplicative decrease). This is AIMD.</li>
      <li><strong>Algorithms</strong>: CUBIC is the Linux default. Google's <strong>BBR</strong> estimates bandwidth and RTT instead of reacting to loss, and does better on lossy mobile and long-distance links; YouTube and Google services use it.</li>
    </ul>
    <div class="callout tip"><strong>Flow vs congestion control</strong>Flow control protects the receiver (rwnd, advertised by the receiver). Congestion control protects the network (cwnd, guessed by the sender). Interviewers like to check you know the difference.</div>

    <h3>Closing: the 4-way teardown and TIME_WAIT</h3>
    <p>TCP is full duplex, so each direction is closed separately. Each side sends a <strong>FIN</strong> and the other side ACKs it: FIN, ACK, FIN, ACK. (The middle ACK and FIN are often combined, so you may see three packets.)</p>
    <div data-diagram="teardown" data-caption="4-way teardown. The side that closes first waits in TIME_WAIT before the port pair can be reused."></div>
    <p>The side that closes first enters <strong>TIME_WAIT</strong> for 2 × MSL (maximum segment lifetime). On Linux this is fixed at 60 seconds. It makes sure the final ACK can be re-sent if it was lost, and that stray old packets from this connection die out before a new connection reuses the same 4-tuple.</p>
    <div class="callout warn"><strong>TIME_WAIT in production</strong>A service that opens a new outbound connection per request (for example, an API server calling a payment gateway without a pool) piles up tens of thousands of sockets in TIME_WAIT and can run out of ephemeral ports to that one destination: about 28,000 ports ÷ 60 s ≈ 470 new connections per second. Fixes: <strong>reuse connections</strong> (HTTP keep-alive, connection pools), enable <code>tcp_tw_reuse</code> for outbound connections, or spread across more destination IPs.</div>

    <h2>How UDP works</h2>
    <p>UDP adds almost nothing to IP: source port, destination port, length and checksum. That is the whole 8-byte header. There is no handshake, so the first datagram carries data immediately. There are no ACKs, so the sender never knows if it arrived. Each <code>send()</code> becomes exactly one datagram and each <code>recv()</code> returns exactly one datagram, so message boundaries are kept (unlike TCP's byte stream).</p>
    <p>A UDP datagram can be up to about 64 KB, but anything larger than the path MTU (about 1500 bytes on Ethernet) is fragmented by IP, and losing one fragment loses the whole datagram. Real protocols keep datagrams under about 1200 to 1400 bytes.</p>
    <p>If the application needs reliability, it builds just the parts it wants on top: sequence numbers to detect loss and reorder, selective retransmission, forward error correction (FEC, sending extra parity data so lost packets can be rebuilt without a retransmit). QUIC is exactly this: a full reliable, encrypted, multiplexed transport built in user space on UDP.</p>

    <h2>Head-of-line blocking</h2>
    <p>TCP delivers bytes strictly in order. If segment 3 is lost, segments 4, 5 and 6 may already have arrived, but the application cannot read any of them until segment 3 is re-sent and arrives, at least one more RTT later. Everything queued behind the lost packet waits: <strong>head-of-line (HOL) blocking</strong>.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 250">
        <text class="s-title" x="20" y="28">TCP: one ordered stream</text>
        <rect class="s-green" x="20" y="44" width="70" height="40" rx="10"/><text class="s-text" x="55" y="69" text-anchor="middle">1</text>
        <rect class="s-green" x="100" y="44" width="70" height="40" rx="10"/><text class="s-text" x="135" y="69" text-anchor="middle">2</text>
        <rect class="s-red" x="180" y="44" width="70" height="40" rx="10"/><text class="s-text" x="215" y="69" text-anchor="middle">3 lost</text>
        <rect class="s-amber" x="260" y="44" width="70" height="40" rx="10"/><text class="s-text" x="295" y="69" text-anchor="middle">4</text>
        <rect class="s-amber" x="340" y="44" width="70" height="40" rx="10"/><text class="s-text" x="375" y="69" text-anchor="middle">5</text>
        <rect class="s-amber" x="420" y="44" width="70" height="40" rx="10"/><text class="s-text" x="455" y="69" text-anchor="middle">6</text>
        <text class="s-muted" x="20" y="108">4, 5, 6 arrived but wait in the buffer until 3 is re-sent (+1 RTT or more)</text>
        <text class="s-title" x="20" y="150">UDP / QUIC: independent packets or streams</text>
        <rect class="s-green" x="20" y="166" width="70" height="40" rx="10"/><text class="s-text" x="55" y="191" text-anchor="middle">1</text>
        <rect class="s-green" x="100" y="166" width="70" height="40" rx="10"/><text class="s-text" x="135" y="191" text-anchor="middle">2</text>
        <rect class="s-red" x="180" y="166" width="70" height="40" rx="10"/><text class="s-text" x="215" y="191" text-anchor="middle">3 lost</text>
        <rect class="s-green" x="260" y="166" width="70" height="40" rx="10"/><text class="s-text" x="295" y="191" text-anchor="middle">4</text>
        <rect class="s-green" x="340" y="166" width="70" height="40" rx="10"/><text class="s-text" x="375" y="191" text-anchor="middle">5</text>
        <rect class="s-green" x="420" y="166" width="70" height="40" rx="10"/><text class="s-text" x="455" y="191" text-anchor="middle">6</text>
        <text class="s-muted" x="20" y="230">4, 5, 6 are used right away; 3 is skipped (video) or re-sent alone (QUIC)</text>
        <rect class="s-box" x="510" y="44" width="110" height="40" rx="10"/><text class="s-muted" x="565" y="69" text-anchor="middle">app blocked</text>
        <rect class="s-box" x="510" y="166" width="110" height="40" rx="10"/><text class="s-muted" x="565" y="191" text-anchor="middle">app keeps going</text>
        <line class="s-line" x1="492" y1="64" x2="508" y2="64" marker-end="url(#arrow)"/>
        <line class="s-line" x1="492" y1="186" x2="508" y2="186" marker-end="url(#arrow)"/>
      </svg>
      <figcaption>Head-of-line blocking: with TCP one lost segment stalls everything behind it; with UDP the app decides what to do.</figcaption>
    </figure>
    <p>This matters in two places in system design. First, HTTP/2 multiplexes many requests over one TCP connection, so one lost packet stalls <em>all</em> of them; HTTP/3 moved to QUIC over UDP to fix exactly this (see <a href="#/p/http-versions">HTTP versions</a>). Second, real-time media: a video frame that arrives 300 ms late is useless, so waiting for it makes things worse.</p>

    <h2>Why video calls and games use UDP</h2>
    <p>On a Google Meet or WhatsApp call, audio is sent as small packets every 20 ms. Suppose one packet is lost:</p>
    <ul>
      <li><strong>With TCP</strong>: the stream freezes until the lost packet is re-sent (at least one RTT, often 100 to 300 ms on mobile). Every later packet queues behind it. The call stutters and the delay grows. Worse, TCP's congestion control halves its sending rate on the loss.</li>
      <li><strong>With UDP</strong>: the app just plays the next packet. The codec hides the 20 ms gap (packet loss concealment), or FEC rebuilds it. The user hears maybe a tiny glitch, and latency stays low.</li>
    </ul>
    <p>For live interaction, <strong>fresh data beats complete data</strong>. WebRTC (used by Google Meet, and the same ideas power WhatsApp, Zoom and Microsoft Teams calls) sends media over RTP on UDP, with its own congestion control that lowers video bitrate instead of freezing. It falls back to TCP or a TURN relay over TCP/TLS on port 443 only when a corporate firewall blocks UDP, and quality drops when that happens.</p>
    <p>Multiplayer games such as BGMI or Valorant are similar: the server sends the world state 20 to 128 times a second, and a lost update is replaced by the next one, so re-sending old positions is pointless. Games build light reliability on UDP only for things that must arrive, like "player bought item".</p>
    <div class="callout tip"><strong>Not all video is UDP</strong>Recorded video (YouTube, Netflix, Hotstar on-demand) streams over HTTP on TCP (or QUIC) in chunks, with a buffer of several seconds. A lost packet is re-sent long before the buffer runs out, so reliability wins. UDP matters for <em>live, interactive</em> media where there is no buffer to hide behind.</div>

    <h2>Use cases</h2>
    <table>
      <thead><tr><th>Use case</th><th>Protocol</th><th>Why</th></tr></thead>
      <tbody>
        <tr><td>Web pages, REST and gRPC APIs (HTTP/1.1, HTTP/2)</td><td>TCP</td><td>Every byte must arrive in order; a missing byte corrupts JSON</td></tr>
        <tr><td>Databases (MySQL, PostgreSQL, Redis, Kafka)</td><td>TCP</td><td>Correctness is everything; long-lived pooled connections hide the handshake cost</td></tr>
        <tr><td>Email (SMTP), file transfer, SSH</td><td>TCP</td><td>Reliable delivery of every byte</td></tr>
        <tr><td>DNS lookups</td><td>UDP (TCP for large answers or zone transfers)</td><td>One small question and one small answer; a handshake would double the time. The client simply retries on timeout</td></tr>
        <tr><td>Video and voice calls (WebRTC, Meet, WhatsApp calls)</td><td>UDP</td><td>Low latency; late packets are useless; no HOL blocking</td></tr>
        <tr><td>Online games</td><td>UDP</td><td>Frequent state updates; the newest one replaces the old</td></tr>
        <tr><td>HTTP/3 (QUIC)</td><td>UDP</td><td>Builds its own reliability per stream, avoids TCP HOL blocking, can evolve without OS upgrades</td></tr>
        <tr><td>Live streaming ingest, IPTV multicast</td><td>UDP (SRT, RTP)</td><td>Low latency, multicast support</td></tr>
        <tr><td>Metrics (StatsD), syslog, DHCP, NTP</td><td>UDP</td><td>Fire and forget; losing one sample is fine; cheap at high volume</td></tr>
      </tbody>
    </table>

    <h2>Trade-offs side by side</h2>
    <table>
      <thead><tr><th>Property</th><th>TCP</th><th>UDP</th></tr></thead>
      <tbody>
        <tr><td>Connection setup</td><td>3-way handshake (1 RTT)</td><td>None (0 RTT)</td></tr>
        <tr><td>Delivery</td><td>Guaranteed, or the connection reports an error</td><td>Best effort; loss is silent</td></tr>
        <tr><td>Ordering</td><td>In order</td><td>Any order</td></tr>
        <tr><td>Data model</td><td>Byte stream (you must frame messages yourself)</td><td>Discrete datagrams</td></tr>
        <tr><td>Flow / congestion control</td><td>Yes / yes</td><td>No / no (app must be polite)</td></tr>
        <tr><td>Header size</td><td>20 to 60 bytes</td><td>8 bytes</td></tr>
        <tr><td>Server state</td><td>Per-connection buffers and timers</td><td>None per peer</td></tr>
        <tr><td>Broadcast / multicast</td><td>No</td><td>Yes</td></tr>
        <tr><td>Head-of-line blocking</td><td>Yes</td><td>No</td></tr>
      </tbody>
    </table>
    <div class="callout warn"><strong>The TCP byte stream trap</strong>TCP has no message boundaries. Two <code>send("hello")</code> calls can arrive as one <code>recv("hellohello")</code>, or one send can arrive in three pieces. Every protocol on TCP adds framing: a newline (as in the code below), a length prefix (Kafka, gRPC, Redis RESP bulk strings), or headers with <code>Content-Length</code> (HTTP).</div>

    <h2>Code: echo servers</h2>
    <p>Each program starts a server on <code>127.0.0.1</code> with port 0 (the OS picks a free ephemeral port), runs a client against it in the same process, prints the replies and exits. Notice the API differences: TCP has <code>listen</code>, <code>accept</code> and <code>connect</code> (the handshake), and needs line framing on the byte stream. UDP only binds, and each receive is one whole datagram.</p>
    <h3>TCP echo</h3>
    <div data-code="echo"></div>
    <h3>UDP echo</h3>
    <p>The client sets a receive timeout because UDP will never tell it a datagram was lost. On loopback nothing is lost, but on a real network that timeout plus a retry is how DNS clients work.</p>
    <div data-code="udp"></div>

    <h2>Real-world examples</h2>
    <ul>
      <li><strong>HTTP/3 and QUIC</strong>: Google, YouTube, Meta and Cloudflare serve a large share of traffic over QUIC on UDP port 443. Browsers fall back to TCP if UDP is blocked.</li>
      <li><strong>DNS</strong>: your phone's resolver sends a single UDP datagram to port 53 and retries after a timeout. Answers larger than 512 bytes (or the EDNS size, often 1232 bytes) set a "truncated" flag and the client retries over TCP.</li>
      <li><strong>Stock market feeds</strong>: exchanges such as NSE send tick-by-tick market data to brokers over UDP multicast for speed. Brokers like Zerodha then push prices to the Kite app over WebSockets on TCP, because the public internet does not route multicast.</li>
      <li><strong>Connection pools</strong>: every backend at Flipkart or Swiggy keeps pooled TCP connections to MySQL, Redis and downstream services, so the handshake and slow start are paid once, not per request.</li>
    </ul>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"Clients talk to our API over HTTPS, so TCP (or QUIC for HTTP/3). Service-to-service calls use pooled keep-alive connections to avoid paying the handshake and slow start per request."</li>
        <li>"For the live video call feature I'd use WebRTC over UDP: a late frame is useless, and TCP retransmission would cause freezes due to head-of-line blocking. The codec handles loss with concealment and FEC."</li>
        <li>"UDP gives no guarantees, so anything that must arrive (like a 'call ended' signal) goes over a reliable channel, such as the WebSocket signalling connection."</li>
        <li>"DNS uses UDP because it is one tiny request and response; the handshake would double the lookup time, and retrying is cheap."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Saying "UDP is faster" without explaining why (no handshake, no HOL blocking, no retransmit wait; bandwidth is the same). Saying video streaming always uses UDP (on-demand video is HTTP on TCP or QUIC). Forgetting that TCP is a byte stream that needs framing. Opening a new TCP connection per request at high QPS.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Walk through the TCP 3-way handshake. How much latency does it add?</summary><div>Client sends SYN with its initial sequence number, server replies SYN-ACK with its own, client sends ACK (and can piggyback the first request data). It costs one RTT before the request goes out: about 100 ms on a typical Indian 4G connection to a nearby region, more for far-away servers.</div></details>
      <details><summary>What is the difference between flow control and congestion control?</summary><div>Flow control protects the receiver: the receiver advertises a window (rwnd) of free buffer space. Congestion control protects the network: the sender keeps its own congestion window (cwnd), grows it with slow start and AIMD, and shrinks it on loss. The sender is limited by the smaller of the two.</div></details>
      <details><summary>Why does a WhatsApp or Google Meet call use UDP instead of TCP?</summary><div>Real-time audio and video care about low latency more than completeness. With TCP, one lost packet blocks all later packets until it is re-sent (head-of-line blocking), causing freezes, and congestion control slashes the rate. Over UDP the app skips the lost packet, hides the gap with concealment or FEC, and adapts bitrate itself.</div></details>
      <details><summary>A service makes 2,000 new outbound HTTPS connections per second to one partner API and starts failing with "cannot assign requested address". Why?</summary><div>Ephemeral port exhaustion caused by TIME_WAIT. Each closed connection holds its 4-tuple for 60 s on Linux, so with about 28,000 ephemeral ports the service can open only about 470 new connections per second to the same destination IP and port. Use a keep-alive connection pool (best), widen the port range, or enable <code>tcp_tw_reuse</code>.</div></details>
      <details><summary>How can a server on port 443 handle a million simultaneous TCP connections when there are only 65,536 ports?</summary><div>A connection is identified by the 4-tuple (client IP, client port, server IP, server port). All connections share server port 443 but differ in client IP or client port, so the port number is not the limit. Memory per socket, file descriptor limits and CPU are.</div></details>
      <details><summary>If UDP has no reliability, how does QUIC (HTTP/3) deliver web pages correctly?</summary><div>QUIC implements reliability itself on top of UDP: packet numbers, ACKs, retransmission, flow and congestion control, and TLS 1.3 encryption. The difference from TCP is that it tracks loss per stream, so a lost packet only blocks the one stream it belongs to, and it runs in user space so it can be updated without changing operating systems.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>TCP: connection, reliable, ordered byte stream, flow and congestion control. Costs a 1-RTT handshake and suffers head-of-line blocking.</li>
      <li>UDP: connectionless, 8-byte header, no guarantees, keeps message boundaries. The app adds only the reliability it needs.</li>
      <li>Flow control protects the receiver (rwnd); congestion control protects the network (cwnd, slow start, AIMD, CUBIC, BBR).</li>
      <li>Teardown is FIN/ACK in each direction; the closer sits in TIME_WAIT (60 s on Linux). Reuse connections to avoid port exhaustion.</li>
      <li>Web, APIs and databases use TCP. DNS, live calls, games, metrics and QUIC (HTTP/3) use UDP.</li>
      <li>Live media prefers UDP because fresh beats complete; on-demand video uses HTTP over TCP or QUIC with a buffer.</li>
    </ul></div>
  `,
  code: {
    echo: {
      title: "TCP echo server and client on localhost (one process)",
      java: String.raw`import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

public class Main {
    public static void main(String[] args) throws Exception {
        // Port 0 = let the OS pick a free ephemeral port. Bind to loopback only.
        try (ServerSocket server = new ServerSocket(0, 50, InetAddress.getLoopbackAddress())) {
            int port = server.getLocalPort();
            System.out.println("server listening on 127.0.0.1:" + port);

            Thread serverThread = new Thread(() -> {
                // accept() completes once the client's 3-way handshake is done
                try (Socket conn = server.accept();
                     BufferedReader in = new BufferedReader(
                         new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                     PrintWriter out = new PrintWriter(conn.getOutputStream(), true, StandardCharsets.UTF_8)) {
                    String line;
                    while ((line = in.readLine()) != null) {  // null = client closed (FIN)
                        out.println("echo: " + line);
                    }
                } catch (IOException e) {
                    System.out.println("server error: " + e.getMessage());
                }
            });
            serverThread.start();

            // Client: connect() performs SYN, SYN-ACK, ACK
            try (Socket client = new Socket(InetAddress.getLoopbackAddress(), port);
                 BufferedReader in = new BufferedReader(
                     new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8));
                 PrintWriter out = new PrintWriter(client.getOutputStream(), true, StandardCharsets.UTF_8)) {
                System.out.println("client local port " + client.getLocalPort() + " -> server port " + port);
                for (String msg : new String[] {"hello", "order #42", "bye"}) {
                    out.println(msg);
                    System.out.println("client got: " + in.readLine());
                }
            } // close() sends FIN; the server's readLine() returns null
            serverThread.join();
            System.out.println("done");
        }
    }
}
`,
      python: String.raw`import socket
import threading


def serve(server: socket.socket) -> None:
    conn, addr = server.accept()  # returns after the client's 3-way handshake
    with conn, conn.makefile("r", encoding="utf-8") as reader:
        for line in reader:  # loop ends when the client closes (FIN)
            conn.sendall(("echo: " + line).encode("utf-8"))


def main() -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)  # TCP
    server.bind(("127.0.0.1", 0))  # port 0 = OS picks a free ephemeral port
    server.listen()
    port = server.getsockname()[1]
    print(f"server listening on 127.0.0.1:{port}")
    t = threading.Thread(target=serve, args=(server,))
    t.start()

    # create_connection does SYN, SYN-ACK, ACK
    with socket.create_connection(("127.0.0.1", port), timeout=2) as client, \
            client.makefile("r", encoding="utf-8") as reader:
        print(f"client local port {client.getsockname()[1]} -> server port {port}")
        for msg in ["hello", "order #42", "bye"]:
            client.sendall((msg + "\n").encode("utf-8"))
            print("client got:", reader.readline().rstrip("\n"))
    # leaving the with-block closes the socket and sends FIN
    t.join()
    server.close()
    print("done")


if __name__ == "__main__":
    main()
`,
      cpp: String.raw`// POSIX sockets (Linux/macOS). Build: g++ -std=c++17 -pthread echo.cpp
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <cstdio>
#include <iostream>
#include <string>
#include <thread>

// Read until '\n' (TCP is a byte stream: one send() may arrive as several recv()s)
static bool readLine(int fd, std::string& out) {
    out.clear();
    char c;
    while (true) {
        ssize_t n = recv(fd, &c, 1, 0);
        if (n <= 0) return !out.empty();  // 0 = peer closed (FIN)
        if (c == '\n') return true;
        out.push_back(c);
    }
}

static void sendAll(int fd, const std::string& s) {
    size_t sent = 0;
    while (sent < s.size()) {
        ssize_t n = send(fd, s.data() + sent, s.size() - sent, 0);
        if (n <= 0) return;
        sent += static_cast<size_t>(n);
    }
}

int main() {
    int server = socket(AF_INET, SOCK_STREAM, 0);  // TCP
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);  // 127.0.0.1
    addr.sin_port = 0;                              // OS picks a free ephemeral port
    if (bind(server, reinterpret_cast<sockaddr*>(&addr), sizeof addr) < 0 || listen(server, 16) < 0) {
        perror("bind/listen");
        return 1;
    }
    socklen_t len = sizeof addr;
    getsockname(server, reinterpret_cast<sockaddr*>(&addr), &len);
    int port = ntohs(addr.sin_port);
    std::cout << "server listening on 127.0.0.1:" << port << "\n";

    std::thread serverThread([server] {
        int conn = accept(server, nullptr, nullptr);  // returns after the 3-way handshake
        if (conn < 0) return;
        std::string line;
        while (readLine(conn, line)) sendAll(conn, "echo: " + line + "\n");
        close(conn);
    });

    int client = socket(AF_INET, SOCK_STREAM, 0);
    if (connect(client, reinterpret_cast<sockaddr*>(&addr), sizeof addr) < 0) {  // SYN, SYN-ACK, ACK
        perror("connect");
        return 1;
    }
    sockaddr_in local{};
    socklen_t llen = sizeof local;
    getsockname(client, reinterpret_cast<sockaddr*>(&local), &llen);
    std::cout << "client local port " << ntohs(local.sin_port) << " -> server port " << port << "\n";

    for (const char* msg : {"hello", "order #42", "bye"}) {
        sendAll(client, std::string(msg) + "\n");
        std::string reply;
        readLine(client, reply);
        std::cout << "client got: " << reply << "\n";
    }
    close(client);  // sends FIN; server's recv() returns 0
    serverThread.join();
    close(server);
    std::cout << "done\n";
}
`,
      javascript: String.raw`// Node.js: TCP echo server + client in one process, using the built-in "net" module.
const net = require("net");
const readline = require("readline");

const server = net.createServer((conn) => {
  // Called once per connection, after the 3-way handshake
  const lines = readline.createInterface({ input: conn });
  lines.on("line", (line) => conn.write("echo: " + line + "\n"));
  conn.on("end", () => conn.end()); // client sent FIN: close our side too
});

server.listen(0, "127.0.0.1", async () => {
  const { port } = server.address(); // port 0 = OS picked a free ephemeral port
  console.log("server listening on 127.0.0.1:" + port);

  const client = net.connect(port, "127.0.0.1"); // SYN, SYN-ACK, ACK
  await new Promise((resolve) => client.once("connect", resolve));
  console.log("client local port " + client.localPort + " -> server port " + port);

  const replies = readline.createInterface({ input: client })[Symbol.asyncIterator]();
  for (const msg of ["hello", "order #42", "bye"]) {
    client.write(msg + "\n");
    const { value } = await replies.next();
    console.log("client got: " + value);
  }
  client.end(); // sends FIN
  client.on("close", () => server.close(() => console.log("done")));
});
`,
      go: String.raw`package main

import (
	"bufio"
	"fmt"
	"net"
	"sync"
)

func main() {
	// ":0" style port = OS picks a free ephemeral port; bind to loopback only.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		panic(err)
	}
	defer ln.Close()
	fmt.Println("server listening on", ln.Addr())

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		conn, err := ln.Accept() // returns after the client's 3-way handshake
		if err != nil {
			return
		}
		defer conn.Close()
		sc := bufio.NewScanner(conn)
		for sc.Scan() { // stops when the client closes (FIN)
			fmt.Fprintf(conn, "echo: %s\n", sc.Text())
		}
	}()

	client, err := net.Dial("tcp", ln.Addr().String()) // SYN, SYN-ACK, ACK
	if err != nil {
		panic(err)
	}
	fmt.Println("client", client.LocalAddr(), "->", client.RemoteAddr())
	reader := bufio.NewReader(client)
	for _, msg := range []string{"hello", "order #42", "bye"} {
		fmt.Fprintln(client, msg)
		reply, _ := reader.ReadString('\n')
		fmt.Print("client got: ", reply)
	}
	client.Close() // sends FIN; the server's Scan() returns false
	wg.Wait()
	fmt.Println("done")
}
`,
    },
    udp: {
      title: "UDP echo server and client on localhost (one process)",
      java: String.raw`import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;

public class Main {
    public static void main(String[] args) throws Exception {
        InetAddress loopback = InetAddress.getLoopbackAddress();
        try (DatagramSocket server = new DatagramSocket(0, loopback);
             DatagramSocket client = new DatagramSocket(0, loopback)) {
            int port = server.getLocalPort();
            System.out.println("server bound to 127.0.0.1:" + port + " (no listen, no accept)");
            String[] messages = {"ping 1", "ping 2", "ping 3"};

            Thread serverThread = new Thread(() -> {
                byte[] buf = new byte[1500];  // one datagram fits one Ethernet MTU here
                try {
                    server.setSoTimeout(2000);  // never block forever if a datagram is lost
                    for (int i = 0; i < messages.length; i++) {
                        DatagramPacket pkt = new DatagramPacket(buf, buf.length);
                        server.receive(pkt);  // each receive = exactly one datagram
                        String text = new String(pkt.getData(), 0, pkt.getLength(), StandardCharsets.UTF_8);
                        byte[] reply = ("echo: " + text).getBytes(StandardCharsets.UTF_8);
                        // Reply to whatever address the datagram came from
                        server.send(new DatagramPacket(reply, reply.length, pkt.getSocketAddress()));
                    }
                } catch (Exception e) {
                    System.out.println("server error: " + e.getMessage());
                }
            });
            serverThread.start();

            client.setSoTimeout(1000);  // UDP never tells you a packet was lost: use a timeout
            byte[] buf = new byte[1500];
            for (String msg : messages) {
                byte[] data = msg.getBytes(StandardCharsets.UTF_8);
                client.send(new DatagramPacket(data, data.length, loopback, port));
                DatagramPacket reply = new DatagramPacket(buf, buf.length);
                try {
                    client.receive(reply);
                    System.out.println("client got: "
                        + new String(reply.getData(), 0, reply.getLength(), StandardCharsets.UTF_8));
                } catch (SocketTimeoutException e) {
                    System.out.println("timed out: datagram or reply lost, app decides whether to retry");
                }
            }
            serverThread.join();
            System.out.println("done");
        }
    }
}
`,
      python: String.raw`import socket
import threading

MESSAGES = ["ping 1", "ping 2", "ping 3"]


def serve(server: socket.socket) -> None:
    server.settimeout(2.0)  # never block forever if a datagram is lost
    for _ in MESSAGES:
        try:
            data, addr = server.recvfrom(1500)  # one call = exactly one datagram
        except socket.timeout:
            return
        server.sendto(b"echo: " + data, addr)  # reply to the sender's address


def main() -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)  # UDP
    server.bind(("127.0.0.1", 0))  # no listen(), no accept(): there is no connection
    port = server.getsockname()[1]
    print(f"server bound to 127.0.0.1:{port} (no listen, no accept)")
    t = threading.Thread(target=serve, args=(server,))
    t.start()

    client = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    client.settimeout(1.0)  # UDP never reports loss: the app needs its own timeout
    for msg in MESSAGES:
        client.sendto(msg.encode("utf-8"), ("127.0.0.1", port))
        try:
            data, _ = client.recvfrom(1500)
            print("client got:", data.decode("utf-8"))
        except socket.timeout:
            print("timed out: datagram or reply lost, app decides whether to retry")
    t.join()
    client.close()
    server.close()
    print("done")


if __name__ == "__main__":
    main()
`,
      cpp: String.raw`// POSIX sockets (Linux/macOS). Build: g++ -std=c++17 -pthread udp.cpp
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

#include <cstdio>
#include <iostream>
#include <string>
#include <thread>

static void setTimeout(int fd, int seconds) {
    timeval tv{};
    tv.tv_sec = seconds;
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
}

int main() {
    const char* messages[] = {"ping 1", "ping 2", "ping 3"};
    int server = socket(AF_INET, SOCK_DGRAM, 0);  // UDP
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = 0;
    if (bind(server, reinterpret_cast<sockaddr*>(&addr), sizeof addr) < 0) {  // no listen(), no accept()
        perror("bind");
        return 1;
    }
    socklen_t len = sizeof addr;
    getsockname(server, reinterpret_cast<sockaddr*>(&addr), &len);
    std::cout << "server bound to 127.0.0.1:" << ntohs(addr.sin_port) << " (no listen, no accept)\n";

    std::thread serverThread([server] {
        setTimeout(server, 2);  // never block forever if a datagram is lost
        char buf[1500];
        for (int i = 0; i < 3; i++) {
            sockaddr_in from{};
            socklen_t flen = sizeof from;
            ssize_t n = recvfrom(server, buf, sizeof buf, 0, reinterpret_cast<sockaddr*>(&from), &flen);
            if (n < 0) return;  // timeout
            std::string reply = "echo: " + std::string(buf, static_cast<size_t>(n));
            sendto(server, reply.data(), reply.size(), 0, reinterpret_cast<sockaddr*>(&from), flen);
        }
    });

    int client = socket(AF_INET, SOCK_DGRAM, 0);
    setTimeout(client, 1);  // UDP never reports loss: the app needs its own timeout
    char buf[1500];
    for (const char* msg : messages) {
        std::string m(msg);
        sendto(client, m.data(), m.size(), 0, reinterpret_cast<sockaddr*>(&addr), sizeof addr);
        ssize_t n = recvfrom(client, buf, sizeof buf, 0, nullptr, nullptr);
        if (n < 0) std::cout << "timed out: datagram or reply lost, app decides whether to retry\n";
        else std::cout << "client got: " << std::string(buf, static_cast<size_t>(n)) << "\n";
    }
    serverThread.join();
    close(client);
    close(server);
    std::cout << "done\n";
}
`,
      javascript: String.raw`// Node.js: UDP echo server + client in one process, using the built-in "dgram" module.
const dgram = require("dgram");

const messages = ["ping 1", "ping 2", "ping 3"];
const server = dgram.createSocket("udp4");
const client = dgram.createSocket("udp4");

server.on("message", (msg, rinfo) => {
  // Each event = exactly one datagram; reply to the sender's address
  server.send("echo: " + msg.toString(), rinfo.port, rinfo.address);
});

// Send one datagram and wait for one reply, with a timeout (UDP never reports loss)
function request(port, text) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      client.removeListener("message", onMessage);
      resolve(null);
    }, 1000);
    function onMessage(reply) {
      clearTimeout(timer);
      resolve(reply.toString());
    }
    client.once("message", onMessage);
    client.send(text, port, "127.0.0.1");
  });
}

server.bind(0, "127.0.0.1", async () => { // no listen/accept: there is no connection
  const { port } = server.address();
  console.log("server bound to 127.0.0.1:" + port + " (no listen, no accept)");
  for (const msg of messages) {
    const reply = await request(port, msg);
    console.log(reply === null ? "timed out: datagram or reply lost, app decides whether to retry" : "client got: " + reply);
  }
  client.close();
  server.close(() => console.log("done"));
});
`,
      go: String.raw`package main

import (
	"fmt"
	"net"
	"sync"
	"time"
)

func main() {
	messages := []string{"ping 1", "ping 2", "ping 3"}
	server, err := net.ListenPacket("udp", "127.0.0.1:0") // bind only: no listen/accept
	if err != nil {
		panic(err)
	}
	defer server.Close()
	fmt.Println("server bound to", server.LocalAddr(), "(no listen, no accept)")

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		buf := make([]byte, 1500)
		server.SetReadDeadline(time.Now().Add(2 * time.Second)) // never block forever
		for range messages {
			n, from, err := server.ReadFrom(buf) // one call = exactly one datagram
			if err != nil {
				return
			}
			server.WriteTo(append([]byte("echo: "), buf[:n]...), from) // reply to sender
		}
	}()

	client, err := net.Dial("udp", server.LocalAddr().String()) // "connected" UDP: just sets a default peer, no handshake
	if err != nil {
		panic(err)
	}
	defer client.Close()
	buf := make([]byte, 1500)
	for _, msg := range messages {
		client.Write([]byte(msg))
		client.SetReadDeadline(time.Now().Add(time.Second)) // UDP never reports loss
		n, err := client.Read(buf)
		if err != nil {
			fmt.Println("timed out: datagram or reply lost, app decides whether to retry")
			continue
		}
		fmt.Println("client got:", string(buf[:n]))
	}
	wg.Wait()
	fmt.Println("done")
}
`,
    },
  },
  diagrams: {
    stack: String.raw`flowchart TB
      A["Application: HTTP/1.1, HTTP/2, gRPC, SQL"] --> T["TCP"]
      B["Application: DNS, WebRTC media, games"] --> U["UDP"]
      H["HTTP/3"] --> Q["QUIC (in user space)"]
      Q --> U
      T --> IP["IP: best-effort packets"]
      U --> IP
      IP --> L["Link: Wi-Fi, 4G/5G, Ethernet"]`,
    handshake: String.raw`sequenceDiagram
      participant C as Client
      participant S as Server
      Note over S: LISTEN on port 443
      C->>S: SYN (seq = x)
      S-->>C: SYN-ACK (seq = y, ack = x+1)
      C->>S: ACK (ack = y+1)
      Note over C,S: ESTABLISHED after 1 RTT
      C->>S: data (e.g. TLS ClientHello or HTTP request)
      S-->>C: ACK + data`,
    teardown: String.raw`sequenceDiagram
      participant C as Client (closes first)
      participant S as Server
      C->>S: FIN
      S-->>C: ACK
      Note over S: may still send remaining data
      S->>C: FIN
      C-->>S: ACK
      Note over C: TIME_WAIT for 2 x MSL (60 s on Linux)
      Note over S: CLOSED`,
  },
});
