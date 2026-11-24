/* ==========================================================================
   Invitación · Angie Silupu · 22
   app.js — sin dependencias
   ========================================================================== */
'use strict';

/* --------------------------------------------------------------------------
   CONFIGURACIÓN CENTRALIZADA (edita solo esta parte)
   -------------------------------------------------------------------------- */

// Audio: canción en assets/audio/. Si cambias el archivo, cambia el nombre aquí.
// Si el archivo no existe, se usa el fallback libre de derechos para pruebas.
const AUDIO_CONFIG = {
  src: encodeURI('./assets/audio/Taylor Swift - Lover Remix Feat. Shawn Mendes (Lyric Video).mp3'),
  fallbackSrc: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  startAt: 0,            // segundo desde el que empieza la canción (ej. 5 para saltar la intro)
  targetVolume: 0.7,     // volumen final (0.0 – 1.0)
  fadeInMs: 1500,        // fade-in de 0.0 a targetVolume
  resumeFadeMs: 700,     // fade al reanudar
  pauseFadeMs: 400,      // fade al pausar
  loop: true,
};

// Evento: hora de Perú (UTC−05:00).
const EVENT_CONFIG = {
  start: '2026-11-27T20:00:00-05:00', // EDITAR si cambia la hora de inicio
  end: '2026-11-28T03:00:00-05:00',   // fin estimado (para el mensaje "ya comenzó")
  timeLabel: '8:00 p. m.',            // texto que se muestra en "Hora"
  timeZone: 'America/Lima',
  coordsText: `5°01'08.8"S 81°03'42.9"W`,
};

// Google Sheets: pega aquí la URL /exec de tu Web App de Apps Script.
// Hoja: https://docs.google.com/spreadsheets/d/1q7fHTTMMDMy7xhvBpFIQijSL_StoA7X6wW9VRuUaNyc/edit
// Si se deja vacía, el formulario funciona en MODO DEMO (simula el envío).
const SHEETS_CONFIG = {
  endpoint: 'https://script.google.com/macros/s/AKfycbzC5LSd3yU_VWvzh_sm8vKJh-Yc32CCatpOmas9cIY-jXIk5c6GP53SQ18AobUQIIx1/exec',
  timeoutMs: 15000,
};

// Ideas de regalo que se muestran en el formulario.
// "detalle" es opcional: ej. 'Talla S' o 'Talla 37'. Déjalo vacío si no aplica.
const GIFTS = [
  { id: 'perfume',    nombre: 'Perfume',    detalle: '', icon: 'perfume' },
  { id: 'bisuteria',  nombre: 'Bisutería',  detalle: '', icon: 'jewel' },
  { id: 'maquillaje', nombre: 'Maquillaje', detalle: '', icon: 'makeup' },
  { id: 'ropa',       nombre: 'Ropa',       detalle: '', icon: 'dress' },
  { id: 'calzado',    nombre: 'Calzado',    detalle: '', icon: 'heel' },
  { id: 'sorpresa',   nombre: 'Sorpresa',   detalle: 'Lo que nazca del corazón', icon: 'gift' },
];

