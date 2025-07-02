const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// API Football Data configuration
const FOOTBALL_API_TOKEN = 'f7268f03ecc54a47bfa88f0f60ff0d54';
const FOOTBALL_API_URL = 'https://api.football-data.org/v4/matches';

// Initialize game state (original game)
let gameState = {
    currentPlayer: 'Ruperto',
    score: {'Ruperto': 60000, 'Juan': 60000, 'Mauricio': 60000},
    diamondStates: [],
    goldBarStates: [],
    rubyStates: [],
    trophyStates: [],
    takenRowsByPlayer: {Ruperto: [], Juan: [], Mauricio: []},
    takenCount: 0,
    timeLeft: 10,
    diamondStates: Array(4).fill({ available: true, emoji: '💎' }),
    goldBarStates: Array(4).fill({ available: true, emoji: '💰' }),
    rubyStates: Array(4).fill({ available: true, emoji: '🔴' }),
    trophyStates: Array(4).fill({ available: true, emoji: '🏆' }),
    takenRowsByPlayer: {}
};

// Initialize betting state
let bettingState = {
    activeBets: {},
    matchesInPlay: {}
};

// Original game functions
const initializeBoard = () => {
    const tokens = [
        ...Array(8).fill({ type: 'win', points: 20000 }),
        ...Array(8).fill({ type: 'lose', points: -23000 })
    ];
    const shuffledTokens = shuffleArray([...tokens]);

    gameState.diamondStates = shuffledTokens.slice(0, 4).map(token => ({ ...token, emoji: '💎', available: true }));
    gameState.goldBarStates = shuffledTokens.slice(4, 8).map(token => ({ ...token, emoji: '💰', available: true }));
    gameState.rubyStates = shuffledTokens.slice(8, 12).map(token => ({ ...token, emoji: '🔴', available: true }));
    gameState.trophyStates = shuffledTokens.slice(12, 16).map(token => ({ ...token, emoji: '🏆', available: true }));

    gameState.takenCount = 0;
    Object.keys(gameState.takenRowsByPlayer).forEach(player => {
        gameState.takenRowsByPlayer[player] = [];
    });
};

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// Initialize the board at the start
initializeBoard();

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Football betting routes
// Modificar el endpoint de partidos para incluir partidos FINALIZADOS
app.get('/api/matches/:leagueCode', async (req, res) => {
    try {
        const { leagueCode } = req.params;
        // Obtener tanto partidos EN VIVO como FINALIZADOS de los últimos 7 días
        const hoy = new Date();
        const haceSieteDias = new Date(hoy.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        const [respuestaEnVivo, respuestaFinalizados] = await Promise.all([
            fetch(
                `${FOOTBALL_API_URL}/competitions/${leagueCode}/matches?status=LIVE`,
                {
                    headers: {
                        'X-Auth-Token': FOOTBALL_API_TOKEN
                    }
                }
            ),
            fetch(
                `${FOOTBALL_API_URL}/competitions/${leagueCode}/matches?status=FINISHED&dateFrom=${haceSieteDias.toISOString().split('T')[0]}&dateTo=${hoy.toISOString().split('T')[0]}`,
                {
                    headers: {
                        'X-Auth-Token': FOOTBALL_API_TOKEN
                    }
                }
            )
        ]);

        if (!respuestaEnVivo.ok || !respuestaFinalizados.ok) {
            throw new Error('Error en la API');
        }

        const [datosEnVivo, datosFinalizados] = await Promise.all([
            respuestaEnVivo.json(),
            respuestaFinalizados.json()
        ]);
        // 1. Agregar persistencia del estado del juego en el servidor
const fs = require('fs');
const path = require('path');

// Ruta del archivo para guardar el estado del juego
const GAME_STATE_FILE = path.join(__dirname, 'game-state.json');

// Función para guardar el estado del juego en un archivo
const saveGameStateToFile = (state) => {
    try {
        // Asegurarse de que haya un timestamp
        if (!state.timestamp) {
            state.timestamp = Date.now();
        }
        
        // Guardar el estado en un archivo
        fs.writeFileSync(GAME_STATE_FILE, JSON.stringify(state, null, 2));
        console.log('Estado del juego guardado en archivo:', new Date(state.timestamp).toLocaleTimeString());
    } catch (error) {
        console.error('Error al guardar el estado del juego:', error);
    }
};

// Función para cargar el estado del juego desde el archivo
const loadGameStateFromFile = () => {
    try {
        if (fs.existsSync(GAME_STATE_FILE)) {
            const data = fs.readFileSync(GAME_STATE_FILE, 'utf8');
            const loadedState = JSON.parse(data);
            console.log('Estado del juego cargado desde archivo:', new Date(loadedState.timestamp).toLocaleTimeString());
            return loadedState;
        }
    } catch (error) {
        console.error('Error al cargar el estado del juego:', error);
    }
    return null;
};

// Intentar cargar el estado del juego al iniciar el servidor
const savedState = loadGameStateFromFile();
if (savedState) {
    // Si hay un estado guardado, usarlo como estado inicial
    gameState = savedState;
    console.log('Estado del juego restaurado desde archivo');
} else {
    // Si no hay estado guardado, inicializar con valores por defecto
    console.log('Inicializando nuevo estado del juego');
    initializeBoard();
    gameState.timestamp = Date.now();
    saveGameStateToFile(gameState);
}

// 2. Modificar los eventos de Socket.IO para manejar la persistencia

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    // Enviar el estado inicial al cliente que se conecta
    socket.emit('initialState', gameState);
    
    // Manejar solicitudes de estado del juego
    socket.on('requestGameState', () => {
        console.log('Cliente solicitó estado del juego:', socket.id);
        socket.emit('initialState', gameState);
    });
    
    // Guardar el estado del juego enviado por un cliente
    socket.on('saveGameState', (clientState) => {
        console.log('Cliente envió estado para guardar:', socket.id);
        
        // Verificar si el estado del cliente es más reciente
        if (clientState.timestamp && (!gameState.timestamp || clientState.timestamp > gameState.timestamp)) {
            console.log('Actualizando estado del servidor con datos del cliente');
            gameState = clientState;
            saveGameStateToFile(gameState);
            
            // Notificar a todos los clientes sobre el cambio
            io.emit('stateChanged', gameState);
        }
    });
    
    // Manejar cuando un jugador toma una ficha
    socket.on('takeFicha', (data) => {
        console.log('Ficha tomada por:', data.player);
        const { rowId, index, player, emoji } = data;
        
        // Actualizar el estado del juego según la fila
        let rowArray;
        if (rowId === 'diamond-row') rowArray = gameState.diamondStates;
        else if (rowId === 'gold-row') rowArray = gameState.goldBarStates;
        else if (rowId === 'ruby-row') rowArray = gameState.rubyStates;
        else if (rowId === 'trophy-row') rowArray = gameState.trophyStates;
        
        if (rowArray && rowArray[index]) {
            // Marcar la ficha como no disponible
            rowArray[index].available = false;
            rowArray[index].emoji = emoji || '<img src="./assents/ftaoo.png" class="emoji-image">';
            
            // Registrar que este jugador tomó esta ficha
            if (!gameState.takenRowsByPlayer[player]) {
                gameState.takenRowsByPlayer[player] = [];
            }
            gameState.takenRowsByPlayer[player].push(rowId);
            gameState.takenCount++;
            
            // Actualizar el timestamp
            gameState.timestamp = Date.now();
            
            // Guardar el estado actualizado
            saveGameStateToFile(gameState);
            
            // Notificar a todos los clientes sobre la ficha tomada
            io.emit('fichaUpdated', data);
            
            // También enviar el estado completo actualizado
            io.emit('stateChanged', gameState);
        }
    });
    
    // Verificar estado del juego
    socket.on('verifyState', (data) => {
        // Comprobar si el cliente necesita actualizar su estado
        const clientTimestamp = data.timestamp || 0;
        const serverTimestamp = gameState.timestamp || 0;
        
        socket.emit('stateVerification', {
            needsUpdate: serverTimestamp > clientTimestamp
        });
    });
    
    // Manejar cuando un jugador se une
    socket.on('playerJoined', (data) => {
        const { username, score } = data;
        console.log('Jugador unido:', username);
        
        // Registrar al jugador si no existe
        if (!gameState.score[username]) {
            gameState.score[username] = score || 60000;
            gameState.takenRowsByPlayer[username] = [];
            
            // Guardar el estado actualizado
            gameState.timestamp = Date.now();
            saveGameStateToFile(gameState);
        }
        
        // Informar a todos sobre la actualización de la lista de jugadores
        io.emit('updatePlayersList', Object.keys(gameState.score));
    });

    // Manejar el reinicio del juego
    socket.on('resetGame', (data) => {
        // Verificar autorización (opcional)
        if (data && data.pin === '25008') {
            console.log('Reiniciando juego por solicitud de:', socket.id);
            
            // Guardar los puntajes actuales
            const currentScores = {...gameState.score};
            
            // Reiniciar el tablero
            initializeBoard();
            
            // Restaurar los puntajes
            gameState.score = currentScores;
            
            // Actualizar timestamp y guardar
            gameState.timestamp = Date.now();
            saveGameStateToFile(gameState);
            
            // Notificar a todos los clientes
            io.emit('gameReset', gameState);
        }
    });
    
    // Otros eventos existentes...
    // ...

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

// 3. Implementar respaldo periódico del estado del juego

// Guardar el estado cada 5 minutos como medida preventiva
setInterval(() => {
    console.log('Respaldo periódico del estado del juego');
    gameState.timestamp = Date.now();
    saveGameStateToFile(gameState);
}, 5 * 60 * 1000);

// 4. Modificar la función resetGame para mantener los datos de los jugadores

const resetGame = () => {
    console.log('Reiniciando el juego');
    
    // Guardar los puntajes y datos de los jugadores
    const currentScores = {...gameState.score};
    const players = Object.keys(gameState.score);
    
    // Reiniciar el tablero
    initializeBoard();
    
    // Restaurar los puntajes y datos de los jugadores
    gameState.score = currentScores;
    gameState.currentPlayer = gameState.currentPlayer || 'Ruperto';
    gameState.timeLeft = 10;
    
    // Inicializar el objeto takenRowsByPlayer para todos los jugadores
    gameState.takenRowsByPlayer = {};
    players.forEach(player => {
        gameState.takenRowsByPlayer[player] = [];
    });
    
    // Actualizar timestamp y guardar
    gameState.timestamp = Date.now();
    saveGameStateToFile(gameState);
    
    // Notificar a todos los clientes
    io.emit('gameReset', gameState);
};

// 5. Agregar un endpoint REST para respaldo del estado del juego
// Esto permite hacer copias de seguridad o restaurar desde un punto anterior

// Endpoint para obtener el estado actual del juego (protegido por clave)
app.get('/api/game-state', (req, res) => {
    const { apiKey } = req.query;
    if (apiKey === 'ftapp-admin-key') { // Clave simple, considerar algo más seguro en producción
        res.json(gameState);
    } else {
        res.status(401).json({ error: 'No autorizado' });
    }
});

// Endpoint para restaurar el estado del juego desde un punto de respaldo
app.post('/api/restore-game-state', express.json(), (req, res) => {
    const { apiKey, state } = req.body;
    
    if (apiKey !== 'ftapp-admin-key') {
        return res.status(401).json({ error: 'No autorizado' });
    }
    
    try {
        if (!state || !state.diamondStates || !state.goldBarStates || !state.rubyStates || !state.trophyStates) {
            return res.status(400).json({ error: 'Estado de juego inválido' });
        }
        
        // Actualizar el estado del juego
        gameState = state;
        gameState.timestamp = Date.now();
        
        // Guardar en archivo
        saveGameStateToFile(gameState);
        
        // Notificar a todos los clientes
        io.emit('stateChanged', gameState);
        
        res.json({ success: true, message: 'Estado restaurado correctamente' });
    } catch (error) {
        console.error('Error al restaurar el estado:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});
        const datosCombinados = {
            matches: {
                live: datosEnVivo.matches || [],
                finished: datosFinalizados.matches || []
            }
        };

        bettingState.matchesInPlay[leagueCode] = datosCombinados.matches.live;
        res.json(datosCombinados);
    } catch (error) {
        console.error('Error al obtener partidos:', error);
        res.status(500).json({ error: 'Error al obtener partidos' });
    }
});
// Place bet endpoint
app.post('/api/bet', (req, res) => {
    const { matchId, betType, amount, userId } = req.body;
    
    if (!gameState.score[userId]) {
        return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    if (gameState.score[userId] < amount) {
        return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // Registrar la apuesta
    const betId = Date.now().toString();
    bettingState.activeBets[betId] = {
        userId,
        matchId,
        betType,
        amount,
        timestamp: new Date(),
        status: 'active'
    };

    // Descontar el monto de la apuesta
    gameState.score[userId] -= amount;

    res.json({
        betId,
        currentBalance: gameState.score[userId]
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.emit('initialState', gameState);

    // Original game events
    socket.on('updateState', (updatedState) => {
        gameState = updatedState;
        
        if (gameState.takenCount >= 16) {
            resetGame();
        }
        
        io.emit('stateChanged', gameState);
    });
    // Enviar el estado actual del juego al nuevo cliente
    socket.emit('initialState', gameState);

    // Manejar la toma de una ficha
    socket.on('takeFicha', (data) => {
        const { rowId, index, player } = data;

        // Actualizar el estado del juego
        if (rowId === 'diamond-row') {
            gameState.diamondStates[index].available = false;
        } else if (rowId === 'gold-row') {
            gameState.goldBarStates[index].available = false;
        } else if (rowId === 'ruby-row') {
            gameState.rubyStates[index].available = false;
        } else if (rowId === 'trophy-row') {
            gameState.trophyStates[index].available = false;
        }

        // Guardar qué ficha fue tomada por quién
        if (!gameState.takenRowsByPlayer[player]) {
            gameState.takenRowsByPlayer[player] = [];
        }
        gameState.takenRowsByPlayer[player].push({ rowId, index });

        // Notificar a todos los clientes
        io.emit('stateChanged', gameState);
    });

    socket.on('registerPlayer', (username) => {
        if (!gameState.score[username]) {
            gameState.score[username] = 60000;
            gameState.takenRowsByPlayer[username] = [];
        }
        io.emit('updatePlayersList', Object.keys(gameState.score));
    });

    socket.on('takeToken', (data) => {
        const { player, rowId, index } = data;
        const row = gameState[rowId];
        
        if (row[index].available) {
            row[index].available = false;
            gameState.takenCount++;
            gameState.takenRowsByPlayer[player].push(rowId);
            
            if (typeof gameState.score[player] !== 'number') {
                gameState.score[player] = 60000;
            }
            gameState.score[player] += row[index].points;
            
            if (gameState.score[player] < 0) {
                gameState.score[player] = 0;
            }
            
            if (gameState.takenCount >= 16) {
                resetGame();
            }
            
            io.emit('stateChanged', gameState);
        }
    });

    // New betting events
    socket.on('placeBet', (betData) => {
        const { userId, matchId, betType, amount } = betData;
        
        if (gameState.score[userId] >= amount) {
            const betId = Date.now().toString();
            bettingState.activeBets[betId] = {
                userId,
                matchId,
                betType,
                amount,
                timestamp: new Date(),
                status: 'active'
            };

            gameState.score[userId] -= amount;
            
            io.emit('betPlaced', {
                betId,
                userId,
                currentBalance: gameState.score[userId]
            });
            
            io.emit('stateChanged', gameState);
        }
    });
     // Escuchar el evento de actualización de puntos
     socket.on('updatePlayerPoints', (data) => {
        const { player, newScore } = data;

        // Emitir el evento a todos los clientes conectados
        io.emit('updatePlayerPoints', { player, newScore });

        console.log(`Puntos actualizados para ${player}: ${newScore}`);
    });
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Function to reset the game
const resetGame = () => {
    initializeBoard();
    gameState.currentPlayer = 'Ruperto';
    gameState.timeLeft = 10;
    io.emit('gameReset', gameState);
};

// Start updating matches every minute
setInterval(async () => {
    try {
        for (const leagueCode of ['CL', 'PL', 'PD', 'SA', 'BL1', 'FL1']) {
            const response = await fetch(
                `${FOOTBALL_API_URL}/competitions/${leagueCode}/matches?status=LIVE`,
                {
                    headers: {
                        'X-Auth-Token': FOOTBALL_API_TOKEN
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                bettingState.matchesInPlay[leagueCode] = data.matches || [];
                io.emit('matchesUpdated', { leagueCode, matches: data.matches || [] });
            }
        }
    } catch (error) {
        console.error('Error updating matches:', error);
    }
}, 60000);
// Maneja todas las rutas y redirige a index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
server.listen(3000, () => {
    console.log('Server running on port 3000');
});