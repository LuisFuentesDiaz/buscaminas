const fs = require('fs');
// Mojibake: UTF-8 bytes of emoji interpreted as Latin-1, then saved. So 0xF0->U+00F0 (ð), 0x9F->U+0178 (Ÿ), etc.
function fixBuscaminas() {
  let s = fs.readFileSync('juegos/buscaminas/index.html', 'utf8');
  s = s.replace(/\u00f0\u0178\u0027\u00a3/g, '\uD83D\uDCA3');
  s = s.replace(/\u00f0\u0178\u2019\u00a3/g, '\uD83D\uDCA3');   // bomb with curly quote
  s = s.replace(/\u00f0\u0178[\u0092\u201a]\u00a3/g, '\uD83D\uDCA3');
  s = s.replace(/\u00f0\u009f\u0092\u00a3/g, '\uD83D\uDCA3');
  s = s.replace(/\u00f0\u0178\u008f\u0086/g, '\uD83C\uDFC6');
  s = s.replace(/\u00f0\u0178\u008f\u2020/g, '\uD83C\uDFC6');   // 🏆 (trophy: †)
  s = s.replace(/\u00f0\u009f\u008f\u0086/g, '\uD83C\uDFC6');
  s = s.replace(/\u00f0\u0178\u0094\u008a/g, '\uD83D\uDD0A');
  s = s.replace(/\u00f0\u0178\u201d\u0160/g, '\uD83D\uDD0A');   // 🔊 (speaker: "Š)
  s = s.replace(/\u00f0\u009f\u0094\u008a/g, '\uD83D\uDD0A');
  fs.writeFileSync('juegos/buscaminas/index.html', s, 'utf8');
}
function fixAjedrez() {
  let s = fs.readFileSync('juegos/ajedrez/index.html', 'utf8');
  s = s.replace(/\u00f0\u009f\u0094\u0084/g, '\uD83D\uDD04');   // 🔄
  s = s.replace(/\u00f0\u009f\u0094\u008a/g, '\uD83D\uDD0A');   // 🔊
  s = s.replace(/\u00f0\u0178\u0094\u0084/g, '\uD83D\uDD04');
  s = s.replace(/\u00f0\u0178\u0094\u008a/g, '\uD83D\uDD0A');
  s = s.replace(/\u00f0\u0178\u201d\u0160/g, '\uD83D\uDD0A');   // 🔊
  s = s.replace(/\u00f0\u0178\u201d\u201e/g, '\uD83D\uDD04');   // 🔄 (Nuevo)
  s = s.replace(/\u00f0\u0178\u0094\u0084/g, '\uD83D\uDD04');
  fs.writeFileSync('juegos/ajedrez/index.html', s, 'utf8');
}
fixBuscaminas();
fixAjedrez();
console.log('Fixed.');
