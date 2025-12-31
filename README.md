# CashFlow App

A personal cash flow tracker that helps you visualize your daily balance and avoid overdrafts. Built for you and your wife to share on your phones.

## Features

- 📊 Daily balance tracking with calendar and list views
- 💰 Track recurring and one-time income
- 💳 Credit card debt tracking with payoff estimates
- 📅 Payment plan support with automatic end dates
- 📱 Mobile-friendly PWA (installable on Android)
- 👥 Multi-user support
- ☁️ Cloud sync via Supabase

---

## Quick Setup Guide (30 minutes)

### Step 1: Create a Supabase Project (5 min)

1. Go to **https://supabase.com** and click "Start your project"
2. Sign up with GitHub or email
3. Click **"New Project"**
4. Fill in:
   - **Name**: `cashflow` (or whatever you like)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
5. Click **"Create new project"**
6. Wait ~2 minutes for it to set up

### Step 2: Set Up the Database (2 min)

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New Query"**
3. Copy ALL the contents of `supabase-schema.sql` from this project
4. Paste into the editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned" - that's correct!

### Step 3: Get Your API Keys (1 min)

1. In Supabase, click **"Settings"** (gear icon) → **"API"**
2. You'll see:
   - **Project URL**: Copy this (looks like `https://abcxyz.supabase.co`)
   - **anon public key**: Copy this (long string starting with `eyJ...`)
3. Keep this tab open!

### Step 4: Create a GitHub Repository (3 min)

1. Go to **https://github.com** and sign in (or create account)
2. Click the **"+"** in the top right → **"New repository"**
3. Name it: `cashflow-app`
4. Keep it **Public** (required for free Vercel)
5. **DON'T** check "Add a README" (we have our own files)
6. Click **"Create repository"**

### Step 5: Upload the Code (5 min)

**Option A: GitHub Web Upload (Easiest)**

1. On your new repo page, click **"uploading an existing file"**
2. Drag ALL files from this `cashflow-app` folder into the browser
3. Scroll down, click **"Commit changes"**

**Option B: Using Command Line**

```bash
cd cashflow-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cashflow-app.git
git push -u origin main
```

### Step 6: Deploy to Vercel (5 min)

1. Go to **https://vercel.com**
2. Click **"Sign Up"** → **"Continue with GitHub"**
3. Once logged in, click **"Add New..."** → **"Project"**
4. Find and click **"Import"** next to your `cashflow-app` repo
5. **IMPORTANT**: Before clicking Deploy, expand **"Environment Variables"**
6. Add these two variables (copy from Supabase):

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-id.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...your-long-key-here` |

7. Click **"Deploy"**
8. Wait 2-3 minutes for the build

### Step 7: You're Live! 🎉

Vercel will give you a URL like `cashflow-app-abc123.vercel.app`

1. Open this URL on your phone
2. Create an account (just email + password)
3. **Install as App (Android)**:
   - Open in Chrome
   - Tap the menu (⋮) 
   - Tap **"Add to Home screen"** or **"Install app"**
4. Share the URL with your wife so she can do the same!

---

## Using the App

### Dashboard
- See your projected daily balance for the month
- Red/yellow warnings when balance gets low
- Toggle between calendar and list views

### Income
- Add recurring income (paychecks) with frequency
- Add one-time income (bonuses, refunds)

### Expenses  
- **Recurring**: Bills that repeat (rent, utilities, subscriptions)
- **One-time**: Single expenses
- **Payment Plans**: Fixed number of payments (furniture financing)
- **Credit Cards**: Track debt with APR and payoff estimates

### Settings
- Update your current bank balance
- Set warning thresholds
- Sign out

---

## Troubleshooting

### "Invalid API key" error
- Double-check environment variables in Vercel
- Make sure there are no extra spaces
- Redeploy after fixing

### Can't sign up
- Check your email for confirmation link from Supabase
- Check spam folder
- In Supabase → Authentication → Users to see accounts

### Data not syncing
- Check browser console for errors (F12)
- Verify database tables exist in Supabase → Table Editor

### PWA won't install
- Must be on HTTPS (Vercel provides this)
- Use Chrome on Android
- Try refreshing the page

---

## Local Development

```bash
# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local
# Edit .env.local with your Supabase keys

# Run dev server
npm run dev

# Open http://localhost:3000
```

---

## Creating App Icons

Replace the placeholder icons in `/public/`:

1. **Easy option**: Go to https://favicon.io/emoji-favicons/
   - Search for "money bag" 
   - Download and extract
   - Use the 192x192 and 512x512 versions

2. Create two square PNG files:
   - `icon-192.png` (192×192 pixels)
   - `icon-512.png` (512×512 pixels)

---

## Tech Stack

- **Next.js 14** - React framework
- **Supabase** - Database + Auth
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
- **Vercel** - Hosting

---

Built with ❤️ for tracking every dollar
