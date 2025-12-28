import {
  Component,
  AfterViewInit,
  OnDestroy,
  HostListener,
  ElementRef,
  ViewChild,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-confitti',
  templateUrl: './confitti.component.html',
  styleUrls: ['./confitti.component.css'],
})
export class ConfittiComponent implements AfterViewInit, OnDestroy {
  @ViewChild('fwCanvas', { static: false })
  fwCanvas!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private isBrowser = false;

  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    const canvas = this.fwCanvas.nativeElement;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    this.resizeCanvas();
    this.initFireworks();
    this.animate();

    window.addEventListener('resize', this.resizeCanvas);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    if (this.animationId) cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resizeCanvas);
  }

  resizeCanvas = () => {
    const canvas = this.fwCanvas.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  // -------------------------------------------------------
  // COLORS
  // -------------------------------------------------------
  COLORS = [
    '#FF8C00',
    '#FF0000',
    '#FFD700',
    '#00FF00',
    '#00BFFF',
    '#0000FF',
    '#FF00FF',
  ];

  fireworks: any[] = [];
  MAX_FIREWORKS = 30;
  AUTO_RESPAWN = true;

  // -------------------------------------------------------
  // PARTICLE CLASS
  // -------------------------------------------------------
  Particle = class {
    alpha = 1;
    size = 1.3;
    decay = 0.01 + Math.random() * 0.01;
    vx: number;
    vy: number;

    constructor(
      public x: number,
      public y: number,
      public color: string,
      angle: number,
      speed: number
    ) {
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.alpha -= this.decay;
      return this.alpha > 0;
    }
  };

  // -------------------------------------------------------
  // FIREWORK CLASS
  // -------------------------------------------------------
  Firework = class {
    exploded = false;
    dead = false;
    particles: any[] = [];
    curveX: number;
    speed: number;

    constructor(
      private parent: ConfittiComponent,
      public x: number,
      public y: number,
      public targetY: number,
      public color: string,
      public delay: number
    ) {
      this.curveX = x + (Math.random() * 200 - 100);
      this.speed = 6 + Math.random() * 2;
    }

    update() {
      if (this.dead) return;

      if (this.delay > 0) {
        this.delay -= 0.016;
        return;
      }

      if (!this.exploded) {
        this.y -= this.speed;
        this.x += (this.curveX - this.x) * 0.02;

        if (this.y <= this.targetY) {
          this.explode();
        }
      }

      if (this.exploded) {
        this.particles = this.particles.filter((p) => p.update());
        if (this.particles.length === 0) this.dead = true;
      }
    }

    explode() {
      this.exploded = true;
      const count = 130;

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = Math.random() * 2 + 1;
        this.particles.push(
          new this.parent.Particle(this.x, this.y, this.color, angle, speed)
        );
      }
    }
  };

  // -------------------------------------------------------
  // INIT FIREWORKS
  // -------------------------------------------------------
  initFireworks() {
    const canvas = this.fwCanvas.nativeElement;

    for (let i = 0; i < this.MAX_FIREWORKS; i++) {
      const delay = (i / this.MAX_FIREWORKS) * 2.5;
      const x = Math.random() * canvas.width;
      const y = canvas.height;
      const targetY = canvas.height * (0.2 + Math.random() * 0.55);
      const color = this.COLORS[Math.floor(Math.random() * this.COLORS.length)];

      this.fireworks.push(new this.Firework(this, x, y, targetY, color, delay));
    }
  }

  // -------------------------------------------------------
  // ANIMATION LOOP
  // -------------------------------------------------------
  animate = () => {
    const canvas = this.fwCanvas.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.fireworks = this.fireworks.filter((fw) => !fw.dead);

    this.fireworks.forEach((fw) => {
      fw.update();

      // rocket head
      if (!fw.exploded && fw.delay <= 0) {
        this.ctx.fillStyle = fw.color;
        this.ctx.beginPath();
        this.ctx.arc(fw.x, fw.y, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // sparks
      fw.particles.forEach((p: any) => {
        this.ctx.globalAlpha = p.alpha;
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      });

      this.ctx.globalAlpha = 1;
    });

    // respawn new fireworks
    if (this.AUTO_RESPAWN && this.fireworks.length < this.MAX_FIREWORKS) {
      const x = Math.random() * canvas.width;
      const y = canvas.height;
      const targetY = canvas.height * (0.2 + Math.random() * 0.55);
      const color = this.COLORS[Math.floor(Math.random() * this.COLORS.length)];
      const delay = Math.random() * 1.5;

      this.fireworks.push(new this.Firework(this, x, y, targetY, color, delay));
    }

    this.animationId = requestAnimationFrame(this.animate);
  };
}
