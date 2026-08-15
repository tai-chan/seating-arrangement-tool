window.SeatApp = window.SeatApp || {};

(function () {
  'use strict';

  var DESK_TYPE_MAP = {
    idesk2: { type: 'idesk', seatsPerSide: 2 },
    idesk3: { type: 'idesk', seatsPerSide: 3 },
    tdesk: { type: 'tdesk', seatsPerSide: 2, barSeatCount: 2 },
    round: { type: 'round', seatCount: 6 }
  };

  var COLOR_CYCLE = ['red', 'blue', 'green', 'yellow'];

  var SCREEN_W = 220;
  var SCREEN_GAP = 40;
  var SCREEN_TOP_Y = 60;
  var GRID_TOP_BASE = 200;
  var MARGIN_X = 60;
  var MARGIN_BOTTOM = 60;
  var CELL_BASE = 240;
  var CELL_PADDING = 60;
  var SECRETARIAT_GAP = 70;
  var SECRETARIAT_ROW_H = 110;
  var MC_OFFSET_X = 170;
  var MC_OFFSET_Y = 70;
  var MC_DESK_OFFSET_Y = 70;
  var SECRETARIAT_PERSON_OFFSET_Y = 90;

  // Angle (degrees, Fabric's clockwise convention) that points a table's
  // local "up" direction (its front / short-edge midpoint) at (tx, ty).
  function angleTowardTarget(x, y, tx, ty) {
    var dx = tx - x, dy = ty - y;
    if (dx === 0 && dy === 0) return 0;
    return Math.atan2(dx, -dy) * 180 / Math.PI;
  }

  // Uses the fewest rows possible (ceil(deskCount/maxCols)) so the block
  // stays packed toward the screen rather than trailing further back than
  // it needs to. Any row that can't be filled evenly gets its shortfall
  // pulled from the middle first — front row, then back row, then inward —
  // so a leftover reads as a symmetric taper (e.g. maxCols=2, count=5 ->
  // [2, 1, 2]) instead of a lopsided last row.
  function computeRowSizes(maxCols, deskCount) {
    var rows = Math.max(1, Math.ceil(deskCount / maxCols));
    if (rows === 1) return [deskCount];

    var base = Math.floor(deskCount / rows);
    var remainder = deskCount - base * rows;
    var rowSizes = [];
    for (var r = 0; r < rows; r++) rowSizes.push(base);

    var order = [];
    for (var i = 0; i < rows; i++) {
      order.push(i % 2 === 0 ? i / 2 : rows - 1 - (i - 1) / 2);
    }
    for (var oi = 0; oi < order.length && remainder > 0; oi++) {
      var idx = order[oi];
      if (rowSizes[idx] < maxCols) {
        rowSizes[idx]++;
        remainder--;
      }
    }
    return rowSizes;
  }

  // How much clearance a desk of this type/size needs around its own center:
  // for rotating types (idesk/tdesk), use the full diagonal since the wizard
  // can rotate them to any angle toward the screen; round tables never
  // rotate, so their own diameter is already the worst case.
  function deskFootprint(deskSpec) {
    var sample = window.SeatApp.shapes.buildFurniture({
      type: deskSpec.type,
      seatsPerSide: deskSpec.seatsPerSide,
      barSeatCount: deskSpec.barSeatCount,
      seatCount: deskSpec.seatCount,
      left: 0, top: 0, angle: 0
    });
    if (deskSpec.type === 'round') return Math.max(sample.width, sample.height);
    return Math.sqrt(sample.width * sample.width + sample.height * sample.height);
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
  // computeRowSizes), each desk angled toward `target`. Tablecloth colors
  // cycle through all 4 colors so that horizontally/vertically neighboring
  // desks never match ((row + column) % 4, a 4-coloring of the grid).
  // Returns the y just below the last row, so callers can stack more
  // content beneath it.
  function placeDeskGrid(canvas, deskSpec, deskCount, target, maxCols, gridTop, cellSize) {
    var rowSizes = computeRowSizes(maxCols, deskCount);
    var fullRowWidth = maxCols * cellSize;

    var y = gridTop;
    rowSizes.forEach(function (rowSize, rowIndex) {
      var rowWidth = rowSize * cellSize;
      var rowStartX = MARGIN_X + (fullRowWidth - rowWidth) / 2;
      var colOffset = Math.round((maxCols - rowSize) / 2);
      for (var c = 0; c < rowSize; c++) {
        var x = rowStartX + c * cellSize + cellSize / 2;
        var yc = y + cellSize / 2;
        var angle = deskSpec.type === 'round' ? 0 : angleTowardTarget(x, yc, target.x, target.y);
        var color = COLOR_CYCLE[(rowIndex + c + colOffset) % 4];

        var spec = { type: deskSpec.type, left: x, top: yc, angle: angle, color: color };
        if (deskSpec.type === 'idesk' || deskSpec.type === 'tdesk') spec.seatsPerSide = deskSpec.seatsPerSide;
        if (deskSpec.type === 'tdesk') spec.barSeatCount = deskSpec.barSeatCount;
        if (deskSpec.type === 'round') spec.seatCount = deskSpec.seatCount;

        canvas.add(window.SeatApp.shapes.buildFurniture(spec));
      }
      y += cellSize;
    });

    return { bottomY: y, gridWidth: fullRowWidth, rows: rowSizes.length };
  }

  // Auto-arranges a full venue: screen count -> desk shape/count laid out
  // in rows of up to maxCols, fanned toward the screen -> MC + MC席 near the
  // screen's front-left -> 事務局机 + 事務局 at the very back of the room.
  // Cell size and the screen-to-grid gap both scale with the chosen desk
  // type's footprint, so large desks (many seats) never overlap MC or each
  // other regardless of rotation.
  function generateAuto(canvas, opts) {
    var maxCols = Math.max(1, opts.maxCols || 3);
    var maxRows = Math.max(1, opts.maxRows || 3);
    var deskSpec = DESK_TYPE_MAP[opts.deskTypeKey] || DESK_TYPE_MAP.idesk2;
    var deskCount = Math.max(1, opts.deskCount || 1);
    var screenCount = opts.screenCount;

    var footprint = deskFootprint(deskSpec);
    var cellSize = Math.max(CELL_BASE, footprint + CELL_PADDING);
    var mcClearanceY = SCREEN_TOP_Y + MC_OFFSET_Y + MC_DESK_OFFSET_Y + 50;
    var gridTop = Math.max(GRID_TOP_BASE, mcClearanceY + footprint / 2);

    var rowSizes = computeRowSizes(maxCols, deskCount);
    var actualRows = Math.max(rowSizes.length, maxRows);
    var gridWidth = maxCols * cellSize;
    var screensWidth = screenCount * SCREEN_W + (screenCount - 1) * SCREEN_GAP;
    var width = Math.max(gridWidth, screensWidth) + MARGIN_X * 2;
    var height = gridTop + actualRows * cellSize + SECRETARIAT_GAP + SECRETARIAT_ROW_H + MARGIN_BOTTOM;

    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.setWidth(width);
    canvas.setHeight(height);

    var screensInfo = placeScreens(canvas, width, screenCount);
    var gridResult = placeDeskGrid(canvas, deskSpec, deskCount, screensInfo.target, maxCols, gridTop, cellSize);

    // MC: diagonally down-left from the (leftmost) screen — the presenter's spot.
    // MC席 (the podium/desk) sits directly in front of MC, between MC and the room.
    var mcX = Math.max(MARGIN_X, screensInfo.leftmostX - MC_OFFSET_X);
    var mcY = SCREEN_TOP_Y + MC_OFFSET_Y;
    canvas.add(window.SeatApp.shapes.buildFurniture({ type: 'mc', left: mcX, top: mcY }));
    canvas.add(window.SeatApp.shapes.buildFurniture({ type: 'podium', left: mcX, top: mcY + MC_DESK_OFFSET_Y }));

    // 事務局: a desk at the very back of the room, with the staff member
    // standing/sitting just behind it (further from the screen).
    var secDeskY = gridResult.bottomY + SECRETARIAT_GAP;
    canvas.add(window.SeatApp.shapes.buildFurniture({ type: 'secretariat-desk', left: width / 2, top: secDeskY }));
    canvas.add(window.SeatApp.shapes.buildFurniture({ type: 'secretariat-person', left: width / 2, top: secDeskY + SECRETARIAT_PERSON_OFFSET_Y }));

    window.SeatApp.labeling.relabelAll(canvas);
    canvas.requestRenderAll();
  }

  window.SeatApp.templates = {
    angleTowardTarget: angleTowardTarget,
    computeRowSizes: computeRowSizes,
    generateAuto: generateAuto
  };
})();
