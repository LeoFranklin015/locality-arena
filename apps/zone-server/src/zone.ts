// One Durable Object per H3 cell. Holds presence for everyone standing in it.

type Pose = { x: number; y: number; z: number; yaw: number };
type Attachment = { id: string; name: string; pose: Pose | null; seen: number };

type ClientMsg = { t: "pose"; p: Pose } | { t: "hello"; name: string };

const TICK_MS = 50; // 20hz broadcast
const IDLE_MS = 10_000;

export class Zone implements DurableObject {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private ctx: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const id = url.searchParams.get("user") ?? crypto.randomUUID();

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment({ id, name: "guest", pose: null, seen: Date.now() } satisfies Attachment);
    server.send(JSON.stringify({ t: "welcome", id }));

    this.startTick();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string") return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const att = ws.deserializeAttachment() as Attachment;
    att.seen = Date.now();
    if (msg.t === "pose") att.pose = msg.p;
    if (msg.t === "hello") att.name = String(msg.name).slice(0, 32);
    ws.serializeAttachment(att);
    this.startTick();
  }

  async webSocketClose(ws: WebSocket) {
    this.leave(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.leave(ws);
  }

  private leave(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att) this.broadcast(JSON.stringify({ t: "leave", id: att.id }));
    if (this.ctx.getWebSockets().length <= 1) this.stopTick();
  }

  private startTick() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTick() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick() {
    const now = Date.now();
    const sockets = this.ctx.getWebSockets();
    if (sockets.length === 0) return this.stopTick();

    const players: Attachment[] = [];
    for (const ws of sockets) {
      const att = ws.deserializeAttachment() as Attachment;
      if (now - att.seen > IDLE_MS) {
        ws.close(4000, "idle");
        continue;
      }
      if (att.pose) players.push(att);
    }
    this.broadcast(JSON.stringify({ t: "snapshot", at: now, players }));
  }

  private broadcast(data: string) {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // socket already gone
      }
    }
  }
}