const GIFT_ICONS = {
  perfume: '<rect x="6" y="9" width="12" height="12" rx="2.5"/><path d="M9.5 9V6.5h5V9M10.5 6.5V4h3v2.5M18 4.5h1.5M18.5 2.8l1.2-.8M18.5 6.2l1.2.8"/><path d="M9 14.5h6"/>',
  jewel: '<path d="M4 3c0 6 3.5 9.5 8 9.5S20 9 20 3"/><path d="M12 12.5l-2.2 2.8L12 20l2.2-4.7z"/><circle cx="4.5" cy="15" r="1.3"/><path d="M4.5 13.7v-2"/><circle cx="19.5" cy="15" r="1.3"/><path d="M19.5 13.7v-2"/>',
  makeup: '<path d="M6 21V12h4v9z"/><path d="M6.5 12V8.5L9.5 6v6"/><path d="M15 21v-6.5h3V21z"/><path d="M15.2 14.5c0-3 .5-6 1.3-9 .8 3 1.3 6 1.3 9"/>',
  dress: '<path d="M9 3l1 3.5h4L15 3"/><path d="M10 6.5L8.5 10l1.5 1-4 10h12l-4-10 1.5-1L14 6.5"/>',
  heel: '<path d="M3 18.5c0-1.7 1.3-2.8 3.2-3.1 1.7-.3 3.1-1 4.3-2.4l3.4-4c.7-.8 1.9-.7 2.4.2l3.2 5.6c.3.5.5 1.1.5 1.7v2H3z"/><path d="M19.5 18.5l-.6 3"/><path d="M8 15.3l1.6 3.2"/>',
  gift: '<rect x="4" y="10" width="16" height="11" rx="1"/><path d="M3 7h18v3H3zM12 7v14"/><path d="M12 7c-1.5-3-5-3.5-5-1.5S10 7 12 7zM12 7c1.5-3 5-3.5 5-1.5S14 7 12 7z"/>',
};

/* --------------------------------------------------------------------------
   Utilidades
   -------------------------------------------------------------------------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------------------------------------------------
   MOTOR DE AUDIO
   - El <audio> se crea y se llama a play() DENTRO del onClick (requisito
     de autoplay en iOS Safari y Chrome Android).
   - En iOS, audio.volume es de solo lectura: se usa un GainNode de Web Audio
     para hacer el fade (solo con archivos del mismo origen).
   -------------------------------------------------------------------------- */
