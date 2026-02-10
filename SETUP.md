# Chaos Notes Setup Guide

This guide helps you set up Chaos Notes for yourself. The system is designed to be self-hosted with automatic git sync.

## Prerequisites

- **Git** — for version control
- **Bun** — JavaScript runtime ([install](https://bun.sh))
- **jq** — JSON processor (usually `apt install jq` or `brew install jq`)
- **ImageMagick** — for image processing (`apt install imagemagick` or `brew install imagemagick`)

## 1. Clone and Configure

```bash
# Clone the repo
git clone https://github.com/dooart/chaos.git
cd chaos

# Install web dependencies
cd web
bun install
cd ..
```

## 2. Set Up Your Own GitHub Repository

You'll want your own repo so notes sync to your GitHub account.

### Create a new repo on GitHub

1. Go to https://github.com/new
2. Create a **private** repository (e.g., `my-chaos` or just `chaos`)
3. Don't initialize with README (you already have files)

### Switch the remote

```bash
# Remove the original remote
git remote remove origin

# Add your new repo
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push
git push -u origin main
```

## 3. Git Authentication

The scripts auto-commit and push changes. You need git configured to push without prompts.

### Option A: Running on your local machine

If you're running Chaos on your own computer, your normal git credentials should work:

```bash
# Check if you can push
git push

# If not, configure git credentials
git config --global credential.helper store
# Then push once manually to save credentials
```

### Option B: Running on a remote server (exe.dev, VPS, etc.)

For remote servers, use a GitHub Personal Access Token (PAT):

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name like "chaos-notes-server"
4. Select scopes: `repo` (full control of private repositories)
5. Generate and copy the token

Configure the remote with the token:

```bash
# Set remote URL with token embedded
git remote set-url origin https://YOUR_GITHUB_USERNAME:YOUR_TOKEN@github.com/YOUR_USERNAME/YOUR_REPO.git

# Verify it works
git push
```

> **Security note:** The token is stored in `.git/config`. Keep your server secure.

### Option C: Using a robot account (recommended for teams)

Create a dedicated GitHub account for automation:

1. Create a new GitHub account (e.g., `yourname-bot`)
2. Add it as a collaborator to your repo
3. Generate a PAT for the bot account
4. Use the bot's credentials in the remote URL

This keeps your personal account separate from automation.

## 4. Configure Web UI Authentication

The web UI requires authentication. Create the config file:

```bash
# Create .env file
cat > web/.env << 'EOF'
AUTH_USER=your_username
AUTH_PASSWORD=your_secure_password
EOF
```

Choose a strong password — this protects your notes if the web UI is exposed.

## 5. Start the Web Server

### For development/testing

```bash
cd web
bun run server.ts
```

Access at http://localhost:24680/chaos/

### For production

Run the server as a persistent service so it survives reboots. How you do this depends on your system:

- **systemd (Linux):** Create a service unit that runs `bun run server.ts` from the `web/` directory
- **launchd (macOS):** Create a plist for the bun process
- **Docker:** Wrap in a container
- **Process manager:** Use pm2, supervisor, etc.

The key requirements:
- Working directory: `<chaos>/web`
- Command: `bun run server.ts`
- Ensure bun is in PATH

## 6. Configure Your AI Agent

Chaos Notes is designed to work with [OpenClaw](https://openclaw.ai/) — an AI agent that runs on your own hardware and can manage files, run commands, and work with your notes.

### Setting up OpenClaw

1. Install OpenClaw following the instructions at [openclaw.ai](https://openclaw.ai/)
2. Symlink the skill to OpenClaw's shared skills folder:
   ```bash
   ln -s /path/to/chaos/skills/chaos ~/.openclaw/skills/chaos
   ```

Once configured, you can ask OpenClaw things like:
- "Create a note about project ideas"
- "Search my notes for anything about AI"
- "Update my todo note with a new item"

The skill file at `skills/chaos/SKILL.md` teaches the agent how to create, edit, search, and manage your notes using the scripts.

### Other AI Assistants

The skill file format is compatible with [AgentSkills](https://skill.md). Other AI assistants that support this format can use `skills/chaos/SKILL.md`.

## 7. Configure the Skill File

Update the skill file with your paths and URLs:

```bash
# Edit the skill file
vim skills/chaos/SKILL.md

# Replace __CHAOS_HOME__ with your actual chaos directory
# Example: /home/alice/chaos

# Replace __EXTERNAL_URL__ with your server's external address (if remote)
# Example: https://myserver.com:8000
```

This lets the agent find scripts and construct permalinks correctly.

## 8. Clean Up Template Notes

Delete any example notes and create your first real note:

```bash
# List notes
ls notes/

# Delete example notes (if any)
./scripts/delete-note.sh <note-id>

# Create your first note
./scripts/new-note.sh "Welcome to My Notes"
```

## Troubleshooting

### Scripts fail with "bun not found"

Ensure bun is in your PATH:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

Add to your `.bashrc` or `.zshrc` for persistence.

### Git push fails

Check your remote URL and credentials:

```bash
git remote -v
git push -v
```

### Web server won't start

Check for missing .env:

```bash
cat web/.env
# Should have AUTH_USER and AUTH_PASSWORD
```

Check if port is in use:

```bash
lsof -i :24680
```
