/**
 * NOCTIS Configuration & Directives
 * All parameters, thresholds, paths, and content are centralized here for easy tuning.
 */
window.NOCTIS_CONFIG = {
  // Frame Sequences
  frames: {
    hero: {
      count: 595,
      desktopPath: 'assets/frames/hero/frame_{index}.webp',
      mobilePath: 'assets/frames/hero-mobile/frame_{index}.webp',
      preloadInitial: 40,
    },
    dismantle: {
      count: 199,
      desktopPath: 'assets/frames/dismantle/frame_{index}.webp',
      mobilePath: 'assets/frames/dismantle-mobile/frame_{index}.webp',
      preloadInitial: 15,
    }
  },

  // Section Heights (CSS height strings)
  scrollHeights: {
    hero: '600vh',
    dismantle: '350vh',
    statement: '100vh',
    lineup: '100vh',
    reserve: '100vh'
  },

  // Canvas animation settings
  canvas: {
    lerpFactor: 0.15,     // Smoothing factor for scroll scrubbing
    maxPixelRatio: 2,     // Maximum DPR cap
    breakpointMobile: 768 // Viewport width threshold in px
  },

  // Hero Section Chapters (scroll progress from 0.0 to 1.0)
  heroChapters: [
    {
      id: '01',
      indexLabel: '01/04',
      start: 0.00,
      end: 0.16,
      type: 'hero-title',
      title: 'NOCTIS',
      subtitle: 'The city is asleep.',
      hint: 'SCROLL TO WAKE IT'
    },
    {
      id: '02',
      indexLabel: '02/04',
      start: 0.22,
      end: 0.42,
      type: 'hero-statement',
      headline: "It doesn't need the city's light."
    },
    {
      id: '03',
      indexLabel: '03/04',
      start: 0.50,
      end: 0.70,
      type: 'hero-statement',
      headline: 'It brings its own.'
    },
    {
      id: '04',
      indexLabel: '04/04',
      start: 0.80,
      end: 1.00,
      type: 'hero-reveal',
      title: 'GT-E',
      specs: '0–100 KM/H 3.1S · 640 KM RANGE · DUAL MOTOR',
      ctaText: 'Discover the GT-E',
      ctaHref: '#lineup'
    }
  ],

  // Realtime HUD Telemetry (Hero)
  telemetry: {
    maxSpeed: 118,      // km/h
    maxDistance: 4.2    // km
  },

  // Dismantle Section
  dismantle: {
    title: 'Look closer.',
    revealStart: 0.70, // Callouts begin fading in after 70% scroll progress
    callouts: [
      {
        id: 'light',
        label: 'LIGHT',
        detail: 'Single-line LED signature',
        x: 82, // % from left
        y: 36, // % from top
        anchor: 'right-top',
        threshold: 0.72
      },
      {
        id: 'body',
        label: 'BODY',
        detail: 'Carbon composite monocoque',
        x: 48,
        y: 24,
        anchor: 'top-left',
        threshold: 0.78
      },
      {
        id: 'drive',
        label: 'DRIVE',
        detail: 'Dual axial-flux motors, 680 kW',
        x: 58,
        y: 64,
        anchor: 'right-bottom',
        threshold: 0.84
      },
      {
        id: 'battery',
        label: 'BATTERY',
        detail: '110 kWh structural pack',
        x: 45,
        y: 76,
        anchor: 'bottom-left',
        threshold: 0.90
      }
    ]
  },

  // Statement Section Content
  statement: {
    label: '02 — ENGINEERING',
    text: 'Every part was designed to disappear into one line of light.'
  },

  // Lineup Models & Accordion
  lineup: {
    sectionLabel: '03 — THE LINEUP',
    sectionTitle: 'Five ways to drive the night.',
    hoverDebounceMs: 80,
    transitionDurationMs: 700,
    models: [
      {
        id: 'gt-e',
        num: '01',
        name: 'GT-E',
        tagline: 'The grand tourer.',
        specs: {
          range: '640 km',
          accel: '3.1 s',
          power: '680 kW'
        },
        image: 'assets/cars/gt-e.webp',
        alt: 'NOCTIS GT-E matte graphite grand tourer coupe',
        colors: ['#121418', '#EDEAE4', '#1A2332', '#3B0907'],
        defaultOpen: true
      },
      {
        id: 's',
        num: '02',
        name: 'S',
        tagline: 'Four doors, no compromise.',
        specs: {
          range: '600 km',
          accel: '3.6 s',
          power: '520 kW'
        },
        image: 'assets/cars/s.webp',
        alt: 'NOCTIS S four-door sport sedan satin bone white',
        colors: ['#EDEAE4', '#121418', '#2C3539', '#4A5043'],
        defaultOpen: false
      },
      {
        id: 'x',
        num: '03',
        name: 'X',
        tagline: 'Higher, never heavier.',
        specs: {
          range: '560 km',
          accel: '4.2 s',
          power: '480 kW'
        },
        image: 'assets/cars/x.webp',
        alt: 'NOCTIS X SUV coupe midnight blue',
        colors: ['#0E1B2E', '#121418', '#EDEAE4', '#3E424B'],
        defaultOpen: false
      },
      {
        id: 'r',
        num: '04',
        name: 'R',
        tagline: 'Built for the track.',
        specs: {
          range: '420 km',
          accel: '2.4 s',
          power: '900 kW'
        },
        image: 'assets/cars/r.webp',
        alt: 'NOCTIS R two-seat track coupe satin black with red accents',
        colors: ['#0A0A0C', '#E1251B', '#3A3D40', '#EDEAE4'],
        defaultOpen: false
      },
      {
        id: 'one',
        num: '05',
        name: 'ONE',
        tagline: 'The future, early.',
        specs: {
          range: 'Concept',
          accel: 'Concept',
          power: 'Concept'
        },
        image: 'assets/cars/one.webp',
        alt: 'NOCTIS ONE liquid silver concept hypercar',
        colors: ['#D0D4DC', '#0B0D10', '#1C2833', '#8A8F98'],
        defaultOpen: false
      }
    ]
  },

  // Reserve Section
  reserve: {
    headline: 'Drive the night.',
    body: 'Reserve your allocation for early production delivery in 2027.',
    buttonText: 'RESERVE YOUR NOCTIS'
  }
};