const AudioEngine = (() => {
  let audio = null;
  let ctx = null;
  let gain = null;
  let usingGain = false;
  let triedFallback = false;
  let wantPlaying = false;
  let pendingFadeMs = 0;
  let rafId = 0;
  let resumeOnVisible = false;
  let unavailable = false;
  const listeners = new Set();

  const volumeWritable = (() => {
    try {
      const probe = document.createElement('audio');
      probe.volume = 0.5;
      return Math.abs(probe.volume - 0.5) < 0.01;
    } catch (_) {
      return false;
    }
  })();

  const emit = () => listeners.forEach((fn) => fn(state()));
  const state = () => ({
    started: !!audio,
    playing: !!audio && !audio.paused && wantPlaying,
    unavailable,
  });

  function setLevel(v) {
    const value = Math.max(0, Math.min(1, v));
    if (usingGain && gain) gain.gain.value = value;
    else if (audio && volumeWritable) audio.volume = value;
  }
  function getLevel() {
    if (usingGain && gain) return gain.gain.value;
    if (audio && volumeWritable) return audio.volume;
    return AUDIO_CONFIG.targetVolume;
  }

  function fadeTo(target, ms, done) {
    cancelAnimationFrame(rafId);
    const from = getLevel();
    const t0 = performance.now();
    const duration = Math.max(1, ms);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setLevel(from + (target - from) * eased);
      if (p < 1) rafId = requestAnimationFrame(step);
      else if (done) done();
    };
    rafId = requestAnimationFrame(step);
  }

  function isSameOrigin(src) {
    try {
      if (location.protocol === 'file:') return false;
      return new URL(src, location.href).origin === location.origin;
    } catch (_) {
      return false;
    }
  }

  // iOS: conecta el GainNode cuando el audio ya está sonando (silenciado)
  function attachGainIfNeeded() {
    if (volumeWritable || usingGain) return;
    const src = audio.currentSrc || audio.src;
    if (ctx && isSameOrigin(src)) {
      try {
        const source = ctx.createMediaElementSource(audio);
        gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(ctx.destination);
        usingGain = true;
      } catch (_) { /* sin fade: volumen del sistema */ }
    }
    audio.muted = false;
  }

  function onPlaying() {
    attachGainIfNeeded();
    if (pendingFadeMs) {
      const ms = pendingFadeMs;
      pendingFadeMs = 0;
      setLevel(0);
      fadeTo(AUDIO_CONFIG.targetVolume, ms);
    }
    emit();
  }

  function onError() {
    if (!triedFallback && AUDIO_CONFIG.fallbackSrc) {
      triedFallback = true;
      console.info('[Audio] No se encontró la canción local. Usando pista de prueba.');
      audio.src = AUDIO_CONFIG.fallbackSrc;
      pendingFadeMs = AUDIO_CONFIG.fadeInMs;
      if (wantPlaying) audio.play().catch(onPlayRejected);
      return;
    }
    console.warn('[Audio] No se pudo cargar ninguna pista.');
    wantPlaying = false;
    unavailable = true;
    emit();
  }

  function onPlayRejected(err) {
    if (err && err.name === 'NotSupportedError') return; // lo maneja onError
    if (err && err.name === 'AbortError') return;        // cambio de src
    wantPlaying = false;
    emit();
  }

  // ⚠️ Llamar SOLO dentro de un evento de usuario (click / tap)
  function startFromGesture() {
    if (audio) return;
    audio = new Audio();
    audio.preload = 'auto';
    audio.loop = AUDIO_CONFIG.loop;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');

    if (volumeWritable) {
      audio.volume = 0;
    } else {
      // iOS: arranca silenciado y crea/reanuda el AudioContext en el gesto
      audio.muted = true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try {
          ctx = new AC();
          if (ctx.resume) ctx.resume();
        } catch (_) { ctx = null; }
      }
    }

    if (AUDIO_CONFIG.startAt > 0) {
      audio.addEventListener('loadedmetadata', () => {
        if (audio.currentTime < AUDIO_CONFIG.startAt && audio.duration > AUDIO_CONFIG.startAt) {
          audio.currentTime = AUDIO_CONFIG.startAt;
        }
      }, { once: true });
    }
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('error', onError);
    audio.addEventListener('pause', emit);
    audio.addEventListener('play', emit);

    audio.src = AUDIO_CONFIG.src;
    wantPlaying = true;
    pendingFadeMs = AUDIO_CONFIG.fadeInMs;

    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(onPlayRejected);
    emit();
  }

  function resume() {
    if (!audio || unavailable) return;
    wantPlaying = true;
    if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume();
    pendingFadeMs = AUDIO_CONFIG.resumeFadeMs;
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(onPlayRejected);
    emit();
  }

  function pause() {
    if (!audio) return;
    wantPlaying = false;
    emit();
    fadeTo(0, AUDIO_CONFIG.pauseFadeMs, () => {
      if (!wantPlaying) audio.pause();
    });
  }

  function toggle() {
    if (!audio) return startFromGesture();
    if (unavailable) return;
    if (wantPlaying && !audio.paused) pause();
    else resume();
  }

  // Pausa al salir de la pestaña / bloquear el celular
  document.addEventListener('visibilitychange', () => {
    if (!audio) return;
    if (document.hidden && wantPlaying && !audio.paused) {
      resumeOnVisible = true;
      cancelAnimationFrame(rafId);
      audio.pause();
    } else if (!document.hidden && resumeOnVisible) {
      resumeOnVisible = false;
      resume();
    }
  });

  return {
    startFromGesture,
    toggle,
    onChange: (fn) => listeners.add(fn),
  };
})();

/* --------------------------------------------------------------------------
   Control flotante de audio
   -------------------------------------------------------------------------- */
function initAudioToggle() {
  const btn = $('#audioToggle');
  btn.addEventListener('click', () => AudioEngine.toggle());
  AudioEngine.onChange(({ playing, unavailable }) => {
    btn.classList.toggle('is-paused', !playing);
    btn.classList.toggle('is-unavailable', unavailable);
    btn.setAttribute('aria-pressed', String(playing));
    btn.setAttribute('aria-label', unavailable ? 'Música no disponible' : playing ? 'Pausar música' : 'Reproducir música');
  });
}

