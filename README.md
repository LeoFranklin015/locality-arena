# locality arena

3D twin of the neighbourhood. Every storefront is a real shop you can order from, book, or walk to.

## layout

```
apps/
  client/        three.js + 3DTilesRendererJS, Google Photorealistic 3D Tiles, shop pins, presence
  zone-server/   Cloudflare Worker + one Durable Object per H3 cell (res 9) for multiplayer state
```

## run

```bash
npm install
cp apps/client/.env.example apps/client/.env   # add VITE_GOOGLE_TILES_KEY
npm run dev:zone     # wrangler dev on :8787
npm run dev:client   # vite on :5173
```

## how multiplayer works

- client resolves its H3 cell from GPS (or the camera position) and opens a websocket to `/zone?cell=...`
- the worker routes it to the Durable Object for that cell
- clients send pose at 10hz, the zone broadcasts a snapshot of everyone in the cell at 20hz
- the zone DO is the single writer for its cell

## roadmap

- [x] tiles viewer + demo shop pins
- [x] zone server + presence
- [ ] neighbour cell fan-out + handoff on boundary cross
- [ ] inventory sync worker (Swiggy MCP, merchant webhooks) into redis
- [ ] agent orchestrator (MCP client) + checkout (x402, cards)
