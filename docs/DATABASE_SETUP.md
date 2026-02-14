# 💾 Database Setup - Same Database Everywhere

This guide shows you how to connect both your **local machine** and **Render deployment** to the **same external PostgreSQL database**.

## 🎯 Goal: One Database, All Environments

Your local machine and Render will both connect to the same Render PostgreSQL database using the **External Database URL**.

## 📋 Step-by-Step Setup

### Step 1: Get Your External Database URL from Render

1. Go to [render.com](https://render.com) and log in
2. Click on your **PostgreSQL database** (or create one if you haven't)
3. Scroll down to find **"Connections"** section
4. Copy the **External Database URL** (it looks like this):
   ```
   postgresql://piboom_user:XXXXXXXXXXXX@dpg-xxxxx.oregon-postgres.render.com:5432/piboom
   ```

### Step 2: Create Local `.env` File

Create a file named `.env` in your project root (`c:\projects\piBoom\.env`):

```bash
# Pi BOOM Environment Configuration

# ===== DATABASE (REQUIRED for album collection) =====
# Paste your Render External Database URL here:
DATABASE_URL=postgresql://piboom_user:XXXXXXXXXXXX@dpg-xxxxx.oregon-postgres.render.com:5432/piboom

# ===== OPENAI API (for ChatGPT features) =====
OPENAI_API_KEY=your_openai_api_key_here

# ===== GOOGLE CLOUD (for maps, knowledge graph) =====
GOOGLE_CLOUD_PROJECT_ID=your_google_project_id

# ===== SPOTIFY (optional) =====
# SPOTIFY_CLIENT_ID=your_spotify_client_id
# SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
# SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback

# ===== MODE (auto-detected, but you can override) =====
# MODE=pi
# PORT=3000
```

### Step 3: Configure Render to Use the Same Database

Update your `render.yaml` to connect to the database:

```yaml
services:
  - type: web
    name: pi-boom
    env: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    plan: starter
    region: oregon
    branch: main
    buildCommand: ""
    startCommand: ""
    envVars:
      - key: NODE_ENV
        value: production
      - key: MODE
        value: cloud
      - key: PORT
        value: 3000
      - key: DATABASE_URL
        fromDatabase:
          name: pi-boom-db
          property: connectionString
    healthCheckPath: /health
    autoDeploy: true

  - type: pserv
    name: pi-boom-db
    env: docker
    plan: starter
    region: oregon
    databaseName: piboom
    databaseUser: piboom
```

**OR** if you already created the database separately:

Just add the environment variable in Render dashboard:
- Key: `DATABASE_URL`
- Value: (Use the internal URL from Render - it's automatic)

### Step 4: Test Local Connection

```bash
# Start your app locally
npm start

# Or for Pi mode
npm run pi
```

You should see:
```
✅ Database connection pool initialized
✅ Database tables created successfully
```

### Step 5: Deploy to Render

```bash
# Commit your changes
git add .
git commit -m "Add database configuration"
git push origin main
```

Render will automatically deploy and connect to the database!

## ✅ What You Get

### Same Data Everywhere
- Add albums on your local machine → See them on Render
- Add albums on Render → See them on your local machine
- One source of truth for your vinyl collection

### Automatic Table Creation
- First time the app starts (local or cloud), it creates the `records` table
- Safe to run multiple times - uses `CREATE TABLE IF NOT EXISTS`

### Secure Connection
- Local: Connects via external URL (SSL enabled)
- Render: Connects via internal URL (faster, more secure)
- Both use PostgreSQL's built-in encryption

## 🔍 Verify It's Working

### Check Local Connection
```bash
# Start your app
npm start

# You should see these logs:
# ✅ Database connection pool initialized
# ✅ Database tables created successfully
```

### Check Render Logs
1. Go to your Render web service
2. Click "Logs" tab
3. Look for the same success messages:
   ```
   ✅ Database connection pool initialized
   ✅ Database tables created successfully
   ```

## 🎵 What's Stored in the Database

The `records` table stores your vinyl/album collection:
- Artist name
- Album name
- Year, genre, label
- Personal notes
- Album cover URL
- Spotify ID (for integration)
- Added/updated timestamps

## 💡 Pro Tips

### Security
- **NEVER** commit your `.env` file to Git (it's already in `.gitignore`)
- Keep your database credentials secure
- Render automatically uses SSL for external connections

### Performance
- Render's **internal URL** is faster for cloud deployment (automatic)
- Your local machine uses the **external URL** (what you copied)
- Both work perfectly!

### Troubleshooting

**Error: "connection refused"**
- Check your External Database URL is correct
- Make sure the database is running in Render dashboard

**Error: "ETIMEDOUT" or "connect ETIMEDOUT"**
- The connection to the database host timed out (often due to firewall or network)
- **Firewall**: Ensure outbound port 5432 is allowed from your network
- **Cloud SQL (GCP)**: Add your IP to "Authorized networks" in the Cloud SQL instance, or use the [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/connect-auth-proxy)
- **Render external DB**: Render's external URL should work from most networks; try from a different network (e.g. mobile hotspot) to rule out corporate firewall
- **Wrong host**: If using a proxy or tunnel, verify the host/port in `DATABASE_URL`

**Error: "SSL required"**
- This is normal - the app automatically enables SSL for production

**Warning: "No DATABASE_URL found"**
- This is okay! The app works without a database
- Database features will just be disabled

## 🚀 Next Steps

1. Copy your Render External Database URL
2. Create `.env` file with the URL
3. Run `npm start` locally
4. Test adding some albums
5. Deploy to Render: `git push`
6. See the same albums in both places!

---

**Now your local machine and Render share the same database! 🎉**

