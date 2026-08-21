# best-chess-by-wes

A growing collection of original chess variants. The variants were
dreamed up and play-tested together with my son Wesley (age 7).

**Play it live: https://best-chess-by-wes.lovable.app**

Each variant keeps standard chess rules and layers one new idea on top. All of them can be played
pass-and-play on a single screen, or online from two different devices with no account needed.

## The variants

- **Switcheroo Chess** (`/switcheroo`) — normal chess, but before any move there's a 1-in-10 chance
  the board spins: you play a move as your opponent, then they play a move as you. Squares turn
  purple and green while switcheroo mode is active.
- **Treasure Chess** (`/treasure`) — 3 gold and 3 silver coins are hidden on the middle four ranks.
  Land on one and it goes into your treasure chest. Spend a silver coin to make a piece temporarily
  invincible for two enemy moves; spend a gold coin to give a piece temporary queen powers for one
  move. Kings are never eligible. If the game ends in a draw, the bigger treasure wins
  (gold = 2 silver).
- **Battleship Bishop** (`/battleship`) — each side's kingside bishop is intangible and hidden from
  its opponent. Another piece can share its square, it reveals itself if it captures, and it can
  otherwise be captured only by a correct Battleship-style target guess after it moves.

## Online play

From the home page, pick a variant and create a game link, then send the URL to your opponent.
Moves are validated on the server and synced in realtime, and hidden information (coin locations,
camouflaged pieces) is masked per player on the server, so neither side can peek or cheat.

## Development

Requires Node.js and npm.

```sh
git clone <this-repository-url>
cd best-chess-by-wes
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Supabase (Postgres, Realtime)
