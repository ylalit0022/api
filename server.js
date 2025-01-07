const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    },
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    path: '/socket.io/'
});
const cors = require('cors');

// Enable CORS for all routes
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());

// In-memory game state
const games = new Map();

// Root endpoint for testing
app.get('/', (req, res) => {
    res.send('TicTacToe Server is running!');
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Create a new game
app.post('/api/games/create', (req, res) => {
    try {
        const gameId = generateGameId();
        const game = {
            id: gameId,
            board: Array(3).fill(null).map(() => Array(3).fill(null)),
            players: [],
            currentPlayer: null,
            isGameOver: false,
            winner: null,
            createdAt: Date.now()
        };
        games.set(gameId, game);
        console.log(`Created new game with ID: ${gameId}`);
        res.json({ success: true, gameId: gameId });
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ success: false, error: 'Failed to create game' });
    }
});

// Join a game
app.post('/api/games/join/:gameId', (req, res) => {
    try {
        const gameId = req.params.gameId;
        const game = games.get(gameId);
        
        if (!game) {
            return res.status(404).json({ success: false, error: 'Game not found' });
        }
        
        if (game.players.length >= 2) {
            return res.status(400).json({ success: false, error: 'Game is full' });
        }
        
        res.json({ success: true, gameId: gameId });
    } catch (error) {
        console.error('Error joining game:', error);
        res.status(500).json({ success: false, error: 'Failed to join game' });
    }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('joinGame', ({ gameId, playerName }) => {
        try {
            console.log(`Player ${playerName} attempting to join game ${gameId}`);
            const game = games.get(gameId);
            
            if (!game) {
                socket.emit('error', 'Game not found');
                return;
            }
            
            if (game.players.length >= 2) {
                socket.emit('error', 'Game is full');
                return;
            }
            
            // Join the socket room for this game
            socket.join(gameId);
            
            // Assign player symbol (X for first player, O for second)
            const symbol = game.players.length === 0 ? 'X' : 'O';
            game.players.push({
                id: socket.id,
                name: playerName,
                symbol: symbol
            });
            
            // Emit player assigned event
            socket.emit('playerAssigned', { symbol: symbol });
            
            // If this is the second player, start the game
            if (game.players.length === 2) {
                game.currentPlayer = game.players[0].symbol;
                io.to(gameId).emit('gameStart', {
                    board: game.board,
                    currentPlayer: game.currentPlayer,
                    players: game.players.map(p => ({ name: p.name, symbol: p.symbol }))
                });
            }
            
            // Notify other players
            socket.to(gameId).emit('playerJoined', {
                gameId: gameId,
                playerName: playerName
            });
            
        } catch (error) {
            console.error('Error in joinGame:', error);
            socket.emit('error', 'Failed to join game');
        }
    });
    
    socket.on('makeMove', ({ gameId, row, col }) => {
        try {
            const game = games.get(gameId);
            if (!game) {
                socket.emit('error', 'Game not found');
                return;
            }
            
            const player = game.players.find(p => p.id === socket.id);
            if (!player || player.symbol !== game.currentPlayer) {
                socket.emit('error', 'Not your turn');
                return;
            }
            
            if (game.board[row][col] !== null) {
                socket.emit('error', 'Invalid move');
                return;
            }
            
            // Make the move
            game.board[row][col] = player.symbol;
            
            // Check for winner
            const winner = checkWinner(game.board);
            if (winner) {
                game.isGameOver = true;
                game.winner = winner;
            } else if (isBoardFull(game.board)) {
                game.isGameOver = true;
                game.winner = 'draw';
            }
            
            // Switch current player
            game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
            
            // Emit game update to all players
            io.to(gameId).emit('gameUpdate', {
                board: game.board,
                currentPlayer: game.currentPlayer,
                isGameOver: game.isGameOver,
                winner: game.winner
            });
            
        } catch (error) {
            console.error('Error in makeMove:', error);
            socket.emit('error', 'Failed to make move');
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Find and handle any games this player was in
        for (const [gameId, game] of games.entries()) {
            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                game.players.splice(playerIndex, 1);
                io.to(gameId).emit('playerLeft', {
                    message: 'Opponent has left the game'
                });
                if (game.players.length === 0) {
                    games.delete(gameId);
                }
            }
        }
    });
});

// Helper functions
function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function checkWinner(board) {
    // Check rows
    for (let i = 0; i < 3; i++) {
        if (board[i][0] && board[i][0] === board[i][1] && board[i][0] === board[i][2]) {
            return board[i][0];
        }
    }
    
    // Check columns
    for (let i = 0; i < 3; i++) {
        if (board[0][i] && board[0][i] === board[1][i] && board[0][i] === board[2][i]) {
            return board[0][i];
        }
    }
    
    // Check diagonals
    if (board[0][0] && board[0][0] === board[1][1] && board[0][0] === board[2][2]) {
        return board[0][0];
    }
    if (board[0][2] && board[0][2] === board[1][1] && board[0][2] === board[2][0]) {
        return board[0][2];
    }
    
    return null;
}

function isBoardFull(board) {
    return board.every(row => row.every(cell => cell !== null));
}

// Clean up inactive games periodically
setInterval(() => {
    const now = Date.now();
    for (const [gameId, game] of games.entries()) {
        // Remove games older than 30 minutes
        if (now - game.createdAt > 30 * 60 * 1000) {
            games.delete(gameId);
            console.log(`Removed inactive game: ${gameId}`);
        }
    }
}, 5 * 60 * 1000); // Run every 5 minutes

// Start the server
const port = process.env.PORT || 3000;
http.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
