import * as THREE from "three";
import type { TilesRenderer } from "3d-tiles-renderer";

type Shop = { id: string; name: string; kind: string; lat: number; lng: number };

const COLORS: Record<string, number> = { food: 0xff7a45, movies: 0x7a5cff, grocery: 0x2fbf71 };
const DEG = THREE.MathUtils.DEG2RAD;

// pins live inside tiles.group so they share the ECEF frame with the city mesh
export async function addShopPins(tiles: TilesRenderer) {
  const shops: Shop[] = await fetch("/shops.json").then((r) => r.json());
  const geo = new THREE.ConeGeometry(6, 18, 12).rotateX(Math.PI / 2);

  for (const shop of shops) {
    const mat = new THREE.MeshBasicMaterial({ color: COLORS[shop.kind] ?? 0xffffff });
    const pin = new THREE.Mesh(geo, mat);
    const pos = tiles.ellipsoid.getCartographicToPosition(shop.lat * DEG, shop.lng * DEG, 40, new THREE.Vector3());
    const up = tiles.ellipsoid.getCartographicToNormal(shop.lat * DEG, shop.lng * DEG, new THREE.Vector3());
    pin.position.copy(pos);
    pin.lookAt(pos.clone().sub(up)); // point down at the shop
    pin.userData = shop;
    tiles.group.add(pin);
  }
}
