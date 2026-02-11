# Chaos Notes Setup Guide

This guide helps you set up Chaos Notes. The skill can be used with any AI agent that can run shell commands (OpenClaw, Claude Code, Codex, etc.).

## Prerequisites

- **Bun** — JavaScript runtime ([install](https://bun.sh))
- **jq** — JSON processor (`apt install jq` or `brew install jq`)
- **ImageMagick** — for image processing (`apt install imagemagick` or `brew install imagemagick`)

## 1. Install the Skill

Clone the skill to your agent's skills directory:

```bash
# OpenClaw
git clone https://github.com/dooart/chaos.git ~/.openclaw/skills

# Claude Code
git clone https://github.com/dooart/chaos.git ~/.claude/skills

# Other agents
git clone https://github.com/dooart/chaos.git /path/to/skills
```

## 2. Install Web Dependencies

```bash
cd /path/to/skills/chaos/web
bun install
```

## 3. Configure Web UI Authentication

```bash
cat > /path/to/skills/chaos/web/.env << 'EOF'
AUTH_USER=your_username
AUTH_PASSWORD=your_secure_password
EOF
```

## 4. Start the Web Server

### For testing

```bash
cd /path/to/skills/chaos/web
bun run build
bun run server.ts
```

Access at http://localhost:24680/chaos/

### For production

Run the server as a persistent service. The key requirements:
- Working directory: `/path/to/skills/chaos/web`
- Command: `bun run server.ts`
- Ensure bun is in PATH

How you do this depends on your system (systemd, launchd, pm2, etc.).

## 5. First Run

The data directory (`~/.chaos`) is created automatically when you first use any script. Just ask the agent to create a note:

> "Create a note about my project ideas"

The script will:
1. Create `~/.chaos/notes` and `~/.chaos/assets` if they don't exist
2. Set up the symlink from the skill to the data directory
3. Create your note

### Custom Data Location

To store data somewhere other than `~/.chaos`, set the `CHAOS_DATA_DIR` environment variable:

```bash
export CHAOS_DATA_DIR="/path/to/your/data"
```

Add this to your `.bashrc` or `.zshrc` for persistence.

## 6. Agent Configuration

After the first note is created, the agent should ask the user two things:

1. **External URL** (if on a remote server): What URL do you use to access the web UI? This lets the agent share clickable links to notes.

2. **Git backup** (optional): Would you like to back up your notes to a private GitHub repo? If yes, help them set it up:
   ```bash
   cd ~/.chaos
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin main
   ```
   
   For remote servers, they'll need a Personal Access Token in the URL:
   ```bash
   git remote set-url origin https://USERNAME:TOKEN@github.com/USERNAME/REPO.git
   ```

Once git is set up in `~/.chaos`, all note changes are automatically committed and pushed.

## Verify Your Agent Discovers the Skill

Most agents auto-discover skills from their skills directory:

- **OpenClaw:** `~/.openclaw/skills/`
- **Claude Code:** `~/.claude/skills/` (see [docs](https://code.claude.com/docs/en/skills))
- **Other agents:** Check your agent's docs for the skills directory location

The skill follows the [AgentSkills](https://skill.md) format, which is supported by most AI coding agents.

## Troubleshooting

### Scripts fail with "bun not found"

Ensure bun is in your PATH:
```bash
export PATH="$HOME/.bun/bin:$PATH"
```

### Git push fails

Check your remote URL and credentials:
```bash
cd ~/.chaos
git remote -v
git push -v
```

### Web server won't start

Check for missing .env:
```bash
cat /path/to/skills/chaos/web/.env
# Should have AUTH_USER and AUTH_PASSWORD
```
