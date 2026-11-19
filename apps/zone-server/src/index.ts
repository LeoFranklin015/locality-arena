import { isValidCell, latLngToCell } from "h3-js";
export { Zone } from "./zone";

export interface Env {
  ZONES: DurableObjectNamespace;
}

const RES = 9;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/zone") {
      let cell = url.searchParams.get("cell");
      const lat = url.searchParams.get("lat");
      const lng = url.searchParams.get("lng");
      if (!cell && lat && lng) cell = latLngToCell(Number(lat), Number(lng), RES);
      if (!cell || !isValidCell(cell)) return new Response("invalid cell", { status: 400 });

      // plain GET just resolves the cell, websocket upgrade joins it
      if (req.headers.get("Upgrade") !== "websocket") return Response.json({ cell });

      const stub = env.ZONES.get(env.ZONES.idFromName(cell));
      return stub.fetch(req);
    }

    return new Response("arena zone server", { headers: { "content-type": "text/plain" } });
  },
};
