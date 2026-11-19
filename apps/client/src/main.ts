import * as THREE from "three";
import { GlobeControls, TilesRenderer } from "3d-tiles-renderer";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/plugins";
import { Presence } from "./presence";
import { addShopPins } from "./shops";

const DEG = THREE.MathUtils.DEG2RAD;
const START = { lat: 13.0418, lng: 80.2341, height: 350 };

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1.6e7);

// photoreal city mesh
const tiles = new TilesRenderer();
tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: import.meta.env.VITE_GOOGLE_TILES_KEY }));
tiles.group.rotation.x = -Math.PI / 2; // ECEF z-up -> three y-up
scene.add(tiles.group);
tiles.setCamera(camera);
tiles.setResolutionFromRenderer(camera, renderer);

const controls = new GlobeControls(scene, camera, renderer.domElement, tiles);

function toWorld(lat: number, lng: number, height: number, target = new THREE.Vector3()) {
  tiles.ellipsoid.getCartographicToPosition(lat * DEG, lng * DEG, height, target);
  return target.applyMatrix4(tiles.group.matrixWorld);
}

// drop the camera over the start point, looking down
tiles.group.updateMatrixWorld();
camera.position.copy(toWorld(START.lat, START.lng, START.height));
camera.lookAt(toWorld(START.lat, START.lng, 0));

addShopPins(tiles);

const presence = new Presence(scene, document.getElementById("hud")!);
presence.connect(import.meta.env.VITE_ZONE_URL ?? "ws://localhost:8787", START);
navigator.geolocation?.watchPosition(
  (p) => presence.setLocation(p.coords.latitude, p.coords.longitude),
  () => {},
  { enableHighAccuracy: true },
);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  tiles.setResolutionFromRenderer(camera, renderer);
});

renderer.setAnimationLoop(() => {
  controls.update();
  camera.updateMatrixWorld();
  tiles.update();
  presence.update(camera);
  renderer.render(scene, camera);
});
