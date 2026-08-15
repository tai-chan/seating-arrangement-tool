window.SeatApp = window.SeatApp || {};

(function () {
  'use strict';

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
  var CELL_W = 240;
  var CELL_H = 240;
  var SECRETARIAT_GAP = 70;
  var SECRETARIAT_ROW_H = 110;
  var MC_OFFSET_X = 170;
  var MC_OFFSET_Y = 70;

  // Angle (degrees, Fabric's clockwise convention) that points a table's
  // local "up" direction (its front / short-edge midpoint) at (tx, ty).
  function angleTowardTarget(x, y, tx, ty) {
    var dx = tx - x, dy = ty - y;
    if (dx === 0 && dy === 0) return 0;
    return Math.atan2(dx, -dy) * 180 / Math.PI;
  }

  // Row sizes fanning out from the screen: a full row of maxCols, then a
  // row one short (centered in the gap), alternating, until deskCount is
  // used up. e.g. maxCols=2, deskCount=5 -> [2, 1, 2].
  function computeRowSizes(maxCols, deskCount) {
    var rows = [];
    var remaining = deskCount;
    var idx = 0;
    while (remaining > 0) {
      var target = (idx % 2 === 0) ? maxCols : Math.max(1, maxCols - 1);
      var rowSize = Math.min(target, remaining);
      rows.push(rowSize);
      remaining -= rowSize;
      idx++;
    }
    return rows;
  }

  function placeScreens(canvas, canvasWidth, screenCount) {
    var totalWidth = screenCount * SCREEN_W + (screenCount - 1) * SCREEN_GAP;
    var startX = (canvasWidth - totalWidth) / 2 + SCREEN_W / 2;
    var xs = [];
    for (var i = 0; i < screenCount; i++) {
      var x = startX + i * (SCREEN_W + SCREEN_GAP);
      xs.push(x);
      canvas.add(window.SeatApp.shapes.buildFurniture({ type: 'screen', left: x, top: SCREEN_TOP_Y }));
    }
    var targetX = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
    return { target: { x: targetX, y: SCREEN_TOP_Y }, leftmostX: Math.min.apply(null, xs) };
  }

  // Places deskCount desks in rows fanning out from the screen (see
  // computeRowSizes), each desk angled toward `target`. Returns the y just
  // below the last row, so callers can stack more content beneath it.
  function placeDeskGrid(canvas, deskSpec, deskCount, color, target, maxCols) {
    var rowSizes = computeRowSizes(maxCols, deskCount);
    var fullRowWidth = maxCols * CELL_W;

    var y = GRID_TOP;
    rowSizes.forEach(function (rowSize) {
      var rowWidth = rowSize * CELL_W;
      var rowStartX = MARGIN_X + (fullRowWidth - rowWidth) / 2;
      for (var c = 0; c < rowSize; c++) {
        var x = rowStartX + c * CELL_W + CELL_W / 2;
        var yc = y + CELL_H / 2;
        var angle = deskSpec.type === 'round' ? 0 : angleTowardTarget(x, yc, target.x, target.y);

        var spec = { type: deskSpec.type, left: x, top: yc, angle: angle, color: color };
        if (deskSpec.type === 'idesk') spec.seatsPerSide = deskSpec.seatsPerSide;
        if (deskSpec.type === 'tdesk' || deskSpec.type === 'round') spec.seatCount = deskSpec.seatCount;

        canvas.add(window.SeatApp.shapes.buildFurniture(spec));
      }
      y += CELL_H;
    });

    return { bottomY: y, gridWidth: fullRowWidth };
  }

  // Auto-arranges a full venue: screen count -> desk shape/count laid out
  // in rows of up to maxCols, fanned toward the screen -> MC near the
  // screen's front-left -> 事務局 (two desks) at the very back of the room.
  function generateAuto(canvas, opts) {
    var maxCols = Math.max(1, opts.maxCols || 3);
    var maxRows = Math.max(1, opts.maxRows || 3);
    var deskSpec = DESK_TYPE_MAP[opts.deskTypeKey] || DESK_TYPE_MAP.idesk2;
    var deskCount = Math.max(1, opts.deskCount || 1);
    var color = opts.color || 'blue';
    var screenCount = opts.screenCount;

    var rowSizes = computeRowSizes(maxCols, deskCount);
    var actualRows = Math.max(rowSizes.length, maxRows);
    var gridWidth = maxCols * CELL_W;
    var screensWidth = screenCount * SCREEN_W + (screenCount - 1) * SCREEN_GAP;
    var width = Math.max(gridWidth, screensWidth) + MARGIN_X * 2;
    var height = GRID_TOP + actualRows * CELL_H + SECRETARIAT_GAP + SECRETARIAT_ROW_H + MARGIN_BOTTOM;

    if (canvas.getObjects().length > 0) {
      var ok = window.confirm('現在のレイアウトを消去して自動配置します。よろしいですか？');
      if (!ok) return;
    }

    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.setWidth(width);
    canvas.setHeight(height);

    var screensInfo = placeScreens(canvas, width, screenCount);
    var gridResult = placeDeskGrid(canvas, deskSpec, deskCount, color, screensInfo.target, maxCols);

    // MC: diagonally down-left from the (leftmost) screen — the presenter's spot.
    var mcX = Math.max(MARGIN_X, screensInfo.leftmostX - MC_OFFSET_X);
    var mcY = SCREEN_TOP_Y + MC_OFFSET_Y;
    canvas.add(window.SeatApp.shapes.buildFurniture({ type: 'mc', left: mcX, top: mcY }));

    // 事務局: two desks, centered, at the very back of the room.
    var secY = gridResult.bottomY + SECRETARIAT_GAP;
    canvas.add(window.SeatApp.shapes.buildFurniture({ type: 'secretariat', left: width / 2, top: secY }));

    window.SeatApp.labeling.relabelAll(canvas);
    canvas.requestRenderAll();
  }

  window.SeatApp.templates = {
    angleTowardTarget: angleTowardTarget,
    computeRowSizes: computeRowSizes,
    generateAuto: generateAuto
  };
})();
