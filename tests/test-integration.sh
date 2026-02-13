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
  rm -rf "$TEMP_DATA" "$TEMP_DATA_NOGIT" "$PRD_TEST_DIR" 2>/dev/null
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

CHAOS="bun $SCRIPTS_DIR/chaos.ts"

echo ""
yellow "=== Chaos Notes Integration Test ==="
echo ""

# --- TEST: Create note ---
yellow "1. Testing new"

FILE_PATH=$($CHAOS new "$TEST_TITLE" 2>&1)
FILE_NAME=$(basename "$FILE_PATH")
NOTE_ID=$(echo "$FILE_NAME" | cut -d'-' -f1)

assert_file_exists "$FILE_PATH" "note file created"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "id: $NOTE_ID" "frontmatter has correct id"
assert_contains "$CONTENT" "title: $TEST_TITLE" "frontmatter has correct title"
assert_not_contains "$CONTENT" "status:" "no status by default"
assert_not_contains "$CONTENT" "tags:" "no tags by default"

# Verify git commit happened
GIT_LOG=$(cd "$TEMP_DATA" && git log --oneline -1)
assert_contains "$GIT_LOG" "created note" "git commit for create"

echo ""

# --- TEST: Update content only ---
yellow "2. Testing update (content only)"

TEST_CONTENT="# Hello World

This is test content for note $TIMESTAMP."

OUTPUT=$($CHAOS update "$NOTE_ID" "$TEST_CONTENT" 2>&1)
assert_contains "$OUTPUT" "updated" "update output"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "# Hello World" "content updated"
assert_contains "$CONTENT" "$TIMESTAMP" "content has timestamp"

echo ""

# --- TEST: Update status ---
yellow "3. Testing update (--status=building)"

OUTPUT=$($CHAOS update "$NOTE_ID" --status=building 2>&1)
CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "status: building" "status set to building"
assert_contains "$CONTENT" "# Hello World" "content preserved"

echo ""

# --- TEST: Update tags ---
yellow "4. Testing update (--tags=test,integration)"

OUTPUT=$($CHAOS update "$NOTE_ID" --tags=test,integration 2>&1)
CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "tags:" "tags section present"
assert_contains "$CONTENT" "test" "tag 'test' present"
assert_contains "$CONTENT" "integration" "tag 'integration' present"
assert_contains "$CONTENT" "status: building" "status preserved"

echo ""

# --- TEST: Update status to done ---
yellow "5. Testing update (--status=done)"

OUTPUT=$($CHAOS update "$NOTE_ID" --status=done 2>&1)
CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "status: done" "status changed to done"

echo ""

# --- TEST: Update all at once ---
yellow "6. Testing update (all options together)"

NEW_CONTENT="# Updated Content

All options test."

OUTPUT=$($CHAOS update "$NOTE_ID" --status=building --tags=final,test "$NEW_CONTENT" 2>&1)
CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "status: building" "status updated"
assert_contains "$CONTENT" "final" "tag 'final' present"
assert_contains "$CONTENT" "# Updated Content" "content updated"
assert_contains "$CONTENT" "All options test" "content body updated"

echo ""

# --- TEST: Clear status ---
yellow "7. Testing update (--status=clear)"

OUTPUT=$($CHAOS update "$NOTE_ID" --status=clear 2>&1)
CONTENT=$(cat "$FILE_PATH")
assert_not_contains "$CONTENT" "status:" "status cleared"
assert_contains "$CONTENT" "tags:" "tags preserved"

echo ""

# --- TEST: Clear tags ---
yellow "8. Testing update (--tags=)"

OUTPUT=$($CHAOS update "$NOTE_ID" --tags= 2>&1)
CONTENT=$(cat "$FILE_PATH")
assert_not_contains "$CONTENT" "tags:" "tags cleared"

echo ""

# --- TEST: Rename note ---
yellow "9. Testing rename"

NEW_TITLE="Renamed Test Note $TIMESTAMP"
NEW_FILE_PATH=$($CHAOS rename "$NOTE_ID" "$NEW_TITLE" 2>&1)
assert_file_exists "$NEW_FILE_PATH" "renamed file exists"
assert_file_not_exists "$FILE_PATH" "old file removed"

