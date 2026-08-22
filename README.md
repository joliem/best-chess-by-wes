# best-chess-by-wes

A growing collection of original chess variants. The variants were
dreamed up and play-tested together with my son Wesley (age 7).

**Play it live: https://best-chess-by-wes.lovable.app**

Each variant keeps standard chess rules with one new idea layered on top. All of them can be played
pass-and-play on a single screen, or online from two different devices with no account needed.

## The variants

- **Switcheroo Chess** (`/switcheroo`) — before each move there's a 1-in-10 chance the board spins: you play a move as your opponent and they play a move as you, each of you trying to blunder as badly as possible! 
- **Treasure Chess** (`/treasure`) — 3 gold and 3 silver coins are hidden on the middle four ranks. Land on one and it goes into your treasure chest. Use a silver coin to make a piece temporarily invincible; use a gold coin to give a piece temporary queen powers. If you reach a stalemate, the bigger treasure stockpile wins (1 gold = 2 silver).
- **Battleship Bishop** (`/battleship`) — each player's kingside bishop is camouflaged to the enemy as it moves along squares of its same color. Another piece can even land on its square, but the enemy can only capture it with a correct Battleship-style guess after it moves. The hidden bishop can give check (giving the enemy at least a hint about its location), and if it makes a capture it reveals itself for the rest of the game.

## Online play

From the home page, pick a variant and create a game link, then send the URL to your opponent.
Moves are validated on the server and synced in realtime, and hidden information (hidden coin locations, camouflaged pieces) is masked per player on the server, so neither side can peek or cheat.

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
