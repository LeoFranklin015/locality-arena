import * as THREE from "three";
import { latLngToCell } from "h3-js";

type Pose = { x: number; y: number; z: number; yaw: number };
type Player = { id: string; name: string; pose: Pose };

const RES = 9;
const SEND_MS = 100; // 10hz

export class Presence {
  private ws: WebSocket | null = null;
  private base = "";
  private cell = "";
  private me = "";
  private lastSend = 0;
  private avatars = new Map<string, THREE.Mesh>();
  private geo = new THREE.CapsuleGeometry(3, 6, 4, 8);

  constructor(private scene: THREE.Scene, private hud: HTMLElement) {}

  connect(base: string, at: { lat: number; lng: number }) {
    this.base = base;
    this.setLocation(at.lat, at.lng);
  }

  // GPS users get snapped into the cell they are physically standing in
  setLocation(lat: number, lng: number) {
    const cell = latLngToCell(lat, lng, RES);
    if (cell === this.cell) return;
    this.cell = cell;
    this.join(cell);
  }

  private join(cell: string) {
    this.ws?.close(1000, "handoff");
    this.clear();
    const ws = new WebSocket(`${this.base}/zone?cell=${cell}`);
    ws.onopen = () => (this.hud.textContent = `zone ${cell}`);
    ws.onclose = () => (this.hud.textContent = `zone ${cell} (offline)`);
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    this.ws = ws;
  }

  private onMessage(msg: any) {
    if (msg.t === "welcome") this.me = msg.id;
    if (msg.t === "leave") this.remove(msg.id);
    if (msg.t === "snapshot") {
      const players = (msg.players as Player[]).filter((p) => p.id !== this.me);
      this.hud.textContent = `zone ${this.cell} · ${players.length + 1} here`;
      for (const p of players) this.place(p);
    }
  }

  private place(p: Player) {
    let m = this.avatars.get(p.id);
    if (!m) {
      m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0x3b6fd8 }));
      this.scene.add(m);
      this.avatars.set(p.id, m);
    }
    m.position.lerp(new THREE.Vector3(p.pose.x, p.pose.y, p.pose.z), 0.5);
  }

  private remove(id: string) {
    const m = this.avatars.get(id);
    if (m) this.scene.remove(m);
    this.avatars.delete(id);
  }

  private clear() {
    for (const id of [...this.avatars.keys()]) this.remove(id);
  }

  update(camera: THREE.Camera) {
    const now = performance.now();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || now - this.lastSend < SEND_MS) return;
    this.lastSend = now;
    const { x, y, z } = camera.position;
    const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ").y;
    this.ws.send(JSON.stringify({ t: "pose", p: { x, y, z, yaw } }));
  }
}
