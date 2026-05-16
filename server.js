const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ========== EMAIL (SMTP via Schwarzkünstler) ==========

const SMTP_HOST = process.env.SMTP_HOST || 'mail.zyphor-group.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = `Zyphor <${SMTP_USER}>`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://zyphor-group.com';

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: false }
});

async function sendEmail(to, subject, html) {
    if (!SMTP_USER || !SMTP_PASS) {
        console.warn('⚠️  SMTP nicht konfiguriert – Email nicht gesendet an:', to);
        return false;
    }
    try {
        await transporter.sendMail({ from: FROM_EMAIL, to, subject, html });
        console.log(`📧 Email gesendet an ${to}: ${subject}`);
        return true;
    } catch (e) {
        console.error('Email-Fehler:', e.message);
        return false;
    }
}

function generateVerifyToken() {
    return crypto.randomBytes(32).toString('hex');
}

function buildVerifyEmailHTML(username, verifyUrl) {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:520px;margin:40px auto;background:linear-gradient(145deg,#1a1a2e,#0f0f1a);border:1px solid #333;border-radius:20px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#00ff88,#00ccff);padding:4px;"></div>
        <div style="padding:40px 36px;">
          <div style="font-size:2rem;margin-bottom:8px;">🎮</div>
          <h1 style="color:#fff;font-size:1.5rem;margin:0 0 8px;">Hallo ${username}!</h1>
          <p style="color:#aaa;font-size:0.95rem;line-height:1.6;margin:0 0 28px;">
            Bitte bestätige deine Email-Adresse um deinen Zyphor Account zu aktivieren.
          </p>
          <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(45deg,#00ff88,#00ccff);color:#000;font-weight:bold;font-size:1rem;padding:14px 32px;border-radius:25px;text-decoration:none;">
            ✅ Email bestätigen
          </a>
          <p style="color:#555;font-size:0.8rem;margin-top:28px;">
            Dieser Link ist 24 Stunden gültig.<br>
            Falls du dich nicht registriert hast, ignoriere diese Email.
          </p>
        </div>
        <div style="background:linear-gradient(90deg,#00ff88,#00ccff);padding:4px;"></div>
      </div>
    </body>
    </html>`;
}

function buildResendVerifyEmailHTML(username, verifyUrl) {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:520px;margin:40px auto;background:linear-gradient(145deg,#1a1a2e,#0f0f1a);border:1px solid #333;border-radius:20px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#00ff88,#00ccff);padding:4px;"></div>
        <div style="padding:40px 36px;">
          <div style="font-size:2rem;margin-bottom:8px;">📧</div>
          <h1 style="color:#fff;font-size:1.5rem;margin:0 0 8px;">Neue Bestätigungs-Email</h1>
          <p style="color:#aaa;font-size:0.95rem;line-height:1.6;margin:0 0 28px;">
            Hey ${username}, hier ist dein neuer Bestätigungslink:
          </p>
          <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(45deg,#00ff88,#00ccff);color:#000;font-weight:bold;font-size:1rem;padding:14px 32px;border-radius:25px;text-decoration:none;">
            ✅ Email bestätigen
          </a>
          <p style="color:#555;font-size:0.8rem;margin-top:28px;">Dieser Link ist 24 Stunden gültig.</p>
        </div>
        <div style="background:linear-gradient(90deg,#00ff88,#00ccff);padding:4px;"></div>
      </div>
    </body>
    </html>`;
}

const app = express();
const PORT = process.env.PORT || 3000;

const GLOBAL_USERS_FILE = 'globalUsers.json';
const GAMES_FILE = 'games.json';

app.use(cors({ origin: '*', credentials: false, optionsSuccessStatus: 200 }));
app.use(express.json());

// ========== PASSWORD HASHING ==========

function hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'msi_salt_2025').digest('hex');
}

// ========== DB HELPERS ==========

