// Run tr.js outside the browser (for checking dictionary entries):
//   node engine-simulator/i18n/tr_node.cjs en "日本語の文字列" ...
const fs = require('fs'), path = require('path'), vm = require('vm');
const [lang, ...strs] = process.argv.slice(2);
const ctx = {
  window: {}, MutationObserver: class { observe() {} },
  document: { documentElement: {}, addEventListener() {} },
};
ctx.window.I18N = JSON.parse(fs.readFileSync(path.join(__dirname, `${lang}.json`), 'utf8'));
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'tr.js'), 'utf8'), ctx);
for (const s of strs) {
  ctx.window.__i18nMissing.clear();
  console.log(ctx.window.__tr(s));
  if (ctx.window.__i18nMissing.size) console.log('  missing:', [...ctx.window.__i18nMissing].join(' | '));
}
