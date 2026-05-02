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
  const savedColor = localStorage.getItem('bg_color_scheme') || '0';
  const colorIndex = parseInt(savedColor);

  // --- Determine Colors ---
  let c1 = '#000000';
  let c2 = '#FFFFFF';
  if (colorIndex === 1) { // Red/Green
    c1 = '#FF0000';
    c2 = '#00FF00';
  } else if (colorIndex === 2) { // Yellow/Blue
    c1 = '#FFFF00';
    c2 = '#0000FF';
  }

  // --- Determine Loop Mode (Based on persistent cumulative seconds) ---
  const CYCLE_PERIOD = 180; // 3 minutes = 180 seconds
  const cycle = [3, 1, 2];
  
  const totalSeconds = parseInt(localStorage.getItem('bg_total_play_seconds') || '0');
  const resetSeconds = parseInt(localStorage.getItem('bg_manual_reset_seconds') || '0');
  
  // Calculate effective training time since manual selection
  // Use Math.max(0) to prevent negative results due to storage race/clearing
  const activeSeconds = Math.max(0, totalSeconds - resetSeconds);
  
  const manualIndex = cycle.indexOf(manualMode) === -1 ? 0 : cycle.indexOf(manualMode);
  
  // Choose mode based on how many 3-minute periods have passed
  const periodsPassed = Math.floor(activeSeconds / CYCLE_PERIOD);
  const activeMode = cycle[(manualIndex + periodsPassed) % 3];

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
