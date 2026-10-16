import * as THREE from 'three';

export class TextureGenerator {
  private static maxAnisotropy = 8;

  public static setMaxAnisotropy(val: number) {
    this.maxAnisotropy = val;
  }

  private static createTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = this.maxAnisotropy;
    tex.generateMipmaps = true;
    return tex;
  }

  // 1. Dust II Sandstone Brick Wall (Rich Desert Ochre + Mortar + Normal Map)
  public static createDust2Wall(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const nCanvas = document.createElement('canvas');
    nCanvas.width = size;
    nCanvas.height = size;
    const nCtx = nCanvas.getContext('2d')!;

    // Rich warm desert sandstone base
    ctx.fillStyle = '#b8905a';
    ctx.fillRect(0, 0, size, size);

    nCtx.fillStyle = '#8080ff';
    nCtx.fillRect(0, 0, size, size);

    const rows = 8;
    const rowH = size / rows;

    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      const cols = 4;
      const colW = size / cols;
      const offsetX = (r % 2 === 0) ? 0 : colW / 2;

      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offsetX;

        const shade = Math.floor(Math.random() * 32 - 16);
        ctx.fillStyle = `rgb(${184 + shade}, ${144 + shade}, ${90 + shade})`;
        ctx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);

        // Stone texture noise
        const imgData = ctx.getImageData(x + 3, y + 3, colW - 6, rowH - 6);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 30;
          data[i] = Math.max(0, Math.min(255, data[i] + noise));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, x + 3, y + 3);

        // Deep mortar grooves in normal map
        nCtx.fillStyle = '#5555d0';
        nCtx.fillRect(x, y, colW, 5);
        nCtx.fillRect(x, y, 5, rowH);
      }
    }

    const rCanvas = document.createElement('canvas');
    rCanvas.width = size;
    rCanvas.height = size;
    const rCtx = rCanvas.getContext('2d')!;
    rCtx.fillStyle = '#d0d0d0';
    rCtx.fillRect(0, 0, size, size);

    return {
      map: this.createTexture(canvas),
      normalMap: this.createTexture(nCanvas),
      roughnessMap: this.createTexture(rCanvas),
    };
  }

  // 2. Dust II Ground Sandstone Pavement Tiles
  public static createDust2Ground(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#a8824e';
    ctx.fillRect(0, 0, size, size);

    const tileSize = 64;
    for (let y = 0; y < size; y += tileSize) {
      for (let x = 0; x < size; x += tileSize) {
        const tone = Math.floor(Math.random() * 26 - 13);
        ctx.fillStyle = `rgb(${168 + tone}, ${130 + tone}, ${78 + tone})`;
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

        ctx.strokeStyle = '#6e512d';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    // Sand grain overlay
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 32;
      data[i] += n;
      data[i + 1] += n;
      data[i + 2] += n;
    }
    ctx.putImageData(imgData, 0, 0);

    const nCanvas = document.createElement('canvas');
    nCanvas.width = size;
    nCanvas.height = size;
    const nCtx = nCanvas.getContext('2d')!;
    nCtx.fillStyle = '#8080ff';
    nCtx.fillRect(0, 0, size, size);
    nCtx.strokeStyle = '#5555c0';
    nCtx.lineWidth = 4;
    for (let y = 0; y < size; y += tileSize) {
      for (let x = 0; x < size; x += tileSize) {
        nCtx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    return {
      map: this.createTexture(canvas),
      normalMap: this.createTexture(nCanvas),
    };
  }

  // 3. Wooden CS2 Military Crate with Stencil and Metal Corners
  public static createWoodCrate(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#784a1e';
    ctx.fillRect(0, 0, size, size);

    const planks = 6;
    const plankH = size / planks;
    for (let i = 0; i < planks; i++) {
      const y = i * plankH;
      const woodShade = Math.floor(Math.random() * 24 - 12);
      ctx.fillStyle = `rgb(${120 + woodShade}, ${74 + woodShade}, ${30 + woodShade})`;
      ctx.fillRect(0, y + 2, size, plankH - 4);

      ctx.strokeStyle = 'rgba(50, 25, 10, 0.4)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 12; g++) {
        const lineY = y + 4 + Math.random() * (plankH - 8);
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.bezierCurveTo(size * 0.3, lineY + Math.random() * 4 - 2, size * 0.7, lineY + Math.random() * 4 - 2, size, lineY);
        ctx.stroke();
      }

      ctx.fillStyle = '#2d1808';
      ctx.fillRect(0, y, size, 4);
    }

    // Heavy Metal Corner Brackets and Rivets
    ctx.fillStyle = '#343a40';
    const bW = 48;
    ctx.fillRect(0, 0, bW, bW);
    ctx.fillRect(size - bW, 0, bW, bW);
    ctx.fillRect(0, size - bW, bW, bW);
    ctx.fillRect(size - bW, size - bW, bW, bW);

    ctx.strokeStyle = '#212529';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, size - 16, size - 16);

    ctx.fillStyle = '#ced4da';
    const rivetPositions = [
      [24, 24], [size - 24, 24], [24, size - 24], [size - 24, size - 24],
      [size / 2, 12], [size / 2, size - 12], [12, size / 2], [size - 12, size / 2]
    ];
    for (const [rx, ry] of rivetPositions) {
      ctx.beginPath();
      ctx.arc(rx, ry, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 38px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CS2 CARGO', size / 2, size / 2 - 12);
    ctx.font = 'bold 22px monospace';
    ctx.fillText('FRAGILE // A-SITE', size / 2, size / 2 + 22);

    const nCanvas = document.createElement('canvas');
    nCanvas.width = size;
    nCanvas.height = size;
    const nCtx = nCanvas.getContext('2d')!;
    nCtx.fillStyle = '#8080ff';
    nCtx.fillRect(0, 0, size, size);

    nCtx.fillStyle = '#6555c5';
    for (let i = 0; i < planks; i++) {
      nCtx.fillRect(0, i * plankH, size, 5);
    }

    return {
      map: this.createTexture(canvas),
      normalMap: this.createTexture(nCanvas),
    };
  }

  // 4. Corrugated Shipping Container
  public static createContainer(colorHex: string = '#1f4874'): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, size, size);

    const ridgeWidth = 24;
    for (let x = 0; x < size; x += ridgeWidth) {
      const grad = ctx.createLinearGradient(x, 0, x + ridgeWidth, 0);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.05)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, ridgeWidth, size);
    }

    ctx.fillStyle = 'rgba(120, 60, 20, 0.5)';
    for (let i = 0; i < 35; i++) {
      ctx.fillRect(Math.random() * size, (Math.random() > 0.5 ? Math.random() * 35 : size - 35), Math.random() * 18, Math.random() * 18);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('CS2 CONTAINER 40FT', 30, 70);
    ctx.font = '16px monospace';
    ctx.fillText('NET WT: 28,450 KG', 30, 100);

    const nCanvas = document.createElement('canvas');
    nCanvas.width = size;
    nCanvas.height = size;
    const nCtx = nCanvas.getContext('2d')!;
    nCtx.fillStyle = '#8080ff';
    nCtx.fillRect(0, 0, size, size);

    for (let x = 0; x < size; x += ridgeWidth) {
      nCtx.fillStyle = '#5555ff';
      nCtx.fillRect(x, 0, ridgeWidth / 2, size);
      nCtx.fillStyle = '#aaaaff';
      nCtx.fillRect(x + ridgeWidth / 2, 0, ridgeWidth / 2, size);
    }

    return {
      map: this.createTexture(canvas),
      normalMap: this.createTexture(nCanvas),
    };
  }

  // 5. Urban Asphalt Road with Lane Stripes (for Tashkent)
  public static createAsphaltRoad(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Dark gritty tarmac (NOT white!)
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 40;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Weathered White Double Center Stripes
    ctx.fillStyle = 'rgba(235, 240, 248, 0.85)';
    ctx.fillRect(size / 2 - 12, 0, 8, size);
    ctx.fillRect(size / 2 + 4, 0, 8, size);

    const nCanvas = document.createElement('canvas');
    nCanvas.width = size;
    nCanvas.height = size;
    const nCtx = nCanvas.getContext('2d')!;
    nCtx.fillStyle = '#8080ff';
    nCtx.fillRect(0, 0, size, size);

    return {
      map: this.createTexture(canvas),
      normalMap: this.createTexture(nCanvas),
    };
  }

  // 6. Urban Granite Paver Tiles (replaces the blinding flat white marble!)
  public static createUrbanGranite(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Rich neutral urban stone granite (NOT pure white!)
    ctx.fillStyle = '#5c636e';
    ctx.fillRect(0, 0, size, size);

    const tileSize = 64;
    for (let y = 0; y < size; y += tileSize) {
      for (let x = 0; x < size; x += tileSize) {
        const tone = Math.floor(Math.random() * 28 - 14);
        ctx.fillStyle = `rgb(${92 + tone}, ${99 + tone}, ${110 + tone})`;
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

        ctx.strokeStyle = '#32373f';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    // Granite speckle noise
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 35;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    const nCanvas = document.createElement('canvas');
    nCanvas.width = size;
    nCanvas.height = size;
    const nCtx = nCanvas.getContext('2d')!;
    nCtx.fillStyle = '#8080ff';
    nCtx.fillRect(0, 0, size, size);
    nCtx.strokeStyle = '#5555c5';
    nCtx.lineWidth = 4;
    for (let y = 0; y < size; y += tileSize) {
      for (let x = 0; x < size; x += tileSize) {
        nCtx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    return {
      map: this.createTexture(canvas),
      normalMap: this.createTexture(nCanvas),
    };
  }

  // 7. City Building Facade with Windows and Balconies
  public static createBuildingFacade(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Warm concrete & limestone facade
    ctx.fillStyle = '#8f8374';
    ctx.fillRect(0, 0, size, size);

    // Grid of office/apartment windows
    const winW = 40;
    const winH = 65;
    const gapX = 35;
    const gapY = 40;

    for (let y = 25; y < size; y += winH + gapY) {
      for (let x = 20; x < size; x += winW + gapX) {
        // Window Frame (Dark metal)
        ctx.fillStyle = '#22262a';
        ctx.fillRect(x - 3, y - 3, winW + 6, winH + 6);

        // Glass reflection (Sky blue with blinds/interior)
        const isLit = Math.random() > 0.6;
        ctx.fillStyle = isLit ? '#3a506b' : '#1a222e';
        ctx.fillRect(x, y, winW, winH);

        // Window mullion
        ctx.strokeStyle = '#22262a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + winW / 2, y);
        ctx.lineTo(x + winW / 2, y + winH);
        ctx.moveTo(x, y + winH * 0.4);
        ctx.lineTo(x + winW, y + winH * 0.4);
        ctx.stroke();

        // Window ledge / sill
        ctx.fillStyle = '#554e44';
        ctx.fillRect(x - 6, y + winH + 1, winW + 12, 6);
      }
    }

    return this.createTexture(canvas);
  }

  // 8. Authentic CS2 Bullet Hole Decal Texture
  public static createBulletHoleTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const center = size / 2;

    ctx.clearRect(0, 0, size, size);

    // Outer crater scorch ring
    const scorchGrad = ctx.createRadialGradient(center, center, 10, center, center, 48);
    scorchGrad.addColorStop(0, 'rgba(30, 32, 36, 0.95)');
    scorchGrad.addColorStop(0.5, 'rgba(80, 85, 92, 0.6)');
    scorchGrad.addColorStop(0.85, 'rgba(180, 185, 195, 0.3)');
    scorchGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = scorchGrad;
    ctx.beginPath();
    ctx.arc(center, center, 48, 0, Math.PI * 2);
    ctx.fill();

    // Jagged radiating impact cracks
    ctx.strokeStyle = 'rgba(20, 22, 25, 0.85)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8 + Math.random() * 0.4;
      const len = Math.random() * 22 + 25;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(center + Math.cos(angle) * len, center + Math.sin(angle) * len);
      ctx.stroke();
    }

    // Deep black penetration core
    ctx.fillStyle = '#060709';
    ctx.beginPath();
    ctx.arc(center, center, 14, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    return tex;
  }

  // 9. Realistic Foliage Texture for Trees (Rich organic green with depth)
  public static createFoliageTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#22481e';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 350; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 12 + 4;
      const shade = Math.floor(Math.random() * 40 - 20);
      ctx.fillStyle = `rgb(${34 + shade}, ${72 + shade * 1.5}, ${30 + shade})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    return this.createTexture(canvas);
  }

  // 10. Tactical Camouflage
  public static createTacticalCamo(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#3c4636';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#22241d';
    for (let i = 0; i < 22; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 24 + 10, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#555d44';
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 18 + 8, 0, Math.PI * 2);
      ctx.fill();
    }

    return this.createTexture(canvas);
  }

  // 11. Atmospheric CS2 Skybox
  public static createSkyTexture(isDesert: boolean = true): THREE.CanvasTexture {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (isDesert) {
      grad.addColorStop(0, '#245a9e');
      grad.addColorStop(0.45, '#5d8ec4');
      grad.addColorStop(0.8, '#b8a688');
      grad.addColorStop(1, '#d8b682');
    } else {
      // Crisp Tashkent Sky with atmospheric mountain horizon
      grad.addColorStop(0, '#1c4a86');
      grad.addColorStop(0.5, '#4a7db8');
      grad.addColorStop(0.85, '#8fa6bc');
      grad.addColorStop(1, '#b0c2d2');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Distant mountain ridge silhouette on horizon
    ctx.fillStyle = isDesert ? 'rgba(160, 120, 80, 0.45)' : 'rgba(70, 95, 125, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for (let x = 0; x <= canvas.width; x += 40) {
      const peak = canvas.height * 0.85 - Math.sin(x * 0.015) * 25 - Math.cos(x * 0.04) * 15;
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();

    // Soft Wispy Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (let i = 0; i < 14; i++) {
      const cx = (i * 85 + 30) % canvas.width;
      const cy = canvas.height * 0.35 + Math.random() * 35;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 65 + Math.random() * 30, 16 + Math.random() * 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }
}
