// 駆動系の札（presets_drive_packs.js）の検品。node test_drive_packs.js
// 計算核（vehicle.js・sim.js）・presets_vehicle.js は無変更＝ここは新しい層だけを見る。
import { readFileSync } from 'node:fs';
import { DRIVE_PACKS, packFits, packChoices } from './presets_drive_packs.js';
import { MODELS } from './presets.js';
import { GEARSETS, FINALS, TIRES, FIFTHS, GEARBOXES, buildVehicle } from './presets_vehicle.js';
import { rpmAtSpeed } from './vehicle.js';

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else { console.log('  ✓ ' + m); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const rpm80 = (modelId, choices) => {
  const { drive } = buildVehicle(modelId, choices);
  return rpmAtSpeed(80, drive.gears[drive.gears.length - 1], drive);
};

console.log('① 全札の choices の id が各一覧に存在する');
{
  for (const p of DRIVE_PACKS) {
    for (const [k, v] of Object.entries(p.choices)) {
      const list = { gearbox: GEARBOXES, gearset: GEARSETS, final: FINALS, tire: TIRES, fifth: FIFTHS }[k];
      ok(list && list.some((o) => o.id === v), `${p.id} の ${k}:${v} が存在する`);
    }
  }
}

console.log('② 全札が少なくとも1型式で適合して出る');
{
  for (const p of DRIVE_PACKS) {
    const hit = MODELS.some((m) => packFits(m.id, {}, p));
    ok(hit, `${p.id} が少なくとも1型式で適合する`);
  }
}

console.log('③ back の3段が各150字以内で空でない');
{
  for (const p of DRIVE_PACKS) {
    for (const k of ['change', 'feel', 'care']) {
      const s = p.back[k];
      ok(typeof s === 'string' && s.length > 0 && [...s].length <= 150, `${p.id}.back.${k} 長さ ${s ? [...s].length : 0}`);
    }
  }
}

console.log('④ bacci_34 を含む札は fifth が none でない');
{
  const withBacci = DRIVE_PACKS.filter((p) => p.choices.gearset === 'bacci_34');
  ok(withBacci.length > 0, 'bacci_34 を含む札が存在する');
  withBacci.forEach((p) => ok(p.choices.fifth && p.choices.fifth !== 'none', `${p.id} の fifth = ${p.choices.fifth}`));
}

console.log('⑤ dp_f939 が 500D で出ない・500F では出る');
{
  const p = DRIVE_PACKS.find((x) => x.id === 'dp_f939');
  ok(!packFits('500D', {}, p), 'dp_f939 は 500D に出ない');
  ok(packFits('500F', {}, p), 'dp_f939 は 500F に出る');
}

console.log('⑥ dp_box・dp_box841 が 126A・500R で出ない');
{
  const pBox = DRIVE_PACKS.find((x) => x.id === 'dp_box');
  const pBox841 = DRIVE_PACKS.find((x) => x.id === 'dp_box841');
  for (const id of ['126A', '500R']) {
    ok(!packFits(id, {}, pBox), `dp_box は ${id} に出ない`);
    ok(!packFits(id, {}, pBox841), `dp_box841 は ${id} に出ない`);
  }
  // 500 N/D/F/L/GIA では出る（本来の対象）
  ok(packFits('500F', {}, pBox), 'dp_box は 500F に出る');
  ok(packFits('500F', {}, pBox841), 'dp_box841 は 500F に出る');
}

console.log('⑦ 80km/h・最上段の回転（rpmAtSpeed・rollingRadius_m の 0.97 込みの実値を基準にする）');
{
  const stock = rpm80('500F', {});
  ok(near(stock, 3887, 15), `500F 純正 ${stock.toFixed(0)} vs 3887±15`);
  const f839 = rpm80('500F', packChoices({}, DRIVE_PACKS.find((p) => p.id === 'dp_f839')));
  ok(near(f839, 3697, 15), `dp_f839 ${f839.toFixed(0)} vs 3697±15`);
  const nanni = rpm80('500F', packChoices({}, DRIVE_PACKS.find((p) => p.id === 'dp_nanni34')));
  ok(near(nanni, 4240, 15), `dp_nanni34 ${nanni.toFixed(0)} vs 4240±15`);
  const fifth = rpm80('500F', packChoices({}, DRIVE_PACKS.find((p) => p.id === 'dp_fifth_long')));
  ok(near(fifth, 3300, 20), `dp_fifth_long ${fifth.toFixed(0)} vs 3300±20`);
}

console.log('⑨ 全札が6場面のどれかに属する');
{
  const SCENES = ['cruise', 'hill', 'launch', 'bigger', 'sync', 'look'];
  for (const p of DRIVE_PACKS) {
    ok(Array.isArray(p.cases) && p.cases.length > 0, `${p.id}.cases が空でない配列`);
    ok((p.cases || []).every((c) => SCENES.includes(c)), `${p.id}.cases が6場面のみ`);
  }
}

console.log('⑧ ファイル3つに固有名・ローカルパスが無い');
{
  // 禁止語の一覧はここだけに書く＝この行自体は検品対象から除く（行番号で自分を除外）。
  const words = ['u' + 'cm', 'veg' + 'lia', 'bor' + 'letti', 'v' + '17', 'registro500' + '-notes', 'C:' + '\\\\' + 'Users', 'HAND' + 'OFF', 'ユーザー' + '指示', '定' + '番', 'おす' + 'すめ', '貧' + '者', 'す' + 'べき'];
  const banned = new RegExp(words.join('|'), 'i');
  const files = ['presets_drive_packs.js', 'test_drive_packs.js', 'gearbox.html'];
  for (const f of files) {
    const text = readFileSync(new URL(f, import.meta.url), 'utf8');
    const body = text.split('\n').filter((line) => !line.includes('const words = [')).join('\n');
    ok(!banned.test(body), `${f} に禁止語が無い`);
  }
}

console.log(fails ? `\n失敗 ${fails} 件` : '\nすべて通過'); process.exit(fails ? 1 : 0);
