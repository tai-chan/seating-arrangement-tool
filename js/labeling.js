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

  function relabelAll(canvas) {
    var seatingObjects = canvas.getObjects().filter(function (o) {
      return o.category === 'seating';
    });

    seatingObjects.sort(function (a, b) {
      return a.getBoundingRect(true).top - b.getBoundingRect(true).top;
    });

    var rows = [];
    seatingObjects.forEach(function (obj) {
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

    var orderedTables = [];
    rows.forEach(function (row) {
      orderedTables = orderedTables.concat(row.items);
    });

    var counter = 0;
    orderedTables.forEach(function (table) {
      var seatLabels = table.getObjects()
        .filter(function (o) { return o.role === 'seatLabel'; })
        .sort(function (a, b) { return a.seatIndexLocal - b.seatIndexLocal; });
      seatLabels.forEach(function (labelObj) {
        labelObj.set('text', letterLabel(counter));
        counter++;
      });
    });

    canvas.requestRenderAll();
    return counter;
  }

  window.SeatApp.labeling = {
    letterLabel: letterLabel,
    relabelAll: relabelAll
  };
})();
