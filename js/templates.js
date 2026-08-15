window.SeatApp = window.SeatApp || {};

(function () {
  'use strict';

  var TEMPLATES = {
    A: {
      label: 'テンプレートA（2スクリーン＋扇形＋事務局）',
      items: [
        { type: 'screen', left: 260, top: 50 },
        { type: 'screen', left: 780, top: 50 },
        { type: 'podium', left: 990, top: 110 },
        { type: 'idesk', left: 210, top: 280, angle: -25, seatsPerSide: 3, color: 'blue' },
        { type: 'idesk', left: 840, top: 280, angle: 25, seatsPerSide: 3, color: 'blue' },
        { type: 'idesk', left: 520, top: 560, angle: 0, seatsPerSide: 2, color: 'blue' },
        { type: 'secretariat', left: 520, top: 800, deskCount: 3 }
      ]
    },
    B: {
      label: 'テンプレートB（1スクリーン・グリッド）',
      items: [
        { type: 'screen', left: 500, top: 50 },
        { type: 'idesk', left: 260, top: 220, seatsPerSide: 2, color: 'blue' },
        { type: 'idesk', left: 500, top: 220, seatsPerSide: 2, color: 'blue' },
        { type: 'idesk', left: 740, top: 220, seatsPerSide: 2, color: 'blue' },
        { type: 'idesk', left: 260, top: 420, seatsPerSide: 2, color: 'blue' },
        { type: 'idesk', left: 500, top: 420, seatsPerSide: 2, color: 'blue' },
        { type: 'idesk', left: 740, top: 420, seatsPerSide: 2, color: 'blue' }
      ]
    }
  };

  function apply(canvas, key) {
    var tpl = TEMPLATES[key];
    if (!tpl) return;

    if (canvas.getObjects().length > 0) {
      var ok = window.confirm('現在のレイアウトを消去してテンプレートを適用します。よろしいですか？');
      if (!ok) return;
    }

    canvas.clear();
    canvas.backgroundColor = '#ffffff';

    tpl.items.forEach(function (spec) {
      canvas.add(window.SeatApp.shapes.buildFurniture(spec));
    });

    window.SeatApp.labeling.relabelAll(canvas);
    canvas.requestRenderAll();
  }

  window.SeatApp.templates = {
    TEMPLATES: TEMPLATES,
    apply: apply
  };
})();
