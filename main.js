/**
 * NOCTIS — Scrollytelling Application Engine
 * Pure Vanilla JavaScript (ES6+)
 * 
 * Architecture:
 * 1. State Management & Preloader (Hero 1-40 prioritized, background pipeline)
 * 2. Canvas Scrollytelling Engine (Cover/Contain, DPR scaling, Lerp scrubbing, Nearest fallback)
 * 3. Film Grain Generator (Offscreen noise buffer, random shift @ ~8fps)
 * 4. Custom Headlight Cursor (Dot+Ring morphing to Light Bar, Lerp 0.18, interactive labels)
 * 5. Section Coordinators (Hero HUD/Chapters, Statement word reveal, Dismantle callouts)
 * 6. Lineup Accordion (Flex transitions, 80ms debounced hover, a11y keyboard arrow navigation)
 * 7. Navigation Scroll Direction Detector
 */

(function () {
  'use strict';

  // Verify Configuration
  const CONFIG = window.NOCTIS_CONFIG;
  if (!CONFIG) {
    console.error('NOCTIS configuration not found in window.NOCTIS_CONFIG');
    return;
  }

  // --- GLOBAL STATE ---
  const state = {
    isReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    isMobile: window.innerWidth < CONFIG.canvas.breakpointMobile,
    isPreloaded: false,
    
    // Scroll & Viewport
    scrollY: window.scrollY,
    lastScrollY: window.scrollY,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,

    // Hero Scrolly
    hero: {
      progress: 0,
      targetFrame: 0,
      currentFrame: 0,
      renderedFrame: -1,
      frameCount: CONFIG.frames.hero.count,
      frames: new Array(CONFIG.frames.hero.count),
      loadedCount: 0,
      lastDrawnLoadedIndex: 0
    },

    // Dismantle Scrolly
    dismantle: {
      progress: 0,
      targetFrame: 0,
      currentFrame: 0,
      renderedFrame: -1,
      frameCount: CONFIG.frames.dismantle.count,
      frames: new Array(CONFIG.frames.dismantle.count),
      loadedCount: 0,
      lastDrawnLoadedIndex: 0
    },

    // Cursor
    cursor: {
      mouseX: window.innerWidth / 2,
      mouseY: window.innerHeight / 2,
      curX: window.innerWidth / 2,
      curY: window.innerHeight / 2,
      isHovering: false,
      isPressed: false,
      label: ''
    },

    // Lineup
    lineup: {
      activeId: 'gt-e',
      hoverTimeout: null
    }
  };

  // --- DOM REFERENCES ---
  const DOM = {
    body: document.body,
    preloader: document.getElementById('preloader'),
    preloaderLine: document.getElementById('preloader-line'),
    preloaderCounter: document.getElementById('preloader-counter'),
    nav: document.getElementById('nav'),
    grainCanvas: document.getElementById('film-grain'),
    cursor: document.getElementById('cursor'),
    cursorLabel: document.querySelector('.cursor-label'),
    
    // Hero
    heroWrapper: document.getElementById('hero'),
    heroCanvas: document.getElementById('hero-canvas'),
    heroChapters: document.querySelectorAll('.hero-chapter'),
    hudChapterNum: document.getElementById('hud-chapter-num'),
    hudSpeed: document.getElementById('hud-speed'),
    hudDist: document.getElementById('hud-dist'),
    heroProgressBar: document.getElementById('hero-progress-bar'),

    // Statement
    statementSection: document.getElementById('statement'),
    statementQuote: document.getElementById('statement-quote'),

    // Dismantle
    dismantleWrapper: document.getElementById('technology'),
    dismantleCanvas: document.getElementById('dismantle-canvas'),
    dismantleCallouts: document.getElementById('dismantle-callouts'),
    dismantleProgressBar: document.getElementById('dismantle-progress-bar'),

    // Lineup
    lineupSection: document.getElementById('lineup'),
    lineupAccordion: document.getElementById('lineup-accordion'),

    // Reserve
    reserveBtn: document.getElementById('reserve-btn')
  };

  // --------------------------------------------------------------------------
  // 1. FRAME ASSET LOADING PIPELINE
  // --------------------------------------------------------------------------

  function getFramePath(sequenceName, index) {
    const isMob = state.isMobile;
    const template = isMob
      ? CONFIG.frames[sequenceName].mobilePath
      : CONFIG.frames[sequenceName].desktopPath;
    const formattedIndex = String(index).padStart(4, '0');
    return template.replace('{index}', formattedIndex);
  }

  function loadSingleFrame(sequenceName, index) {
    return new Promise((resolve) => {
      const src = getFramePath(sequenceName, index);
      const img = new Image();
      img.src = src;

      const onReady = () => {
        state[sequenceName].frames[index - 1] = img;
        state[sequenceName].loadedCount++;
        resolve(img);
      };

      if (img.decode) {
        img.decode().then(onReady).catch(onReady);
      } else {
        img.onload = onReady;
        img.onerror = onReady;
      }
    });
  }

  /**
   * Initial priority load: Load Hero frames 1 to 40 for rapid initial reveal
   */
  async function initPriorityLoader() {
    const initialBatchSize = Math.min(CONFIG.frames.hero.preloadInitial || 40, state.hero.frameCount);
    let loadedInitial = 0;

    const promises = [];
    for (let i = 1; i <= initialBatchSize; i++) {
      const p = loadSingleFrame('hero', i).then(() => {
        loadedInitial++;
        const pct = Math.min(100, Math.round((loadedInitial / initialBatchSize) * 100));
        updatePreloaderUI(pct);
      });
      promises.push(p);
    }

    await Promise.all(promises);
    completePreloader();

    // Silently continue loading remaining Hero frames, then Dismantle frames
    backgroundLoadPipeline(initialBatchSize + 1);
  }

  function updatePreloaderUI(percent) {
    if (DOM.preloaderCounter) {
      DOM.preloaderCounter.textContent = String(percent).padStart(3, '0') + '%';
    }
    if (DOM.preloaderLine) {
      DOM.preloaderLine.style.transform = `scaleX(${percent / 100})`;
    }
  }

  function completePreloader() {
    state.isPreloaded = true;
    if (DOM.preloaderLine) {
      DOM.preloaderLine.classList.add('is-flashing');
    }

    setTimeout(() => {
      if (DOM.preloader) {
        DOM.preloader.classList.add('is-hidden');
      }
      DOM.body.classList.remove('is-loading');

      // Trigger initial render
      renderHeroFrame(0, true);
    }, 280);
  }

  /**
   * Concurrently stream remaining frames in the background with modest concurrency
   */
  async function backgroundLoadPipeline(startHeroIndex) {
    const queue = [];
    
    // Remaining Hero frames
    for (let i = startHeroIndex; i <= state.hero.frameCount; i++) {
      queue.push({ seq: 'hero', index: i });
    }
    // Dismantle frames (in order)
    for (let i = 1; i <= state.dismantle.frameCount; i++) {
      queue.push({ seq: 'dismantle', index: i });
    }

    // Process queue with concurrency limit of 6
    const concurrency = 6;
    let idx = 0;
    async function worker() {
      while (idx < queue.length) {
        const item = queue[idx++];
        await loadSingleFrame(item.seq, item.index);
      }
    }

    const workers = [];
    for (let c = 0; c < concurrency; c++) {
      workers.push(worker());
    }
    await Promise.all(workers);
  }

  /**
   * Helper to retrieve nearest loaded frame to guarantee zero flicker
   */
  function getNearestLoadedFrame(sequenceName, targetIndex) {
    const list = state[sequenceName].frames;
    if (list[targetIndex]) return list[targetIndex];

    // Search outwards from target
    let offset = 1;
    const maxLen = list.length;
    while (targetIndex - offset >= 0 || targetIndex + offset < maxLen) {
      if (targetIndex - offset >= 0 && list[targetIndex - offset]) {
        return list[targetIndex - offset];
      }
      if (targetIndex + offset < maxLen && list[targetIndex + offset]) {
        return list[targetIndex + offset];
      }
      offset++;
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // 2. CANVAS SCROLLYTELLING ENGINE
  // --------------------------------------------------------------------------

  function initCanvases() {
    resizeCanvases();
    window.addEventListener('resize', handleResize, { passive: true });
  }

  function resizeCanvases() {
    state.windowWidth = window.innerWidth;
    state.windowHeight = window.innerHeight;
    state.isMobile = state.windowWidth < CONFIG.canvas.breakpointMobile;

    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.canvas.maxPixelRatio);

    [DOM.heroCanvas, DOM.dismantleCanvas].forEach(canvas => {
      if (!canvas) return;
      canvas.width = Math.round(state.windowWidth * dpr);
      canvas.height = Math.round(state.windowHeight * dpr);
    });

    // Force redraw
    if (state.isPreloaded) {
      state.hero.renderedFrame = -1;
      state.dismantle.renderedFrame = -1;
      renderHeroFrame(Math.round(state.hero.currentFrame), true);
      renderDismantleFrame(Math.round(state.dismantle.currentFrame), true);
    }
  }

  let resizeTimeout = null;
  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      resizeCanvases();
      initFilmGrain();
    }, 100);
  }

  /**
   * Generic frame rendering helper supporting cover (landscape) and contain (portrait)
   */
  function drawImageFit(ctx, img, canvasWidth, canvasHeight) {
    if (!img) return;

    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;
    if (!imgWidth || !imgHeight) return;

    const isLandscape = canvasWidth >= canvasHeight;
    const imgAspect = imgWidth / imgHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawW, drawH, drawX, drawY;

    if (isLandscape) {
      // Cover fit for landscape screens
      if (canvasAspect > imgAspect) {
        drawW = canvasWidth;
        drawH = canvasWidth / imgAspect;
        drawX = 0;
        drawY = (canvasHeight - drawH) / 2;
      } else {
        drawH = canvasHeight;
        drawW = canvasHeight * imgAspect;
        drawX = (canvasWidth - drawW) / 2;
        drawY = 0;
      }
    } else {
      // Contain fit vertically centered on portrait screens (no cropping)
      if (canvasAspect > imgAspect) {
        drawH = canvasHeight;
        drawW = canvasHeight * imgAspect;
        drawX = (canvasWidth - drawW) / 2;
        drawY = 0;
      } else {
        drawW = canvasWidth;
        drawH = drawW / imgAspect;
        drawX = 0;
        drawY = (canvasHeight - drawH) / 2;
      }
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  function renderHeroFrame(frameIndex, force = false) {
    if (!DOM.heroCanvas) return;
    const ctx = DOM.heroCanvas.getContext('2d');
    if (!ctx) return;

    const clampedIndex = Math.max(0, Math.min(state.hero.frameCount - 1, frameIndex));
    if (!force && state.hero.renderedFrame === clampedIndex) return;

    const img = getNearestLoadedFrame('hero', clampedIndex);
    if (!img) return;

    const w = DOM.heroCanvas.width;
    const h = DOM.heroCanvas.height;

    ctx.fillStyle = '#07080A';
    ctx.fillRect(0, 0, w, h);

    drawImageFit(ctx, img, w, h);

    // Over last 5% of scroll (0.95 -> 1.0), fade canvas to solid black
    if (state.hero.progress > 0.95) {
      const alpha = Math.min(1, (state.hero.progress - 0.95) / 0.05);
      ctx.fillStyle = '#07080A';
      ctx.globalAlpha = alpha;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1.0;
    }

    state.hero.renderedFrame = clampedIndex;
  }

  function renderDismantleFrame(frameIndex, force = false) {
    if (!DOM.dismantleCanvas) return;
    const ctx = DOM.dismantleCanvas.getContext('2d');
    if (!ctx) return;

    const clampedIndex = Math.max(0, Math.min(state.dismantle.frameCount - 1, frameIndex));
    if (!force && state.dismantle.renderedFrame === clampedIndex) return;

    const img = getNearestLoadedFrame('dismantle', clampedIndex);
    if (!img) return;

    const w = DOM.dismantleCanvas.width;
    const h = DOM.dismantleCanvas.height;

    ctx.fillStyle = '#07080A';
    ctx.fillRect(0, 0, w, h);

    drawImageFit(ctx, img, w, h);

    state.dismantle.renderedFrame = clampedIndex;
  }

  // --------------------------------------------------------------------------
  // 3. FIXED FILM GRAIN OVERLAY
  // --------------------------------------------------------------------------

  let grainNoiseTile = null;
  let lastGrainTime = 0;

  function initFilmGrain() {
    if (!DOM.grainCanvas || state.isReducedMotion) return;
    const ctx = DOM.grainCanvas.getContext('2d');
    if (!ctx) return;

    DOM.grainCanvas.width = state.windowWidth;
    DOM.grainCanvas.height = state.windowHeight;

    // Generate 128x128 offscreen noise tile once
    const tileSize = 128;
    grainNoiseTile = document.createElement('canvas');
    grainNoiseTile.width = tileSize;
    grainNoiseTile.height = tileSize;
    const tCtx = grainNoiseTile.getContext('2d');
    const imgData = tCtx.createImageData(tileSize, tileSize);
    const buf = new Uint32Array(imgData.data.buffer);

    for (let i = 0; i < buf.length; i++) {
      const v = (Math.random() * 255) | 0;
      // ABGR packing
      buf[i] = (255 << 24) | (v << 16) | (v << 8) | v;
    }
    tCtx.putImageData(imgData, 0, 0);
  }

  function updateFilmGrain(timestamp) {
    if (!DOM.grainCanvas || !grainNoiseTile || state.isReducedMotion) return;
    // Shift randomly approximately 8 times per second (interval ~125ms)
    if (timestamp - lastGrainTime < 125) return;
    lastGrainTime = timestamp;

    const ctx = DOM.grainCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, DOM.grainCanvas.width, DOM.grainCanvas.height);
    const pattern = ctx.createPattern(grainNoiseTile, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      const offX = (Math.random() * 128) | 0;
      const offY = (Math.random() * 128) | 0;
      ctx.save();
      ctx.translate(offX, offY);
      ctx.fillRect(-offX, -offY, DOM.grainCanvas.width + 128, DOM.grainCanvas.height + 128);
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // 4. CUSTOM HEADLIGHT CURSOR
  // --------------------------------------------------------------------------

  function initCustomCursor() {
    if (state.isReducedMotion || !window.matchMedia('(pointer: fine)').matches) {
      if (DOM.cursor) DOM.cursor.style.display = 'none';
      return;
    }

    window.addEventListener('mousemove', (e) => {
      state.cursor.mouseX = e.clientX;
      state.cursor.mouseY = e.clientY;
    }, { passive: true });

    window.addEventListener('mousedown', () => {
      state.cursor.isPressed = true;
      if (DOM.cursor) DOM.cursor.classList.add('is-pressed');
    });

    window.addEventListener('mouseup', () => {
      setTimeout(() => {
        state.cursor.isPressed = false;
        if (DOM.cursor) DOM.cursor.classList.remove('is-pressed');
      }, 120);
    });

    // Delegate hover states for links, buttons and interactive elements
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-cursor], a, button, [role="button"], .lineup-slide');
      if (target) {
        state.cursor.isHovering = true;
        let label = target.getAttribute('data-cursor') || 'VIEW';
        if (target.classList.contains('lineup-slide')) {
          label = target.classList.contains('is-open') ? 'CONFIGURE' : 'OPEN';
        }
        setCursorInteractiveState(true, label);
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('[data-cursor], a, button, [role="button"], .lineup-slide');
      if (target) {
        setCursorInteractiveState(false, '');
      }
    });
  }

  function setCursorInteractiveState(isHover, label) {
    state.cursor.isHovering = isHover;
    state.cursor.label = label;
    if (!DOM.cursor) return;

    if (isHover) {
      DOM.cursor.classList.add('is-hovering');
      if (DOM.cursorLabel) DOM.cursorLabel.textContent = label;
    } else {
      DOM.cursor.classList.remove('is-hovering');
      if (DOM.cursorLabel) DOM.cursorLabel.textContent = '';
    }
  }

  function updateCustomCursor() {
    if (!DOM.cursor || state.isReducedMotion || !window.matchMedia('(pointer: fine)').matches) return;

    // Smooth lerp 0.18
    state.cursor.curX += (state.cursor.mouseX - state.cursor.curX) * 0.18;
    state.cursor.curY += (state.cursor.mouseY - state.cursor.curY) * 0.18;

    DOM.cursor.style.transform = `translate3d(${state.cursor.curX}px, ${state.cursor.curY}px, 0)`;
  }

  // --------------------------------------------------------------------------
  // 5. HERO SCROLLY COORDINATOR
  // --------------------------------------------------------------------------

  function updateHeroScrolly() {
    if (!DOM.heroWrapper) return;
    const rect = DOM.heroWrapper.getBoundingClientRect();
    const scrollDist = DOM.heroWrapper.offsetHeight - window.innerHeight;

    if (scrollDist <= 0) return;
    const progress = Math.max(0, Math.min(1, -rect.top / scrollDist));
    state.hero.progress = progress;
    state.hero.targetFrame = Math.round(progress * (state.hero.frameCount - 1));

    // Update bottom progress bar (1px xenon line)
    if (DOM.heroProgressBar) {
      DOM.heroProgressBar.style.transform = `scaleX(${progress})`;
    }

    // Telemetry HUD updates
    if (DOM.hudSpeed) {
      const speed = Math.round(progress * CONFIG.telemetry.maxSpeed);
      DOM.hudSpeed.textContent = `${String(speed).padStart(3, '0')} KM/H`;
    }
    if (DOM.hudDist) {
      const dist = (progress * CONFIG.telemetry.maxDistance).toFixed(1);
      DOM.hudDist.textContent = `${dist} KM`;
    }

    // Chapter range detection & headline line reveal
    let activeChapterId = '01';
    CONFIG.heroChapters.forEach((ch) => {
      const el = document.querySelector(`.hero-chapter[data-chapter="${ch.id}"]`);
      if (!el) return;
      if (progress >= ch.start && progress <= ch.end) {
        el.classList.add('is-active');
        activeChapterId = ch.id;
      } else {
        el.classList.remove('is-active');
      }
    });

    if (DOM.hudChapterNum) {
      DOM.hudChapterNum.textContent = `${activeChapterId}/04`;
    }
  }

  // --------------------------------------------------------------------------
  // 6. STATEMENT SECTION (Word-by-word Reveal)
  // --------------------------------------------------------------------------

  function initStatementSection() {
    if (!DOM.statementQuote) return;
    const text = CONFIG.statement.text;
    const words = text.split(' ');
    DOM.statementQuote.innerHTML = words
      .map(w => `<span class="statement-word">${w}&nbsp;</span>`)
      .join('');
  }

  function updateStatementSection() {
    if (!DOM.statementSection) return;
    const rect = DOM.statementSection.getBoundingClientRect();
    const enterOffset = window.innerHeight;
    const totalDist = window.innerHeight + rect.height;

    // Progress 0 when bottom of viewport hits section top, 1 when section leaves top
    const rawProgress = (enterOffset - rect.top) / totalDist;
    const progress = Math.max(0, Math.min(1, rawProgress));

    const wordSpans = DOM.statementQuote.querySelectorAll('.statement-word');
    const count = wordSpans.length;

    wordSpans.forEach((span, idx) => {
      const start = 0.25 + (idx / count) * 0.45;
      const end = start + 0.12;

      let opacity = 0.15;
      if (progress >= end) {
        opacity = 1.0;
      } else if (progress > start) {
        opacity = 0.15 + ((progress - start) / (end - start)) * 0.85;
      }
      span.style.opacity = opacity.toFixed(3);
    });
  }

  // --------------------------------------------------------------------------
  // 7. DISMANTLE SCROLLY COORDINATOR
  // --------------------------------------------------------------------------

  function initDismantleCallouts() {
    if (!DOM.dismantleCallouts) return;
    DOM.dismantleCallouts.innerHTML = '';

    CONFIG.dismantle.callouts.forEach(item => {
      const el = document.createElement('div');
      el.className = `dismantle-callout callout--${item.anchor}`;
      el.id = `callout-${item.id}`;
      el.style.left = `${item.x}%`;
      el.style.top = `${item.y}%`;

      el.innerHTML = `
        <div class="callout-dot"></div>
        <div class="callout-line"></div>
        <div class="callout-content">
          <span class="mono-hud callout-label">${item.label}</span>
          <span class="callout-detail">${item.detail}</span>
        </div>
      `;
      DOM.dismantleCallouts.appendChild(el);
    });
  }

  function updateDismantleScrolly() {
    if (!DOM.dismantleWrapper) return;
    const rect = DOM.dismantleWrapper.getBoundingClientRect();
    const scrollDist = DOM.dismantleWrapper.offsetHeight - window.innerHeight;

    if (scrollDist <= 0) return;
    const progress = Math.max(0, Math.min(1, -rect.top / scrollDist));
    state.dismantle.progress = progress;
    state.dismantle.targetFrame = Math.round(progress * (state.dismantle.frameCount - 1));

    // Bottom progress bar
    if (DOM.dismantleProgressBar) {
      DOM.dismantleProgressBar.style.transform = `scaleX(${progress})`;
    }

    // Callout reveals after 70% progress
    CONFIG.dismantle.callouts.forEach(item => {
      const el = document.getElementById(`callout-${item.id}`);
      if (!el) return;
      if (progress >= item.threshold) {
        el.classList.add('is-visible');
      } else {
        el.classList.remove('is-visible');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 8. LINEUP ACCORDION
  // --------------------------------------------------------------------------

  function initLineupAccordion() {
    if (!DOM.lineupAccordion) return;
    DOM.lineupAccordion.innerHTML = '';

    const models = CONFIG.lineup.models;

    models.forEach((m) => {
      const isOpen = m.defaultOpen || false;
      const slide = document.createElement('div');
      slide.className = `lineup-slide ${isOpen ? 'is-open' : ''}`;
      slide.id = `slide-${m.id}`;
      slide.setAttribute('role', 'button');
      slide.setAttribute('tabindex', '0');
      slide.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      slide.setAttribute('aria-label', `NOCTIS ${m.name} - ${m.tagline}`);

      // Swatches HTML
      const swatchesHtml = m.colors
        .map((col, idx) => `<span class="color-swatch ${idx === 0 ? 'is-active' : ''}" style="background-color: ${col};" data-color="${col}"></span>`)
        .join('');

      slide.innerHTML = `
        <div class="slide-floor-line"></div>
        
        <!-- Car Image -->
        <div class="slide-image-wrap">
          <img src="${m.image}" alt="${m.alt}" class="slide-car-img" loading="lazy">
        </div>

        <!-- Top Bar -->
        <div class="slide-top-bar">
          <span class="mono-hud slide-num">${m.num}</span>
          <h3 class="slide-open-title">${m.name}</h3>
        </div>

        <!-- Closed Rotated Name -->
        <span class="mono-hud slide-closed-name">${m.name}</span>

        <!-- Open Slide Bottom Details -->
        <div class="slide-details">
          <p class="slide-tagline">${m.tagline}</p>
          <div class="slide-specs-row">
            <div class="spec-cell">
              <span class="mono-hud spec-label">RANGE</span>
              <span class="mono-hud spec-val">${m.specs.range}</span>
            </div>
            <div class="spec-cell">
              <span class="mono-hud spec-label">0–100 KM/H</span>
              <span class="mono-hud spec-val">${m.specs.accel}</span>
            </div>
            <div class="spec-cell">
              <span class="mono-hud spec-label">POWER</span>
              <span class="mono-hud spec-val">${m.specs.power}</span>
            </div>
          </div>
          <div class="slide-bottom-row">
            <div class="swatches-row" aria-label="Available Finishes">
              ${swatchesHtml}
            </div>
            <a href="#reserve" class="slide-cta-link mono-hud" data-cursor="RESERVE">Configure →</a>
          </div>
        </div>
      `;

      // Event Listeners: 80ms Debounced Hover (desktop) & Click/Tap
      slide.addEventListener('mouseenter', () => {
        if (state.isMobile) return;
        clearTimeout(state.lineup.hoverTimeout);
        state.lineup.hoverTimeout = setTimeout(() => {
          openLineupSlide(m.id);
        }, CONFIG.lineup.hoverDebounceMs || 80);
      });

      slide.addEventListener('click', (e) => {
        // Handle swatch click
        const swatch = e.target.closest('.color-swatch');
        if (swatch) {
          e.stopPropagation();
          slide.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-active'));
          swatch.classList.add('is-active');
          return;
        }
        openLineupSlide(m.id);
      });

      // Keyboard Accessibility
      slide.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLineupSlide(m.id);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          navigateSlide(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          navigateSlide(-1);
        }
      });

      DOM.lineupAccordion.appendChild(slide);
    });

    // Stagger reveal when lineup enters view
    const lineupObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          DOM.lineupSection.classList.add('is-in-view');
        }
      });
    }, { threshold: 0.15 });

    lineupObserver.observe(DOM.lineupSection);
  }

  function openLineupSlide(modelId) {
    if (state.lineup.activeId === modelId && !state.isMobile) return;
    state.lineup.activeId = modelId;

    const slides = DOM.lineupAccordion.querySelectorAll('.lineup-slide');
    slides.forEach(slide => {
      const isTarget = slide.id === `slide-${modelId}`;
      if (isTarget) {
        slide.classList.add('is-open');
        slide.setAttribute('aria-expanded', 'true');
      } else {
        slide.classList.remove('is-open');
        slide.setAttribute('aria-expanded', 'false');
      }
    });

    // Update custom cursor label if mouse is over active slide
    if (state.cursor.isHovering) {
      setCursorInteractiveState(true, 'CONFIGURE');
    }
  }

  function navigateSlide(direction) {
    const models = CONFIG.lineup.models;
    const curIdx = models.findIndex(m => m.id === state.lineup.activeId);
    let nextIdx = curIdx + direction;
    if (nextIdx < 0) nextIdx = models.length - 1;
    if (nextIdx >= models.length) nextIdx = 0;

    const nextModel = models[nextIdx];
    openLineupSlide(nextModel.id);
    const nextEl = document.getElementById(`slide-${nextModel.id}`);
    if (nextEl) nextEl.focus();
  }

  // --------------------------------------------------------------------------
  // 9. NAVIGATION SCROLL DETECTOR
  // --------------------------------------------------------------------------

  function updateNav() {
    if (!DOM.nav) return;
    const curY = window.scrollY;

    if (curY > state.lastScrollY && curY > 80) {
      // Scrolling down
      DOM.nav.classList.add('is-hidden');
    } else if (curY < state.lastScrollY) {
      // Scrolling up
      DOM.nav.classList.remove('is-hidden');
    }
    state.lastScrollY = curY;
  }

  // --------------------------------------------------------------------------
  // 10. MAIN RAF ANIMATION LOOP
  // --------------------------------------------------------------------------

  function mainLoop(timestamp) {
    // 1. Film Grain Update
    updateFilmGrain(timestamp);

    // 2. Cursor Follow
    updateCustomCursor();

    // 3. Hero Canvas Scrubbing
    if (!state.isReducedMotion) {
      state.hero.currentFrame += (state.hero.targetFrame - state.hero.currentFrame) * CONFIG.canvas.lerpFactor;
      const targetHeroRounded = Math.round(state.hero.currentFrame);
      if (targetHeroRounded !== state.hero.renderedFrame) {
        renderHeroFrame(targetHeroRounded);
      }

      // 4. Dismantle Canvas Scrubbing
      state.dismantle.currentFrame += (state.dismantle.targetFrame - state.dismantle.currentFrame) * CONFIG.canvas.lerpFactor;
      const targetDismantleRounded = Math.round(state.dismantle.currentFrame);
      if (targetDismantleRounded !== state.dismantle.renderedFrame) {
        renderDismantleFrame(targetDismantleRounded);
      }
    }

    requestAnimationFrame(mainLoop);
  }

  // Global Scroll Event Coordinator
  let scrollTicking = false;
  function handleScroll() {
    state.scrollY = window.scrollY;

    if (!scrollTicking) {
      requestAnimationFrame(() => {
        updateNav();
        updateHeroScrolly();
        updateStatementSection();
        updateDismantleScrolly();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION ENTRY POINT
  // --------------------------------------------------------------------------

  function init() {
    if (state.isReducedMotion) {
      DOM.body.classList.add('reduced-motion');
    }

    initCanvases();
    initFilmGrain();
    initCustomCursor();
    initStatementSection();
    initDismantleCallouts();
    initLineupAccordion();

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial section updates
    handleScroll();

    // Kick off image pipeline
    initPriorityLoader();

    // Launch RAF loop
    requestAnimationFrame(mainLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

