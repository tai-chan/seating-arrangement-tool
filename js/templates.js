window.SeatApp = window.SeatApp || {};

(function () {
  'use strict';

  var CANVAS_SIZES = {
    landscape: { width: 1400, height: 900 },
    portrait: { width: 900, height: 1300 }
  };

  var DESK_TYPE_MAP = {
    idesk2: { type: 'idesk', seatsPerSide: 2 },
    idesk3: { type: 'idesk', seatsPerSide: 3 },
    tdesk: { type: 'tdesk', seatCount: 4 },
    round: { type: 'round', seatCount: 6 }
  };

  var SCREEN_W = 220;
  var SCREEN_GAP = 40;
  var SCREEN_TOP_Y = 60;
  var GRID_TOP = 200;
  var MARGIN_X = 60;
  var MARGIN_BOTTOM = 60;
  var CELL_W = 260;
  var CELL_H = 260;

  // Angle (degrees, Fabric's clockwise convention) that points a table's
  // local "up" direction (its front / short-edge midpoint) at (tx, ty).
  function angleTowardTarget(x, y, tx, ty) {
    var dx = tx - x, dy = ty - y;
    if (dx === 0 && dy === 0) return 0;
    return Math.atan2(dx, -dy) * 180 / Math.PI;
  }

  function placeScreens(canvas, size, screenCount) {
    var totalWidth = screenCount * SCREEN_W + (screenCount - 1) * SCREEN_GAP;
    var startX = (size.width - totalWidth) / 2 + SCREEN_W / 2;
    var xs = [];
    for (var i = 0; i < screenCount; i++) {
      var x = startX + i * (SCREEN_W + SCREEN_GAP);
      xs.push(x);
      canvas.add(window.SeatApp.shapes.buildFurniture({ type: 'screen', left: x, top: SCREEN_TOP_Y }));
    }
    var targetX = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
    return { x: targetX, y: SCREEN_TOP_Y };
  }

  function placeDeskGrid(canvas, size, deskSpec, deskCount, color, target) {
    var availW = size.width - MARGIN_X * 2;
    var availH = size.height - GRID_TOP - MARGIN_BOTTOM;
    var aspect = availW / Math.max(availH, 1);
    var columns = Math.max(1, Math.min(deskCount, Math.round(Math.sqrt(deskCount * aspect))));
    var rows = Math.ceil(deskCount / columns);
    var cellW = Math.max(CELL_W, availW / columns);
    var cellH = Math.max(CELL_H, availH / rows);

    var placed = 0;
    for (var r = 0; r < rows; r++) {
      var itemsInRow = Math.min(columns, deskCount - placed);
      var rowOffsetX = ((columns - itemsInRow) * cellW) / 2;
      for (var c = 0; c < itemsInRow; c++) {
        var x = MARGIN_X + rowOffsetX + c * cellW + cellW / 2;
        var y = GRID_TOP + r * cellH + cellH / 2;
        var angle = deskSpec.type === 'round' ? 0 : angleTowardTarget(x, y, target.x, target.y);

        var spec = { type: deskSpec.type, left: x, top: y, angle: angle, color: color };
        if (deskSpec.type === 'idesk') spec.seatsPerSide = deskSpec.seatsPerSide;
        if (deskSpec.type === 'tdesk' || deskSpec.type === 'round') spec.seatCount = deskSpec.seatCount;

        canvas.add(window.SeatApp.shapes.buildFurniture(spec));
        placed++;
      }
    }
  }

  // Auto-arranges a full venue: orientation -> screen count -> desk shape -> desk count.
  function generateAuto(canvas, opts) {
    var size = CANVAS_SIZES[opts.orientation] || CANVAS_SIZES.landscape;
    var deskSpec = DESK_TYPE_MAP[opts.deskTypeKey] || DESK_TYPE_MAP.idesk2;
    var deskCount = Math.max(1, opts.deskCount || 1);
    var color = opts.color || 'blue';

    if (canvas.getObjects().length > 0) {
      var ok = window.confirm('現在のレイアウトを消去して自動配置します。よろしいですか？');
      if (!ok) return;
    }

    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.setWidth(size.width);
    canvas.setHeight(size.height);

    var target = placeScreens(canvas, size, opts.screenCount);
    placeDeskGrid(canvas, size, deskSpec, deskCount, color, target);

    window.SeatApp.labeling.relabelAll(canvas);
    canvas.requestRenderAll();
  }

  window.SeatApp.templates = {
    angleTowardTarget: angleTowardTarget,
    generateAuto: generateAuto
  };
})();
