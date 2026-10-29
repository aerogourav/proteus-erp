"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Grid3x3, Maximize2, RotateCcw } from "lucide-react";

/**
 * 3D viewer for STEP, IGES and STL files, entirely in the browser.
 * three.js and the OpenCascade-based STEP reader (occt-import-js, WebAssembly) are loaded from a CDN
 * only when a model is opened, so they add nothing to the normal page weight.
 */
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js";
const OCCT_BASE = "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Three = any;
let threePromise: Promise<Three> | null = null;
let occtPromise: Promise<any> | null = null;

function loadThree(): Promise<Three> {
  const url: string = THREE_URL;
  if (!threePromise) threePromise = import(/* webpackIgnore: true */ url).catch((error) => { threePromise = null; throw error; });
  return threePromise;
}

function loadOcct(): Promise<any> {
  if (occtPromise) return occtPromise;
  occtPromise = new Promise((resolve, reject) => {
    const w = window as any;
    const init = () => { w.occtimportjs({ locateFile: (name: string) => OCCT_BASE + name }).then(resolve, reject); };
    if (w.occtimportjs) { init(); return; }
    const script = document.createElement("script");
    script.src = `${OCCT_BASE}occt-import-js.js`;
    script.async = true;
    script.onload = init;
    script.onerror = () => reject(new Error("The STEP reader could not be loaded."));
    document.head.appendChild(script);
  }).catch((error) => { occtPromise = null; throw error; });
  return occtPromise;
}

export const MODEL_EXTENSIONS = ["step", "stp", "igs", "iges", "stl"];

type MeshData = { positions: Float32Array; normals: Float32Array | null; index: Uint32Array | null; color: [number, number, number] | null };

