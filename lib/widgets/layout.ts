/**
 * layout.js - layout element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

import Element from './element';

export default class Layout extends Element {

  public type = 'layout';

  constructor(options = {}) {
    if ((options.width == null
        && (options.left == null && options.right == null))
        || (options.height == null
        && (options.top == null && options.bottom == null))) {
      throw new Error('`Layout` must have a width and height!');
    }

    options.layout = options.layout || 'inline';

    super(options);

    if (options.renderer) {
      this.renderer = options.renderer;
    }
  }


  isRendered(el: Element): boolean {
    if (!el.lpos) {
      return false;
    }
    return (el.lpos.xl - el.lpos.xi) > 0
        && (el.lpos.yl - el.lpos.yi) > 0;
  }

  getLast(i: number): Element | null {
    while (this.children[--i]) {
      const el = this.children[i];
      if (this.isRendered(el)) {
        return el;
      }
    }
    return null;
  }

  getLastCoords(i: number): number {
    const last = this.getLast(i);
    if (last) {
      return last.lpos;
    }
  }

  _renderCoords() {
    const coords = this._getCoords(true);
    const children = this.children;
    this.children = [];
    this._render();
    this.children = children;
    return coords;
  }

  renderer(coords) {
    // The coordinates of the layout element
    const width = coords.xl - coords.xi;
    const height = coords.yl - coords.yi;
    const { xi, yi } = coords;

    // The current row offset in cells (which row are we on?)
    let rowOffset = 0;

    // The index of the first child in the row
    let rowIndex = 0;
    let lastRowIndex = 0;

    // Figure out the highest width child
    let highWidth: number;
    if (this.options.layout === 'grid') {
      highWidth = this.children.reduce(
         (out, el) => Math.max(out, el.width), 0);
    }

    return (el, i) => {
      // Make our children shrinkable. If they don't have a height, for
      // example, calculate it for them.
      el.shrink = true;

      // Find the previous rendered child's coordinates
      const last = this.getLast(i);

      // If there is no previously rendered element, we are on the first child.
      if (!last) {
        el.position.left = 0;
        el.position.top = 0;
      } else {
        // Otherwise, figure out where to place this child. We'll start by
        // setting it's `left`/`x` coordinate to right after the previous
        // rendered element. This child will end up directly to the right of it.
        el.position.left = last.lpos.xl - xi;

        // Make sure the position matches the highest width element
        if (this.options.layout === 'grid') {
          // Compensate with width:
          // el.position.width = el.width + (highWidth - el.width);
          // Compensate with position:
          el.position.left += highWidth - (last.lpos.xl - last.lpos.xi);
        }

        // If our child does not overlap the right side of the Layout, set it's
        // `top`/`y` to the current `rowOffset` (the coordinate for the current
        // row).
        if (el.position.left + el.width <= width) {
          el.position.top = rowOffset;
        } else {
          // Otherwise we need to start a new row and calculate a new
          // `rowOffset` and `rowIndex` (the index of the child on the current
          // row).
          rowOffset += this.children.slice(rowIndex, i).reduce(
            (out, el) => !this.isRendered(el)
              ? out
              : Math.max(out, el.lpos.yl - el.lpos.yi),
            0);
          lastRowIndex = rowIndex;
          rowIndex = i;
          el.position.left = 0;
          el.position.top = rowOffset;
        }
      }

      // Make sure the elements on lower rows graviatate up as much as possible
      if (this.options.layout === 'inline') {
        let above = null;
        let abovea = Infinity;
        for (let j = lastRowIndex; j < rowIndex; j++) {
          let l = self.children[j];
          if (!self.isRendered(l)) {
            continue;
          }
          const abs = Math.abs(el.position.left - (l.lpos.xi - xi));
          if (abs < abovea) {
            above = l;
            abovea = abs;
          }
        }
        if (above) {
          el.position.top = above.lpos.yl - yi;
        }
      }
    };
  }

  render() {
    this._emit('prerender');

    const coords = this._renderCoords();
    if (!coords) {
      delete this.lpos;
      return;
    }

    if (coords.xl - coords.xi <= 0) {
      coords.xl = Math.max(coords.xl, coords.xi);
      return;
    }

    if (coords.yl - coords.yi <= 0) {
      coords.yl = Math.max(coords.yl, coords.yi);
      return;
    }

    this.lpos = coords;

    if (this.border) {
      coords.xi++;
      coords.xl--;
      coords.yi++;
      coords.yl--;
    }

    if (this.tpadding) {
      coords.xi += this.padding.left;
      coords.xl -= this.padding.right;
      coords.yi += this.padding.top;
      coords.yl -= this.padding.bottom;
    }

    const iterator = this.renderer(coords);

    if (this.border) {
      coords.xi--;
      coords.xl++;
      coords.yi--;
      coords.yl++;
    }

    if (this.tpadding) {
      coords.xi -= this.padding.left;
      coords.xl += this.padding.right;
      coords.yi -= this.padding.top;
      coords.yl += this.padding.bottom;
    }

    this.children.forEach((el, i) => {
      if (el.screen._ci !== -1) {
        el.index = el.screen._ci++;
      }
      const rendered = iterator(el, i);
      if (rendered === false) {
        delete el.lpos;
        return;
      }
      el.render();
    });

    this._emit('render', [coords]);

    return coords;
  }
}
