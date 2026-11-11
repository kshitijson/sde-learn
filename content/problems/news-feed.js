SD.register({
  id: "news-feed",
  html: String.raw`
    <p class="lead">The home timeline is the first screen of Twitter/X, Instagram, LinkedIn and ShareChat. It looks like a simple list, but it is one of the most read-heavy systems on the internet: every app open asks "what did the people I follow post recently?". The core question of this problem is <em>when</em> you build each user's feed: when a post is written (fan-out on write), when a feed is read (fan-out on read), or a hybrid of both. This page builds the design an SDE 2 interviewer expects, with numbers, diagrams and runnable code for the hybrid approach.</p>

    <h2>Problem statement</h2>
    <p>Design the home timeline of a Twitter-like product. Users write short posts (text plus optional images or video), follow other users, and open a home feed that shows recent posts from everyone they follow, newest or most relevant first, with infinite scroll. Some accounts (cricketers, film stars, politicians) have tens of millions of followers.</p>

    <div class="callout tip"><strong>Try it first</strong>Before reading on, answer three questions on paper: (1) If a user with 200 followers posts, how does that post get into 200 feeds? (2) If Virat Kohli with 60M followers posts, does your answer still work? (3) When a user scrolls to page 5 while new posts keep arriving, how do you avoid showing the same post twice?</div>

    <details class="hint"><summary>Hint 1: precompute or compute on read?</summary>
      <p>Reads outnumber writes by about 20 to 1. Doing work once at write time so that thousands of reads are cheap is usually a good deal, until one write has to touch 60M feeds.</p>
    </details>
    <details class="hint"><summary>Hint 2: store ids, not posts</summary>
      <p>A feed cache that stores full post bodies duplicates each post into every follower's feed. Store only 8-byte post ids in the feed, and fetch ("hydrate") the post bodies from a post cache at read time.</p>
    </details>
    <details class="hint"><summary>Hint 3: paginate by position in time</summary>
      <p>"Give me 20 posts older than post id X" is stable when new posts arrive at the top. "Skip 40, take 20" is not.</p>
    </details>

    <h2>Requirements</h2>
    <div class="grid-2">
      <div class="card">
        <h3>Functional</h3>
        <ul>
          <li>Create a post (text up to 280 characters, optional media).</li>
          <li>Follow and unfollow users (one-way, like Twitter, not two-way like Facebook friends).</li>
          <li>Home timeline: posts from followed users, newest/most relevant first.</li>
          <li>Infinite scroll with stable pagination.</li>
          <li>Out of scope: likes/replies counts in detail, search, trends, ads, DMs.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Non-functional</h3>
        <ul>
          <li><strong>Scale</strong>: ~200M DAU, heavily read-skewed.</li>
          <li><strong>Latency</strong>: timeline load under 200 ms at p99 (server side).</li>
          <li><strong>Availability</strong> over consistency: a post may take a few seconds to appear in followers' feeds (eventual consistency is fine).</li>
          <li><strong>Durability</strong>: posts are never lost; feeds can be rebuilt.</li>
          <li>Graceful handling of celebrity accounts with 50M+ followers.</li>
        </ul>
      </div>
    </div>

    <h2>Capacity estimation</h2>
    <p>Assumptions: <strong>200M DAU</strong>, each opens the feed <strong>10 times/day</strong>; on average <strong>0.5 posts per DAU per day</strong>; average <strong>200 followers</strong> per poster; a post record is ~<strong>1 KB</strong> (text + metadata); 20% of posts carry ~500 KB of media.</p>
    <table>
      <thead><tr><th>Quantity</th><th>Arithmetic</th><th>Result</th></tr></thead>
      <tbody>
        <tr><td>Feed reads per day</td><td>200M × 10</td><td>2B / day</td></tr>
        <tr><td>Feed read QPS</td><td>2B ÷ 86,400 s</td><td>≈ 23K/s avg, ≈ 70K/s peak (×3)</td></tr>
        <tr><td>Posts per day</td><td>200M × 0.5</td><td>100M / day</td></tr>
        <tr><td>Post write QPS</td><td>100M ÷ 86,400 s</td><td>≈ 1.2K/s avg, ≈ 3.5K/s peak</td></tr>
        <tr><td>Read : write ratio</td><td>2B ÷ 100M</td><td>20 : 1</td></tr>
        <tr><td>Fan-out inserts per day (push for all)</td><td>100M × 200 followers</td><td>20B / day ≈ 231K inserts/s</td></tr>
        <tr><td>One celebrity post (push)</td><td>60M followers × 1 insert</td><td>60M inserts; ~60 s even at 1M inserts/s</td></tr>
        <tr><td>Post storage per year</td><td>100M × 1 KB × 365</td><td>≈ 36.5 TB / year (before replication)</td></tr>
        <tr><td>Media per day</td><td>100M × 20% × 500 KB</td><td>10 TB / day</td></tr>
        <tr><td>Feed cache (ids only)</td><td>200M users × 800 ids × 8 B</td><td>≈ 1.3 TB raw, ~2–3 TB with Redis overhead</td></tr>
        <tr><td>Timeline egress (no media)</td><td>23K/s × 20 posts × 1 KB</td><td>≈ 460 MB/s</td></tr>
      </tbody>
    </table>
    <p>Takeaways from the numbers: reads dominate, so the feed must be served from memory. Fan-out on write is affordable on average (231K small inserts a second across a Redis cluster is fine) but a single celebrity post is a 60M-write spike, which is the whole reason the hybrid approach exists. The feed cache fits in a few terabytes of RAM, about 40–50 nodes of 64 GB including replicas, if it stores only ids.</p>
    <div class="callout interview"><strong>Say this in the interview</strong>"It's 20 reads per write, and the latency budget is 200 ms, so I want the timeline precomputed in a cache. Average fan-out is 200, so pushing post ids into followers' feeds is about 230K inserts a second, which a Redis cluster handles. Celebrities break this: one post would mean 60M writes, so I'll pull their posts at read time instead."</div>

    <h2>API design</h2>
    <table>
      <thead><tr><th>Endpoint</th><th>Request</th><th>Response</th></tr></thead>
      <tbody>
        <tr><td><code>POST /v1/posts</code></td><td><code>{text, media_ids[], client_request_id}</code></td><td><code>201 {post_id, created_at}</code></td></tr>
        <tr><td><code>GET /v1/feed?cursor=&amp;limit=20</code></td><td>cursor is opaque (absent on first page)</td><td><code>{posts: [...], next_cursor}</code></td></tr>
        <tr><td><code>POST /v1/users/{id}/follow</code></td><td>—</td><td><code>204</code></td></tr>
        <tr><td><code>DELETE /v1/users/{id}/follow</code></td><td>—</td><td><code>204</code></td></tr>
        <tr><td><code>GET /v1/users/{id}/posts?cursor=</code></td><td>profile timeline</td><td><code>{posts, next_cursor}</code></td></tr>
        <tr><td><code>POST /v1/media</code></td><td><code>{content_type, size}</code></td><td><code>{media_id, upload_url}</code> (pre-signed)</td></tr>
      </tbody>
    </table>
    <p>Each post in the feed response is fully hydrated: author name and avatar, text, media URLs on the CDN, counts, and viewer-specific flags such as "you liked this". The user id comes from the auth token, never from the URL, so one user cannot read another's home feed.</p>

    <h2>Data model</h2>
    <table>
      <thead><tr><th>Data</th><th>Key / shape</th><th>Store</th><th>Why</th></tr></thead>
      <tbody>
        <tr><td><code>posts</code></td><td><code>post_id</code> (Snowflake) → <code>author_id, text, media_ids, created_at, like_count, reply_count</code></td><td>Cassandra or sharded MySQL, sharded by <code>post_id</code></td><td>Huge, append-mostly, point lookups by id</td></tr>
        <tr><td><code>user_posts</code></td><td><code>author_id</code> → post ids sorted desc</td><td>Cassandra (partition by author)</td><td>Profile page and celebrity pull</td></tr>
        <tr><td><code>follows</code></td><td><code>(follower_id, followee_id, created_at)</code>, indexed both ways</td><td>Sharded MySQL or a graph store (Twitter's FlockDB)</td><td>"Who follows X?" for fan-out; "whom does X follow?" for pull</td></tr>
        <tr><td><code>users</code></td><td><code>user_id</code> → <code>name, avatar, follower_count, is_celebrity</code></td><td>MySQL + cache</td><td>Hydration and the celebrity check</td></tr>
        <tr><td>Feed cache</td><td><code>feed:{user_id}</code> → Redis list of post ids, newest first, capped at ~800</td><td>Redis cluster</td><td>O(1) push, O(k) range read</td></tr>
        <tr><td>Post cache</td><td><code>post:{post_id}</code> → serialised post</td><td>Redis / Memcached</td><td>Hydration with one multi-get</td></tr>
      </tbody>
    </table>
    <p>Snowflake ids matter here: a 64-bit id whose top bits are a millisecond timestamp sorts by time. That means "newer than" and "older than" are just integer comparisons, and the cursor for pagination can simply be a post id.</p>
    <div data-widget="snowflake"></div>

    <h2>High-level design</h2>
    <div data-diagram="arch" data-caption="Write path (top) pushes ids into Redis feeds via Kafka; read path (bottom) merges, hydrates and ranks."></div>
    <ol class="steps">
      <li><strong>Post service</strong> stores the post, updates <code>user_posts</code>, puts it in the post cache, and publishes a <code>PostCreated</code> event to Kafka.</li>
      <li><strong>Fan-out workers</strong> consume the event, page through the author's followers from the <strong>graph service</strong>, and push the post id into each follower's Redis feed list.</li>
      <li><strong>Feed service</strong> reads the precomputed list, merges in recent posts from followed celebrities, hydrates ids into full posts, ranks them and returns a page with a cursor.</li>
      <li><strong>Media</strong> is uploaded directly to object storage via a pre-signed URL and served through a CDN; the feed only carries URLs.</li>
    </ol>

    <h2>Deep dive 1: fan-out on write vs on read vs hybrid</h2>
    <p><strong>Fan-out</strong> means copying one post to the many people who should see it. The question is whether you do it when the post is written (push) or when a feed is read (pull).</p>
    <div class="tabs">
      <section data-tab="Fan-out on write (push)">
        <p>When Bob posts, look up his followers and append the post id to each follower's feed list. Reading a feed is then a single <code>LRANGE</code> on one Redis key.</p>
        <div data-diagram="push" data-caption="Fan-out on write: the cost is paid once per post, per follower."></div>
      </section>
      <section data-tab="Fan-out on read (pull)">
        <p>Store nothing per follower. When Alice opens her feed, fetch the latest posts of everyone she follows and merge them. Writes are trivial; every read does N lookups.</p>
        <div data-diagram="pull" data-caption="Fan-out on read: the cost is paid on every feed open."></div>
      </section>
    </div>
    <table>
      <thead><tr><th></th><th>Fan-out on write (push)</th><th>Fan-out on read (pull)</th><th>Hybrid</th></tr></thead>
      <tbody>
        <tr><td>Write cost</td><td>O(followers) per post</td><td>O(1)</td><td>O(followers) for normal users, O(1) for celebrities</td></tr>
        <tr><td>Read cost</td><td>O(1) key read</td><td>O(followees) fetches + merge</td><td>1 key read + a few celebrity pulls</td></tr>
        <tr><td>Read latency</td><td>Lowest</td><td>High for users following 1,000+ accounts</td><td>Low</td></tr>
        <tr><td>Celebrity post</td><td>60M writes; fan-out lag of minutes</td><td>No problem</td><td>No problem (pulled)</td></tr>
        <tr><td>Inactive users</td><td>Wasted writes into feeds nobody reads</td><td>No waste</td><td>Skip inactive users; rebuild on login</td></tr>
        <tr><td>Freshness</td><td>Seconds of lag (async)</td><td>Always fresh</td><td>Celebrity posts fresh; others seconds</td></tr>
        <tr><td>Used by</td><td>Early Twitter for most users</td><td>Early Facebook News Feed</td><td>Twitter/X, Instagram today</td></tr>
      </tbody>
    </table>
    <p>The <strong>hybrid</strong> rule: if the author has more followers than a threshold (say 100K, or flagged as celebrity), do not fan out; their posts stay in <code>user_posts</code>. At read time, the feed service takes the user's precomputed list and merges in the latest posts of the (usually few) celebrities they follow. Since an average user follows maybe 5–20 celebrities, that is a handful of extra cache reads, all served from a hot cache because millions of people pull the same celebrity posts.</p>
    <div data-widget="fanout"></div>
    <div data-diagram="read" data-caption="Hybrid read path: precomputed ids plus pulled celebrity ids, merged, hydrated and ranked."></div>
    <div class="callout interview"><strong>Say this in the interview</strong>"I'll push for normal users and pull for celebrities. The precomputed list gives me O(1) reads for 99% of authors, and celebrities, who would cause 60-million-write spikes, are merged in at read time. The merge is a k-way merge on time-sortable ids using a heap, so it's cheap: O(n log k) for n posts from k sources."</div>

    <h3>Core algorithm: hybrid fan-out with a k-way merge</h3>
    <p>The code below models the whole idea in memory. <code>post</code> pushes the post id into every follower's feed unless the author is over the celebrity threshold. <code>getFeed</code> treats the precomputed feed and each followed celebrity's post list as sorted sources and runs a <strong>k-way merge</strong> with a max-heap keyed on (timestamp, post id), stopping after <code>limit</code> results. It also drops duplicates (a user who crossed the threshold may have older posts already pushed) and posts from authors the reader has since unfollowed.</p>
    <div data-code="hybrid"></div>

    <h2>Deep dive 2: feed generation workers</h2>
    <ul>
      <li><strong>Queue first.</strong> The post API returns as soon as the post is stored and the event is in Kafka. Users never wait for fan-out.</li>
      <li><strong>Partition by author</strong> so one author's posts are fanned out in order. Split big follower lists into chunks of ~1,000 and publish each chunk as its own task so many workers share one big fan-out.</li>
      <li><strong>Pipelined writes.</strong> For each follower: <code>LPUSH feed:{id} post_id</code> then <code>LTRIM feed:{id} 0 799</code>, batched in Redis pipelines grouped by shard.</li>
      <li><strong>Skip inactive users.</strong> If someone has not logged in for 30 days, do not maintain their feed. On their next login, rebuild it by pulling (a one-time fan-out on read).</li>
      <li><strong>Idempotent.</strong> Kafka redelivers on worker crashes. Pushing the same id twice is handled by deduping at read time (or using a sorted set keyed by post id).</li>
      <li><strong>Deletes and unfollows</strong> are lazy: filter at read time (deleted post is missing from the post cache; unfollowed author is not in the following set), and optionally clean up asynchronously.</li>
    </ul>
    <div class="callout warn"><strong>Pitfall</strong>Do not run fan-out inside the request thread. A user with 50K followers would wait seconds for "Post" to return, and one slow Redis shard would make posting fail.</div>

    <h2>Deep dive 3: hydration</h2>
    <p>The feed holds ids. The client needs full posts. <strong>Hydration</strong> turns 20 ids into 20 rich objects:</p>
    <ol class="steps">
      <li>Multi-get the 20 posts from the post cache in one round trip (<code>MGET</code>); fall back to the posts DB for misses and backfill the cache.</li>
      <li>Collect distinct author ids and multi-get user profiles (name, avatar, verified badge).</li>
      <li>Fetch viewer-specific state in bulk: has Alice liked or reposted these posts? Is any author blocked or muted?</li>
      <li>Drop deleted, hidden or blocked posts, and fetch a few extra ids if needed to fill the page.</li>
    </ol>
    <p>Everything is batched and run in parallel, so hydration costs a few milliseconds, not 20 sequential lookups. Celebrity posts are the hottest keys in the post cache; replicate them across nodes or keep them in a small in-process cache on each feed server to avoid a single overloaded cache shard.</p>

    <h2>Deep dive 4: cursor pagination (why not offset)</h2>
    <div class="grid-2">
      <div class="card bad"><strong>Offset: <code>?page=3&amp;size=20</code></strong><p>Between page 1 and page 2, five new posts arrive at the top. Every item shifts down by five, so page 2 repeats five posts you already saw. Deep offsets also force the store to skip past many rows.</p></div>
      <div class="card good"><strong>Cursor: <code>?cursor=1789...&amp;limit=20</code></strong><p>The cursor is the id of the last post you saw. The next page is "20 posts with id less than the cursor". New posts at the top cannot shift it, and the lookup is an index seek.</p></div>
    </div>
    <p>Make the cursor <strong>opaque</strong> (base64 of <code>{last_post_id, ranking_version}</code>) so you can change its contents later without breaking clients. For "new posts since I last looked" (pull to refresh), use the newest post id as a <code>since</code> cursor. When a user scrolls past the ~800 cached ids, fall back to pulling from <code>user_posts</code> of followees, which is slow but rare.</p>

    <h2>Deep dive 5: ranking basics</h2>
    <table>
      <thead><tr><th></th><th>Chronological</th><th>Ranked</th></tr></thead>
      <tbody>
        <tr><td>Order</td><td>Newest first</td><td>Predicted relevance first</td></tr>
        <tr><td>Complexity</td><td>Just the merge</td><td>Candidate generation + scoring model</td></tr>
        <tr><td>User trust</td><td>Predictable</td><td>Can feel opaque</td></tr>
        <tr><td>Engagement</td><td>Lower</td><td>Higher; old good posts resurface</td></tr>
      </tbody>
    </table>
    <p>A ranked feed works in two stages. <strong>Candidate generation</strong> takes the merged ids (say the latest 500). <strong>Scoring</strong> gives each a score from features such as:</p>
    <ul>
      <li><strong>Recency</strong>: score decays with age (e.g. halves every few hours).</li>
      <li><strong>Affinity</strong>: how often the viewer likes, replies to or visits this author.</li>
      <li><strong>Engagement</strong>: likes, replies and reposts so far, normalised by the author's reach.</li>
      <li><strong>Content type</strong>: some users prefer videos, others text.</li>
      <li><strong>Negative signals</strong>: "show less", mutes, quick scroll-past.</li>
    </ul>
    <p>In an interview, a weighted formula like <code>score = w1·affinity + w2·engagement − w3·age_hours</code> is enough; mention that real systems use an ML model served by a ranking service, with a time budget (e.g. 50 ms) and a chronological fallback if ranking times out.</p>

    <h2>Media via CDN</h2>
    <p>Media is 10 TB/day and never goes through the post or feed services. The app asks for a pre-signed URL, uploads directly to object storage (S3/GCS), and a worker creates thumbnails and multiple resolutions (and video renditions for adaptive streaming). The post stores <code>media_ids</code>; the feed response contains CDN URLs. The CDN serves most bytes from edge locations close to users (Mumbai, Chennai, Singapore), so the feed API's 460 MB/s of JSON stays small compared to the media traffic.</p>

    <h2>Cache sizing</h2>
    <ul>
      <li><strong>Feed cache</strong>: 200M active users × 800 ids × 8 B ≈ 1.3 TB raw. Redis stores small integer lists compactly (listpack), but per-key overhead adds up; plan for ~2–3 TB including one replica, about 40–50 nodes of 64 GB. Only active users have feeds, so the real number is often lower.</li>
      <li><strong>Why 800?</strong> Almost nobody scrolls past a few hundred posts. Twitter kept roughly 800 entries per timeline in Redis.</li>
      <li><strong>Post cache</strong>: most reads hit posts from the last 24–48 hours: 100M posts/day × 1 KB × 2 days ≈ 200 GB. Small and very hot.</li>
      <li><strong>Sharding</strong>: shard <code>feed:{user_id}</code> by user id with consistent hashing; a node loss only means those users' feeds are rebuilt from the database (feeds are a cache, not the source of truth).</li>
    </ul>

    <h2>Scaling &amp; bottlenecks</h2>
    <ul>
      <li><strong>Fan-out lag.</strong> Monitor Kafka consumer lag. Autoscale workers. Prioritise fan-out to users who are currently online.</li>
      <li><strong>Hot keys.</strong> Celebrity post objects and their <code>user_posts</code> lists are read millions of times a minute. Replicate them, add an in-process cache with a 1–5 s TTL, and use request coalescing.</li>
      <li><strong>Cold start / cache loss.</strong> Rebuilding feeds for many users at once (after a cache node fails) is a thundering herd. Rebuild lazily on first read, rate-limited, and serve a slightly worse pull-based feed meanwhile.</li>
      <li><strong>Graph service.</strong> Follower lists for big accounts are large; page through them and cache the hottest lists.</li>
      <li><strong>Threshold flapping.</strong> An author near the threshold should not switch modes on every follow. Use hysteresis (become celebrity at 100K, stop at 90K) and dedupe at read time, as the code does.</li>
      <li><strong>Multi-region.</strong> Posts replicate to all regions; each region runs its own fan-out into its local feed cache.</li>
    </ul>

    <h2>Trade-offs</h2>
    <table>
      <thead><tr><th>Decision</th><th>Choice</th><th>What we give up</th></tr></thead>
      <tbody>
        <tr><td>Feed construction</td><td>Hybrid push/pull</td><td>Two code paths and a merge step to maintain</td></tr>
        <tr><td>Consistency</td><td>Eventual (async fan-out)</td><td>A post can take a few seconds to show up for followers</td></tr>
        <tr><td>Feed contents</td><td>Ids only, capped at 800</td><td>Hydration on every read; very deep scroll falls back to slow pull</td></tr>
        <tr><td>Pagination</td><td>Opaque cursor</td><td>Cannot jump to "page 37" (nobody needs it)</td></tr>
        <tr><td>Inactive users</td><td>No fan-out; rebuild on login</td><td>First load after a long break is slower</td></tr>
        <tr><td>Ranking</td><td>Ranked with chronological fallback</td><td>Complexity and a latency budget for scoring</td></tr>
      </tbody>
    </table>

    <h2>Follow-up questions</h2>
    <div class="quiz">
      <details><summary>Why store post ids in the feed and not full posts?</summary><div>A full post copied into 200 feeds costs 200 KB instead of 1.6 KB of ids, and editing or deleting the post would require touching 200 copies. Ids keep the feed small; hydration fetches the current version from the post cache.</div></details>
      <details><summary>A user with 5,000 followers crosses the celebrity threshold. What happens to posts already pushed?</summary><div>They stay in followers' feeds. New posts are pulled at read time. The merge dedupes by post id so a post that is both pushed and pulled appears once. Hysteresis around the threshold prevents flip-flopping.</div></details>
      <details><summary>Alice unfollows Bob. How do Bob's posts leave her feed?</summary><div>Lazily: the feed service filters out posts whose author is not in Alice's following set. A background job can also remove Bob's ids from her list. The demo code does the read-time filter.</div></details>
      <details><summary>How do you serve a feed when the Redis feed for a user is missing?</summary><div>Fall back to fan-out on read: fetch the following list, pull recent posts from each followee's <code>user_posts</code>, merge, then write the result back into the cache. Rate-limit rebuilds to avoid a thundering herd.</div></details>
      <details><summary>Why is the k-way merge O(n log k)?</summary><div>The heap holds at most one cursor per source (k sources). Each of the n emitted posts costs one pop and at most one push, both O(log k). With one precomputed feed and 10 celebrities, k = 11, so the heap is tiny.</div></details>
      <details><summary>How would you add "new posts available" at the top while the user is reading?</summary><div>Poll lightly (e.g. every 60 s) with <code>since=newest_post_id</code> and show a pill with the count, or push a small hint over an existing WebSocket. Do not insert posts into the list under the user's thumb.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Feeds are <strong>read-heavy</strong> (about 20:1); precompute so reads are a single cache lookup.</li>
      <li><strong>Fan-out on write</strong> for normal users, <strong>fan-out on read</strong> for celebrities: the hybrid avoids 60M-write spikes.</li>
      <li>Store <strong>post ids</strong> in Redis lists capped at ~800; <strong>hydrate</strong> with batched multi-gets.</li>
      <li>Run fan-out in <strong>queue-driven workers</strong>; skip inactive users and rebuild on login.</li>
      <li>Merge sources with a <strong>heap-based k-way merge</strong> on time-sortable Snowflake ids.</li>
      <li>Paginate with <strong>cursors</strong>, never offsets.</li>
      <li>Media goes <strong>direct to object storage and out via CDN</strong>; the feed carries only URLs.</li>
    </ul></div>
  `,
  code: {
    hybrid: {
      title: "Hybrid fan-out feed service (push + pull with k-way merge)",
      java: String.raw`import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.ListIterator;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;
import java.util.stream.Collectors;

public class Feed {
    record Post(long id, String author, String text, long ts) {}

    /** Hybrid fan-out: push for normal users, pull for celebrities. */
    static final class FeedService {
        private final int celebrityThreshold;
        private final int maxFeedLen;
        private final Map<String, Set<String>> followers = new HashMap<>(); // user -> who follows them
        private final Map<String, Set<String>> following = new HashMap<>(); // user -> whom they follow
        private final Map<Long, Post> posts = new HashMap<>();
        private final Map<String, List<Long>> userPosts = new HashMap<>();  // oldest first
        private final Map<String, Deque<Long>> feeds = new HashMap<>();     // precomputed, oldest first
        private long clock = 0; // logical clock; real systems use Snowflake ids / epoch ms

        FeedService(int celebrityThreshold, int maxFeedLen) {
            this.celebrityThreshold = celebrityThreshold;
            this.maxFeedLen = maxFeedLen;
        }

        boolean isCelebrity(String user) {
            return followers.getOrDefault(user, Set.of()).size() >= celebrityThreshold;
        }

        void follow(String follower, String followee) {
            if (follower.equals(followee)) return;
            followers.computeIfAbsent(followee, k -> new HashSet<>()).add(follower);
            following.computeIfAbsent(follower, k -> new HashSet<>()).add(followee);
        }

        void unfollow(String follower, String followee) {
            followers.getOrDefault(followee, new HashSet<>()).remove(follower);
            following.getOrDefault(follower, new HashSet<>()).remove(followee);
        }

        Post post(String author, String text) {
            long ts = ++clock;
            Post p = new Post(ts, author, text, ts);
            posts.put(p.id(), p);
            userPosts.computeIfAbsent(author, k -> new ArrayList<>()).add(p.id());
            push(author, p.id()); // you always see your own posts
            if (!isCelebrity(author)) { // fan-out on write
                for (String f : followers.getOrDefault(author, Set.of())) push(f, p.id());
            }
            return p;
        }

        private void push(String user, long id) {
            Deque<Long> feed = feeds.computeIfAbsent(user, k -> new ArrayDeque<>());
            feed.addLast(id);
            if (feed.size() > maxFeedLen) feed.removeFirst(); // cap like a Redis LTRIM
        }

        private static Iterator<Long> newestFirst(List<Long> ids) {
            ListIterator<Long> it = ids.listIterator(ids.size());
            return new Iterator<>() {
                public boolean hasNext() { return it.hasPrevious(); }
                public Long next() { return it.previous(); }
            };
        }

        /** One cursor per source, walking from newest to oldest. */
        private record Head(Post post, Iterator<Long> rest) {}

        List<Post> getFeed(String user, int limit) {
            Set<String> follows = following.getOrDefault(user, Set.of());
            // Sources: precomputed feed + every followed celebrity's posts (fan-out on read).
            List<Iterator<Long>> sources = new ArrayList<>();
            sources.add(feeds.getOrDefault(user, new ArrayDeque<>()).descendingIterator());
            for (String c : follows) {
                if (isCelebrity(c)) {
                    sources.add(newestFirst(userPosts.getOrDefault(c, List.of())));
                }
            }

            // k-way merge, newest first: max-heap on (ts, id).
            PriorityQueue<Head> heap = new PriorityQueue<>(
                Comparator.comparingLong((Head h) -> h.post().ts())
                          .thenComparingLong(h -> h.post().id())
                          .reversed());
            for (Iterator<Long> it : sources) {
                if (it.hasNext()) heap.add(new Head(posts.get(it.next()), it));
            }

            List<Post> result = new ArrayList<>();
            Set<Long> seen = new HashSet<>();
            while (!heap.isEmpty() && result.size() < limit) {
                Head h = heap.poll();
                if (h.rest().hasNext()) heap.add(new Head(posts.get(h.rest().next()), h.rest()));
                Post p = h.post();
                boolean visible = p.author().equals(user) || follows.contains(p.author());
                if (visible && seen.add(p.id())) result.add(p); // skip unfollowed + duplicates
            }
            return result;
        }

        long countInFeed(String user, String author) {
            return feeds.getOrDefault(user, new ArrayDeque<>()).stream()
                        .filter(id -> posts.get(id).author().equals(author)).count();
        }
    }

    static String show(List<Post> feed) {
        return feed.stream().map(p -> p.author() + ": " + p.text()).collect(Collectors.joining(" | "));
    }

    public static void main(String[] args) {
        FeedService svc = new FeedService(3, 800);
        for (String fan : List.of("alice", "bob", "carol")) svc.follow(fan, "virat"); // virat -> celebrity
        svc.follow("alice", "bob");
        svc.follow("carol", "bob");

        svc.post("bob", "Biryani at Paradise tonight?");
        svc.post("virat", "Century! Thanks for the love");
        svc.post("carol", "Learning system design"); // alice does not follow carol
        svc.post("bob", "Booked the table for 8");
        svc.post("alice", "Anyone up for cricket?");

        System.out.println("virat is celebrity: " + svc.isCelebrity("virat"));
        System.out.println("virat posts pushed into alice's precomputed feed: " + svc.countInFeed("alice", "virat"));
        System.out.println("alice feed: " + show(svc.getFeed("alice", 10)));
        System.out.println("alice feed (limit 2): " + show(svc.getFeed("alice", 2)));
        svc.unfollow("alice", "bob");
        System.out.println("after unfollowing bob: " + show(svc.getFeed("alice", 10)));
    }
}`,
      python: String.raw`import heapq
from collections import defaultdict
from dataclasses import dataclass
from itertools import count


@dataclass(frozen=True)
class Post:
    post_id: int
    author: str
    text: str
    ts: int  # logical clock; a real system would use a Snowflake id / epoch ms


class FeedService:
    """Hybrid fan-out: push for normal users, pull for celebrities."""

    def __init__(self, celebrity_threshold=3, max_feed_len=800):
        self.celebrity_threshold = celebrity_threshold
        self.max_feed_len = max_feed_len
        self.followers = defaultdict(set)    # user -> who follows them
        self.following = defaultdict(set)    # user -> whom they follow
        self.posts = {}                      # post_id -> Post
        self.user_posts = defaultdict(list)  # author -> post ids, oldest first
        self.feeds = defaultdict(list)       # user -> precomputed post ids, oldest first
        self._clock = count(1)

    def is_celebrity(self, user):
        return len(self.followers[user]) >= self.celebrity_threshold

    def follow(self, follower, followee):
        if follower != followee:
            self.followers[followee].add(follower)
            self.following[follower].add(followee)

    def unfollow(self, follower, followee):
        self.followers[followee].discard(follower)
        self.following[follower].discard(followee)

    def post(self, author, text):
        ts = next(self._clock)
        p = Post(ts, author, text, ts)
        self.posts[p.post_id] = p
        self.user_posts[author].append(p.post_id)
        self._push(author, p.post_id)  # you always see your own posts
        if not self.is_celebrity(author):  # fan-out on write
            for f in self.followers[author]:
                self._push(f, p.post_id)
        return p

    def _push(self, user, post_id):
        feed = self.feeds[user]
        feed.append(post_id)
        if len(feed) > self.max_feed_len:  # cap like a Redis LTRIM
            del feed[0]

    def get_feed(self, user, limit=10):
        # Sources, each sorted oldest -> newest: the precomputed feed plus
        # the post list of every celebrity this user follows (fan-out on read).
        sources = [self.feeds[user]]
        sources += [self.user_posts[c] for c in self.following[user] if self.is_celebrity(c)]

        # k-way merge, newest first: max-heap keyed on (ts, post_id).
        heap = []
        for i, src in enumerate(sources):
            if src:
                pid = src[-1]
                heapq.heappush(heap, (-self.posts[pid].ts, -pid, i, len(src) - 1))

        result, seen = [], set()
        while heap and len(result) < limit:
            _, _, i, pos = heapq.heappop(heap)
            p = self.posts[sources[i][pos]]
            if pos > 0:
                nxt = sources[i][pos - 1]
                heapq.heappush(heap, (-self.posts[nxt].ts, -nxt, i, pos - 1))
            visible = p.author == user or p.author in self.following[user]
            if visible and p.post_id not in seen:  # skip unfollowed + duplicates
                seen.add(p.post_id)
                result.append(p)
        return result


def show(feed):
    return " | ".join(f"{p.author}: {p.text}" for p in feed)


if __name__ == "__main__":
    svc = FeedService(celebrity_threshold=3)
    for fan in ["alice", "bob", "carol"]:
        svc.follow(fan, "virat")  # virat now has 3 followers -> celebrity
    svc.follow("alice", "bob")
    svc.follow("carol", "bob")

    svc.post("bob", "Biryani at Paradise tonight?")
    svc.post("virat", "Century! Thanks for the love")
    svc.post("carol", "Learning system design")  # alice does not follow carol
    svc.post("bob", "Booked the table for 8")
    svc.post("alice", "Anyone up for cricket?")

    print("virat is celebrity:", svc.is_celebrity("virat"))
    print("virat posts pushed into alice's precomputed feed:",
          sum(svc.posts[p].author == "virat" for p in svc.feeds["alice"]))
    print("alice feed:", show(svc.get_feed("alice", 10)))
    print("alice feed (limit 2):", show(svc.get_feed("alice", 2)))

    svc.unfollow("alice", "bob")
    print("after unfollowing bob:", show(svc.get_feed("alice", 10)))`,
      cpp: String.raw`#include <cstdint>
#include <deque>
#include <iostream>
#include <queue>
#include <string>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <vector>

struct Post {
    int64_t id;
    std::string author;
    std::string text;
    int64_t ts;  // logical clock; real systems use Snowflake ids / epoch ms
};

// Hybrid fan-out: push for normal users, pull for celebrities.
class FeedService {
public:
    explicit FeedService(size_t celebrityThreshold = 3, size_t maxFeedLen = 800)
        : threshold_(celebrityThreshold), maxFeedLen_(maxFeedLen) {}

    bool isCelebrity(const std::string& user) const {
        auto it = followers_.find(user);
        return it != followers_.end() && it->second.size() >= threshold_;
    }

    void follow(const std::string& follower, const std::string& followee) {
        if (follower == followee) return;
        followers_[followee].insert(follower);
        following_[follower].insert(followee);
    }

    void unfollow(const std::string& follower, const std::string& followee) {
        followers_[followee].erase(follower);
        following_[follower].erase(followee);
    }

    const Post& post(const std::string& author, const std::string& text) {
        int64_t ts = ++clock_;
        Post& p = posts_[ts] = Post{ts, author, text, ts};
        userPosts_[author].push_back(p.id);
        push(author, p.id);  // you always see your own posts
        if (!isCelebrity(author)) {  // fan-out on write
            for (const auto& f : followers_[author]) push(f, p.id);
        }
        return p;  // references into unordered_map stay valid on rehash
    }

    std::vector<Post> getFeed(const std::string& user, size_t limit = 10) {
        const auto& following = following_[user];
        // Sources, each oldest -> newest: precomputed feed + followed celebrities' posts.
        std::vector<const std::deque<int64_t>*> sources{&feeds_[user]};
        for (const auto& c : following)
            if (isCelebrity(c)) sources.push_back(&userPosts_[c]);

        // k-way merge, newest first. Entry: (ts, postId, sourceIndex, position).
        using Entry = std::tuple<int64_t, int64_t, size_t, size_t>;
        std::priority_queue<Entry> heap;  // max-heap on (ts, id)
        auto entry = [&](size_t i, size_t pos) {
            int64_t id = (*sources[i])[pos];
            return Entry{posts_.at(id).ts, id, i, pos};
        };
        for (size_t i = 0; i < sources.size(); ++i)
            if (!sources[i]->empty()) heap.push(entry(i, sources[i]->size() - 1));

        std::vector<Post> result;
        std::unordered_set<int64_t> seen;
        while (!heap.empty() && result.size() < limit) {
            auto [ts, id, i, pos] = heap.top();
            heap.pop();
            if (pos > 0) heap.push(entry(i, pos - 1));
            const Post& p = posts_.at(id);
            bool visible = p.author == user || following.count(p.author);
            if (visible && seen.insert(id).second) result.push_back(p);  // skip unfollowed + dups
        }
        return result;
    }

    size_t countInFeed(const std::string& user, const std::string& author) {
        size_t n = 0;
        for (int64_t id : feeds_[user]) n += posts_.at(id).author == author;
        return n;
    }

private:
    void push(const std::string& user, int64_t id) {
        auto& feed = feeds_[user];
        feed.push_back(id);
        if (feed.size() > maxFeedLen_) feed.pop_front();  // cap like a Redis LTRIM
    }

    size_t threshold_, maxFeedLen_;
    int64_t clock_ = 0;
    std::unordered_map<std::string, std::unordered_set<std::string>> followers_, following_;
    std::unordered_map<int64_t, Post> posts_;
    std::unordered_map<std::string, std::deque<int64_t>> userPosts_, feeds_;
};

std::string show(const std::vector<Post>& feed) {
    std::string out;
    for (const auto& p : feed) {
        if (!out.empty()) out += " | ";
        out += p.author + ": " + p.text;
    }
    return out;
}

int main() {
    FeedService svc(3);
    for (const char* fan : {"alice", "bob", "carol"}) svc.follow(fan, "virat");  // virat -> celebrity
    svc.follow("alice", "bob");
    svc.follow("carol", "bob");

    svc.post("bob", "Biryani at Paradise tonight?");
    svc.post("virat", "Century! Thanks for the love");
    svc.post("carol", "Learning system design");  // alice does not follow carol
    svc.post("bob", "Booked the table for 8");
    svc.post("alice", "Anyone up for cricket?");

    std::cout << std::boolalpha << "virat is celebrity: " << svc.isCelebrity("virat") << "\n";
    std::cout << "virat posts pushed into alice's precomputed feed: " << svc.countInFeed("alice", "virat") << "\n";
    std::cout << "alice feed: " << show(svc.getFeed("alice", 10)) << "\n";
    std::cout << "alice feed (limit 2): " << show(svc.getFeed("alice", 2)) << "\n";
    svc.unfollow("alice", "bob");
    std::cout << "after unfollowing bob: " << show(svc.getFeed("alice", 10)) << "\n";
}`,
      javascript: String.raw`// Minimal binary max-heap with a comparator: cmp(a, b) > 0 means a has higher priority.
class MaxHeap {
  constructor(cmp) { this.a = []; this.cmp = cmp; }
  get size() { return this.a.length; }
  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cmp(a[i], a[p]) <= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let best = i;
        if (l < a.length && this.cmp(a[l], a[best]) > 0) best = l;
        if (r < a.length && this.cmp(a[r], a[best]) > 0) best = r;
        if (best === i) break;
        [a[i], a[best]] = [a[best], a[i]];
        i = best;
      }
    }
    return top;
  }
}

// Hybrid fan-out: push for normal users, pull for celebrities.
class FeedService {
  constructor(celebrityThreshold = 3, maxFeedLen = 800) {
    this.celebrityThreshold = celebrityThreshold;
    this.maxFeedLen = maxFeedLen;
    this.followers = new Map(); // user -> Set of followers
    this.following = new Map(); // user -> Set of followees
    this.posts = new Map();     // postId -> { postId, author, text, ts }
    this.userPosts = new Map(); // author -> post ids, oldest first
    this.feeds = new Map();     // user -> precomputed post ids, oldest first
    this.clock = 0;             // logical clock; real systems use Snowflake ids
  }

  static get(map, key, make) {
    if (!map.has(key)) map.set(key, make());
    return map.get(key);
  }

  isCelebrity(user) {
    return (this.followers.get(user)?.size ?? 0) >= this.celebrityThreshold;
  }

  follow(follower, followee) {
    if (follower === followee) return;
    FeedService.get(this.followers, followee, () => new Set()).add(follower);
    FeedService.get(this.following, follower, () => new Set()).add(followee);
  }

  unfollow(follower, followee) {
    this.followers.get(followee)?.delete(follower);
    this.following.get(follower)?.delete(followee);
  }

  post(author, text) {
    const ts = ++this.clock;
    const p = { postId: ts, author, text, ts };
    this.posts.set(p.postId, p);
    FeedService.get(this.userPosts, author, () => []).push(p.postId);
    this.push(author, p.postId); // you always see your own posts
    if (!this.isCelebrity(author)) { // fan-out on write
      for (const f of this.followers.get(author) ?? []) this.push(f, p.postId);
    }
    return p;
  }

  push(user, postId) {
    const feed = FeedService.get(this.feeds, user, () => []);
    feed.push(postId);
    if (feed.length > this.maxFeedLen) feed.shift(); // cap like a Redis LTRIM
  }

  getFeed(user, limit = 10) {
    const following = this.following.get(user) ?? new Set();
    // Sources, each oldest -> newest: precomputed feed + every followed celebrity's posts.
    const sources = [this.feeds.get(user) ?? []];
    for (const c of following) {
      if (this.isCelebrity(c)) sources.push(this.userPosts.get(c) ?? []);
    }

    // k-way merge, newest first. Heap entries: [ts, postId, sourceIndex, position].
    const heap = new MaxHeap((x, y) => x[0] - y[0] || x[1] - y[1]);
    const entry = (i, pos) => {
      const id = sources[i][pos];
      return [this.posts.get(id).ts, id, i, pos];
    };
    sources.forEach((src, i) => { if (src.length) heap.push(entry(i, src.length - 1)); });

    const result = [];
    const seen = new Set();
    while (heap.size && result.length < limit) {
      const [, id, i, pos] = heap.pop();
      if (pos > 0) heap.push(entry(i, pos - 1));
      const p = this.posts.get(id);
      const visible = p.author === user || following.has(p.author);
      if (visible && !seen.has(id)) { // skip unfollowed authors + duplicates
        seen.add(id);
        result.push(p);
      }
    }
    return result;
  }
}

const show = (feed) => feed.map((p) => p.author + ": " + p.text).join(" | ");

// ---- demo ----
const svc = new FeedService(3);
for (const fan of ["alice", "bob", "carol"]) svc.follow(fan, "virat"); // virat -> celebrity
svc.follow("alice", "bob");
svc.follow("carol", "bob");

svc.post("bob", "Biryani at Paradise tonight?");
svc.post("virat", "Century! Thanks for the love");
svc.post("carol", "Learning system design"); // alice does not follow carol
svc.post("bob", "Booked the table for 8");
svc.post("alice", "Anyone up for cricket?");

console.log("virat is celebrity:", svc.isCelebrity("virat"));
console.log("virat posts pushed into alice's precomputed feed:",
  svc.feeds.get("alice").filter((id) => svc.posts.get(id).author === "virat").length);
console.log("alice feed:", show(svc.getFeed("alice", 10)));
console.log("alice feed (limit 2):", show(svc.getFeed("alice", 2)));
svc.unfollow("alice", "bob");
console.log("after unfollowing bob:", show(svc.getFeed("alice", 10)));`,
      go: String.raw`package main

import (
	"container/heap"
	"fmt"
	"strings"
)

type Post struct {
	ID     int64
	Author string
	Text   string
	TS     int64 // logical clock; real systems use Snowflake ids / epoch ms
}

// cursor points at one position inside one source list.
type cursor struct {
	ts, id   int64
	src, pos int
}

// maxHeap orders cursors newest first (by ts, then id).
type maxHeap []cursor

func (h maxHeap) Len() int { return len(h) }
func (h maxHeap) Less(i, j int) bool {
	if h[i].ts != h[j].ts {
		return h[i].ts > h[j].ts
	}
	return h[i].id > h[j].id
}
func (h maxHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *maxHeap) Push(x any)   { *h = append(*h, x.(cursor)) }
func (h *maxHeap) Pop() any {
	old := *h
	x := old[len(old)-1]
	*h = old[:len(old)-1]
	return x
}

type set map[string]struct{}

// FeedService implements hybrid fan-out: push for normal users, pull for celebrities.
type FeedService struct {
	celebrityThreshold int
	maxFeedLen         int
	followers          map[string]set     // user -> who follows them
	following          map[string]set     // user -> whom they follow
	posts              map[int64]*Post    // id -> post
	userPosts          map[string][]int64 // author -> post ids, oldest first
	feeds              map[string][]int64 // user -> precomputed post ids, oldest first
	clock              int64
}

func NewFeedService(threshold, maxFeedLen int) *FeedService {
	return &FeedService{
		celebrityThreshold: threshold,
		maxFeedLen:         maxFeedLen,
		followers:          map[string]set{},
		following:          map[string]set{},
		posts:              map[int64]*Post{},
		userPosts:          map[string][]int64{},
		feeds:              map[string][]int64{},
	}
}

func (s *FeedService) IsCelebrity(user string) bool {
	return len(s.followers[user]) >= s.celebrityThreshold
}

func (s *FeedService) Follow(follower, followee string) {
	if follower == followee {
		return
	}
	if s.followers[followee] == nil {
		s.followers[followee] = set{}
	}
	if s.following[follower] == nil {
		s.following[follower] = set{}
	}
	s.followers[followee][follower] = struct{}{}
	s.following[follower][followee] = struct{}{}
}

func (s *FeedService) Unfollow(follower, followee string) {
	delete(s.followers[followee], follower) // delete on a nil map is a no-op
	delete(s.following[follower], followee)
}

func (s *FeedService) Post(author, text string) *Post {
	s.clock++
	p := &Post{ID: s.clock, Author: author, Text: text, TS: s.clock}
	s.posts[p.ID] = p
	s.userPosts[author] = append(s.userPosts[author], p.ID)
	s.push(author, p.ID)        // you always see your own posts
	if !s.IsCelebrity(author) { // fan-out on write
		for f := range s.followers[author] {
			s.push(f, p.ID)
		}
	}
	return p
}

func (s *FeedService) push(user string, id int64) {
	feed := append(s.feeds[user], id)
	if len(feed) > s.maxFeedLen { // cap like a Redis LTRIM
		feed = feed[1:]
	}
	s.feeds[user] = feed
}

func (s *FeedService) GetFeed(user string, limit int) []*Post {
	following := s.following[user]
	// Sources, each oldest -> newest: precomputed feed + every followed celebrity's posts.
	sources := [][]int64{s.feeds[user]}
	for c := range following {
		if s.IsCelebrity(c) {
			sources = append(sources, s.userPosts[c])
		}
	}

	at := func(src, pos int) cursor {
		id := sources[src][pos]
		return cursor{ts: s.posts[id].TS, id: id, src: src, pos: pos}
	}
	h := &maxHeap{}
	for i, src := range sources {
		if len(src) > 0 {
			heap.Push(h, at(i, len(src)-1))
		}
	}

	result := []*Post{}
	seen := map[int64]bool{}
	for h.Len() > 0 && len(result) < limit {
		c := heap.Pop(h).(cursor)
		if c.pos > 0 {
			heap.Push(h, at(c.src, c.pos-1))
		}
		p := s.posts[c.id]
		_, follows := following[p.Author]
		if (p.Author == user || follows) && !seen[p.ID] { // skip unfollowed + duplicates
			seen[p.ID] = true
			result = append(result, p)
		}
	}
	return result
}

func show(feed []*Post) string {
	parts := make([]string, len(feed))
	for i, p := range feed {
		parts[i] = p.Author + ": " + p.Text
	}
	return strings.Join(parts, " | ")
}

func main() {
	svc := NewFeedService(3, 800)
	for _, fan := range []string{"alice", "bob", "carol"} {
		svc.Follow(fan, "virat") // virat -> celebrity
	}
	svc.Follow("alice", "bob")
	svc.Follow("carol", "bob")

	svc.Post("bob", "Biryani at Paradise tonight?")
	svc.Post("virat", "Century! Thanks for the love")
	svc.Post("carol", "Learning system design") // alice does not follow carol
	svc.Post("bob", "Booked the table for 8")
	svc.Post("alice", "Anyone up for cricket?")

	pushed := 0
	for _, id := range svc.feeds["alice"] {
		if svc.posts[id].Author == "virat" {
			pushed++
		}
	}
	fmt.Println("virat is celebrity:", svc.IsCelebrity("virat"))
	fmt.Println("virat posts pushed into alice's precomputed feed:", pushed)
	fmt.Println("alice feed:", show(svc.GetFeed("alice", 10)))
	fmt.Println("alice feed (limit 2):", show(svc.GetFeed("alice", 2)))
	svc.Unfollow("alice", "bob")
	fmt.Println("after unfollowing bob:", show(svc.GetFeed("alice", 10)))
}`,
    },
  },
  diagrams: {
    arch: String.raw`flowchart LR
  C[Client] --> LB["Load balancer / API gateway"]
  C -. media .-> CDN["CDN"]
  CDN --> OS[("Object storage")]
  LB --> PS["Post service"]
  LB --> FS["Feed service"]
  LB --> GS["Graph service"]
  PS --> PDB[("Posts DB")]
  PS --> PC[("Post cache")]
  PS --> K[["Kafka: PostCreated"]]
  K --> FW["Fan-out workers"]
  FW --> GS
  GS --> GDB[("Follows DB")]
  FW --> FC[("Redis feed cache")]
  FS --> FC
  FS --> PC
  FS --> US["User service"]
  FS --> RK["Ranking service"]`,
    push: String.raw`sequenceDiagram
  participant B as Bob
  participant P as Post service
  participant K as Kafka
  participant W as Fan-out worker
  participant G as Graph service
  participant R as Redis feeds
  B->>P: POST /v1/posts
  P->>P: store post, id 1789
  P->>K: PostCreated 1789 by Bob
  P-->>B: 201 Created
  K->>W: consume event
  W->>G: followers of Bob, page 1
  G-->>W: 1,000 follower ids
  W->>R: pipeline LPUSH + LTRIM per follower
  W->>G: next page
  G-->>W: done`,
    pull: String.raw`sequenceDiagram
  participant A as Alice
  participant F as Feed service
  participant G as Graph service
  participant U as user_posts store
  A->>F: GET /v1/feed
  F->>G: whom does Alice follow?
  G-->>F: 300 followee ids
  F->>U: latest posts of each followee
  U-->>F: 300 sorted lists
  F->>F: k-way merge, take 20
  F-->>A: 20 posts + cursor`,
    read: String.raw`sequenceDiagram
  participant A as Alice
  participant F as Feed service
  participant R as Redis feeds
  participant U as user_posts cache
  participant PC as Post cache
  participant RK as Ranker
  A->>F: GET /v1/feed?cursor=X
  F->>R: LRANGE feed:alice
  R-->>F: precomputed post ids
  F->>U: latest ids of followed celebrities
  U-->>F: celebrity post ids
  F->>F: heap merge, dedupe, filter unfollowed
  F->>PC: MGET posts (hydrate)
  PC-->>F: post bodies
  F->>RK: score candidates
  RK-->>F: ordered posts
  F-->>A: page + next_cursor`,
  },
});
