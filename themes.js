// 每本相簿的美術主題，由上而下比對相簿 ID（例如 2024-大阪、2024-07-06-宜蘭）；最後一項是新相簿的預設值
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
  { match: /薑餅/, cover: 'gingerbread', stamp: 'XMAS DIY', cloth: '#24503d', tape: '#e6c79a', stickers: ['gingerhouse', 'piping', 'antlers', 'candies'] },
  { match: /交車/, cover: 'newcar', stamp: 'NEW CAR', cloth: '#3d4f66', tape: '#eba28f', stickers: ['carbow', 'carkey', 'fuelpump', 'heart'] },
  { match: /./, cover: 'trip', stamp: 'TRAVEL', cloth: '#74522e', tape: '#d6ab74', stickers: ['suitcase', 'plane', 'compass', 'camera'] }
];
// 影片標題提到這些地方時，內頁優先貼對應的貼紙
var VIDEO_STICKERS = [
  { match: /環球/, stickers: ['globe', 'coaster'] },
  { match: /海游館/, stickers: ['whale', 'fish'] }
];
