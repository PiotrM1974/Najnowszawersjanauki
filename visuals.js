(function (root) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function lines(value, width = 24) {
    const words = value.split(' '), result = [''];
    for (const word of words) {
      if (result[result.length - 1].length + word.length + 1 > width && result[result.length - 1]) result.push(word);
      else result[result.length - 1] += (result[result.length - 1] ? ' ' : '') + word;
    }
    return result;
  }
  function text(value, x, y, size = 24, fill = '#2e3046', weight = 650) {
    return `<text x="${x}" y="${y}" text-anchor="middle" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="system-ui, sans-serif">${escape(value)}</text>`;
  }

  function boardTone(index) {
    return ['board-ones', 'board-tens', 'board-hundreds'][index % 3];
  }

  function boardTable(digits, focus) {
    const names = ['jedności', 'dziesiątki', 'setki', 'tysiące', 'dzies. tys.', 'setki tys.'];
    const columns = [...digits].map((digit, i) => {
      const place = digits.length - 1 - i;
      return { digit, place, cls: boardTone(place) + (place === focus ? ' board-focus' : '') };
    });
    const headers = columns.map(({place, cls}) => '<th scope="col" class="' + cls + '">' + names[place] + '</th>');
    const values = columns.map(({digit, place, cls}) => '<td class="' + cls + '">' + (Number(digit) * 10 ** place).toLocaleString('pl-PL') + '</td>');
    return '<div class="board-scroll"><table class="board-places" aria-label="Wartość cyfr liczby ' + escape(digits) +
      '"><thead><tr>' + headers.join('') + '</tr></thead><tbody><tr class="board-digits">' +
      columns.map(({digit, cls}) => '<td class="' + cls + '">' + escape(digit) + '</td>').join('') +
      '</tr><tr>' + values.join('') + '</tr></tbody></table></div>';
  }

  function boardColumns(a, b, sign, notes, carry = []) {
    const result = sign === '+' ? a + b : a - b;
    const width = Math.max(String(a).length, String(b).length, String(result).length);
    const headings = ['jedności', 'dziesiątki', 'setki', 'tysiące'].slice(0, width).reverse();
    function row(values, label, className = '') {
      return '<tr class="' + className + '"><td>' + label + '</td>' + values.map((value, i) =>
        '<td class="' + boardTone(width - 1 - i) + '">' + escape(value) + '</td>').join('') + '</tr>';
    }
    const digits = number => [...String(number).padStart(width, ' ')];
    return '<div class="board-calculation"><table class="board-columns" aria-label="' + a + ' ' + sign + ' ' + b + ' = ' + result +
      '"><thead><tr><td></td>' + headings.map((name, i) => '<th scope="col" class="' + boardTone(width - 1 - i) + '">' + name + '</th>').join('') +
      '</tr></thead><tbody>' + (carry.length ? row(carry, '<span class="sr-only">Przeniesienie</span>', 'board-carry') : '') +
      row(digits(a), '') + row(digits(b), sign) + row(digits(result), '<span class="sr-only">Wynik</span>', 'board-total') +
      '</tbody></table>' + boardSteps(notes, true) + '</div>';
  }

  function boardAxis(numbers, jumps, excluded) {
    const x = i => 45 + i * 370 / (numbers.length - 1);
    const ticks = numbers.map((number, i) => {
      const label = number.toLocaleString('pl-PL');
      const color = i === excluded ? '#9b3d40' : '#303144';
      return '<path d="M' + x(i) + ' 91v17" stroke="' + color + '" stroke-width="2"/>' +
        '<text x="' + x(i) + '" y="133" fill="' + color + '" text-anchor="middle" font-size="22">' + escape(label) + '</text>';
    });
    const arcs = jumps.map((i, index) => {
      const from = x(i) + 3, to = x(i + 1) - 4, middle = (from + to) / 2;
      const color = index % 2 ? '#7a357d' : '#116648';
      return '<path d="M' + from + ' 83Q' + middle + ' 23 ' + to + ' 83m-2-8 2 8-8-2" fill="none" stroke="' + color + '" stroke-width="2.5"/>' +
        '<text x="' + middle + '" y="45" fill="' + color + '" text-anchor="middle" font-size="20">+' + (numbers[i + 1] - numbers[i]) + '</text>';
    });
    return '<svg class="board-svg" viewBox="0 0 465 145" role="img" aria-label="' +
      escape('Oś liczbowa. ' + numbers.join(', ') + (excluded === undefined ? '' : '. Liczba ' + numbers[excluded] + ' jest poza zakresem.')) +
      '"><path d="M18 100H450m-8-7 8 7-8 7" fill="none" stroke="#464858" stroke-width="2"/>' + ticks.join('') + arcs.join('') + '</svg>';
  }

  function boardPalindrome(value) {
    const x = i => 52 + i * 376 / (value.length - 1);
    const pairs = Math.floor(value.length / 2);
    const arcs = Array.from({ length: pairs }, (_, i) => {
      const color = i === 0 ? '#116648' : '#7a357d';
      const height = 24 + 50 * i;
      return '<path d="M' + x(i) + ' 105C' + x(i) + ' ' + height + ' ' + x(value.length - 1 - i) + ' ' + height + ' ' +
        x(value.length - 1 - i) + ' 105" fill="none" stroke="' + color + '" stroke-width="3"/>' +
        '<text x="240" y="' + (32 + 36 * i) + '" fill="' + color + '" text-anchor="middle" font-size="19" font-weight="700">' +
        (i === 0 ? 'skrajne cyfry' : value.length === 4 ? 'środkowe cyfry' : 'druga para') + '</text>';
    });
    const cells = [...value].map((digit, i) => {
      const pair = Math.min(i, value.length - 1 - i);
      const color = pair === 0 ? '#116648' : pair === 1 && pair < pairs ? '#7a357d' : '#6e501c';
      const pale = pair === 0 ? '#edf6f0' : pair === 1 && pair < pairs ? '#f6edf6' : '#fff3de';
      return '<rect x="' + (x(i) - 33) + '" y="105" width="66" height="66" rx="10" fill="' + pale + '" stroke="' + color + '"/>' +
        '<text x="' + x(i) + '" y="152" fill="' + color + '" text-anchor="middle" font-size="41" font-weight="700">' + escape(digit) + '</text>';
    });
    return '<svg class="board-svg" viewBox="0 0 480 185" role="img" aria-label="' + escape('Pary cyfr w liczbie ' + value) +
      '">' + arcs.join('') + cells.join('') + '</svg>';
  }

  function boardGroups(count, size, remainder) {
    function group(amount, rest = false) {
      const dots = amount <= 20 ? '<span class="board-dots">' + '<i></i>'.repeat(amount) + '</span>' : '';
      return '<span class="board-group' + (rest ? ' board-rest' : '') + '">' + dots + '<b>' + amount + '</b></span>';
    }
    const remainderPanel = remainder ? '<div><p class="board-group-label board-ones">Zostaje ' + remainder +
      '</p>' + group(remainder, true) + '</div>' : '';
    return '<div class="board-groups" aria-hidden="true"><div><p class="board-group-label board-tens">' +
      count + ' ' + (count === 4 ? 'pełne grupy' : 'pełnych grup') + ' po ' + size +
      '</p><div class="board-group-row">' + Array.from({length: count}, () => group(size)).join('') +
      '</div></div>' + remainderPanel + '</div>';
  }

  function boardDiagram(diagram) {
    if (!diagram) return '';
    const [type, ...values] = diagram;
    switch (type) {
      case 'place': return boardTable(...values);
      case 'columns': return boardColumns(...values);
      case 'axis': return boardAxis(...values);
      case 'pal': return boardPalindrome(...values);
      case 'groups': return boardGroups(...values);
      case 'tiles': {
        const [tiles, captions] = values;
        return '<div class="board-tiles">' + tiles.map((tile, i) => '<div class="' + boardTone(i) + '"><b>' +
          escape(tile) + '</b>' + (captions[i] ? '<small>' + escape(captions[i]) + '</small>' : '') + '</div>').join('') + '</div>';
      }
      case 'grid': {
        const [side, value] = values;
        const rows = Array.from({length: side}, () => '<tr>' + ('<td>' + escape(value) + '</td>').repeat(side) + '</tr>');
        return '<table class="board-square" aria-label="' + side + ' na ' + side + ' równych pól"><tbody>' + rows.join('') + '</tbody></table>';
      }
      default: return '';
    }
  }

  function boardSteps(steps, colorful = false) {
    return '<ol class="board-steps">' + steps.map((step, i) =>
      '<li' + (colorful ? ' class="' + boardTone(i) + '"' : '') + '>' + escape(step) + '</li>').join('') + '</ol>';
  }

  function renderMathBoard(visual) {
    const {title, steps, diagram, caption} = visual;
    const content = boardDiagram(diagram);
    let working = diagram?.[0] === 'columns' ? '' : boardSteps(steps);
    if (diagram?.[0] === 'groups' && diagram[3] > 0) {
      const [, count, size, remainder] = diagram;
      const grouped = count * size;
      const total = grouped + remainder;
      const number = value => value.toLocaleString('pl-PL');
      working = '<ol class="board-steps"><li><strong class="board-tens">' + count + ' × ' + size + ' = ' + number(grouped) +
        '</strong> w pełnych grupach</li><li><strong class="board-ones">' + number(total) + ' − ' + number(grouped) + ' = ' + remainder +
        '</strong> zostaje</li></ol><p class="board-equation">' + number(total) + ' : ' + size + ' = <strong class="board-tens">' +
        count + '</strong>, reszta <strong class="board-ones">' + remainder + '</strong></p>';
    }
    return '<figure class="class-board"><figcaption>' + escape(title) + '</figcaption>' + content + working +
      (caption ? '<p class="board-note">' + escape(caption) + '</p>' : '') + '</figure>';
  }

  function render(item) {
    if (item.category === 'math') return renderMathBoard(item.visual);
    const { steps = [], title = '', caption } = item.visual || {};
    const stepMarkup = steps.map((step, index) => {
      const [label, note] = String(step || '').split('|');
      return `<li><span class="visual-step-marker" aria-hidden="true">${index + 1}</span><div class="visual-step-card"><p>${escape(label)}</p>${note ? `<small>${escape(note)}</small>` : ''}</div></li>`;
    }).join('');
    return `<figure class="visual visual-timeline"><figcaption><strong>${escape(title)}</strong>${caption ? `<span>${escape(caption)}</span>` : ''}</figcaption><ol aria-label="Kolejne kroki">${stepMarkup}</ol></figure>`;
  }
  function hero() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 280" aria-hidden="true" class="hero-art"><circle cx="182" cy="145" r="112" fill="#e9e2f6"/><path d="M60 92Q122 67 180 98Q239 67 302 92L296 228Q231 208 180 237Q120 208 66 228Z" fill="#fffaf0" stroke="#66528e" stroke-width="4" stroke-linejoin="round"/><path d="M180 99V235" stroke="#b8a8cc" stroke-width="3"/><path d="M83 118Q124 103 162 122M83 141Q124 126 162 145M83 164Q124 149 162 168M200 118Q240 103 280 118M200 141Q240 126 280 141" fill="none" stroke="#ccc0dd" stroke-width="6" stroke-linecap="round"/><path d="M225 203L271 157L282 168L236 214L219 220Z" fill="#e9a05e" stroke="#875830" stroke-width="3"/><path d="M219 220L225 203L236 214Z" fill="#66528e"/><path d="M169 65C155 32 189 18 192 55C205 31 224 52 197 68" fill="#92b39b" stroke="#557e62" stroke-width="3"/><path d="M84 55L88 66L100 70L88 74L84 86L80 74L68 70L80 66Z" fill="#d48c52"/><circle cx="291" cy="57" r="7" fill="#a190c0"/><path d="M310 215L313 223L322 226L313 229L310 238L307 229L298 226L307 223Z" fill="#d48c52"/></svg>`;
  }
  function discoveryMap() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 580" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="map-sky" x2="0" y2="1"><stop stop-color="#80d1f3"/><stop offset="1" stop-color="#d2f0f1"/></linearGradient><linearGradient id="map-sea" x2="0" y2="1"><stop stop-color="#36bfd1"/><stop offset="1" stop-color="#157ca7"/></linearGradient><linearGradient id="map-land" x2="0" y2="1"><stop stop-color="#c4e773"/><stop offset="1" stop-color="#51be9e"/></linearGradient></defs><rect width="1000" height="580" fill="url(#map-sky)"/><circle cx="830" cy="95" r="54" fill="#ffe481"/><path d="M0 270 120 182l78 55 151-147 135 145 112-80 162 122 130-72 112 76v299H0Z" fill="#75aee4"/><path d="m270 246 79-156 101 156-91-56Z" fill="#f8fbff"/><path d="M0 328q124-92 272-37t285 11q150-77 443 7v271H0Z" fill="url(#map-sea)"/><path d="M0 382q179-59 294 8t199 28q129-7 203-56t304-6v224H0Z" fill="url(#map-land)"/><path d="M0 484q154-62 285-29t223 11q124-31 209-88t283-27v229H0Z" fill="#65cfad"/><path d="M72 435c90-70 154-65 226-28s104 37 173-4 115-72 190-41 99 67 186 36 103-58 155-33" fill="none" stroke="#fff8d4" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 22"/><g transform="translate(704 315)"><path d="M0 72 38 0l38 72Z" fill="#1e6282"/><path d="M23 72 60 5l37 67Z" fill="#29839a"/><path d="M15 45 38 0l24 45Z" fill="#f7ffff"/><path d="M49 44 60 5l22 39Z" fill="#f7ffff"/><rect x="35" y="72" width="38" height="28" rx="4" fill="#f8c84d"/><rect x="46" y="79" width="12" height="21" fill="#19355f"/></g><g transform="translate(464 302)"><rect x="17" y="2" width="11" height="57" rx="5" fill="#f9f9f0"/><path d="M4 5q19-21 38 0v17H4Z" fill="#ff866e" stroke="#17345e" stroke-width="4"/><path d="M-4 60h48M2 61 8 78M38 61l-6 17" fill="none" stroke="#17345e" stroke-width="6" stroke-linecap="round"/><circle cx="22" cy="27" r="15" fill="#ffe587" opacity=".55"/></g><g transform="translate(80 92)"><circle cx="48" cy="48" r="42" fill="#fff"/><path d="m48 13 11 35-11 35-11-35Z" fill="#ff806e"/><path d="m13 48 35-11 35 11-35 11Z" fill="#17345e"/><circle cx="48" cy="48" r="7" fill="#ffe481"/></g></svg>`;
  }
  function narniaScene() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="narnia-night" x2="0" y2="1"><stop stop-color="#163664"/><stop offset="1" stop-color="#4f85a8"/></linearGradient><linearGradient id="narnia-snow" x2="0" y2="1"><stop stop-color="#f7fcff"/><stop offset="1" stop-color="#c6e2f3"/></linearGradient><radialGradient id="narnia-glow"><stop stop-color="#ffe89a" stop-opacity=".8"/><stop offset="1" stop-color="#ffe89a" stop-opacity="0"/></radialGradient></defs><rect width="1000" height="560" fill="url(#narnia-night)"/><circle cx="745" cy="260" r="190" fill="url(#narnia-glow)"/><g fill="#244d78"><path d="M0 327 156 191l130 95 118-164 179 209 143-147 116 117 158-141v400H0Z"/><path d="m47 369 78-198 78 198h-43l50 66H39l50-66ZM195 408l64-158 64 158h-35l42 60H189l42-60ZM820 367l83-205 83 205h-48l51 68H815l52-68Z"/></g><path d="m329 210 75-88 88 132-76-42ZM682 250l42-66 67 78-61-27Z" fill="#e8f7ff"/><path d="M0 382q152-65 309-2t313 0q141-63 378-10v190H0Z" fill="url(#narnia-snow)"/><path d="M0 459q181-62 355-10t300-9q163-65 345-14v134H0Z" fill="#e6f4fc"/><g fill="#eefaff"><path d="m93 251 32-80 32 80-32-18ZM229 323l30-73 30 73-30-16ZM861 253l42-91 40 91-40-24Z"/></g><g transform="translate(650 168)"><path d="M30 252 49 58" stroke="#293f59" stroke-width="13" stroke-linecap="round"/><path d="M18 66q30-33 60 0v52H18Z" fill="#ffd75e" stroke="#253d5a" stroke-width="9"/><path d="M11 119h74M30 251h54" stroke="#253d5a" stroke-width="12" stroke-linecap="round"/><circle cx="49" cy="93" r="78" fill="url(#narnia-glow)"/></g><g transform="translate(120 260)"><rect width="178" height="182" rx="9" fill="#714b35" stroke="#f2c977" stroke-width="9"/><rect x="18" y="18" width="68" height="146" rx="5" fill="#916241" stroke="#d4a65b" stroke-width="4"/><rect x="94" y="18" width="66" height="146" rx="5" fill="#86593c" stroke="#d4a65b" stroke-width="4"/><circle cx="72" cy="93" r="5" fill="#f8d783"/><circle cx="104" cy="93" r="5" fill="#f8d783"/></g><path d="M325 421q116-63 250-9t265-12" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 22" opacity=".8"/></svg>`;
  }
  root.MaleKrokiVisuals = { render, hero, discoveryMap, narniaScene, escape, lines, boardSteps };
  if (typeof module !== 'undefined') module.exports = root.MaleKrokiVisuals;
})(typeof globalThis !== 'undefined' ? globalThis : window);
