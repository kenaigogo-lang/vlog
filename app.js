// 這些錯誤碼代表這個瀏覽器不能內嵌（沒登入、沒權限或 Cookie 被擋）。錯誤碼 5 在成功播放時也會出現，不能算在內。
var BLOCKED_ERRORS = [100, 101, 150, 153];

// 每本相簿的美術主題，依相簿名稱挑選；最後一項是新相簿的預設值
var THEMES = [
  { match: /大阪/, cover: 'osaka', stamp: 'OSAKA', cloth: '#7c3a2b', tape: '#d98a6a', stickers: ['takoyaki', 'lantern', 'castle', 'sun', 'camera'] },
  { match: /首爾/, cover: 'seoul', stamp: 'SEOUL', cloth: '#1f4c5c', tape: '#6fb2b0', stickers: ['tower', 'hanok', 'tteok', 'lantern', 'plane'] },
  { match: /煙火/, cover: 'fireworks', stamp: 'TAIPEI', cloth: '#1f2a57', tape: '#8f94cf', stickers: ['firework', 'boat', 'camera', 'heart'] },
  { match: /吐司|安魂/, cover: 'toast', stamp: 'ENCORE', cloth: '#4d3274', tape: '#b58ccb', stickers: ['toast', 'mask', 'note', 'moon'] },
  { match: /六福|樂園/, cover: 'park', stamp: 'FUN DAY', cloth: '#2f6d80', tape: '#ef9f7f', stickers: ['ferris', 'coaster', 'balloon', 'heart'] },
  { match: /美館|展/, cover: 'museum', stamp: 'TAIPEI', cloth: '#35516f', tape: '#a2bdc9', stickers: ['easel', 'frame', 'charcoal', 'camera'] },
  { match: /宜蘭/, cover: 'yilan', stamp: 'YILAN', cloth: '#2f7077', tape: '#8fc9bd', stickers: ['island', 'wave', 'scallion', 'sun'] },
  { match: /溜冰|小巨蛋/, cover: 'skate', stamp: 'ON ICE', cloth: '#274a7a', tape: '#9cc9df', stickers: ['skate', 'snow', 'dome', 'heart'] },
  { match: /彈跳|夜市/, cover: 'jump', stamp: 'BRAVE', cloth: '#6a2f4c', tape: '#e49a78', stickers: ['bungee', 'mist', 'skewer', 'stall'] },
  { match: /./, cover: 'trip', stamp: 'TRAVEL', cloth: '#74522e', tape: '#d6ab74', stickers: ['suitcase', 'plane', 'compass', 'camera'] }
];
// 影片標題提到這些地方時，內頁優先貼對應的貼紙
var VIDEO_STICKERS = [
  { match: /環球/, stickers: ['globe', 'coaster'] },
  { match: /海游館/, stickers: ['whale', 'fish'] }
];

var app = document.getElementById('app');
var searchInput = document.getElementById('search');
var narrowQuery = window.matchMedia('(max-width: 760px)');
var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
var albums = [];
var videos = [];
var selectedYear = null;
var view = 'albums';
var players = [];
var loadQueue = [];
var loadingPlayer = false;
var book = null;
var busy = false;

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function parseVideo(raw) {
  var video = Object.assign({}, raw);
  var dated = raw.title.match(/^(\d{4})(\d{2})(\d{2})\s*(.+)$/);
  var trip = raw.title.match(/^(\d{4})(.+?)\s*Day\s*(\d+)\s*(.*)$/i);
  if (dated) {
    video.year = dated[1];
    video.date = dated[1] + '-' + dated[2] + '-' + dated[3];
    video.albumId = video.date + '-' + dated[4];
    video.albumName = dated[4];
    video.label = dated[4];
    video.day = 0;
  } else if (trip) {
    video.year = trip[1];
    video.date = raw.uploaded;
    video.albumId = trip[1] + '-' + trip[2];
    video.albumName = trip[2];
    video.day = Number(trip[3]);
    video.label = 'Day ' + trip[3] + (trip[4] ? ' ' + trip[4] : '');
    video.isTrip = true;
  } else {
    video.year = raw.uploaded.slice(0, 4);
    video.date = raw.uploaded;
    video.albumId = raw.id;
    video.albumName = raw.title;
    video.label = raw.title;
    video.day = 0;
  }
  return video;
}

