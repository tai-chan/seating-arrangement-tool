window.SeatApp = window.SeatApp || {};

(function () {
  'use strict';

  var DESK_TYPE_MAP = {
    idesk2: { type: 'idesk', seatCount: 4 },
    idesk3: { type: 'idesk', seatCount: 6 },
    tdesk: { type: 'tdesk', seatsPerSide: 2, barSeatCount: 2 },
    round: { type: 'round', seatCount: 6 }
  };

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
  // Person marker sits below the desk row; its name-label floats 64px above
  // its own icon (see shapes.js COMPANION_LABELS), so this offset must clear
  // both the desk's bottom edge (desk half-height 20) and that label's own
  // half-height, or the label ends up printed over the desk.
  var SECRETARIAT_PERSON_OFFSET_Y = 115;

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
      window.SeatApp.shapes.buildFurnitureItems({ type: 'screen', left: x, top: SCREEN_TOP_Y }).forEach(function (o) { canvas.add(o); });
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
        var cycle = window.SeatApp.shapes.COLOR_CYCLE;
        var color = cycle[(rowIndex + c + colOffset) % cycle.length];

        var spec = { type: deskSpec.type, left: x, top: yc, angle: angle, color: color };
        if (deskSpec.type === 'idesk' || deskSpec.type === 'round') spec.seatCount = deskSpec.seatCount;
        if (deskSpec.type === 'tdesk') {
          spec.seatsPerSide = deskSpec.seatsPerSide;
          spec.barSeatCount = deskSpec.barSeatCount;
        }

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
    var deskSpec = DESK_TYPE_MAP[opts.deskTypeKey] || DESK_TYPE_MAP.idesk2;
    var deskCount = Math.max(1, opts.deskCount || 1);
    var screenCount = opts.screenCount;

    var footprint = deskFootprint(deskSpec);
    var cellSize = Math.max(CELL_BASE, footprint + CELL_PADDING);
    // A desk's own worst-case (rotated) top edge sits cellSize/2 - footprint/2
    // above its row's cell-top, i.e. CELL_PADDING/2 -- that term already
    // scales with footprint via cellSize, so it must NOT also be added here
    // (adding footprint/2 again, as before, double-counted the same safety
    // margin and pushed large desk types far below MC for no reason).
    var podiumBottomY = SCREEN_TOP_Y + MC_OFFSET_Y + MC_DESK_OFFSET_Y + 25;
    var DESK_MC_GAP = 55; // ~ the same breathing room as 事務局机-事務局 below
    var gridTop = Math.max(GRID_TOP_BASE, podiumBottomY + DESK_MC_GAP - CELL_PADDING / 2);

    // Row count is fully determined by maxCols + deskCount (see
    // computeRowSizes), so there's nothing left for the caller to choose.
    var rowSizes = computeRowSizes(maxCols, deskCount);
    var actualRows = rowSizes.length;
    var gridWidth = maxCols * cellSize;
    var screensWidth = screenCount * SCREEN_W + (screenCount - 1) * SCREEN_GAP;
    var width = Math.max(gridWidth, screensWidth) + MARGIN_X * 2;
    var height = gridTop + actualRows * cellSize + SECRETARIAT_GAP + SECRETARIAT_ROW_H + MARGIN_BOTTOM;

    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    // Reset zoom before sizing: setWidth/setHeight take raw content pixels,
    // but a previous fit-to-viewport call may have left zoom < 1, which
    // would otherwise make this fresh layout render at the old shrink
    // factor. app.js re-fits to the viewport right after this call.
    canvas.setZoom(1);
    canvas.setWidth(width);
    canvas.setHeight(height);

    var screensInfo = placeScreens(canvas, width, screenCount);
    var gridResult = placeDeskGrid(canvas, deskSpec, deskCount, screensInfo.target, maxCols, gridTop, cellSize);

    // MC: diagonally down-left from the (leftmost) screen — the presenter's spot.
    // MC席 (the podium/desk) sits directly in front of MC, between MC and the room.
    var mcX = Math.max(MARGIN_X, screensInfo.leftmostX - MC_OFFSET_X);
    var mcY = SCREEN_TOP_Y + MC_OFFSET_Y;
    window.SeatApp.shapes.buildFurnitureItems({ type: 'mc', left: mcX, top: mcY }).forEach(function (o) { canvas.add(o); });
    window.SeatApp.shapes.buildFurnitureItems({ type: 'podium', left: mcX, top: mcY + MC_DESK_OFFSET_Y }).forEach(function (o) { canvas.add(o); });

    // 事務局: one desk per column (matching the desk grid's width), at the
    // very back of the room, with the staff member standing/sitting just
    // behind it (further from the screen).
    var secDeskY = gridResult.bottomY + SECRETARIAT_GAP;
    canvas.add(window.SeatApp.shapes.buildFurniture({ type: 'secretariat-desk', left: width / 2, top: secDeskY, deskCount: maxCols }));
    window.SeatApp.shapes.buildFurnitureItems({ type: 'secretariat-person', left: width / 2, top: secDeskY + SECRETARIAT_PERSON_OFFSET_Y }).forEach(function (o) { canvas.add(o); });

    window.SeatApp.labeling.relabelAll(canvas);
    canvas.requestRenderAll();
  }

  // Fixed real-room preset: our office's 3列×最大4行の丸机（6人がけ）配置。
  // Unlike generateAuto (parametric, tablecloth colors auto-cycled), every
  // table's position/color here is hand-specified to match the actual room,
  // and the last row's gap (leftmost slot) holds the entrance instead of a
  // desk -- so this places desks on an explicit column grid (no
  // computeRowSizes/placeDeskGrid centering) to keep every column aligned
  // even where a row is short.
  var OFFICE_MAX_COLS = 3;
  var OFFICE_ROWS = [
    ['green', 'blue', 'yellow'],
    ['yellow', 'yellow', 'red'],
    ['red', 'blue', 'green'],
    [null, 'red', 'yellow']
  ];

  function generateOffice(canvas) {
    var deskSpec = DESK_TYPE_MAP.round;
    var footprint = deskFootprint(deskSpec);
    var cellSize = Math.max(CELL_BASE, footprint + CELL_PADDING);

    var podiumBottomY = SCREEN_TOP_Y + MC_OFFSET_Y + MC_DESK_OFFSET_Y + 25;
    var DESK_MC_GAP = 55;
    var gridTop = Math.max(GRID_TOP_BASE, podiumBottomY + DESK_MC_GAP - CELL_PADDING / 2);

    var gridWidth = OFFICE_MAX_COLS * cellSize;
    var width = Math.max(gridWidth, SCREEN_W) + MARGIN_X * 2;
    var height = gridTop + OFFICE_ROWS.length * cellSize + MARGIN_BOTTOM;

    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.setZoom(1);
    canvas.setWidth(width);
    canvas.setHeight(height);

    var screensInfo = placeScreens(canvas, width, 1);

    OFFICE_ROWS.forEach(function (row, rowIndex) {
      row.forEach(function (color, colIndex) {
        var x = MARGIN_X + colIndex * cellSize + cellSize / 2;
        var y = gridTop + rowIndex * cellSize + cellSize / 2;
        if (color === null) {
          window.SeatApp.shapes.buildFurnitureItems({ type: 'entrance', left: x, top: y, angle: 90 })
            .forEach(function (o) { canvas.add(o); });
          return;
        }
        canvas.add(window.SeatApp.shapes.buildFurniture({
          type: 'round', left: x, top: y, angle: 0, color: color, seatCount: deskSpec.seatCount
        }));
      });
    });

    var mcX = Math.max(MARGIN_X, screensInfo.leftmostX - MC_OFFSET_X);
    var mcY = SCREEN_TOP_Y + MC_OFFSET_Y;
    window.SeatApp.shapes.buildFurnitureItems({ type: 'mc', left: mcX, top: mcY }).forEach(function (o) { canvas.add(o); });
    window.SeatApp.shapes.buildFurnitureItems({ type: 'podium', left: mcX, top: mcY + MC_DESK_OFFSET_Y }).forEach(function (o) { canvas.add(o); });

    window.SeatApp.labeling.relabelAll(canvas);
    canvas.requestRenderAll();
  }

  window.SeatApp.templates = {
    angleTowardTarget: angleTowardTarget,
    computeRowSizes: computeRowSizes,
    generateAuto: generateAuto,
    generateOffice: generateOffice
  };
})();