/** Binary or ASCII STL. */
function parseStl(buffer: ArrayBuffer): MeshData[] {
  const view = new DataView(buffer);
  const count = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
  if (buffer.byteLength === 84 + count * 50 && count > 0) {
    const positions = new Float32Array(count * 9);
    const normals = new Float32Array(count * 9);
    for (let i = 0; i < count; i += 1) {
      const offset = 84 + i * 50;
      const n = [view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)];
      for (let v = 0; v < 3; v += 1) for (let c = 0; c < 3; c += 1) {
        positions[i * 9 + v * 3 + c] = view.getFloat32(offset + 12 + v * 12 + c * 4, true);
        normals[i * 9 + v * 3 + c] = n[c];
      }
    }
    return [{ positions, normals, index: null, color: null }];
  }
  const text = new TextDecoder().decode(buffer);
  const values = [...text.matchAll(/vertex\s+([-+\deE.]+)\s+([-+\deE.]+)\s+([-+\deE.]+)/g)].flatMap((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
  if (!values.length) throw new Error("This STL file has no triangles.");
  return [{ positions: new Float32Array(values), normals: null, index: null, color: null }];
}

async function parseCad(buffer: ArrayBuffer, ext: string): Promise<MeshData[]> {
  if (ext === "stl") return parseStl(buffer);
  const occt = await loadOcct();
  const bytes = new Uint8Array(buffer);
  const params = { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.0015, angularDeflection: 0.35 };
  const read = (p: unknown) => (ext === "igs" || ext === "iges" ? occt.ReadIgesFile(bytes, p) : occt.ReadStepFile(bytes, p));
  let result = read(params);
  if (!result?.success || !result.meshes?.length) result = read(null);
  if (!result?.success || !result.meshes?.length) throw new Error("This file could not be read as a 3D model.");
  return result.meshes.map((mesh: any) => ({
    positions: new Float32Array(mesh.attributes.position.array),
    normals: mesh.attributes.normal ? new Float32Array(mesh.attributes.normal.array) : null,
    index: mesh.index ? new Uint32Array(mesh.index.array) : null,
    color: mesh.color ?? null,
  }));
}

type ViewName = "iso" | "front" | "top" | "right";

export function ModelViewer({ blob, name, height = 420 }: { blob: Blob; name: string; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ view: (name: ViewName) => void; wire: (on: boolean) => void; edges: (on: boolean) => void } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState(() => (name.toLowerCase().endsWith(".stl") ? "Reading the mesh…" : "Loading the STEP reader (first time only, about 8 MB)…"));
  const [info, setInfo] = useState<{ size: string; triangles: number } | null>(null);
  const [wire, setWire] = useState(false);
  const [edges, setEdges] = useState(true);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    const ext = (name.split(".").pop() ?? "").toLowerCase();
    (async () => {
      try {
        const [THREE, buffer] = await Promise.all([loadThree(), blob.arrayBuffer()]);
        const meshes = await parseCad(buffer, ext);
        if (disposed || !host.current) return;
        const el = host.current;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(el.clientWidth, el.clientHeight);
        el.appendChild(renderer.domElement);
        renderer.domElement.style.touchAction = "none";
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x5e4a55, 1.6));
        const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(3, 5, 4); scene.add(key);
        const fill = new THREE.DirectionalLight(0xffe6dc, 0.7); fill.position.set(-4, -2, -3); scene.add(fill);

        // CAD files are Z-up; three.js is Y-up.
        const model = new THREE.Group();
        model.rotation.x = -Math.PI / 2;
        scene.add(model);
        const solids: any[] = [];
        const lines: any[] = [];
        let triangles = 0;
        for (const data of meshes) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
          if (data.index) geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
          if (data.normals) geometry.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3)); else geometry.computeVertexNormals();
          triangles += data.index ? data.index.length / 3 : data.positions.length / 9;
          const color = data.color ? new THREE.Color(data.color[0], data.color[1], data.color[2]) : new THREE.Color(0xb9c1cc);
          const material = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.42, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
          const mesh = new THREE.Mesh(geometry, material);
          model.add(mesh); solids.push(mesh);
          const edgeLines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), new THREE.LineBasicMaterial({ color: 0x1f0e18, transparent: true, opacity: 0.55 }));
          model.add(edgeLines); lines.push(edgeLines);
        }
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.length() / 2, 1);
        // Size in model axes (X, Y, Z of the CAD file): three Y is CAD Z.
        setInfo({ size: `${size.x.toFixed(1)} × ${size.z.toFixed(1)} × ${size.y.toFixed(1)} mm`, triangles: Math.round(triangles) });

        const camera = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, radius / 100, radius * 100);
        const target = center.clone();
        const orbit = { theta: Math.PI / 4, phi: Math.PI / 3, distance: radius / Math.tan((35 * Math.PI) / 360) * 1.25 };
        const render = () => renderer.render(scene, camera);
        const place = () => {
          const sinPhi = Math.sin(orbit.phi);
          camera.position.set(target.x + orbit.distance * sinPhi * Math.sin(orbit.theta), target.y + orbit.distance * Math.cos(orbit.phi), target.z + orbit.distance * sinPhi * Math.cos(orbit.theta));
          camera.lookAt(target);
          key.position.copy(camera.position).add(new THREE.Vector3(radius, radius * 2, 0));
          render();
        };
        const views: Record<ViewName, [number, number]> = { iso: [Math.PI / 4, Math.PI / 3], front: [0, Math.PI / 2], top: [0, 0.0001], right: [Math.PI / 2, Math.PI / 2] };
        const setView = (view: ViewName) => { [orbit.theta, orbit.phi] = views[view]; target.copy(center); orbit.distance = radius / Math.tan((35 * Math.PI) / 360) * 1.25; place(); };
        place();

        // Mouse and touch: drag to rotate, right/shift-drag or two fingers to pan, wheel or pinch to zoom.
        const pointers = new Map<number, { x: number; y: number }>();
        let mode: "rotate" | "pan" = "rotate";
        let pinch = 0;
        const pan = (dx: number, dy: number) => {
          const scale = (orbit.distance * Math.tan((35 * Math.PI) / 360) * 2) / el.clientHeight;
          const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).multiplyScalar(-dx * scale);
          const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar(dy * scale);
          target.add(right).add(up);
        };
        const onDown = (event: PointerEvent) => {
          renderer.domElement.setPointerCapture(event.pointerId);
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          mode = event.button === 2 || event.shiftKey || pointers.size > 1 ? "pan" : "rotate";
          if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
        };
        const onMove = (event: PointerEvent) => {
          const last = pointers.get(event.pointerId);
          if (!last) return;
          const dx = event.clientX - last.x, dy = event.clientY - last.y;
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinch) orbit.distance = Math.min(radius * 40, Math.max(radius * 0.2, orbit.distance * (pinch / dist)));
            pinch = dist;
            pan(dx / 2, dy / 2);
          } else if (mode === "rotate") {
            orbit.theta -= dx * 0.008;
            orbit.phi = Math.min(Math.PI - 0.01, Math.max(0.01, orbit.phi - dy * 0.008));
          } else pan(dx, dy);
          place();
        };
        const onUp = (event: PointerEvent) => { pointers.delete(event.pointerId); if (pointers.size < 2) pinch = 0; };
        const onWheel = (event: WheelEvent) => { event.preventDefault(); orbit.distance = Math.min(radius * 40, Math.max(radius * 0.2, orbit.distance * Math.exp(event.deltaY * 0.0012))); place(); };
        const onMenu = (event: Event) => event.preventDefault();
        const onDouble = () => setView("iso");
        const canvas = renderer.domElement;
        canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
        canvas.addEventListener("wheel", onWheel, { passive: false }); canvas.addEventListener("contextmenu", onMenu); canvas.addEventListener("dblclick", onDouble);
        const resize = new ResizeObserver(() => { if (!el.clientWidth || !el.clientHeight) return; renderer.setSize(el.clientWidth, el.clientHeight); camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); render(); });
        resize.observe(el);

        api.current = {
          view: setView,
          wire: (on) => { for (const mesh of solids) mesh.material.wireframe = on; render(); },
          edges: (on) => { for (const line of lines) line.visible = on; render(); },
        };
        setStatus("ready");
        cleanup = () => {
          resize.disconnect();
          canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
          canvas.removeEventListener("wheel", onWheel); canvas.removeEventListener("contextmenu", onMenu); canvas.removeEventListener("dblclick", onDouble);
          for (const item of [...solids, ...lines]) { item.geometry.dispose(); item.material.dispose(); }
          renderer.dispose();
          canvas.remove();
          api.current = null;
        };
      } catch (error) {
        if (disposed) return;
        setStatus("error");
        setMessage(error instanceof Error && error.message.includes("could not be read") ? error.message : "The 3D viewer could not load here. It needs access to cdn.jsdelivr.net. You can still download the file and open it in your CAD tool.");
      }
    })();
    return () => { disposed = true; cleanup(); };
  }, [blob, name]);

  return <div className="erp-model">
    <div className="erp-model-stage" ref={host} style={{ height }} aria-label={`3D model ${name}. Drag to rotate, scroll to zoom, right-drag to pan.`} role="img">
      {status !== "ready" && <div className={`erp-model-msg${status === "error" ? " is-error" : ""}`} role="status"><Box size={22} />{message}</div>}
    </div>
    {status === "ready" && <div className="erp-model-bar">
      <div className="erp-model-views" role="group" aria-label="View">
        {(["iso", "front", "top", "right"] as ViewName[]).map((view) => <button key={view} type="button" onClick={() => api.current?.view(view)}>{view === "iso" ? "Iso" : view[0].toUpperCase() + view.slice(1)}</button>)}
      </div>
      <button type="button" aria-pressed={edges} onClick={() => { setEdges(!edges); api.current?.edges(!edges); }}><Maximize2 size={13} /> Edges</button>
      <button type="button" aria-pressed={wire} onClick={() => { setWire(!wire); api.current?.wire(!wire); }}><Grid3x3 size={13} /> Wireframe</button>
      <button type="button" onClick={() => api.current?.view("iso")}><RotateCcw size={13} /> Reset</button>
      {info && <span className="erp-model-info">{info.size} · {info.triangles.toLocaleString("en-GB")} triangles</span>}
    </div>}
  </div>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
