import { GameServer } from './server/GameServer';

const server = new GameServer();

server.start();

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
signals.forEach(signal => {
  process.on(signal, async () => {
    console.log(`Received ${signal}, shutting down...`);
    await server.stop();
    process.exit(0);
  });
});

