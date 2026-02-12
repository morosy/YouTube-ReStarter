# YouTube-ReStarter

現在のバージョン：v1.4.0  

YouTube の動画を **必ず 0:00 から再生**するための Chrome 拡張機能です．  
YouTube の SPA（Single Page Application）構造に対応し，動画遷移時に自動で再生位置をリセットします．  

ver 1.3 系より設定画面による詳細カスタマイズに対応しています．  
ver 1.3.5 より再生時間の復元に対応しています．  
ver 1.4.0 より **ON / OFF に応じた動的アイコン切替**に対応しています．  

---

## 機能概要

- YouTube の動画を **必ず 0:00 から再生**
- SPA 遷移対応（関連動画クリック，戻る/進む）
- 完了時にトースト通知（設定に応じて表示）
- 拡張機能アイコンから **ON / OFF 切替**
- OFF → ON 操作時の誤動作防止
- トースト詳細カスタマイズ（位置，大きさ，表示時間，背景色，文字色）
- 保存ボタン方式
- 未保存状態インジケータ（●）
- 再生時間の復元
- **ON / OFF 状態に応じてアイコンを動的切替（v1.4.0）**
- バッジ表示（ON / OFF）

---

## 対応ページ

- `https://www.youtube.com/watch?v=[ID]`

※ 現在は `/watch` ページのみ対象です．  
（Shorts や埋め込み動画は未対応）

---

## 再生時間の復元（v1.3.5）

- 0:00 にリセットする直前の再生時間を記憶
- ポップアップの「再生時間を復元」ボタンで復元
- 説明文に復元予定時刻を動的表示（例：`再生時間を 03:21 へ復元します`）
- 有効化 OFF の場合は復元 UI を非表示

---

## アイコン動的切替（v1.4.0）

- ON 状態：`icon_on*.png`
- OFF 状態：`icon_off*.png`
- Service Worker により storage 変更を監視し即時反映
- バッジに ON / OFF を表示

---

## 設定画面

ポップアップの設定ボタンから設定タブを開くことができます．  

### 基本設定
- 有効化（ON / OFF）
- ポップアップ表示 ON / OFF

### 詳細設定
- ポップアップ位置（左上，中央，右上）
- ポップアップ大きさ（スライダー）
- 表示時間（1～10秒）
- 背景色（テンプレカラー＋カラーピッカー）
- 文字色（テンプレカラー＋カラーピッカー）
- プレビュー機能

### 保存仕様
- 「設定を保存」ボタン押下時のみ保存
- 未保存状態は ● 表示
- 保存完了時は中央上部に通知表示

---

## ディレクトリ構成

```
YouTube-ReStart/
├── manifest.json
├── src/
│   ├── background/
│   │   └── background.js
│   ├── content/
│   │   └── content.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── options/
│   │   ├── options.html
│   │   ├── options.js
│   │   └── options.css
│   └── styles/
│       └── toast.css
└── assets/
    └── icon/
        ├── icon_on16.png
        ├── icon_on48.png
        ├── icon_on128.png
        ├── icon_off16.png
        ├── icon_off48.png
        ├── icon_off128.png
        └── setting.png
```

---

## 技術仕様

- Chrome Extensions Manifest V3
- run_at: document_start
- Service Worker（background）
- Content Script 制御
- YouTube SPA 対応
    - History API（pushState，replaceState）
    - yt-navigate-finish イベント
    - MutationObserver
- 設定保存
    - chrome.storage.local
- ポップアップから activeTab 経由でメッセージ送信
- アイコン動的変更
    - chrome.action.setIcon
    - chrome.action.setBadgeText

---

## 注意事項

- 拡張機能更新後は YouTube タブをリロードすると安定します．
- YouTube 側の仕様変更により動作しなくなる可能性があります．

---

## 変更履歴
<details>
<summary>変更履歴</summary>

- v1.0.0 初回リリース．動画を常に 0:00 から再生． 2026/02/08
- v1.1.0 トースト通知追加． 2026/02/09
- v1.2.0 ON / OFF トグル追加． 2026/02/10
- v1.2.1 OFF → ON 誤動作修正． 2026/02/10
- v1.2.2 非同期競合対策（世代管理）． 2026/02/11
- v1.3.0 設定画面追加． 2026/02/12
- v1.3.1 トースト詳細カスタマイズ追加． 2026/02/12
- v1.3.2 保存ボタン方式へ変更．未保存表示追加． 2026/02/12
- v1.3.3 storage.local へ移行． 2026/02/12
- v1.3.4 popup 初期化安定化． 2026/02/12
- v1.3.5 再生時間復元追加． 2026/02/12
- v1.4.0 動的アイコン切替機能追加．Service Worker 導入． 2026/02/13

</details>

---

## ライセンス

MIT License

---

## 作者

設計・開発：Shunsuke MOROZUMI
