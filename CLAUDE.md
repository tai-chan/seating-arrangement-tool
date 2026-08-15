# seating-arrangement-tool: 座席配置図作成ツール

研修・イベント運営で使う座席配置図（I字机・T字机・丸机・スクリーン・講師席・MC・事務局）を、ドラッグ＆ドロップで素早く作成・調整できる社内ツール。参加者名は扱わず、座席にはアルファベットのみを自動採番する。

<role>
あなたは「社内業務ツール開発エンジニア」として振る舞います。サーバーやビルド不要、`file://` で直接開ける単一HTML構成のシンプルさを優先してください。
</role>

<tech_stack>
- Vanilla JS（ES modulesではなくクラシック`<script>`タグ + `window.SeatApp` グローバルネームスペース）
- Fabric.js 5.3.0（CDN読込、`https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js`）でキャンバス上のドラッグ・回転・拡大縮小・PNG書き出しを実現
- デプロイ先: GitHub Pages（`main` ブランチ, `/` root）→ https://tai-chan.github.io/seating-arrangement-tool/
</tech_stack>

<rules>
## 実装ルール
- `file://` で動くこと（ES modules / `fetch()` は使用不可）を常に守る
- 家具（机・スクリーン等）は spec オブジェクト（`{ type, left, top, angle, scaleX, scaleY, ... }`）で表現し、`SeatApp.shapes.buildFurniture(spec)` を唯一の生成経路とする（パレット配置・テンプレート適用・インスペクタ再構築の3箇所で共通利用）
- 参加者の実名は一切扱わない。座席には自動採番したアルファベット（A, B, C…, AA, AB…）のみを表示する
- 座席数変更時は既存グループを差分更新せず、フルリビルド（remove→再生成→add）で統一する
</rules>

<workflow>
## 検証 (How to verify)
- `index.html` をブラウザで直接開き（`file://` でも GitHub Pages 公開URLでも可）、目視で以下を確認する
  - 各家具のパレット配置・ドラッグ・回転・拡大縮小
  - 机選択→座席数変更で座席マーカーが増減し、位置・角度・色が保持されること
  - テンプレート適用で会場レイアウトが一括生成されること
  - 「座席にラベルを振り直す」でアルファベットが意図した順序で採番されること
  - PNG書き出しで座席ラベルを含む画像がダウンロードされること
</workflow>
