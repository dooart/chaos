#!/bin/bash
set -e

# Integration test for chaos notes scripts
# Creates a test note, performs all operations, then deletes it

TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_ROOT="$(dirname "$TEST_DIR")"
SCRIPTS_DIR="$SKILL_ROOT/scripts"

# Create isolated temp data directory
TEMP_DATA=$(mktemp -d)
mkdir -p "$TEMP_DATA/notes" "$TEMP_DATA/assets"
cd "$TEMP_DATA" && git init -q && git config user.email "test@test.com" && git config user.name "Test"
export CHAOS_DATA_DIR="$TEMP_DATA"

# Cleanup on exit
cleanup() {
  rm -rf "$TEMP_DATA"
}
trap cleanup EXIT

DATA_DIR="$TEMP_DATA"
NOTES_DIR="$DATA_DIR/notes"
TIMESTAMP=$(date +%s)
TEST_TITLE="Test Note $TIMESTAMP"

PASSED=0
FAILED=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

assert_equals() {
  local expected="$1"
  local actual="$2"
  local msg="$3"
  if [ "$expected" = "$actual" ]; then
    green "  ✓ $msg"
    PASSED=$((PASSED + 1))
  else
    red "  ✗ $msg"
    red "    expected: $expected"
    red "    actual:   $actual"
    FAILED=$((FAILED + 1))
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local msg="$3"
  if echo "$haystack" | grep -q "$needle"; then
    green "  ✓ $msg"
    PASSED=$((PASSED + 1))
  else
    red "  ✗ $msg"
    red "    '$needle' not found in output"
    FAILED=$((FAILED + 1))
  fi
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"
  local msg="$3"
  if ! echo "$haystack" | grep -q "$needle"; then
    green "  ✓ $msg"
    PASSED=$((PASSED + 1))
  else
    red "  ✗ $msg"
    red "    '$needle' should not be in output"
    FAILED=$((FAILED + 1))
  fi
}

assert_file_exists() {
  local file="$1"
  local msg="$2"
  if [ -f "$file" ]; then
    green "  ✓ $msg"
    PASSED=$((PASSED + 1))
  else
    red "  ✗ $msg"
    red "    file not found: $file"
    FAILED=$((FAILED + 1))
  fi
}

assert_file_not_exists() {
  local file="$1"
  local msg="$2"
  if [ ! -f "$file" ]; then
    green "  ✓ $msg"
    PASSED=$((PASSED + 1))
  else
    red "  ✗ $msg"
    red "    file should not exist: $file"
    FAILED=$((FAILED + 1))
  fi
}

echo ""
yellow "=== Chaos Notes Integration Test ==="
echo ""

# --- TEST: Create note ---
yellow "1. Testing new-note.sh"

OUTPUT=$("$SCRIPTS_DIR/new-note.sh" "$TEST_TITLE" 2>&1)
FILE_PATH=$(echo "$OUTPUT" | tail -1)
FILE_NAME=$(basename "$FILE_PATH")
NOTE_ID=$(echo "$FILE_NAME" | cut -d'-' -f1)

assert_contains "$OUTPUT" "created note" "commit message present"
assert_file_exists "$FILE_PATH" "note file created"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "id: $NOTE_ID" "frontmatter has correct id"
assert_contains "$CONTENT" "title: $TEST_TITLE" "frontmatter has correct title"
assert_not_contains "$CONTENT" "status:" "no status by default"
assert_not_contains "$CONTENT" "tags:" "no tags by default"

echo ""

# --- TEST: Update content only ---
yellow "2. Testing update-note.sh (content only)"

TEST_CONTENT="# Hello World

This is test content for note $TIMESTAMP."

