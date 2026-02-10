# Chaos Notes Setup Guide

This guide helps you set up Chaos Notes. The skill is designed to be installed in OpenClaw's skills folder, with your notes data stored separately.

## Prerequisites

- **OpenClaw** — installed and running ([openclaw.ai](https://openclaw.ai/))
- **Bun** — JavaScript runtime ([install](https://bun.sh))
- **jq** — JSON processor (`apt install jq` or `brew install jq`)
- **ImageMagick** — for image processing (`apt install imagemagick` or `brew install imagemagick`)

## 1. Install the Skill

Clone the skill into OpenClaw's skills folder:

```bash
cd ~/.openclaw/skills
git clone https://github.com/dooart/chaos.git
```

## 2. Create Your Data Directory

Create a directory for your notes (can be anywhere):

```bash
mkdir -p ~/chaos/notes ~/chaos/assets
```

## 3. Link Data to Skill

Create a symlink from the skill to your data:

```bash
ln -s ~/chaos ~/.openclaw/skills/chaos/data
```

## 4. (Optional) Set Up Git Backup

If you want your notes backed up to GitHub:

### Create a private repo

1. Go to https://github.com/new
2. Create a **private** repository (e.g., `my-notes`)
3. Don't initialize with README

### Initialize and push

```bash
cd ~/chaos
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Git authentication

For the scripts to auto-push, git needs to work without prompts:

**Local machine:** Your normal git credentials should work.

**Remote server:** Use a Personal Access Token (PAT):
1. Go to https://github.com/settings/tokens
2. Generate a token with `repo` scope
3. Set the remote URL with the token:
   ```bash
   git remote set-url origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/YOUR_USERNAME/YOUR_REPO.git
   ```

## 5. Install Web Dependencies

```bash
cd ~/.openclaw/skills/chaos/web
bun install
```

## 6. Configure Web UI Authentication

```bash
cat > ~/.openclaw/skills/chaos/web/.env << 'EOF'
AUTH_USER=your_username
AUTH_PASSWORD=your_secure_password
EOF
```

## 7. Start the Web Server

### For testing

```bash
cd ~/.openclaw/skills/chaos/web
bun run server.ts
```

Access at http://localhost:24680/chaos/

### For production

Run the server as a persistent service. The key requirements:
- Working directory: `~/.openclaw/skills/chaos/web`
- Command: `bun run server.ts`
- Ensure bun is in PATH

How you do this depends on your system (systemd, launchd, pm2, etc.).

## 8. (Optional) Set External URL

If running on a remote server and you want the agent to share clickable links:

```bash
echo 'export CHAOS_EXTERNAL_URL="https://your-server.com:8000"' >> ~/.bashrc
source ~/.bashrc
```

## Verify Setup

Test that everything works:

```bash
# Check data directory
ls ~/.openclaw/skills/chaos/data/notes/

# Create a test note
~/.openclaw/skills/chaos/scripts/new-note.sh "Test Note"

# Search for it
~/.openclaw/skills/chaos/scripts/search-notes.sh "test"
```

## Troubleshooting

### Scripts fail with "data/notes directory not found"

The data symlink isn't set up. Create it:
```bash
ln -s /path/to/your/data ~/.openclaw/skills/chaos/data
```

### Scripts fail with "bun not found"

Ensure bun is in your PATH:
```bash
export PATH="$HOME/.bun/bin:$PATH"
```

### Git push fails

Check your remote URL and credentials:
```bash
cd ~/chaos  # or wherever your data is
git remote -v
git push -v
```