CONTENT=$(cat "$NEW_FILE_PATH")
assert_contains "$CONTENT" "title: $NEW_TITLE" "title updated in frontmatter"
assert_contains "$CONTENT" "id: $NOTE_ID" "id unchanged"

FILE_PATH="$NEW_FILE_PATH"

echo ""

# --- TEST: Invalid status ---
yellow "10. Testing validation (invalid status)"

OUTPUT=$($CHAOS update "$NOTE_ID" --status=invalid 2>&1 || true)
assert_contains "$OUTPUT" "invalid status" "invalid status rejected"

echo ""

# --- TEST: Delete note ---
yellow "11. Testing delete"

OUTPUT=$($CHAOS delete "$NOTE_ID" 2>&1)
assert_contains "$OUTPUT" "deleted" "delete output"
assert_file_not_exists "$FILE_PATH" "note file deleted"

echo ""

# --- TEST WITHOUT GIT ---
echo ""
yellow "=== Testing without Git ==="
echo ""

TEMP_DATA_NOGIT=$(mktemp -d)
mkdir -p "$TEMP_DATA_NOGIT/notes" "$TEMP_DATA_NOGIT/assets"
export CHAOS_DATA_DIR="$TEMP_DATA_NOGIT"

NOGIT_TITLE="No Git Test $TIMESTAMP"

yellow "12. Testing new (no git)"
NOGIT_FILE=$($CHAOS new "$NOGIT_TITLE" 2>&1)
NOGIT_ID=$(basename "$NOGIT_FILE" | cut -d'-' -f1)
assert_file_exists "$NOGIT_FILE" "note created without git"
assert_not_contains "$NOGIT_FILE" "fatal" "no git errors"

echo ""

yellow "13. Testing update (no git)"
OUTPUT=$($CHAOS update "$NOGIT_ID" "Content without git" 2>&1)
assert_contains "$OUTPUT" "updated" "update works without git"
assert_not_contains "$OUTPUT" "fatal" "no git errors on update"

echo ""

yellow "14. Testing search (no git)"
OUTPUT=$($CHAOS search "without" 2>&1)
assert_contains "$OUTPUT" "$NOGIT_ID" "search works without git"

echo ""

yellow "15. Testing rename (no git)"
OUTPUT=$($CHAOS rename "$NOGIT_ID" "Renamed No Git" 2>&1)
assert_not_contains "$OUTPUT" "fatal" "rename works without git"

echo ""

yellow "16. Testing delete (no git)"
OUTPUT=$($CHAOS delete "$NOGIT_ID" 2>&1)
assert_contains "$OUTPUT" "deleted" "delete works without git"
assert_not_contains "$OUTPUT" "fatal" "no git errors on delete"

rm -rf "$TEMP_DATA_NOGIT"

echo ""

# --- TEST: Project field survives operations ---
export CHAOS_DATA_DIR="$TEMP_DATA"

yellow "=== Project Field Tests ==="
echo ""

yellow "17. Testing project field survives update"

PROJ_TITLE="Project Field Test $TIMESTAMP"
PROJ_FILE=$($CHAOS new "$PROJ_TITLE" 2>&1)
PROJ_ID=$(basename "$PROJ_FILE" | cut -d'-' -f1)

# Manually add project field to frontmatter
CONTENT=$(cat "$PROJ_FILE")
echo "---" > "$PROJ_FILE.tmp"
echo "id: $PROJ_ID" >> "$PROJ_FILE.tmp"
echo "title: $PROJ_TITLE" >> "$PROJ_FILE.tmp"
echo "project: projects/test-project" >> "$PROJ_FILE.tmp"
echo "---" >> "$PROJ_FILE.tmp"
mv "$PROJ_FILE.tmp" "$PROJ_FILE"
cd "$TEMP_DATA" && git add "$PROJ_FILE" && git commit -q -m "add project field"

# Update content — project field must survive
OUTPUT=$($CHAOS update "$PROJ_ID" --status=building "# Test content" 2>&1)
CONTENT=$(cat "$PROJ_FILE")
assert_contains "$CONTENT" "project: projects/test-project" "project field survives update"
assert_contains "$CONTENT" "status: building" "status set alongside project"
assert_contains "$CONTENT" "# Test content" "content set alongside project"

echo ""

yellow "18. Testing project field survives rename"