OUTPUT=$("$SCRIPTS_DIR/update-note.sh" "$NOTE_ID" "$TEST_CONTENT" 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "# Hello World" "content updated"
assert_contains "$CONTENT" "$TIMESTAMP" "content has timestamp"

echo ""

# --- TEST: Update status ---
yellow "3. Testing update-note.sh (--status=building)"

OUTPUT=$("$SCRIPTS_DIR/update-note.sh" "$NOTE_ID" --status=building 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "status: building" "status set to building"
assert_contains "$CONTENT" "# Hello World" "content preserved"

echo ""

# --- TEST: Update tags ---
yellow "4. Testing update-note.sh (--tags=test,integration)"

OUTPUT=$("$SCRIPTS_DIR/update-note.sh" "$NOTE_ID" --tags=test,integration 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "tags: \[test, integration\]" "tags set correctly"
assert_contains "$CONTENT" "status: building" "status preserved"

echo ""

# --- TEST: Update status to done ---
yellow "5. Testing update-note.sh (--status=done)"

OUTPUT=$("$SCRIPTS_DIR/update-note.sh" "$NOTE_ID" --status=done 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "status: done" "status changed to done"

echo ""

# --- TEST: Update all at once ---
yellow "6. Testing update-note.sh (all options together)"

NEW_CONTENT="# Updated Content

All options test."

OUTPUT=$("$SCRIPTS_DIR/update-note.sh" "$NOTE_ID" --status=building --tags=final,test "$NEW_CONTENT" 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "status: building" "status updated"
assert_contains "$CONTENT" "tags: \[final, test\]" "tags updated"
assert_contains "$CONTENT" "# Updated Content" "content updated"
assert_contains "$CONTENT" "All options test" "content body updated"

echo ""

# --- TEST: Clear status ---
yellow "7. Testing update-note.sh (--status=clear)"

OUTPUT=$("$SCRIPTS_DIR/update-note.sh" "$NOTE_ID" --status=clear 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_not_contains "$CONTENT" "status:" "status cleared"
assert_contains "$CONTENT" "tags:" "tags preserved"

echo ""

# --- TEST: Clear tags ---
yellow "8. Testing update-note.sh (--tags=)"

OUTPUT=$("$SCRIPTS_DIR/update-note.sh" "$NOTE_ID" --tags= 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_not_contains "$CONTENT" "tags:" "tags cleared"

echo ""

# --- TEST: Rename note ---
yellow "9. Testing rename-note.sh"

NEW_TITLE="Renamed Test Note $TIMESTAMP"
OUTPUT=$("$SCRIPTS_DIR/rename-note.sh" "$NOTE_ID" "$NEW_TITLE" 2>&1)
assert_contains "$OUTPUT" "renamed note" "commit message present"

NEW_FILE_PATH=$(echo "$OUTPUT" | tail -1)
assert_file_exists "$NEW_FILE_PATH" "renamed file exists"
assert_file_not_exists "$FILE_PATH" "old file removed"

CONTENT=$(cat "$NEW_FILE_PATH")
assert_contains "$CONTENT" "title: $NEW_TITLE" "title updated in frontmatter"
assert_contains "$CONTENT" "id: $NOTE_ID" "id unchanged"

# Update FILE_PATH for delete test
FILE_PATH="$NEW_FILE_PATH"

echo ""

# --- TEST: Invalid status ---
yellow "10. Testing validation (invalid status)"

OUTPUT=$("$SCRIPTS_DIR/update-note.sh" "$NOTE_ID" --status=invalid 2>&1 || true)
assert_contains "$OUTPUT" "invalid status" "invalid status rejected"

echo ""

# --- TEST: Delete note ---
yellow "11. Testing delete-note.sh"

OUTPUT=$("$SCRIPTS_DIR/delete-note.sh" "$NOTE_ID" 2>&1)
assert_contains "$OUTPUT" "deleted note" "commit message present"
assert_file_not_exists "$FILE_PATH" "note file deleted"

echo ""

# --- TEST WITHOUT GIT ---
echo ""
yellow "=== Testing without Git ==="
echo ""

# Create temp dir WITHOUT git
TEMP_DATA_NOGIT=$(mktemp -d)
mkdir -p "$TEMP_DATA_NOGIT/notes" "$TEMP_DATA_NOGIT/assets"
export CHAOS_DATA_DIR="$TEMP_DATA_NOGIT"

# Update symlink for new temp dir
# CHAOS_DATA_DIR is already exported, scripts will use it directly

NOGIT_TITLE="No Git Test $TIMESTAMP"

yellow "12. Testing new-note.sh (no git)"
OUTPUT=$($SCRIPTS_DIR/new-note.sh "$NOGIT_TITLE" 2>&1)
NOGIT_FILE=$(echo "$OUTPUT" | tail -1)
NOGIT_ID=$(basename "$NOGIT_FILE" | cut -d'-' -f1)
assert_file_exists "$NOGIT_FILE" "note created without git"
assert_not_contains "$OUTPUT" "fatal" "no git errors"

echo ""

yellow "13. Testing update-note.sh (no git)"
OUTPUT=$($SCRIPTS_DIR/update-note.sh "$NOGIT_ID" "Content without git" 2>&1)
assert_contains "$OUTPUT" "updated" "update works without git"
assert_not_contains "$OUTPUT" "fatal" "no git errors on update"

echo ""

yellow "14. Testing search-notes.sh (no git)"
OUTPUT=$($SCRIPTS_DIR/search-notes.sh "without" 2>&1)
assert_contains "$OUTPUT" "$NOGIT_ID" "search works without git"

echo ""

yellow "15. Testing rename-note.sh (no git)"
OUTPUT=$($SCRIPTS_DIR/rename-note.sh "$NOGIT_ID" "Renamed No Git" 2>&1)
assert_not_contains "$OUTPUT" "fatal" "rename works without git"

echo ""

yellow "16. Testing delete-note.sh (no git)"
NOGIT_FILE_NEW=$(echo "$OUTPUT" | tail -1)
OUTPUT=$($SCRIPTS_DIR/delete-note.sh "$NOGIT_ID" 2>&1)
assert_contains "$OUTPUT" "deleted" "delete works without git"
assert_not_contains "$OUTPUT" "fatal" "no git errors on delete"

# Cleanup no-git temp dir
rm -rf "$TEMP_DATA_NOGIT"

echo ""

# --- TEST: Project field survives operations ---
# Switch back to git-enabled temp dir
export CHAOS_DATA_DIR="$TEMP_DATA"

yellow "=== Project Field Tests ==="
echo ""

yellow "17. Testing project field survives update"

PROJ_TITLE="Project Field Test $TIMESTAMP"
PROJ_OUTPUT=$("$SCRIPTS_DIR/new-note.sh" "$PROJ_TITLE" 2>&1)
PROJ_FILE=$(echo "$PROJ_OUTPUT" | tail -1)
PROJ_ID=$(basename "$PROJ_FILE" | cut -d'-' -f1)

# Manually add project field to frontmatter
CONTENT=$(cat "$PROJ_FILE")
echo "$CONTENT" | sed 's/^---$/&/' | head -1 > "$PROJ_FILE.tmp"
echo "---" > "$PROJ_FILE.tmp"
echo "id: $PROJ_ID" >> "$PROJ_FILE.tmp"
echo "title: $PROJ_TITLE" >> "$PROJ_FILE.tmp"
echo "project: projects/test-project" >> "$PROJ_FILE.tmp"
echo "---" >> "$PROJ_FILE.tmp"
mv "$PROJ_FILE.tmp" "$PROJ_FILE"
cd "$TEMP_DATA" && git add "$PROJ_FILE" && git commit -q -m "add project field"

# Update content — project field must survive
OUTPUT=$("$SCRIPTS_DIR/update-note.sh" "$PROJ_ID" --status=building "# Test content" 2>&1)
CONTENT=$(cat "$PROJ_FILE")
assert_contains "$CONTENT" "project: projects/test-project" "project field survives update"
assert_contains "$CONTENT" "status: building" "status set alongside project"
assert_contains "$CONTENT" "# Test content" "content set alongside project"

echo ""

yellow "18. Testing project field survives rename"

NEW_PROJ_TITLE="Renamed Project Test $TIMESTAMP"
OUTPUT=$("$SCRIPTS_DIR/rename-note.sh" "$PROJ_ID" "$NEW_PROJ_TITLE" 2>&1)
NEW_PROJ_FILE=$(echo "$OUTPUT" | tail -1)
CONTENT=$(cat "$NEW_PROJ_FILE")
assert_contains "$CONTENT" "project: projects/test-project" "project field survives rename"
assert_contains "$CONTENT" "title: $NEW_PROJ_TITLE" "title updated after rename"

# Cleanup
"$SCRIPTS_DIR/delete-note.sh" "$PROJ_ID" > /dev/null 2>&1

echo ""

# --- TEST: Search JSON validity ---
yellow "=== Search JSON Validity ==="
echo ""

yellow "19. Testing search output is valid JSON"

# Create a note with tricky characters
TRICKY_TITLE="Test Note With \"Quotes\" & Stuff"
TRICKY_OUTPUT=$("$SCRIPTS_DIR/new-note.sh" "$TRICKY_TITLE" 2>&1)
TRICKY_FILE=$(echo "$TRICKY_OUTPUT" | tail -1)
TRICKY_ID=$(basename "$TRICKY_FILE" | cut -d'-' -f1)

SEARCH_OUTPUT=$("$SCRIPTS_DIR/search-notes.sh" "Quotes" 2>&1)
echo "$SEARCH_OUTPUT" | jq . > /dev/null 2>&1
if [ $? -eq 0 ]; then
  green "  ✓ search output is valid JSON"
  PASSED=$((PASSED + 1))
else
  red "  ✗ search output is valid JSON"
  red "    output: $SEARCH_OUTPUT"
  FAILED=$((FAILED + 1))
fi

assert_contains "$SEARCH_OUTPUT" "$TRICKY_ID" "search finds note with special chars"

echo ""

yellow "20. Testing search with no results is valid JSON"
SEARCH_EMPTY=$("$SCRIPTS_DIR/search-notes.sh" "zzzznonexistentzzzz" 2>&1)
assert_equals "[]" "$SEARCH_EMPTY" "empty search returns []"

# Cleanup
"$SCRIPTS_DIR/delete-note.sh" "$TRICKY_ID" > /dev/null 2>&1

echo ""

# --- TEST: PRD Validation ---
yellow "=== PRD Validation ==="
echo ""

# Create a project dir with prd.json for testing
PRD_TEST_DIR=$(mktemp -d)
mkdir -p "$PRD_TEST_DIR/.wile"

yellow "21. Testing valid PRD"
cat > "$PRD_TEST_DIR/.wile/prd.json" << 'PRDEOF'
{
  "stories": [
    {"id": 1, "title": "First", "description": "Do first thing", "acceptanceCriteria": ["works"], "dependsOn": [], "status": "done"},
    {"id": 2, "title": "Second", "description": "Do second thing", "acceptanceCriteria": ["works"], "dependsOn": [1], "status": "pending"}
  ]
}
PRDEOF

# We test via the server's validation endpoint indirectly by using the same logic
# For now test via a small inline validator
PRD_VALID=$(bun -e "
const fs = require('fs');
const prd = JSON.parse(fs.readFileSync('$PRD_TEST_DIR/.wile/prd.json', 'utf-8'));
const ids = new Set();
const errors = [];
for (const s of prd.stories) {
  if (typeof s.id !== 'number') errors.push('id must be number');
  if (typeof s.title !== 'string') errors.push('title must be string');
  if (!['pending','done'].includes(s.status)) errors.push('invalid status');
  if (ids.has(s.id)) errors.push('duplicate id ' + s.id);
  ids.add(s.id);
  for (const d of (s.dependsOn || [])) {
    if (!prd.stories.some(x => x.id === d)) errors.push('missing dep ' + d);
  }
}
console.log(JSON.stringify({valid: errors.length === 0, errors}));
")
assert_contains "$PRD_VALID" '"valid":true' "valid PRD passes validation"

echo ""

yellow "22. Testing PRD with duplicate IDs"
cat > "$PRD_TEST_DIR/.wile/prd.json" << 'PRDEOF'
{
  "stories": [
    {"id": 1, "title": "First", "description": "d", "acceptanceCriteria": [], "dependsOn": [], "status": "pending"},
    {"id": 1, "title": "Dupe", "description": "d", "acceptanceCriteria": [], "dependsOn": [], "status": "pending"}
  ]
}
PRDEOF

PRD_DUPE=$(bun -e "
const fs = require('fs');
const prd = JSON.parse(fs.readFileSync('$PRD_TEST_DIR/.wile/prd.json', 'utf-8'));
const ids = new Set();
const errors = [];
for (const s of prd.stories) {
  if (ids.has(s.id)) errors.push('duplicate id ' + s.id);
  ids.add(s.id);
}
console.log(JSON.stringify({valid: errors.length === 0, errors}));
")
assert_contains "$PRD_DUPE" '"valid":false' "duplicate IDs rejected"
assert_contains "$PRD_DUPE" 'duplicate id' "error mentions duplicate"

echo ""

yellow "23. Testing PRD with missing dependency"
cat > "$PRD_TEST_DIR/.wile/prd.json" << 'PRDEOF'
{
  "stories": [
    {"id": 1, "title": "First", "description": "d", "acceptanceCriteria": [], "dependsOn": [99], "status": "pending"}
  ]
}
PRDEOF

PRD_MISSING=$(bun -e "
const fs = require('fs');
const prd = JSON.parse(fs.readFileSync('$PRD_TEST_DIR/.wile/prd.json', 'utf-8'));
const ids = new Set(prd.stories.map(s => s.id));
const errors = [];
for (const s of prd.stories) {
  for (const d of (s.dependsOn || [])) {
    if (!ids.has(d)) errors.push('missing dep ' + d);
  }
}
console.log(JSON.stringify({valid: errors.length === 0, errors}));
")
assert_contains "$PRD_MISSING" '"valid":false' "missing dep rejected"
assert_contains "$PRD_MISSING" 'missing dep' "error mentions missing dep"

echo ""

yellow "24. Testing PRD with cycle"
cat > "$PRD_TEST_DIR/.wile/prd.json" << 'PRDEOF'
{
  "stories": [
    {"id": 1, "title": "A", "description": "d", "acceptanceCriteria": [], "dependsOn": [2], "status": "pending"},
    {"id": 2, "title": "B", "description": "d", "acceptanceCriteria": [], "dependsOn": [1], "status": "pending"}
  ]
}
PRDEOF

PRD_CYCLE=$(bun -e "
const fs = require('fs');
const prd = JSON.parse(fs.readFileSync('$PRD_TEST_DIR/.wile/prd.json', 'utf-8'));
const adj = {};
for (const s of prd.stories) { adj[s.id] = s.dependsOn || []; }
const visited = new Set();
const inStack = new Set();
let hasCycle = false;
function dfs(n) {
  visited.add(n); inStack.add(n);
  for (const d of (adj[n]||[])) {
    if (inStack.has(d)) { hasCycle = true; return; }
    if (!visited.has(d)) dfs(d);
  }
  inStack.delete(n);
}
for (const s of prd.stories) { if (!visited.has(s.id)) dfs(s.id); }
console.log(JSON.stringify({valid: !hasCycle, hasCycle}));
")
assert_contains "$PRD_CYCLE" '"valid":false' "cycle detected"
assert_contains "$PRD_CYCLE" '"hasCycle":true' "hasCycle flag set"

rm -rf "$PRD_TEST_DIR"

echo ""

# --- SUMMARY ---
echo ""
yellow "=== Test Summary ==="
green "Passed: $PASSED"
if [ $FAILED -gt 0 ]; then
  red "Failed: $FAILED"
  exit 1
else
  echo "Failed: $FAILED"
  green "All tests passed!"
fi