async function readGlobalUsers() {
    try {
        const data = await fs.readFile(GLOBAL_USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        const defaultData = { users: {}, emailIndex: {} };
        await writeGlobalUsers(defaultData);
        return defaultData;
    }
}

async function writeGlobalUsers(data) {
    await fs.writeFile(GLOBAL_USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function readGames() {
    try {
        const data = await fs.readFile(GAMES_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        const defaultData = {
            games: {
                fifa:    { id: 'fifa',    name: 'FIFA',             tournaments: {}, activeTournamentId: null },
                cod:     { id: 'cod',     name: 'Call of Duty',     tournaments: {}, activeTournamentId: null },
                fortnite:{ id: 'fortnite',name: 'Fortnite',         tournaments: {}, activeTournamentId: null },
                csgo2:   { id: 'csgo2',   name: 'CS:GO2',           tournaments: {}, activeTournamentId: null, contestFormats: ['2v2','4v4','8v8','16v16','30v30'] },
                lol:     { id: 'lol',     name: 'League of Legends',tournaments: {}, activeTournamentId: null },
                motogp:  { id: 'motogp',  name: 'MotoGP',           tournaments: {}, activeTournamentId: null }
            }
        };
        await writeGames(defaultData);
        return defaultData;
    }
}

async function writeGames(data) {
    await fs.writeFile(GAMES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ========== BACKUP ==========

async function createBackup() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const dir = 'backups';
        try { await fs.mkdir(dir, { recursive: true }); } catch {}
        let n = 0;
        for (const file of [GLOBAL_USERS_FILE, GAMES_FILE]) {
            try { await fs.access(file); await fs.copyFile(file, `${dir}/${file.replace('.json','')}_${timestamp}.json`); n++; } catch {}
        }
        console.log(`Backup: ${n} Dateien (${timestamp})`);
        await cleanupOldBackups(dir);
    } catch (e) { console.error('Backup-Fehler:', e.message); }
}

async function cleanupOldBackups(dir) {
    try {
        const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json'))
            .sort((a,b) => b.localeCompare(a));
        for (const f of files.slice(20)) { try { await fs.unlink(`${dir}/${f}`); } catch {} }
    } catch {}
}

async function restoreFromBackup(ts) {
    const dir = path.join(__dirname, 'backups');
    let n = 0;
    for (const [backup, target] of [[`${dir}/globalUsers_${ts}.json`, GLOBAL_USERS_FILE],[`${dir}/games_${ts}.json`, GAMES_FILE]]) {
        try { await fs.access(backup); JSON.parse(await fs.readFile(backup,'utf8')); await fs.copyFile(backup, target); n++; } catch {}
    }
    return n;
}

async function loadLatestBackupOnStartup() {
    try {
        const dir = 'backups';
        try { await fs.access(dir); } catch { return false; }
        const files = await fs.readdir(dir);
        const groups = {};
        for (const f of files.filter(f=>f.endsWith('.json'))) {
            let ts = null;
            if (f.startsWith('globalUsers_')) ts = f.replace('globalUsers_','').replace('.json','');
            else if (f.startsWith('games_')) ts = f.replace('games_','').replace('.json','');
            if (ts) { if (!groups[ts]) groups[ts]=[]; groups[ts].push(f); }
        }
        for (const ts of Object.keys(groups).sort((a,b)=>b.localeCompare(a))) {
            if (groups[ts].some(f=>f.startsWith('globalUsers_')) && groups[ts].some(f=>f.startsWith('games_'))) {
                const n = await restoreFromBackup(ts);
                if (n>0) { console.log(`Backup geladen: ${ts}`); return true; }
            }
        }
        return false;
    } catch { return false; }
}

// ========== BRACKET ==========

function shuffleArray(arr) {
    const a = [...arr];
    for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
}

function createSingleEliminationBracket(players) {
    const shuffled = shuffleArray(players);
    let bracketSize = 1;
    while (bracketSize < shuffled.length) bracketSize *= 2;
    const byes = bracketSize - shuffled.length;
    const pool = [...shuffled], byePlayers = [];
    for (let i=0;i<byes;i++) byePlayers.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
    const firstRound = [];
    for (let i=0;i<pool.length;i+=2) {
        if (i+1<pool.length) firstRound.push({ id:`match_${Date.now()}_${i/2}`, player1:pool[i], player2:pool[i+1], winner:null, score1:null, score2:null, status:'pending', pendingResults:[] });
    }
    return { bracketSize, totalRounds:Math.log2(bracketSize), currentRound:1, rounds:[firstRound], playersWithByes:byePlayers, isComplete:false, winner:null };
}

// ========== AUTH ROUTES ==========

app.post('/user/register', async (req, res) => {
    try {
        const { email, platformUsername, password, gamertags } = req.body;
        if (!email||!platformUsername||!password) return res.status(400).json({ error:'Email, Username und Passwort sind erforderlich' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error:'Ungültige Email-Adresse' });
        if (password.length<6) return res.status(400).json({ error:'Passwort muss mindestens 6 Zeichen lang sein' });
        if (platformUsername.length>50) return res.status(400).json({ error:'Username max. 50 Zeichen' });

        const users = await readGlobalUsers();
        const key = email.toLowerCase();
        if (users.users[key]) return res.status(400).json({ error:'Diese Email ist bereits registriert' });
        if (Object.values(users.users).find(u=>u.platformUsername.toLowerCase()===platformUsername.toLowerCase()))
            return res.status(400).json({ error:'Dieser Username ist bereits vergeben' });

        const now = new Date().toISOString();
        const verifyToken = generateVerifyToken();
        const verifyExpires = new Date(Date.now() + 24*60*60*1000).toISOString(); // 24h

        users.users[key] = {
            id: key, email: key,
            platformUsername: platformUsername.trim(),
            passwordHash: hashPassword(password),
            emailVerified: false,
            verifyToken,
            verifyExpires,
            gamertags: { playstation: gamertags?.playstation?.trim()||'', xbox: gamertags?.xbox?.trim()||'', steam: gamertags?.steam?.trim()||'' },
            stats: { totalWins:0, totalPoints:0, wins2p:0, winsTournaments:0,
                gameStats: { fifa:{tournaments:0,wins:0}, cod:{tournaments:0,wins:0}, fortnite:{tournaments:0,wins:0}, csgo2:{tournaments:0,wins:0}, lol:{tournaments:0,wins:0}, motogp:{tournaments:0,wins:0} }
            },
            createdAt: now, updatedAt: now
        };
        if (!users.emailIndex) users.emailIndex = {};
        users.emailIndex[key] = key;
        await writeGlobalUsers(users);

        // Send verification email
        const verifyUrl = `${FRONTEND_URL}/profile.html?verify=${verifyToken}&email=${encodeURIComponent(key)}`;
        await sendEmail(key, '✅ Zyphor – Email bestätigen', buildVerifyEmailHTML(platformUsername.trim(), verifyUrl));

        const safe = {...users.users[key]}; delete safe.passwordHash; delete safe.verifyToken;
        res.status(201).json({ message:'Registrierung erfolgreich! Bitte prüfe deine Email und bestätige deinen Account.', user:safe, emailSent:true });
    } catch (e) { console.error(e); res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.post('/user/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email||!password) return res.status(400).json({ error:'Email und Passwort erforderlich' });
        const users = await readGlobalUsers();
        const user = users.users[email.toLowerCase()];
        if (!user||user.passwordHash!==hashPassword(password)) return res.status(401).json({ error:'Email oder Passwort falsch' });

        // Block unverified accounts
        if (!user.emailVerified) {
            return res.status(403).json({
                error:'Bitte bestätige zuerst deine Email-Adresse.',
                emailNotVerified: true,
                email: user.email
            });
        }

        const token = crypto.randomBytes(32).toString('hex');
        user.sessionToken = token; user.lastLogin = new Date().toISOString();
        await writeGlobalUsers(users);
        const safe = {...user}; delete safe.passwordHash; delete safe.verifyToken;
        res.json({ message:'Login erfolgreich', user:safe, token });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

// Verify email via token
app.get('/user/verify-email', async (req, res) => {
    try {
        const { token, email } = req.query;
        if (!token||!email) return res.status(400).json({ error:'Token und Email erforderlich' });
        const users = await readGlobalUsers();
        const key = decodeURIComponent(email).toLowerCase();
        const user = users.users[key];
        if (!user) return res.status(404).json({ error:'Benutzer nicht gefunden' });
        if (user.emailVerified) return res.json({ message:'Email bereits bestätigt', alreadyVerified:true });
        if (user.verifyToken !== token) return res.status(400).json({ error:'Ungültiger Bestätigungslink' });
        if (new Date(user.verifyExpires) < new Date()) return res.status(400).json({ error:'Bestätigungslink abgelaufen. Bitte neuen anfordern.', expired:true });
        user.emailVerified = true;
        user.verifyToken = null;
        user.verifyExpires = null;
        user.updatedAt = new Date().toISOString();
        await writeGlobalUsers(users);
        res.json({ message:'Email erfolgreich bestätigt! Du kannst dich jetzt einloggen.', verified:true });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

// Resend verification email
app.post('/user/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error:'Email erforderlich' });
        const users = await readGlobalUsers();
        const key = email.toLowerCase();
        const user = users.users[key];
        if (!user) return res.status(404).json({ error:'Benutzer nicht gefunden' });
        if (user.emailVerified) return res.status(400).json({ error:'Email bereits bestätigt' });

        // Generate new token
        user.verifyToken = generateVerifyToken();
        user.verifyExpires = new Date(Date.now() + 24*60*60*1000).toISOString();
        await writeGlobalUsers(users);

        const verifyUrl = `${FRONTEND_URL}/profile.html?verify=${user.verifyToken}&email=${encodeURIComponent(key)}`;
        await sendEmail(key, '✅ Zyphor – Neue Bestätigungs-Email', buildResendVerifyEmailHTML(user.platformUsername, verifyUrl));

        res.json({ message:'Bestätigungs-Email wurde erneut gesendet.' });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.put('/user/update', async (req, res) => {
    try {
        const { email, platformUsername, gamertags, currentPassword, newPassword } = req.body;
        if (!email) return res.status(400).json({ error:'Email erforderlich' });
        if (!platformUsername?.trim()) return res.status(400).json({ error:'Username erforderlich' });
        const users = await readGlobalUsers();
        const key = email.toLowerCase();
        if (!users.users[key]) return res.status(404).json({ error:'Benutzer nicht gefunden' });
        if (Object.values(users.users).find(u=>u.platformUsername.toLowerCase()===platformUsername.toLowerCase()&&u.email!==key))
            return res.status(400).json({ error:'Username bereits vergeben' });
        users.users[key] = { ...users.users[key], platformUsername:platformUsername.trim(),
            gamertags:{ playstation:gamertags?.playstation?.trim()||'', xbox:gamertags?.xbox?.trim()||'', steam:gamertags?.steam?.trim()||'' },
            updatedAt: new Date().toISOString() };
        if (newPassword) {
            if (!currentPassword) return res.status(400).json({ error:'Aktuelles Passwort erforderlich' });
            if (users.users[key].passwordHash!==hashPassword(currentPassword)) return res.status(401).json({ error:'Aktuelles Passwort falsch' });
            if (newPassword.length<6) return res.status(400).json({ error:'Neues Passwort mind. 6 Zeichen' });
            users.users[key].passwordHash = hashPassword(newPassword);
        }
        await writeGlobalUsers(users);
        const safe = {...users.users[key]}; delete safe.passwordHash;
        res.json({ message:'Profil aktualisiert', user:safe });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.get('/user/:email', async (req, res) => {
    try {
        const users = await readGlobalUsers();
        const user = users.users[req.params.email.toLowerCase()];
        if (!user) return res.status(404).json({ error:'Benutzer nicht gefunden' });
        const safe = {...user}; delete safe.passwordHash; delete safe.sessionToken;
        res.json(safe);
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.get('/users/global', async (req, res) => {
    try {
        const users = await readGlobalUsers();
        const safe = Object.values(users.users).map(u=>{ const s={...u}; delete s.passwordHash; delete s.sessionToken; return s; });
        res.json({ totalUsers:safe.length, users:safe });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

// ========== GAME ROUTES ==========

// IMPORTANT: /games/available must be before /games/:gameId
app.get('/games/available', async (req, res) => {
    try {
        const data = await readGames();
        res.json({ games: Object.entries(data.games).map(([id,g])=>({ id, name:g.name, contestFormats:g.contestFormats||null })) });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.get('/games', async (req, res) => {
    try { res.json((await readGames()).games); }
    catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.get('/games/:gameId', async (req, res) => {
    try {
        const data = await readGames();
        const game = data.games[req.params.gameId];
        if (!game) return res.status(404).json({ error:'Spiel nicht gefunden' });
        res.json(game);
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

// ========== CS:GO2 CONTEST ROUTES ==========

app.get('/games/csgo2/contests', async (req, res) => {
    try {
        const data = await readGames();
        const formats = ['2v2','4v4','8v8','16v16','30v30'];
        const contests = {};
        for (const fmt of formats) {
            const open = Object.values(data.games.csgo2.tournaments||{}).filter(t=>t.contestFormat===fmt&&t.status==='registration');
            contests[fmt] = { format:fmt, teamSize:parseInt(fmt), totalPlayers:parseInt(fmt)*2, openTournaments:open.length, tournaments:open };
        }
        res.json({ formats, contests });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.post('/games/csgo2/contests/:format/join', async (req, res) => {
    try {
        const { format } = req.params;
        const { email } = req.body;
        if (!['2v2','4v4','8v8','16v16','30v30'].includes(format)) return res.status(400).json({ error:'Ungültiges Format' });
        if (!email) return res.status(400).json({ error:'Email erforderlich' });

        const users = await readGlobalUsers();
        const userKey = email.toLowerCase();
        if (!users.users[userKey]) return res.status(400).json({ error:'Benutzer nicht gefunden' });

        const data = await readGames();
        const teamSize = parseInt(format.split('v')[0]);
        const totalPlayers = teamSize * 2;

        let t = Object.values(data.games.csgo2.tournaments||{}).find(t=>t.contestFormat===format&&t.status==='registration');
        if (!t) {
            const now = new Date();
            const tid = `csgo2_contest_${format}_${Date.now()}`;
            t = { id:tid, name:`CS:GO2 ${format} Contest - ${now.toLocaleDateString('de-DE')}`, description:`${format} Team Contest`,
                gameId:'csgo2', contestFormat:format, teamSize, totalPlayers, status:'registration', participants:[], bracket:null,
                autoStartPlayerCount:totalPlayers, isAutoTournament:true, prizePool:0,
                createdAt:now.toISOString(), startedAt:null, finishedAt:null, winner:null };
            if (!data.games.csgo2.tournaments) data.games.csgo2.tournaments = {};
            data.games.csgo2.tournaments[tid] = t;
        }

        if (t.participants.find(p=>p.email===userKey)) return res.status(400).json({ error:'Bereits angemeldet' });
        const user = users.users[userKey];
        t.participants.push({ id:Date.now().toString(), email:userKey, platformUsername:user.platformUsername, gamertags:user.gamertags, registrationTime:new Date().toISOString() });

        if (t.participants.length>=totalPlayers) {
            t.status='started'; t.startedAt=new Date().toISOString();
            t.bracket=createSingleEliminationBracket(t.participants);
        }
        await writeGames(data);
        res.status(201).json({ message:`Angemeldet für CS:GO2 ${format} Contest`, tournament:t, spotsLeft:totalPlayers-t.participants.length });
    } catch (e) { console.error(e); res.status(500).json({ error:'Interner Serverfehler' }); }
});

// ========== LEADERBOARD ROUTES ==========

app.get('/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit)||10;
        const users = await readGlobalUsers();
        const top = Object.values(users.users).filter(u=>u.stats?.totalWins>0)
            .sort((a,b)=>b.stats.totalWins-a.stats.totalWins).slice(0,limit)
            .map((u,i)=>({ rank:i+1, platformUsername:u.platformUsername, totalWins:u.stats.totalWins, gameStats:u.stats.gameStats, email:u.email.slice(0,3)+'***@'+u.email.split('@')[1] }));
        res.json({ totalPlayers:Object.keys(users.users).length, topPlayers:top, lastUpdated:new Date().toISOString() });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.get('/leaderboard/points', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit)||10;
        const users = await readGlobalUsers();
        const top = Object.values(users.users).filter(u=>(u.stats?.totalPoints||0)>0)
            .sort((a,b)=>(b.stats.totalPoints||0)-(a.stats.totalPoints||0)).slice(0,limit)
            .map((u,i)=>({ rank:i+1, platformUsername:u.platformUsername, totalPoints:u.stats.totalPoints||0, totalWins:u.stats.totalWins||0, email:u.email.slice(0,3)+'***@'+u.email.split('@')[1] }));
        res.json({ totalPlayers:Object.keys(users.users).length, topPlayers:top, lastUpdated:new Date().toISOString() });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.get('/leaderboard2p', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit)||10;
        const users = await readGlobalUsers();
        const top = Object.values(users.users).filter(u=>(u.stats?.wins2p||0)>0)
            .sort((a,b)=>(b.stats.wins2p||0)-(a.stats.wins2p||0)).slice(0,limit)
            .map((u,i)=>({ rank:i+1, platformUsername:u.platformUsername, wins2p:u.stats.wins2p||0, email:u.email.slice(0,3)+'***@'+u.email.split('@')[1] }));
        res.json({ totalPlayers:Object.keys(users.users).length, topPlayers:top, lastUpdated:new Date().toISOString() });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.get('/leaderboardTournaments', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit)||10;
        const users = await readGlobalUsers();
        const top = Object.values(users.users).filter(u=>(u.stats?.winsTournaments||0)>0)
            .sort((a,b)=>(b.stats.winsTournaments||0)-(a.stats.winsTournaments||0)).slice(0,limit)
            .map((u,i)=>({ rank:i+1, platformUsername:u.platformUsername, winsTournaments:u.stats.winsTournaments||0, email:u.email.slice(0,3)+'***@'+u.email.split('@')[1] }));
        res.json({ totalPlayers:Object.keys(users.users).length, topPlayers:top, lastUpdated:new Date().toISOString() });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

// IMPORTANT: /leaderboard/:gameId must come after /leaderboard/points, /leaderboard2p, /leaderboardTournaments
app.get('/leaderboard/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const limit = parseInt(req.query.limit)||50;
        const [users, gamesData] = await Promise.all([readGlobalUsers(), readGames()]);
        if (!gamesData.games[gameId]) return res.status(404).json({ error:'Spiel nicht gefunden' });
        const top = Object.values(users.users).filter(u=>(u.stats?.gameStats?.[gameId]?.wins||0)>0)
            .sort((a,b)=>(b.stats.gameStats[gameId]?.wins||0)-(a.stats.gameStats[gameId]?.wins||0)).slice(0,limit)
            .map((u,i)=>({ rank:i+1, platformUsername:u.platformUsername, wins:u.stats.gameStats[gameId]?.wins||0, tournaments:u.stats.gameStats[gameId]?.tournaments||0, email:u.email.slice(0,3)+'***@'+u.email.split('@')[1] }));
        res.json({ gameId, gameName:gamesData.games[gameId].name, totalPlayers:Object.values(users.users).filter(u=>u.stats?.gameStats?.[gameId]?.tournaments>0).length, topPlayers:top, lastUpdated:new Date().toISOString() });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

// ========== PRIZE POOLS ==========

app.get('/prize-pools', async (req, res) => {
    try {
        const data = await readGames();
        let oneVsOnePool=0, activeTournamentPool=0, completedTournamentPool=0;
        for (const game of Object.values(data.games)) {
            for (const t of Object.values(game.tournaments||{})) {
                const pool = t.prizePool||0;
                if (t.status==='registration'||t.status==='started') {
                    if (t.autoStartPlayerCount===2) oneVsOnePool+=pool; else activeTournamentPool+=pool;
                } else if (t.status==='finished') completedTournamentPool+=pool;
            }
        }
        res.json({ oneVsOnePool, activeTournamentPool, completedTournamentPool });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

// ========== TOURNAMENT ROUTES ==========

app.post('/games/:gameId/tournaments', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { name, description, autoStartPlayerCount, prizePool, contestFormat } = req.body;
        if (!name) return res.status(400).json({ error:'Turnier-Name erforderlich' });
        if (autoStartPlayerCount && ![2,4,8,16,32,64].includes(parseInt(autoStartPlayerCount)))
            return res.status(400).json({ error:'Ungültige Spieleranzahl' });
        const data = await readGames();
        if (!data.games[gameId]) return res.status(404).json({ error:'Spiel nicht gefunden' });
        const tid = `tournament_${Date.now()}`;
        const t = { id:tid, name:name.trim(), description:description?.trim()||'', gameId, contestFormat:contestFormat||null,
            status:'registration', participants:[], bracket:null, autoStartPlayerCount:autoStartPlayerCount||null,
            prizePool:prizePool||0, createdAt:new Date().toISOString(), startedAt:null, finishedAt:null, winner:null };
        data.games[gameId].tournaments[tid] = t;
        if (!data.games[gameId].activeTournamentId) data.games[gameId].activeTournamentId = tid;
        await writeGames(data);
        res.status(201).json({ message:'Turnier erstellt', tournament:t });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.get('/games/:gameId/tournaments/:tournamentId', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        res.json(t);
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.post('/games/:gameId/tournaments/:tournamentId/register', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const { email } = req.body;
        if (!email) return res.status(400).json({ error:'Email erforderlich' });
        const users = await readGlobalUsers();
        const userKey = email.toLowerCase();
        if (!users.users[userKey]) return res.status(400).json({ error:'Bitte zuerst registrieren' });
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        if (t.status!=='registration') return res.status(400).json({ error:'Registrierung geschlossen' });
        if (t.participants.find(p=>p.email===userKey)) return res.status(400).json({ error:'Bereits registriert' });
        const user = users.users[userKey];
        t.participants.push({ id:Date.now().toString(), email:userKey, platformUsername:user.platformUsername, gamertags:user.gamertags, registrationTime:new Date().toISOString() });
        if (t.autoStartPlayerCount && t.participants.length>=t.autoStartPlayerCount) {
            t.status='started'; t.startedAt=new Date().toISOString(); t.bracket=createSingleEliminationBracket(t.participants);
        }
        await writeGames(data);
        res.status(201).json({ message:'Erfolgreich registriert', tournament:t });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.post('/games/:gameId/tournaments/:tournamentId/unregister', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const { email } = req.body;
        if (!email) return res.status(400).json({ error:'Email erforderlich' });
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        if (t.status!=='registration') return res.status(400).json({ error:'Abmeldung nur in Registrierungsphase' });
        const idx = t.participants.findIndex(p=>p.email===email.toLowerCase());
        if (idx===-1) return res.status(400).json({ error:'Nicht registriert' });
        t.participants.splice(idx,1);
        await writeGames(data);
        res.json({ message:'Abgemeldet', tournament:t });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.post('/games/:gameId/tournaments/:tournamentId/start', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        if (t.participants.length<2) return res.status(400).json({ error:'Mind. 2 Spieler erforderlich' });
        if (t.status==='started') return res.status(400).json({ error:'Bereits gestartet' });
        t.status='started'; t.startedAt=new Date().toISOString(); t.bracket=createSingleEliminationBracket(t.participants);
        await writeGames(data);
        res.json({ message:'Turnier gestartet', tournament:t });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.post('/games/:gameId/tournaments/:tournamentId/matches/:matchId/submit-result', async (req, res) => {
    try {
        const { gameId, tournamentId, matchId } = req.params;
        const { submittedBy, email, score1, score2 } = req.body;
        if (!submittedBy||!email||score1===undefined||score2===undefined) return res.status(400).json({ error:'Alle Felder erforderlich' });
        if (score1===score2) return res.status(400).json({ error:'Unentschieden nicht erlaubt' });
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        let match=null, ri=-1;
        for (let i=0;i<t.bracket.rounds.length;i++) { const m=t.bracket.rounds[i].find(m=>m.id===matchId); if(m){match=m;ri=i;break;} }
        if (!match) return res.status(404).json({ error:'Match nicht gefunden' });
        if (match.status==='completed') return res.status(400).json({ error:'Match bereits abgeschlossen' });
        if (submittedBy!==match.player1.id&&submittedBy!==match.player2.id) return res.status(403).json({ error:'Nicht Teil dieses Matches' });
        if (!match.pendingResults) match.pendingResults=[];
        if (match.pendingResults.find(r=>r.submittedBy===submittedBy)) return res.status(400).json({ error:'Ergebnis bereits eingereicht' });
        match.pendingResults.push({ submittedBy, email, score1:parseInt(score1), score2:parseInt(score2), submittedAt:new Date().toISOString() });
        if (match.pendingResults.length===2) {
            const [r1,r2] = match.pendingResults;
            if (r1.score1===r2.score1&&r1.score2===r2.score2) {
                match.score1=r1.score1; match.score2=r1.score2;
                match.winner=r1.score1>r1.score2?match.player1:match.player2;
                match.status='completed'; match.completedAt=new Date().toISOString(); match.completedBy='auto';
                await checkAndAdvanceRound(data,gameId,tournamentId,ri); await writeGames(data);
                return res.json({ message:'Match abgeschlossen', tournament:t });
            } else {
                match.pendingResults.forEach(r=>r.conflict=true); await writeGames(data);
                return res.json({ message:'Konflikt – Admin-Entscheidung nötig', conflict:true });
            }
        } else { await writeGames(data); return res.json({ message:'Ergebnis eingereicht – warte auf Gegner', waitingForOpponent:true }); }
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.post('/games/:gameId/tournaments/:tournamentId/matches/:matchId/result', async (req, res) => {
    try {
        const { gameId, tournamentId, matchId } = req.params;
        const { winnerId, score1, score2 } = req.body;
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        let match=null, ri=-1;
        for (let i=0;i<t.bracket.rounds.length;i++) { const m=t.bracket.rounds[i].find(m=>m.id===matchId); if(m){match=m;ri=i;break;} }
        if (!match) return res.status(404).json({ error:'Match nicht gefunden' });
        if (score1!==undefined&&score2!==undefined) {
            match.score1=parseInt(score1); match.score2=parseInt(score2);
            match.winner=match.score1>match.score2?match.player1:match.player2;
        } else if (winnerId) {
            if (winnerId!==match.player1.id&&winnerId!==match.player2.id) return res.status(400).json({ error:'Ungültige Gewinner-ID' });
            match.winner=winnerId===match.player1.id?match.player1:match.player2;
        } else return res.status(400).json({ error:'Gewinner oder Spielstand erforderlich' });
        match.status='completed'; match.completedAt=new Date().toISOString(); match.completedBy='admin'; match.pendingResults=[];
        await checkAndAdvanceRound(data,gameId,tournamentId,ri); await writeGames(data);
        res.json({ message:'Ergebnis eingetragen', tournament:t });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.post('/games/:gameId/tournaments/:tournamentId/matches/:matchId/reset', async (req, res) => {
    try {
        const { gameId, tournamentId, matchId } = req.params;
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        let match=null;
        for (const r of t.bracket.rounds) { const m=r.find(m=>m.id===matchId); if(m){match=m;break;} }
        if (!match) return res.status(404).json({ error:'Match nicht gefunden' });
        if (match.status!=='completed') return res.status(400).json({ error:'Match nicht abgeschlossen' });
        Object.assign(match,{winner:null,score1:null,score2:null,status:'pending',completedAt:null,completedBy:null,pendingResults:[]});
        if (t.status==='finished') Object.assign(t,{status:'started',finishedAt:null,winner:null,'bracket.isComplete':false,'bracket.winner':null});
        await writeGames(data);
        res.json({ message:'Match zurückgesetzt', tournament:t });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.delete('/games/:gameId/tournaments/:tournamentId', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const data = await readGames();
        if (!data.games[gameId]?.tournaments[tournamentId]) return res.status(404).json({ error:'Turnier nicht gefunden' });
        delete data.games[gameId].tournaments[tournamentId];
        if (data.games[gameId].activeTournamentId===tournamentId) data.games[gameId].activeTournamentId=null;
        await writeGames(data);
        res.json({ message:'Turnier gelöscht' });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.post('/games/:gameId/tournaments/:tournamentId/reset', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        if (t.status!=='registration') return res.status(400).json({ error:'Nur Turniere in Registrierung zurücksetzbar' });
        Object.assign(t,{participants:[],bracket:null,winner:null,finishedAt:null,updatedAt:new Date().toISOString()});
        await writeGames(data);
        res.json({ message:'Turnier zurückgesetzt', tournament:t });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.post('/games/:gameId/tournaments/:tournamentId/cancel', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        if (t.status==='finished') return res.status(400).json({ error:'Beendete Turniere nicht abbrechbar' });
        const name = t.name;
        delete data.games[gameId].tournaments[tournamentId];
        if (data.games[gameId].activeTournamentId===tournamentId) data.games[gameId].activeTournamentId=null;
        await writeGames(data);
        res.json({ message:`Turnier "${name}" abgebrochen` });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.get('/games/:gameId/tournaments/:tournamentId/participants', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        res.json({ participants:t.participants||[], count:t.participants?.length||0 });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.post('/games/:gameId/tournaments/:tournamentId/force-complete', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const { winnerId } = req.body;
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        const winner = t.participants.find(p=>p.id===winnerId);
        if (!winner) return res.status(400).json({ error:'Gewinner nicht gefunden' });
        Object.assign(t,{status:'finished',finishedAt:new Date().toISOString(),winner});
        if (t.bracket) { t.bracket.isComplete=true; t.bracket.winner=winner; }
        await updateUserStats(winner.email, gameId, true);
        await writeGames(data);
        res.json({ message:'Turnier abgeschlossen', tournament:t });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.get('/games/:gameId/tournaments/:tournamentId/export', async (req, res) => {
    try {
        const { gameId, tournamentId } = req.params;
        const data = await readGames();
        const t = data.games[gameId]?.tournaments[tournamentId];
        if (!t) return res.status(404).json({ error:'Turnier nicht gefunden' });
        res.json({ tournamentInfo:{name:t.name,description:t.description,gameId,status:t.status,createdAt:t.createdAt,startedAt:t.startedAt,finishedAt:t.finishedAt}, participants:t.participants||[], bracket:t.bracket, winner:t.winner, exportedAt:new Date().toISOString() });
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

// ========== AUTO TOURNAMENT MANAGER ==========

const AUTO_TOURNAMENT_CONFIG = { sizes:[2,4,8,16], games:['fifa','cod','fortnite','csgo2'], cleanupIntervalHours:24 };

class AutoTournamentManager {
    constructor() { this.isInitialized=false; this.cleanupInterval=null; }
    async initialize() {
        if (this.isInitialized) return;
        try { await this.ensureAutoTournaments(); this.startCleanupScheduler(); this.isInitialized=true; console.log('Auto-Tournament System bereit'); }
        catch (e) { console.error('Auto-Tournament Init Fehler:', e); }
    }
    async ensureAutoTournaments() {
        const data = await readGames();
        for (const gid of AUTO_TOURNAMENT_CONFIG.games) {
            if (!data.games[gid]) continue;
            for (const size of AUTO_TOURNAMENT_CONFIG.sizes) {
                if (!this.findOpenAutoTournament(data.games[gid], size)) {
                    await this.createAutoTournament(gid, size);
                    await new Promise(r=>setTimeout(r,100));
                }
            }
        }
    }
    findOpenAutoTournament(gameData, size) {
        return Object.values(gameData.tournaments||{}).find(t=>t.isAutoTournament&&t.autoStartPlayerCount===size&&t.status==='registration');
    }
    async createAutoTournament(gameId, playerCount) {
        const data = await readGames();
        const now = new Date();
        const tid = `auto_${gameId}_${playerCount}p_${Date.now()}`;
        const t = { id:tid, name:`${data.games[gameId].name} ${playerCount}P - ${now.toLocaleDateString('de-DE')} ${now.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`,
            description:`Automatisches ${playerCount}-Spieler Turnier`, gameId, status:'registration', participants:[], bracket:null,
            autoStartPlayerCount:playerCount, isAutoTournament:true, prizePool:0, createdAt:now.toISOString(), startedAt:null, finishedAt:null, winner:null };
        data.games[gameId].tournaments[tid]=t;
        await writeGames(data);
        console.log(`Auto-Turnier erstellt: ${t.name}`);
        return t;
    }
    async cleanupOldTournaments() {
        const data = await readGames();
        const cutoff = new Date(Date.now()-AUTO_TOURNAMENT_CONFIG.cleanupIntervalHours*3600000);
        let n=0;
        for (const game of Object.values(data.games)) {
            for (const [id,t] of Object.entries(game.tournaments||{})) {
                if (t.isAutoTournament&&t.status==='finished'&&t.finishedAt&&new Date(t.finishedAt)<cutoff) { delete game.tournaments[id]; n++; }
            }
        }
        if (n>0) { await writeGames(data); console.log(`${n} alte Auto-Turniere bereinigt`); }
    }
    startCleanupScheduler() {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        this.cleanupOldTournaments();
        this.cleanupInterval = setInterval(()=>this.cleanupOldTournaments(), 6*3600000);
    }
    shutdown() { if (this.cleanupInterval) { clearInterval(this.cleanupInterval); this.cleanupInterval=null; } this.isInitialized=false; }
}

const autoTournamentManager = new AutoTournamentManager();

// ========== ADVANCE ROUND ==========

async function checkAndAdvanceRound(data, gameId, tournamentId, ri) {
    const t = data.games[gameId].tournaments[tournamentId];
    const round = t.bracket.rounds[ri];
    if (!round.every(m=>m.status==='completed')) return;
    const advancing = round.map(m=>m.winner);
    if (ri===0&&t.bracket.playersWithByes?.length) { advancing.push(...t.bracket.playersWithByes); t.bracket.playersWithByes=[]; }
    if (advancing.length===1) {
        t.bracket.isComplete=true; t.bracket.winner=advancing[0];
        t.status='finished'; t.finishedAt=new Date().toISOString(); t.winner=advancing[0];
        await updateUserStats(advancing[0].email, gameId, true);
        console.log(`Turnier beendet: ${t.name} → ${advancing[0].platformUsername}`);
        if (t.isAutoTournament) {
            await writeGames(data);
            setTimeout(async()=>{ try { await autoTournamentManager.createAutoTournament(gameId,t.autoStartPlayerCount); } catch(e){} },1000);
        }
    } else if (ri+1===t.bracket.currentRound) {
        t.bracket.currentRound++;
        const next = [];
        for (let i=0;i<advancing.length;i+=2) {
            if (i+1<advancing.length) next.push({ id:`match_${Date.now()}_${i/2}_r${t.bracket.currentRound}`, player1:advancing[i], player2:advancing[i+1], winner:null, score1:null, score2:null, status:'pending', pendingResults:[] });
        }
        t.bracket.rounds.push(next);
    }
}

// ========== UPDATE USER STATS ==========

async function updateUserStats(email, gameId, isWinner) {
    if (!email) return;
    const users = await readGlobalUsers();
    const key = email.toLowerCase();
    if (!users.users[key]) return;
    const u = users.users[key];
    if (!u.stats.gameStats[gameId]) u.stats.gameStats[gameId]={tournaments:0,wins:0};
    if (isWinner) { u.stats.totalWins++; u.stats.gameStats[gameId].wins++; u.stats.winsTournaments=(u.stats.winsTournaments||0)+1; u.stats.totalPoints=(u.stats.totalPoints||0)+100; }
    u.stats.gameStats[gameId].tournaments++;
    u.updatedAt=new Date().toISOString();
    await writeGlobalUsers(users);
}

// ========== ADMIN ==========

app.get('/admin/stats', async (req, res) => {
    try {
        const [data, users] = await Promise.all([readGames(), readGlobalUsers()]);
        const s = { totalUsers:Object.keys(users.users).length, totalTournaments:0, activeTournaments:0, completedTournaments:0, totalMatches:0, completedMatches:0 };
        Object.values(data.games).forEach(g=>Object.values(g.tournaments||{}).forEach(t=>{ s.totalTournaments++; if(t.status==='started'||t.status==='registration')s.activeTournaments++; else if(t.status==='finished')s.completedTournaments++; t.bracket?.rounds?.forEach(r=>{s.totalMatches+=r.length;s.completedMatches+=r.filter(m=>m.status==='completed').length;}); }));
        const today=new Date().toDateString(), week=new Date(); week.setDate(week.getDate()-7);
        s.todayRegistrations=Object.values(users.users).filter(u=>u.createdAt&&new Date(u.createdAt).toDateString()===today).length;
        s.weekRegistrations=Object.values(users.users).filter(u=>u.createdAt&&new Date(u.createdAt)>week).length;
        res.json(s);
    } catch (e) { res.status(500).json({ error:'Interner Serverfehler' }); }
});

app.get('/admin/auto-tournaments/status', async (req, res) => {
    try {
        const data = await readGames();
        const status = {};
        for (const gid of AUTO_TOURNAMENT_CONFIG.games) {
            status[gid]={};
            for (const size of AUTO_TOURNAMENT_CONFIG.sizes) {
                const t=autoTournamentManager.findOpenAutoTournament(data.games[gid],size);
                status[gid][`${size}p`]={exists:!!t,tournamentId:t?.id,participants:t?.participants?.length||0,name:t?.name};
            }
        }
        res.json({isInitialized:autoTournamentManager.isInitialized,tournaments:status});
    } catch (e) { res.status(500).json({ error:'Fehler' }); }
});

app.post('/admin/auto-tournaments/ensure', async (req,res)=>{ try{await autoTournamentManager.ensureAutoTournaments();res.json({message:'Auto-Turniere sichergestellt'});}catch(e){res.status(500).json({error:'Fehler'});} });
app.post('/admin/auto-tournaments/cleanup', async (req,res)=>{ try{await autoTournamentManager.cleanupOldTournaments();res.json({message:'Bereinigt'});}catch(e){res.status(500).json({error:'Fehler'});} });
app.post('/admin/backup/create', async (req,res)=>{ try{await createBackup();res.json({message:'Backup erstellt'});}catch(e){res.status(500).json({error:e.message});} });
app.get('/admin/backup/list', async (req,res)=>{ try{const f=await fs.readdir('backups');res.json({backups:f.filter(x=>x.endsWith('.json')).sort((a,b)=>b.localeCompare(a))});}catch(e){res.status(500).json({error:e.message});} });
app.post('/admin/backup/restore', async (req,res)=>{ try{const{timestamp}=req.body;if(!timestamp)return res.status(400).json({error:'Timestamp erforderlich'});await createBackup();const n=await restoreFromBackup(timestamp);if(n===0)return res.status(404).json({error:'Keine Backup-Dateien'});res.json({message:`Wiederhergestellt (${n} Dateien)`,timestamp,restoredFiles:n});}catch(e){res.status(500).json({error:e.message});} });
app.get('/admin/backup/download/:filename', async (req,res)=>{ try{const{filename}=req.params;if(!filename.endsWith('.json')||filename.includes('..'))return res.status(400).json({error:'Ungültiger Dateiname'});await fs.access(`backups/${filename}`);res.download(`backups/${filename}`);}catch(e){res.status(404).json({error:'Datei nicht gefunden'});} });

app.get('/health', (req,res)=>res.json({status:'OK',timestamp:new Date().toISOString()}));

// TEMPORÄR — einmal aufrufen dann löschen
app.get('/admin/reset-games', async (req, res) => {
    try {
        try { await fs.unlink(GAMES_FILE); } catch {}
        try { await fs.unlink(GLOBAL_USERS_FILE); } catch {}
        await readGames();
        await readGlobalUsers();
        await autoTournamentManager.ensureAutoTournaments();
        res.json({ message: '✅ games.json + globalUsers.json neu erstellt mit fortnite/csgo2' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ========== START ==========

app.listen(PORT, async () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    const loaded = await loadLatestBackupOnStartup();
    if (!loaded) { await readGlobalUsers(); await readGames(); }
    await createBackup();
    try { await autoTournamentManager.initialize(); console.log('⚡ Auto-Turniere aktiv'); }
    catch (e) { console.error('Auto-Tournament Fehler:', e); }
    console.log('✅ Server bereit');
});

process.on('SIGTERM', ()=>{ autoTournamentManager.shutdown(); process.exit(0); });
process.on('SIGINT',  ()=>{ autoTournamentManager.shutdown(); process.exit(0); });
