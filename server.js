const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Database files
const GLOBAL_USERS_FILE = 'globalUsers.json';
const GAMES_FILE = 'games.json';

const corsOptions = {
    origin: [
        '*' // falls vorhanden
    ],
    credentials: true,
    optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// ========== HELPER FUNCTIONS ==========

// Global Users Database
async function readGlobalUsers() {
    try {
        const data = await fs.readFile(GLOBAL_USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Datei existiert nicht - erstelle sie mit Standardstruktur
        const defaultData = { users: {} };
        await writeGlobalUsers(defaultData);
        console.log(`${GLOBAL_USERS_FILE} wurde erstellt`);
        return defaultData;
    }
}

async function writeGlobalUsers(data) {
    await fs.writeFile(GLOBAL_USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Games Database
async function readGames() {
    try {
        const data = await fs.readFile(GAMES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Datei existiert nicht - erstelle sie mit Standardstruktur
        const defaultData = { 
            games: {
                fifa: {
                    id: 'fifa',
                    name: 'FIFA',
                    tournaments: {},
                    activeTournamentId: null
                },
                cod: {
                    id: 'cod',
                    name: 'Call of Duty',
                    tournaments: {},
                    activeTournamentId: null
                },
                chess: {
                    id: 'chess',
                    name: 'Chess',
                    tournaments: {},
                    activeTournamentId: null
                },
                tiktaktoe: {
                    id: 'tiktaktoe',
                    name: 'TikTakToe',
                    tournaments: {},
                    activeTournamentId: null
                }
            }
        };
        await writeGames(defaultData);
        console.log(`${GAMES_FILE} wurde erstellt`);
        return defaultData;
    }
}

async function createBackup() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = 'backups';
        
        // Backup-Ordner erstellen falls nicht vorhanden
        try {
            await fs.mkdir(backupDir, { recursive: true });
            console.log(`Backup-Ordner erstellt/überprüft: ${backupDir}`);
        } catch (err) {
            console.log('Backup-Ordner existiert bereits oder Fehler:', err.message);
        }
        
        let backupCount = 0;
        
        // Dateien kopieren mit besserer Fehlerbehandlung
        try {
            await fs.access(GLOBAL_USERS_FILE);
            await fs.copyFile(GLOBAL_USERS_FILE, `${backupDir}/globalUsers_${timestamp}.json`);
            console.log(`✅ globalUsers backup erstellt: globalUsers_${timestamp}.json`);
            backupCount++;
        } catch (err) {
            console.log(`⚠️ globalUsers backup übersprungen: ${err.message}`);
        }
        
        try {
            await fs.access(GAMES_FILE);
            await fs.copyFile(GAMES_FILE, `${backupDir}/games_${timestamp}.json`);
            console.log(`✅ games backup erstellt: games_${timestamp}.json`);
            backupCount++;
        } catch (err) {
            console.log(`⚠️ games backup übersprungen: ${err.message}`);
        }
        
        console.log(`🔄 Backup abgeschlossen: ${backupCount} Dateien gesichert (${timestamp})`);
        
        // Alte Backups bereinigen (nur die letzten 10 behalten)
        await cleanupOldBackups(backupDir);
        
    } catch (error) {
        console.error('❌ Fehler beim Backup:', error.message);
    }
}

// Neue Funktion nach createBackup hinzufügen:
async function cleanupOldBackups(backupDir) {
    try {
        const files = await fs.readdir(backupDir);
        const backupFiles = files
            .filter(file => file.endsWith('.json'))
            .map(file => ({
                name: file,
                path: `${backupDir}/${file}`,
                time: file.split('_')[1]?.replace('.json', '')
            }))
            .sort((a, b) => b.time.localeCompare(a.time));

        // Nur die letzten 10 Backups behalten
        if (backupFiles.length > 10) {
            const filesToDelete = backupFiles.slice(10);
            for (const file of filesToDelete) {
                try {
                    await fs.unlink(file.path);
                    console.log(`🗑️ Altes Backup gelöscht: ${file.name}`);
                } catch (err) {
                    console.log(`⚠️ Konnte altes Backup nicht löschen: ${file.name}`);
                }
            }
        }
    } catch (error) {
        console.log('⚠️ Backup-Bereinigung übersprungen:', error.message);
    }
}

async function restoreFromBackup(backupTimestamp) {
    try {
        const backupDir = path.join(__dirname, 'backups');
		
		console.log('=== BACKUP PATH DEBUG ===');
        console.log('Current working directory:', process.cwd());
        console.log('__dirname:', __dirname);
        console.log('Looking for backups in:', path.resolve(backupDir));
        console.log('========================');
        const globalUsersBackup = `${backupDir}/globalUsers_${backupTimestamp}.json`;
        const gamesBackup = `${backupDir}/games_${backupTimestamp}.json`;
        
        let restoredCount = 0;
        
        console.log(`🔄 Beginne Wiederherstellung für Timestamp: ${backupTimestamp}`);
        
        // Restore globalUsers if backup exists
        try {
            console.log(`🔍 Prüfe globalUsers Backup: ${globalUsersBackup}`);
            await fs.access(globalUsersBackup);
            
            const backupData = await fs.readFile(globalUsersBackup, 'utf8');
            
            // Validiere JSON
            try {
                JSON.parse(backupData);
            } catch (jsonError) {
                throw new Error(`Ungültige JSON in globalUsers Backup: ${jsonError.message}`);
            }
            
            await fs.writeFile(GLOBAL_USERS_FILE, backupData, 'utf8');
            console.log(`✅ globalUsers wiederhergestellt aus: ${globalUsersBackup}`);
            restoredCount++;
        } catch (err) {
            console.log(`⚠️ globalUsers backup nicht gefunden oder fehlerhaft: ${err.message}`);
        }
        
        // Restore games if backup exists
        try {
            console.log(`🔍 Prüfe games Backup: ${gamesBackup}`);
            await fs.access(gamesBackup);
            
            const backupData = await fs.readFile(gamesBackup, 'utf8');
            
            // Validiere JSON
            try {
                JSON.parse(backupData);
            } catch (jsonError) {
                throw new Error(`Ungültige JSON in games Backup: ${jsonError.message}`);
            }
            
            await fs.writeFile(GAMES_FILE, backupData, 'utf8');
            console.log(`✅ games wiederhergestellt aus: ${gamesBackup}`);
            restoredCount++;
        } catch (err) {
            console.log(`⚠️ games backup nicht gefunden oder fehlerhaft: ${err.message}`);
        }
        
        console.log(`📊 Wiederherstellung abgeschlossen: ${restoredCount} Dateien wiederhergestellt (${backupTimestamp})`);
        return restoredCount;
        
    } catch (error) {
        console.error('❌ Fehler bei der Wiederherstellung:', error.message);
        throw error;
    }
}

// Load latest backup on startup
async function loadLatestBackupOnStartup() {
    try {
        const backupDir = 'backups';
        // GEÄNDERT: backupFiles statt files verwenden
        const backupFiles = await fs.readdir(backupDir);
        
        console.log(`Gefundene Dateien im Backup-Ordner: ${backupFiles.length}`);

        // DEBUG: Alle Dateien ausgeben
        console.log('=== ALLE DATEIEN ===');
        backupFiles.forEach(file => {
            console.log(`Datei: ${file}`);
        });
        console.log('==================');
        
        console.log('=== BACKUP PATH DEBUG ===');
        console.log('Current working directory:', process.cwd());
        console.log('__dirname:', __dirname);
        console.log('Looking for backups in:', path.resolve(backupDir));
        console.log('========================');
        
        console.log('🔍 Prüfe Backup-Ordner...');
        
        // Check if backup directory exists
        try {
            await fs.access(backupDir);
            console.log('✅ Backup-Ordner gefunden');
        } catch {
            console.log('📁 Kein Backup-Ordner gefunden, verwende Standard-Datenbanken');
            return false;
        }
        
        // Get all backup files - GEÄNDERT: directoryFiles statt files
        const directoryFiles = await fs.readdir(backupDir);
        console.log(`📄 Gefundene Dateien im Backup-Ordner: ${directoryFiles.length}`);
        
        // Filter and parse backup files
        const validBackupFiles = [];
        
        for (const file of directoryFiles) {
            if (file.endsWith('.json')) {
                console.log(`🔍 Prüfe Datei: ${file}`);
                
                // Verbessertes Parsing der Dateinamen
                let timestamp = null;
                
                if (file.startsWith('globalUsers_')) {
                    timestamp = file.replace('globalUsers_', '').replace('.json', '');
                } else if (file.startsWith('games_')) {
                    timestamp = file.replace('games_', '').replace('.json', '');
                }
                
                if (timestamp) {
                    const existing = validBackupFiles.find(bf => bf.timestamp === timestamp);
                    if (existing) {
                        existing.files.push(file);
                    } else {
                        validBackupFiles.push({
                            timestamp: timestamp,
                            files: [file]
                        });
                    }
                    console.log(`✅ Backup-Datei erkannt: ${file} (${timestamp})`);
                }
            }
        }
        
        console.log(`📊 Gefundene Backup-Gruppen: ${validBackupFiles.length}`);
        
        if (validBackupFiles.length === 0) {
            console.log('📁 Keine Backup-Dateien gefunden, verwende Standard-Datenbanken');
            return false;
        }
        
        // Sort by timestamp (newest first)
        validBackupFiles.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        
        console.log('🔍 Suche nach vollständigstem Backup...');
        
        // Find the most recent complete backup (having both files)
        for (const backup of validBackupFiles) {
            console.log(`⏰ Prüfe Backup-Gruppe: ${backup.timestamp}`);
            console.log(`📄 Dateien: ${backup.files.join(', ')}`);
            
            const hasGlobalUsers = backup.files.some(f => f.startsWith('globalUsers_'));
            const hasGames = backup.files.some(f => f.startsWith('games_'));
            
            console.log(`👤 globalUsers vorhanden: ${hasGlobalUsers}`);
            console.log(`🎮 games vorhanden: ${hasGames}`);
            
            if (hasGlobalUsers && hasGames) {
                console.log(`✅ Vollständiges Backup gefunden: ${backup.timestamp}`);
                
                try {
                    const restoredCount = await restoreFromBackup(backup.timestamp);
                    
                    if (restoredCount > 0) {
                        console.log(`🎉 Neuestes Backup erfolgreich geladen (${backup.timestamp})`);
                        return true;
                    } else {
                        console.log(`⚠️ Backup konnte nicht wiederhergestellt werden`);
                    }
                } catch (error) {
                    console.error(`❌ Fehler beim Wiederherstellen des Backups ${backup.timestamp}:`, error.message);
                    console.log('🔄 Versuche nächstes Backup...');
                    continue;
                }
            } else {
                console.log(`⚠️ Unvollständiges Backup (${backup.timestamp}), überspringe...`);
            }
        }
        
        console.log('⚠️ Kein verwendbares Backup gefunden, verwende Standard-Datenbanken');
        return false;
        
    } catch (error) {
        console.error('❌ Fehler beim Laden des Backups:', error.message);
        console.log('📁 Verwende Standard-Datenbanken stattdessen');
        return false;
    }
}

async function writeGames(data) {
    await fs.writeFile(GAMES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Array shuffle (Fisher-Yates)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Single Elimination Bracket
function createSingleEliminationBracket(players) {
    const shuffledPlayers = shuffleArray(players);
    
    let bracketSize = 1;
    while (bracketSize < shuffledPlayers.length) {
        bracketSize *= 2;
    }
    
    const firstRound = [];
    const playersWithByes = [];
    
    const byes = bracketSize - shuffledPlayers.length;
    
    const playersCopy = [...shuffledPlayers];
    for (let i = 0; i < byes; i++) {
        const randomIndex = Math.floor(Math.random() * playersCopy.length);
        const playerWithBye = playersCopy.splice(randomIndex, 1)[0];
        playersWithByes.push(playerWithBye);
    }
    
    for (let i = 0; i < playersCopy.length; i += 2) {
        if (i + 1 < playersCopy.length) {
            firstRound.push({
                id: `match_${Date.now()}_${i/2}`,
                player1: playersCopy[i],
                player2: playersCopy[i + 1],
                winner: null,
                score1: null,
                score2: null,
                status: 'pending',
                pendingResults: []
            });
        }
    }
    
    const totalRounds = Math.log2(bracketSize);
    
    return {
        bracketSize,
        totalRounds,
        currentRound: 1,
        rounds: [firstRound],
        playersWithByes,
        isComplete: false,
        winner: null
    };
}

// ========== GLOBAL USER ROUTES ==========

app.post('/games/tiktaktoe/matches/:matchId/move', async (req, res) => {
    try {
        const { matchId } = req.params;
        const { position, walletAddress } = req.body;
        
        const gamesData = await readGames();
        let targetMatch = null;
        let tournamentId = null;
        
        // Find the match in active tiktaktoe tournaments
        for (const [tId, tournament] of Object.entries(gamesData.games.tiktaktoe.tournaments)) {
            if (tournament.bracket && tournament.bracket.rounds) {
                for (const round of tournament.bracket.rounds) {
                    const match = round.find(m => m.id === matchId);
                    if (match) {
                        targetMatch = match;
                        tournamentId = tId;
                        break;
                    }
                }
            }
            if (targetMatch) break;
        }
        
        if (!targetMatch) {
            return res.status(404).json({ error: 'Match nicht gefunden' });
        }
        
        if (targetMatch.status === 'completed') {
            return res.status(400).json({ error: 'Spiel bereits beendet' });
        }
        
        // Initialize game state if not exists
        if (!targetMatch.gameState) {
            targetMatch.gameState = {
                board: Array(9).fill(null),
                currentPlayer: targetMatch.player1.walletAddress.toLowerCase(),
                moves: [],
                startedAt: new Date().toISOString()
            };
        }
        
        const gameState = targetMatch.gameState;
        const playerAddress = walletAddress.toLowerCase();
        
        // Validate turn
        if (gameState.currentPlayer !== playerAddress) {
            return res.status(400).json({ error: 'Nicht dein Zug' });
        }
        
        // Validate position
        if (position < 0 || position > 8 || gameState.board[position] !== null) {
            return res.status(400).json({ error: 'Ungültiger Zug' });
        }
        
        // Determine player symbol
        const isPlayer1 = playerAddress === targetMatch.player1.walletAddress.toLowerCase();
        const symbol = isPlayer1 ? 'X' : 'O';
        
        // Make move
        gameState.board[position] = symbol;
        gameState.moves.push({
            player: playerAddress,
            symbol: symbol,
            position: position,
            timestamp: new Date().toISOString()
        });
        
        // Check for winner
        const winner = checkTikTakToeWinner(gameState.board);
        if (winner) {
            targetMatch.status = 'completed';
            targetMatch.winner = winner === 'X' ? targetMatch.player1 : targetMatch.player2;
            targetMatch.completedAt = new Date().toISOString();
            targetMatch.gameResult = winner;
            
            // Advance tournament
            await checkAndAdvanceRound(gamesData, 'tiktaktoe', tournamentId, 
                gamesData.games.tiktaktoe.tournaments[tournamentId].bracket.currentRound - 1);
        } else if (gameState.board.every(cell => cell !== null)) {
            // Draw - restart game
            targetMatch.gameState = {
                board: Array(9).fill(null),
                currentPlayer: targetMatch.player1.walletAddress.toLowerCase(),
                moves: [],
                startedAt: new Date().toISOString()
            };
        } else {
            // Switch players
            gameState.currentPlayer = isPlayer1 ? 
                targetMatch.player2.walletAddress.toLowerCase() : 
                targetMatch.player1.walletAddress.toLowerCase();
        }
        
        await writeGames(gamesData);
        
        res.json({ 
            message: 'Zug erfolgreich',
            gameState: targetMatch.gameState,
            status: targetMatch.status,
            winner: targetMatch.winner
        });
        
    } catch (error) {
        console.error('Error making TikTakToe move:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get TikTakToe match state
app.get('/games/tiktaktoe/matches/:matchId/state', async (req, res) => {
    try {
        const { matchId } = req.params;
        const gamesData = await readGames();
        let targetMatch = null;
        
        for (const [tId, tournament] of Object.entries(gamesData.games.tiktaktoe.tournaments)) {
            if (tournament.bracket && tournament.bracket.rounds) {
                for (const round of tournament.bracket.rounds) {
                    const match = round.find(m => m.id === matchId);
                    if (match) {
                        targetMatch = match;
                        break;
                    }
                }
            }
            if (targetMatch) break;
        }
        
        if (!targetMatch) {
            return res.status(404).json({ error: 'Match nicht gefunden' });
        }
        
        res.json({
            gameState: targetMatch.gameState,
            status: targetMatch.status,
            winner: targetMatch.winner,
            player1: targetMatch.player1,
            player2: targetMatch.player2
        });
        
    } catch (error) {
        console.error('Error getting TikTakToe state:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Helper function to check TikTakToe winner
function checkTikTakToeWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6] // diagonals
    ];
    
    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

// Register or update global user
app.post('/user/register', async (req, res) => {
    try {
        const { walletAddress, platformUsername, gamertags } = req.body;

        if (!walletAddress || !platformUsername) {
            return res.status(400).json({ error: 'Wallet-Adresse und Plattform-Username sind erforderlich' });
        }

        if (platformUsername.length > 50) {
            return res.status(400).json({ error: 'Username darf maximal 50 Zeichen lang sein' });
        }

        const globalUsers = await readGlobalUsers();
        const userKey = walletAddress.toLowerCase();
        
        // Check if username is taken by another wallet
        const existingUser = Object.values(globalUsers.users).find(user => 
            user.platformUsername.toLowerCase() === platformUsername.toLowerCase() && 
            user.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
        );

        if (existingUser) {
            return res.status(400).json({ error: 'Dieser Username ist bereits vergeben' });
        }

        const now = new Date().toISOString();
        
        if (globalUsers.users[userKey]) {
            // Update existing user
            globalUsers.users[userKey] = {
                ...globalUsers.users[userKey],
                platformUsername: platformUsername.trim(),
                gamertags: {
                    playstation: gamertags?.playstation?.trim() || '',
                    xbox: gamertags?.xbox?.trim() || '',
                    steam: gamertags?.steam?.trim() || ''
                },
                updatedAt: now
            };
        } else {
            // Create new user
            globalUsers.users[userKey] = {
                walletAddress: walletAddress,
                platformUsername: platformUsername.trim(),
                gamertags: {
                    playstation: gamertags?.playstation?.trim() || '',
                    xbox: gamertags?.xbox?.trim() || '',
                    steam: gamertags?.steam?.trim() || ''
                },
                stats: {
                    totalWins: 0,
                    gameStats: {
                        fifa: { tournaments: 0, wins: 0 },
                        cod: { tournaments: 0, wins: 0 },
						chess: { tournaments: 0, wins: 0 }
                    }
                },
                createdAt: now,
                updatedAt: now
            };
        }

        await writeGlobalUsers(globalUsers);

        res.status(201).json({
            message: 'Benutzer erfolgreich registriert/aktualisiert',
            user: globalUsers.users[userKey]
        });

    } catch (error) {
        console.error('Fehler beim Registrieren:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Update user profile
app.put('/user/update', async (req, res) => {
    try {
        const { walletAddress, platformUsername, gamertags } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet-Adresse ist erforderlich' });
        }

        if (!platformUsername || platformUsername.trim().length === 0) {
            return res.status(400).json({ error: 'Plattform-Username ist erforderlich' });
        }

        if (platformUsername.length > 50) {
            return res.status(400).json({ error: 'Username darf maximal 50 Zeichen lang sein' });
        }

        const globalUsers = await readGlobalUsers();
        const userKey = walletAddress.toLowerCase();
        
        // Check if user exists
        if (!globalUsers.users[userKey]) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        // Check if username is taken by another wallet (case-insensitive)
        const existingUser = Object.values(globalUsers.users).find(user => 
            user.platformUsername.toLowerCase() === platformUsername.toLowerCase() && 
            user.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
        );

        if (existingUser) {
            return res.status(400).json({ error: 'Dieser Username ist bereits vergeben' });
        }

        // Validate gamertag lengths
        if (gamertags) {
            if (gamertags.playstation && gamertags.playstation.length > 50) {
                return res.status(400).json({ error: 'PlayStation Gamertag darf maximal 50 Zeichen lang sein' });
            }
            if (gamertags.xbox && gamertags.xbox.length > 50) {
                return res.status(400).json({ error: 'Xbox Gamertag darf maximal 50 Zeichen lang sein' });
            }
            if (gamertags.steam && gamertags.steam.length > 50) {
                return res.status(400).json({ error: 'Steam Gamertag darf maximal 50 Zeichen lang sein' });
            }
        }

        const now = new Date().toISOString();
        
        // Update user data
        globalUsers.users[userKey] = {
            ...globalUsers.users[userKey],
            platformUsername: platformUsername.trim(),
            gamertags: {
                playstation: gamertags?.playstation?.trim() || '',
                xbox: gamertags?.xbox?.trim() || '',
                steam: gamertags?.steam?.trim() || ''
            },
            updatedAt: now
        };

        await writeGlobalUsers(globalUsers);

        res.json({
            message: 'Profil erfolgreich aktualisiert',
            user: globalUsers.users[userKey]
        });

    } catch (error) {
        console.error('Fehler beim Aktualisieren des Profils:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get user by wallet address
app.get('/user/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const globalUsers = await readGlobalUsers();
        const userKey = walletAddress.toLowerCase();
        
        const user = globalUsers.users[userKey];
        
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

    } catch (error) {
        console.error('Fehler beim Laden des Benutzers:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get all global users
app.get('/users/global', async (req, res) => {
    try {
        const globalUsers = await readGlobalUsers();
        
        res.json({
            totalUsers: Object.keys(globalUsers.users).length,
            users: Object.values(globalUsers.users)
        });
        
    } catch (error) {
        console.error('Fehler beim Laden der Benutzer:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// ========== GAME & TOURNAMENT ROUTES ==========

// Get all games
app.get('/games', async (req, res) => {
    try {
        const gamesData = await readGames();
        res.json(gamesData.games);
    } catch (error) {
        console.error('Fehler beim Laden der Spiele:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get specific game with tournaments
app.get('/games/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const gamesData = await readGames();
        
        if (!gamesData.games[gameId]) {
            return res.status(404).json({ error: 'Spiel nicht gefunden' });
        }
        
        res.json(gamesData.games[gameId]);
    } catch (error) {
        console.error('Fehler beim Laden des Spiels:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

app.get('/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const globalUsers = await readGlobalUsers();
        
        // Convert users object to array and sort by total wins
        const sortedUsers = Object.values(globalUsers.users)
            .filter(user => user.stats && user.stats.totalWins > 0) // Only users with wins
            .sort((a, b) => b.stats.totalWins - a.stats.totalWins) // Sort descending by wins
            .slice(0, limit) // Limit results
            .map((user, index) => ({
                rank: index + 1,
                platformUsername: user.platformUsername,
                totalWins: user.stats.totalWins,
                gameStats: user.stats.gameStats,
                walletAddress: user.walletAddress.slice(0, 6) + '...' + user.walletAddress.slice(-4) // Shortened for privacy
            }));

        res.json({
            totalPlayers: Object.keys(globalUsers.users).length,
            topPlayers: sortedUsers,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Fehler beim Laden der Rangliste:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

app.get('/leaderboard/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const globalUsers = await readGlobalUsers();
        
        // Get all games to validate gameId
        const gamesData = await readGames();
        if (!gamesData.games[gameId]) {
            return res.status(404).json({ error: 'Spiel nicht gefunden' });
        }
        
        // Convert users object to array and sort by game-specific wins
        const sortedUsers = Object.values(globalUsers.users)
            .filter(user => user.stats && user.stats.gameStats && user.stats.gameStats[gameId] && user.stats.gameStats[gameId].wins > 0)
            .sort((a, b) => {
                // Primary sort: wins for this game
                const winsA = a.stats.gameStats[gameId].wins || 0;
                const winsB = b.stats.gameStats[gameId].wins || 0;
                if (winsB !== winsA) return winsB - winsA;
                
                // Secondary sort: tournaments played
                const tournamentsA = a.stats.gameStats[gameId].tournaments || 0;
                const tournamentsB = b.stats.gameStats[gameId].tournaments || 0;
                return tournamentsB - tournamentsA;
            })
            .slice(0, limit)
            .map((user, index) => ({
                rank: index + 1,
                platformUsername: user.platformUsername,
                wins: user.stats.gameStats[gameId].wins || 0,
                tournaments: user.stats.gameStats[gameId].tournaments || 0,
                walletAddress: user.walletAddress.slice(0, 6) + '...' + user.walletAddress.slice(-4)
            }));

        res.json({
            gameId: gameId,
            gameName: gamesData.games[gameId].name,
            totalPlayers: Object.values(globalUsers.users).filter(user => 
                user.stats && user.stats.gameStats && user.stats.gameStats[gameId] && user.stats.gameStats[gameId].tournaments > 0
            ).length,
            topPlayers: sortedUsers,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Fehler beim Laden der spielspezifischen Rangliste:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get available games for leaderboard
app.get('/games/available', async (req, res) => {
    try {
        const gamesData = await readGames();
        const availableGames = Object.entries(gamesData.games).map(([id, game]) => ({
            id: id,
            name: game.name
        }));
        
        res.json({ games: availableGames });
    } catch (error) {
        console.error('Fehler beim Laden der verfügbaren Spiele:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get active chess tournament
app.get('/games/chess/tournaments/active', async (req, res) => {
    try {
        const gamesData = await readGames();
        const chessGame = gamesData.games.chess;
        
        if (!chessGame || !chessGame.tournaments) {
            return res.status(404).json({ error: 'Keine Chess-Turniere gefunden' });
        }
        
        // Find active tournament (started status)
        const activeTournament = Object.values(chessGame.tournaments)
            .find(t => t.status === 'started');
        
        if (activeTournament) {
            res.json(activeTournament);
        } else {
            res.status(404).json({ error: 'Kein aktives Chess-Turnier gefunden' });
        }
    } catch (error) {
        console.error('Error loading active chess tournament:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

app.post('/games/chess/matches/:matchId/result', async (req, res) => {
    try {
        const { matchId } = req.params;
        const { winner, gameData, walletAddress } = req.body;
        
        const gamesData = await readGames();
        let targetMatch = null;
        let tournamentId = null;
        
        // Find the match in active chess tournaments
        for (const [tId, tournament] of Object.entries(gamesData.games.chess.tournaments)) {
            if (tournament.bracket && tournament.bracket.rounds) {
                for (const round of tournament.bracket.rounds) {
                    const match = round.find(m => m.id === matchId);
                    if (match) {
                        targetMatch = match;
                        tournamentId = tId;
                        break;
                    }
                }
            }
            if (targetMatch) break;
        }
        
        if (!targetMatch) {
            return res.status(404).json({ error: 'Match nicht gefunden' });
        }
        
        // Determine winner player object
        const winnerPlayer = winner === 'white' ? targetMatch.player1 : targetMatch.player2;
        
        // Update match
        targetMatch.winner = winnerPlayer;
        targetMatch.status = 'completed';
        targetMatch.completedAt = new Date().toISOString();
        targetMatch.gameData = gameData;
        
        // Check if tournament advances
        await checkAndAdvanceRound(gamesData, 'chess', tournamentId, 
            gamesData.games.chess.tournaments[tournamentId].bracket.currentRound - 1);
        
        await writeGames(gamesData);
        
        res.json({ message: 'Chess-Spielergebnis erfolgreich übermittelt' });
        
    } catch (error) {
        console.error('Error submitting chess result:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Register for tournament
app.post('/games/:gameId/tournaments/:tournamentId/register', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet-Adresse ist erforderlich' });
        }

        // Check if user exists globally
        const globalUsers = await readGlobalUsers();
        const userKey = walletAddress.toLowerCase();
        
        if (!globalUsers.users[userKey]) {
            return res.status(400).json({ error: 'Benutzer muss sich zuerst global registrieren' });
        }

        const gamesData = await readGames();
        
        if (!gamesData.games[gameId]) {
            return res.status(404).json({ error: 'Spiel nicht gefunden' });
        }

        if (!gamesData.games[gameId].tournaments[tournamentId]) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }

        const tournament = gamesData.games[gameId].tournaments[tournamentId];

        if (tournament.status !== 'registration') {
            return res.status(400).json({ error: 'Registrierung für dieses Turnier ist geschlossen' });
        }

        // Check if already registered
        if (tournament.participants.find(p => p.walletAddress.toLowerCase() === walletAddress.toLowerCase())) {
            return res.status(400).json({ error: 'Bereits für dieses Turnier registriert' });
        }

        // Add participant
        const user = globalUsers.users[userKey];
        tournament.participants.push({
            id: Date.now().toString(),
            walletAddress: user.walletAddress,
            platformUsername: user.platformUsername,
            gamertags: user.gamertags,
            registrationTime: new Date().toISOString()
        });

        // Auto-start check
        if (tournament.autoStartPlayerCount && 
            tournament.participants.length >= tournament.autoStartPlayerCount &&
            tournament.status === 'registration') {
            
            console.log(`Auto-starting tournament ${tournament.name} with ${tournament.participants.length} players`);
            
            // Create bracket
            const bracket = createSingleEliminationBracket(tournament.participants);
            
            tournament.status = 'started';
            tournament.startedAt = new Date().toISOString();
            tournament.bracket = bracket;
            
            console.log(`Tournament ${tournament.name} automatically started!`);
        }

        await writeGames(gamesData);

        res.status(201).json({
            message: 'Erfolgreich für Turnier registriert',
            tournament: tournament
        });

    } catch (error) {
        console.error('Fehler bei der Turnier-Registrierung:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});




// Unregister from tournament
app.post('/games/:gameId/tournaments/:tournamentId/unregister', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet-Adresse ist erforderlich' });
        }

        const gamesData = await readGames();
        
        if (!gamesData.games[gameId]) {
            return res.status(404).json({ error: 'Spiel nicht gefunden' });
        }

        if (!gamesData.games[gameId].tournaments[tournamentId]) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }

        const tournament = gamesData.games[gameId].tournaments[tournamentId];

        if (tournament.status !== 'registration') {
            return res.status(400).json({ error: 'Abmeldung nur während der Registrierungsphase möglich' });
        }

        // Find participant
        const participantIndex = tournament.participants.findIndex(p => 
            p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );

        if (participantIndex === -1) {
            return res.status(400).json({ error: 'Nicht für dieses Turnier registriert' });
        }

        // Remove participant
        tournament.participants.splice(participantIndex, 1);

        await writeGames(gamesData);

        res.json({
            message: 'Erfolgreich vom Turnier abgemeldet',
            tournament: tournament
        });

    } catch (error) {
        console.error('Fehler bei der Turnier-Abmeldung:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Create new tournament
app.post('/games/:gameId/tournaments', async (req, res) => {
    try {
        const { gameId } = req.params;
		const { name, description, autoStartPlayerCount } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Turnier-Name ist erforderlich' });
        }
		
				if (autoStartPlayerCount) {
			const validPlayerCounts = [2, 4, 8, 16, 32, 64];
			if (!validPlayerCounts.includes(parseInt(autoStartPlayerCount))) {
				return res.status(400).json({ error: 'Ungültige Spieleranzahl für Auto-Start' });
			}
		}

        const gamesData = await readGames();
        
        if (!gamesData.games[gameId]) {
            return res.status(404).json({ error: 'Spiel nicht gefunden' });
        }

        const tournamentId = `tournament_${Date.now()}`;
        const tournament = {
			id: tournamentId,
			name: name.trim(),
			description: description?.trim() || '',
			gameId: gameId,
			status: 'registration',
			participants: [],
			bracket: null,
			autoStartPlayerCount: autoStartPlayerCount || null, // NEU
			createdAt: new Date().toISOString(),
			startedAt: null,
			finishedAt: null,
			winner: null
		};

        gamesData.games[gameId].tournaments[tournamentId] = tournament;

        // Set as active tournament if none exists
        if (!gamesData.games[gameId].activeTournamentId) {
            gamesData.games[gameId].activeTournamentId = tournamentId;
        }

        await writeGames(gamesData);

        res.status(201).json({
            message: 'Turnier erfolgreich erstellt',
            tournament: tournament
        });

    } catch (error) {
        console.error('Fehler beim Erstellen des Turniers:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Auto-Tournament Verwaltung
const AUTO_TOURNAMENT_CONFIG = {
    sizes: [2, 4, 8, 16],
    games: ['fifa', 'cod', 'chess', 'tiktaktoe'],
    cleanupIntervalHours: 24
};

class AutoTournamentManager {
    constructor() {
        this.isInitialized = false;
        this.cleanupInterval = null;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log('Initialisiere Auto-Tournament System...');
        
        try {
            await this.ensureAutoTournaments();
            this.startCleanupScheduler();
            this.isInitialized = true;
            console.log('Auto-Tournament System erfolgreich initialisiert');
        } catch (error) {
            console.error('Fehler bei Auto-Tournament Initialisierung:', error);
        }
    }

    async ensureAutoTournaments() {
    const gamesData = await readGames();
    let hasChanges = false;

    for (const gameId of AUTO_TOURNAMENT_CONFIG.games) {
        if (!gamesData.games[gameId]) continue;

        for (const size of AUTO_TOURNAMENT_CONFIG.sizes) {
            const existingTournament = this.findOpenAutoTournament(gamesData.games[gameId], size);
            
            if (!existingTournament) {
                await this.createAutoTournament(gameId, size);
                hasChanges = true;
                console.log(`Auto-Turnier erstellt: ${gameId} ${size}P`);
                
                // Kleine Verzögerung zwischen den Erstellungen
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }
}

    findOpenAutoTournament(gameData, size) {
        if (!gameData.tournaments) return null;

        return Object.values(gameData.tournaments).find(tournament => 
            tournament.isAutoTournament && 
            tournament.autoStartPlayerCount === size && 
            tournament.status === 'registration'
        );
    }

    async createAutoTournament(gameId, playerCount) {
    // Frische Daten laden um Konflikte zu vermeiden
    const gamesData = await readGames();
    
    const now = new Date();
    const dateString = now.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const timeString = now.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const tournamentId = `auto_tournament_${gameId}_${playerCount}p_${Date.now()}`;
    const gameName = gamesData.games[gameId].name;
    
    const tournament = {
        id: tournamentId,
        name: `${gameName} ${playerCount}P - ${dateString} ${timeString}`,
        description: `Automatisches ${playerCount}-Spieler Turnier`,
        gameId: gameId,
        status: 'registration',
        participants: [],
        bracket: null,
        autoStartPlayerCount: playerCount,
        isAutoTournament: true,
        createdAt: now.toISOString(),
        startedAt: null,
        finishedAt: null,
        winner: null
    };

    gamesData.games[gameId].tournaments[tournamentId] = tournament;
    await writeGames(gamesData);
    
    console.log(`Neues Auto-Turnier erstellt: ${tournament.name}`);
    return tournament;
}

    async cleanupOldTournaments() {
        const gamesData = await readGames();
        const cutoffTime = new Date(Date.now() - (AUTO_TOURNAMENT_CONFIG.cleanupIntervalHours * 60 * 60 * 1000));
        let cleanedCount = 0;

        for (const [gameId, game] of Object.entries(gamesData.games)) {
            if (!game.tournaments) continue;

            const tournamentsToDelete = [];

            for (const [tournamentId, tournament] of Object.entries(game.tournaments)) {
                if (tournament.isAutoTournament && 
                    tournament.status === 'finished' && 
                    tournament.finishedAt &&
                    new Date(tournament.finishedAt) < cutoffTime) {
                    
                    tournamentsToDelete.push(tournamentId);
                }
            }

            for (const tournamentId of tournamentsToDelete) {
                delete game.tournaments[tournamentId];
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            await writeGames(gamesData);
            console.log(`${cleanedCount} alte Auto-Turniere bereinigt`);
        }
    }

    startCleanupScheduler() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupOldTournaments();
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldTournaments();
        }, 6 * 60 * 60 * 1000);
    }

    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.isInitialized = false;
        console.log('Auto-Tournament System heruntergefahren');
    }
}

const autoTournamentManager = new AutoTournamentManager();

// Start tournament
app.post('/games/:gameId/tournaments/:tournamentId/start', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const gamesData = await readGames();
        
        if (!gamesData.games[gameId] || !gamesData.games[gameId].tournaments[tournamentId]) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }

        const tournament = gamesData.games[gameId].tournaments[tournamentId];

        if (tournament.participants.length < 2) {
            return res.status(400).json({ error: 'Mindestens 2 Spieler müssen registriert sein' });
        }
        
        if (tournament.status === 'started') {
            return res.status(400).json({ error: 'Turnier wurde bereits gestartet' });
        }
        
        // Create bracket
        const bracket = createSingleEliminationBracket(tournament.participants);
        
        tournament.status = 'started';
        tournament.startedAt = new Date().toISOString();
        tournament.bracket = bracket;
        
        await writeGames(gamesData);
        
        console.log(`Turnier ${tournament.name} gestartet mit ${tournament.participants.length} Spielern`);
        
        res.json({
            message: 'Turnier erfolgreich gestartet',
            tournament: tournament
        });
        
    } catch (error) {
        console.error('Fehler beim Starten des Turniers:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get tournament details
app.get('/games/:gameId/tournaments/:tournamentId', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const gamesData = await readGames();
        
        if (!gamesData.games[gameId] || !gamesData.games[gameId].tournaments[tournamentId]) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }

        res.json(gamesData.games[gameId].tournaments[tournamentId]);
        
    } catch (error) {
        console.error('Fehler beim Laden des Turniers:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Submit match result
app.post('/games/:gameId/tournaments/:tournamentId/matches/:matchId/submit-result', async (req, res) => {
    try {
        const { gameId, tournamentId, matchId } = req.params;
        const { submittedBy, walletAddress, score1, score2 } = req.body;
        
        if (!submittedBy || !walletAddress || score1 === undefined || score2 === undefined) {
            return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
        }
        
        if (score1 === score2) {
            return res.status(400).json({ error: 'Unentschieden sind nicht erlaubt' });
        }
        
        const gamesData = await readGames();
        const tournament = gamesData.games[gameId]?.tournaments[tournamentId];
        
        if (!tournament) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }
        
        // Find match
        let targetMatch = null;
        let roundIndex = -1;
        
        for (let i = 0; i < tournament.bracket.rounds.length; i++) {
            const match = tournament.bracket.rounds[i].find(m => m.id === matchId);
            if (match) {
                targetMatch = match;
                roundIndex = i;
                break;
            }
        }
        
        if (!targetMatch) {
            return res.status(404).json({ error: 'Match nicht gefunden' });
        }
        
        if (targetMatch.status === 'completed') {
            return res.status(400).json({ error: 'Match wurde bereits abgeschlossen' });
        }
        
        if (submittedBy !== targetMatch.player1.id && submittedBy !== targetMatch.player2.id) {
            return res.status(403).json({ error: 'Sie sind nicht Teil dieses Matches' });
        }
        
        if (!targetMatch.pendingResults) {
            targetMatch.pendingResults = [];
        }
        
        const existingResult = targetMatch.pendingResults.find(r => r.submittedBy === submittedBy);
        if (existingResult) {
            return res.status(400).json({ error: 'Sie haben bereits ein Ergebnis eingereicht' });
        }
        
        targetMatch.pendingResults.push({
            submittedBy,
            walletAddress,
            score1: parseInt(score1),
            score2: parseInt(score2),
            submittedAt: new Date().toISOString()
        });
        
        // Check if both players submitted
        if (targetMatch.pendingResults.length === 2) {
            const result1 = targetMatch.pendingResults[0];
            const result2 = targetMatch.pendingResults[1];
            
            if (result1.score1 === result2.score1 && result1.score2 === result2.score2) {
                // Results match - complete match
                targetMatch.score1 = result1.score1;
                targetMatch.score2 = result1.score2;
                targetMatch.winner = result1.score1 > result1.score2 ? targetMatch.player1 : targetMatch.player2;
                targetMatch.status = 'completed';
                targetMatch.completedAt = new Date().toISOString();
                targetMatch.completedBy = 'auto';
                
                // Check if tournament is complete and update stats
                await checkAndAdvanceRound(gamesData, gameId, tournamentId, roundIndex);
                await writeGames(gamesData);
                
                return res.json({
                    message: 'Ergebnis eingereicht und Match automatisch abgeschlossen',
                    tournament: tournament
                });
            } else {
                targetMatch.pendingResults.forEach(r => r.conflict = true);
                await writeGames(gamesData);
                
                return res.json({
                    message: 'Ergebnis eingereicht - Konflikt erkannt, Admin-Entscheidung erforderlich',
                    conflict: true
                });
            }
        } else {
            await writeGames(gamesData);
            return res.json({
                message: 'Ergebnis eingereicht - warte auf Gegner',
                waitingForOpponent: true
            });
        }
        
    } catch (error) {
        console.error('Fehler beim Einreichen des Ergebnisses:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Admin: Set match result
app.post('/games/:gameId/tournaments/:tournamentId/matches/:matchId/result', async (req, res) => {
    try {
        const { gameId, tournamentId, matchId } = req.params;
        const { winnerId, score1, score2 } = req.body;
        
        const gamesData = await readGames();
        const tournament = gamesData.games[gameId]?.tournaments[tournamentId];
        
        if (!tournament) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }
        
        let targetMatch = null;
        let roundIndex = -1;
        
        for (let i = 0; i < tournament.bracket.rounds.length; i++) {
            const match = tournament.bracket.rounds[i].find(m => m.id === matchId);
            if (match) {
                targetMatch = match;
                roundIndex = i;
                break;
            }
        }
        
        if (!targetMatch) {
            return res.status(404).json({ error: 'Match nicht gefunden' });
        }
        
        if (score1 !== undefined && score2 !== undefined) {
            targetMatch.score1 = parseInt(score1);
            targetMatch.score2 = parseInt(score2);
            targetMatch.winner = targetMatch.score1 > targetMatch.score2 ? targetMatch.player1 : targetMatch.player2;
        } else if (winnerId) {
            if (winnerId !== targetMatch.player1.id && winnerId !== targetMatch.player2.id) {
                return res.status(400).json({ error: 'Ungültige Gewinner-ID' });
            }
            targetMatch.winner = winnerId === targetMatch.player1.id ? targetMatch.player1 : targetMatch.player2;
        } else {
            return res.status(400).json({ error: 'Gewinner oder Spielstand erforderlich' });
        }
        
        targetMatch.status = 'completed';
        targetMatch.completedAt = new Date().toISOString();
        targetMatch.completedBy = 'admin';
        targetMatch.pendingResults = [];
        
        await checkAndAdvanceRound(gamesData, gameId, tournamentId, roundIndex);
        await writeGames(gamesData);
        
        res.json({
            message: 'Match-Ergebnis erfolgreich eingetragen',
            tournament: tournament
        });
        
    } catch (error) {
        console.error('Fehler beim Eintragen des Match-Ergebnisses:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Helper function: Check and advance round
async function checkAndAdvanceRound(gamesData, gameId, tournamentId, currentRoundIndex) {
    const tournament = gamesData.games[gameId].tournaments[tournamentId];
    const currentRound = tournament.bracket.rounds[currentRoundIndex];
    const allMatchesCompleted = currentRound.every(m => m.status === 'completed');
    
    if (allMatchesCompleted) {
        const winners = currentRound.map(m => m.winner);
        const advancingPlayers = [...winners];
        
        if (currentRoundIndex === 0 && tournament.bracket.playersWithByes) {
            advancingPlayers.push(...tournament.bracket.playersWithByes);
            tournament.bracket.playersWithByes = [];
        }
        
        if (advancingPlayers.length === 1) {
            // Tournament finished
            tournament.bracket.isComplete = true;
            tournament.bracket.winner = advancingPlayers[0];
            tournament.status = 'finished';
            tournament.finishedAt = new Date().toISOString();
            tournament.winner = advancingPlayers[0];
            
            // Update global user stats
            await updateUserStats(advancingPlayers[0].walletAddress, gameId, true);
            
            console.log(`Turnier ${tournament.name} beendet! Gewinner: ${advancingPlayers[0].platformUsername}`);
            
            // Erstelle neues Auto-Turnier
            if (tournament.isAutoTournament) {
					try {
						// WICHTIG: Erst die aktuellen Daten speichern
						await writeGames(gamesData);
						
						// Dann neues Auto-Turnier erstellen - aber erst nach einer kurzen Verzögerung
						setTimeout(async () => {
							try {
								await autoTournamentManager.createAutoTournament(gameId, tournament.autoStartPlayerCount);
								console.log(`Ersatz-Auto-Turnier erstellt für ${gameId} ${tournament.autoStartPlayerCount}P`);
							} catch (error) {
								console.error('Fehler beim Erstellen des Ersatz-Turniers:', error);
							}
						}, 1000); // 1 Sekunde Verzögerung
					} catch (error) {
						console.error('Fehler beim Erstellen des Ersatz-Turniers:', error);
					}
				}
            
        } else if (currentRoundIndex + 1 === tournament.bracket.currentRound) {
            tournament.bracket.currentRound++;
            const nextRound = [];
            
            for (let i = 0; i < advancingPlayers.length; i += 2) {
                if (i + 1 < advancingPlayers.length) {
                    nextRound.push({
                        id: `match_${Date.now()}_${i/2}_round${tournament.bracket.currentRound}`,
                        player1: advancingPlayers[i],
                        player2: advancingPlayers[i + 1],
                        winner: null,
                        score1: null,
                        score2: null,
                        status: 'pending',
                        pendingResults: []
                    });
                }
            }
            
            tournament.bracket.rounds.push(nextRound);
            console.log(`Runde ${tournament.bracket.currentRound} erstellt mit ${nextRound.length} Matches`);
        }
    }
}

// Update user statistics
async function updateUserStats(walletAddress, gameId, isWinner) {
    const globalUsers = await readGlobalUsers();
    const userKey = walletAddress.toLowerCase();
    
    if (globalUsers.users[userKey]) {
        const user = globalUsers.users[userKey];
        
        if (isWinner) {
            user.stats.totalWins++;
            user.stats.gameStats[gameId].wins++;
        }
        
        user.stats.gameStats[gameId].tournaments++;
        user.updatedAt = new Date().toISOString();
        
        await writeGlobalUsers(globalUsers);
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.delete('/games/:gameId/tournaments/:tournamentId', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const gamesData = await readGames();
        
        if (!gamesData.games[gameId]) {
            return res.status(404).json({ error: 'Spiel nicht gefunden' });
        }

        if (!gamesData.games[gameId].tournaments[tournamentId]) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }

        // Delete tournament
        delete gamesData.games[gameId].tournaments[tournamentId];

        // Reset active tournament if this was the active one
        if (gamesData.games[gameId].activeTournamentId === tournamentId) {
            gamesData.games[gameId].activeTournamentId = null;
        }

        await writeGames(gamesData);

        res.json({
            message: 'Turnier erfolgreich gelöscht'
        });

    } catch (error) {
        console.error('Error deleting tournament:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Reset tournament (clear all participants)
app.post('/games/:gameId/tournaments/:tournamentId/reset', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const gamesData = await readGames();
        
        if (!gamesData.games[gameId] || !gamesData.games[gameId].tournaments[tournamentId]) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }

        const tournament = gamesData.games[gameId].tournaments[tournamentId];

        if (tournament.status !== 'registration') {
            return res.status(400).json({ error: 'Nur Turniere im Registrierungsstatus können zurückgesetzt werden' });
        }

        // Reset tournament data
        tournament.participants = [];
        tournament.bracket = null;
        tournament.winner = null;
        tournament.finishedAt = null;
        tournament.updatedAt = new Date().toISOString();

        await writeGames(gamesData);

        res.json({
            message: 'Turnier erfolgreich zurückgesetzt',
            tournament: tournament
        });

    } catch (error) {
        console.error('Error resetting tournament:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get Auto-Tournament Status
app.get('/admin/auto-tournaments/status', async (req, res) => {
    try {
        const gamesData = await readGames();
        const status = {};

        for (const gameId of AUTO_TOURNAMENT_CONFIG.games) {
            status[gameId] = {};
            
            for (const size of AUTO_TOURNAMENT_CONFIG.sizes) {
                const tournament = autoTournamentManager.findOpenAutoTournament(gamesData.games[gameId], size);
                status[gameId][`${size}p`] = {
                    exists: !!tournament,
                    tournamentId: tournament?.id,
                    participants: tournament?.participants?.length || 0,
                    name: tournament?.name
                };
            }
        }

        res.json({
            isInitialized: autoTournamentManager.isInitialized,
            tournaments: status
        });
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Laden des Auto-Tournament Status' });
    }
});

// Force Auto-Tournament Creation
app.post('/admin/auto-tournaments/ensure', async (req, res) => {
    try {
        await autoTournamentManager.ensureAutoTournaments();
        res.json({ message: 'Auto-Turniere erfolgreich sichergestellt' });
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Sicherstellen der Auto-Turniere' });
    }
});

// Manual Cleanup
app.post('/admin/auto-tournaments/cleanup', async (req, res) => {
    try {
        await autoTournamentManager.cleanupOldTournaments();
        res.json({ message: 'Alte Auto-Turniere erfolgreich bereinigt' });
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Bereinigen alter Auto-Turniere' });
    }
});

// Reset match result
app.post('/games/:gameId/tournaments/:tournamentId/matches/:matchId/reset', async (req, res) => {
    try {
        const { gameId, tournamentId, matchId } = req.params;
        const gamesData = await readGames();
        
        const tournament = gamesData.games[gameId]?.tournaments[tournamentId];
        if (!tournament) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }

        // Find match in bracket
        let targetMatch = null;
        let roundIndex = -1;
        let matchIndex = -1;

        for (let i = 0; i < tournament.bracket.rounds.length; i++) {
            const matchIdx = tournament.bracket.rounds[i].findIndex(m => m.id === matchId);
            if (matchIdx !== -1) {
                targetMatch = tournament.bracket.rounds[i][matchIdx];
                roundIndex = i;
                matchIndex = matchIdx;
                break;
            }
        }

        if (!targetMatch) {
            return res.status(404).json({ error: 'Match nicht gefunden' });
        }

        if (targetMatch.status !== 'completed') {
            return res.status(400).json({ error: 'Match ist noch nicht abgeschlossen' });
        }

        // Reset match
        targetMatch.winner = null;
        targetMatch.score1 = null;
        targetMatch.score2 = null;
        targetMatch.status = 'pending';
        targetMatch.completedAt = null;
        targetMatch.completedBy = null;
        targetMatch.pendingResults = [];

        // This is a simplified reset - in a real scenario, you might need to:
        // 1. Remove players from subsequent rounds
        // 2. Reset tournament status if it was completed
        // 3. Update bracket structure appropriately
        
        // For now, we'll just reset the match and let admins handle the consequences
        if (tournament.status === 'finished') {
            tournament.status = 'started';
            tournament.finishedAt = null;
            tournament.winner = null;
            tournament.bracket.isComplete = false;
            tournament.bracket.winner = null;
        }

        await writeGames(gamesData);

        res.json({
            message: 'Match erfolgreich zurückgesetzt',
            tournament: tournament
        });

    } catch (error) {
        console.error('Error resetting match:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Cancel tournament (delete tournament and reset status)
app.post('/games/:gameId/tournaments/:tournamentId/cancel', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const gamesData = await readGames();
        
        if (!gamesData.games[gameId] || !gamesData.games[gameId].tournaments[tournamentId]) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }

        const tournament = gamesData.games[gameId].tournaments[tournamentId];

        if (tournament.status === 'finished') {
            return res.status(400).json({ error: 'Beendete Turniere können nicht abgebrochen werden' });
        }

        // Delete tournament
        delete gamesData.games[gameId].tournaments[tournamentId];

        // Reset active tournament if this was the active one
        if (gamesData.games[gameId].activeTournamentId === tournamentId) {
            gamesData.games[gameId].activeTournamentId = null;
        }

        await writeGames(gamesData);

        res.json({
            message: `Turnier "${tournament.name}" wurde abgebrochen und gelöscht`
        });

    } catch (error) {
        console.error('Error canceling tournament:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get tournament participants (additional utility endpoint)
app.get('/games/:gameId/tournaments/:tournamentId/participants', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const gamesData = await readGames();
        
        const tournament = gamesData.games[gameId]?.tournaments[tournamentId];
        if (!tournament) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }

        res.json({
            participants: tournament.participants || [],
            count: tournament.participants?.length || 0
        });

    } catch (error) {
        console.error('Error loading participants:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Admin: Force complete tournament (utility endpoint)
app.post('/games/:gameId/tournaments/:tournamentId/force-complete', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const { winnerId } = req.body;
        
        const gamesData = await readGames();
        const tournament = gamesData.games[gameId]?.tournaments[tournamentId];
        
        if (!tournament) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }

        if (!winnerId) {
            return res.status(400).json({ error: 'Gewinner-ID ist erforderlich' });
        }

        // Find winner in participants
        const winner = tournament.participants.find(p => p.id === winnerId);
        if (!winner) {
            return res.status(400).json({ error: 'Gewinner nicht in Teilnehmerliste gefunden' });
        }

        // Force complete tournament
        tournament.status = 'finished';
        tournament.finishedAt = new Date().toISOString();
        tournament.winner = winner;
        
        if (tournament.bracket) {
            tournament.bracket.isComplete = true;
            tournament.bracket.winner = winner;
        }

        // Update global user stats
        await updateUserStats(winner.walletAddress, gameId, true);

        await writeGames(gamesData);

        res.json({
            message: 'Turnier erfolgreich abgeschlossen',
            tournament: tournament
        });

    } catch (error) {
        console.error('Error force completing tournament:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

app.post('/admin/backup/create', async (req, res) => {
    try {
        await createBackup();
        res.json({ message: 'Backup erfolgreich erstellt' });
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Erstellen des Backups: ' + error.message });
    }
});

// List Backups Endpoint
app.get('/admin/backup/list', async (req, res) => {
    try {
        const backupDir = 'backups';
        const files = await fs.readdir(backupDir);
        const backupFiles = files
            .filter(file => file.endsWith('.json'))
            .sort((a, b) => b.localeCompare(a));
        
        res.json({ backups: backupFiles });
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Laden der Backup-Liste: ' + error.message });
    }
});

app.post('/admin/backup/restore', async (req, res) => {
    try {
        const { timestamp } = req.body;
        
        if (!timestamp) {
            return res.status(400).json({ error: 'Backup-Timestamp ist erforderlich' });
        }
        
        // Aktuellen Stand sichern vor Wiederherstellung
        console.log('📦 Erstelle Sicherheitsbackup vor Wiederherstellung...');
        await createBackup();
        
        const restoredCount = await restoreFromBackup(timestamp);
        
        if (restoredCount === 0) {
            return res.status(404).json({ error: 'Keine Backup-Dateien für diesen Timestamp gefunden' });
        }
        
        res.json({ 
            message: `Backup erfolgreich wiederhergestellt (${restoredCount} Dateien)`,
            timestamp: timestamp,
            restoredFiles: restoredCount
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Fehler bei der Wiederherstellung: ' + error.message });
    }
});

// Get backup details
app.get('/admin/backup/:timestamp', async (req, res) => {
    try {
        const { timestamp } = req.params;
        const backupDir = 'backups';
        
        const details = {
            timestamp: timestamp,
            files: {}
        };
        
        // Check globalUsers backup
        try {
            const globalUsersPath = `${backupDir}/globalUsers_${timestamp}.json`;
            await fs.access(globalUsersPath);
            const stats = await fs.stat(globalUsersPath);
            details.files.globalUsers = {
                exists: true,
                size: stats.size,
                modified: stats.mtime
            };
        } catch {
            details.files.globalUsers = { exists: false };
        }
        
        // Check games backup
        try {
            const gamesPath = `${backupDir}/games_${timestamp}.json`;
            await fs.access(gamesPath);
            const stats = await fs.stat(gamesPath);
            details.files.games = {
                exists: true,
                size: stats.size,
                modified: stats.mtime
            };
        } catch {
            details.files.games = { exists: false };
        }
        
        res.json(details);
        
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Laden der Backup-Details: ' + error.message });
    }
});

// Download backup file
app.get('/admin/backup/download/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const backupDir = 'backups';
        const filePath = `${backupDir}/${filename}`;
        
        // Security check - only allow .json files from backup directory
        if (!filename.endsWith('.json') || filename.includes('..')) {
            return res.status(400).json({ error: 'Ungültiger Dateiname' });
        }
        
        await fs.access(filePath);
        res.download(filePath);
        
    } catch (error) {
        res.status(404).json({ error: 'Backup-Datei nicht gefunden' });
    }
});

// Export tournament data
app.get('/games/:gameId/tournaments/:tournamentId/export', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const gamesData = await readGames();
        
        const tournament = gamesData.games[gameId]?.tournaments[tournamentId];
        if (!tournament) {
            return res.status(404).json({ error: 'Turnier nicht gefunden' });
        }

        const exportData = {
            tournamentInfo: {
                name: tournament.name,
                description: tournament.description,
                gameId: gameId,
                status: tournament.status,
                createdAt: tournament.createdAt,
                startedAt: tournament.startedAt,
                finishedAt: tournament.finishedAt
            },
            participants: tournament.participants || [],
            bracket: tournament.bracket,
            winner: tournament.winner,
            exportedAt: new Date().toISOString(),
            exportedBy: 'admin'
        };

        res.json(exportData);

    } catch (error) {
        console.error('Error exporting tournament:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get admin statistics
app.get('/admin/stats', async (req, res) => {
    try {
        const [gamesData, globalUsers] = await Promise.all([
            readGames(),
            readGlobalUsers()
        ]);

        const stats = {
            totalUsers: Object.keys(globalUsers.users).length,
            totalTournaments: 0,
            activeTournaments: 0,
            completedTournaments: 0,
            totalMatches: 0,
            completedMatches: 0
        };

        // Calculate tournament and match statistics
        Object.values(gamesData.games).forEach(game => {
            if (game.tournaments) {
                const tournaments = Object.values(game.tournaments);
                stats.totalTournaments += tournaments.length;
                
                tournaments.forEach(tournament => {
                    if (tournament.status === 'started' || tournament.status === 'registration') {
                        stats.activeTournaments++;
                    } else if (tournament.status === 'finished') {
                        stats.completedTournaments++;
                    }

                    // Count matches
                    if (tournament.bracket && tournament.bracket.rounds) {
                        tournament.bracket.rounds.forEach(round => {
                            stats.totalMatches += round.length;
                            stats.completedMatches += round.filter(m => m.status === 'completed').length;
                        });
                    }
                });
            }
        });

        // User registration statistics
        const today = new Date().toDateString();
        const thisWeek = new Date();
        thisWeek.setDate(thisWeek.getDate() - 7);

        stats.todayRegistrations = Object.values(globalUsers.users).filter(user => 
            user.createdAt && new Date(user.createdAt).toDateString() === today
        ).length;

        stats.weekRegistrations = Object.values(globalUsers.users).filter(user => 
            user.createdAt && new Date(user.createdAt) > thisWeek
        ).length;

        res.json(stats);

    } catch (error) {
        console.error('Error loading admin stats:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Server start
// Server start
app.listen(PORT, async () => {
    console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
    console.log(`📊 Admin-Bereich: http://localhost:${PORT}/admin.html`);
    console.log(`🏆 Turnierbaum: http://localhost:${PORT}/tournament.html`);
    
    // Load latest backup first
    console.log('📥 Versuche neuestes Backup zu laden...');
    const backupLoaded = await loadLatestBackupOnStartup();
    
    if (!backupLoaded) {
        // Dateien beim Start sicherstellen (nur wenn kein Backup geladen wurde)
        console.log('📋 Initialisiere Standard-Datenbanken...');
        await readGlobalUsers();
        await readGames();
    }
    
    // Backup nach dem Start erstellen
    console.log('💾 Erstelle Startup-Backup...');
    await createBackup();
    
    // Auto-Tournament System starten
    try {
        await autoTournamentManager.initialize();
        console.log('⚡ Auto-Tournament System erfolgreich gestartet');
    } catch (error) {
        console.error('❌ Fehler beim Starten des Auto-Tournament Systems:', error);
    }
    
    console.log('✅ Server vollständig initialisiert');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Server wird beendet...');
	autoTournamentManager.shutdown();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Server wird beendet...');
	autoTournamentManager.shutdown();
    process.exit(0);
});