/**
 * ansiimage.js - render PNGS/GIFS as ANSI
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

import * as cp from 'child_process';
import * as colors from '../colors';

import Box from './box';
import tng from '../../vendor/tng';

export default class ANSIImage extends Box {
  public type = 'ansiimage';
  private _noFill = true;
  public scale: number;

  constructor(options = {}) {
    super({
      ...options,
      shrink: true,
    });

    this.scale = this.options.scale || 1.0;
    this.options.animate = !!this.options.animate;

    if (this.options.file) {
      this.setImage(this.options.file);
    }

    this.screen.on('prerender', () => {
      var lpos = this.lpos;
      if (!lpos) {
        return;
      }
      // prevent image from blending with itself if there are alpha channels
      this.screen.clearRegion(
        lpos.xi,
        lpos.xl,
        lpos.yi,
        lpos.yl,
      );
    });

    this.on('destroy', () => {
      this.stop();
    });
  }

  // TODO: replace this with native node call?
  static curl(url: string) {
    try {
      return cp.execFileSync('curl',
        ['-s', '-A', '', url],
        { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {}
    try {
      return cp.execFileSync('wget',
        ['-U', '', '-O', '-', url],
        { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {}
    throw new Error('curl or wget failed.');
  };

  setImage(file: string) {
    this.file = typeof file === 'string' ? file : null;

    if (/^https?:/.test(file)) {
      file = ANSIImage.curl(file);
    }

    let { width, height } = this.position;

    if (width != null) {
      width = this.width;
    }

    if (height != null) {
      height = this.height;
    }

    try {
      this.setContent('');

      this.img = tng(file, {
        colors,
        width,
        height,
        scale: this.scale,
        ascii: this.options.ascii,
        speed: this.options.speed,
        filename: this.file,
      });

      if (width == null || height == null) {
        this.width = this.img.cellmap[0].length;
        this.height = this.img.cellmap.length;
      }

      if (this.img.frames && this.options.animate) {
        this.play();
      } else {
        this.cellmap = this.img.cellmap;
      }
    } catch (e) {
      this.setContent('Image Error: ' + e.message);
      this.img = null;
      this.cellmap = null;
    }
  }

  play() {
    if (!this.img) {
      return;
    }
    return this.img.play((bmp, cellmap) => {
      this.cellmap = cellmap;
      this.screen.render();
    });
  }

  pause() {
    if (!this.img) {
      return;
    }
    return this.img.pause();
  }

  stop() {
    if (!this.img) {
      return;
    }
    return this.img.stop();
  }

  clearImage() {
    this.stop();
    this.setContent('');
    this.img = null;
    this.cellmap = null;
  }

  render() {
    const coords = this._render();
    if (!coords) {
      return;
    }

    if (this.img && this.cellmap) {
      this.img.renderElement(this.cellmap, this);
    }

    return coords;
  }
}