function buildAlbums(list) {
  var byId = {};
  var result = [];
  list.forEach(function (video) {
    var album = byId[video.albumId];
    if (!album) {
      album = byId[video.albumId] = {
        id: video.albumId,
        name: video.albumName,
        year: video.year,
        isTrip: Boolean(video.isTrip),
        date: video.date,
        videos: []
      };
      result.push(album);
    }
    album.videos.push(video);
    // 多日旅行的標題沒有日期，用最早的上傳日期排序
    if (video.date < album.date) album.date = video.date;
  });
  result.forEach(function (album) {
    album.videos.sort(function (a, b) { return a.day - b.day; });
  });
  result.sort(function (a, b) { return b.date.localeCompare(a.date); });
  result.forEach(function (album) {
    album.theme = THEMES.filter(function (theme) { return theme.match.test(album.name); })[0];
  });
  return result;
}

function albumDate(album) {
  return album.isTrip ? album.year : album.date.replace(/-/g, '.');
}

function watchLink(video) {
  var link = el('a', 'watch', '在 YouTube 開啟');
  link.href = 'https://www.youtube.com/watch?v=' + video.id;
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
}

function artImage(name, className) {
  var image = el('img', className);
  image.src = 'art/' + name + '.webp';
  image.alt = '';
  image.draggable = false;
  return image;
}

function coverArt(album) {
  var art = el('div', 'cover-art');
  art.style.setProperty('--cloth', album.theme.cloth);
  art.appendChild(artImage('cover-' + album.theme.cover, 'cover-painting'));
  art.appendChild(el('span', 'cover-spine'));
  art.appendChild(el('span', 'cover-corner cover-corner-top'));
  art.appendChild(el('span', 'cover-corner cover-corner-bottom'));
  var label = el('div', 'cover-label');
  label.appendChild(el('div', 'cover-name' + (album.name.length > 8 ? ' long' : ''), album.name));
  var meta = el('div', 'cover-meta');
  meta.appendChild(el('span', '', albumDate(album)));
  meta.appendChild(el('span', '', album.videos.length + ' 支影片'));
  label.appendChild(meta);
  art.appendChild(label);
  return art;
}

function sticker(name, className) {
  return artImage('s-' + name, 'sticker ' + className);
}

function postmark(album) {
  var mark = el('div', 'postmark');
  mark.appendChild(el('span', 'postmark-top', album.theme.stamp));
  mark.appendChild(el('span', 'postmark-date', albumDate(album)));
  return mark;
}

function postage(album) {
  var stamp = el('div', 'postage');
  stamp.appendChild(el('span', 'postage-paper'));
  stamp.appendChild(artImage('cover-' + album.theme.cover, 'postage-art'));
  stamp.appendChild(el('span', 'postage-price', album.year));
  return stamp;
}

function pageStickers(album, video, index) {
  var own = VIDEO_STICKERS.filter(function (item) { return item.match.test(video.title); })[0];
  var pool = album.theme.stickers;
  if (own) return [own.stickers[index % own.stickers.length], pool[index % pool.length]];
  return [pool[index % pool.length], pool[(index + 1) % pool.length]];
}

// 首頁

function renderToolbar() {
  var bar = el('div', 'toolbar');
  function chip(text, pressed, onClick) {
    var button = el('button', 'chip', text);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(pressed));
    button.addEventListener('click', onClick);
    bar.appendChild(button);
  }
  chip('相簿', view === 'albums', function () { view = 'albums'; render(); });
  chip('全部影片', view === 'all', function () { view = 'all'; render(); });
  var years = albums.map(function (album) { return album.year; })
    .filter(function (year, i, all) { return all.indexOf(year) === i; });
  if (years.length > 1) {
    chip('所有年份', selectedYear === null, function () { selectedYear = null; render(); });
    years.forEach(function (year) {
      chip(year, selectedYear === year, function () { selectedYear = year; render(); });
    });
  }
  app.appendChild(bar);
}

function renderAlbums() {
  renderToolbar();
  var lastYear = null;
  var shelf = null;
  albums.forEach(function (album, index) {
    if (selectedYear && album.year !== selectedYear) return;
    if (album.year !== lastYear) {
      lastYear = album.year;
      app.appendChild(el('h2', 'year-title', album.year));
      shelf = el('div', 'shelf');
      app.appendChild(shelf);
    }
    var card = el('a', 'album');
    card.href = '#/album/' + encodeURIComponent(album.id);
    card.dataset.album = album.id;
    card.style.setProperty('--tilt', [-1.6, 1.1, -.7, 1.8, -1.2, .8][index % 6] + 'deg');
    card.setAttribute('aria-label', album.name + '，' + albumDate(album) + '，' + album.videos.length + ' 支影片');
    card.appendChild(coverArt(album));
    shelf.appendChild(card);
  });
}

