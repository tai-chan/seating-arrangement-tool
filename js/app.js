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
      base.seatsPerSide = seats || 2;
      base.color = 'blue';
    } else if (type === 'tdesk') {
      base.seatCount = 4;
      base.color = 'blue';
    } else if (type === 'round') {
      base.seatCount = 6;
      base.color = 'blue';
    }
    return base;
  }

  function downloadPNG(canvas) {
    window.SeatApp.labeling.relabelAll(canvas);
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    var dataURL = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
    var link = document.createElement('a');
    link.href = dataURL;
    link.download = 'seating-chart.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function runWizard(canvas) {
    var orientation = document.getElementById('wiz-orientation').value;
    var screenCount = parseInt(document.getElementById('wiz-screens').value, 10);
    var deskTypeKey = document.getElementById('wiz-desk-type').value;
    var deskCount = Math.max(1, parseInt(document.getElementById('wiz-desk-count').value, 10) || 1);

    window.SeatApp.templates.generateAuto(canvas, {
      orientation: orientation,
      screenCount: screenCount,
      deskTypeKey: deskTypeKey,
      deskCount: deskCount,
      color: 'blue'
    });
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
        var group = window.SeatApp.shapes.buildFurniture(spec);
        canvas.add(group);
        canvas.setActiveObject(group);
        window.SeatApp.labeling.relabelAll(canvas);
        canvas.requestRenderAll();
      });
    });

    document.getElementById('btn-generate').addEventListener('click', function () {
      runWizard(canvas);
    });
    document.getElementById('btn-relabel').addEventListener('click', function () {
      window.SeatApp.labeling.relabelAll(canvas);
    });
    document.getElementById('btn-export').addEventListener('click', function () {
      downloadPNG(canvas);
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
  }

  document.addEventListener('DOMContentLoaded', init);
})();
