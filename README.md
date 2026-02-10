# YouTube-Reset

YouTube の動画を **必ず 0:00 から再生**するための Chrome 拡張機能です．
YouTube の SPA（Single Page Application）構造に対応し，
動画遷移時に自動で再生位置をリセットします．

ON / OFF 切替，完了通知（トースト表示）にも対応しています．

---

## 機能概要

- YouTube の動画を **必ず 0:00 から再生**
- SPA 遷移対応（関連動画クリック，戻る/進む）
- 完了時に **中央上部へトースト通知**（2秒表示）
- 拡張機能アイコンから **ON / OFF 切替**
- OFF → ON 操作時の誤動作防止（再生中の動画には適用しない）

---

## 対応ページ

- `https://www.youtube.com/watch?v=[ID]`

※ 現在は `/watch` ページのみ対象
（Shorts や埋め込み動画は未対応）

---

## インストール方法（開発用）

1. このリポジトリをダウンロード，またはクローン
2. Chrome で以下を開く

`chrome://extensions/`

3. 右上の **「デベロッパーモード」** を ON
4. **「パッケージ化されていない拡張機能を読み込む」**
5. `YouTube-Reset` フォルダを選択

---

## 使い方

### 基本動作
- ON の状態で YouTube の動画ページを開く
- 動画が **自動的に 0:00 に戻る**
- 処理完了後，画面 **中央上部** に
`実行完了しました` と表示（2秒）

### ON / OFF 切替
- Chrome 右上の拡張機能アイコンをクリック
- トグルスイッチで有効 / 無効を切替

#### OFF 時の挙動
- 動画は **一切リセットされない**
- トーストも表示されない

#### OFF → ON 時の挙動（ver 1.2.1 以降）
- **切り替えた瞬間に再生中の動画には適用されない**
- 次に別動画へ遷移した時から有効

---

## ディレクトリ構成
```
YouTube-Reset/
├── manifest.json
├── content.js
├── toast.css
├── popup.html
├── popup.js
├── popup.css
└── README.md
```


---

## 技術仕様

- Chrome Extensions Manifest V3
- Content Script による制御
- YouTube SPA 対応  
  - History API（`pushState`，`replaceState`）
  - `yt-navigate-finish` イベント
  - `MutationObserver`
- 設定保存  
  - `chrome.storage.sync`
- 再生制御  
  - `HTMLVideoElement.currentTime = 0`

---

## 実装上の工夫

### OFF 状態でも実行されてしまう問題への対策（ver 1.2.2）

YouTube は以下のような非同期イベントを多用しています．

- `setTimeout`
- `loadedmetadata`
- `playing`
- DOM 差し替え（Mutation）

そのため，単純な ON / OFF フラグでは  
**OFF にした後で処理が走る問題**が発生します．

本拡張では以下の対策を行っています．

- 実行直前に **毎回 storage から enabled を再取得**
- OFF / ON 切替時に **世代管理（generation）** を行い，  
  古いイベントハンドラを無効化
- OFF 時は **予約済み処理を即キャンセル**

これにより，

- OFF 中は **100% 実行されない**
- OFF → ON 時の誤動作も発生しない

ことを保証しています．

---

## 変更履歴

### v1.2.2（現在）
- 修正：OFF 状態でも動画が 0:00 に戻る場合がある問題を修正
- 改善：処理世代管理（generation）を導入
- 改善：OFF/ON 切替時の競合・遅延実行を完全防止

### v1.2.1
- 修正：動画再生中に OFF → ON した場合，  
  その動画には処理を適用しないように変更

### v1.2.0
- 機能追加：拡張機能アイコンからの ON / OFF トグル
- 機能追加：トースト通知表示
- UI 改善：ポップアップ追加

### v1.1.0
- 機能追加：実行完了時のトースト通知
- UI 改善：通知の自動フェードアウト（2秒）

### v1.0.0
- 初回リリース
- 動画を常に 0:00 から再生
- YouTube SPA 遷移対応

---

## 注意事項

- 拡張機能を更新した後は，  
  **YouTube タブをリロード（推奨：スーパーリロード）**してください
- YouTube 側の仕様変更により動作しなくなる可能性があります

---

## 今後の予定（未実装）

- Shorts（`/shorts/`）対応
- プレイリスト再生時の挙動切替
- トースト表示 ON / OFF 設定
- 手動リセットボタン追加
- Chrome Web Store 公開対応

---

## ライセンス

MIT License

---

## 作者

設計・開発：Shunsuke MOROZUMI