function renderRows(list) {
  if (!list.length) {
    app.appendChild(el('p', 'empty', '找不到符合的影片'));
    return;
  }
  var rows = el('ul', 'rows');
  list.forEach(function (video) {
    var row = el('li', 'row');
    var link = el('a', 'row-link');
    link.href = '#/album/' + encodeURIComponent(video.albumId) + '/' + video.id;
    link.appendChild(el('span', 'row-title', video.title));
    link.appendChild(el('span', 'row-meta', video.duration));
    row.appendChild(link);
    row.appendChild(watchLink(video));
    rows.appendChild(row);
  });
  app.appendChild(rows);
}

function render() {
  app.textContent = '';
  var query = searchInput.value.trim();
  if (query) {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    renderRows(videos.filter(function (video) {
      var title = video.title.toLowerCase();
      return terms.every(function (term) { return title.indexOf(term) !== -1; });
    }));
  } else if (view === 'all') {
    renderToolbar();
    renderRows(videos.filter(function (video) {
      return !selectedYear || video.year === selectedYear;
    }));
  } else {
    renderAlbums();
  }
}

// 內嵌播放器

function destroyPlayers() {
  loadQueue = [];
  loadingPlayer = false;
  players.forEach(function (player) { if (player.destroy) player.destroy(); });
  players = [];
}

function showBlocked(frame, video) {
  frame.textContent = '';
  frame.classList.add('blocked');
  frame.appendChild(artImage('cover-' + frame.cover, 'blocked-art'));
  frame.appendChild(el('span', 'blocked-hint', '這裡無法直接播放，可能需要先登入 YouTube'));
  frame.appendChild(watchLink(video));
}

function loadNext() {
  if (loadingPlayer || !loadQueue.length) return;
  loadingPlayer = true;
  loadPlayer(loadQueue.shift());
}

function playerSettled() {
  loadingPlayer = false;
  loadNext();
}

function loadPlayer(frame) {
  if (!window.YT || !YT.Player) {
    setTimeout(function () {
      if (frame.isConnected) loadPlayer(frame);
      else playerSettled();
    }, 300);
    return;
  }
  var video = frame.video;
  // 同時載入多個播放器會很慢，一次載入一個；YouTube 沒回應時也要繼續下一個
  var settleTimer = setTimeout(settle, 8000);
  function settle() {
    if (settleTimer === null) return;
    clearTimeout(settleTimer);
    settleTimer = null;
    playerSettled();
  }
  var mount = el('div');
  frame.appendChild(mount);
  var player = new YT.Player(mount, {
    videoId: video.id,
    playerVars: { playsinline: 1, rel: 0 },
    events: {
      onReady: function () { setTimeout(settle, 500); },
      onError: function (event) {
        if (BLOCKED_ERRORS.indexOf(event.data) !== -1) {
          showBlocked(frame, video);
          players.splice(players.indexOf(player), 1);
        }
        settle();
      },
      onStateChange: function (event) {
        if (event.data !== YT.PlayerState.PLAYING) return;
        players.forEach(function (other) {
          if (other !== player && other.pauseVideo) other.pauseVideo();
        });
      }
    }
  });
  players.push(player);
}

function loadVisiblePlayers() {
  if (!book) return;
  book.root.querySelectorAll('.slot .frame').forEach(function (frame) {
    loadQueue.push(frame);
  });
  loadNext();
}

// 相本內頁

function bookPages(album) {
  var pages = album.videos.map(function (video) { return { video: video }; });
  if (narrowQuery.matches) return pages;
  pages.unshift({ title: true });
  if (pages.length % 2) pages.push({ end: true });
  return pages;
}

