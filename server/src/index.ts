import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { env } from './env';
import { setupRealtime } from './realtime';
import { createRouter } from './routes';
import { initStore } from './store';

async function bootstrap(): Promise<void> {
  const store = await initStore();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use('/api', createRouter(store));

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });
  setupRealtime(io, store);

  server.listen(env.port, () => {
    console.log(`[server] 数据看板服务已启动: http://localhost:${env.port} (${store.mode})`);
  });
}

bootstrap().catch((error) => {
  console.error('[server] 启动失败:', error);
  process.exit(1);
});
