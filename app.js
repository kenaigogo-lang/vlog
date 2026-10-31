var COVERS = ['#7a3b2e', '#2f5d62', '#5b6b3a', '#6b4a7a', '#a0662a', '#35506e', '#8a4a5c', '#4d5a50'];
// 這些錯誤碼代表這個瀏覽器不能內嵌（沒登入、沒權限或 Cookie 被擋）。錯誤碼 5 在成功播放時也會出現，不能算在內。
var BLOCKED_ERRORS = [100, 101, 150, 153];

var app = document.getElementById('app');
var searchInput = document.getElementById('search');
var albums = [];
var videos = [];
var selectedYear = null;
var view = 'albums';
var observer = null;
var players = [];
var loadQueue = [];
var loadingPlayer = false;

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
  result.forEach(function (album, index) { album.cover = COVERS[index % COVERS.length]; });
  return result;
}

function albumDate(album) {
  return album.isTrip ? album.year : album.date.replace(/-/g, '.');
}

function watchUrl(video) {
  return 'https://www.youtube.com/watch?v=' + video.id;
}

function watchLink(video) {
  var link = el('a', 'watch', '在 YouTube 開啟');
  link.href = watchUrl(video);
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
}

function resetPage() {
  if (observer) observer.disconnect();
  observer = null;
  loadQueue = [];
  players.forEach(function (player) { if (player.destroy) player.destroy(); });
  players = [];
  app.textContent = '';
}

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
  albums.forEach(function (album) {
    if (selectedYear && album.year !== selectedYear) return;
    if (album.year !== lastYear) {
      lastYear = album.year;
      app.appendChild(el('h2', 'year-title', album.year));
      shelf = el('div', 'shelf');
      app.appendChild(shelf);
    }
    var card = el('a', 'album');
    card.href = '#/album/' + encodeURIComponent(album.id);
    card.style.setProperty('--cover', album.cover);
    card.appendChild(el('span', 'album-date', albumDate(album)));
    card.appendChild(el('span', 'album-name', album.name));
    card.appendChild(el('span', 'album-count', album.videos.length + ' 支影片'));
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

function renderAll() {
  renderToolbar();
  renderRows(videos.filter(function (video) {
    return !selectedYear || video.year === selectedYear;
  }));
}

function renderSearch(query) {
  var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  renderRows(videos.filter(function (video) {
    var title = video.title.toLowerCase();
    return terms.every(function (term) { return title.indexOf(term) !== -1; });
  }));
}

function showBlocked(frame, video) {
  frame.textContent = '';
  frame.classList.add('blocked');
  frame.appendChild(el('span', 'blocked-title', video.label));
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

function renderAlbum(albumId, videoId) {
  var album = albums.filter(function (item) { return item.id === albumId; })[0];
  if (!album) {
    location.hash = '#/';
    return;
  }
  var back = el('a', 'back', '← 回到相簿');
  back.href = '#/';
  app.appendChild(back);
  app.appendChild(el('h1', 'page-title', album.name));
  app.appendChild(el('p', 'page-meta', albumDate(album) + '・' + album.videos.length + ' 支影片'));

  var grid = el('div', 'videos');
  // 內嵌播放器很吃資源，捲到附近才載入
  observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      loadQueue.push(entry.target);
      loadNext();
    });
  }, { rootMargin: '300px' });

  album.videos.forEach(function (video) {
    var item = el('article', 'video');
    item.id = 'v-' + video.id;
    var frame = el('div', 'frame');
    frame.video = video;
    item.appendChild(frame);
    var info = el('div', 'video-info');
    info.appendChild(el('h2', 'video-title', video.label));
    info.appendChild(el('span', 'video-duration', video.duration));
    item.appendChild(info);
    item.appendChild(watchLink(video));
    grid.appendChild(item);
    observer.observe(frame);
  });
  app.appendChild(grid);

  if (videoId) {
    var target = document.getElementById('v-' + videoId);
    if (target) target.scrollIntoView();
  } else {
    window.scrollTo(0, 0);
  }
}

function render() {
  resetPage();
  var query = searchInput.value.trim();
  var match = location.hash.match(/^#\/album\/([^/]+)(?:\/(.+))?$/);
  if (query) renderSearch(query);
  else if (match) renderAlbum(decodeURIComponent(match[1]), match[2]);
  else if (view === 'all') renderAll();
  else renderAlbums();
}

function onHashChange() {
  searchInput.value = '';
  render();
}

window.addEventListener('hashchange', onHashChange);
searchInput.addEventListener('input', render);

fetch('videos.json')
  .then(function (response) { return response.json(); })
  .then(function (list) {
    videos = list.map(parseVideo);
    albums = buildAlbums(videos);
    videos = albums.reduce(function (all, album) { return all.concat(album.videos); }, []);
    render();
  })
  .catch(function () {
    app.appendChild(el('p', 'empty', '影片清單載入失敗，請重新整理'));
  });