function pageElement(page, album) {
  var node = el('div', 'page');
  node.style.setProperty('--tape', album.theme.tape);
  if (page.title) {
    node.classList.add('page-cover');
    var top = el('div', 'cover-top');
    var plate = el('div', 'plate');
    plate.appendChild(artImage('cover-' + album.theme.cover, 'plate-art'));
    plate.appendChild(el('span', 'tape tape-a'));
    top.appendChild(plate);
    var heading = el('div', 'cover-heading');
    heading.appendChild(el('h1', 'page-title' + (album.name.length > 8 ? ' long' : ''), album.name));
    heading.appendChild(el('p', 'page-meta', albumDate(album) + '・' + album.videos.length + ' 支影片'));
    heading.appendChild(postmark(album));
    heading.appendChild(sticker(album.theme.stickers[0], 'sticker-heading'));
    top.appendChild(heading);
    node.appendChild(top);
    var note = el('div', 'note');
    note.appendChild(artImage('p-clip', 'note-clip'));
    var toc = el('ul', 'toc');
    album.videos.forEach(function (video) {
      var item = el('li');
      var button = el('button', 'toc-item');
      button.type = 'button';
      button.appendChild(el('span', '', video.label));
      button.appendChild(el('span', '', video.duration));
      button.addEventListener('click', function () { goToVideo(video.id); });
      item.appendChild(button);
      toc.appendChild(item);
    });
    note.appendChild(toc);
    node.appendChild(note);
    if (album.videos.length < 7) {
      node.appendChild(sticker(album.theme.stickers[1], 'sticker-cover-a'));
      node.appendChild(sticker(album.theme.stickers[2], 'sticker-cover-b'));
      node.appendChild(sticker(album.theme.stickers[3] || 'camera', 'sticker-cover-c'));
    }
  } else if (page.end) {
    node.classList.add('page-end');
    node.appendChild(artImage('p-postcard', 'end-card'));
    node.appendChild(el('p', 'end-text', '下一趟，繼續寫…'));
    node.appendChild(sticker('plane', 'sticker-end-a'));
    node.appendChild(sticker(album.theme.stickers[3] || 'suitcase', 'sticker-end-b'));
    node.appendChild(el('span', 'route'));
  } else {
    var video = page.video;
    var index = album.videos.indexOf(video);
    node.classList.add('page-video', ['paper-dots', 'paper-lines', 'paper-grid'][index % 3]);
    node.appendChild(el('p', 'page-tab', album.name));
    node.appendChild(postage(album));
    var photo = el('div', 'page-photo');
    photo.appendChild(el('span', 'tape tape-a'));
    photo.appendChild(el('span', 'tape tape-b'));
    var frame = el('div', 'frame');
    frame.video = video;
    frame.cover = album.theme.cover;
    photo.appendChild(frame);
    node.appendChild(photo);
    var lower = el('div', 'page-lower lower-' + index % 3);
    var caption = el('div', 'page-caption');
    caption.appendChild(el('h2', 'video-title', video.label));
    var ticket = el('div', 'ticket');
    ticket.appendChild(el('span', 'ticket-no', 'No. ' + (index + 1)));
    ticket.appendChild(el('span', 'ticket-time', video.duration));
    caption.appendChild(ticket);
    caption.appendChild(watchLink(video));
    lower.appendChild(caption);
    var picks = pageStickers(album, video, index);
    lower.appendChild(sticker(picks[0], 'sticker-a'));
    lower.appendChild(sticker(picks[1], 'sticker-b'));
    lower.appendChild(postmark(album));
    node.appendChild(lower);
  }
  return node;
}

function fillSlot(slot, page) {
  slot.textContent = '';
  if (page) slot.appendChild(pageElement(page, book.album));
}

function step() {
  return narrowQuery.matches ? 1 : 2;
}

function showSpread(index) {
  book.index = index;
  fillSlot(book.left, narrowQuery.matches ? null : book.pages[index]);
  fillSlot(book.right, narrowQuery.matches ? book.pages[index] : book.pages[index + 1]);
  updateBar();
}

function updateBar() {
  var size = step();
  var total = Math.ceil(book.pages.length / size);
  book.count.textContent = (book.index / size + 1) + ' / ' + total;
  book.prev.disabled = book.index === 0;
  book.next.disabled = book.index + size >= book.pages.length;
}

function animate(node, keyframes, duration, easing) {
  var motion = node.animate(keyframes, {
    duration: motionQuery.matches ? 1 : duration,
    easing: easing || 'cubic-bezier(.45, .05, .3, 1)',
    fill: 'both'
  });
  return motion.finished;
}

function spreadIndexOf(videoId) {
  var pageIndex = -1;
  book.pages.forEach(function (page, i) {
    if (page.video && page.video.id === videoId) pageIndex = i;
  });
  if (pageIndex < 0) return 0;
  return pageIndex - pageIndex % step();
}

