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
    pushHistory(canvas);
  }

  // ---- Undo history ----
  // Fabric has no built-in undo, so we keep a linear stack of full-canvas
  // JSON snapshots and a pointer into it. Only custom (non-standard) object
  // properties need to be named explicitly — Fabric already round-trips its
  // own properties (position, scale, angle, fill, ...) by default. `role`
  // must survive on GROUP CHILDREN too (rebuildWithPatch/rename both look
  // for role:'tableLabel' inside a table's children after a restore).
  var HISTORY_PROPS = ['furnitureType', 'category', 'tableColor', 'seatCount', 'seatsPerSide', 'barSeatCount', 'deskCount', 'role'];
  var HISTORY_LIMIT = 50;
  var history = [];
  var historyIndex = -1;
  var isRestoringHistory = false;

  function snapshotCanvas(canvas) {
    return JSON.stringify(canvas.toJSON(HISTORY_PROPS));
  }

  // Call after any completed, user-visible change (one push per action, not
  // per internal add/remove) so "元に戻す" steps back one whole action at a
  // time rather than one Fabric event at a time.
  function pushHistory(canvas) {
    if (isRestoringHistory) return;
    var snap = snapshotCanvas(canvas);
    if (historyIndex >= 0 && history[historyIndex] === snap) return;
    history = history.slice(0, historyIndex + 1);
    history.push(snap);
    historyIndex = history.length - 1;
    if (history.length > HISTORY_LIMIT) {
      history.shift();
      historyIndex--;
    }
    updateUndoButton();
  }

  function undo(canvas) {
    if (historyIndex <= 0) return;
    if (canvas.getActiveObject() && canvas.getActiveObject().isEditing) return;
    historyIndex--;
    isRestoringHistory = true;
    canvas.discardActiveObject();
    canvas.loadFromJSON(history[historyIndex], function () {
      canvas.requestRenderAll();
      isRestoringHistory = false;
      updateUndoButton();
    });
  }

  function updateUndoButton() {
    var btn = document.getElementById('btn-undo');
    if (btn) btn.disabled = historyIndex <= 0;
  }

  // Fabric's native dblclick detection relies on the browser coalescing two
  // clicks into a single 'dblclick' DOM event within its own OS-level
  // timing/position tolerance — trackpads can miss that window. We track
  // clicks on the same target ourselves instead, with a more forgiving
  // 600ms window and no position tolerance requirement (same object is
  // enough), so a table's alphabet label is reliably renameable.
  var DOUBLE_CLICK_MS = 600;
  var lastClickTarget = null;
  var lastClickTime = 0;

  function handleTableClick(canvas, e) {
    var target = e.target;
    if (!target || target.category !== 'seating') {
      lastClickTarget = null;
      return;
    }
    var now = Date.now();
    if (lastClickTarget === target && (now - lastClickTime) < DOUBLE_CLICK_MS) {
      lastClickTarget = null;
      promptRenameLabel(canvas, target);
    } else {
      lastClickTarget = target;
      lastClickTime = now;
    }
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
        pushHistory(canvas);
      });
    });

    document.getElementById('btn-generate').addEventListener('click', function () {
      runWizard(canvas);
      pushHistory(canvas);
    });
    document.getElementById('btn-relabel').addEventListener('click', function () {
      window.SeatApp.labeling.relabelAll(canvas);
      pushHistory(canvas);
    });
    document.getElementById('btn-recolor').addEventListener('click', function () {
      window.SeatApp.labeling.recolorAll(canvas);
      pushHistory(canvas);
    });
    document.getElementById('btn-export').addEventListener('click', function () {
      downloadPNG(canvas);
    });
    document.getElementById('btn-undo').addEventListener('click', function () {
      undo(canvas);
    });

    // Table rename-by-double-click (see handleTableClick above for why this
    // isn't the native 'mouse:dblclick' event). Also captures the tail end
    // of drag/resize/rotate and inline text edits into undo history.
    canvas.on('mouse:down', function (e) { handleTableClick(canvas, e); });
    canvas.on('object:modified', function () { pushHistory(canvas); });
    canvas.on('text:editing:exited', function () { pushHistory(canvas); });

    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      var active = canvas.getActiveObject();
      if (active && active.isEditing) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo(canvas);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (active) {
          canvas.remove(active);
          canvas.discardActiveObject();
          window.SeatApp.labeling.relabelAll(canvas);
          canvas.requestRenderAll();
          pushHistory(canvas);
        }
      }
    });

    window.addEventListener('resize', function () {
      fitCanvasToViewport(canvas);
    });

    window.SeatApp.history = {
      push: function () { pushHistory(canvas); },
      undo: function () { undo(canvas); }
    };

    fitCanvasToViewport(canvas);
    pushHistory(canvas);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
