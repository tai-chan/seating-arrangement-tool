window.SeatApp = window.SeatApp || {};

(function () {
  'use strict';

  var COLORS = {
    red: '#d9534f',
    blue: '#4a7fd6',
    green: '#4caf6e',
    yellow: '#e0c341'
  };
  var COLOR_CYCLE = ['red', 'blue', 'green', 'yellow'];
  var DEFAULT_TABLE_COLOR = 'blue';
  var NEUTRAL_FILL = '#c9d6e3';
  var SEAT_FILL = '#9aa1ab';
  var SEAT_STROKE = '#5f6b7a';
  var DESK_STROKE = '#33475b';
  var MC_FILL = '#6c3fa8';
  var SECRETARIAT_PERSON_FILL = '#2f7a63';
  var SECRETARIAT_FILL = '#5c7080';

  var SEAT_R = 13;
  var SEAT_GAP = 46;
  var DESK_DEPTH = 46;
  var SEAT_OFFSET = SEAT_R + 12;
  var END_PADDING = 24;

  // Whether newly-built tables show their seat markers. Toggled globally via
  // setSeatsVisible() so a dense layout can hide seats for readability
  // without losing seat counts/positions underneath.
  var seatsVisible = true;

  // Seats carry no text of their own — a plain circle is enough to convey "one seat".
  function makeSeatCircle(x, y) {
    var circle = new fabric.Circle({
      left: x,
      top: y,
      radius: SEAT_R,
      originX: 'center',
      originY: 'center',
      fill: SEAT_FILL,
      stroke: SEAT_STROKE,
      strokeWidth: 1,
      selectable: false,
      evented: false
    });
    circle.role = 'seatMarker';
    return circle;
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

  function makeNeutralRect(width, height, cx, cy, fillColor) {
    var rect = new fabric.Rect({
      left: cx || 0,
      top: cy || 0,
      width: width,
      height: height,
      originX: 'center',
      originY: 'center',
      fill: fillColor || NEUTRAL_FILL,
      stroke: DESK_STROKE,
      strokeWidth: 1.5,
      selectable: false,
      evented: false
    });
    rect.role = 'desk';
    return rect;
  }

  function makeDivider(x1, y1, x2, y2) {
    return new fabric.Line([x1, y1, x2, y2], {
      stroke: DESK_STROKE,
      strokeWidth: 1.5,
      selectable: false,
      evented: false
    });
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

  // One alphabet/number label per table, shown centered on the table itself
  // (not on individual seats — seats only ever convey a count). Sized large
  // enough to read at a glance while still fitting the smallest desk (the
  // 1-seat T-desk bar, 46px tall) — see labeling.js for the 2-letter shrink.
  function makeTableLabel(cx, cy) {
    var label = makeLabelText('', cx, cy, {
      fill: '#ffffff',
      fontWeight: 'bold',
      fontSize: 24
    });
    label.role = 'tableLabel';
    return label;
  }

  // A single joined-desk panel is DESK_DEPTH wide. I-desk and T-desk's stem
  // are both "two such panels pushed together along their long edge", which
  // is why both always render at a fixed 2*DESK_DEPTH width regardless of
  // seat count — only the length (how far the seam runs) scales with seats.
  var PANEL_WIDTH = DESK_DEPTH;

  // Local orientation convention (shared with T-desk): at angle 0 the desk
  // stands "portrait" and its top short edge is the desk's front — this is
  // the edge whose midpoint points at a screen/target when auto-arranged
  // (see SeatApp.templates.angleTowardTarget). Seats run along the long
  // outer left/right edges of the two joined panels.
  //
  // seatCount is a total split as evenly as possible between the two
  // sides (e.g. 5 -> 3 left + 2 right), so a normally-6-seat (3:3) desk can
  // still be dialed down when fewer people are actually attending.
  function buildIDesk(spec) {
    var seatCount = Math.max(1, Math.min(6, spec.seatCount || 6));
    var leftN = Math.ceil(seatCount / 2);
    var rightN = Math.floor(seatCount / 2);
    var maxN = Math.max(leftN, rightN);
    var color = spec.color || DEFAULT_TABLE_COLOR;
    var deskWidth = PANEL_WIDTH * 2;
    var usableLength = maxN * SEAT_GAP;
    var deskLength = usableLength + END_PADDING;

    // Two long desks pushed together along their long edge: seam runs down the middle.
    var children = [
      makeDeskRect(deskWidth, deskLength, color),
      makeDivider(0, -deskLength / 2, 0, deskLength / 2),
      makeTableLabel(0, 0)
    ];

    var leftStep = usableLength / leftN;
    for (var i = 0; i < leftN; i++) {
      var y = -usableLength / 2 + leftStep * (i + 0.5);
      children.push(makeSeatCircle(-deskWidth / 2 - SEAT_OFFSET, y));
    }
    if (rightN > 0) {
      var rightStep = usableLength / rightN;
      for (var j = rightN - 1; j >= 0; j--) {
        var y2 = -usableLength / 2 + rightStep * (j + 0.5);
        children.push(makeSeatCircle(deskWidth / 2 + SEAT_OFFSET, y2));
      }
    }

    var group = new fabric.Group(children, { originX: 'center', originY: 'center' });
    group.furnitureType = 'idesk';
    group.category = 'seating';
    group.seatCount = seatCount;
    group.tableColor = color;
    return group;
  }

  // T-desk = an I-desk-like "stem" (two joined panels, seats on its left/right,
  // same 2:2 / 3:3 pattern as the I-desk) with a separate "bar" desk attached
  // below it, seats along the bar's own outer (bottom) edge only.
  function buildTDesk(spec) {
    var stemN = spec.seatsPerSide === 3 ? 3 : 2;
    var barSeatCount = Math.max(1, Math.min(6, spec.barSeatCount || 2));
    var color = spec.color || DEFAULT_TABLE_COLOR;
    var h = DESK_DEPTH;

    var stemWidth = PANEL_WIDTH * 2;
    var stemUsableLength = stemN * SEAT_GAP;
    var stemLength = stemUsableLength + END_PADDING;
    var stemCenterY = -stemLength / 2;

    var barUsable = barSeatCount * SEAT_GAP;
    var barWidth = Math.max(barUsable + END_PADDING, stemWidth + SEAT_GAP);

    var children = [
      makeDeskRect(barWidth, h, color, 0, h / 2),
      makeDeskRect(stemWidth, stemLength, color, 0, stemCenterY),
      makeDivider(0, -stemLength, 0, 0),
      makeTableLabel(0, h / 2)
    ];

    var stemStep = stemUsableLength / stemN;
    for (var i = 0; i < stemN; i++) {
      var y = stemCenterY - stemUsableLength / 2 + stemStep * (i + 0.5);
      children.push(makeSeatCircle(-stemWidth / 2 - SEAT_OFFSET, y));
    }
    for (var j = stemN - 1; j >= 0; j--) {
      var y2 = stemCenterY - stemUsableLength / 2 + stemStep * (j + 0.5);
      children.push(makeSeatCircle(stemWidth / 2 + SEAT_OFFSET, y2));
    }

    var barStep = barUsable / barSeatCount;
    for (var k = 0; k < barSeatCount; k++) {
      var x = -barUsable / 2 + barStep * (k + 0.5);
      children.push(makeSeatCircle(x, h + SEAT_OFFSET));
    }

    var group = new fabric.Group(children, { originX: 'center', originY: 'center' });
    group.furnitureType = 'tdesk';
    group.category = 'seating';
    group.seatsPerSide = stemN;
    group.barSeatCount = barSeatCount;
    group.tableColor = color;
    return group;
  }

  function buildRoundTable(spec) {
    var seatCount = Math.max(1, Math.min(12, spec.seatCount || 6));
    var color = spec.color || DEFAULT_TABLE_COLOR;
    var radius = 42 + seatCount * 4;

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

    var children = [deskCircle, makeTableLabel(0, 0)];
    var seatRadius = radius + SEAT_OFFSET;
    for (var i = 0; i < seatCount; i++) {
      var angle = (-90 + i * (360 / seatCount)) * Math.PI / 180;
      var x = seatRadius * Math.cos(angle);
      var y = seatRadius * Math.sin(angle);
      children.push(makeSeatCircle(x, y));
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
    var group = new fabric.Group([rect], { originX: 'center', originY: 'center' });
    group.furnitureType = 'screen';
    group.category = 'label-only';
    return group;
  }

  function buildPodium() {
    var width = 130, height = 50;
    var rect = makeNeutralRect(width, height);
    var group = new fabric.Group([rect], { originX: 'center', originY: 'center' });
    group.furnitureType = 'podium';
    group.category = 'label-only';
    return group;
  }

  // A simple person pictogram (head + body) — used for MC (who stands and
  // speaks) and for the 事務局 staff member, in a different color. The name
  // above it is a separate text-label item (see buildCompanionLabel) rather
  // than baked-in text, so it can be double-click edited like any other
  // text item.
  function buildPersonMarker(type, fillColor) {
    var bodyWidth = 54, bodyHeight = 42, headR = 18, headOverlap = 7;
    var bodyTop = -bodyHeight / 2;
    var headCenterY = bodyTop - headR + headOverlap;

    var body = new fabric.Triangle({
      left: 0,
      top: 0,
      width: bodyWidth,
      height: bodyHeight,
      originX: 'center',
      originY: 'center',
      fill: fillColor,
      selectable: false,
      evented: false
    });
    var head = new fabric.Circle({
      left: 0,
      top: headCenterY,
      radius: headR,
      originX: 'center',
      originY: 'center',
      fill: fillColor,
      selectable: false,
      evented: false
    });

    var group = new fabric.Group([body, head], { originX: 'center', originY: 'center' });
    group.furnitureType = type;
    group.category = 'label-only';
    return group;
  }

  // 入口: a dashed opening in the wall with an arrow pointing into the room,
  // the standard floor-plan convention for a doorway. Its "入口" caption is a
  // companion label like MC/事務局/スクリーン (see COMPANION_LABELS below).
  function buildEntrance() {
    var width = 90, height = 32;
    var rect = new fabric.Rect({
      left: 0,
      top: 0,
      width: width,
      height: height,
      originX: 'center',
      originY: 'center',
      fill: NEUTRAL_FILL,
      stroke: DESK_STROKE,
      strokeWidth: 1.5,
      strokeDashArray: [7, 5],
      rx: 4,
      ry: 4,
      selectable: false,
      evented: false
    });
    rect.role = 'desk';

    var arrow = new fabric.Triangle({
      left: 0,
      top: height / 2 + 14,
      width: 18,
      height: 14,
      angle: 180,
      originX: 'center',
      originY: 'center',
      fill: DESK_STROKE,
      selectable: false,
      evented: false
    });

    var group = new fabric.Group([rect, arrow], { originX: 'center', originY: 'center' });
    group.furnitureType = 'entrance';
    group.category = 'label-only';
    return group;
  }

  // 事務局机: plain desk(s) in a row, no label of its own — the 事務局 person
  // marker nearby already identifies the area (operations staff sit at a
  // desk, unlike MC, who stands, so the person is drawn separately via
  // buildPersonMarker). deskCount lets the wizard line up one per column.
  function buildSecretariatDesk(spec) {
    var deskCount = Math.max(1, Math.min(6, spec.deskCount || 1));
    var deskW = 100, deskH = 40, gap = 14;
    var totalW = deskCount * deskW + (deskCount - 1) * gap;
    var startX = -totalW / 2 + deskW / 2;

    var children = [];
    for (var i = 0; i < deskCount; i++) {
      children.push(makeNeutralRect(deskW, deskH, startX + i * (deskW + gap), 0, SECRETARIAT_FILL));
    }

    var group = new fabric.Group(children, { originX: 'center', originY: 'center' });
    group.furnitureType = 'secretariat-desk';
    group.category = 'label-only';
    group.deskCount = deskCount;
    return group;
  }

  // Free-form text box, like a PowerPoint text box — double-click to edit
  // its contents directly on the canvas. Not wrapped in a Group, since
  // Fabric's built-in inline editing needs the object to be a direct
  // canvas child.
  function buildTextItem(spec) {
    var textObj = new fabric.IText(spec.text || 'テキスト', {
      fontSize: 18,
      fontFamily: 'sans-serif',
      fontWeight: 'bold',
      fill: '#26313f',
      // Resize/rotate corner handles are hit-tested with a touch-friendly
      // radius that, on a short label like "MC", covers the entire object —
      // every click then reads as "grabbed a corner" and click-to-edit can
      // never fire. These labels don't need drag-resize, so drop the
      // controls entirely rather than fight the hit-test radius.
      hasControls: false
    });
    textObj.furnitureType = 'text';
    textObj.category = 'label-only';
    return textObj;
  }

  function applySeatVisibility(group) {
    group.getObjects().forEach(function (child) {
      if (child.role === 'seatMarker') child.set('visible', seatsVisible);
    });
  }

  function setSeatsVisible(canvas, visible) {
    seatsVisible = visible;
    canvas.getObjects().forEach(function (obj) {
      if (obj.category === 'seating') applySeatVisibility(obj);
    });
    canvas.requestRenderAll();
  }

  function getSeatsVisible() {
    return seatsVisible;
  }

  function buildFurniture(spec) {
    var group;
    switch (spec.type) {
      case 'idesk': group = buildIDesk(spec); break;
      case 'tdesk': group = buildTDesk(spec); break;
      case 'round': group = buildRoundTable(spec); break;
      case 'screen': group = buildScreen(); break;
      case 'podium': group = buildPodium(); break;
      case 'mc': group = buildPersonMarker('mc', MC_FILL); break;
      case 'secretariat-person': group = buildPersonMarker('secretariat-person', SECRETARIAT_PERSON_FILL); break;
      case 'secretariat-desk': group = buildSecretariatDesk(spec); break;
      case 'entrance': group = buildEntrance(); break;
      case 'text': group = buildTextItem(spec); break;
      default:
        throw new Error('Unknown item type: ' + spec.type);
    }
    if (group.category === 'seating') applySeatVisibility(group);
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

  // Default caption for the small set of icon-only items that display a
  // name above them (MC, 事務局, MC席, スクリーン). The caption itself is a
  // real text-label item (same as the freeform "テキスト" palette item), so
  // it is independently draggable and double-click editable, instead of
  // being non-interactive text baked into the icon.
  var COMPANION_LABELS = {
    mc: { text: 'MC', dy: -64, bold: true },
    'secretariat-person': { text: '事務局', dy: -64, bold: true },
    podium: { text: 'MC席', dy: 0, bold: false },
    screen: { text: 'スクリーン', dy: 36, bold: false },
    entrance: { text: '入口', dy: 55, bold: false }
  };

  // Most types get a fixed caption from COMPANION_LABELS. 机 (secretariat-desk)
  // has none by default (a bare desk row needs no caption of its own), but
  // spec.companionText lets a palette variant — 受付, which is otherwise the
  // exact same desk row — attach one anyway (see index.html's data-companion
  // button and app.js's defaultSpecFor).
  function buildCompanionLabel(spec, left, top) {
    var def = COMPANION_LABELS[spec.type];
    var text = spec.companionText || (def && def.text);
    if (!text) return null;
    var dy = def ? def.dy : -34;
    var bold = def ? def.bold : true;
    var label = buildTextItem({ text: text });
    label.set({
      left: left,
      top: top + dy,
      originX: 'center',
      originY: 'center',
      textAlign: 'center',
      fontSize: bold ? 13 : 14,
      fontWeight: bold ? 'bold' : 'normal',
      fill: '#333'
    });
    return label;
  }

  // Places an item together with its companion text label (if it has one),
  // so palette placement / auto-arrange never need to know which types are
  // label-pairs. Types without a companion label (tables, freeform text)
  // just come back as a single-item array.
  function buildFurnitureItems(spec) {
    var main = buildFurniture(spec);
    var label = buildCompanionLabel(spec, spec.left || 0, spec.top || 0);
    return label ? [main, label] : [main];
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
    if (group.furnitureType === 'idesk' || group.furnitureType === 'round') {
      spec.seatCount = group.seatCount;
      spec.color = group.tableColor;
    } else if (group.furnitureType === 'tdesk') {
      spec.seatsPerSide = group.seatsPerSide;
      spec.barSeatCount = group.barSeatCount;
      spec.color = group.tableColor;
    } else if (group.furnitureType === 'secretariat-desk') {
      spec.deskCount = group.deskCount;
    } else if (group.furnitureType === 'text') {
      spec.text = group.text;
    }
    return spec;
  }

  function tableLabelOf(group) {
    if (!group.getObjects) return null;
    return group.getObjects().filter(function (o) { return o.role === 'tableLabel'; })[0] || null;
  }

  // Rebuilds a table/item in place with a patched spec, preserving its
  // current table-label text (a full rebuild would otherwise blank it) and
  // its selection state. Shared by the inspector's property panel and by
  // bulk operations like "recolor all".
  function rebuildWithPatch(canvas, group, patch) {
    var spec = toSpec(group);
    var existingLabel = tableLabelOf(group);
    var labelText = existingLabel ? existingLabel.text : '';
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) spec[k] = patch[k];
    }
    var newGroup = buildFurniture(spec);
    var newLabel = tableLabelOf(newGroup);
    if (newLabel) newLabel.set('text', labelText);

    var wasActive = canvas.getActiveObject() === group;
    canvas.remove(group);
    canvas.add(newGroup);
    if (wasActive) canvas.setActiveObject(newGroup);
    return newGroup;
  }

  window.SeatApp.shapes = {
    COLORS: COLORS,
    COLOR_CYCLE: COLOR_CYCLE,
    buildFurniture: buildFurniture,
    buildFurnitureItems: buildFurnitureItems,
    toSpec: toSpec,
    rebuildWithPatch: rebuildWithPatch,
    setSeatsVisible: setSeatsVisible,
    getSeatsVisible: getSeatsVisible
  };
})();