function leafFaces(leaf, front, back) {
  var frontFace = el('div', 'face');
  var backFace = el('div', 'face face-back');
  if (front) frontFace.appendChild(pageElement(front, book.album));
  if (back) backFace.appendChild(pageElement(back, book.album));
  leaf.appendChild(frontFace);
  leaf.appendChild(backFace);
}

function flipTo(index) {
  if (!book || busy || index === book.index || index < 0 || index >= book.pages.length) return;
  busy = true;
  destroyPlayers();
  var forward = index > book.index;
  var pages = book.pages;
  var current = book.index;
  var leaf = el('div', 'leaf');
  var flip;

  if (narrowQuery.matches) {
    leaf.classList.add('leaf-right');
    if (forward) {
      fillSlot(book.right, pages[index]);
      leafFaces(leaf, pages[current], null);
      book.root.appendChild(leaf);
      flip = animate(leaf, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], 800);
    } else {
      fillSlot(book.right, pages[current]);
      leafFaces(leaf, pages[index], null);
      book.root.appendChild(leaf);
      flip = animate(leaf, [{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }], 800);
    }
  } else if (forward) {
    leaf.classList.add('leaf-right');
    fillSlot(book.left, pages[current]);
    fillSlot(book.right, pages[index + 1]);
    leafFaces(leaf, pages[current + 1], pages[index]);
    book.root.appendChild(leaf);
    flip = animate(leaf, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], 900);
  } else {
    leaf.classList.add('leaf-left');
    fillSlot(book.left, pages[index]);
    fillSlot(book.right, pages[current + 1]);
    leafFaces(leaf, pages[current], pages[index + 1]);
    book.root.appendChild(leaf);
    flip = animate(leaf, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], 900);
  }

  flip.then(function () {
    leaf.remove();
    showSpread(index);
    busy = false;
    loadVisiblePlayers();
    syncRoute();
  });
}

function goToVideo(videoId) {
  flipTo(spreadIndexOf(videoId));
}

function bookButton(text, label, onClick) {
  var button = el('button', 'book-button', text);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick);
  return button;
}

// 相本從桌面飛到畫面中央，再翻開封面

function closedShift() {
  return narrowQuery.matches ? 0 : -book.root.offsetWidth / 4;
}

function restTransform(card) {
  // 回傳相本蓋著、對齊首頁那本相簿時的位置
  var rect = book.root.getBoundingClientRect();
  var pageWidth = narrowQuery.matches ? book.root.offsetWidth : book.root.offsetWidth / 2;
  var target = card && card.getBoundingClientRect();
  if (!target || !target.width) return 'translate(' + closedShift() + 'px, 40px) scale(.82)';
  var scale = target.width / pageWidth;
  var coverCenter = narrowQuery.matches ? 0 : scale * pageWidth / 2;
  var dx = target.left + target.width / 2 - (rect.left + rect.width / 2) - coverCenter;
  var dy = target.top + target.height / 2 - (rect.top + rect.height / 2);
  return 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ')';
}

function makeCover(backPage) {
  var cover = el('div', 'book-cover');
  var front = el('div', 'face');
  front.appendChild(coverArt(book.album));
  var back = el('div', 'face face-back');
  if (backPage) back.appendChild(pageElement(backPage, book.album));
  else back.appendChild(el('div', 'endpaper'));
  cover.appendChild(front);
  cover.appendChild(back);
  book.root.appendChild(cover);
  return cover;
}

