window.SeatApp = window.SeatApp || {};

(function () {
  'use strict';

  // 0-based index -> A, B, ..., Z, AA, AB, ... (spreadsheet-column style)
  function letterLabel(n) {
    var s = '';
    n = n + 1;
    while (n > 0) {
      var rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // Tables whose absolute bounding-box top is within this band of the row's
  // first table are treated as being in the same visual row.
  var ROW_BAND_PX = 100;

  // Groups every seating table into visual rows (top-to-bottom, then
  // left-to-right within a row) purely from current canvas position — works
  // for wizard-generated grids and freeform manual layouts alike. Shared by
  // relabelAll (reading order) and recolorAll (row/column parity).
  function computeRowGroups(canvas) {
    var tables = canvas.getObjects().filter(function (o) {
      return o.category === 'seating';
    });

    tables.sort(function (a, b) {
      return a.getBoundingRect(true).top - b.getBoundingRect(true).top;
    });

    var rows = [];
    tables.forEach(function (obj) {
      var top = obj.getBoundingRect(true).top;
      var row = rows[rows.length - 1];
      if (row && (top - row.bandTop) <= ROW_BAND_PX) {
        row.items.push(obj);
      } else {
        rows.push({ bandTop: top, items: [obj] });
      }
    });

    rows.forEach(function (row) {
      row.items.sort(function (a, b) {
        return a.getBoundingRect(true).left - b.getBoundingRect(true).left;
      });
    });

    return rows.map(function (row) { return row.items; });
  }

  // Assigns one letter per table (shown once, centered on the table) —
  // individual seats are never labeled, they only ever convey a count.
  function relabelAll(canvas) {
    var rows = computeRowGroups(canvas);
    var orderedTables = [];
    rows.forEach(function (row) { orderedTables = orderedTables.concat(row); });

    orderedTables.forEach(function (table, index) {
      var labelObj = table.getObjects().filter(function (o) { return o.role === 'tableLabel'; })[0];
      if (labelObj) {
        var text = letterLabel(index);
        // 27th table onward needs 2 letters (AA, AB, ...); shrink so it
        // still fits inside the smallest desk instead of overflowing it.
        labelObj.set({ text: text, fontSize: text.length > 1 ? 18 : 24 });
      }
    });

    canvas.requestRenderAll();
    return orderedTables.length;
  }

  // Reassigns tablecloth colors so they cycle through all 4 colors and no
  // two horizontally/vertically neighboring tables share a color
  // ((row + column) % 4). Round tables, I-desks and T-desks all qualify;
  // anything without a color (screens, MC, etc.) is left untouched.
  function recolorAll(canvas) {
    var rows = computeRowGroups(canvas);
    var cycle = window.SeatApp.shapes.COLOR_CYCLE;
    var count = 0;

    rows.forEach(function (row, rowIndex) {
      row.forEach(function (table, colIndex) {
        if (table.tableColor === undefined) return;
        var color = cycle[(rowIndex + colIndex) % cycle.length];
        if (color !== table.tableColor) {
          window.SeatApp.shapes.rebuildWithPatch(canvas, table, { color: color });
        }
        count++;
      });
    });

    canvas.requestRenderAll();
    return count;
  }

  window.SeatApp.labeling = {
    letterLabel: letterLabel,
    relabelAll: relabelAll,
    recolorAll: recolorAll
  };
})();
