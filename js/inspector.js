window.SeatApp = window.SeatApp || {};

(function () {
  'use strict';

  var TYPE_LABELS = {
    idesk: 'I字机',
    tdesk: 'T字机',
    round: '丸机',
    screen: 'スクリーン',
    podium: 'MC席',
    mc: 'MC',
    'secretariat-desk': '事務局机',
    'secretariat-person': '事務局',
    text: 'テキスト'
  };

  var containerEl = null;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'text') {
        node.textContent = attrs[k];
      } else if (k === 'class') {
        node.className = attrs[k];
      } else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
        node.addEventListener(k.slice(2), attrs[k]);
      } else {
        node.setAttribute(k, attrs[k]);
      }
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function currentLabelText(group) {
    var tl = group.getObjects().filter(function (o) { return o.role === 'tableLabel'; })[0];
    return tl ? tl.text : '';
  }

  // Rebuild (seat count/color/desk count change) delegates to the shared
  // shapes.rebuildWithPatch, which preserves the table's label text and
  // re-selects the new group; the inspector just needs to re-render itself
  // against that new group afterward.
  function rebuildInPlace(canvas, group, patch) {
    var newGroup = window.SeatApp.shapes.rebuildWithPatch(canvas, group, patch);
    canvas.requestRenderAll();
    render(canvas, newGroup);
    if (window.SeatApp.history) window.SeatApp.history.push();
  }

  function labelInput(canvas, group) {
    return el('input', {
      type: 'text',
      class: 'label-input',
      value: currentLabelText(group),
      maxlength: '6',
      oninput: function (e) {
        var tl = group.getObjects().filter(function (o) { return o.role === 'tableLabel'; })[0];
        if (tl) tl.set('text', e.target.value);
        canvas.requestRenderAll();
      }
    });
  }

  function colorSwatches(canvas, group) {
    var colors = ['red', 'blue', 'green', 'yellow'];
    var row = el('div', { class: 'swatch-row' });
    colors.forEach(function (c) {
      var cls = 'swatch swatch-' + c + (group.tableColor === c ? ' active' : '');
      row.appendChild(el('button', {
        class: cls,
        title: c,
        onclick: function () { rebuildInPlace(canvas, group, { color: c }); }
      }));
    });
    return row;
  }

  function stepper(canvas, group, field, min, max) {
    var current = group[field];
    var display;
    var wrap = el('div', { class: 'stepper' });
    wrap.appendChild(el('button', {
      class: 'stepper-btn',
      text: '−',
      onclick: function () {
        if (current > min) {
          var patch = {};
          patch[field] = current - 1;
          rebuildInPlace(canvas, group, patch);
        }
      }
    }));
    display = el('span', { class: 'stepper-value', text: String(current) });
    wrap.appendChild(display);
    wrap.appendChild(el('button', {
      class: 'stepper-btn',
      text: '＋',
      onclick: function () {
        if (current < max) {
          var patch = {};
          patch[field] = current + 1;
          rebuildInPlace(canvas, group, patch);
        }
      }
    }));
    return wrap;
  }

  function toggle22_33(canvas, group) {
    var wrap = el('div', { class: 'toggle-row' });
    [2, 3].forEach(function (n) {
      var cls = 'toggle-btn' + (group.seatsPerSide === n ? ' active' : '');
      wrap.appendChild(el('button', {
        class: cls,
        text: n + ':' + n,
        onclick: function () { rebuildInPlace(canvas, group, { seatsPerSide: n }); }
      }));
    });
    return wrap;
  }

  function deleteButton(canvas, group) {
    return el('button', {
      class: 'delete-btn',
      text: 'この項目を削除',
      onclick: function () {
        canvas.remove(group);
        canvas.discardActiveObject();
        window.SeatApp.labeling.relabelAll(canvas);
        canvas.requestRenderAll();
        clearPanel();
        if (window.SeatApp.history) window.SeatApp.history.push();
      }
    });
  }

  function render(canvas, group) {
    if (!containerEl || !group || !group.furnitureType) {
      clearPanel();
      return;
    }
    containerEl.innerHTML = '';

    var title = document.getElementById('inspector-title');
    if (title) title.textContent = TYPE_LABELS[group.furnitureType] || '';

    if (group.furnitureType === 'idesk') {
      containerEl.appendChild(el('div', { class: 'field-label', text: 'ラベル' }));
      containerEl.appendChild(labelInput(canvas, group));
      containerEl.appendChild(el('div', { class: 'field-label', text: '座席数（1〜6）' }));
      containerEl.appendChild(stepper(canvas, group, 'seatCount', 1, 6));
      containerEl.appendChild(el('div', { class: 'field-label', text: 'テーブルクロスの色' }));
      containerEl.appendChild(colorSwatches(canvas, group));
    } else if (group.furnitureType === 'tdesk') {
      containerEl.appendChild(el('div', { class: 'field-label', text: 'ラベル' }));
      containerEl.appendChild(labelInput(canvas, group));
      containerEl.appendChild(el('div', { class: 'field-label', text: '幹の座席パターン' }));
      containerEl.appendChild(toggle22_33(canvas, group));
      containerEl.appendChild(el('div', { class: 'field-label', text: '土台の座席数（1〜6）' }));
      containerEl.appendChild(stepper(canvas, group, 'barSeatCount', 1, 6));
      containerEl.appendChild(el('div', { class: 'field-label', text: 'テーブルクロスの色' }));
      containerEl.appendChild(colorSwatches(canvas, group));
    } else if (group.furnitureType === 'round') {
      containerEl.appendChild(el('div', { class: 'field-label', text: 'ラベル' }));
      containerEl.appendChild(labelInput(canvas, group));
      containerEl.appendChild(el('div', { class: 'field-label', text: '座席数（1〜12）' }));
      containerEl.appendChild(stepper(canvas, group, 'seatCount', 1, 12));
      containerEl.appendChild(el('div', { class: 'field-label', text: 'テーブルクロスの色' }));
      containerEl.appendChild(colorSwatches(canvas, group));
    } else if (group.furnitureType === 'secretariat-desk') {
      containerEl.appendChild(el('div', { class: 'field-label', text: '机の数（1〜6）' }));
      containerEl.appendChild(stepper(canvas, group, 'deskCount', 1, 6));
    }

    containerEl.appendChild(deleteButton(canvas, group));

    var panel = document.getElementById('inspector');
    if (panel) panel.classList.remove('empty');
  }

  function clearPanel() {
    if (containerEl) containerEl.innerHTML = '';
    var title = document.getElementById('inspector-title');
    if (title) title.textContent = '';
    var panel = document.getElementById('inspector');
    if (panel) panel.classList.add('empty');
  }

  function handleSelection(canvas, selected) {
    if (selected && selected.length === 1 && selected[0].furnitureType) {
      render(canvas, selected[0]);
    } else {
      clearPanel();
    }
  }

  function init(canvas) {
    containerEl = document.getElementById('inspector-body');
    canvas.on('selection:created', function (e) { handleSelection(canvas, e.selected); });
    canvas.on('selection:updated', function (e) { handleSelection(canvas, e.selected); });
    canvas.on('selection:cleared', function () { clearPanel(); });
  }

  window.SeatApp.inspector = {
    init: init,
    rebuildInPlace: rebuildInPlace
  };
})();