NEW_PROJ_TITLE="Renamed Project Test $TIMESTAMP"
NEW_PROJ_FILE=$($CHAOS rename "$PROJ_ID" "$NEW_PROJ_TITLE" 2>&1)
CONTENT=$(cat "$NEW_PROJ_FILE")
assert_contains "$CONTENT" "project: projects/test-project" "project field survives rename"
assert_contains "$CONTENT" "title: $NEW_PROJ_TITLE" "title updated after rename"

$CHAOS delete "$PROJ_ID" > /dev/null 2>&1

echo ""

# --- TEST: Search JSON validity ---
yellow "=== Search JSON Validity ==="
echo ""

yellow "19. Testing search output is valid JSON"

TRICKY_TITLE='Test Note With "Quotes" & Stuff'
TRICKY_FILE=$($CHAOS new "$TRICKY_TITLE" 2>&1)
TRICKY_ID=$(basename "$TRICKY_FILE" | cut -d'-' -f1)

SEARCH_OUTPUT=$($CHAOS search "Quotes" 2>&1)
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
SEARCH_EMPTY=$($CHAOS search "zzzznonexistentzzzz" 2>&1)
assert_equals "[]" "$SEARCH_EMPTY" "empty search returns []"

$CHAOS delete "$TRICKY_ID" > /dev/null 2>&1

echo ""

# --- TEST: PRD Validation ---
yellow "=== PRD Validation ==="
echo ""

PRD_TEST_DIR=$(mktemp -d)

yellow "21. Testing valid PRD"
cat > "$PRD_TEST_DIR/prd.json" << 'PRDEOF'
{
  "stories": [
    {"id": 1, "title": "First", "description": "Do first thing", "acceptanceCriteria": ["works"], "dependsOn": [], "status": "done"},
    {"id": 2, "title": "Second", "description": "Do second thing", "acceptanceCriteria": ["works"], "dependsOn": [1], "status": "pending"}
  ]
}
PRDEOF

PRD_RESULT=$($CHAOS validate-prd "$PRD_TEST_DIR/prd.json" 2>&1)
assert_contains "$PRD_RESULT" '"valid": true' "valid PRD passes validation"

echo ""

yellow "22. Testing PRD with duplicate IDs"
cat > "$PRD_TEST_DIR/prd.json" << 'PRDEOF'
{
  "stories": [
    {"id": 1, "title": "First", "description": "d", "acceptanceCriteria": [], "dependsOn": [], "status": "pending"},
    {"id": 1, "title": "Dupe", "description": "d", "acceptanceCriteria": [], "dependsOn": [], "status": "pending"}
  ]
}
PRDEOF

PRD_RESULT=$($CHAOS validate-prd "$PRD_TEST_DIR/prd.json" 2>&1 || true)
assert_contains "$PRD_RESULT" '"valid": false' "duplicate IDs rejected"
assert_contains "$PRD_RESULT" 'duplicate id' "error mentions duplicate"

echo ""

yellow "23. Testing PRD with missing dependency"
cat > "$PRD_TEST_DIR/prd.json" << 'PRDEOF'
{
  "stories": [
    {"id": 1, "title": "First", "description": "d", "acceptanceCriteria": [], "dependsOn": [99], "status": "pending"}
  ]
}
PRDEOF

PRD_RESULT=$($CHAOS validate-prd "$PRD_TEST_DIR/prd.json" 2>&1 || true)
assert_contains "$PRD_RESULT" '"valid": false' "missing dep rejected"
assert_contains "$PRD_RESULT" 'non-existent' "error mentions missing dep"

echo ""

yellow "24. Testing PRD with cycle"
cat > "$PRD_TEST_DIR/prd.json" << 'PRDEOF'
{
  "stories": [
    {"id": 1, "title": "A", "description": "d", "acceptanceCriteria": [], "dependsOn": [2], "status": "pending"},
    {"id": 2, "title": "B", "description": "d", "acceptanceCriteria": [], "dependsOn": [1], "status": "pending"}
  ]
}
PRDEOF

PRD_RESULT=$($CHAOS validate-prd "$PRD_TEST_DIR/prd.json" 2>&1 || true)
assert_contains "$PRD_RESULT" '"valid": false' "cycle detected"
assert_contains "$PRD_RESULT" 'cycle' "error mentions cycle"

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
