// Minimal Flappy Bird-like game ported from the Python/pygame project.
(() => {
  const SCREEN_W = 400, SCREEN_H = 600;
  const GRAVITY = 0.45;
  const FLAP_STRENGTH = -8;
  const PIPE_SPEED = 2.5;
  const PIPE_GAP = 150;
  const PIPE_FREQ = 1500;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const canvasWrap = document.getElementById('canvas-wrap');
  // internal logical size (used throughout the game for coordinates)
  const INTERNAL_W = SCREEN_W;
  const INTERNAL_H = SCREEN_H;

  // set the canvas internal pixel size accounting for devicePixelRatio
  function setCanvasInternalSize() {
    const dpr = window.devicePixelRatio || 1;
    // keep logical size fixed
    canvas.width = INTERNAL_W * dpr;
    canvas.height = INTERNAL_H * dpr;
    canvas.style.width = INTERNAL_W + 'px';
    canvas.style.height = INTERNAL_H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // scale canvas visually to fit its container while maintaining aspect ratio
  function fitCanvasToContainer() {
    const containerWidth = Math.min(canvasWrap.clientWidth, window.innerWidth - 32);
    // allow canvas to shrink to fit viewport height on small phones
    const maxHeight = Math.max(200, window.innerHeight - 160); // leave room for chrome/controls
    const aspect = INTERNAL_W / INTERNAL_H;
    let targetWidth = containerWidth;
    let targetHeight = Math.round(targetWidth / aspect);
    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = Math.round(targetHeight * aspect);
    }
    // apply CSS size (keeps drawing coordinate system unchanged)
    canvas.style.width = targetWidth + 'px';
    canvas.style.height = targetHeight + 'px';
    // center the canvas-wrap horizontally
    canvasWrap.style.justifyContent = 'center';
  }

  // call once to set internal resolution and fit
  function handleResize() {
    setCanvasInternalSize();
    fitCanvasToContainer();
  }
  window.addEventListener('resize', handleResize);
  const status = document.getElementById('status');

  // asset paths relative to site root
  const ASSET_ROOT = 'data';
  const IMG_ROOT = ASSET_ROOT + '/img';
  const SOUND_ROOT = ASSET_ROOT + '/sound';

  const images = {};
  const sounds = {};

  function loadImage(key, path) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images[key] = img; resolve(img); };
      img.onerror = () => { images[key] = null; resolve(null); };
      img.src = path;
    });
  }

  // load main images
  const loadAssets = () => Promise.all([
    loadImage('bg', IMG_ROOT + '/sprites/background-day.png'),
    loadImage('base', IMG_ROOT + '/sprites/base.png'),
    loadImage('pipe', IMG_ROOT + '/sprites/pipe-green.png'),
    loadImage('bird_up', IMG_ROOT + '/bird/yellowbird-upflap.png'),
    loadImage('bird_mid', IMG_ROOT + '/bird/yellowbird-midflap.png'),
    loadImage('bird_down', IMG_ROOT + '/bird/yellowbird-downflap.png')
  ]);

  // simple sound loader (optional)
  function tryLoadSound(key, path) {
    try {
      const a = new Audio(path);
      sounds[key] = a;
    } catch (e) {
      sounds[key] = null;
    }
  }

  tryLoadSound('wing', SOUND_ROOT + '/wing.wav');
  tryLoadSound('point', SOUND_ROOT + '/point.wav');
  tryLoadSound('hit', SOUND_ROOT + '/hit.wav');
  tryLoadSound('die', SOUND_ROOT + '/die.wav');
  tryLoadSound('swoosh', SOUND_ROOT + '/swoosh.wav');

  // Game objects
  class Bird {
    constructor() {
      this.x = 80;
      this.y = SCREEN_H / 2;
      this.vel = 0;
      this.frame = 0;
      this.frameTimer = 0;
      this.radius = 14;
    }
    flap() {
      this.vel = FLAP_STRENGTH;
      if (sounds.wing) try { sounds.wing.currentTime = 0; sounds.wing.play(); } catch(e){}
    }
    update(dt) {
      this.vel += GRAVITY;
      this.y += this.vel;
      this.frameTimer += dt;
      if (this.frameTimer > 120) { this.frame = (this.frame + 1) % 3; this.frameTimer = 0; }
    }
    draw(ctx) {
      const frames = [images.bird_up, images.bird_mid, images.bird_down].filter(Boolean);
      if (frames.length) {
        const img = frames[this.frame % frames.length];
        const angle = Math.max(-25, Math.min(90, -this.vel * 3));
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle * Math.PI / 180);
        ctx.drawImage(img, -img.width/2, -img.height/2);
        ctx.restore();
      } else {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
      }
    }
    rect() {
      const frames = [images.bird_up, images.bird_mid, images.bird_down].filter(Boolean);
      if (frames.length) {
        const img = frames[this.frame % frames.length];
        return { x: this.x - img.width/2, y: this.y - img.height/2, w: img.width, h: img.height };
      }
      return { x: this.x - this.radius, y: this.y - this.radius, w: this.radius*2, h: this.radius*2 };
    }
  }

  class Pipe {
    constructor(x) {
      this.x = x;
      this.passed = false;
      // Keep pipe width equal to the source image width when available to avoid horizontal distortion
      this.width = images.pipe ? images.pipe.width : 60;
      const min_top = 20;
      const max_top = SCREEN_H - PIPE_GAP - (images.base ? images.base.height : 80) - 20;
      this.top_height = Math.floor(Math.random() * (max_top - min_top + 1)) + min_top;
    }
    update() { this.x -= PIPE_SPEED; }
    draw(ctx) {
      if (images.pipe) {
        const img = images.pipe;
        const top_h = this.top_height;
        const bottom_y = this.top_height + PIPE_GAP;
        const bottom_h = SCREEN_H - bottom_y - (images.base ? images.base.height : 80);

        // Heuristic cap height: assume the pipe image has a cap at the top taking ~20% of height
        // If this assumption doesn't match the artwork, we can tweak capRatio.
        const capH = Math.max(8, Math.min(48, Math.floor(img.height * 0.20)));
        const bodySrcY = Math.min(img.height - 2, capH + 1);

        // Draw top pipe (flipped vertically). We draw the cap and then a stretched body slice to fill remaining height.
        if (top_h > 0) {
          const bodyH = Math.max(0, top_h - capH);
          ctx.save();
          // Flip vertically to draw the top pipe
          ctx.translate(this.x, 0);
          ctx.scale(1, -1);
          // Draw cap (from top of source image)
          ctx.drawImage(img, 0, 0, img.width, capH, 0, -top_h, this.width, capH);
          // Draw body by stretching a 1px-high slice from the source image; this preserves texture without stretching the cap
          if (bodyH > 0) {
            ctx.drawImage(img, 0, bodySrcY, img.width, 1, 0, -top_h + capH, this.width, bodyH);
          }
          ctx.restore();
        }

        // Draw bottom pipe
        if (bottom_h > 0) {
          const bodyH = Math.max(0, bottom_h - capH);
          // Draw cap at the top of bottom pipe
          ctx.drawImage(img, 0, 0, img.width, capH, this.x, bottom_y, this.width, capH);
          // Draw body by stretching a 1px-high slice to fill remaining height
          if (bodyH > 0) {
            ctx.drawImage(img, 0, bodySrcY, img.width, 1, this.x, bottom_y + capH, this.width, bodyH);
          }
        }
      } else {
        ctx.fillStyle = '#228b22';
        ctx.fillRect(this.x, 0, this.width, this.top_height);
        ctx.fillRect(this.x, this.top_height + PIPE_GAP, this.width, SCREEN_H - (this.top_height + PIPE_GAP) - (images.base?images.base.height:80));
      }
    }
    collidesWith(r) {
      const top = { x: this.x, y: 0, w: this.width, h: this.top_height };
      const bottom = { x: this.x, y: this.top_height + PIPE_GAP, w: this.width, h: SCREEN_H - (this.top_height + PIPE_GAP) - (images.base?images.base.height:80) };
      return rectsOverlap(r, top) || rectsOverlap(r, bottom);
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // game state
  let bird, pipes, score, running, gameOver, baseScroll, bestScore;
  let lastPipeTime = 0;
  let lastTime = 0;

  function reset() {
    bird = new Bird();
    pipes = [];
    score = 0;
    running = true;
    gameOver = false;
    baseScroll = 0;
    bestScore = parseInt(localStorage.getItem('best_score') || '0', 10);
  }

  function spawnPipe() { pipes.push(new Pipe(SCREEN_W + 20)); }

  function update(dt) {
    if (!gameOver) {
      bird.update(dt);
      pipes.forEach(p => p.update());
      pipes = pipes.filter(p => p.x + p.width > -10);
      pipes.forEach(p => {
        if (!p.passed && p.x + p.width < bird.x) { p.passed = true; score++; if (sounds.point) try{ sounds.point.play(); }catch(e){} }
      });
      const br = bird.rect();
      if (bird.y <= 0 || bird.y >= SCREEN_H - (images.base ? images.base.height : 80)) {
        gameOver = true; if (sounds.die) try{ sounds.die.play(); }catch(e){}
        if (score > bestScore) { bestScore = score; localStorage.setItem('best_score', bestScore); }
      }
      for (const p of pipes) { if (p.collidesWith(br)) { gameOver = true; if (sounds.hit) try{ sounds.hit.play(); }catch(e){} if (score > bestScore) { bestScore = score; localStorage.setItem('best_score', bestScore); } } }
    }
    if (!gameOver) baseScroll += PIPE_SPEED;
  }

  function draw() {
    // background
    if (images.bg) ctx.drawImage(images.bg, 0, 0, SCREEN_W, SCREEN_H);
    else { ctx.fillStyle = '#87ceeb'; ctx.fillRect(0,0,SCREEN_W,SCREEN_H); }
    // pipes
    pipes.forEach(p => p.draw(ctx));
    // ground
    if (images.base) {
      const w = images.base.width;
      let x = -Math.floor(baseScroll) % w;
      x -= w;
      while (x < SCREEN_W) { ctx.drawImage(images.base, x, SCREEN_H - images.base.height); x += w; }
    } else {
      ctx.fillStyle = '#deb887'; ctx.fillRect(0, SCREEN_H - 80, SCREEN_W, 80);
    }
    bird.draw(ctx);
    // text
    ctx.fillStyle = '#141414'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Score: ' + score, SCREEN_W/2, 30);
    ctx.fillText('Best: ' + bestScore, SCREEN_W/2, 60);
    if (gameOver) {
      ctx.font = '48px sans-serif'; ctx.fillText('Game Over', SCREEN_W/2, SCREEN_H/2 - 30);
      ctx.font = '16px sans-serif'; ctx.fillText('Press SPACE or Click to restart', SCREEN_W/2, SCREEN_H/2 + 20);
    }
  }

  function gameLoop(t) {
    if (!lastTime) lastTime = t;
    const dt = t - lastTime;
    lastTime = t;
    // spawn pipes on timer
    if (t - lastPipeTime > PIPE_FREQ && !gameOver) { spawnPipe(); lastPipeTime = t; }
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
  }

  // input
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (gameOver) reset(); else bird.flap();
    } else if (e.code === 'KeyR') { reset(); }
  });
  canvas.addEventListener('mousedown', () => { if (gameOver) reset(); else bird.flap(); });
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (gameOver) reset(); else bird.flap(); }, {passive:false});

  // start
  loadAssets().then(() => {
    reset();
  status.textContent = '';
  // size canvas for current device and viewport
  if (typeof handleResize === 'function') handleResize();
  requestAnimationFrame(gameLoop);
  }).catch((e) => {
    status.textContent = 'Failed to load assets.';
    console.error(e);
  });

})();