function openBook(album, videoId) {
  busy = true;
  document.body.classList.add('book-open');
  var stage = el('div', 'stage');
  stage.setAttribute('role', 'dialog');
  stage.setAttribute('aria-label', album.name);
  var root = el('div', 'book');
  root.style.setProperty('--cloth', album.theme.cloth);
  var left = el('div', 'slot slot-left pending');
  var right = el('div', 'slot slot-right');
  root.appendChild(left);
  root.appendChild(right);
  stage.appendChild(root);

  var bar = el('div', 'book-bar');
  var close = bookButton('合上相本', '合上相本', function () { location.hash = '#/'; });
  var prev = bookButton('‹', '上一頁', function () { flipTo(book.index - step()); });
  var count = el('span', 'book-count');
  var next = bookButton('›', '下一頁', function () { flipTo(book.index + step()); });
  bar.appendChild(close);
  bar.appendChild(prev);
  bar.appendChild(count);
  bar.appendChild(next);
  stage.appendChild(bar);
  document.body.appendChild(stage);

  book = { album: album, stage: stage, root: root, left: left, right: right, prev: prev, next: next, count: count, index: 0 };
  book.pages = bookPages(album);
  album.theme.stickers.forEach(function (name) { new Image().src = 'art/s-' + name + '.webp'; });
  addSwipe(stage);
  showSpread(spreadIndexOf(videoId));

  var card = document.querySelector('[data-album="' + CSS.escape(album.id) + '"]');
  book.card = card;
  var rest = restTransform(card);
  if (card) card.style.visibility = 'hidden';
  var cover = makeCover(narrowQuery.matches ? null : book.pages[book.index]);
  var closed = 'translateX(' + closedShift() + 'px)';

  animate(stage, [{ opacity: 0 }, { opacity: 1 }], 500);
  animate(root, [{ transform: rest }, { transform: closed }], 650)
    .then(function () {
      left.classList.remove('pending');
      left.style.visibility = 'hidden';
      return Promise.all([
        animate(root, [{ transform: closed }, { transform: 'translateX(0)' }], 1100),
        animate(cover, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], 1100)
      ]);
    })
    .then(function () {
      left.style.visibility = '';
      cover.remove();
      root.getAnimations().forEach(function (motion) { motion.cancel(); });
      busy = false;
      close.focus({ preventScroll: true });
      loadVisiblePlayers();
      syncRoute();
    });
}

function closeBook() {
  busy = true;
  destroyPlayers();
  var current = book;
  var cover = makeCover(narrowQuery.matches ? null : book.pages[book.index]);
  current.left.style.visibility = 'hidden';
  var closed = 'translateX(' + closedShift() + 'px)';
  var rest = restTransform(current.card && current.card.isConnected ? current.card : null);
  Promise.all([
    animate(current.root, [{ transform: 'translateX(0)' }, { transform: closed }], 900),
    animate(cover, [{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }], 900)
  ]).then(function () {
    animate(current.stage, [{ opacity: 1 }, { opacity: 0 }], 500);
    return animate(current.root, [{ transform: closed }, { transform: rest }], 550);
  }).then(function () {
    if (current.card) current.card.style.visibility = '';
    current.stage.remove();
    document.body.classList.remove('book-open');
    book = null;
    busy = false;
    syncRoute();
  });
}

function addSwipe(stage) {
  var startX = null;
  stage.addEventListener('touchstart', function (event) {
    startX = event.touches[0].clientX;
  }, { passive: true });
  stage.addEventListener('touchend', function (event) {
    if (startX === null) return;
    var distance = event.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(distance) < 50) return;
    flipTo(book.index + (distance < 0 ? step() : -step()));
  }, { passive: true });
}

// 路由：動畫進行中不切換，播完再對齊網址

function syncRoute() {
  if (busy) return;
  var match = location.hash.match(/^#\/album\/([^/]+)(?:\/(.+))?$/);
  var album = match && albums.filter(function (item) {
    return item.id === decodeURIComponent(match[1]);
  })[0];
  if (book && (!album || album !== book.album)) {
    closeBook();
  } else if (album && !book) {
    openBook(album, match[2]);
  } else if (album && match[2]) {
    var target = spreadIndexOf(match[2]);
    if (target !== book.index) flipTo(target);
  }
}

window.addEventListener('hashchange', function () {
  if (searchInput.value) {
    searchInput.value = '';
    render();
  }
  syncRoute();
});

searchInput.addEventListener('input', render);

document.addEventListener('keydown', function (event) {
  if (!book) return;
  if (event.key === 'Escape') location.hash = '#/';
  else if (event.key === 'ArrowRight') flipTo(book.index + step());
  else if (event.key === 'ArrowLeft') flipTo(book.index - step());
});

narrowQuery.addEventListener('change', function () {
  if (!book || busy) return;
  destroyPlayers();
  var firstVideo = book.pages.slice(book.index).filter(function (page) { return page.video; })[0];
  book.pages = bookPages(book.album);
  showSpread(firstVideo ? spreadIndexOf(firstVideo.video.id) : 0);
  loadVisiblePlayers();
});

fetch('videos.json')
  .then(function (response) { return response.json(); })
  .then(function (list) {
    videos = list.map(parseVideo);
    albums = buildAlbums(videos);
    videos = albums.reduce(function (all, album) { return all.concat(album.videos); }, []);
    render();
    syncRoute();
  })
  .catch(function () {
    app.appendChild(el('p', 'empty', '影片清單載入失敗，請重新整理'));
  });
