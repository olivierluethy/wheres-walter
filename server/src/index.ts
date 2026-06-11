import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ClientToServerEvents, ServerToClientEvents } from '@walter/shared';
import { challengesRouter } from './challenges.js';
import { RoomManager, registerSocketHandlers } from './rooms.js';
import './db.js'; // ensure tables exist on boot

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4000);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/challenges', challengesRouter);

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});
const manager = new RoomManager(io);
registerSocketHandlers(io, manager);

// Serve the built client (production) and let the SPA handle deep links like
// /c/:id and /c/:id/results.
const clientDist = join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

httpServer.listen(PORT, () => {
  console.log(`\n  🟢 Where's Walter? server listening on http://localhost:${PORT}\n`);
});
