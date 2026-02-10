#!/bin/bash
set -e

# Integration test for chaos notes scripts
# Creates a test note, performs all operations, then deletes it

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NOTES_DIR="$(dirname "$SCRIPT_DIR")/notes"
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

OUTPUT=$("$SCRIPT_DIR/new-note.sh" "$TEST_TITLE" 2>&1)
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

OUTPUT=$("$SCRIPT_DIR/update-note.sh" "$NOTE_ID" "$TEST_CONTENT" 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "# Hello World" "content updated"
assert_contains "$CONTENT" "$TIMESTAMP" "content has timestamp"

echo ""

# --- TEST: Update status ---
yellow "3. Testing update-note.sh (--status=building)"

OUTPUT=$("$SCRIPT_DIR/update-note.sh" "$NOTE_ID" --status=building 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "status: building" "status set to building"
assert_contains "$CONTENT" "# Hello World" "content preserved"

echo ""

# --- TEST: Update tags ---
yellow "4. Testing update-note.sh (--tags=test,integration)"

OUTPUT=$("$SCRIPT_DIR/update-note.sh" "$NOTE_ID" --tags=test,integration 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "tags: \[test, integration\]" "tags set correctly"
assert_contains "$CONTENT" "status: building" "status preserved"

echo ""

# --- TEST: Update status to done ---
yellow "5. Testing update-note.sh (--status=done)"

OUTPUT=$("$SCRIPT_DIR/update-note.sh" "$NOTE_ID" --status=done 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "status: done" "status changed to done"

echo ""

# --- TEST: Update all at once ---
yellow "6. Testing update-note.sh (all options together)"

NEW_CONTENT="# Updated Content

All options test."

OUTPUT=$("$SCRIPT_DIR/update-note.sh" "$NOTE_ID" --status=building --tags=final,test "$NEW_CONTENT" 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_contains "$CONTENT" "status: building" "status updated"
assert_contains "$CONTENT" "tags: \[final, test\]" "tags updated"
assert_contains "$CONTENT" "# Updated Content" "content updated"
assert_contains "$CONTENT" "All options test" "content body updated"

echo ""

# --- TEST: Clear status ---
yellow "7. Testing update-note.sh (--status=clear)"

OUTPUT=$("$SCRIPT_DIR/update-note.sh" "$NOTE_ID" --status=clear 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_not_contains "$CONTENT" "status:" "status cleared"
assert_contains "$CONTENT" "tags:" "tags preserved"

echo ""

# --- TEST: Clear tags ---
yellow "8. Testing update-note.sh (--tags=)"

OUTPUT=$("$SCRIPT_DIR/update-note.sh" "$NOTE_ID" --tags= 2>&1)
assert_contains "$OUTPUT" "updated note" "commit message present"

CONTENT=$(cat "$FILE_PATH")
assert_not_contains "$CONTENT" "tags:" "tags cleared"

echo ""

# --- TEST: Rename note ---
yellow "9. Testing rename-note.sh"

NEW_TITLE="Renamed Test Note $TIMESTAMP"
OUTPUT=$("$SCRIPT_DIR/rename-note.sh" "$NOTE_ID" "$NEW_TITLE" 2>&1)
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

OUTPUT=$("$SCRIPT_DIR/update-note.sh" "$NOTE_ID" --status=invalid 2>&1 || true)
assert_contains "$OUTPUT" "invalid status" "invalid status rejected"

echo ""

# --- TEST: Delete note ---
yellow "11. Testing delete-note.sh"

OUTPUT=$("$SCRIPT_DIR/delete-note.sh" "$NOTE_ID" 2>&1)
assert_contains "$OUTPUT" "deleted note" "commit message present"
assert_file_not_exists "$FILE_PATH" "note file deleted"

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
