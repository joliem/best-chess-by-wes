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
- **Camo Chess** (`/camo`) — hidden-information chess with one camouflaged piece: each side's
  kingside bishop. Whenever the hidden bishop moves, its opponent gets one immediate guess at its
  fixed-color square. A correct guess reveals that bishop for the rest of the game.

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