/* --------------------------------------------------------------------------
   ETAPA 1 → ETAPA 2: apertura coreografiada
   -------------------------------------------------------------------------- */
function initCover() {
  const cover = $('#cover');
  const openBtn = $('#openBtn');
  const main = $('#invitation');
  const audioBtn = $('#audioToggle');
  let opened = false;

  openBtn.addEventListener('click', () => {
    // 1) Audio iniciado exactamente dentro del onClick
    AudioEngine.startFromGesture();

    // 2) Transición
    if (opened) return;
    opened = true;
    openBtn.disabled = true;

    audioBtn.hidden = false;
    main.removeAttribute('inert');
    main.removeAttribute('aria-hidden');

    requestAnimationFrame(() => {
      cover.classList.add('is-opening');
      document.body.classList.add('is-open');
    });

    // 3) Lluvia de confeti cuando las puertas se abren
    if (!prefersReducedMotion) setTimeout(launchConfetti, 700);

    const duration = prefersReducedMotion ? 400 : 1950;
    setTimeout(() => {
      cover.hidden = true;
      document.body.classList.remove('is-locked');
      window.scrollTo(0, 0);
      const heading = $('#heroTitle');
      if (heading) heading.focus({ preventScroll: true });
    }, duration);
  });
}

/* --------------------------------------------------------------------------
   Confeti dorado y vino (canvas, sin librerías)
   -------------------------------------------------------------------------- */
function launchConfetti() {
  const canvas = $('#confetti');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const colors = ['#C9A679', '#F3DDB0', '#E8C88E', '#80182C', '#C2283F', '#F7F1EA'];
  const count = W < 600 ? 110 : 180;
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const fromLeft = i % 2 === 0;
    pieces.push({
      x: fromLeft ? -10 : W + 10,
      y: H * (0.55 + Math.random() * 0.3),
      vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 7) * (W / 900 + 0.4),
      vy: -(9 + Math.random() * 9) * (H / 900 + 0.3),
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      tilt: Math.random() * Math.PI,
      color: colors[(Math.random() * colors.length) | 0],
      round: Math.random() < 0.25,
    });
  }

  const t0 = performance.now();
  const life = 4200;
  function frame(now) {
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    const fade = t > life - 900 ? Math.max(0, (life - t) / 900) : 1;
    pieces.forEach((p) => {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.tilt += 0.12;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.tilt)), p.w, p.h * Math.abs(Math.cos(p.tilt)));
      }
      ctx.restore();
    });
    if (t < life) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
}

/* --------------------------------------------------------------------------
   Reveal al hacer scroll
   -------------------------------------------------------------------------- */
