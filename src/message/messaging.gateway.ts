import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// Séparé de l'API REST sur /messaging pour éviter les conflits de namespace
@WebSocketGateway({ namespace: '/messaging', cors: { origin: process.env.CORS_ORIGIN, credentials: true } })
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // userId → ensemble de socket IDs connectés (multi-onglets)
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        client.disconnect();
        return;
      }
      // JWT_SECRET doit être passé explicitement — JwtModule.register({}) ne le configure pas globalement
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      client.data.userId = payload.sub;

      const sockets = this.userSockets.get(payload.sub) ?? new Set();
      sockets.add(client.id);
      this.userSockets.set(payload.sub, sockets);

      client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId: string | undefined = client.data.userId;
    if (!userId) return;
    const sockets = this.userSockets.get(userId);
    sockets?.delete(client.id);
    if (!sockets?.size) this.userSockets.delete(userId);
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { recipient_id: string },
  ) {
    const senderId: string = client.data.userId;
    if (!senderId || !data?.recipient_id) return;
    this.server.to(`user:${data.recipient_id}`).emit('typing', { sender_id: senderId });
  }

  // Appelé par MessageService après un envoi REST pour notifier les deux participants en temps réel
  notifyNewMessage(userId: string, message: unknown): void {
    this.server.to(`user:${userId}`).emit('new_message', message);
  }
}
