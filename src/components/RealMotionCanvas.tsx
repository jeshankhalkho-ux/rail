import React, { useEffect, useRef } from "react";

export type RakeModel = "vb-saffron" | "vb-white" | "wap7-lhb";
export type CameraMode = "cinema" | "chase" | "cockpit";
export type WeatherMode = "dusk" | "rain" | "twilight";

interface RealMotionCanvasProps {
  rakeModel: RakeModel;
  cameraMode: CameraMode;
  weatherMode: WeatherMode;
  currentSpeed: number;
  targetSpeed: number;
  isBraking: boolean;
  arcFlashTrigger: number;
  boardText: string;
  onFpsUpdate?: (fps: number) => void;
  onSpeedStep?: (speed: number) => void;
}

export const RealMotionCanvas: React.FC<RealMotionCanvasProps> = ({
  rakeModel,
  cameraMode,
  weatherMode,
  currentSpeed,
  targetSpeed,
  isBraking,
  arcFlashTrigger,
  boardText,
  onFpsUpdate,
  onSpeedStep,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable refs to decouple high-frequency 60fps render loop from React state re-renders
  const stateRef = useRef({
    rakeModel,
    cameraMode,
    weatherMode,
    currentSpeed,
    targetSpeed,
    isBraking,
    boardText,
    arcFlashIntensity: 0,
    wheelRotationAngle: 0,
    worldZ: 0,
  });

  // Sync props to mutable ref
  useEffect(() => {
    stateRef.current.rakeModel = rakeModel;
    stateRef.current.cameraMode = cameraMode;
    stateRef.current.weatherMode = weatherMode;
    stateRef.current.targetSpeed = targetSpeed;
    stateRef.current.isBraking = isBraking;
    stateRef.current.boardText = boardText;
  }, [rakeModel, cameraMode, weatherMode, targetSpeed, isBraking, boardText]);

  useEffect(() => {
    if (arcFlashTrigger > 0) {
      stateRef.current.arcFlashIntensity = 1.25;
    }
  }, [arcFlashTrigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let cw = 850;
    let ch = 340;
    let dpr = 1;

    const resize = () => {
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = rect.width;
      ch = rect.height;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    // Initialize particles
    const bokehOrbs = Array.from({ length: 42 }, () => ({
      x: Math.random() * 1200,
      y: Math.random() * 95 + 10,
      r: Math.random() * 9 + 3,
      speedFactor: Math.random() * 0.35 + 0.12,
      hue: Math.random() > 0.3 ? 35 : 16,
      alpha: Math.random() * 0.45 + 0.15,
    }));

    const rainStreaks = Array.from({ length: 95 }, () => ({
      x: Math.random() * 1100,
      y: Math.random() * 360,
      len: Math.random() * 28 + 16,
      speed: Math.random() * 13 + 15,
    }));

    const mountainRidges = Array.from({ length: 24 }, (_, i) => ({
      x: i * 90,
      h: 28 + Math.sin(i * 1.3) * 18 + Math.cos(i * 0.7) * 10,
    }));

    interface Spark {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      color: string;
    }
    const sparksList: Spark[] = [];

    const spawnSpark = (x: number, y: number, count: number, isBrake: boolean) => {
      for (let i = 0; i < count; i++) {
        sparksList.push({
          x,
          y,
          vx: -(Math.random() * 5 + 3.5),
          vy: isBrake ? -(Math.random() * 2.2 + 0.4) : (Math.random() - 0.3) * 3.5,
          life: 1.0,
          color: isBrake ? "#fb923c" : "#fef08a",
        });
      }
    };

    // 3D Perspective Projection Helper
    const project3D = (
      wx: number,
      wy: number,
      wz: number,
      camX: number,
      camY: number,
      fov: number,
      vpX: number,
      vpY: number
    ) => {
      const safeZ = Math.max(4, wz);
      const scale = fov / safeZ;
      return {
        x: vpX + (wx - camX) * scale,
        y: vpY - (wy - camY) * scale,
        scale: scale,
      };
    };

    // Draw Sky & Atmosphere
    const drawSkyAndAtmosphere = (horizonY: number) => {
      const wxMode = stateRef.current.weatherMode;
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      if (wxMode === "dusk") {
        skyGrad.addColorStop(0, "#070609");
        skyGrad.addColorStop(0.5, "#191015");
        skyGrad.addColorStop(0.82, "#3f1814");
        skyGrad.addColorStop(1, "#852d12");
      } else if (wxMode === "rain") {
        skyGrad.addColorStop(0, "#050507");
        skyGrad.addColorStop(0.6, "#111015");
        skyGrad.addColorStop(1, "#261f23");
      } else {
        skyGrad.addColorStop(0, "#050407");
        skyGrad.addColorStop(0.6, "#180a13");
        skyGrad.addColorStop(1, "#431022");
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, cw, horizonY + 2);

      // Warm Setting Sun / Horizon Bloom
      const sunX = cw * 0.72;
      const sunGlow = ctx.createRadialGradient(sunX, horizonY - 12, 4, sunX, horizonY - 12, 190);
      if (wxMode === "dusk") {
        sunGlow.addColorStop(0, "rgba(254, 240, 138, 0.65)");
        sunGlow.addColorStop(0.35, "rgba(249, 115, 22, 0.30)");
        sunGlow.addColorStop(1, "rgba(249, 115, 22, 0)");
      } else if (wxMode === "rain") {
        sunGlow.addColorStop(0, "rgba(251, 191, 36, 0.18)");
        sunGlow.addColorStop(1, "rgba(251, 191, 36, 0)");
      } else {
        sunGlow.addColorStop(0, "rgba(244, 63, 94, 0.42)");
        sunGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      }
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, cw, horizonY + 30);

      // Mountain Ridges
      ctx.fillStyle = "#0e0a0d";
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      const mShift = (stateRef.current.worldZ * 0.12) % 90;
      for (let i = 0; i < mountainRidges.length; i++) {
        const mx = i * 90 - mShift;
        ctx.lineTo(mx, horizonY - mountainRidges[i].h);
      }
      ctx.lineTo(cw + 100, horizonY);
      ctx.closePath();
      ctx.fill();

      // Distant City Bokeh Lights
      bokehOrbs.forEach((orb) => {
        const bx = ((orb.x - stateRef.current.worldZ * orb.speedFactor) % (cw + 100) + (cw + 100)) % (cw + 100) - 50;
        const by = horizonY - orb.y * 0.32 - 4;
        const stretch = stateRef.current.cameraMode === "cinema" ? Math.max(1.2, stateRef.current.currentSpeed * 0.16) : 1.5;

        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = `hsla(${orb.hue}, 95%, 68%, ${orb.alpha})`;
        ctx.roundRect(bx, by, orb.r * stretch, orb.r * 0.55, orb.r);
        ctx.fill();
        ctx.restore();
      });
    };

    // Realistic Bogie & Wheelset
    const drawRealisticBogie = (centerX: number, railY: number) => {
      const wheelRadius = 11.5;
      const wheelY = railY - wheelRadius;
      const axleOffsets = [-24, 24];
      const isBrk = stateRef.current.isBraking;

      // 1. Bolsterless Bogie Frame
      ctx.fillStyle = "#1f1f23";
      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(centerX - 38, wheelY - 8, 76, 11, 3);
      ctx.fill();
      ctx.stroke();

      // Central Suspension Coil Springs
      ctx.fillStyle = "#27272a";
      ctx.fillRect(centerX - 11, wheelY - 11, 22, 13);
      ctx.strokeStyle = "#71717a";
      ctx.lineWidth = 1.2;
      for (let sy = wheelY - 9; sy <= wheelY; sy += 3) {
        ctx.beginPath();
        ctx.moveTo(centerX - 8, sy);
        ctx.lineTo(centerX - 2, sy + 1.5);
        ctx.moveTo(centerX + 2, sy);
        ctx.lineTo(centerX + 8, sy + 1.5);
        ctx.stroke();
      }

      // Wheels
      axleOffsets.forEach((dx) => {
        const wx = centerX + dx;

        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.beginPath();
        ctx.ellipse(wx, railY, 13, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        const wheelGrad = ctx.createRadialGradient(wx - 2, wheelY - 2, 2, wx, wheelY, wheelRadius);
        wheelGrad.addColorStop(0, "#52525b");
        wheelGrad.addColorStop(0.68, "#18181b");
        wheelGrad.addColorStop(0.86, "#d4d4d8");
        wheelGrad.addColorStop(1, "#71717a");
        ctx.fillStyle = wheelGrad;
        ctx.beginPath();
        ctx.arc(wx, wheelY, wheelRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(wx, wheelY);
        ctx.rotate(stateRef.current.wheelRotationAngle);
        ctx.strokeStyle = isBrk ? "#fb923c" : "#71717a";
        ctx.lineWidth = 1.5;
        for (let a = 0; a < 4; a++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(2.5, 0);
          ctx.lineTo(wheelRadius - 3, 0);
          ctx.stroke();
        }
        ctx.restore();

        if (isBrk || stateRef.current.currentSpeed < stateRef.current.targetSpeed - 5) {
          const brkGlow = ctx.createRadialGradient(wx, wheelY, 2, wx, wheelY, 10);
          brkGlow.addColorStop(0, "#fff7ed");
          brkGlow.addColorStop(0.5, "rgba(249, 115, 22, 0.85)");
          brkGlow.addColorStop(1, "rgba(225, 29, 72, 0)");
          ctx.fillStyle = brkGlow;
          ctx.beginPath();
          ctx.arc(wx, wheelY, 10, 0, Math.PI * 2);
          ctx.fill();

          if (stateRef.current.currentSpeed > 15 && Math.random() < 0.35) {
            spawnSpark(wx, railY - 2, 1, true);
          }
        }

        ctx.fillStyle = "#3f3f46";
        ctx.beginPath();
        ctx.roundRect(wx - 5, wheelY - 3.5, 10, 7, 2);
        ctx.fill();
        ctx.fillStyle = "#a1a1aa";
        ctx.beginPath();
        ctx.arc(wx, wheelY, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Yaw Damper
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 18, wheelY - 2);
      ctx.lineTo(centerX + 18, wheelY - 2);
      ctx.stroke();
    };

    // Catenary & Pantograph
    const drawOverheadCatenaryAndPantograph = (pantoX: number, roofY: number, contactWireY: number) => {
      ctx.strokeStyle = "rgba(212, 212, 216, 0.65)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, contactWireY);
      ctx.lineTo(cw, contactWireY);
      ctx.stroke();

      const spanWidth = 260;
      const spanOffset = (stateRef.current.worldZ * 5.2) % spanWidth;
      ctx.strokeStyle = "rgba(161, 161, 170, 0.45)";
      ctx.lineWidth = 1.1;
      for (let sx = -spanOffset - spanWidth; sx < cw + spanWidth; sx += spanWidth) {
        ctx.beginPath();
        ctx.moveTo(sx, contactWireY - 28);
        ctx.quadraticCurveTo(sx + spanWidth * 0.5, contactWireY - 6, sx + spanWidth, contactWireY - 28);
        ctx.stroke();

        for (let d = 0.2; d <= 0.8; d += 0.2) {
          const dx = sx + spanWidth * d;
          const sagY = contactWireY - 28 + Math.sin(d * Math.PI) * 18;
          ctx.beginPath();
          ctx.moveTo(dx, sagY);
          ctx.lineTo(dx, contactWireY);
          ctx.stroke();
        }
      }

      // Ceramic insulators
      ctx.fillStyle = "#7f1d1d";
      ctx.fillRect(pantoX - 14, roofY - 5, 5, 5);
      ctx.fillRect(pantoX + 9, roofY - 5, 5, 5);

      // Pantograph base
      ctx.fillStyle = "#52525b";
      ctx.fillRect(pantoX - 16, roofY - 7, 32, 3);

      const kneeX = pantoX - 18;
      const kneeY = (roofY - 7 + contactWireY) * 0.52;
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(pantoX + 4, roofY - 7);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(pantoX, contactWireY + 2);
      ctx.stroke();

      ctx.strokeStyle = "#a1a1aa";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pantoX - 4, roofY - 7);
      ctx.lineTo(kneeX + 4, kneeY - 2);
      ctx.lineTo(pantoX - 2, contactWireY + 2);
      ctx.stroke();

      ctx.strokeStyle = "#e4e4e7";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pantoX - 11, contactWireY + 1);
      ctx.lineTo(pantoX + 11, contactWireY + 1);
      ctx.stroke();

      if ((stateRef.current.currentSpeed > 35 && Math.random() < 0.06) || stateRef.current.arcFlashIntensity > 0.1) {
        if (stateRef.current.arcFlashIntensity < 0.3) stateRef.current.arcFlashIntensity = 0.65;
        spawnSpark(pantoX, contactWireY + 1, 2, false);
      }

      if (stateRef.current.arcFlashIntensity > 0.05) {
        const arcGrad = ctx.createRadialGradient(
          pantoX,
          contactWireY,
          1,
          pantoX,
          contactWireY,
          44 * stateRef.current.arcFlashIntensity
        );
        arcGrad.addColorStop(0, "#ffffff");
        arcGrad.addColorStop(0.3, "#fef08a");
        arcGrad.addColorStop(0.65, "rgba(245, 158, 11, 0.45)");
        arcGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
        ctx.fillStyle = arcGrad;
        ctx.beginPath();
        ctx.arc(pantoX, contactWireY, 44 * stateRef.current.arcFlashIntensity, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Passenger Windows
    const drawPassengerWindows = (startX: number, endX: number, winY: number) => {
      const winW = 42;
      const winH = 21;
      const gap = 8;
      const reflectPos = (stateRef.current.worldZ * 7.5) % 220;

      for (let wx = startX; wx + winW <= endX; wx += winW + gap) {
        const intGrad = ctx.createLinearGradient(wx, winY, wx, winY + winH);
        intGrad.addColorStop(0, "#fef3c7");
        intGrad.addColorStop(0.45, "#fde68a");
        intGrad.addColorStop(1, "#78350f");
        ctx.fillStyle = intGrad;
        ctx.beginPath();
        ctx.roundRect(wx, winY, winW, winH, 3.5);
        ctx.fill();

        // Seats & Headrests
        for (let sx = wx + 6; sx < wx + winW - 5; sx += 12) {
          ctx.fillStyle = "#451a03";
          ctx.beginPath();
          ctx.roundRect(sx, winY + 9, 7, 12, 1.5);
          ctx.fill();

          ctx.fillStyle = "#fef3c7";
          ctx.fillRect(sx + 1, winY + 9, 5, 2.5);

          if (Math.floor(sx) % 24 < 12) {
            ctx.fillStyle = "#1c1917";
            ctx.beginPath();
            ctx.arc(sx + 3.5, winY + 6.5, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.fillStyle = "rgba(9, 9, 11, 0.26)";
        ctx.beginPath();
        ctx.roundRect(wx, winY, winW, winH, 3.5);
        ctx.fill();

        // Specular reflection
        const localRef = ((wx - reflectPos) % 180 + 180) % 180;
        if (localRef < 45) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(wx, winY, winW, winH, 3.5);
          ctx.clip();
          ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
          ctx.beginPath();
          ctx.moveTo(wx + localRef - 12, winY);
          ctx.lineTo(wx + localRef + 4, winY);
          ctx.lineTo(wx + localRef - 8, winY + winH);
          ctx.lineTo(wx + localRef - 24, winY + winH);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(wx, winY, winW, winH, 3.5);
        ctx.stroke();
      }
    };

    const drawDestinationBoard = (x: number, y: number, text: string) => {
      ctx.fillStyle = "#09090b";
      ctx.fillRect(x, y, 92, 6.5);
      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x, y, 92, 6.5);

      ctx.fillStyle = "#fbbf24";
      ctx.font = 'bold 4.8px "JetBrains Mono", monospace';
      ctx.fillText(text.substring(0, 26), x + 3, y + 4.8);
    };

    const drawAutomaticPlugDoor = (x: number, y: number, h: number) => {
      ctx.fillStyle = "rgba(9, 9, 11, 0.18)";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.65)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.roundRect(x, y, 21, h, 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#18181b";
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 6, 13, 19, 2);
      ctx.fill();
      ctx.strokeStyle = "#a1a1aa";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(x + 10.5, y + 2.8, 1.3, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawHeadlightCone = (hlX: number, hlY: number, railY: number) => {
      const coneGrad = ctx.createLinearGradient(hlX, hlY, cw + 60, hlY + 20);
      coneGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
      coneGrad.addColorStop(0.18, "rgba(254, 240, 138, 0.48)");
      coneGrad.addColorStop(0.65, "rgba(245, 158, 11, 0.14)");
      coneGrad.addColorStop(1, "rgba(245, 158, 11, 0)");

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(hlX, hlY - 3);
      ctx.lineTo(cw + 80, hlY - 58);
      ctx.lineTo(cw + 80, railY + 8);
      ctx.lineTo(hlX, hlY + 5);
      ctx.closePath();
      ctx.fill();
    };

    const drawVandeCoachBody = (
      x1: number,
      x2: number,
      bodyTop: number,
      bodyBottom: number,
      topCol: string,
      midCol: string,
      darkCol: string,
      skirtCol: string,
      stripeCol: string,
      isLHB: boolean,
      bText: string
    ) => {
      const width = x2 - x1;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x1, bodyTop, width, bodyBottom - bodyTop, 3);
      ctx.clip();

      const grad = ctx.createLinearGradient(0, bodyTop, 0, bodyBottom);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.14, "#d4d4d8");
      grad.addColorStop(0.22, topCol);
      grad.addColorStop(0.66, midCol);
      grad.addColorStop(0.75, darkCol);
      grad.addColorStop(0.76, skirtCol);
      grad.addColorStop(1, "#09090b");
      ctx.fillStyle = grad;
      ctx.fillRect(x1, bodyTop, width, bodyBottom - bodyTop);

      ctx.fillStyle = stripeCol;
      ctx.fillRect(x1, bodyBottom - 21, width, 3);

      if (!isLHB) {
        ctx.fillStyle = "#09090b";
        ctx.fillRect(x1 + 34, bodyTop + 23, width - 68, 28);
      }

      drawAutomaticPlugDoor(x1 + 8, bodyTop + 18, bodyBottom - 21);
      drawAutomaticPlugDoor(x2 - 30, bodyTop + 18, bodyBottom - 21);

      drawPassengerWindows(x1 + 40, x2 - 38, bodyTop + 26);
      drawDestinationBoard(x1 + 42, bodyTop + 15, bText);

      ctx.restore();
    };

    // Vande Bharat Rake (Saffron 2.0 or Pearl White)
    const drawVandeBharatRake = (railY: number, swayY: number, isPearlWhite: boolean) => {
      const bodyTop = railY - 108 + swayY;
      const bodyBottom = railY - 19 + swayY;
      const noseTipX = cw < 600 ? cw - 20 : Math.min(cw - 45, Math.max(580, cw * 0.86));
      const cabStartX = noseTipX - 310;
      const trailStartX = cabStartX - 335;

      const mainLiveryTop = isPearlWhite ? "#ffffff" : "#fb923c";
      const mainLiveryMid = isPearlWhite ? "#f4f4f5" : "#ea580c";
      const mainLiveryDark = isPearlWhite ? "#d4d4d8" : "#c2410c";
      const skirtColor = isPearlWhite ? "#27272a" : "#1f242d";
      const stripeAccent = isPearlWhite ? "#e11d48" : "#ffffff";
      const bText = stateRef.current.boardText;

      drawRealisticBogie(trailStartX + 62, railY);
      drawRealisticBogie(trailStartX + 265, railY);
      drawRealisticBogie(cabStartX + 62, railY);
      drawRealisticBogie(cabStartX + 218, railY);

      [trailStartX + 115, cabStartX + 108].forEach((ux) => {
        ctx.fillStyle = "#18181b";
        ctx.strokeStyle = "#3f3f46";
        ctx.lineWidth = 1;
        ctx.fillRect(ux, bodyBottom - 4, 88, 11);
        ctx.strokeRect(ux, bodyBottom - 4, 88, 11);
        ctx.fillStyle = "#27272a";
        ctx.fillRect(ux + 8, bodyBottom - 2, 26, 7);
        ctx.fillRect(ux + 44, bodyBottom - 2, 34, 7);
      });

      // Gangway
      const gangwayX = cabStartX - 14;
      ctx.fillStyle = "#09090b";
      ctx.fillRect(gangwayX, bodyTop + 4, 15, bodyBottom - bodyTop - 6);
      ctx.strokeStyle = "#27272a";
      ctx.lineWidth = 1.5;
      for (let gx = gangwayX + 3; gx < gangwayX + 14; gx += 3.5) {
        ctx.beginPath();
        ctx.moveTo(gx, bodyTop + 4);
        ctx.lineTo(gx, bodyBottom - 3);
        ctx.stroke();
      }

      // Trailing coach
      drawVandeCoachBody(
        trailStartX,
        cabStartX - 13,
        bodyTop,
        bodyBottom,
        mainLiveryTop,
        mainLiveryMid,
        mainLiveryDark,
        skirtColor,
        stripeAccent,
        false,
        bText
      );

      // Driving cab
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cabStartX, bodyTop);
      ctx.lineTo(noseTipX - 155, bodyTop);
      ctx.bezierCurveTo(noseTipX - 95, bodyTop, noseTipX - 42, bodyTop + 34, noseTipX - 6, bodyBottom - 26);
      ctx.bezierCurveTo(noseTipX + 5, bodyBottom - 18, noseTipX + 2, bodyBottom - 6, noseTipX - 18, bodyBottom);
      ctx.lineTo(cabStartX, bodyBottom);
      ctx.closePath();

      const cabGrad = ctx.createLinearGradient(0, bodyTop, 0, bodyBottom);
      cabGrad.addColorStop(0, "#ffffff");
      cabGrad.addColorStop(0.14, "#e4e4e7");
      cabGrad.addColorStop(0.22, mainLiveryTop);
      cabGrad.addColorStop(0.66, mainLiveryMid);
      cabGrad.addColorStop(0.75, mainLiveryDark);
      cabGrad.addColorStop(0.76, skirtColor);
      cabGrad.addColorStop(1, "#09090b");
      ctx.fillStyle = cabGrad;
      ctx.fill();
      ctx.clip();

      ctx.fillStyle = skirtColor;
      ctx.beginPath();
      ctx.moveTo(cabStartX, bodyBottom - 20);
      ctx.lineTo(noseTipX - 90, bodyBottom - 20);
      ctx.lineTo(noseTipX + 5, bodyBottom - 8);
      ctx.lineTo(noseTipX + 5, bodyBottom + 5);
      ctx.lineTo(cabStartX, bodyBottom + 5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = stripeAccent;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(cabStartX, bodyBottom - 20);
      ctx.lineTo(noseTipX - 88, bodyBottom - 20);
      ctx.lineTo(noseTipX - 12, bodyBottom - 11);
      ctx.stroke();

      const nose3DGrad = ctx.createLinearGradient(noseTipX - 95, bodyTop + 10, noseTipX, bodyBottom - 15);
      nose3DGrad.addColorStop(0, "rgba(255, 255, 255, 0.55)");
      nose3DGrad.addColorStop(0.5, "rgba(254, 243, 199, 0.22)");
      nose3DGrad.addColorStop(1, "rgba(0, 0, 0, 0.35)");
      ctx.fillStyle = nose3DGrad;
      ctx.beginPath();
      ctx.moveTo(noseTipX - 140, bodyTop);
      ctx.bezierCurveTo(noseTipX - 85, bodyTop + 4, noseTipX - 36, bodyTop + 34, noseTipX - 4, bodyBottom - 24);
      ctx.lineTo(noseTipX - 32, bodyBottom - 22);
      ctx.quadraticCurveTo(noseTipX - 68, bodyTop + 36, noseTipX - 140, bodyTop + 14);
      ctx.closePath();
      ctx.fill();

      // Window band & visor
      ctx.fillStyle = "#09090b";
      ctx.beginPath();
      ctx.moveTo(cabStartX + 34, bodyTop + 23);
      ctx.lineTo(noseTipX - 118, bodyTop + 23);
      ctx.bezierCurveTo(noseTipX - 75, bodyTop + 23, noseTipX - 42, bodyTop + 36, noseTipX - 24, bodyTop + 53);
      ctx.lineTo(noseTipX - 82, bodyTop + 55);
      ctx.lineTo(cabStartX + 34, bodyTop + 51);
      ctx.closePath();
      ctx.fill();

      // Windshield
      const windshieldGrad = ctx.createLinearGradient(noseTipX - 105, bodyTop + 18, noseTipX - 28, bodyTop + 52);
      windshieldGrad.addColorStop(0, "#18181b");
      windshieldGrad.addColorStop(0.45, "#27272a");
      windshieldGrad.addColorStop(0.75, "#52525b");
      windshieldGrad.addColorStop(1, "#09090b");
      ctx.fillStyle = windshieldGrad;
      ctx.beginPath();
      ctx.moveTo(noseTipX - 102, bodyTop + 19);
      ctx.bezierCurveTo(noseTipX - 68, bodyTop + 21, noseTipX - 38, bodyTop + 36, noseTipX - 24, bodyTop + 51);
      ctx.lineTo(noseTipX - 62, bodyTop + 52);
      ctx.quadraticCurveTo(noseTipX - 78, bodyTop + 35, noseTipX - 102, bodyTop + 19);
      ctx.closePath();
      ctx.fill();

      // Wipers
      ctx.strokeStyle = "#a1a1aa";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(noseTipX - 45, bodyTop + 49);
      ctx.lineTo(noseTipX - 68, bodyTop + 29);
      ctx.moveTo(noseTipX - 34, bodyTop + 48);
      ctx.lineTo(noseTipX - 54, bodyTop + 28);
      ctx.stroke();

      // Driver Silhouette
      ctx.fillStyle = "#1e1b18";
      ctx.beginPath();
      ctx.roundRect(noseTipX - 122, bodyTop + 26, 36, 22, 4);
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(noseTipX - 96, bodyTop + 38, 6, 4);
      ctx.fillStyle = "#09090b";
      ctx.beginPath();
      ctx.arc(noseTipX - 106, bodyTop + 35, 4.5, 0, Math.PI * 2);
      ctx.fill();

      drawPassengerWindows(cabStartX + 42, noseTipX - 135, bodyTop + 26);
      drawDestinationBoard(cabStartX + 42, bodyTop + 15, bText);
      drawAutomaticPlugDoor(cabStartX + 8, bodyTop + 18, bodyBottom - 21);

      // Tri-Element Headlight
      const hlX = noseTipX - 22;
      const hlY = bodyBottom - 30;
      ctx.fillStyle = "#09090b";
      ctx.beginPath();
      ctx.ellipse(hlX, hlY, 11, 5.5, 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e4e4e7";
      ctx.lineWidth = 1;
      ctx.stroke();

      [-5, 0, 5].forEach((lx) => {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(hlX + lx, hlY + lx * 0.25, 2.1, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.arc(hlX - 8, hlY - 1, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Roof pods & pantograph
      ctx.fillStyle = "#a1a1aa";
      ctx.beginPath();
      ctx.roundRect(cabStartX + 95, bodyTop - 4, 72, 4, 2);
      ctx.roundRect(trailStartX + 110, bodyTop - 4, 72, 4, 2);
      ctx.fill();

      drawOverheadCatenaryAndPantograph(trailStartX + 235, bodyTop, bodyTop - 44 - swayY);
      drawHeadlightCone(noseTipX - 14, bodyBottom - 29, railY);
    };

    // WAP-7 + LHB Coaches
    const drawWAP7AndLHBCoaches = (railY: number, swayY: number) => {
      const bodyTop = railY - 110 + swayY;
      const bodyBottom = railY - 20 + swayY;
      const locoFrontX = cw < 600 ? cw - 25 : Math.min(cw - 55, Math.max(580, cw * 0.85));
      const locoRearX = locoFrontX - 245;
      const lhbStartX = locoRearX - 360;
      const bText = stateRef.current.boardText;

      drawRealisticBogie(lhbStartX + 58, railY);
      drawRealisticBogie(lhbStartX + 285, railY);
      drawRealisticBogie(locoRearX + 52, railY);
      drawRealisticBogie(locoFrontX - 62, railY);

      ctx.fillStyle = "#18181b";
      ctx.fillRect(locoRearX + 92, bodyBottom - 3, 62, 13);

      drawVandeCoachBody(
        lhbStartX,
        locoRearX - 12,
        bodyTop + 2,
        bodyBottom,
        "#e11d48",
        "#be123c",
        "#881337",
        "#d4d4d8",
        "#ffffff",
        true,
        bText
      );

      ctx.fillStyle = "#27272a";
      ctx.fillRect(locoRearX - 12, bodyBottom - 14, 12, 8);

      // WAP-7 Loco Body
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(locoRearX, bodyTop);
      ctx.lineTo(locoFrontX - 14, bodyTop);
      ctx.lineTo(locoFrontX, bodyTop + 34);
      ctx.lineTo(locoFrontX, bodyBottom);
      ctx.lineTo(locoRearX, bodyBottom);
      ctx.closePath();

      const wapGrad = ctx.createLinearGradient(0, bodyTop, 0, bodyBottom);
      wapGrad.addColorStop(0, "#d4d4d8");
      wapGrad.addColorStop(0.14, "#ffffff");
      wapGrad.addColorStop(0.56, "#f4f4f5");
      wapGrad.addColorStop(0.57, "#dc2626");
      wapGrad.addColorStop(0.74, "#b91c1c");
      wapGrad.addColorStop(0.75, "#3f3f46");
      wapGrad.addColorStop(1, "#18181b");
      ctx.fillStyle = wapGrad;
      ctx.fill();
      ctx.clip();

      ctx.fillStyle = "#e4e4e7";
      ctx.fillRect(locoFrontX - 24, bodyTop, 24, bodyBottom - bodyTop);
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(locoFrontX - 24, bodyTop + 50, 24, 16);

      ctx.fillStyle = "#09090b";
      ctx.fillRect(locoFrontX - 21, bodyTop + 20, 9, 16);
      ctx.fillRect(locoFrontX - 10, bodyTop + 20, 8, 16);

      ctx.fillStyle = "#18181b";
      ctx.fillRect(locoFrontX - 52, bodyTop + 20, 20, 18);
      ctx.fillRect(locoRearX + 18, bodyTop + 20, 20, 18);

      ctx.fillStyle = "#52525b";
      for (let lx = locoRearX + 52; lx < locoFrontX - 68; lx += 28) {
        ctx.fillRect(lx, bodyTop + 22, 20, 14);
        ctx.strokeStyle = "#27272a";
        ctx.lineWidth = 1;
        for (let ly = bodyTop + 24; ly < bodyTop + 35; ly += 3) {
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + 20, ly);
          ctx.stroke();
        }
      }

      ctx.fillStyle = "#fef08a";
      ctx.font = 'bold 6.5px "JetBrains Mono", monospace';
      ctx.fillText("WAP-7 • 30294", locoRearX + 88, bodyTop + 61);

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(locoFrontX - 6, bodyBottom - 26, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(locoFrontX - 14, bodyTop + 10, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Cowcatcher
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.moveTo(locoFrontX - 18, bodyBottom);
      ctx.lineTo(locoFrontX + 6, bodyBottom);
      ctx.lineTo(locoFrontX + 14, railY - 4);
      ctx.lineTo(locoFrontX - 18, railY - 4);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(locoFrontX - 8, bodyBottom + 2);
      ctx.lineTo(locoFrontX, railY - 4);
      ctx.moveTo(locoFrontX, bodyBottom + 2);
      ctx.lineTo(locoFrontX + 8, railY - 4);
      ctx.stroke();

      drawOverheadCatenaryAndPantograph(locoRearX + 55, bodyTop, bodyTop - 42 - swayY);
      drawHeadlightCone(locoFrontX - 4, bodyBottom - 26, railY);
    };

    // Camera Mode 1: Cinema
    const renderCinemaPan = (dt: number) => {
      const horizonY = ch * 0.56;
      const railY = ch - 38;
      drawSkyAndAtmosphere(horizonY);

      const ballastGrad = ctx.createLinearGradient(0, horizonY, 0, ch);
      ballastGrad.addColorStop(0, "#161316");
      ballastGrad.addColorStop(0.55, "#1d191c");
      ballastGrad.addColorStop(1, "#09080a");
      ctx.fillStyle = ballastGrad;
      ctx.fillRect(0, horizonY, cw, ch - horizonY);

      const sleeperSpacing = 28;
      const tieOffset = (stateRef.current.worldZ * 5.2) % sleeperSpacing;
      for (let x = -tieOffset; x < cw + sleeperSpacing; x += sleeperSpacing) {
        ctx.fillStyle = "#3f3f46";
        ctx.fillRect(x, railY + 2, 16, 6);
        ctx.fillStyle = "#18181b";
        ctx.fillRect(x + 4, railY, 8, 3);
      }

      const speckOffset = (stateRef.current.worldZ * 5.2) % 44;
      ctx.fillStyle = "rgba(161, 161, 170, 0.25)";
      for (let x = -speckOffset; x < cw; x += 22) {
        ctx.fillRect(x, railY + 10, 3, 2);
        ctx.fillRect(x + 11, railY + 16, 4, 2);
      }

      const railGrad = ctx.createLinearGradient(0, railY - 3, cw, railY - 3);
      railGrad.addColorStop(0, "#71717a");
      railGrad.addColorStop(0.75, "#d4d4d8");
      railGrad.addColorStop(1, "#fef08a");
      ctx.fillStyle = railGrad;
      ctx.fillRect(0, railY - 3, cw, 3.5);
      ctx.fillStyle = "#27272a";
      ctx.fillRect(0, railY + 0.5, cw, 2.5);

      const speedRatio = Math.min(1.2, stateRef.current.currentSpeed / 130);
      const swayY = (Math.sin(stateRef.current.worldZ * 0.065) * 1.1 + Math.cos(stateRef.current.worldZ * 0.22) * 0.35) * speedRatio;

      if (stateRef.current.rakeModel === "wap7-lhb") {
        drawWAP7AndLHBCoaches(railY, swayY);
      } else if (stateRef.current.rakeModel === "vb-white") {
        drawVandeBharatRake(railY, swayY, true);
      } else {
        drawVandeBharatRake(railY, swayY, false);
      }

      // Render sparks
      for (let i = sparksList.length - 1; i >= 0; i--) {
        const sp = sparksList[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.18;
        sp.life -= dt * 2.6;
        if (sp.life <= 0) {
          sparksList.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = sp.color;
        ctx.globalAlpha = Math.max(0, sp.life);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(sp.x - sp.vx * 1.8, sp.y - sp.vy * 1.8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Trackside posts
      const kmPostX = cw - ((stateRef.current.worldZ * 5.2) % (cw + 650));
      if (kmPostX > -60 && kmPostX < cw + 60) {
        ctx.fillStyle = "#facc15";
        ctx.fillRect(kmPostX, railY - 26, 22, 14);
        ctx.fillStyle = "#18181b";
        ctx.fillRect(kmPostX + 8, railY - 12, 6, 14);
        ctx.font = 'bold 6px "JetBrains Mono", monospace';
        ctx.fillText("248/4", kmPostX + 2, railY - 17);
      }

      const mastX = cw - ((stateRef.current.worldZ * 8.8) % (cw + 480));
      if (mastX > -80 && mastX < cw + 80) {
        const blurGrad = ctx.createLinearGradient(mastX - 18, 0, mastX + 18, 0);
        blurGrad.addColorStop(0, "rgba(24, 24, 27, 0)");
        blurGrad.addColorStop(0.5, "rgba(63, 63, 70, 0.72)");
        blurGrad.addColorStop(1, "rgba(24, 24, 27, 0)");
        ctx.fillStyle = blurGrad;
        ctx.fillRect(mastX - 18, 0, 36, ch);
      }
    };

    // Camera Mode 2: 3D Chase
    const draw3DPerspectiveTrain = (camX: number, camY: number, fov: number, vpX: number, vpY: number) => {
      const swayY = Math.sin(stateRef.current.worldZ * 0.04) * 0.6;
      const mainColor =
        stateRef.current.rakeModel === "vb-white"
          ? "#f4f4f5"
          : stateRef.current.rakeModel === "wap7-lhb"
          ? "#dc2626"
          : "#ea580c";
      const zFrontCab = 92;
      const zNoseTip = 62;
      const zTail = 420;

      const flB = project3D(-22, 7 + swayY, zFrontCab, camX, camY, fov, vpX, vpY);
      const flT = project3D(-19, 56 + swayY, zFrontCab, camX, camY, fov, vpX, vpY);
      const frT = project3D(19, 56 + swayY, zFrontCab, camX, camY, fov, vpX, vpY);
      const rlB = project3D(-22, 7, zTail, camX, camY, fov, vpX, vpY);
      const rlT = project3D(-19, 56, zTail, camX, camY, fov, vpX, vpY);
      const rrT = project3D(19, 56, zTail, camX, camY, fov, vpX, vpY);
      const noseTip = project3D(0, 14 + swayY, zNoseTip, camX, camY, fov, vpX, vpY);

      const sideGrad = ctx.createLinearGradient(flT.x, flT.y, flB.x, flB.y);
      sideGrad.addColorStop(0, "#ffffff");
      sideGrad.addColorStop(0.25, mainColor);
      sideGrad.addColorStop(0.75, mainColor);
      sideGrad.addColorStop(0.78, "#27272a");
      sideGrad.addColorStop(1, "#09090b");
      ctx.fillStyle = sideGrad;
      ctx.beginPath();
      ctx.moveTo(rlT.x, rlT.y);
      ctx.lineTo(flT.x, flT.y);
      ctx.lineTo(flB.x, flB.y);
      ctx.lineTo(rlB.x, rlB.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#d4d4d8";
      ctx.beginPath();
      ctx.moveTo(rlT.x, rlT.y);
      ctx.lineTo(rrT.x, rrT.y);
      ctx.lineTo(frT.x, frT.y);
      ctx.lineTo(flT.x, flT.y);
      ctx.closePath();
      ctx.fill();

      for (let wz = zFrontCab + 14; wz < zTail - 16; wz += 18) {
        const w1 = project3D(-21.5, 42 + swayY, wz, camX, camY, fov, vpX, vpY);
        const w2 = project3D(-21.5, 42 + swayY, wz + 12, camX, camY, fov, vpX, vpY);
        const w3 = project3D(-21.5, 28 + swayY, wz + 12, camX, camY, fov, vpX, vpY);
        const w4 = project3D(-21.5, 28 + swayY, wz, camX, camY, fov, vpX, vpY);
        ctx.fillStyle = "#fde68a";
        ctx.beginPath();
        ctx.moveTo(w1.x, w1.y);
        ctx.lineTo(w2.x, w2.y);
        ctx.lineTo(w3.x, w3.y);
        ctx.lineTo(w4.x, w4.y);
        ctx.closePath();
        ctx.fill();
      }

      const slices = 20;
      for (let i = 0; i < slices; i++) {
        const t1 = i / slices;
        const t2 = (i + 1) / slices;
        const z1 = zFrontCab - t1 * (zFrontCab - zNoseTip);
        const z2 = zFrontCab - t2 * (zFrontCab - zNoseTip);

        const w1 = 22 * Math.cos(t1 * Math.PI * 0.46);
        const w2 = 22 * Math.cos(t2 * Math.PI * 0.46);
        const h1 = 56 - Math.pow(t1, 1.55) * 40;
        const h2 = 56 - Math.pow(t2, 1.55) * 40;

        const p1L = project3D(-w1, 7 + swayY, z1, camX, camY, fov, vpX, vpY);
        const p1T = project3D(0, h1 + swayY, z1, camX, camY, fov, vpX, vpY);
        const p1R = project3D(w1, 7 + swayY, z1, camX, camY, fov, vpX, vpY);
        const p2L = project3D(-w2, 7 + swayY, z2, camX, camY, fov, vpX, vpY);
        const p2T = project3D(0, h2 + swayY, z2, camX, camY, fov, vpX, vpY);
        const p2R = project3D(w2, 7 + swayY, z2, camX, camY, fov, vpX, vpY);

        const isVisor = i >= 4 && i <= 10;
        ctx.fillStyle = isVisor ? "#09090b" : i > 14 ? "#27272a" : mainColor;
        ctx.beginPath();
        ctx.moveTo(p1L.x, p1L.y);
        ctx.quadraticCurveTo(p1T.x, p1T.y - 8 * p1T.scale, p1R.x, p1R.y);
        ctx.lineTo(p2R.x, p2R.y);
        ctx.quadraticCurveTo(p2T.x, p2T.y - 8 * p2T.scale, p2L.x, p2L.y);
        ctx.closePath();
        ctx.fill();
      }

      const hlLeft = project3D(-11, 19 + swayY, zNoseTip + 5, camX, camY, fov, vpX, vpY);
      const hlRight = project3D(11, 19 + swayY, zNoseTip + 5, camX, camY, fov, vpX, vpY);
      const beamL = project3D(-45, 0, 12, camX, camY, fov, vpX, vpY);
      const beamR = project3D(65, 0, 12, camX, camY, fov, vpX, vpY);

      const coneGrad = ctx.createLinearGradient(noseTip.x, noseTip.y, (beamL.x + beamR.x) * 0.5, ch);
      coneGrad.addColorStop(0, "rgba(254, 243, 199, 0.55)");
      coneGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.16)");
      coneGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(hlLeft.x, hlLeft.y);
      ctx.lineTo(hlRight.x, hlRight.y);
      ctx.lineTo(beamR.x, beamR.y);
      ctx.lineTo(beamL.x, beamL.y);
      ctx.closePath();
      ctx.fill();

      [hlLeft, hlRight].forEach((hl) => {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(hl.x, hl.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const renderChaseCam = () => {
      const shakeX = stateRef.current.currentSpeed > 135 ? (Math.random() - 0.5) * 0.9 : 0;
      const shakeY = stateRef.current.currentSpeed > 135 ? (Math.random() - 0.5) * 0.7 : 0;
      const vpX = cw * 0.28 + shakeX;
      const vpY = ch * 0.42 + shakeY;
      const fov = 310;
      const camX = -88;
      const camY = 58;

      drawSkyAndAtmosphere(vpY);

      const groundGrad = ctx.createLinearGradient(0, vpY, 0, ch);
      groundGrad.addColorStop(0, "#141113");
      groundGrad.addColorStop(0.4, "#0e0c0e");
      groundGrad.addColorStop(1, "#070608");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, vpY, cw, ch - vpY);

      const sleeperSpacing = 18;
      const zOffset = stateRef.current.worldZ % sleeperSpacing;
      for (let z = 520 - zOffset; z >= 14; z -= sleeperSpacing) {
        const fade = Math.min(1, Math.max(0, (520 - z) / 380));
        const p1 = project3D(-28, 0, z, camX, camY, fov, vpX, vpY);
        const p2 = project3D(28, 0, z, camX, camY, fov, vpX, vpY);
        ctx.strokeStyle = `rgba(92, 85, 88, ${fade * 0.75})`;
        ctx.lineWidth = Math.max(1, 3.6 * p1.scale);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const a1 = project3D(-135, 0, z, camX, camY, fov, vpX, vpY);
        const a2 = project3D(-85, 0, z, camX, camY, fov, vpX, vpY);
        ctx.strokeStyle = `rgba(63, 58, 60, ${fade * 0.55})`;
        ctx.beginPath();
        ctx.moveTo(a1.x, a1.y);
        ctx.lineTo(a2.x, a2.y);
        ctx.stroke();
      }

      [-124, -96, -18, 18].forEach((rx, idx) => {
        const near = project3D(rx, 0, 8, camX, camY, fov, vpX, vpY);
        const far = project3D(rx, 0, 600, camX, camY, fov, vpX, vpY);
        ctx.strokeStyle = idx >= 2 ? "#fde047" : "rgba(161, 161, 170, 0.55)";
        ctx.lineWidth = idx >= 2 ? 2.6 : 1.6;
        ctx.beginPath();
        ctx.moveTo(far.x, far.y);
        ctx.lineTo(near.x, near.y);
        ctx.stroke();
      });

      draw3DPerspectiveTrain(camX, camY, fov, vpX, vpY);

      const portalSpacing = 125;
      const pOffset = stateRef.current.worldZ % portalSpacing;
      for (let z = 600 - pOffset; z >= 12; z -= portalSpacing) {
        const alpha = Math.min(1, (600 - z) / 250);
        const baseL = project3D(-155, 0, z, camX, camY, fov, vpX, vpY);
        const topL = project3D(-155, 108, z, camX, camY, fov, vpX, vpY);
        const baseR = project3D(52, 0, z, camX, camY, fov, vpX, vpY);
        const topR = project3D(52, 108, z, camX, camY, fov, vpX, vpY);

        ctx.strokeStyle = `rgba(113, 113, 122, ${alpha * 0.75})`;
        ctx.lineWidth = Math.max(1.2, 4.5 * baseL.scale);
        ctx.beginPath();
        ctx.moveTo(baseL.x, baseL.y);
        ctx.lineTo(topL.x, topL.y);
        ctx.lineTo(topR.x, topR.y);
        ctx.lineTo(baseR.x, baseR.y);
        ctx.stroke();

        if (Math.abs(z - 98) < 9 && stateRef.current.currentSpeed > 25) {
          stateRef.current.arcFlashIntensity = 0.9;
        }
      }
    };

    // Camera Mode 3: Cockpit POV
    const renderCockpitPOV = () => {
      const vpX = cw * 0.5;
      const vpY = ch * 0.44;
      const fov = 310;
      const camX = 0;
      const camY = 48;

      drawSkyAndAtmosphere(vpY);

      ctx.fillStyle = "#0c0a0c";
      ctx.fillRect(0, vpY, cw, ch - vpY);

      const sleeperSpacing = 16;
      const zOffset = stateRef.current.worldZ % sleeperSpacing;
      for (let z = 500 - zOffset; z >= 10; z -= sleeperSpacing) {
        const p1 = project3D(-28, 0, z, camX, camY, fov, vpX, vpY);
        const p2 = project3D(28, 0, z, camX, camY, fov, vpX, vpY);
        const alpha = Math.min(1, (500 - z) / 350);
        ctx.strokeStyle = `rgba(113, 113, 122, ${alpha * 0.7})`;
        ctx.lineWidth = Math.max(1, 3.5 * p1.scale);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      [-18, 18].forEach((rx) => {
        const near = project3D(rx, 0, 6, camX, camY, fov, vpX, vpY);
        const far = project3D(rx, 0, 550, camX, camY, fov, vpX, vpY);
        ctx.strokeStyle = "#fde047";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(far.x, far.y);
        ctx.lineTo(near.x, near.y);
        ctx.stroke();
      });

      const portalSpacing = 110;
      const pOffset = stateRef.current.worldZ % portalSpacing;
      for (let z = 550 - pOffset; z >= 10; z -= portalSpacing) {
        const bL = project3D(-65, 0, z, camX, camY, fov, vpX, vpY);
        const tL = project3D(-65, 95, z, camX, camY, fov, vpX, vpY);
        const bR = project3D(65, 0, z, camX, camY, fov, vpX, vpY);
        const tR = project3D(65, 95, z, camX, camY, fov, vpX, vpY);
        ctx.strokeStyle = "rgba(161, 161, 170, 0.55)";
        ctx.lineWidth = Math.max(1, 4 * bL.scale);
        ctx.beginPath();
        ctx.moveTo(bL.x, bL.y);
        ctx.lineTo(tL.x, tL.y);
        ctx.lineTo(tR.x, tR.y);
        ctx.lineTo(bR.x, bR.y);
        ctx.stroke();
      }

      ctx.fillStyle = "#09090b";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cw * 0.12, 0);
      ctx.lineTo(cw * 0.05, ch);
      ctx.lineTo(0, ch);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cw, 0);
      ctx.lineTo(cw * 0.88, 0);
      ctx.lineTo(cw * 0.95, ch);
      ctx.lineTo(cw, ch);
      ctx.fill();

      const wiperAngle = stateRef.current.weatherMode === "rain" ? Math.sin(stateRef.current.worldZ * 0.08) * 0.55 : -0.45;
      ctx.save();
      ctx.translate(cw * 0.5, ch - 68);
      ctx.rotate(wiperAngle);
      ctx.strokeStyle = "#18181b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -165);
      ctx.stroke();
      ctx.restore();

      const deskY = ch - 72;
      const deskGrad = ctx.createLinearGradient(0, deskY, 0, ch);
      deskGrad.addColorStop(0, "#27272a");
      deskGrad.addColorStop(0.2, "#18181b");
      deskGrad.addColorStop(1, "#09090b");
      ctx.fillStyle = deskGrad;
      ctx.beginPath();
      ctx.moveTo(cw * 0.04, ch);
      ctx.lineTo(cw * 0.14, deskY);
      ctx.lineTo(cw * 0.86, deskY);
      ctx.lineTo(cw * 0.96, ch);
      ctx.closePath();
      ctx.fill();

      const scrX = cw * 0.5 - 75;
      const scrY = deskY + 10;
      ctx.fillStyle = "#09090b";
      ctx.strokeStyle = "#52525b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(scrX, scrY, 150, 52, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fbbf24";
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText(`${Math.round(stateRef.current.currentSpeed)} KM/H`, scrX + 14, scrY + 25);
      ctx.fillStyle = "#a1a1aa";
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText("KAVACH SIL-4 • ASPECT CLEAR", scrX + 14, scrY + 41);
    };

    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = 0;

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // FPS tracking
      frameCount++;
      fpsTimer += dt;
      if (fpsTimer >= 0.5) {
        const fps = Math.min(60, Math.round(frameCount / fpsTimer));
        if (onFpsUpdate) onFpsUpdate(fps);
        frameCount = 0;
        fpsTimer = 0;
      }

      // Physics acceleration / braking
      const st = stateRef.current;
      const accelRate = st.isBraking ? 44 : 28;
      if (Math.abs(st.currentSpeed - st.targetSpeed) > 0.4) {
        st.currentSpeed += Math.sign(st.targetSpeed - st.currentSpeed) * accelRate * dt;
      } else {
        st.currentSpeed = st.targetSpeed;
      }

      if (onSpeedStep) {
        onSpeedStep(Math.round(st.currentSpeed));
      }

      st.wheelRotationAngle += st.currentSpeed * dt * 0.35;
      st.worldZ += st.currentSpeed * dt * 1.85;

      if (st.arcFlashIntensity > 0) {
        st.arcFlashIntensity = Math.max(0, st.arcFlashIntensity - dt * 2.8);
      }

      ctx.clearRect(0, 0, cw, ch);
      if (st.cameraMode === "cinema") {
        renderCinemaPan(dt);
      } else if (st.cameraMode === "chase") {
        renderChaseCam();
      } else {
        renderCockpitPOV();
      }

      // Rain overlay
      if (st.weatherMode === "rain") {
        ctx.strokeStyle = "rgba(254, 243, 199, 0.28)";
        ctx.lineWidth = 1.2;
        const windShift = Math.max(4, st.currentSpeed * 0.14);
        rainStreaks.forEach((r) => {
          r.y += r.speed;
          r.x -= windShift;
          if (r.y > ch) {
            r.y = -20;
            r.x = Math.random() * (cw + 200);
          }
          if (r.x < -50) {
            r.x = cw + 100;
          }
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x - windShift * 1.4, r.y + r.len);
          ctx.stroke();
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [onFpsUpdate, onSpeedStep]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};
