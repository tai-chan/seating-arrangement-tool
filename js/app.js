window.SeatApp = window.SeatApp || {};

(function () {
  'use strict';

  function defaultSpecFor(type, seats, cascadeIndex) {
    var cascadeOffset = (cascadeIndex % 6) * 24;
    var base = {
      type: type,
      left: 250 + cascadeOffset,
      top: 200 + cascadeOffset,
      angle: 0
    };
    if (type === 'idesk') {
      base.seatCount = (seats || 3) * 2;
      base.color = 'blue';
    } else if (type === 'tdesk') {
      base.seatsPerSide = 2;
      base.barSeatCount = 2;
      base.color = 'blue';
    } else if (type === 'round') {
      base.seatCount = 6;
      base.color = 'blue';
    } else if (type === 'secretariat-desk') {
      base.deskCount = 1;
    }
    return base;
  }

  function downloadPNG(canvas) {
    window.SeatApp.labeling.relabelAll(canvas);
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    var zoom = canvas.getZoom();
    var dataURL = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 / zoom });
    var link = document.createElement('a');
    link.href = dataURL;
    link.download = 'seating-chart.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function runWizard(canvas) {
    var screenCount = parseInt(document.getElementById('wiz-screens').value, 10);
    var deskTypeKey = document.getElementById('wiz-desk-type').value;
    var maxCols = Math.max(1, parseInt(document.getElementById('wiz-max-cols').value, 10) || 1);
    var deskCount = Math.max(1, parseInt(document.getElementById('wiz-desk-count').value, 10) || 1);

    window.SeatApp.templates.generateAuto(canvas, {
      screenCount: screenCount,
      deskTypeKey: deskTypeKey,
      maxCols: maxCols,
      deskCount: deskCount
    });
    fitCanvasToViewport(canvas);
  }

  // Shrinks (never enlarges) the canvas's on-screen display so the whole
  // generated layout fits inside .canvas-wrap without needing to scroll,
  // regardless of how large the content actually is. Object coordinates are
  // untouched — only Fabric's view zoom + the canvas element's own pixel
  // size change, so export can still ask for full-resolution output by
  // dividing the multiplier by the current zoom (see downloadPNG).
  function fitCanvasToViewport(canvas) {
    var wrap = document.querySelector('.canvas-wrap');
    if (!wrap) return;
    var zoom = canvas.getZoom();
    var contentWidth = canvas.getWidth() / zoom;
    var contentHeight = canvas.getHeight() / zoom;
    var availW = wrap.clientWidth - 24;
    var availH = wrap.clientHeight - 24;
    if (availW <= 0 || availH <= 0) return;

    var scale = Math.min(1, availW / contentWidth, availH / contentHeight);
    canvas.setZoom(scale);
    canvas.setWidth(contentWidth * scale);
    canvas.setHeight(contentHeight * scale);
    canvas.requestRenderAll();
  }

  function promptRenameLabel(canvas, table) {
    var labelObj = table.getObjects().filter(function (o) { return o.role === 'tableLabel'; })[0];
    if (!labelObj) return;
    var next = window.prompt('ラベルを入力してください', labelObj.text);
    if (next === null) return;
    labelObj.set('text', next);
    canvas.requestRenderAll();
  }

  function init() {
    var canvasEl = document.getElementById('seat-canvas');
    var canvas = new fabric.Canvas(canvasEl, {
      backgroundColor: '#ffffff',
      selection: true
    });
    window.SeatApp.canvas = canvas;

    window.SeatApp.inspector.init(canvas);

    var placeCounter = 0;
    var paletteButtons = document.querySelectorAll('.palette button[data-type]');
    Array.prototype.forEach.call(paletteButtons, function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-type');
        var seatsAttr = btn.getAttribute('data-seats');
        var spec = defaultSpecFor(type, seatsAttr ? parseInt(seatsAttr, 10) : undefined, placeCounter++);
        var items = window.SeatApp.shapes.buildFurnitureItems(spec);
        items.forEach(function (obj) { canvas.add(obj); });
        var primary = items[0];
        canvas.setActiveObject(primary);
        window.SeatApp.labeling.relabelAll(canvas);
        canvas.requestRenderAll();
        if (type === 'text' && typeof primary.enterEditing === 'function') {
          primary.enterEditing();
          primary.selectAll();
        }
      });
    });

    document.getElementById('btn-generate').addEventListener('click', function () {
      runWizard(canvas);
    });
    document.getElementById('btn-relabel').addEventListener('click', function () {
      window.SeatApp.labeling.relabelAll(canvas);
    });
    document.getElementById('btn-recolor').addEventListener('click', function () {
      window.SeatApp.labeling.recolorAll(canvas);
    });
    document.getElementById('btn-export').addEventListener('click', function () {
      downloadPNG(canvas);
    });

    // Double-click a table to rename its alphabet label directly.
    canvas.on('mouse:dblclick', function (e) {
      if (e.target && e.target.category === 'seating') {
        promptRenameLabel(canvas, e.target);
      }
    });

    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        var active = canvas.getActiveObject();
        if (active) {
          canvas.remove(active);
          canvas.discardActiveObject();
          window.SeatApp.labeling.relabelAll(canvas);
          canvas.requestRenderAll();
        }
      }
    });

    window.addEventListener('resize', function () {
      fitCanvasToViewport(canvas);
    });

    fitCanvasToViewport(canvas);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
