# TOTOYA Aiea — Shift Management App
## 無料で携帯から使えるようにする手順

---

## ステップ 1: Supabase（データベース）を作る — 5分

1. https://supabase.com にアクセス → **Start your project** → GitHubでサインアップ（無料）

2. **New Project** をクリック
   - Name: `totoya-aiea`
   - Password: 任意（メモしておく）
   - Region: `West US (North California)` ← Hawaii に近い

3. プロジェクトが作成されたら左メニュー → **SQL Editor** → **New Query**

4. `supabase_setup.sql` の内容を全部コピーして貼り付け → **Run**
   - テーブルとスタッフデータが自動で作成されます ✅

5. 左メニュー → **Project Settings** → **API** を開く
   - `Project URL` をコピー → メモ
   - `anon public` key をコピー → メモ

---

## ステップ 2: GitHubにコードをアップロード — 3分

1. https://github.com → **New repository**
   - Name: `totoya-aiea`
   - Public または Private どちらでもOK
   - **Create repository**

2. このフォルダの全ファイルをアップロード
   - `.env.example` を `.env` にコピーして、ステップ1でメモした値を入力:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   - ⚠️ `.env` は `.gitignore` に含まれているのでGitHubにはアップロードされません

---

## ステップ 3: Vercelにデプロイ — 3分

1. https://vercel.com → **Sign up with GitHub** （無料）

2. **New Project** → GitHubのリポジトリを選択 → **Import**

3. **Environment Variables** セクションで以下を追加:
   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | https://xxxxx.supabase.co |
   | `VITE_SUPABASE_ANON_KEY` | eyJ... |

4. **Deploy** をクリック → 1〜2分で完了

5. `https://totoya-aiea.vercel.app` のようなURLが発行されます 🎉

---

## ステップ 4: スタッフに共有

- URLをLINEやSMSで送るだけ！
- ブックマーク/ホーム画面追加でアプリのように使えます
- iPhoneの場合: Safari → 共有ボタン → 「ホーム画面に追加」

---

## ログイン情報

| 役割 | ログイン方法 |
|------|-------------|
| スタッフ | 名前を選ぶだけ（パスワード不要）|
| 管理者 | PIN: `1234` （変更推奨） |

管理者PINを変更するには `src/App.jsx` の `"1234"` を検索して変更してください。

---

## 無料枠について（Supabase + Vercel）

| サービス | 無料枠 |
|---------|--------|
| Supabase | DB 500MB、月50万リクエスト |
| Vercel | 月100GBバンド幅、無制限デプロイ |

小規模レストランの用途なら**完全無料で運用可能**です。

---

## フォルダ構成

```
totoya-aiea/
├── index.html              # エントリーポイント
├── package.json            # 依存パッケージ
├── vite.config.js          # ビルド設定
├── supabase_setup.sql      # DBセットアップSQL（Supabaseで実行）
├── .env.example            # 環境変数テンプレート
├── .gitignore
└── src/
    ├── main.jsx            # Reactエントリーポイント
    ├── App.jsx             # メインアプリ（全画面）
    └── supabase.js         # DB接続・CRUD関数
```
