# TicTacToe Game Server

This is a simple server for the TicTacToe game that handles online multiplayer functionality.

## Local Development Setup

1. Make sure you have Node.js installed on your computer
2. Open a terminal in this directory
3. Run `npm install` to install dependencies
4. Run `npm start` to start the server
5. The server will run on port 3000

## Deploying to Vercel

1. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy to Vercel:
   ```bash
   vercel
   ```

4. For production deployment:
   ```bash
   vercel --prod
   ```

## Environment Variables

No environment variables are required for basic functionality. The server will automatically use the port provided by Vercel in production.

## API Endpoints

- GET `/api/health` - Health check endpoint
- POST `/api/games/create` - Create a new game
- POST `/api/games/join` - Join an existing game

## WebSocket Events

### Client to Server:
- `joinGame` - Join a game room with parameters: `{ gameId: string, playerName: string }`
- `makeMove` - Make a move with parameters: `{ gameId: string, row: number, col: number }`

### Server to Client:
- `gameStart` - Game is ready to start, receives: `{ board: string[][], players: Player[], currentPlayer: string }`
- `gameUpdate` - Game state update, receives: `{ board: string[][], currentPlayer: string }`
- `gameOver` - Game ended, receives: `{ board: string[][], winner: string | null }`
- `playerDisconnected` - Opponent disconnected, receives: `{ message: string, winner: string }`
- `error` - Error message, receives: `string`

## Testing the App

1. Start the server locally by following the setup instructions above
2. Run the Android app in an emulator
3. Create a new online game in the app
4. Use another emulator or device to join the game using the game code

## Important Notes

- The server uses in-memory storage for game state, which means:
  - Game data will be lost if the server restarts
  - In serverless environment (Vercel), game state persists only within the same serverless function instance
  - Inactive games are automatically cleaned up after 30 minutes
- WebSocket connections are handled through Socket.IO
- CORS is enabled for all origins in development
