// WebGL animated orb - standalone React component
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';

interface OrbProps {
  hue?: number;
  hoverIntensity?: number;
  rotateOnHover?: boolean;
  glow?: number;
  showStaticPreview?: boolean;
  style?: CSSProperties;
  /**
   * Represents the external activity level (0-1) used to drive the orb's
   * energy. When undefined, the orb falls back to pointer-based hover states.
   */
  activityLevel?: number;
}

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function Orb({
  hue = 0,
  hoverIntensity = 0.2,
  rotateOnHover = true,
  glow = 1,
  showStaticPreview = false,
  style,
  activityLevel,
}: OrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isStatic = showStaticPreview || false;
  const normalizedActivity = useMemo(() => {
    if (typeof activityLevel !== 'number' || Number.isNaN(activityLevel)) {
      return undefined;
    }
    return Math.min(Math.max(activityLevel, 0), 1);
  }, [activityLevel]);

  const vertexShader = `
    precision highp float;
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentShader = `
    precision highp float;

    uniform float iTime;
    uniform vec3 iResolution;
    uniform float hue;
    uniform float hover;
    uniform float rot;
    uniform float hoverIntensity;
    uniform float glow;
    varying vec2 vUv;

    vec3 rgb2yiq(vec3 c) {
      float y = dot(c, vec3(0.299, 0.587, 0.114));
      float i = dot(c, vec3(0.596, -0.274, -0.322));
      float q = dot(c, vec3(0.211, -0.523, 0.312));
      return vec3(y, i, q);
    }

    vec3 yiq2rgb(vec3 c) {
      float r = c.x + 0.956 * c.y + 0.621 * c.z;
      float g = c.x - 0.272 * c.y - 0.647 * c.z;
      float b = c.x - 1.106 * c.y + 1.703 * c.z;
      return vec3(r, g, b);
    }

    vec3 adjustHue(vec3 color, float hueDeg) {
      float hueRad = hueDeg * 3.14159265 / 180.0;
      vec3 yiq = rgb2yiq(color);
      float cosA = cos(hueRad);
      float sinA = sin(hueRad);
      float i = yiq.y * cosA - yiq.z * sinA;
      float q = yiq.y * sinA + yiq.z * cosA;
      yiq.y = i;
      yiq.z = q;
      return yiq2rgb(yiq);
    }

    vec3 hash33(vec3 p3) {
      p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yxz + 19.19);
      return -1.0 + 2.0 * fract(vec3(
        p3.x + p3.y,
        p3.x + p3.z,
        p3.y + p3.z
      ) * p3.zyx);
    }

    float snoise3(vec3 p) {
      const float K1 = 0.333333333;
      const float K2 = 0.166666667;
      vec3 i = floor(p + (p.x + p.y + p.z) * K1);
      vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
      vec3 e = step(vec3(0.0), d0 - d0.yzx);
      vec3 i1 = e * (1.0 - e.zxy);
      vec3 i2 = 1.0 - e.zxy * (1.0 - e);
      vec3 d1 = d0 - (i1 - K2);
      vec3 d2 = d0 - (i2 - K1);
      vec3 d3 = d0 - 0.5;
      vec4 h = max(0.6 - vec4(
        dot(d0, d0),
        dot(d1, d1),
        dot(d2, d2),
        dot(d3, d3)
      ), 0.0);
      vec4 n = h * h * h * h * vec4(
        dot(d0, hash33(i)),
        dot(d1, hash33(i + i1)),
        dot(d2, hash33(i + i2)),
        dot(d3, hash33(i + 1.0))
      );
      return dot(vec4(31.316), n);
    }

    vec4 extractAlpha(vec3 colorIn) {
      float a = max(max(colorIn.r, colorIn.g), colorIn.b);
      return vec4(colorIn.rgb / (a + 1e-5), a);
    }

    const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
    const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
    const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
    const float innerRadius = 0.6;
    const float noiseScale = 0.65;

    float light1(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * attenuation);
    }

    float light2(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * dist * attenuation);
    }

    vec4 draw(vec2 uv) {
      vec3 color1 = adjustHue(baseColor1, hue);
      vec3 color2 = adjustHue(baseColor2, hue);
      vec3 color3 = adjustHue(baseColor3, hue);

      float ang = atan(uv.y, uv.x);
      float len = length(uv);
      float invLen = len > 0.0 ? 1.0 / len : 0.0;

      float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
      float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
      float d0 = distance(uv, (r0 * invLen) * uv);
      float v0 = light1(1.0, 10.0, d0);
      v0 *= smoothstep(r0 * 1.05, r0, len);
      float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

      float a = iTime * -1.0;
      vec2 pos = vec2(cos(a), sin(a)) * r0;
      float d = distance(uv, pos);
      float v1 = light2(1.5 * glow, 5.0, d);
      v1 *= light1(1.0, 50.0, d0);

      float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
      float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

      vec3 col = mix(color1, color2, cl);
      col = mix(color3, col, v0);
      col = (col + v1 * glow) * v2 * v3;
      col = clamp(col, 0.0, 1.0);

      return extractAlpha(col);
    }

    vec4 mainImage(vec2 fragCoord) {
      vec2 center = iResolution.xy * 0.5;
      float size = min(iResolution.x, iResolution.y);
      vec2 uv = (fragCoord - center) / size * 2.0;

      float angle = rot;
      float s = sin(angle);
      float c = cos(angle);
      uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

      uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
      uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

      return draw(uv);
    }

    void main() {
      vec2 fragCoord = vUv * iResolution.xy;
      vec4 col = mainImage(fragCoord);
      gl_FragColor = vec4(col.rgb * col.a, col.a);
    }
  `;

  useEffect(() => {
    if (isStatic) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
    });

    if (!gl) {
      return;
    }

    gl.clearColor(0, 0, 0, 0);
    container.appendChild(canvas);

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) {
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertShader = createShader(gl.VERTEX_SHADER, vertexShader);
    const fragShader = createShader(gl.FRAGMENT_SHADER, fragmentShader);

    if (!vertShader || !fragShader) {
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      return;
    }

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const positions = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const uvs = new Float32Array([0, 0, 2, 0, 0, 2]);

    const positionBuffer = gl.createBuffer();
    const uvBuffer = gl.createBuffer();

    if (!positionBuffer || !uvBuffer) {
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    const uvLocation = gl.getAttribLocation(program, 'uv');

    const timeLocation = gl.getUniformLocation(program, 'iTime');
    const resolutionLocation = gl.getUniformLocation(program, 'iResolution');
    const hueLocation = gl.getUniformLocation(program, 'hue');
    const hoverLocation = gl.getUniformLocation(program, 'hover');
    const rotLocation = gl.getUniformLocation(program, 'rot');
    const hoverIntensityLocation = gl.getUniformLocation(program, 'hoverIntensity');
    const glowLocation = gl.getUniformLocation(program, 'glow');

    if (
      !timeLocation ||
      !resolutionLocation ||
      !hueLocation ||
      !hoverLocation ||
      !rotLocation ||
      !hoverIntensityLocation ||
      !glowLocation
    ) {
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

    let targetHover = 0;
    let currentHover = 0;
    let currentRot = 0;
    const rotationSpeed = 0.3;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { width, height } = rect;
      const size = Math.min(width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const uvX = ((x - centerX) / size) * 2;
      const uvY = ((y - centerY) / size) * 2;

      targetHover = Math.sqrt(uvX * uvX + uvY * uvY) < 0.8 ? 1 : 0;
    };

    const handleMouseLeave = () => {
      targetHover = 0;
    };

    const enablePointer = typeof normalizedActivity !== 'number';

    if (enablePointer) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    const resize = () => {
      if (!container) {
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(
        resolutionLocation,
        canvas.width,
        canvas.height,
        canvas.width / canvas.height,
      );
    };

    window.addEventListener('resize', resize);
    resize();

    let rafId = 0;
    let lastTime = 0;

    const animate = (time: number) => {
      rafId = requestAnimationFrame(animate);

      const dt = (time - lastTime) * 0.001;
      lastTime = time;

      gl.uniform1f(timeLocation, time * 0.001);
      gl.uniform1f(hueLocation, hue);
      gl.uniform1f(hoverIntensityLocation, hoverIntensity);
      gl.uniform1f(glowLocation, glow);

      const target = typeof normalizedActivity === 'number' ? normalizedActivity : targetHover;
      currentHover += (target - currentHover) * 0.1;
      gl.uniform1f(hoverLocation, currentHover);

      if (rotateOnHover) {
        const rotationFactor = typeof normalizedActivity === 'number'
          ? Math.max(normalizedActivity, 0.1)
          : Math.max(targetHover, 0.1);
        currentRot += dt * rotationSpeed * rotationFactor;
      }

      gl.uniform1f(rotLocation, currentRot);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      if (enablePointer) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) {
        ext.loseContext();
      }
    };
  }, [
    hue,
    hoverIntensity,
    rotateOnHover,
    glow,
    isStatic,
    normalizedActivity,
  ]);

  if (isStatic) {
    const hueRad = (hue * Math.PI) / 180;
    const cos = Math.cos(hueRad);
    const sin = Math.sin(hueRad);

    const baseColor1 = [0.611765, 0.262745, 0.996078];
    const baseColor2 = [0.298039, 0.760784, 0.913725];

    const adjustHue = (rgb: number[]) => {
      const [r, g, b] = rgb;
      const y = r * 0.299 + g * 0.587 + b * 0.114;
      const i = r * 0.596 - g * 0.274 - b * 0.322;
      const q = r * 0.211 - g * 0.523 + b * 0.312;

      const newI = i * cos - q * sin;
      const newQ = i * sin + q * cos;

      const newR = y + 0.956 * newI + 0.621 * newQ;
      const newG = y - 0.272 * newI - 0.647 * newQ;
      const newB = y - 1.106 * newI + 1.703 * newQ;

      return [
        Math.max(0, Math.min(1, newR)),
        Math.max(0, Math.min(1, newG)),
        Math.max(0, Math.min(1, newB)),
      ];
    };

    const adjustedColor1 = adjustHue(baseColor1);
    const adjustedColor2 = adjustHue(baseColor2);

    const color1Hex = `rgb(${Math.round(adjustedColor1[0] * 255)}, ${Math.round(
      adjustedColor1[1] * 255,
    )}, ${Math.round(adjustedColor1[2] * 255)})`;
    const color2Hex = `rgb(${Math.round(adjustedColor2[0] * 255)}, ${Math.round(
      adjustedColor2[1] * 255,
    )}, ${Math.round(adjustedColor2[2] * 255)})`;

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: `radial-gradient(circle at 30% 40%, ${color1Hex} 0%, ${color2Hex} 50%, rgba(16, 20, 153, 0.8) 100%)`,
          borderRadius: '50%',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: `0 0 ${50 * glow}px ${color2Hex}${Math.round(64 * glow)
            .toString(16)
            .padStart(2, '0')}`,
          ...style,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '20%',
            width: '60%',
            height: '60%',
            background: `radial-gradient(circle, ${color1Hex}80 0%, transparent 70%)`,
            borderRadius: '50%',
            filter: 'blur(10px)',
            opacity: 0.6 * glow,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '40%',
            width: '20%',
            height: '20%',
            background: `radial-gradient(circle, ${color2Hex} 0%, transparent 70%)`,
            borderRadius: '50%',
            filter: 'blur(5px)',
            opacity: 0.8 * glow,
          }}
        />
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />;
}
