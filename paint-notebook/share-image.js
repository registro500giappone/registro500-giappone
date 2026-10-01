// 共有・保存する画像に、ロゴとURLを焼き込む（500・126 共通）
// 共有は「押された流れの中」で同期的に呼ぶ必要がある＝ロゴはページ読み込み時に loadLogo() で先に読んでおき、compose() 以降は同期処理だけにする

// ロゴ画像を decode まで済ませて返す。読めなくても reject せず null（呼ぶ側はロゴ無しで続行する）
export async function loadLogo(src){
  try{ const img = new Image(); img.src = src; await img.decode(); return img; }catch(e){ return null; }
}

// 描画済みの canvas に、右下のロゴ（半透明の白い角丸の下地つき）と左下のURL文字を重ねた 2D canvas を返す（すべて同期）
export function compose(srcCanvas, logoImg, urlText){
  const W = srcCanvas.width, H = srcCanvas.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(srcCanvas, 0, 0);
  const m = Math.round(H * 0.02); let logoW = 0;
  if(logoImg && logoImg.naturalWidth){
    const lh = H * 0.06, lw = lh * logoImg.naturalWidth / logoImg.naturalHeight, p = lh * 0.18; logoW = lw + p * 2;
    const x = W - m - logoW, y = H - m - lh - p * 2;
    g.fillStyle = 'rgba(255,255,255,.72)'; g.beginPath();
    if(g.roundRect) g.roundRect(x, y, logoW, lh + p * 2, lh * 0.25); else g.rect(x, y, logoW, lh + p * 2);
    g.fill(); g.drawImage(logoImg, x + p, y + p, lw, lh);
  }
  if(urlText){
    let fs = Math.max(10, H * 0.025); g.font = '600 ' + fs + 'px sans-serif';
    const room = W - logoW - m * 3, tw = g.measureText(urlText).width; // ロゴと重ならないよう、幅が足りなければ文字を縮める
    if(tw > room && room > 0){ fs = Math.max(8, fs * room / tw); g.font = '600 ' + fs + 'px sans-serif'; }
    g.textBaseline = 'bottom'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = fs * 0.3; g.shadowOffsetY = 1;
    g.fillText(urlText, m, H - m);
  }
  return c;
}

// toDataURL('image/png') の結果から File を組む（共有は toBlob の非同期を挟めないので、同期の atob で作る）
export function dataUrlToFile(dataUrl, name){
  const bin = atob(dataUrl.split(',')[1]), buf = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new File([buf], name, { type: 'image/png' });
}

// ファイルを共有シートへ渡せる端末か
export function canShareFiles(){
  try{ return !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })); }catch(e){ return false; }
}
