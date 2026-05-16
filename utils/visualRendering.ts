// Utility for Visual Stimulation Background Rendering
// Used across multiple games to ensure consistent stimulation effects

export const getStripeSize = (acuity: string, minDimension: number): number => {
  switch (acuity) {
    case '0.0-0.1': return Math.max(20, Math.floor(minDimension / 6));
    case '0.2-0.4': return Math.max(10, Math.floor(minDimension / 12));
    case '0.5-0.6': return Math.max(5, Math.floor(minDimension / 25));
    case '0.7-0.9': return Math.max(2, Math.floor(minDimension / 50));
    default: return Math.floor(minDimension / 12);
  }
};

export const getFrequencies = (acuity: string) => {
  switch (acuity) {
    case '0.0-0.1': return { freq: 1, rotSpeed: 0.005 };
    case '0.2-0.4': return { freq: 2, rotSpeed: 0.01 };
    case '0.5-0.6': return { freq: 4, rotSpeed: 0.02 };
    case '0.7-0.9': return { freq: 6, rotSpeed: 0.04 };
    default: return { freq: 2, rotSpeed: 0.01 };
  }
};

export const renderCommonBackground = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  acuity: string
) => {
  const minDimension = Math.min(w, h);
  const stripeSize = getStripeSize(acuity, minDimension);
  const { freq, rotSpeed } = getFrequencies(acuity);
  const flashPeriod = Math.floor(60 / freq);

  // --- Read Settings from LocalStorage ---
  // Default to mode '3' (Circle) as the starting point
  const savedMode = localStorage.getItem('bg_stimulation_mode') || '3';
  const manualMode = parseInt(savedMode);

  // Color Scheme: 0=Black/White, 1=Red/Green, 2=Yellow/Blue (Default: 0)
  // User can manually select a color, which resets the color timer to start from that color
  const savedColor = localStorage.getItem('bg_color_scheme') || '0';
  const manualColorIndex = parseInt(savedColor);

  // --- Independent Mode & Color Timers ---
  const CYCLE_PERIOD = 90; // Mode switches every 90 seconds
  const COLOR_PERIOD = 30; // Color switches every 30 seconds
  const cycle = [3, 1, 2]; // Circle → Grating → Rotating Grating
  
  const totalSeconds = parseInt(localStorage.getItem('bg_total_play_seconds') || '0');
  
  // Mode timer: reset when user manually selects a mode (bg_manual_reset_seconds)
  const modeResetSeconds = parseInt(localStorage.getItem('bg_manual_reset_seconds') || '0');
  const activeModeSeconds = Math.max(0, totalSeconds - modeResetSeconds);
  
  // Color timer: reset when user manually selects a color (bg_color_reset_seconds)
  const colorResetSeconds = parseInt(localStorage.getItem('bg_color_reset_seconds') || '0');
  const activeColorSeconds = Math.max(0, totalSeconds - colorResetSeconds);
  
  // --- Determine Active Mode ---
  const manualModeIndex = cycle.indexOf(manualMode) === -1 ? 0 : cycle.indexOf(manualMode);
  const modePeriodsPassed = Math.floor(activeModeSeconds / CYCLE_PERIOD);
  const activeMode = cycle[(manualModeIndex + modePeriodsPassed) % 3];

  // --- Determine Active Color ---
  // User selected a color → start from that color, then auto-cycle every 30s
  const colorOffset = Math.floor(activeColorSeconds / COLOR_PERIOD);
  const currentColorIndex = (manualColorIndex + colorOffset) % 3;
  
  // 3 color schemes available (base colors in HSL for easier manipulation)
  const colorSchemes = [
    { h1: 0, s1: 0, l1: 0, h2: 0, s2: 0, l2: 100 },      // Black/White (grayscale)
    { h1: 0, s1: 100, l1: 50, h2: 120, s2: 100, l2: 50 }, // Red/Green
    { h1: 60, s1: 100, l1: 50, h2: 240, s2: 100, l2: 50 } // Yellow/Blue
  ];
  
  // --- Color Intensity Variation (Every 5 seconds within 30s color cycle) ---
  const INTENSITY_PERIOD = 5; // Change intensity every 5 seconds
  
  // Deterministic pseudo-random based on time period (ensures consistency during same 5s window)
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };
  
  // Calculate which 5-second interval we're in (0-5 for each 30s color cycle)
  const secondsInColorCycle = activeColorSeconds % COLOR_PERIOD;
  const currentIntensityPeriod = Math.floor(secondsInColorCycle / INTENSITY_PERIOD);
  
  // Alternating pattern: Odd periods (0,2,4) = Pure colors, Even periods (1,3,5) = Desaturated
  const isPureColor = currentIntensityPeriod % 2 === 0; // Periods 0,2,4 → pure; 1,3,5 → desaturated
  
  // Apply variations to get final colors
  const scheme = colorSchemes[currentColorIndex];
  
  let finalH1: number, finalS1: number, finalL1: number;
  let finalH2: number, finalS2: number, finalL2: number;
  
  if (isPureColor) {
    // Pure color: use original HSL values without modification
    finalH1 = scheme.h1;
    finalS1 = scheme.s1;
    finalL1 = scheme.l1;
    
    finalH2 = scheme.h2;
    finalS2 = scheme.s2;
    finalL2 = scheme.l2;
  } else {
    // Desaturated: apply random intensity reduction
    const randomSeed1 = currentIntensityPeriod * 7 + currentColorIndex * 13;
    const randomSeed2 = currentIntensityPeriod * 11 + currentColorIndex * 17;
    
    const saturationReduction1 = 20 + seededRandom(randomSeed1) * 25; // 20-45% less saturated
    const saturationReduction2 = 20 + seededRandom(randomSeed2) * 25;
    const lightnessOffset1 = (seededRandom(randomSeed1 + 100) - 0.5) * 20; // ±10% lightness shift
    const lightnessOffset2 = (seededRandom(randomSeed2 + 100) - 0.5) * 20;
    
    finalH1 = scheme.h1;
    finalS1 = Math.max(0, scheme.s1 - saturationReduction1);
    finalL1 = Math.max(5, Math.min(95, scheme.l1 + lightnessOffset1));
    
    finalH2 = scheme.h2;
    finalS2 = Math.max(0, scheme.s2 - saturationReduction2);
    finalL2 = Math.max(5, Math.min(95, scheme.l2 + lightnessOffset2));
  }
  
  // Convert HSL to Hex
  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  
  const c1 = hslToHex(finalH1, finalS1, finalL1);
  const c2 = hslToHex(finalH2, finalS2, finalL2);

  // --- Drawing Helpers ---
  const drawFlippingGratings = (color1: string, color2: string) => {
    const step = Math.floor(frame / flashPeriod);
    const offset = (step % 2 === 0) ? 0 : stripeSize;
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color2;
    for (let x = -stripeSize * 2; x < w + stripeSize * 2; x += stripeSize * 2) {
      ctx.fillRect(x + offset, 0, stripeSize, h);
    }
  };

  const drawRotatedGratings = (color1: string, color2: string) => {
    const centerX = w / 2;
    const centerY = h / 2;
    const maxDim = Math.sqrt(w * w + h * h);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(frame * rotSpeed);
    ctx.fillStyle = color2;
    ctx.fillRect(-maxDim, -maxDim, maxDim * 2, maxDim * 2);
    ctx.fillStyle = color1;
    for (let x = -maxDim; x < maxDim; x += stripeSize * 2) {
      ctx.fillRect(x, -maxDim, stripeSize, maxDim * 2);
    }
    ctx.restore();
  };

  const drawExpandingRings = (color1: string, color2: string) => {
    const centerX = w / 2;
    const centerY = h / 2;
    const maxRadius = Math.ceil(Math.sqrt(centerX * centerX + centerY * centerY));

    // Continuous outward expansion based on frequency
    // freq is "flashes per second" in old logic. freq=2 means 1 full cycle per second.
    const cyclesPerSecond = freq / 2;
    const speed = (stripeSize * 2 * cyclesPerSecond) / 60;
    const phaseCycle = stripeSize * 2;
    const phase = (frame * speed) % phaseCycle;

    ctx.fillStyle = color2;
    ctx.fillRect(0, 0, w, h);

    const totalRings = Math.ceil(maxRadius / stripeSize) + 1;

    // Draw rings from outside in, allowing them to overlap
    for (let i = totalRings; i >= -2; i--) {
      const radius = i * stripeSize + phase;
      if (radius <= 0) continue;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

      const isColor1 = Math.abs(i % 2) === 1;
      ctx.fillStyle = isColor1 ? color1 : color2;
      ctx.fill();
    }
  };

  // --- Execute Rendering ---
  if (activeMode === 3) {
    drawExpandingRings(c1, c2);
  } else if (activeMode === 2) {
    drawRotatedGratings(c1, c2);
  } else {
    drawFlippingGratings(c1, c2);
  }
};
