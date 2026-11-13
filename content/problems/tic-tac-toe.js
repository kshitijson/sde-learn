SD.register({
  id: "tic-tac-toe",
  html: String.raw`
<p class="lead">"Design Tic-Tac-Toe" and "Design Snake &amp; Ladder" are the most common warm-up machine-coding rounds for SDE 1 roles at Flipkart, Swiggy, PhonePe, Paytm and many startups. Everyone knows the rules, so there is nothing to clarify about the game itself. That is the point: the interviewer is watching how you model it. Do you hard-code a 3x3 board and two players, or can your code handle a 10x10 board with 4 players? Do you scan the whole board after every move, or check a win in constant time? Can you add undo without rewriting the game? This page builds both games on the same Game, Player and Board ideas, with full runnable code in five languages.</p>

<h2>Problem statement</h2>
<p><strong>Tic-tac-toe.</strong> Design a game that two or more players play on an N x N grid. Players take turns placing their own symbol on an empty cell. The first player to fill a whole row, column or diagonal with their symbol wins. If the board fills up with no winner, the game is a draw. The design should support any board size, any number of players, and different winning rules, and should let a player undo the last move.</p>
<p><strong>Snake &amp; Ladder.</strong> Design the board game where players roll a die and move forward. Landing on the bottom of a ladder takes you up; landing on the head of a snake takes you down. The first player to reach the last cell exactly wins. Board size, snakes, ladders and the dice should all be configurable.</p>
<p>Interviewers usually ask for one of the two and keep the other as a follow-up: "now reuse your design for Snake &amp; Ladder". Both are covered here.</p>

<div class="callout tip"><strong>Try it first</strong>Before reading on, take 10 minutes. Write down the classes for tic-tac-toe on a 3x3 board. Then ask yourself three questions. What changes if the board is 15x15 and you need 5 in a row (Gomoku)? What does your win check cost per move on a 1000x1000 board? And how would you write a unit test for Snake &amp; Ladder when the dice are random?</div>

<details class="hint"><summary>Hint 1: Do not scan the board after every move</summary>
<p>A full scan checks every row, every column and both diagonals: O(n<sup>2</sup>) work per move. But a new move can only complete the <em>one</em> row, <em>one</em> column and at most two diagonals that pass through it. Keep a counter per player for each row, each column and the two diagonals. A move adds 1 to at most four counters. If any reaches n, that player has won. That is O(1) per move.</p>
</details>
<details class="hint"><summary>Hint 2: Separate "the rules" from "the game loop"</summary>
<p>Taking turns, validating a move and recording history is the same no matter how you win. Deciding the winner is the part that changes: full line, K in a row, four corners. Put the winning rule behind a <code>WinStrategy</code> interface and inject it. The game loop never changes.</p>
</details>
<details class="hint"><summary>Hint 3: Randomness is a dependency</summary>
<p>If <code>Game</code> calls <code>Math.random()</code> directly, you cannot write a test that says "Asha rolls a 3 and climbs the ladder". Hide the dice behind a <code>Dice</code> interface. Production uses a random dice; tests and the demo use a <code>ScriptedDice</code> that returns a fixed list of rolls. The same idea applies to clocks, IDs and network calls.</p>
</details>

<h2>Requirements</h2>
<p>Even for a familiar game, spend two minutes confirming scope. Good questions: Is the board always 3x3? Always two players? Do we need undo? Is it a console game, or will it be played over the network later? Do we need an AI opponent?</p>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li>Board of size N x N (N &ge; 3), K players (K &ge; 2), each with a unique symbol.</li>
<li>Players move in a fixed order. A move is a (row, column) pair.</li>
<li>Reject invalid moves: outside the board, cell already taken, game already over. The same player tries again.</li>
<li>Detect a win after each move: full row, column or either diagonal by default.</li>
<li>Detect a draw when the board is full and nobody has won.</li>
<li>Undo the last move (while the game is in progress).</li>
<li>Pluggable winning rule, for example "3 in a row on a 4x4 board".</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Fast win check:</strong> O(1) per move for the default rule, not a full board scan.</li>
<li><strong>Extensible:</strong> new win rules, new player types (human, bot), bigger boards, without editing the game loop.</li>
<li><strong>Testable:</strong> the whole game can be driven by a script of moves, with deterministic output.</li>
<li><strong>Readable:</strong> small classes, each with one job. This is what the evaluator reads.</li>
<li><strong>Scale is tiny:</strong> one game in memory. Persistence and networking are follow-ups.</li>
</ul>
</div>
</div>

<h2>How to approach the 60 to 90 minute machine-coding round</h2>
<div class="callout info"><strong>Time plan</strong>
<table>
<thead><tr><th>Minutes</th><th>What you do</th></tr></thead>
<tbody>
<tr><td>0 to 5</td><td>Confirm board size, player count, win rule, undo, and what you will skip (UI, network, AI).</td></tr>
<tr><td>5 to 15</td><td>List entities: <code>Player</code>, <code>Board</code>, <code>Game</code>, <code>WinStrategy</code>, <code>MoveCommand</code>, <code>GameState</code>. Sketch the class diagram in comments.</td></tr>
<tr><td>15 to 45</td><td>Code <code>Board</code> and <code>Player</code>, then the counter-based <code>WinStrategy</code>, then <code>Game.play()</code> with validation, then undo.</td></tr>
<tr><td>45 to 60</td><td>Write a scripted demo: a win, a rejected move, an undo, a draw. Run it.</td></tr>
<tr><td>60 to 90</td><td>Second win rule or Snake &amp; Ladder if asked. Walk through extensibility: bots, timers, network play.</td></tr>
</tbody>
</table>
<p><strong>What evaluators check:</strong></p>
<ol>
<li><strong>No hard-coding:</strong> N and K are parameters. No <code>if (board[0][0] == board[0][1] &amp;&amp; ...)</code> chains.</li>
<li><strong>Win check complexity:</strong> can you explain why yours is O(1) or O(n), not O(n<sup>2</sup>)?</li>
<li><strong>Validation:</strong> bad moves are rejected with a clear message and do not change whose turn it is.</li>
<li><strong>Separation:</strong> the board stores cells, the strategy decides wins, the game runs turns.</li>
<li><strong>A running demo</strong> that covers more than the happy path.</li>
</ol>
</div>

<h2>Core entities</h2>
<table>
<thead><tr><th>Entity</th><th>Kind</th><th>Responsibility</th></tr></thead>
<tbody>
<tr><td><code>Player</code></td><td>Value object</td><td>Name and symbol. Later: a <code>MoveSource</code> (human input or bot).</td></tr>
<tr><td><code>Board</code></td><td>Entity</td><td>N x N cells holding a player index or EMPTY. Bounds check, place, clear, is-full. Knows nothing about winning.</td></tr>
<tr><td><code>WinStrategy</code></td><td>Interface (Strategy)</td><td><code>onMove(board, r, c, player)</code> returns true if that move wins; <code>onUndo</code> lets stateful strategies roll back.</td></tr>
<tr><td><code>CounterWinStrategy</code></td><td>Strategy</td><td>Full row, column or diagonal using per-player counters. O(1) per move.</td></tr>
<tr><td><code>LineWinStrategy</code></td><td>Strategy</td><td>K in a row (Gomoku style). Walks the 4 lines through the last move. O(K) per move.</td></tr>
<tr><td><code>MoveCommand</code></td><td>Command</td><td>One move: <code>execute()</code> places it, <code>undo()</code> removes it and rolls back the strategy.</td></tr>
<tr><td><code>Game</code></td><td>Coordinator</td><td>Turn order, validation, history stack, state (IN_PROGRESS, WON, DRAW), winner.</td></tr>
</tbody>
</table>

<h2>Class diagram</h2>
<div data-diagram="classes" data-caption="Tic-tac-toe. The Game coordinates; the Board stores; the WinStrategy decides; each MoveCommand can undo itself."></div>

<h2>Game lifecycle</h2>
<div data-diagram="states" data-caption="A game has three states. Invalid moves and undo keep it in progress; a win or a full board ends it."></div>
<p>The lifecycle is small enough that an enum (<code>IN_PROGRESS</code>, <code>WON</code>, <code>DRAW</code>) is the right tool. You do not need the full State pattern from the <a href="#/p/vending-machine">vending machine</a> here, because only one method (<code>play</code>) cares about the state, and the check is one line. Reach for State classes when many actions behave differently in many states; reach for an enum when one guard clause is enough. Saying this out loud shows judgement, which scores better than using every pattern you know.</p>

<h2>The O(1) win check</h2>
<p>The naive approach scans the board after every move: check all n rows, all n columns and both diagonals. Each check reads n cells, so one move costs about 2n<sup>2</sup> + 2n reads. On a 3x3 board that is 24 reads, which is nothing. But the interviewer will ask "what about 1000x1000?" and that is two million reads per move.</p>
<p>The key observation: a move at (r, c) can only complete row r, column c, the main diagonal (if r == c) and the anti-diagonal (if r + c == n - 1). So keep counters:</p>
<ul>
<li><code>rows[p][r]</code>: how many cells player p owns in row r.</li>
<li><code>cols[p][c]</code>: the same for column c.</li>
<li><code>diag[p]</code> and <code>anti[p]</code>: the same for the two diagonals.</li>
</ul>
<p>A move increments at most four counters and checks whether any of them equals n. That is O(1) time. Memory is O(K x n) for K players, which is tiny. Undo simply decrements the same counters, which is why <code>WinStrategy</code> has an <code>onUndo</code> hook.</p>
<figure class="svg-fig">
<svg viewBox="0 0 560 250" role="img" aria-label="A 3x3 board with X on two cells of the top row and the counters for player X">
<rect class="s-accent" x="20" y="30" width="60" height="60" rx="10"/>
<rect class="s-accent" x="85" y="30" width="60" height="60" rx="10"/>
<rect class="s-green" x="150" y="30" width="60" height="60" rx="10"/>
<rect class="s-box" x="20" y="95" width="60" height="60" rx="10"/>
<rect class="s-box" x="85" y="95" width="60" height="60" rx="10"/>
<rect class="s-box" x="150" y="95" width="60" height="60" rx="10"/>
<rect class="s-box" x="20" y="160" width="60" height="60" rx="10"/>
<rect class="s-box" x="85" y="160" width="60" height="60" rx="10"/>
<rect class="s-box" x="150" y="160" width="60" height="60" rx="10"/>
<text class="s-title" x="50" y="66" text-anchor="middle">X</text>
<text class="s-title" x="115" y="66" text-anchor="middle">X</text>
<text class="s-title" x="180" y="66" text-anchor="middle">X?</text>
<text class="s-title" x="115" y="131" text-anchor="middle">O</text>
<text class="s-title" x="50" y="131" text-anchor="middle">O</text>
<text class="s-muted" x="115" y="242" text-anchor="middle">X is about to play (0,2)</text>
<line class="s-line" x1="225" y1="125" x2="275" y2="125" marker-end="url(#arrow)"/>
<rect class="s-box" x="290" y="20" width="250" height="210" rx="10"/>
<text class="s-title" x="415" y="46" text-anchor="middle">Counters for X</text>
<text class="s-text" x="415" y="80" text-anchor="middle">rows[X] = [2, 0, 0] then [3, 0, 0]</text>
<text class="s-text" x="415" y="108" text-anchor="middle">cols[X] = [1, 1, 0] then [1, 1, 1]</text>
<text class="s-text" x="415" y="136" text-anchor="middle">diag[X] = 1 (unchanged)</text>
<text class="s-text" x="415" y="164" text-anchor="middle">anti[X] = 0 then 1</text>
<text class="s-title" x="415" y="200" text-anchor="middle">rows[X][0] == 3: X wins</text>
</svg>
<figcaption>Only four counters can change on a move. Win check = "did any of them just reach n?"</figcaption>
</figure>
<table>
<thead><tr><th>Approach</th><th>Time per move</th><th>Extra memory</th><th>Works for</th></tr></thead>
<tbody>
<tr><td>Scan the whole board</td><td>O(n<sup>2</sup>)</td><td>None</td><td>Any rule, but slow on big boards</td></tr>
<tr><td>Scan only the lines through the last move</td><td>O(n)</td><td>None</td><td>Full lines; also K in a row</td></tr>
<tr><td>Per-player line counters</td><td>O(1)</td><td>O(K x n)</td><td>Full row, column, diagonal only</td></tr>
<tr><td>Walk outwards from the last move in 4 directions</td><td>O(K) for K in a row</td><td>None</td><td>Gomoku and "connect K" rules</td></tr>
</tbody>
</table>
<p>Counters do not work for "3 in a row on a 4x4 board", because a row can hold 3 of your symbols without them being next to each other (X X O X). For that rule, <code>LineWinStrategy</code> walks outwards from the last move in each of the four directions (horizontal, vertical, two diagonals) and counts how many of the same symbol sit next to each other. That costs O(K), still far better than a full scan. Both rules sit behind the same interface, and the demo plays one game with each.</p>
<div class="callout info"><strong>The two-player trick</strong>For exactly two players, a common shortcut is one counter per line: add +1 for X and -1 for O, and X wins when a counter reaches +n, O when it reaches -n. It saves memory but breaks the moment a third player joins. Per-player counters cost a little more memory and work for any K. Mention the trick, then explain why you did not use it.</div>

<h2>Design patterns used and why</h2>
<h3>Strategy: the winning rule</h3>
<p><code>WinStrategy</code> is the part most likely to change: Gomoku needs 5 in a row, some variants count the four corners, a kids' version might need only 2 in a row. The <code>Game</code> receives a strategy in its constructor and calls <code>onMove</code> after each placement. Adding a rule means adding a class; the game loop does not change. That is the open/closed principle from <a href="#/p/solid">SOLID</a> in action, and it is the single biggest thing evaluators look for in this round. See <a href="#/p/behavioral-patterns">behavioural patterns</a> for the general pattern.</p>
<h3>Command: undo</h3>
<p>Each move is a <code>MoveCommand</code> object that knows how to <code>execute()</code> and how to <code>undo()</code> itself. The game pushes executed commands onto a history stack. Undo pops the last one and calls <code>undo()</code>, which clears the cell <em>and</em> tells the strategy to roll back its counters. Without the command object, undo logic would be spread across the game, the board and the strategy. The same history stack gives you replay (execute every command again on a fresh board) and redo (a second stack) almost for free.</p>
<h3>Why not Singleton, and where Factory fits</h3>
<p>Some candidates make <code>Game</code> or <code>Board</code> a Singleton because "there is only one game". It is wrong as soon as a server hosts 10,000 games at once, and it makes tests share state. Create objects in <code>main</code> and pass them in. A small factory is fine for wiring standard setups, for example <code>GameFactory.classic(players)</code> that builds a 3x3 board with <code>CounterWinStrategy</code>; see <a href="#/p/creational-patterns">creational patterns</a>.</p>
<h3>Plain OOP first</h3>
<p>Most of the marks come from basic <a href="#/p/oop">object-oriented design</a>: the board does not know about players' names, the strategy does not print, the game does not touch the counters directly. Each class has one reason to change. Patterns are the cherry on top, not the cake.</p>

<h2>Full implementation: tic-tac-toe</h2>
<p>Each tab is one self-contained file that compiles and runs. The demo plays three scripted games: a win with rejected moves and an undo on 3x3, a draw on 3x3, and a three-player game on 4x4 where 3 in a row wins.</p>
<div data-code="ttt"></div>
<p>Expected output (identical in every language):</p>
<pre><code>== Game 1: 3x3, two players, counter strategy, undo ==
Asha (X) plays (0,0)
Rejected: (0,0) is already taken, still Ravi's turn
Rejected: (3,1) is outside the 3x3 board
Ravi (O) plays (1,1)
Asha (X) plays (0,1)
Ravi (O) plays (2,2)
Undo: removed Ravi's move at (2,2), Ravi to play
Ravi (O) plays (1,0)
Asha (X) plays (0,2)
Asha wins!
Rejected: game is over
X X X
O O .
. . .
State: WON
== Game 2: 3x3 draw ==
Asha (X) plays (0,0)
Ravi (O) plays (1,1)
Asha (X) plays (2,2)
Ravi (O) plays (0,2)
Asha (X) plays (2,0)
Ravi (O) plays (1,0)
Asha (X) plays (1,2)
Ravi (O) plays (2,1)
Asha (X) plays (0,1)
Draw: the board is full
X X O
O O X
X O X
State: DRAW
== Game 3: 4x4, three players, 3 in a row ==
Asha (X) plays (0,0)
Ravi (O) plays (0,1)
Meera (A) plays (3,3)
Asha (X) plays (1,1)
Ravi (O) plays (0,2)
Meera (A) plays (2,3)
Asha (X) plays (2,2)
Asha wins!
X O O .
. X . .
. . X A
. . . A
State: WON, winner Asha</code></pre>
<p>Things to point out when you walk through it:</p>
<ul>
<li><strong>Rejected moves do not advance the turn.</strong> After "(0,0) is already taken", it is still Ravi's turn.</li>
<li><strong>Undo restores the turn.</strong> The command remembers which player made the move, so the game simply sets the turn back to that player.</li>
<li><strong>Win is checked before draw.</strong> If the last empty cell completes a line, that is a win, not a draw. Checking in the other order is a classic bug.</li>
<li><strong>The board stores player indexes, not symbols.</strong> That keeps the strategy independent of how players are displayed.</li>
</ul>

<h2>Snake &amp; Ladder</h2>
<p>Snake &amp; Ladder looks different but has the same skeleton: players, a board, turns, and a rule for winning. The new ideas are randomness and a queue of players.</p>
<ul>
<li><strong>Board:</strong> a size (100 in the real game, 30 in the demo) and one map from start cell to end cell. Snakes and ladders are the same thing, a jump, differing only in direction. Validate at construction: a snake must go down, a ladder must go up, nothing may start on the last cell, and no two jumps may start on the same cell.</li>
<li><strong>Players queue:</strong> take the player at the front, play their turn, and put them at the back unless they won. A queue makes turn order obvious and makes "remove a player who left" trivial.</li>
<li><strong>Dice:</strong> an interface with <code>roll()</code>. <code>RandomDice</code> for real games, <code>ScriptedDice</code> for tests and the demo. Two dice, a loaded dice for a "power-up", or a server-side dice for online play are all one more class.</li>
<li><strong>Rules:</strong> you must land exactly on the last cell. If a roll would overshoot, you stay where you are. Variants (extra turn on a 6, three 6s in a row cancels the turn) are small changes inside <code>playTurn</code>, or a <code>RulesStrategy</code> if the interviewer wants many variants.</li>
</ul>
<div data-diagram="snakeClasses" data-caption="Snake &amp; Ladder. The dice is injected, and snakes and ladders are both jumps in one map."></div>
<p>The demo first shows three invalid boards being rejected, then plays a 30-cell game with a scripted dice so that the output is the same on every run and in every language.</p>
<div data-code="snake"></div>
<p>Expected output:</p>
<pre><code>== Board validation ==
Rejected board: snake 30 -&gt; 5: cannot start on cell 0 or the last cell, or leave the board
Rejected board: ladder 12 -&gt; 7 must go up
Rejected board: two jumps start at cell 14
== Game: 30 cells, 2 players, scripted dice ==
Board: 30 cells, 4 ladders, 4 snakes
Asha rolls 3: 0 -&gt; 3, ladder up to 22
Ravi rolls 4: 0 -&gt; 4
Asha rolls 6: 22 -&gt; 28
Ravi rolls 2: 4 -&gt; 6
Asha rolls 1: 28 -&gt; 29
Ravi rolls 5: 6 -&gt; 11, ladder up to 26
Asha rolls 4: needs exactly 1, stays at 29
Ravi rolls 1: 26 -&gt; 27, snake down to 1
Asha rolls 1: 29 -&gt; 30. Asha wins!
Winner: Asha after 9 turns
Final positions: Asha 30, Ravi 1</code></pre>
<p>Why a single <code>jumps</code> map instead of separate snake and ladder lists: the move logic becomes one lookup, "is there a jump starting at my new cell?", and the board can still describe itself by counting each kind. If the interviewer asks for chained jumps (a ladder that ends on a snake's head), replace the single lookup with a loop, and reject cycles when building the board.</p>

<h2>Sharing a Game, Player and Board abstraction</h2>
<p>A popular follow-up is "you have built two games; what would a games platform look like?" Both games follow the same turn loop: pick the current player, get their move (a cell, or a dice roll), apply it, check for the end, advance the turn. That is the Template Method pattern: the base class owns the loop, subclasses fill in the steps.</p>
<pre><code>abstract class TurnBasedGame {
    protected final List&lt;Player&gt; players;
    protected GameState state = GameState.IN_PROGRESS;

    final void playTurn() {                  // the template: same for every game
        Player p = currentPlayer();
        Move m = nextMove(p);                 // tic-tac-toe: ask the player; snakes: roll the dice
        if (!isValid(m)) { reject(m); return; }
        apply(m);
        if (isWin(p)) { state = WON; return; }
        if (isDraw()) { state = DRAW; return; }
        advanceTurn();
    }
    protected abstract Move nextMove(Player p);
    protected abstract boolean isValid(Move m);
    protected abstract void apply(Move m);
    protected abstract boolean isWin(Player p);
    protected boolean isDraw() { return false; }   // snakes &amp; ladders never draws
}</code></pre>
<p>Be honest about the trade-off. Two games is a thin reason to build an inheritance hierarchy, and the shared code is about ten lines. In the round, build each game cleanly and <em>describe</em> the shared abstraction. If the interviewer pushes for it, extract it. Prefer composition where you can: a <code>MoveSource</code> interface (human keyboard, bot, network) shared by every game is often more useful than a deep class tree. The <a href="#/p/design-principles">design principles</a> page covers "composition over inheritance" and YAGNI ("you aren't gonna need it").</p>

<h2>Concurrency and extensibility</h2>
<p>A single console game has no concurrency. The interesting cases appear when the game goes online, like the tic-tac-toe or ludo games inside MPL, Paytm First Games or WinZO.</p>
<ul>
<li><strong>The server is the referee.</strong> Clients send "I want to play (1,2)"; the server validates and applies it. Never trust the client's board, or a modified app will place two symbols at once.</li>
<li><strong>One game, one lock (or one thread).</strong> Two moves for the same game can arrive at the same time (a double tap, a retry). Serialise them per game with a lock around <code>play()</code>, or route all events for a game to one worker (actor style). Different games never share state, so they scale out freely. See <a href="#/p/concurrency">concurrency</a>.</li>
<li><strong>Move numbers stop duplicates.</strong> Each move carries the move number the client expects (say, move 5). If the server is already past move 5, it rejects the stale or duplicate request instead of applying it twice. This is optimistic concurrency with a version number.</li>
<li><strong>Dice live on the server.</strong> In online Snake &amp; Ladder, the client must never roll. The server rolls with a secure random source and logs every roll so disputes can be audited.</li>
</ul>
<div class="tabs">
<section data-tab="Bots">
<p>Add a <code>MoveSource</code> interface with <code>HumanMoveSource</code> (reads input) and <code>BotMoveSource</code>. A simple bot tries to win, then to block, then takes the centre. A perfect bot for 3x3 uses minimax, which is cheap because the game tree is small (under 10! positions). The game loop does not change.</p>
</section>
<section data-tab="Timers">
<p>Online games give each player, say, 30 seconds per move. Add a deadline to the turn. When it passes, a scheduler either plays a random valid move or forfeits the turn. Inject the clock so you can test timeouts without waiting.</p>
</section>
<section data-tab="Replay and persistence">
<p>The history of <code>MoveCommand</code>s <em>is</em> the game. Store it as a list of moves (an event log) and you can replay any game, resume after a crash, or show a "watch replay" feature. Snapshots of the board are just a cache.</p>
</section>
<section data-tab="Early draw">
<p>A 3x3 game is often a dead draw before the board is full. With counters you can detect it: a line is dead once two different players own cells in it. When every line is dead, declare a draw early. It is a good "extra mile" point.</p>
</section>
</div>

<h2>Common mistakes</h2>
<div class="callout warn"><strong>Things that lose marks</strong>
<ul>
<li>Hard-coding a 3x3 board and the 8 winning lines.</li>
<li>Scanning the entire board after every move, and not knowing the cost when asked.</li>
<li>Advancing the turn even when the move was rejected.</li>
<li>Checking "board full" before "did this move win", so a winning last move is reported as a draw.</li>
<li>Calling <code>Math.random()</code> inside the game, so Snake &amp; Ladder cannot be tested.</li>
<li>Storing symbols as <code>char</code> everywhere and comparing <code>'X'</code> in the win logic, which breaks when players pick their own symbols.</li>
<li>A <code>Game</code> god class that also prints the board, parses input and checks wins.</li>
</ul>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"I will keep the board size and the player count as parameters. The board only stores cells. The winning rule is a Strategy: the default one keeps a counter per player for every row, column and the two diagonals, so a move updates at most four counters and the win check is O(1) instead of an O(n²) scan. Each move is a Command, so undo pops the history and rolls back the counters. For Snake &amp; Ladder I reuse the same shape: a queue of players, a board with one map of jumps, and an injected Dice so my tests can script every roll."</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>Why is the counter-based win check O(1), and what does it cost in memory?</summary><div>A move at (r, c) can only complete row r, column c and the diagonals through that cell. So the strategy increments at most four counters for that player and checks whether any equals n. That is constant work per move. Memory is one counter per player per row and column, plus two per player for the diagonals: O(K x n), which is tiny compared with the n<sup>2</sup> board itself.</div></details>
<details><summary>Your counters work for full lines. How would you support "5 in a row on a 15x15 board"?</summary><div>Counters cannot tell whether 5 symbols in a row are next to each other. Use a different strategy behind the same interface: from the last move, walk outwards in each of the 4 directions while the cells belong to the same player, and add the two halves plus one. If the total is at least 5, the player has won. That is O(K) per move, where K is the win length. The game loop does not change.</div></details>
<details><summary>How does undo work, and what must be rolled back?</summary><div>Each move is a <code>MoveCommand</code> pushed onto a stack after it runs. Undo pops the latest command, clears the cell on the board, decrements the strategy's counters through <code>onUndo</code>, and sets the turn back to the player who made the move. If the game had already ended, either disallow undo or also reset the state and winner. The demo disallows it to keep the rules simple.</div></details>
<details><summary>How do you make Snake &amp; Ladder testable?</summary><div>Inject the dice. The game depends on a <code>Dice</code> interface, not on a random number generator. Tests pass a <code>ScriptedDice</code> with a fixed list of rolls, so "roll 3, climb the ladder at 3 to 22" is a deterministic assertion. Production passes a <code>RandomDice</code>. The same idea applies to clocks and ID generators.</div></details>
<details><summary>Two players send a move for the same online game at the same moment. What happens?</summary><div>The server must apply moves for one game one at a time: a lock per game, or a single worker per game. Each request also carries the move number the client expects; if it does not match the server's current move number, the request is stale or a duplicate and is rejected. Different games share nothing, so they run in parallel on any number of servers.</div></details>
<details><summary>Should Tic-Tac-Toe and Snake &amp; Ladder share a base class?</summary><div>They share a turn loop (current player, get move, validate, apply, check end, next turn), so a Template Method base class is possible. But with only two games the shared part is a few lines, and inheritance couples them. A good answer builds each game cleanly, shares small interfaces like <code>Player</code> and <code>MoveSource</code>, and extracts a base class only when a third game shows the pattern is real.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>Never hard-code 3x3 or two players. N and K are constructor parameters.</li>
<li>Per-player counters for rows, columns and diagonals make the win check O(1) per move instead of an O(n<sup>2</sup>) scan.</li>
<li>Put the winning rule behind a <code>WinStrategy</code>; K-in-a-row is a second strategy that walks outwards from the last move.</li>
<li>Model moves as Commands to get undo, redo and replay with almost no extra code.</li>
<li>Inject randomness (the dice) so games are deterministic in tests and demos.</li>
<li>Validate moves without changing the turn, and check for a win before checking for a draw.</li>
</ul></div>
`,
  code: {
    ttt: {
      title: "Tic-tac-toe: N x N, K players, pluggable win rule, undo (single file, runnable)",
      java: String.raw`// Tic-tac-toe: N x N board, K players, pluggable win strategy, undo via Command.
// Run: javac TicTacToeDemo.java && java TicTacToeDemo
import java.util.*;

public class TicTacToeDemo {
    static final int EMPTY = -1;

    enum GameState { IN_PROGRESS, WON, DRAW }

    record Player(String name, char symbol) {}

    // Stores the index of the player in each cell, or EMPTY.
    static class Board {
        final int n;
        private final int[][] cells;
        private int filled = 0;

        Board(int n) {
            this.n = n;
            cells = new int[n][n];
            for (int[] row : cells) Arrays.fill(row, EMPTY);
        }
        boolean inBounds(int r, int c) { return r >= 0 && r < n && c >= 0 && c < n; }
        int get(int r, int c) { return cells[r][c]; }
        void place(int r, int c, int p) { cells[r][c] = p; filled++; }
        void clear(int r, int c) { cells[r][c] = EMPTY; filled--; }
        boolean isFull() { return filled == n * n; }

        String render(List<Player> players) {
            StringBuilder sb = new StringBuilder();
            for (int r = 0; r < n; r++) {
                for (int c = 0; c < n; c++) {
                    if (c > 0) sb.append(' ');
                    sb.append(cells[r][c] == EMPTY ? '.' : players.get(cells[r][c]).symbol());
                }
                if (r < n - 1) sb.append('\n');
            }
            return sb.toString();
        }
    }

    // ---------- Strategy: how do we decide that a move wins? ----------
    interface WinStrategy {
        boolean onMove(Board b, int r, int c, int p); // true if this move wins
        default void onUndo(Board b, int r, int c, int p) {}
    }

    // Full row, column or diagonal. O(1) per move: one counter per player per line.
    static class CounterWinStrategy implements WinStrategy {
        private final int n;
        private final int[][] rows, cols;
        private final int[] diag, anti;

        CounterWinStrategy(int n, int k) {
            this.n = n;
            rows = new int[k][n];
            cols = new int[k][n];
            diag = new int[k];
            anti = new int[k];
        }
        private void bump(int r, int c, int p, int delta) {
            rows[p][r] += delta;
            cols[p][c] += delta;
            if (r == c) diag[p] += delta;
            if (r + c == n - 1) anti[p] += delta;
        }
        public boolean onMove(Board b, int r, int c, int p) {
            bump(r, c, p, 1);
            return rows[p][r] == n || cols[p][c] == n || diag[p] == n || anti[p] == n;
        }
        public void onUndo(Board b, int r, int c, int p) { bump(r, c, p, -1); }
    }

    // "Win length in a row" (like Gomoku). Looks only at the 4 lines through the last move.
    static class LineWinStrategy implements WinStrategy {
        private static final int[][] DIRS = {{0, 1}, {1, 0}, {1, 1}, {1, -1}};
        private final int winLength;

        LineWinStrategy(int winLength) { this.winLength = winLength; }

        public boolean onMove(Board b, int r, int c, int p) {
            for (int[] d : DIRS) {
                int count = 1 + run(b, r, c, d[0], d[1], p) + run(b, r, c, -d[0], -d[1], p);
                if (count >= winLength) return true;
            }
            return false;
        }
        private static int run(Board b, int r, int c, int dr, int dc, int p) {
            int count = 0;
            r += dr; c += dc;
            while (b.inBounds(r, c) && b.get(r, c) == p) { count++; r += dr; c += dc; }
            return count;
        }
    }

    // ---------- Command: a move that knows how to undo itself ----------
    record MoveCommand(int r, int c, int p) {
        boolean execute(Game g) {
            g.board.place(r, c, p);
            return g.strategy.onMove(g.board, r, c, p);
        }
        void undo(Game g) {
            g.board.clear(r, c);
            g.strategy.onUndo(g.board, r, c, p);
        }
    }

    static class Game {
        final Board board;
        final List<Player> players;
        final WinStrategy strategy;
        private int turn = 0;
        GameState state = GameState.IN_PROGRESS;
        Player winner = null;
        private final Deque<MoveCommand> history = new ArrayDeque<>();

        Game(int n, List<Player> players, WinStrategy strategy) {
            this.board = new Board(n);
            this.players = players;
            this.strategy = strategy;
        }
        Player current() { return players.get(turn); }

        boolean play(int r, int c) {
            Player who = current();
            if (state != GameState.IN_PROGRESS) { System.out.println("Rejected: game is over"); return false; }
            if (!board.inBounds(r, c)) {
                System.out.printf("Rejected: (%d,%d) is outside the %dx%d board%n", r, c, board.n, board.n);
                return false;
            }
            if (board.get(r, c) != EMPTY) {
                System.out.printf("Rejected: (%d,%d) is already taken, still %s's turn%n", r, c, who.name());
                return false;
            }
            MoveCommand cmd = new MoveCommand(r, c, turn);
            boolean won = cmd.execute(this);
            history.push(cmd);
            System.out.printf("%s (%c) plays (%d,%d)%n", who.name(), who.symbol(), r, c);
            if (won) {
                state = GameState.WON;
                winner = who;
                System.out.println(who.name() + " wins!");
            } else if (board.isFull()) {
                state = GameState.DRAW;
                System.out.println("Draw: the board is full");
            } else {
                turn = (turn + 1) % players.size();
            }
            return true;
        }

        void undo() {
            if (state != GameState.IN_PROGRESS || history.isEmpty()) { System.out.println("Nothing to undo"); return; }
            MoveCommand cmd = history.pop();
            cmd.undo(this);
            turn = cmd.p();
            System.out.printf("Undo: removed %s's move at (%d,%d), %s to play%n",
                    players.get(cmd.p()).name(), cmd.r(), cmd.c(), current().name());
        }
    }

    public static void main(String[] args) {
        System.out.println("== Game 1: 3x3, two players, counter strategy, undo ==");
        List<Player> players = List.of(new Player("Asha", 'X'), new Player("Ravi", 'O'));
        Game g = new Game(3, players, new CounterWinStrategy(3, 2));
        g.play(0, 0);
        g.play(0, 0);
        g.play(3, 1);
        g.play(1, 1);
        g.play(0, 1);
        g.play(2, 2);
        g.undo();
        g.play(1, 0);
        g.play(0, 2);
        g.play(2, 2);
        System.out.println(g.board.render(players));
        System.out.println("State: " + g.state);

        System.out.println("== Game 2: 3x3 draw ==");
        g = new Game(3, players, new CounterWinStrategy(3, 2));
        int[][] moves = {{0, 0}, {1, 1}, {2, 2}, {0, 2}, {2, 0}, {1, 0}, {1, 2}, {2, 1}, {0, 1}};
        for (int[] m : moves) g.play(m[0], m[1]);
        System.out.println(g.board.render(players));
        System.out.println("State: " + g.state);

        System.out.println("== Game 3: 4x4, three players, 3 in a row ==");
        List<Player> trio = List.of(new Player("Asha", 'X'), new Player("Ravi", 'O'), new Player("Meera", 'A'));
        g = new Game(4, trio, new LineWinStrategy(3));
        int[][] moves3 = {{0, 0}, {0, 1}, {3, 3}, {1, 1}, {0, 2}, {2, 3}, {2, 2}};
        for (int[] m : moves3) g.play(m[0], m[1]);
        System.out.println(g.board.render(trio));
        System.out.println("State: " + g.state + ", winner " + g.winner.name());
    }
}`,
      python: String.raw`# Tic-tac-toe: N x N board, K players, pluggable win strategy, undo via Command.
# Run: python3 main.py
from enum import Enum

EMPTY = -1


class GameState(Enum):
    IN_PROGRESS = "IN_PROGRESS"
    WON = "WON"
    DRAW = "DRAW"


class Player:
    def __init__(self, name, symbol):
        self.name = name
        self.symbol = symbol


class Board:
    """Stores the index of the player in each cell, or EMPTY."""

    def __init__(self, n):
        self.n = n
        self.cells = [[EMPTY] * n for _ in range(n)]
        self.filled = 0

    def in_bounds(self, r, c):
        return 0 <= r < self.n and 0 <= c < self.n

    def get(self, r, c):
        return self.cells[r][c]

    def place(self, r, c, p):
        self.cells[r][c] = p
        self.filled += 1

    def clear(self, r, c):
        self.cells[r][c] = EMPTY
        self.filled -= 1

    def is_full(self):
        return self.filled == self.n * self.n

    def render(self, players):
        rows = []
        for r in range(self.n):
            rows.append(" ".join("." if p == EMPTY else players[p].symbol for p in self.cells[r]))
        return "\n".join(rows)


# ---------- Strategy: how do we decide that a move wins? ----------
class WinStrategy:
    def on_move(self, board, r, c, p):  # True if this move wins
        raise NotImplementedError

    def on_undo(self, board, r, c, p):
        pass


class CounterWinStrategy(WinStrategy):
    """Full row, column or diagonal. O(1) per move: one counter per player per line."""

    def __init__(self, n, k):
        self.n = n
        self.rows = [[0] * n for _ in range(k)]
        self.cols = [[0] * n for _ in range(k)]
        self.diag = [0] * k
        self.anti = [0] * k

    def _bump(self, r, c, p, delta):
        n = self.n
        self.rows[p][r] += delta
        self.cols[p][c] += delta
        if r == c:
            self.diag[p] += delta
        if r + c == n - 1:
            self.anti[p] += delta

    def on_move(self, board, r, c, p):
        self._bump(r, c, p, 1)
        n = self.n
        return self.rows[p][r] == n or self.cols[p][c] == n or self.diag[p] == n or self.anti[p] == n

    def on_undo(self, board, r, c, p):
        self._bump(r, c, p, -1)


class LineWinStrategy(WinStrategy):
    """'Win length in a row' (like Gomoku). Looks only at the 4 lines through the last move: O(win length)."""

    DIRS = [(0, 1), (1, 0), (1, 1), (1, -1)]

    def __init__(self, win_length):
        self.win_length = win_length

    def on_move(self, board, r, c, p):
        for dr, dc in self.DIRS:
            count = 1 + self._run(board, r, c, dr, dc, p) + self._run(board, r, c, -dr, -dc, p)
            if count >= self.win_length:
                return True
        return False

    @staticmethod
    def _run(board, r, c, dr, dc, p):
        count = 0
        r, c = r + dr, c + dc
        while board.in_bounds(r, c) and board.get(r, c) == p:
            count += 1
            r, c = r + dr, c + dc
        return count


# ---------- Command: a move that knows how to undo itself ----------
class MoveCommand:
    def __init__(self, r, c, p):
        self.r, self.c, self.p = r, c, p

    def execute(self, game):
        game.board.place(self.r, self.c, self.p)
        return game.strategy.on_move(game.board, self.r, self.c, self.p)

    def undo(self, game):
        game.board.clear(self.r, self.c)
        game.strategy.on_undo(game.board, self.r, self.c, self.p)


class Game:
    def __init__(self, n, players, strategy):
        self.board = Board(n)
        self.players = players
        self.strategy = strategy
        self.turn = 0
        self.state = GameState.IN_PROGRESS
        self.winner = None
        self.history = []

    def current(self):
        return self.players[self.turn]

    def play(self, r, c):
        who = self.current()
        if self.state != GameState.IN_PROGRESS:
            print("Rejected: game is over")
            return False
        if not self.board.in_bounds(r, c):
            print("Rejected: (%d,%d) is outside the %dx%d board" % (r, c, self.board.n, self.board.n))
            return False
        if self.board.get(r, c) != EMPTY:
            print("Rejected: (%d,%d) is already taken, still %s's turn" % (r, c, who.name))
            return False
        cmd = MoveCommand(r, c, self.turn)
        won = cmd.execute(self)
        self.history.append(cmd)
        print("%s (%s) plays (%d,%d)" % (who.name, who.symbol, r, c))
        if won:
            self.state = GameState.WON
            self.winner = who
            print("%s wins!" % who.name)
        elif self.board.is_full():
            self.state = GameState.DRAW
            print("Draw: the board is full")
        else:
            self.turn = (self.turn + 1) % len(self.players)
        return True

    def undo(self):
        if self.state != GameState.IN_PROGRESS or not self.history:
            print("Nothing to undo")
            return
        cmd = self.history.pop()
        cmd.undo(self)
        self.turn = cmd.p
        print("Undo: removed %s's move at (%d,%d), %s to play" % (self.players[cmd.p].name, cmd.r, cmd.c, self.current().name))


def main():
    print("== Game 1: 3x3, two players, counter strategy, undo ==")
    players = [Player("Asha", "X"), Player("Ravi", "O")]
    g = Game(3, players, CounterWinStrategy(3, 2))
    g.play(0, 0)
    g.play(0, 0)
    g.play(3, 1)
    g.play(1, 1)
    g.play(0, 1)
    g.play(2, 2)
    g.undo()
    g.play(1, 0)
    g.play(0, 2)
    g.play(2, 2)
    print(g.board.render(players))
    print("State:", g.state.value)

    print("== Game 2: 3x3 draw ==")
    g = Game(3, players, CounterWinStrategy(3, 2))
    for r, c in [(0, 0), (1, 1), (2, 2), (0, 2), (2, 0), (1, 0), (1, 2), (2, 1), (0, 1)]:
        g.play(r, c)
    print(g.board.render(players))
    print("State:", g.state.value)

    print("== Game 3: 4x4, three players, 3 in a row ==")
    trio = [Player("Asha", "X"), Player("Ravi", "O"), Player("Meera", "A")]
    g = Game(4, trio, LineWinStrategy(3))
    for r, c in [(0, 0), (0, 1), (3, 3), (1, 1), (0, 2), (2, 3), (2, 2)]:
        g.play(r, c)
    print(g.board.render(trio))
    print("State: %s, winner %s" % (g.state.value, g.winner.name))


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Tic-tac-toe: N x N board, K players, pluggable win strategy, undo via Command.
// Build: g++ -std=c++17 -o ttt main.cpp && ./ttt
#include <iostream>
#include <memory>
#include <string>
#include <utility>
#include <vector>
using namespace std;

const int EMPTY = -1;

enum class GameState { IN_PROGRESS, WON, DRAW };
const char* stateName(GameState s) {
    switch (s) {
        case GameState::IN_PROGRESS: return "IN_PROGRESS";
        case GameState::WON: return "WON";
        default: return "DRAW";
    }
}

struct Player {
    string name;
    char symbol;
};

// Stores the index of the player in each cell, or EMPTY.
class Board {
    vector<vector<int>> cells;
    int filled = 0;
public:
    const int n;
    explicit Board(int n) : cells(n, vector<int>(n, EMPTY)), n(n) {}
    bool inBounds(int r, int c) const { return r >= 0 && r < n && c >= 0 && c < n; }
    int get(int r, int c) const { return cells[r][c]; }
    void place(int r, int c, int p) { cells[r][c] = p; filled++; }
    void clear(int r, int c) { cells[r][c] = EMPTY; filled--; }
    bool isFull() const { return filled == n * n; }
    string render(const vector<Player>& players) const {
        string s;
        for (int r = 0; r < n; r++) {
            for (int c = 0; c < n; c++) {
                if (c > 0) s += ' ';
                s += cells[r][c] == EMPTY ? '.' : players[cells[r][c]].symbol;
            }
            if (r < n - 1) s += '\n';
        }
        return s;
    }
};

// ---------- Strategy: how do we decide that a move wins? ----------
class WinStrategy {
public:
    virtual ~WinStrategy() = default;
    virtual bool onMove(const Board& b, int r, int c, int p) = 0; // true if this move wins
    virtual void onUndo(const Board&, int, int, int) {}
};

// Full row, column or diagonal. O(1) per move: one counter per player per line.
class CounterWinStrategy : public WinStrategy {
    int n;
    vector<vector<int>> rows, cols;
    vector<int> diag, anti;
    void bump(int r, int c, int p, int delta) {
        rows[p][r] += delta;
        cols[p][c] += delta;
        if (r == c) diag[p] += delta;
        if (r + c == n - 1) anti[p] += delta;
    }
public:
    CounterWinStrategy(int n, int k)
        : n(n), rows(k, vector<int>(n, 0)), cols(k, vector<int>(n, 0)), diag(k, 0), anti(k, 0) {}
    bool onMove(const Board&, int r, int c, int p) override {
        bump(r, c, p, 1);
        return rows[p][r] == n || cols[p][c] == n || diag[p] == n || anti[p] == n;
    }
    void onUndo(const Board&, int r, int c, int p) override { bump(r, c, p, -1); }
};

// "Win length in a row" (like Gomoku). Looks only at the 4 lines through the last move.
class LineWinStrategy : public WinStrategy {
    int winLength;
    static int run(const Board& b, int r, int c, int dr, int dc, int p) {
        int count = 0;
        r += dr; c += dc;
        while (b.inBounds(r, c) && b.get(r, c) == p) { count++; r += dr; c += dc; }
        return count;
    }
public:
    explicit LineWinStrategy(int winLength) : winLength(winLength) {}
    bool onMove(const Board& b, int r, int c, int p) override {
        const int dirs[4][2] = {{0, 1}, {1, 0}, {1, 1}, {1, -1}};
        for (auto& d : dirs) {
            int count = 1 + run(b, r, c, d[0], d[1], p) + run(b, r, c, -d[0], -d[1], p);
            if (count >= winLength) return true;
        }
        return false;
    }
};

// ---------- Command: a move that knows how to undo itself ----------
struct MoveCommand {
    int r, c, p;
    bool execute(Board& b, WinStrategy& s) const { b.place(r, c, p); return s.onMove(b, r, c, p); }
    void undo(Board& b, WinStrategy& s) const { b.clear(r, c); s.onUndo(b, r, c, p); }
};

class Game {
    vector<Player> players;
    unique_ptr<WinStrategy> strategy;
    int turn = 0;
    vector<MoveCommand> history;
public:
    Board board;
    GameState state = GameState::IN_PROGRESS;
    const Player* winner = nullptr;

    Game(int n, vector<Player> players, unique_ptr<WinStrategy> strategy)
        : players(std::move(players)), strategy(std::move(strategy)), board(n) {}
    const Player& current() const { return players[turn]; }
    const vector<Player>& getPlayers() const { return players; }

    bool play(int r, int c) {
        const Player& who = current();
        if (state != GameState::IN_PROGRESS) { cout << "Rejected: game is over\n"; return false; }
        if (!board.inBounds(r, c)) {
            cout << "Rejected: (" << r << "," << c << ") is outside the " << board.n << "x" << board.n << " board\n";
            return false;
        }
        if (board.get(r, c) != EMPTY) {
            cout << "Rejected: (" << r << "," << c << ") is already taken, still " << who.name << "'s turn\n";
            return false;
        }
        MoveCommand cmd{r, c, turn};
        bool won = cmd.execute(board, *strategy);
        history.push_back(cmd);
        cout << who.name << " (" << who.symbol << ") plays (" << r << "," << c << ")\n";
        if (won) {
            state = GameState::WON;
            winner = &who;
            cout << who.name << " wins!\n";
        } else if (board.isFull()) {
            state = GameState::DRAW;
            cout << "Draw: the board is full\n";
        } else {
            turn = (turn + 1) % (int)players.size();
        }
        return true;
    }

    void undo() {
        if (state != GameState::IN_PROGRESS || history.empty()) { cout << "Nothing to undo\n"; return; }
        MoveCommand cmd = history.back();
        history.pop_back();
        cmd.undo(board, *strategy);
        turn = cmd.p;
        cout << "Undo: removed " << players[cmd.p].name << "'s move at (" << cmd.r << "," << cmd.c << "), "
             << current().name << " to play\n";
    }
};

int main() {
    cout << "== Game 1: 3x3, two players, counter strategy, undo ==\n";
    vector<Player> players = {{"Asha", 'X'}, {"Ravi", 'O'}};
    {
        Game g(3, players, make_unique<CounterWinStrategy>(3, 2));
        g.play(0, 0);
        g.play(0, 0);
        g.play(3, 1);
        g.play(1, 1);
        g.play(0, 1);
        g.play(2, 2);
        g.undo();
        g.play(1, 0);
        g.play(0, 2);
        g.play(2, 2);
        cout << g.board.render(players) << "\n";
        cout << "State: " << stateName(g.state) << "\n";
    }
    cout << "== Game 2: 3x3 draw ==\n";
    {
        Game g(3, players, make_unique<CounterWinStrategy>(3, 2));
        vector<pair<int, int>> moves = {{0, 0}, {1, 1}, {2, 2}, {0, 2}, {2, 0}, {1, 0}, {1, 2}, {2, 1}, {0, 1}};
        for (auto& m : moves) g.play(m.first, m.second);
        cout << g.board.render(players) << "\n";
        cout << "State: " << stateName(g.state) << "\n";
    }
    cout << "== Game 3: 4x4, three players, 3 in a row ==\n";
    {
        vector<Player> trio = {{"Asha", 'X'}, {"Ravi", 'O'}, {"Meera", 'A'}};
        Game g(4, trio, make_unique<LineWinStrategy>(3));
        vector<pair<int, int>> moves = {{0, 0}, {0, 1}, {3, 3}, {1, 1}, {0, 2}, {2, 3}, {2, 2}};
        for (auto& m : moves) g.play(m.first, m.second);
        cout << g.board.render(trio) << "\n";
        cout << "State: " << stateName(g.state) << ", winner " << g.winner->name << "\n";
    }
    return 0;
}`,
      javascript: String.raw`// Tic-tac-toe: N x N board, K players, pluggable win strategy, undo via Command.
// Run: node main.js
"use strict";

const EMPTY = -1;
const GameState = Object.freeze({ IN_PROGRESS: "IN_PROGRESS", WON: "WON", DRAW: "DRAW" });

class Player {
  constructor(name, symbol) {
    this.name = name;
    this.symbol = symbol;
  }
}

// Stores the index of the player in each cell, or EMPTY.
class Board {
  constructor(n) {
    this.n = n;
    this.cells = Array.from({ length: n }, () => new Array(n).fill(EMPTY));
    this.filled = 0;
  }
  inBounds(r, c) { return r >= 0 && r < this.n && c >= 0 && c < this.n; }
  get(r, c) { return this.cells[r][c]; }
  place(r, c, p) { this.cells[r][c] = p; this.filled++; }
  clear(r, c) { this.cells[r][c] = EMPTY; this.filled--; }
  isFull() { return this.filled === this.n * this.n; }
  render(players) {
    return this.cells.map((row) => row.map((p) => (p === EMPTY ? "." : players[p].symbol)).join(" ")).join("\n");
  }
}

// ---------- Strategy: how do we decide that a move wins? ----------
// Interface: onMove(board, r, c, p) -> true if this move wins; onUndo(board, r, c, p).

// Full row, column or diagonal. O(1) per move: one counter per player per line.
class CounterWinStrategy {
  constructor(n, k) {
    this.n = n;
    this.rows = Array.from({ length: k }, () => new Array(n).fill(0));
    this.cols = Array.from({ length: k }, () => new Array(n).fill(0));
    this.diag = new Array(k).fill(0);
    this.anti = new Array(k).fill(0);
  }
  bump(r, c, p, delta) {
    this.rows[p][r] += delta;
    this.cols[p][c] += delta;
    if (r === c) this.diag[p] += delta;
    if (r + c === this.n - 1) this.anti[p] += delta;
  }
  onMove(board, r, c, p) {
    this.bump(r, c, p, 1);
    const n = this.n;
    return this.rows[p][r] === n || this.cols[p][c] === n || this.diag[p] === n || this.anti[p] === n;
  }
  onUndo(board, r, c, p) { this.bump(r, c, p, -1); }
}

// "Win length in a row" (like Gomoku). Looks only at the 4 lines through the last move.
class LineWinStrategy {
  constructor(winLength) { this.winLength = winLength; }
  onMove(board, r, c, p) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const count = 1 + LineWinStrategy.run(board, r, c, dr, dc, p) + LineWinStrategy.run(board, r, c, -dr, -dc, p);
      if (count >= this.winLength) return true;
    }
    return false;
  }
  onUndo() {}
  static run(board, r, c, dr, dc, p) {
    let count = 0;
    r += dr; c += dc;
    while (board.inBounds(r, c) && board.get(r, c) === p) { count++; r += dr; c += dc; }
    return count;
  }
}

// ---------- Command: a move that knows how to undo itself ----------
class MoveCommand {
  constructor(r, c, p) { this.r = r; this.c = c; this.p = p; }
  execute(game) {
    game.board.place(this.r, this.c, this.p);
    return game.strategy.onMove(game.board, this.r, this.c, this.p);
  }
  undo(game) {
    game.board.clear(this.r, this.c);
    game.strategy.onUndo(game.board, this.r, this.c, this.p);
  }
}

class Game {
  constructor(n, players, strategy) {
    this.board = new Board(n);
    this.players = players;
    this.strategy = strategy;
    this.turn = 0;
    this.state = GameState.IN_PROGRESS;
    this.winner = null;
    this.history = [];
  }
  current() { return this.players[this.turn]; }

  play(r, c) {
    const who = this.current();
    if (this.state !== GameState.IN_PROGRESS) { console.log("Rejected: game is over"); return false; }
    const n = this.board.n;
    if (!this.board.inBounds(r, c)) {
      console.log("Rejected: (" + r + "," + c + ") is outside the " + n + "x" + n + " board");
      return false;
    }
    if (this.board.get(r, c) !== EMPTY) {
      console.log("Rejected: (" + r + "," + c + ") is already taken, still " + who.name + "'s turn");
      return false;
    }
    const cmd = new MoveCommand(r, c, this.turn);
    const won = cmd.execute(this);
    this.history.push(cmd);
    console.log(who.name + " (" + who.symbol + ") plays (" + r + "," + c + ")");
    if (won) {
      this.state = GameState.WON;
      this.winner = who;
      console.log(who.name + " wins!");
    } else if (this.board.isFull()) {
      this.state = GameState.DRAW;
      console.log("Draw: the board is full");
    } else {
      this.turn = (this.turn + 1) % this.players.length;
    }
    return true;
  }

  undo() {
    if (this.state !== GameState.IN_PROGRESS || this.history.length === 0) { console.log("Nothing to undo"); return; }
    const cmd = this.history.pop();
    cmd.undo(this);
    this.turn = cmd.p;
    console.log("Undo: removed " + this.players[cmd.p].name + "'s move at (" + cmd.r + "," + cmd.c + "), " +
      this.current().name + " to play");
  }
}

function main() {
  console.log("== Game 1: 3x3, two players, counter strategy, undo ==");
  const players = [new Player("Asha", "X"), new Player("Ravi", "O")];
  let g = new Game(3, players, new CounterWinStrategy(3, 2));
  g.play(0, 0);
  g.play(0, 0);
  g.play(3, 1);
  g.play(1, 1);
  g.play(0, 1);
  g.play(2, 2);
  g.undo();
  g.play(1, 0);
  g.play(0, 2);
  g.play(2, 2);
  console.log(g.board.render(players));
  console.log("State: " + g.state);

  console.log("== Game 2: 3x3 draw ==");
  g = new Game(3, players, new CounterWinStrategy(3, 2));
  for (const [r, c] of [[0, 0], [1, 1], [2, 2], [0, 2], [2, 0], [1, 0], [1, 2], [2, 1], [0, 1]]) g.play(r, c);
  console.log(g.board.render(players));
  console.log("State: " + g.state);

  console.log("== Game 3: 4x4, three players, 3 in a row ==");
  const trio = [new Player("Asha", "X"), new Player("Ravi", "O"), new Player("Meera", "A")];
  g = new Game(4, trio, new LineWinStrategy(3));
  for (const [r, c] of [[0, 0], [0, 1], [3, 3], [1, 1], [0, 2], [2, 3], [2, 2]]) g.play(r, c);
  console.log(g.board.render(trio));
  console.log("State: " + g.state + ", winner " + g.winner.name);
}

main();`,
      go: String.raw`// Tic-tac-toe: N x N board, K players, pluggable win strategy, undo via Command.
// Run: go run main.go
package main

import (
	"fmt"
	"strings"
)

const Empty = -1

type GameState string

const (
	InProgress GameState = "IN_PROGRESS"
	Won        GameState = "WON"
	Draw       GameState = "DRAW"
)

type Player struct {
	Name   string
	Symbol byte
}

// Board stores the index of the player in each cell, or Empty.
type Board struct {
	N      int
	cells  [][]int
	filled int
}

func NewBoard(n int) *Board {
	cells := make([][]int, n)
	for r := range cells {
		cells[r] = make([]int, n)
		for c := range cells[r] {
			cells[r][c] = Empty
		}
	}
	return &Board{N: n, cells: cells}
}

func (b *Board) InBounds(r, c int) bool { return r >= 0 && r < b.N && c >= 0 && c < b.N }
func (b *Board) Get(r, c int) int       { return b.cells[r][c] }
func (b *Board) Place(r, c, p int)      { b.cells[r][c] = p; b.filled++ }
func (b *Board) Clear(r, c int)         { b.cells[r][c] = Empty; b.filled-- }
func (b *Board) IsFull() bool           { return b.filled == b.N*b.N }

func (b *Board) Render(players []Player) string {
	lines := make([]string, b.N)
	for r := 0; r < b.N; r++ {
		cells := make([]string, b.N)
		for c := 0; c < b.N; c++ {
			if p := b.cells[r][c]; p == Empty {
				cells[c] = "."
			} else {
				cells[c] = string(players[p].Symbol)
			}
		}
		lines[r] = strings.Join(cells, " ")
	}
	return strings.Join(lines, "\n")
}

// ---------- Strategy: how do we decide that a move wins? ----------
type WinStrategy interface {
	OnMove(b *Board, r, c, p int) bool // true if this move wins
	OnUndo(b *Board, r, c, p int)
}

// CounterWinStrategy: full row, column or diagonal. O(1) per move: one counter per player per line.
type CounterWinStrategy struct {
	n          int
	rows, cols [][]int
	diag, anti []int
}

func NewCounterWinStrategy(n, k int) *CounterWinStrategy {
	s := &CounterWinStrategy{n: n, rows: make([][]int, k), cols: make([][]int, k), diag: make([]int, k), anti: make([]int, k)}
	for p := 0; p < k; p++ {
		s.rows[p] = make([]int, n)
		s.cols[p] = make([]int, n)
	}
	return s
}

func (s *CounterWinStrategy) bump(r, c, p, delta int) {
	s.rows[p][r] += delta
	s.cols[p][c] += delta
	if r == c {
		s.diag[p] += delta
	}
	if r+c == s.n-1 {
		s.anti[p] += delta
	}
}

func (s *CounterWinStrategy) OnMove(_ *Board, r, c, p int) bool {
	s.bump(r, c, p, 1)
	return s.rows[p][r] == s.n || s.cols[p][c] == s.n || s.diag[p] == s.n || s.anti[p] == s.n
}

func (s *CounterWinStrategy) OnUndo(_ *Board, r, c, p int) { s.bump(r, c, p, -1) }

// LineWinStrategy: "win length in a row" (like Gomoku). Looks only at the 4 lines through the last move.
type LineWinStrategy struct{ WinLength int }

func run(b *Board, r, c, dr, dc, p int) int {
	count := 0
	r, c = r+dr, c+dc
	for b.InBounds(r, c) && b.Get(r, c) == p {
		count++
		r, c = r+dr, c+dc
	}
	return count
}

func (s LineWinStrategy) OnMove(b *Board, r, c, p int) bool {
	dirs := [4][2]int{{0, 1}, {1, 0}, {1, 1}, {1, -1}}
	for _, d := range dirs {
		if 1+run(b, r, c, d[0], d[1], p)+run(b, r, c, -d[0], -d[1], p) >= s.WinLength {
			return true
		}
	}
	return false
}

func (s LineWinStrategy) OnUndo(*Board, int, int, int) {}

// ---------- Command: a move that knows how to undo itself ----------
type MoveCommand struct{ R, C, P int }

func (m MoveCommand) Execute(g *Game) bool {
	g.Board.Place(m.R, m.C, m.P)
	return g.strategy.OnMove(g.Board, m.R, m.C, m.P)
}

func (m MoveCommand) Undo(g *Game) {
	g.Board.Clear(m.R, m.C)
	g.strategy.OnUndo(g.Board, m.R, m.C, m.P)
}

type Game struct {
	Board    *Board
	players  []Player
	strategy WinStrategy
	turn     int
	State    GameState
	Winner   *Player
	history  []MoveCommand
}

func NewGame(n int, players []Player, s WinStrategy) *Game {
	return &Game{Board: NewBoard(n), players: players, strategy: s, State: InProgress}
}

func (g *Game) Current() *Player { return &g.players[g.turn] }

func (g *Game) Play(r, c int) bool {
	who := g.Current()
	if g.State != InProgress {
		fmt.Println("Rejected: game is over")
		return false
	}
	if !g.Board.InBounds(r, c) {
		fmt.Printf("Rejected: (%d,%d) is outside the %dx%d board\n", r, c, g.Board.N, g.Board.N)
		return false
	}
	if g.Board.Get(r, c) != Empty {
		fmt.Printf("Rejected: (%d,%d) is already taken, still %s's turn\n", r, c, who.Name)
		return false
	}
	cmd := MoveCommand{r, c, g.turn}
	won := cmd.Execute(g)
	g.history = append(g.history, cmd)
	fmt.Printf("%s (%c) plays (%d,%d)\n", who.Name, who.Symbol, r, c)
	switch {
	case won:
		g.State = Won
		g.Winner = who
		fmt.Println(who.Name + " wins!")
	case g.Board.IsFull():
		g.State = Draw
		fmt.Println("Draw: the board is full")
	default:
		g.turn = (g.turn + 1) % len(g.players)
	}
	return true
}

func (g *Game) Undo() {
	if g.State != InProgress || len(g.history) == 0 {
		fmt.Println("Nothing to undo")
		return
	}
	cmd := g.history[len(g.history)-1]
	g.history = g.history[:len(g.history)-1]
	cmd.Undo(g)
	g.turn = cmd.P
	fmt.Printf("Undo: removed %s's move at (%d,%d), %s to play\n", g.players[cmd.P].Name, cmd.R, cmd.C, g.Current().Name)
}

func main() {
	fmt.Println("== Game 1: 3x3, two players, counter strategy, undo ==")
	players := []Player{{"Asha", 'X'}, {"Ravi", 'O'}}
	g := NewGame(3, players, NewCounterWinStrategy(3, 2))
	g.Play(0, 0)
	g.Play(0, 0)
	g.Play(3, 1)
	g.Play(1, 1)
	g.Play(0, 1)
	g.Play(2, 2)
	g.Undo()
	g.Play(1, 0)
	g.Play(0, 2)
	g.Play(2, 2)
	fmt.Println(g.Board.Render(players))
	fmt.Println("State:", g.State)

	fmt.Println("== Game 2: 3x3 draw ==")
	g = NewGame(3, players, NewCounterWinStrategy(3, 2))
	for _, m := range [][2]int{{0, 0}, {1, 1}, {2, 2}, {0, 2}, {2, 0}, {1, 0}, {1, 2}, {2, 1}, {0, 1}} {
		g.Play(m[0], m[1])
	}
	fmt.Println(g.Board.Render(players))
	fmt.Println("State:", g.State)

	fmt.Println("== Game 3: 4x4, three players, 3 in a row ==")
	trio := []Player{{"Asha", 'X'}, {"Ravi", 'O'}, {"Meera", 'A'}}
	g = NewGame(4, trio, LineWinStrategy{WinLength: 3})
	for _, m := range [][2]int{{0, 0}, {0, 1}, {3, 3}, {1, 1}, {0, 2}, {2, 3}, {2, 2}} {
		g.Play(m[0], m[1])
	}
	fmt.Println(g.Board.Render(trio))
	fmt.Printf("State: %s, winner %s\n", g.State, g.Winner.Name)
}`,
    },
    snake: {
      title: "Snake & Ladder with injectable dice (single file, runnable)",
      java: String.raw`// Snake & Ladder: board with snakes and ladders, players queue, injectable dice.
// Run: javac SnakeLadderDemo.java && java SnakeLadderDemo
import java.util.*;

public class SnakeLadderDemo {

    // ---------- Strategy: the dice is injected so tests can script every roll ----------
    interface Dice { int roll(); }

    static class RandomDice implements Dice {
        private final int faces;
        private final Random rng;
        RandomDice(int faces, long seed) { this.faces = faces; this.rng = new Random(seed); }
        public int roll() { return 1 + rng.nextInt(faces); }
    }

    // Returns the given rolls in order, then starts again. Makes the game deterministic.
    static class ScriptedDice implements Dice {
        private final int[] rolls;
        private int i = 0;
        ScriptedDice(int... rolls) { this.rolls = rolls; }
        public int roll() { return rolls[i++ % rolls.length]; }
    }

    record Jump(int end, String kind) {}

    static class Board {
        final int size;
        final Map<Integer, Jump> jumps = new HashMap<>(); // start cell -> jump

        Board(int size, Map<Integer, Integer> snakes, Map<Integer, Integer> ladders) {
            this.size = size;
            for (int head : new TreeSet<>(snakes.keySet())) {
                int tail = snakes.get(head);
                if (head <= tail) throw new IllegalArgumentException("snake " + head + " -> " + tail + " must go down");
                add(head, tail, "snake");
            }
            for (int bottom : new TreeSet<>(ladders.keySet())) {
                int top = ladders.get(bottom);
                if (top <= bottom) throw new IllegalArgumentException("ladder " + bottom + " -> " + top + " must go up");
                add(bottom, top, "ladder");
            }
        }

        private void add(int start, int end, String kind) {
            if (start <= 0 || start >= size || end <= 0 || end > size)
                throw new IllegalArgumentException(kind + " " + start + " -> " + end
                        + ": cannot start on cell 0 or the last cell, or leave the board");
            if (jumps.containsKey(start)) throw new IllegalArgumentException("two jumps start at cell " + start);
            jumps.put(start, new Jump(end, kind));
        }

        String describe() {
            long ladders = jumps.values().stream().filter(j -> j.kind().equals("ladder")).count();
            return size + " cells, " + ladders + " ladders, " + (jumps.size() - ladders) + " snakes";
        }
    }

    static class Player {
        final String name;
        int position = 0;
        Player(String name) { this.name = name; }
    }

    static class Game {
        private final Board board;
        private final Deque<Player> queue; // whose turn: the front of the queue
        private final Dice dice;
        Player winner = null;
        int turns = 0;

        Game(Board board, List<Player> players, Dice dice) {
            this.board = board;
            this.queue = new ArrayDeque<>(players);
            this.dice = dice;
        }

        void playTurn() {
            Player p = queue.pollFirst();
            int roll = dice.roll();
            turns++;
            int start = p.position, target = start + roll;
            if (target > board.size) {
                System.out.printf("%s rolls %d: needs exactly %d, stays at %d%n", p.name, roll, board.size - start, start);
                queue.addLast(p);
                return;
            }
            StringBuilder line = new StringBuilder(p.name + " rolls " + roll + ": " + start + " -> " + target);
            Jump j = board.jumps.get(target);
            if (j != null) {
                line.append(", ").append(j.kind()).append(j.kind().equals("ladder") ? " up" : " down").append(" to ").append(j.end());
                target = j.end();
            }
            p.position = target;
            if (target == board.size) {
                winner = p;
                System.out.println(line + ". " + p.name + " wins!");
                return;
            }
            System.out.println(line);
            queue.addLast(p);
        }

        Player play(int maxTurns) {
            while (winner == null && turns < maxTurns) playTurn();
            return winner;
        }
    }

    public static void main(String[] args) {
        System.out.println("== Board validation ==");
        List<List<Map<Integer, Integer>>> bad = List.of(
                List.of(Map.of(30, 5), Map.of()),
                List.of(Map.of(), Map.of(12, 7)),
                List.of(Map.of(14, 4), Map.of(14, 25)));
        for (List<Map<Integer, Integer>> cfg : bad) {
            try {
                new Board(30, cfg.get(0), cfg.get(1));
            } catch (IllegalArgumentException e) {
                System.out.println("Rejected board: " + e.getMessage());
            }
        }

        System.out.println("== Game: 30 cells, 2 players, scripted dice ==");
        Board board = new Board(30, Map.of(27, 1, 21, 9, 17, 4, 19, 7), Map.of(3, 22, 5, 8, 11, 26, 20, 29));
        System.out.println("Board: " + board.describe());
        Player asha = new Player("Asha"), ravi = new Player("Ravi");
        Game game = new Game(board, List.of(asha, ravi), new ScriptedDice(3, 4, 6, 2, 1, 5, 4, 1, 1));
        Player winner = game.play(1000);
        System.out.println("Winner: " + winner.name + " after " + game.turns + " turns");
        System.out.println("Final positions: Asha " + asha.position + ", Ravi " + ravi.position);
    }
}`,
      python: String.raw`# Snake & Ladder: board with snakes and ladders, players queue, injectable dice.
# Run: python3 main.py
import random
from collections import deque


# ---------- Strategy: the dice is injected so tests can script every roll ----------
class Dice:
    def roll(self):
        raise NotImplementedError


class RandomDice(Dice):
    def __init__(self, faces=6, seed=None):
        self.faces = faces
        self.rng = random.Random(seed)

    def roll(self):
        return self.rng.randint(1, self.faces)


class ScriptedDice(Dice):
    """Returns the given rolls in order, then starts again. Makes the game deterministic."""

    def __init__(self, rolls):
        self.rolls = rolls
        self.i = 0

    def roll(self):
        v = self.rolls[self.i % len(self.rolls)]
        self.i += 1
        return v


class Board:
    def __init__(self, size, snakes, ladders):
        self.size = size
        self.jumps = {}  # start cell -> (end cell, "snake" or "ladder")
        for head, tail in snakes.items():
            if head <= tail:
                raise ValueError("snake %d -> %d must go down" % (head, tail))
            self._add(head, tail, "snake")
        for bottom, top in ladders.items():
            if top <= bottom:
                raise ValueError("ladder %d -> %d must go up" % (bottom, top))
            self._add(bottom, top, "ladder")

    def _add(self, start, end, kind):
        if start <= 0 or start >= self.size or end <= 0 or end > self.size:
            raise ValueError("%s %d -> %d: cannot start on cell 0 or the last cell, or leave the board" % (kind, start, end))
        if start in self.jumps:
            raise ValueError("two jumps start at cell %d" % start)
        self.jumps[start] = (end, kind)

    def describe(self):
        kinds = [k for _, k in self.jumps.values()]
        return "%d cells, %d ladders, %d snakes" % (self.size, kinds.count("ladder"), kinds.count("snake"))


class Player:
    def __init__(self, name):
        self.name = name
        self.position = 0


class Game:
    def __init__(self, board, players, dice):
        self.board = board
        self.queue = deque(players)  # whose turn: the front of the queue
        self.dice = dice
        self.winner = None
        self.turns = 0

    def play_turn(self):
        p = self.queue.popleft()
        roll = self.dice.roll()
        self.turns += 1
        start = p.position
        target = start + roll
        if target > self.board.size:
            print("%s rolls %d: needs exactly %d, stays at %d" % (p.name, roll, self.board.size - start, start))
            self.queue.append(p)
            return
        line = "%s rolls %d: %d -> %d" % (p.name, roll, start, target)
        if target in self.board.jumps:
            end, kind = self.board.jumps[target]
            line += ", %s %s to %d" % (kind, "up" if kind == "ladder" else "down", end)
            target = end
        p.position = target
        if target == self.board.size:
            self.winner = p
            print(line + ". %s wins!" % p.name)
            return
        print(line)
        self.queue.append(p)

    def play(self, max_turns=1000):
        while self.winner is None and self.turns < max_turns:
            self.play_turn()
        return self.winner


def main():
    print("== Board validation ==")
    for snakes, ladders in [({30: 5}, {}), ({}, {12: 7}), ({14: 4}, {14: 25})]:
        try:
            Board(30, snakes, ladders)
        except ValueError as e:
            print("Rejected board:", e)

    print("== Game: 30 cells, 2 players, scripted dice ==")
    board = Board(30, {27: 1, 21: 9, 17: 4, 19: 7}, {3: 22, 5: 8, 11: 26, 20: 29})
    print("Board:", board.describe())
    asha, ravi = Player("Asha"), Player("Ravi")
    game = Game(board, [asha, ravi], ScriptedDice([3, 4, 6, 2, 1, 5, 4, 1, 1]))
    winner = game.play()
    print("Winner: %s after %d turns" % (winner.name, game.turns))
    print("Final positions: Asha %d, Ravi %d" % (asha.position, ravi.position))


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Snake & Ladder: board with snakes and ladders, players queue, injectable dice.
// Build: g++ -std=c++17 -o snakes main.cpp && ./snakes
#include <deque>
#include <iostream>
#include <map>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;

// ---------- Strategy: the dice is injected so tests can script every roll ----------
class Dice {
public:
    virtual ~Dice() = default;
    virtual int roll() = 0;
};

class RandomDice : public Dice {
    uniform_int_distribution<int> dist;
    mt19937 rng;
public:
    RandomDice(int faces, unsigned seed) : dist(1, faces), rng(seed) {}
    int roll() override { return dist(rng); }
};

// Returns the given rolls in order, then starts again. Makes the game deterministic.
class ScriptedDice : public Dice {
    vector<int> rolls;
    size_t i = 0;
public:
    explicit ScriptedDice(vector<int> rolls) : rolls(std::move(rolls)) {}
    int roll() override { return rolls[i++ % rolls.size()]; }
};

struct Jump {
    int end;
    string kind;
};

class Board {
    void add(int start, int end, const string& kind) {
        if (start <= 0 || start >= size || end <= 0 || end > size)
            throw invalid_argument(kind + " " + to_string(start) + " -> " + to_string(end) +
                                   ": cannot start on cell 0 or the last cell, or leave the board");
        if (jumps.count(start)) throw invalid_argument("two jumps start at cell " + to_string(start));
        jumps[start] = {end, kind};
    }
public:
    const int size;
    map<int, Jump> jumps; // start cell -> jump

    Board(int size, const map<int, int>& snakes, const map<int, int>& ladders) : size(size) {
        for (auto& [head, tail] : snakes) {
            if (head <= tail) throw invalid_argument("snake " + to_string(head) + " -> " + to_string(tail) + " must go down");
            add(head, tail, "snake");
        }
        for (auto& [bottom, top] : ladders) {
            if (top <= bottom) throw invalid_argument("ladder " + to_string(bottom) + " -> " + to_string(top) + " must go up");
            add(bottom, top, "ladder");
        }
    }

    string describe() const {
        int ladders = 0;
        for (auto& kv : jumps) if (kv.second.kind == "ladder") ladders++;
        return to_string(size) + " cells, " + to_string(ladders) + " ladders, " +
               to_string((int)jumps.size() - ladders) + " snakes";
    }
};

struct Player {
    string name;
    int position = 0;
};

class Game {
    const Board& board;
    deque<Player*> queue; // whose turn: the front of the queue
    Dice& dice;
public:
    Player* winner = nullptr;
    int turns = 0;

    Game(const Board& board, vector<Player*> players, Dice& dice)
        : board(board), queue(players.begin(), players.end()), dice(dice) {}

    void playTurn() {
        Player* p = queue.front();
        queue.pop_front();
        int roll = dice.roll();
        turns++;
        int start = p->position, target = start + roll;
        if (target > board.size) {
            cout << p->name << " rolls " << roll << ": needs exactly " << board.size - start << ", stays at " << start << "\n";
            queue.push_back(p);
            return;
        }
        string line = p->name + " rolls " + to_string(roll) + ": " + to_string(start) + " -> " + to_string(target);
        auto it = board.jumps.find(target);
        if (it != board.jumps.end()) {
            line += ", " + it->second.kind + (it->second.kind == "ladder" ? " up" : " down") + " to " + to_string(it->second.end);
            target = it->second.end;
        }
        p->position = target;
        if (target == board.size) {
            winner = p;
            cout << line << ". " << p->name << " wins!\n";
            return;
        }
        cout << line << "\n";
        queue.push_back(p);
    }

    Player* play(int maxTurns = 1000) {
        while (!winner && turns < maxTurns) playTurn();
        return winner;
    }
};

int main() {
    cout << "== Board validation ==\n";
    vector<pair<map<int, int>, map<int, int>>> bad = {
        {{{30, 5}}, {}},
        {{}, {{12, 7}}},
        {{{14, 4}}, {{14, 25}}},
    };
    for (auto& cfg : bad) {
        try {
            Board b(30, cfg.first, cfg.second);
        } catch (const invalid_argument& e) {
            cout << "Rejected board: " << e.what() << "\n";
        }
    }

    cout << "== Game: 30 cells, 2 players, scripted dice ==\n";
    Board board(30, {{27, 1}, {21, 9}, {17, 4}, {19, 7}}, {{3, 22}, {5, 8}, {11, 26}, {20, 29}});
    cout << "Board: " << board.describe() << "\n";
    Player asha{"Asha"}, ravi{"Ravi"};
    ScriptedDice dice({3, 4, 6, 2, 1, 5, 4, 1, 1});
    Game game(board, {&asha, &ravi}, dice);
    Player* winner = game.play();
    cout << "Winner: " << winner->name << " after " << game.turns << " turns\n";
    cout << "Final positions: Asha " << asha.position << ", Ravi " << ravi.position << "\n";
    return 0;
}`,
      javascript: String.raw`// Snake & Ladder: board with snakes and ladders, players queue, injectable dice.
// Run: node main.js
"use strict";

// ---------- Strategy: the dice is injected so tests can script every roll ----------
// Interface: roll() -> 1..faces

class RandomDice {
  constructor(faces = 6) { this.faces = faces; }
  roll() { return 1 + Math.floor(Math.random() * this.faces); } // not seedable; tests use ScriptedDice
}

// Returns the given rolls in order, then starts again. Makes the game deterministic.
class ScriptedDice {
  constructor(rolls) { this.rolls = rolls; this.i = 0; }
  roll() { return this.rolls[this.i++ % this.rolls.length]; }
}

class Board {
  constructor(size, snakes, ladders) {
    this.size = size;
    this.jumps = new Map(); // start cell -> { end, kind }
    for (const [head, tail] of snakes) {
      if (head <= tail) throw new Error("snake " + head + " -> " + tail + " must go down");
      this.add(head, tail, "snake");
    }
    for (const [bottom, top] of ladders) {
      if (top <= bottom) throw new Error("ladder " + bottom + " -> " + top + " must go up");
      this.add(bottom, top, "ladder");
    }
  }
  add(start, end, kind) {
    if (start <= 0 || start >= this.size || end <= 0 || end > this.size) {
      throw new Error(kind + " " + start + " -> " + end + ": cannot start on cell 0 or the last cell, or leave the board");
    }
    if (this.jumps.has(start)) throw new Error("two jumps start at cell " + start);
    this.jumps.set(start, { end, kind });
  }
  describe() {
    const ladders = [...this.jumps.values()].filter((j) => j.kind === "ladder").length;
    return this.size + " cells, " + ladders + " ladders, " + (this.jumps.size - ladders) + " snakes";
  }
}

class Player {
  constructor(name) { this.name = name; this.position = 0; }
}

class Game {
  constructor(board, players, dice) {
    this.board = board;
    this.queue = [...players]; // whose turn: the front of the queue
    this.dice = dice;
    this.winner = null;
    this.turns = 0;
  }

  playTurn() {
    const p = this.queue.shift();
    const roll = this.dice.roll();
    this.turns++;
    const start = p.position;
    let target = start + roll;
    if (target > this.board.size) {
      console.log(p.name + " rolls " + roll + ": needs exactly " + (this.board.size - start) + ", stays at " + start);
      this.queue.push(p);
      return;
    }
    let line = p.name + " rolls " + roll + ": " + start + " -> " + target;
    const j = this.board.jumps.get(target);
    if (j) {
      line += ", " + j.kind + (j.kind === "ladder" ? " up" : " down") + " to " + j.end;
      target = j.end;
    }
    p.position = target;
    if (target === this.board.size) {
      this.winner = p;
      console.log(line + ". " + p.name + " wins!");
      return;
    }
    console.log(line);
    this.queue.push(p);
  }

  play(maxTurns = 1000) {
    while (!this.winner && this.turns < maxTurns) this.playTurn();
    return this.winner;
  }
}

function main() {
  console.log("== Board validation ==");
  const bad = [
    [[[30, 5]], []],
    [[], [[12, 7]]],
    [[[14, 4]], [[14, 25]]],
  ];
  for (const [snakes, ladders] of bad) {
    try {
      new Board(30, snakes, ladders);
    } catch (e) {
      console.log("Rejected board: " + e.message);
    }
  }

  console.log("== Game: 30 cells, 2 players, scripted dice ==");
  const board = new Board(30, [[27, 1], [21, 9], [17, 4], [19, 7]], [[3, 22], [5, 8], [11, 26], [20, 29]]);
  console.log("Board: " + board.describe());
  const asha = new Player("Asha"), ravi = new Player("Ravi");
  const game = new Game(board, [asha, ravi], new ScriptedDice([3, 4, 6, 2, 1, 5, 4, 1, 1]));
  const winner = game.play();
  console.log("Winner: " + winner.name + " after " + game.turns + " turns");
  console.log("Final positions: Asha " + asha.position + ", Ravi " + ravi.position);
}

main();`,
      go: String.raw`// Snake & Ladder: board with snakes and ladders, players queue, injectable dice.
// Run: go run main.go
package main

import (
	"fmt"
	"math/rand"
	"sort"
)

// ---------- Strategy: the dice is injected so tests can script every roll ----------
type Dice interface{ Roll() int }

type RandomDice struct {
	faces int
	rng   *rand.Rand
}

func NewRandomDice(faces int, seed int64) *RandomDice {
	return &RandomDice{faces: faces, rng: rand.New(rand.NewSource(seed))}
}
func (d *RandomDice) Roll() int { return 1 + d.rng.Intn(d.faces) }

// ScriptedDice returns the given rolls in order, then starts again. Makes the game deterministic.
type ScriptedDice struct {
	rolls []int
	i     int
}

func (d *ScriptedDice) Roll() int {
	v := d.rolls[d.i%len(d.rolls)]
	d.i++
	return v
}

type Jump struct {
	End  int
	Kind string
}

type Board struct {
	Size  int
	Jumps map[int]Jump // start cell -> jump
}

func sortedKeys(m map[int]int) []int {
	keys := make([]int, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Ints(keys)
	return keys
}

func NewBoard(size int, snakes, ladders map[int]int) (*Board, error) {
	b := &Board{Size: size, Jumps: map[int]Jump{}}
	for _, head := range sortedKeys(snakes) {
		tail := snakes[head]
		if head <= tail {
			return nil, fmt.Errorf("snake %d -> %d must go down", head, tail)
		}
		if err := b.add(head, tail, "snake"); err != nil {
			return nil, err
		}
	}
	for _, bottom := range sortedKeys(ladders) {
		top := ladders[bottom]
		if top <= bottom {
			return nil, fmt.Errorf("ladder %d -> %d must go up", bottom, top)
		}
		if err := b.add(bottom, top, "ladder"); err != nil {
			return nil, err
		}
	}
	return b, nil
}

func (b *Board) add(start, end int, kind string) error {
	if start <= 0 || start >= b.Size || end <= 0 || end > b.Size {
		return fmt.Errorf("%s %d -> %d: cannot start on cell 0 or the last cell, or leave the board", kind, start, end)
	}
	if _, ok := b.Jumps[start]; ok {
		return fmt.Errorf("two jumps start at cell %d", start)
	}
	b.Jumps[start] = Jump{end, kind}
	return nil
}

func (b *Board) Describe() string {
	ladders := 0
	for _, j := range b.Jumps {
		if j.Kind == "ladder" {
			ladders++
		}
	}
	return fmt.Sprintf("%d cells, %d ladders, %d snakes", b.Size, ladders, len(b.Jumps)-ladders)
}

type Player struct {
	Name     string
	Position int
}

type Game struct {
	board  *Board
	queue  []*Player // whose turn: the front of the queue
	dice   Dice
	Winner *Player
	Turns  int
}

func NewGame(b *Board, players []*Player, d Dice) *Game {
	return &Game{board: b, queue: append([]*Player{}, players...), dice: d}
}

func (g *Game) PlayTurn() {
	p := g.queue[0]
	g.queue = g.queue[1:]
	roll := g.dice.Roll()
	g.Turns++
	start := p.Position
	target := start + roll
	if target > g.board.Size {
		fmt.Printf("%s rolls %d: needs exactly %d, stays at %d\n", p.Name, roll, g.board.Size-start, start)
		g.queue = append(g.queue, p)
		return
	}
	line := fmt.Sprintf("%s rolls %d: %d -> %d", p.Name, roll, start, target)
	if j, ok := g.board.Jumps[target]; ok {
		dir := " down"
		if j.Kind == "ladder" {
			dir = " up"
		}
		line += fmt.Sprintf(", %s%s to %d", j.Kind, dir, j.End)
		target = j.End
	}
	p.Position = target
	if target == g.board.Size {
		g.Winner = p
		fmt.Printf("%s. %s wins!\n", line, p.Name)
		return
	}
	fmt.Println(line)
	g.queue = append(g.queue, p)
}

func (g *Game) Play(maxTurns int) *Player {
	for g.Winner == nil && g.Turns < maxTurns {
		g.PlayTurn()
	}
	return g.Winner
}

func main() {
	fmt.Println("== Board validation ==")
	bad := [][2]map[int]int{
		{{30: 5}, {}},
		{{}, {12: 7}},
		{{14: 4}, {14: 25}},
	}
	for _, cfg := range bad {
		if _, err := NewBoard(30, cfg[0], cfg[1]); err != nil {
			fmt.Println("Rejected board:", err)
		}
	}

	fmt.Println("== Game: 30 cells, 2 players, scripted dice ==")
	board, err := NewBoard(30, map[int]int{27: 1, 21: 9, 17: 4, 19: 7}, map[int]int{3: 22, 5: 8, 11: 26, 20: 29})
	if err != nil {
		panic(err)
	}
	fmt.Println("Board:", board.Describe())
	asha, ravi := &Player{Name: "Asha"}, &Player{Name: "Ravi"}
	game := NewGame(board, []*Player{asha, ravi}, &ScriptedDice{rolls: []int{3, 4, 6, 2, 1, 5, 4, 1, 1}})
	winner := game.Play(1000)
	fmt.Printf("Winner: %s after %d turns\n", winner.Name, game.Turns)
	fmt.Printf("Final positions: Asha %d, Ravi %d\n", asha.Position, ravi.Position)
}`,
    },
  },
  diagrams: {
    classes: String.raw`classDiagram
  class Game {
    -Board board
    -List~Player~ players
    -WinStrategy strategy
    -int turn
    -Stack~MoveCommand~ history
    +GameState state
    +play(int r, int c) bool
    +undo()
  }
  class Board {
    -int[][] cells
    +int n
    +inBounds(r, c) bool
    +place(r, c, p)
    +clear(r, c)
    +isFull() bool
  }
  class Player {
    +String name
    +char symbol
  }
  class WinStrategy {
    <<interface>>
    +onMove(board, r, c, p) bool
    +onUndo(board, r, c, p)
  }
  class CounterWinStrategy {
    -int[][] rows
    -int[][] cols
    -int[] diag
    -int[] anti
  }
  class LineWinStrategy {
    -int winLength
  }
  class MoveCommand {
    +int r
    +int c
    +int p
    +execute(game) bool
    +undo(game)
  }
  class GameState {
    <<enumeration>>
    IN_PROGRESS
    WON
    DRAW
  }
  Game *-- Board
  Game o-- Player
  Game o-- WinStrategy
  Game *-- MoveCommand
  Game --> GameState
  WinStrategy <|.. CounterWinStrategy
  WinStrategy <|.. LineWinStrategy`,
    states: String.raw`stateDiagram-v2
  [*] --> InProgress: game created
  InProgress --> InProgress: valid move, next player
  InProgress --> InProgress: invalid move, same player
  InProgress --> InProgress: undo
  InProgress --> Won: move completes a line
  InProgress --> Draw: board full, no winner
  Won --> [*]
  Draw --> [*]`,
    snakeClasses: String.raw`classDiagram
  class SnakeLadderGame {
    -Board board
    -Queue~Player~ queue
    -Dice dice
    +Player winner
    +playTurn()
    +play(maxTurns) Player
  }
  class Board {
    +int size
    +Map~int,Jump~ jumps
    +describe() String
  }
  class Jump {
    +int end
    +String kind
  }
  class Player {
    +String name
    +int position
  }
  class Dice {
    <<interface>>
    +roll() int
  }
  class RandomDice
  class ScriptedDice {
    -int[] rolls
  }
  SnakeLadderGame *-- Board
  SnakeLadderGame o-- Player
  SnakeLadderGame o-- Dice
  Board *-- Jump
  Dice <|.. RandomDice
  Dice <|.. ScriptedDice`,
  },
});
