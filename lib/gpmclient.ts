/**
 * gpmclient.js - support the gpm mouse protocol
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

import * as net from 'net';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { noop, alias } from './helpers';

const GPM_USE_MAGIC = false;

const GPM_MOVE = 1;
const GPM_DRAG = 2;
const GPM_DOWN = 4;
const GPM_UP = 8;

const GPM_DOUBLE = 32;
const GPM_MFLAG = 128;

const GPM_REQ_NOPASTE = 3
const GPM_HARD = 256;

const GPM_MAGIC = 0x47706D4C;
const GPM_SOCKET = '/dev/gpmctl';

interface GMPConnect {
  eventMask: number; // unsigned short
  defaultMask: number; // unsigned short
  minMod: number; // unsigned short
  maxMod: number; // unsigned short
  pid: number; // int
  vc: number; // int
}

function sendConfig(socket: net.Socket, connect: GMPConnect, callback = noop) {
  let buffer;
  if (GPM_USE_MAGIC) {
    buffer = new Buffer(20);
    buffer.writeUInt32LE(GPM_MAGIC, 0);
    buffer.writeUInt16LE(connect.eventMask, 4);
    buffer.writeUInt16LE(connect.defaultMask, 6);
    buffer.writeUInt16LE(connect.minMod, 8);
    buffer.writeUInt16LE(connect.maxMod, 10);
    buffer.writeInt16LE(process.pid, 12);
    buffer.writeInt16LE(connect.vc, 16);
  } else {
    buffer = new Buffer(16);
    buffer.writeUInt16LE(connect.eventMask, 0);
    buffer.writeUInt16LE(connect.defaultMask, 2);
    buffer.writeUInt16LE(connect.minMod, 4);
    buffer.writeUInt16LE(connect.maxMod, 6);
    buffer.writeInt16LE(connect.pid, 8);
    buffer.writeInt16LE(connect.vc, 12);
  }
  socket.write(buffer, noop);
}

// typedef struct Gpm_Event {
//   unsigned char buttons, modifiers;  // try to be a multiple of 4
//   unsigned short vc;
//   short dx, dy, x, y; // displacement x,y for this event, and absolute x,y
//   enum Gpm_Etype type;
//   // clicks e.g. double click are determined by time-based processing
//   int clicks;
//   enum Gpm_Margin margin;
//   // wdx/y: displacement of wheels in this event. Absolute values are not
//   // required, because wheel movement is typically used for scrolling
//   // or selecting fields, not for cursor positioning. The application
//   // can determine when the end of file or form is reached, and not
//   // go any further.
//   // A single mouse will use wdy, "vertical scroll" wheel.
//   short wdx, wdy;
// } Gpm_Event;

interface GMPEvent {
  // try to be a multiple of 4
  buttons: number; // unsigned char
  modifiers: number; // unsigned char

  vc: number; // unsigned short

  // displacement x,y for this event, and absolute x,y
  dx: number; // short
  dy: number; // short
  x: number; // short
  y: number; // short

  type: number; // enum Gpm_Etype

  // clicks e.g. double click are determined by time-based processing
  clicks: number; // int

  margin: number; // enum Gpm_Margin

  // wdx/y: displacement of wheels in this event. Absolute values are not
  // required, because wheel movement is typically used for scrolling
  // or selecting fields, not for cursor positioning. The application
  // can determine when the end of file or form is reached, and not
  // go any further.
  // A single mouse will use wdy, "vertical scroll" wheel.
  wdx: number; // short
  wdy: number; // short
}

function parseEvent(raw: Buffer): GMPEvent {
  return {
    buttons: raw[0],
    modifiers: raw[1],
    vc: raw.readUInt16LE(2),
    dx: raw.readInt16LE(4),
    dy: raw.readInt16LE(6),
    x: raw.readInt16LE(8),
    y: raw.readInt16LE(10),
    type: raw.readInt16LE(12),
    clicks: raw.readInt32LE(16),
    margin: raw.readInt32LE(20),
    wdx: raw.readInt16LE(24),
    wdy: raw.readInt16LE(26),
  }
}

export default class GpmClient extends EventEmitter {
  // socket
  private gpm: net.Socket;

  constructor() {
    super();

    const { pid } = process;

    // check tty for /dev/tty[n]
    let path;
    try {
      path = fs.readlinkSync(`/proc/${pid}/fd/0`);
    } catch (e) {}

    var ttyMatch = /tty[0-9]+$/.exec(path);
    if (ttyMatch === null) {
      // TODO: should  also check for /dev/input/..
    }

    let vc: number;
    let tty: string;
    if (ttyMatch) {
      tty = ttyMatch[0];
      vc = +/[0-9]+$/.exec(tty)[0];
    }

    if (tty) {
      fs.stat(GPM_SOCKET, (err, stat) => {
        if (err || !stat.isSocket()) {
          return;
        }

        const conf = {
          vc,
          pid,
          eventMask: 0xffff,
          defaultMask: GPM_MOVE | GPM_HARD,
          minMod: 0,
          maxMod: 0xffff,
        };

        const gpm = net.createConnection(GPM_SOCKET);
        this.gpm = gpm;

        gpm.on('connect', () => {
          sendConfig(gpm, conf, () => {
            // TODO: is this callback needed?
            conf.pid = 0;
            conf.vc = GPM_REQ_NOPASTE;
          });
        });

        gpm.on('data', (packet) => {
          const evnt = parseEvent(packet);
          switch (evnt.type & 15) {
            case GPM_MOVE:
              if (evnt.dx || evnt.dy) {
                this.emit('move', evnt.buttons, evnt.modifiers, evnt.x, evnt.y);
              }
              if (evnt.wdx || evnt.wdy) {
                this.emit('mousewheel',
                  evnt.buttons, evnt.modifiers,
                  evnt.x, evnt.y, evnt.wdx, evnt.wdy);
              }
              break;
            case GPM_DRAG:
              if (evnt.dx || evnt.dy) {
                this.emit('drag', evnt.buttons, evnt.modifiers, evnt.x, evnt.y);
              }
              if (evnt.wdx || evnt.wdy) {
                this.emit('mousewheel',
                  evnt.buttons, evnt.modifiers,
                  evnt.x, evnt.y, evnt.wdx, evnt.wdy);
              }
              break;
            case GPM_DOWN:
              this.emit('btndown', evnt.buttons, evnt.modifiers, evnt.x, evnt.y);
              if (evnt.type & GPM_DOUBLE) {
                this.emit('dblclick', evnt.buttons, evnt.modifiers, evnt.x, evnt.y);
              }
              break;
            case GPM_UP:
              this.emit('btnup', evnt.buttons, evnt.modifiers, evnt.x, evnt.y);
              if (!(evnt.type & GPM_MFLAG)) {
                this.emit('click', evnt.buttons, evnt.modifiers, evnt.x, evnt.y);
              }
              break;
          }
        });

        gpm.on('error', () => {
          this.stop();
        });
      });
    }
  }

  stop() {
    if (this.gpm) {
      this.gpm.end();
    }
    delete this.gpm;
  }

  @alias('ButtonName')
  buttonName(btn: number): string {
    if (btn & 4) {
      return 'left';
    }
    if (btn & 2) {
      return 'middle';
    }
    if (btn & 1) {
      return 'right';
    }
    return '';
  }

  hasShiftKey(mod: number): boolean {
    return !!(mod & 1);
  }

  hasCtrlKey(mod: number): boolean {
    return !!(mod & 4);
  }

  hasMetaKey(mod: number): boolean {
    return !!(mod & 8);
  }
}