function initReveal() {
  const items = $$('[data-reveal]');
  if (!('IntersectionObserver' in window) || prefersReducedMotion) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  // Escalonado suave entre hermanos
  const groups = new Map();
  items.forEach((el) => {
    const parent = el.parentElement;
    const i = groups.get(parent) || 0;
    el.style.setProperty('--reveal-delay', `${Math.min(i * 0.09, 0.45)}s`);
    groups.set(parent, i + 1);
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  items.forEach((el) => io.observe(el));
}

/* --------------------------------------------------------------------------
   Galería: fallback de imágenes + indicadores del carrusel móvil
   -------------------------------------------------------------------------- */
function initGallery() {
  // Si una imagen de muestra falla, usa la de respaldo
  $$('img[data-fallback]').forEach((img) => {
    const swap = () => {
      const fb = img.dataset.fallback;
      if (fb && img.src !== fb) {
        img.src = fb;
        img.removeAttribute('data-fallback');
      }
    };
    img.addEventListener('error', swap, { once: true });
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) swap();
  });

  const track = $('#lookbook');
  const dotsWrap = $('#lookbookDots');
  const looks = $$('.look', track);
  if (!track || !dotsWrap || !looks.length) return;

  const dots = looks.map((look, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Foto ${i + 1} de ${looks.length}`);
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dot.addEventListener('click', () => {
      const padding = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      track.scrollTo({ left: look.offsetLeft - padding, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
    dotsWrap.appendChild(dot);
    return dot;
  });

  let ticking = false;
  const update = () => {
    ticking = false;
    const padding = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const x = track.scrollLeft + padding;
    let active = 0;
    let best = Infinity;
    looks.forEach((look, i) => {
      const d = Math.abs(look.offsetLeft - x);
      if (d < best) { best = d; active = i; }
    });
    // Al llegar al final, marca la última
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) active = looks.length - 1;
    dots.forEach((dot, i) => dot.setAttribute('aria-selected', i === active ? 'true' : 'false'));
  };
  track.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
}

/* --------------------------------------------------------------------------
   Contador regresivo
   -------------------------------------------------------------------------- */
function initCountdown() {
  const root = $('#countdown');
  const status = $('#countdownStatus');
  const units = {
    d: $('[data-unit="d"]', root),
    h: $('[data-unit="h"]', root),
    m: $('[data-unit="m"]', root),
    s: $('[data-unit="s"]', root),
  };
  $$('[data-event-time]').forEach((el) => { el.textContent = EVENT_CONFIG.timeLabel; });

  const start = new Date(EVENT_CONFIG.start).getTime();
  const end = new Date(EVENT_CONFIG.end).getTime();
  const dayKey = (t) => new Date(t).toLocaleDateString('es-PE', { timeZone: EVENT_CONFIG.timeZone });
  const pad = (n) => String(n).padStart(2, '0');
  let timer = 0;

  const setStatus = (text) => { if (status.textContent !== text) status.textContent = text; };
  const setUnits = (d, h, m, s) => {
    units.d.textContent = pad(d);
    units.h.textContent = pad(h);
    units.m.textContent = pad(m);
    units.s.textContent = pad(s);
  };

  function tick() {
    const now = Date.now();
    if (now < start) {
      let diff = Math.floor((start - now) / 1000);
      const d = Math.floor(diff / 86400); diff %= 86400;
      const h = Math.floor(diff / 3600);  diff %= 3600;
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setUnits(d, h, m, s);
      if (dayKey(now) === dayKey(start)) setStatus('Es hoy. Nos vemos esta noche frente al mar.');
      else if (d === 0 || (d === 1 && h === 0)) setStatus('Mañana es el gran día.');
      else setStatus(`Faltan ${d} ${d === 1 ? 'día' : 'días'} para brindar juntos.`);
    } else if (now < end) {
      setUnits(0, 0, 0, 0);
      root.classList.add('is-live');
      setStatus('La celebración ya comenzó. Te estamos esperando.');
    } else {
      setUnits(0, 0, 0, 0);
      root.classList.add('is-live');
      setStatus('Gracias por ser parte de esta noche. Fue inolvidable.');
      clearInterval(timer);
    }
  }

  tick();
  timer = setInterval(tick, 1000);
}

/* --------------------------------------------------------------------------
   Copiar coordenadas
   -------------------------------------------------------------------------- */
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.opacity = '0';
  ta.style.fontSize = '16px';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy-failed');
}

function initCopy() {
  const btn = $('#copyBtn');
  const label = $('.btn__label', btn);
  const live = $('#copyStatus');
  const original = label.textContent;
  let resetTimer = 0;

  btn.addEventListener('click', async () => {
    clearTimeout(resetTimer);
    try {
      await copyText(EVENT_CONFIG.coordsText);
      label.textContent = 'Coordenadas copiadas ✓';
      btn.classList.add('is-done');
      live.textContent = 'Coordenadas copiadas al portapapeles';
    } catch (_) {
      label.textContent = 'Mantén presionado para copiar';
      live.textContent = 'No se pudo copiar automáticamente';
    }
    resetTimer = setTimeout(() => {
      label.textContent = original;
      btn.classList.remove('is-done');
      live.textContent = '';
    }, 2600);
  });
}

/* --------------------------------------------------------------------------
   RSVP · validación en tiempo real + envío a Google Sheets
   -------------------------------------------------------------------------- */
function renderGifts() {
  const wrap = document.getElementById('gifts');
  if (!wrap) return;
  wrap.innerHTML = GIFTS.map((g) => `
    <label class="gift">
      <input type="checkbox" name="regalo" value="${g.nombre}${g.detalle ? ' (' + g.detalle + ')' : ''}">
      <span class="gift__box">
        <span class="gift__check" aria-hidden="true">✓</span>
        <span class="gift__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${GIFT_ICONS[g.icon] || GIFT_ICONS.gift}</svg></span>
        <span class="gift__name">${g.nombre}</span>
        ${g.detalle ? `<span class="gift__detail">${g.detalle}</span>` : ''}
      </span>
    </label>`).join('');
}

function initRSVP() {
  renderGifts();
  const form = $('#rsvpForm');
  const nameInput = $('#nombre');
  const msgInput = $('#mensaje');
  const msgChars = $('#mensajeChars');
  const msgCounter = $('#mensajeCount');
  const companions = $('#companionsField');
  const submitBtn = $('#submitBtn');
  const submitLabel = $('#submitLabel');
  const alertBox = $('#formAlert');
  const alertText = $('#formAlertText');
  const success = $('#rsvpSuccess');
  const MAX_MSG = 300;
  let submitting = false;
  const touched = new Set();

  const normalizeName = (v) => v.replace(/\s+/g, ' ').trim();

  const validators = {
    nombre() {
      const v = normalizeName(nameInput.value);
      if (!v) return 'Cuéntanos tu nombre para reconocerte.';
      if (!/^[\p{L}'’.\- ]+$/u.test(v)) return 'Usa solo letras, por favor.';
      if (v.split(' ').filter((w) => w.length > 1).length < 2) return 'Agrega también tu apellido.';
      return '';
    },
    asistencia() {
      return form.querySelector('input[name="asistencia"]:checked') ? '' : 'Elige una opción para continuar.';
    },
  };

  function showFieldState(key, message) {
    const field = form.querySelector(`[data-field="${key}"]`);
    const err = $(`#${key}Error`);
    field.classList.toggle('is-invalid', !!message);
    field.classList.toggle('is-valid', !message);
    if (err) err.textContent = message;
    const input = key === 'nombre' ? nameInput : null;
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validate(key, force = false) {
    const message = validators[key]();
    if (force || touched.has(key)) showFieldState(key, message);
    return !message;
  }

  // Nombre: valida en tiempo real tras el primer blur
  nameInput.addEventListener('blur', () => { touched.add('nombre'); validate('nombre'); });
  nameInput.addEventListener('input', () => { if (touched.has('nombre')) validate('nombre'); });

  // Asistencia: habilita/deshabilita acompañantes
  $$('input[name="asistencia"]', form).forEach((radio) => {
    radio.addEventListener('change', () => {
      touched.add('asistencia');
      validate('asistencia');
      const declines = radio.value === 'No' && radio.checked;
      companions.disabled = declines;
      if (declines) $('input[name="acompanantes"][value="Solo yo"]', form).checked = true;
    });
  });

  // Contador de caracteres
  const updateCounter = () => {
    if (msgInput.value.length > MAX_MSG) msgInput.value = msgInput.value.slice(0, MAX_MSG);
    const n = msgInput.value.length;
    msgChars.textContent = n;
    msgCounter.classList.toggle('is-near', n >= MAX_MSG - 30);
  };
  msgInput.addEventListener('input', updateCounter);

  function setLoading(on) {
    submitting = on;
    submitBtn.disabled = on;
    submitBtn.classList.toggle('is-loading', on);
    submitBtn.setAttribute('aria-busy', String(on));
    submitLabel.textContent = on ? 'Enviando confirmación…' : 'Enviar confirmación';
  }

  function showAlert(text) {
    alertText.textContent = text;
    alertBox.hidden = false;
  }
  function hideAlert() { alertBox.hidden = true; alertText.textContent = ''; }

  async function sendRSVP(payload) {
    if (!SHEETS_CONFIG.endpoint) {
      // MODO DEMO: sin URL de Apps Script configurada
      await wait(1300);
      console.info('[RSVP · modo demo] Configura SHEETS_CONFIG.endpoint para guardar en Google Sheets.', payload);
      return { ok: true, demo: true };
    }

    const controller = 'AbortController' in window ? new AbortController() : null;
    const timeout = setTimeout(() => controller && controller.abort(), SHEETS_CONFIG.timeoutMs);
    try {
      // text/plain evita el preflight CORS con Apps Script
      const res = await fetch(SHEETS_CONFIG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: controller ? controller.signal : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = { ok: true };
      try { data = await res.json(); } catch (_) { /* respuesta no JSON: se asume OK */ }
      if (data && data.ok === false) throw new Error(data.error || 'server');
      if (data && data.stats) GuestCounter.render(data.stats);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return; // bloqueo de doble envío
    hideAlert();

    touched.add('nombre');
    touched.add('asistencia');
    const okName = validate('nombre', true);
    const okAtt = validate('asistencia', true);
    if (!okName || !okAtt) {
      if (!okName) nameInput.focus();
      else $('input[name="asistencia"]', form).focus();
      return;
    }

    // Honeypot: si un bot llenó el campo oculto, fingimos éxito
    if ($('#website').value) { renderSuccess('Invitado', 'Sí'); return; }

    if (navigator.onLine === false) {
      showAlert('Parece que no tienes conexión. Revisa tu internet y vuelve a intentarlo; tus datos siguen aquí.');
      return;
    }

    const asistencia = form.querySelector('input[name="asistencia"]:checked').value;
    const payload = {
      nombre: normalizeName(nameInput.value),
      asistencia,
      acompanantes: asistencia === 'Sí' ? form.querySelector('input[name="acompanantes"]:checked').value : '—',
      mensaje: msgInput.value.trim().slice(0, MAX_MSG),
      regalo: Array.from(form.querySelectorAll('input[name="regalo"]:checked')).map((i) => i.value).join(', '),
      website: '',
    };

    setLoading(true);
    try {
      await sendRSVP(payload);
      try { localStorage.setItem(RSVP_KEY, JSON.stringify({ nombre: payload.nombre, asistencia })); } catch (_) {}
      renderSuccess(payload.nombre, asistencia);
    } catch (err) {
      console.error('[RSVP] Error de envío:', err);
      const timedOut = err && err.name === 'AbortError';
      showAlert(timedOut
        ? 'La conexión está tardando más de lo normal. Inténtalo de nuevo en un momento.'
        : 'No pudimos enviar tu confirmación. Revisa tu conexión e inténtalo otra vez; tus datos siguen aquí.');
    } finally {
      setLoading(false);
    }
  });

  function renderSuccess(fullName, asistencia, quiet = false) {
    const first = fullName.split(' ')[0] || fullName;
    $('#successName').textContent = first;
    $('#successText').textContent = asistencia === 'Sí'
      ? 'Tu lugar está reservado. Nos vemos el viernes 27 frente al mar, con la copa lista.'
      : 'Gracias por avisar y por tus palabras. Te vamos a extrañar; habrá un brindis en tu nombre.';
    form.hidden = true;
    success.hidden = false;
    if (quiet) return;
    const title = $('#successTitle');
    title.focus({ preventScroll: true });
    success.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
  }

  $('#rsvpAgain').addEventListener('click', () => {
    try { localStorage.removeItem(RSVP_KEY); } catch (_) {}
    form.reset();
    companions.disabled = false;
    touched.clear();
    $$('.field', form).forEach((f) => f.classList.remove('is-invalid', 'is-valid'));
    $$('.field__error', form).forEach((p) => { p.textContent = ''; });
    updateCounter();
    success.hidden = true;
    form.hidden = false;
    nameInput.focus();
  });

  updateCounter();

  // Invitación personalizada (?para=Nombre): rellena el nombre
  const guest = getGuestName();
  if (guest) nameInput.value = guest;

  // Si ya confirmó desde este celular, muestra su respuesta
  try {
    const saved = JSON.parse(localStorage.getItem(RSVP_KEY) || 'null');
    if (saved && saved.nombre) renderSuccess(saved.nombre, saved.asistencia, true);
  } catch (_) {}
}

/* --------------------------------------------------------------------------
   Extras: invitación personalizada, calendario, compartir, contador
   -------------------------------------------------------------------------- */
const RSVP_KEY = 'rsvp-angie-22';

// Enlace personalizado: index.html?para=Valeria%20Castillo
function getGuestName() {
  try {
    const raw = new URLSearchParams(location.search).get('para') || '';
    const clean = raw.replace(/[^\p{L}'’.\- ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return clean;
  } catch (_) { return ''; }
}

function initPersonal() {
  const name = getGuestName();
  const el = $('#guestGreeting');
  if (!name || !el) return;
  el.textContent = `Hola, ${name.split(' ')[0]}`;
  el.hidden = false;
}

function initCalendar() {
  const title = 'Cumpleaños 22 de Angie Silupu';
  const details = 'Una noche junto al mar para celebrar los 22 años de Angie.';
  const where = `Costa de Piura (${EVENT_CONFIG.coordsText}) https://maps.google.com/?q=-5.0191183,-81.0619202`;
  const toUTC = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = toUTC(EVENT_CONFIG.start);
  const end = toUTC(EVENT_CONFIG.end);

  const g = $('#gcalBtn');
  if (g) {
    g.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + `&text=${encodeURIComponent(title)}&dates=${start}/${end}`
      + `&details=${encodeURIComponent(details)}&location=${encodeURIComponent(where)}`;
  }

  const ics = $('#icsBtn');
  if (ics) {
    ics.addEventListener('click', () => {
      const esc = (t) => t.replace(/([,;\\])/g, '\\$1');
      const body = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Angie22//Invitacion//ES', 'BEGIN:VEVENT',
        `UID:angie-22-${start}@invitacion`, `DTSTAMP:${toUTC(new Date().toISOString())}`,
        `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${esc(title)}`,
        `DESCRIPTION:${esc(details)}`, `LOCATION:${esc(where)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR',
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cumple-angie-22.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
  }
}

function initShare() {
  const btn = $('#shareBtn');
  if (!btn) return;
  const url = location.protocol.startsWith('http') ? location.origin + location.pathname : '';
  const text = `🎉 Estás invitado a los 22 de Angie Silupu · Viernes 27 de noviembre, frente al mar. Abre tu invitación: ${url}`;
  btn.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const GuestCounter = {
  render(stats) {
    const wrap = $('#guestCount');
    const num = $('#guestCountNum');
    if (!wrap || !num || !stats) return;
    const total = Number(stats.personas) || 0;
    if (total < 1) return;
    wrap.hidden = false;
    const from = Number(num.textContent) || 0;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1200);
      num.textContent = Math.round(from + (total - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
  async load() {
    if (!SHEETS_CONFIG.endpoint) return;
    try {
      const res = await fetch(SHEETS_CONFIG.endpoint, { redirect: 'follow' });
      const data = await res.json();
      if (data && data.ok) this.render(data.stats);
    } catch (_) { /* sin contador si falla */ }
  },
};

/* --------------------------------------------------------------------------
   Arranque
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initAudioToggle();
  initCover();
  initReveal();
  initGallery();
  initCountdown();
  initCopy();
  initRSVP();
  initPersonal();
  initCalendar();
  initShare();
  GuestCounter.load();
});
