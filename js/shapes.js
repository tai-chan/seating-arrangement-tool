window.SeatApp = window.SeatApp || {};

(function () {
  'use strict';

  var COLORS = {
    red: '#d9534f',
    blue: '#4a7fd6',
    green: '#4caf6e',
    yellow: '#e0c341'
  };
  var DEFAULT_TABLE_COLOR = 'blue';
  var NEUTRAL_FILL = '#c9d6e3';
  var SEAT_FILL = '#fdf1dc';
  var SEAT_STROKE = '#5b4636';
  var DESK_STROKE = '#33475b';

  var SEAT_R = 13;
  var SEAT_GAP = 46;
  var DESK_DEPTH = 46;
  var SEAT_OFFSET = SEAT_R + 12;
  var END_PADDING = 24;

  function makeSeat(x, y, seatIndexLocal) {
    var circle = new fabric.Circle({
      left: x,
      top: y,
      radius: SEAT_R,
      originX: 'center',
      originY: 'center',
      fill: SEAT_FILL,
      stroke: SEAT_STROKE,
      strokeWidth: 1.5,
      selectable: false,
      evented: false
    });
    circle.role = 'seatMarker';
    circle.seatIndexLocal = seatIndexLocal;

    var label = new fabric.Text('', {
      left: x,
      top: y,
      fontSize: 14,
      fontFamily: 'sans-serif',
      fontWeight: 'bold',
      originX: 'center',
      originY: 'center',
      fill: '#222',
      selectable: false,
      evented: false
    });
    label.role = 'seatLabel';
    label.seatIndexLocal = seatIndexLocal;

    return [circle, label];
  }

  function makeDeskRect(width, height, color, cx, cy) {
    var rect = new fabric.Rect({
      left: cx || 0,
      top: cy || 0,
      width: width,
      height: height,
      originX: 'center',
      originY: 'center',
      fill: COLORS[color] || COLORS[DEFAULT_TABLE_COLOR],
      stroke: DESK_STROKE,
      strokeWidth: 1.5,
      rx: 4,
      ry: 4,
      selectable: false,
      evented: false
    });
    rect.role = 'desk';
    return rect;
  }

  function makeNeutralRect(width, height, cx, cy) {
    var rect = new fabric.Rect({
      left: cx || 0,
      top: cy || 0,
      width: width,
      height: height,
      originX: 'center',
      originY: 'center',
      fill: NEUTRAL_FILL,
      stroke: DESK_STROKE,
      strokeWidth: 1.5,
      selectable: false,
      evented: false
    });
    rect.role = 'desk';
    return rect;
  }

  function makeLabelText(text, cx, cy, opts) {
    var base = {
      left: cx,
      top: cy,
      fontSize: 14,
      fontFamily: 'sans-serif',
      originX: 'center',
      originY: 'center',
      fill: '#333',
      selectable: false,
      evented: false
    };
    var merged = base;
    if (opts) {
      for (var k in opts) {
        if (Object.prototype.hasOwnProperty.call(opts, k)) merged[k] = opts[k];
      }
    }
    return new fabric.Text(text, merged);
  }

  function buildIDesk(spec) {
    var n = spec.seatsPerSide === 3 ? 3 : 2;
    var color = spec.color || DEFAULT_TABLE_COLOR;
    var usableWidth = n * SEAT_GAP;
    var deskWidth = usableWidth + END_PADDING;
    var deskHeight = DESK_DEPTH;

    var children = [makeDeskRect(deskWidth, deskHeight, color)];
    var idx = 0;
    var step = usableWidth / n;

    // top edge: left -> right
    for (var i = 0; i < n; i++) {
      var x = -usableWidth / 2 + step * (i + 0.5);
      var y = -deskHeight / 2 - SEAT_OFFSET;
      children.push.apply(children, makeSeat(x, y, idx++));
    }
    // bottom edge: right -> left (keeps a clockwise perimeter order)
    for (var j = n - 1; j >= 0; j--) {
      var x2 = -usableWidth / 2 + step * (j + 0.5);
      var y2 = deskHeight / 2 + SEAT_OFFSET;
      children.push.apply(children, makeSeat(x2, y2, idx++));
    }

    var group = new fabric.Group(children, { originX: 'center', originY: 'center' });
    group.furnitureType = 'idesk';
    group.category = 'seating';
    group.seatsPerSide = n;
    group.tableColor = color;
    return group;
  }

  function buildTDesk(spec) {
    var seatCount = Math.max(1, Math.min(6, spec.seatCount || 4));
    var color = spec.color || DEFAULT_TABLE_COLOR;
    var remaining = seatCount - 1;
    var topN = Math.ceil(remaining / 2);
    var bottomN = Math.floor(remaining / 2);
    var slots = Math.max(topN, bottomN, 1);
    var usableWidth = slots * SEAT_GAP;
    var deskWidth = usableWidth + END_PADDING;
    var deskHeight = DESK_DEPTH;

    var children = [makeDeskRect(deskWidth, deskHeight, color)];
    var idx = 0;

    // head seat on the short (left) edge, then a clockwise sweep: top L->R, bottom R->L
    children.push.apply(children, makeSeat(-deskWidth / 2 - SEAT_OFFSET, 0, idx++));

    var topStep = topN > 0 ? usableWidth / topN : 0;
    for (var i = 0; i < topN; i++) {
      var x = -usableWidth / 2 + topStep * (i + 0.5);
      children.push.apply(children, makeSeat(x, -deskHeight / 2 - SEAT_OFFSET, idx++));
    }
    var bottomStep = bottomN > 0 ? usableWidth / bottomN : 0;
    for (var j = bottomN - 1; j >= 0; j--) {
      var x2 = -usableWidth / 2 + bottomStep * (j + 0.5);
      children.push.apply(children, makeSeat(x2, deskHeight / 2 + SEAT_OFFSET, idx++));
    }

    var group = new fabric.Group(children, { originX: 'center', originY: 'center' });
    group.furnitureType = 'tdesk';
    group.category = 'seating';
    group.seatCount = seatCount;
    group.tableColor = color;
    return group;
  }

  function buildRoundTable(spec) {
    var seatCount = Math.max(1, Math.min(12, spec.seatCount || 6));
    var color = spec.color || DEFAULT_TABLE_COLOR;
    var radius = 30 + seatCount * 4;

    var deskCircle = new fabric.Circle({
      left: 0,
      top: 0,
      radius: radius,
      originX: 'center',
      originY: 'center',
      fill: COLORS[color] || COLORS[DEFAULT_TABLE_COLOR],
      stroke: DESK_STROKE,
      strokeWidth: 1.5,
      selectable: false,
      evented: false
    });
    deskCircle.role = 'desk';

    var children = [deskCircle];
    var seatRadius = radius + SEAT_OFFSET;
    for (var i = 0; i < seatCount; i++) {
      var angle = (-90 + i * (360 / seatCount)) * Math.PI / 180;
      var x = seatRadius * Math.cos(angle);
      var y = seatRadius * Math.sin(angle);
      children.push.apply(children, makeSeat(x, y, i));
    }

    var group = new fabric.Group(children, { originX: 'center', originY: 'center' });
    group.furnitureType = 'round';
    group.category = 'seating';
    group.seatCount = seatCount;
    group.tableColor = color;
    return group;
  }

  function buildScreen() {
    var width = 220, height = 40;
    var rect = makeNeutralRect(width, height);
    var label = makeLabelText('スクリーン', 0, height / 2 + 16);
    var group = new fabric.Group([rect, label], { originX: 'center', originY: 'center' });
    group.furnitureType = 'screen';
    group.category = 'label-only';
    return group;
  }

  function buildPodium() {
    var width = 130, height = 50;
    var rect = makeNeutralRect(width, height);
    var label = makeLabelText('講師席', 0, 0);
    var group = new fabric.Group([rect, label], { originX: 'center', originY: 'center' });
    group.furnitureType = 'podium';
    group.category = 'label-only';
    return group;
  }

  function buildMC() {
    var width = 90, height = 50;
    var rect = makeNeutralRect(width, height);
    var label = makeLabelText('MC', 0, 0);
    var group = new fabric.Group([rect, label], { originX: 'center', originY: 'center' });
    group.furnitureType = 'mc';
    group.category = 'label-only';
    return group;
  }

  function buildSecretariat(spec) {
    var deskCount = Math.max(1, Math.min(6, spec.deskCount || 3));
    var deskW = 110, deskH = 46, gap = 20, framePadding = 24;
    var innerWidth = deskCount * deskW + (deskCount - 1) * gap;
    var frameWidth = innerWidth + framePadding * 2;
    var frameHeight = deskH + framePadding * 2 + 30;

    var frame = new fabric.Rect({
      left: 0,
      top: 0,
      width: frameWidth,
      height: frameHeight,
      originX: 'center',
      originY: 'center',
      fill: 'transparent',
      stroke: DESK_STROKE,
      strokeWidth: 1.5,
      selectable: false,
      evented: false
    });
    frame.role = 'frame';

    var children = [frame];
    var startX = -innerWidth / 2 + deskW / 2;
    var deskY = -frameHeight / 2 + framePadding + deskH / 2;
    for (var i = 0; i < deskCount; i++) {
      var x = startX + i * (deskW + gap);
      children.push(makeNeutralRect(deskW, deskH, x, deskY));
    }
    children.push(makeLabelText('事務局', 0, frameHeight / 2 - 16, { fontWeight: 'bold' }));

    var group = new fabric.Group(children, { originX: 'center', originY: 'center' });
    group.furnitureType = 'secretariat';
    group.category = 'label-only';
    group.deskCount = deskCount;
    return group;
  }

  function buildFurniture(spec) {
    var group;
    switch (spec.type) {
      case 'idesk': group = buildIDesk(spec); break;
      case 'tdesk': group = buildTDesk(spec); break;
      case 'round': group = buildRoundTable(spec); break;
      case 'screen': group = buildScreen(); break;
      case 'podium': group = buildPodium(); break;
      case 'mc': group = buildMC(); break;
      case 'secretariat': group = buildSecretariat(spec); break;
      default:
        throw new Error('Unknown furniture type: ' + spec.type);
    }
    group.set({
      left: spec.left || 0,
      top: spec.top || 0,
      angle: spec.angle || 0,
      scaleX: spec.scaleX || 1,
      scaleY: spec.scaleY || 1
    });
    group.lockScalingFlip = true;
    return group;
  }

  // Extracts a spec object from a live group, for rebuild-in-place edits.
  function toSpec(group) {
    var spec = {
      type: group.furnitureType,
      left: group.left,
      top: group.top,
      angle: group.angle,
      scaleX: group.scaleX,
      scaleY: group.scaleY
    };
    if (group.furnitureType === 'idesk') {
      spec.seatsPerSide = group.seatsPerSide;
      spec.color = group.tableColor;
    } else if (group.furnitureType === 'tdesk' || group.furnitureType === 'round') {
      spec.seatCount = group.seatCount;
      spec.color = group.tableColor;
    } else if (group.furnitureType === 'secretariat') {
      spec.deskCount = group.deskCount;
    }
    return spec;
  }

  window.SeatApp.shapes = {
    COLORS: COLORS,
    buildFurniture: buildFurniture,
    toSpec: toSpec
  };
})();
