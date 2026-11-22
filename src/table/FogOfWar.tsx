import { useId, useLayoutEffect, useRef, useState } from "react";

type Fog = { width: number; height: number; softness: number; explored: number[][]; vision: number[][] };

function fillPolygons(context: CanvasRenderingContext2D, polygons: number[][], color: string) {
  context.fillStyle = color;
  for (const points of polygons) {
    if (points.length < 6) continue;
    context.beginPath();
    context.moveTo(points[0], points[1]);
    for (let index = 2; index + 1 < points.length; index += 2) context.lineTo(points[index], points[index + 1]);
    context.fill("evenodd");
  }
}

async function createFogRenderer(canvas: HTMLCanvasElement, onLost: () => void) {
  const {
    CanvasTexture, LinearFilter, Mesh, NoBlending, NodeMaterial, OrthographicCamera,
    PlaneGeometry, Scene, Vector2, WebGPURenderer, RenderTarget, texture: sample,
    uniform, uv, vec4,
  } = await import("three/webgpu");
  const mask = canvas.ownerDocument.createElement("canvas");
  const context = mask.getContext("2d", { alpha: false });
  if (!context) return null;
  const renderer = new WebGPURenderer({ canvas, alpha: true, antialias: false, depth: false, stencil: false, forceWebGL: !navigator.gpu });
  try {
    await renderer.init();
  } catch {
    return null;
  }
  const api: "webgpu" | "webgl" = "isWebGPUBackend" in renderer.backend ? "webgpu" : "webgl";
  let deviceLost = false;
  const reportDeviceLoss = renderer.onDeviceLost;
  renderer.onDeviceLost = (info) => {
    deviceLost = true;
    reportDeviceLoss.call(renderer, info);
    onLost();
  };
  // Keep allocations bounded even for very large imported maps.
  const limit = 2048;
  const texture = new CanvasTexture(mask);
  texture.flipY = false;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  const horizontal = new RenderTarget(1, 1, { depthBuffer: false, minFilter: LinearFilter });
  const blurX = uniform(new Vector2());
  const blurY = uniform(new Vector2());
  // A separable Gaussian approximation with five bilinear taps per pass.
  const blur = (input: typeof horizontal.texture, step: typeof blurX) => {
    const at = uv();
    const near = step.mul(1.384615);
    const far = step.mul(3.230769);
    const read = (point: Parameters<typeof sample>[1]) => sample(input, point).rg;
    return read(at).mul(0.227027)
      .add(read(at.add(near)).add(read(at.sub(near))).mul(0.316216))
      .add(read(at.add(far)).add(read(at.sub(far))).mul(0.070270));
  };
  const blurPass = new NodeMaterial();
  blurPass.setValues({ blending: NoBlending, depthTest: false, depthWrite: false });
  blurPass.fragmentNode = vec4(blur(texture, blurX), 0, 1);
  const fogPass = new NodeMaterial();
  fogPass.setValues({ blending: NoBlending, depthTest: false, depthWrite: false });
  const seen = blur(horizontal.texture, blurY);
  fogPass.fragmentNode = vec4(0, 0, 0, seen.r.mul(seen.g.mul(0.55).add(0.45)).oneMinus());
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene();
  const quad = new Mesh(geometry, blurPass);
  quad.frustumCulled = false;
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;

  return {
    api,
    draw({ width, height, softness, explored, vision }: Fog) {
      if (deviceLost) return false;
      const scale = Math.min(1, limit / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      if (mask.width !== w || mask.height !== h || canvas.width !== w || canvas.height !== h) {
        mask.width = w;
        mask.height = h;
        horizontal.setSize(w, h);
        renderer.setSize(w, h, false);
      }
      context.resetTransform();
      context.fillStyle = "#000";
      context.fillRect(0, 0, w, h);
      context.setTransform(w / width, 0, 0, h / height, 0, 0);
      fillPolygons(context, explored, "#f00");
      // Current sight belongs to both masks, even before the host saves it.
      fillPolygons(context, vision, "#ff0");
      texture.needsUpdate = true;

      blurX.value.set(softness / (1.7 * width), 0);
      blurY.value.set(0, softness / (1.7 * height));
      quad.material = blurPass;
      renderer.setRenderTarget(horizontal);
      renderer.render(scene, camera);
      quad.material = fogPass;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return true;
    },
    dispose() {
      geometry.dispose();
      blurPass.dispose();
      fogPass.dispose();
      horizontal.dispose();
      texture.dispose();
      renderer.dispose();
    },
  };
}

function FogFallback({ width, height, softness, explored, vision }: Fog) {
  const id = useId();
  const draw = (polygons: number[][]) => polygons.map((points, index) => (
    <polygon key={index} points={points.join(" ")} fill="#000" />
  ));
  return (
    <svg className="overlay sight" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <filter id={`${id}-soft`} filterUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <feGaussianBlur stdDeviation={softness} />
        </filter>
        <mask id={`${id}-explored`}>
          <rect width={width} height={height} fill="#fff" />
          <g filter={`url(#${id}-soft)`}>{draw([...explored, ...vision])}</g>
        </mask>
        <mask id={`${id}-now`}>
          <rect width={width} height={height} fill="#fff" />
          <g filter={`url(#${id}-soft)`}>{draw(vision)}</g>
        </mask>
      </defs>
      <rect width={width} height={height} fill="#000" mask={`url(#${id}-explored)`} />
      <rect width={width} height={height} fill="#000" fillOpacity={0.55} mask={`url(#${id}-now)`} />
    </svg>
  );
}

// The host supplies both sets of polygons. This layer only composites them.
export function FogOfWar({ width, height, softness, explored, vision }: Fog) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const gpu = useRef<Awaited<ReturnType<typeof createFogRenderer>>>(null);
  const latest = useRef<Fog>({ width, height, softness, explored, vision });
  const [api, setApi] = useState<"webgpu" | "webgl" | null>(null);
  const redraw = () => {
    try {
      const active = gpu.current;
      setApi(active?.draw(latest.current) ? active.api : null);
    } catch {
      setApi(null);
    }
  };
  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let live = true;
    const lost = () => setApi(null);
    element.addEventListener("webglcontextlost", lost);
    void createFogRenderer(element, () => {
      if (live) lost();
    }).then((renderer) => {
      if (!live) {
        renderer?.dispose();
        return;
      }
      gpu.current = renderer;
      redraw();
    }).catch(() => {
      if (live) lost();
    });
    return () => {
      live = false;
      element.removeEventListener("webglcontextlost", lost);
      gpu.current?.dispose();
      gpu.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    latest.current = { width, height, softness, explored, vision };
    redraw();
  }, [width, height, softness, explored, vision]);
  return (
    <>
      <canvas ref={canvas} className="overlay sight" style={{ width, height, visibility: api ? "visible" : "hidden" }} data-fog-renderer={api ?? undefined} aria-hidden="true" />
      {api ? null : <FogFallback {...{ width, height, softness, explored, vision }} />}
    </>
  );
}
