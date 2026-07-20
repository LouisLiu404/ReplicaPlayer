import { toCanvas } from "html-to-image";
import { useEffect, useRef, type RefObject } from "react";

import {
  createMagicLampMesh,
  easeMagicLampProgress,
  MAGIC_LAMP_BEND_STRENGTH,
  MAGIC_LAMP_NECK_SPLIT,
  receiverOpacity
} from "../magic-lamp";
import { DiscIcon } from "./icons";

export type MagicLampDirection = "expand" | "collapse";

interface MagicLampTransitionProps {
  direction: MagicLampDirection | null;
  sourceRef: RefObject<HTMLDivElement | null>;
  targetRef: RefObject<HTMLButtonElement | null>;
  artworkUrl?: string;
  artworkAlt: string;
  durationMs: number;
  onReady: (direction: MagicLampDirection) => void;
  onComplete: (direction: MagicLampDirection) => void;
  onFallback: (direction: MagicLampDirection) => void;
}

interface MagicLampRenderer {
  draw: (progress: number) => void;
  dispose: () => void;
}

const VERTEX_SHADER = `
  precision highp float;

  attribute vec2 a_position;
  attribute vec2 a_texture_coordinate;

  uniform vec4 u_source_rect;
  uniform vec4 u_target_rect;
  uniform vec2 u_viewport;
  uniform float u_progress;

  varying vec2 v_texture_coordinate;

  void main() {
    const float PI = 3.14159265359;
    const float NECK_SPLIT = ${MAGIC_LAMP_NECK_SPLIT.toFixed(2)};
    const float BEND_STRENGTH = ${MAGIC_LAMP_BEND_STRENGTH.toFixed(2)};

    float neck_progress = clamp(u_progress / NECK_SPLIT, 0.0, 1.0);
    float drain_progress = clamp(
      (u_progress - NECK_SPLIT) / (1.0 - NECK_SPLIT),
      0.0,
      1.0
    );

    float gap_to_receiver =
      u_target_rect.y - u_source_rect.y - u_source_rect.w;
    float full_height = max(
      u_target_rect.y - u_source_rect.y -
        (gap_to_receiver * (1.0 - neck_progress)),
      1.0
    );
    float remaining_height = full_height * (1.0 - drain_progress);
    float local_y = a_position.y * remaining_height;
    float width_delta = u_source_rect.z - u_target_rect.z;
    float local_x =
      (a_position.x * u_target_rect.z) +
      (a_position.x * width_delta * (1.0 - drain_progress) * (1.0 - a_position.y)) +
      (a_position.x * width_delta * (1.0 - neck_progress) * a_position.y);

    float target_offset_x = u_target_rect.x - u_source_rect.x;
    float horizontal_offset =
      (target_offset_x * (local_y / full_height) * neck_progress) +
      (target_offset_x * drain_progress);
    float vertical_offset =
      u_target_rect.y - u_source_rect.y - remaining_height -
        (gap_to_receiver * (1.0 - neck_progress));

    float bend_phase =
      ((remaining_height - local_y) / full_height) * 2.0 * PI + PI;
    float source_x = u_source_rect.x + (u_source_rect.z * a_position.x);
    float target_x = u_target_rect.x + (u_target_rect.z * a_position.x);
    float bend =
      sin(bend_phase) * (source_x - target_x) *
        BEND_STRENGTH * neck_progress;

    vec2 pixel_position = u_source_rect.xy + vec2(
      local_x + horizontal_offset + bend,
      local_y + vertical_offset
    );
    vec2 clip_position = (pixel_position / u_viewport) * 2.0 - 1.0;

    gl_Position = vec4(clip_position.x, -clip_position.y, 0.0, 1.0);
    v_texture_coordinate = a_texture_coordinate;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D u_texture;
  varying vec2 v_texture_coordinate;

  void main() {
    gl_FragColor = texture2D(u_texture, v_texture_coordinate);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create magic lamp shader");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader compilation error";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function requireAttribute(gl: WebGLRenderingContext, program: WebGLProgram, name: string): number {
  const location = gl.getAttribLocation(program, name);
  if (location < 0) {
    throw new Error(`Missing magic lamp attribute: ${name}`);
  }
  return location;
}

function requireUniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) {
    throw new Error(`Missing magic lamp uniform: ${name}`);
  }
  return location;
}

function createBuffer(
  gl: WebGLRenderingContext,
  target: number,
  data: BufferSource
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error("Unable to create magic lamp buffer");
  }

  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return buffer;
}

function createRenderer(
  canvas: HTMLCanvasElement,
  snapshot: HTMLCanvasElement,
  sourceRect: DOMRect,
  targetRect: DOMRect
): MagicLampRenderer {
  const pixelRatio = 1;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  canvas.width = Math.max(Math.round(viewportWidth * pixelRatio), 1);
  canvas.height = Math.max(Math.round(viewportHeight * pixelRatio), 1);

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    desynchronized: true,
    powerPreference: "high-performance",
    premultipliedAlpha: true,
    preserveDrawingBuffer: false
  });
  if (!gl) {
    throw new Error("WebGL is unavailable");
  }

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("Unable to create magic lamp program");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown magic lamp linking error";
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(message);
  }

  const mesh = createMagicLampMesh();
  const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, mesh.positions);
  const textureCoordinateBuffer = createBuffer(gl, gl.ARRAY_BUFFER, mesh.textureCoordinates);
  const indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Unable to create magic lamp texture");
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapshot);

  const positionLocation = requireAttribute(gl, program, "a_position");
  const textureCoordinateLocation = requireAttribute(gl, program, "a_texture_coordinate");
  const sourceRectLocation = requireUniform(gl, program, "u_source_rect");
  const targetRectLocation = requireUniform(gl, program, "u_target_rect");
  const viewportLocation = requireUniform(gl, program, "u_viewport");
  const progressLocation = requireUniform(gl, program, "u_progress");

  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinateBuffer);
  gl.enableVertexAttribArray(textureCoordinateLocation);
  gl.vertexAttribPointer(textureCoordinateLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.uniform4f(
    sourceRectLocation,
    sourceRect.left,
    sourceRect.top,
    sourceRect.width,
    sourceRect.height
  );
  gl.uniform4f(
    targetRectLocation,
    targetRect.left,
    targetRect.top,
    targetRect.width,
    targetRect.height
  );
  gl.uniform2f(viewportLocation, viewportWidth, viewportHeight);
  gl.uniform1i(requireUniform(gl, program, "u_texture"), 0);

  return {
    draw: (progress) => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(progressLocation, progress);
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    },
    dispose: () => {
      gl.deleteTexture(texture);
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(textureCoordinateBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    }
  };
}

export function MagicLampTransition({
  direction,
  sourceRef,
  targetRef,
  artworkUrl,
  artworkAlt,
  durationMs,
  onReady,
  onComplete,
  onFallback
}: MagicLampTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const receiverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!direction) {
      return;
    }

    let cancelled = false;
    let animationFrame = 0;
    let renderer: MagicLampRenderer | null = null;
    let sourceNode: HTMLDivElement | null = null;
    let fallbackSent = false;

    const useFallback = () => {
      if (!cancelled && !fallbackSent) {
        fallbackSent = true;
        onFallback(direction);
      }
    };

    const run = async () => {
      const source = sourceRef.current;
      const target = targetRef.current;
      const output = canvasRef.current;
      const receiver = receiverRef.current;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

      if (
        !source ||
        !target ||
        !output ||
        !receiver ||
        reduceMotion ||
        typeof window.WebGLRenderingContext === "undefined"
      ) {
        useFallback();
        return;
      }

      sourceNode = source;

      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (
        sourceRect.width < 1 ||
        sourceRect.height < 1 ||
        targetRect.width < 1 ||
        targetRect.height < 1
      ) {
        useFallback();
        return;
      }

      try {
        const snapshot = await toCanvas(source, {
          backgroundColor: "#08090b",
          cacheBust: false,
          pixelRatio: 1,
          skipFonts: true,
          width: sourceRect.width,
          height: sourceRect.height,
          style: {
            opacity: "1",
            transform: "none",
            filter: "none",
            clipPath: "none",
            pointerEvents: "none"
          }
        });
        if (cancelled) {
          return;
        }

        renderer = createRenderer(output, snapshot, sourceRect, targetRect);
        receiver.style.left = `${targetRect.left}px`;
        receiver.style.top = `${targetRect.top}px`;
        receiver.style.width = `${targetRect.width}px`;
        receiver.style.height = `${targetRect.height}px`;

        const initialProgress = direction === "collapse" ? 0 : 1;
        renderer.draw(initialProgress);
        output.classList.add("visible");
        receiver.classList.add("visible");
        receiver.style.opacity = `${receiverOpacity(direction, 0)}`;
        onReady(direction);

        const startedAt = performance.now();
        const tick = (now: number) => {
          if (cancelled || !renderer) {
            return;
          }

          const elapsedProgress = Math.min(Math.max((now - startedAt) / durationMs, 0), 1);
          const eased = easeMagicLampProgress(elapsedProgress);
          const meshProgress = direction === "collapse" ? eased : 1 - eased;
          renderer.draw(meshProgress);
          receiver.style.opacity = `${receiverOpacity(direction, elapsedProgress)}`;
          const pulse = Math.sin(Math.PI * receiverOpacity(direction, elapsedProgress)) * 0.055;
          receiver.style.transform = `scale(${1 + pulse})`;

          if (elapsedProgress >= 1) {
            if (direction === "expand") {
              source.style.opacity = "1";
            }
            onComplete(direction);
            return;
          }

          animationFrame = window.requestAnimationFrame(tick);
        };

        animationFrame = window.requestAnimationFrame(tick);
      } catch {
        useFallback();
      }
    };

    void run();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      renderer?.dispose();
      sourceNode?.style.removeProperty("opacity");
      canvasRef.current?.classList.remove("visible");
      receiverRef.current?.classList.remove("visible");
    };
  }, [direction, durationMs, onComplete, onFallback, onReady, sourceRef, targetRef]);

  return (
    <>
      <canvas ref={canvasRef} className="magic-lamp-canvas" aria-hidden="true" />
      <div ref={receiverRef} className="magic-lamp-receiver" aria-hidden="true">
        {artworkUrl ? (
          <img src={artworkUrl} alt={artworkAlt} />
        ) : (
          <span className="magic-lamp-receiver-fallback">
            <DiscIcon />
          </span>
        )}
      </div>
    </>
  );
}
