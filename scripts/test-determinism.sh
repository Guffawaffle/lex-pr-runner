#!/bin/bash
set -e

echo "🔍 Testing determinism of lex-pr plan command..."

# Setup
TEST_INPUTS="tests/fixtures/determinism-test/.smartergpt"
TEST_OUTPUT_BASE="/tmp/lex-pr-determinism-test"
DETERMINISTIC_TIME="2024-01-01T12:00:00.000Z"

# Clean up any existing test outputs
rm -rf "$TEST_OUTPUT_BASE"
mkdir -p "$TEST_OUTPUT_BASE"

echo "📁 Using test inputs from: $TEST_INPUTS"
echo "📁 Writing outputs to: $TEST_OUTPUT_BASE"

# Run plan command twice with identical inputs
echo "🚀 Running plan command (run 1)..."
LEX_PR_DETERMINISTIC_TIME="$DETERMINISTIC_TIME" npm run cli -- plan \
  --inputs "$TEST_INPUTS" \
  --out "$TEST_OUTPUT_BASE/run1" > /dev/null 2>&1

echo "🚀 Running plan command (run 2)..."
LEX_PR_DETERMINISTIC_TIME="$DETERMINISTIC_TIME" npm run cli -- plan \
  --inputs "$TEST_INPUTS" \
  --out "$TEST_OUTPUT_BASE/run2" > /dev/null 2>&1

# Compare outputs
echo ""
echo "🔄 Comparing outputs..."

# Check if files exist
if [[ ! -f "$TEST_OUTPUT_BASE/run1/plan.json" ]]; then
  echo "❌ Run 1 plan.json not found"
  exit 1
fi

if [[ ! -f "$TEST_OUTPUT_BASE/run1/snapshot.md" ]]; then
  echo "❌ Run 1 snapshot.md not found"
  exit 1
fi

if [[ ! -f "$TEST_OUTPUT_BASE/run2/plan.json" ]]; then
  echo "❌ Run 2 plan.json not found"
  exit 1
fi

if [[ ! -f "$TEST_OUTPUT_BASE/run2/snapshot.md" ]]; then
  echo "❌ Run 2 snapshot.md not found"
  exit 1
fi

# Compare plan.json
echo "📊 Comparing plan.json files..."
if diff "$TEST_OUTPUT_BASE/run1/plan.json" "$TEST_OUTPUT_BASE/run2/plan.json" > /dev/null; then
  echo "  ✅ plan.json files are identical"
  PLAN_HASH=$(sha256sum "$TEST_OUTPUT_BASE/run1/plan.json" | cut -d' ' -f1)
  echo "     Hash: $PLAN_HASH"
else
  echo "  ❌ plan.json files differ"
  echo "     Run 1 hash: $(sha256sum "$TEST_OUTPUT_BASE/run1/plan.json" | cut -d' ' -f1)"
  echo "     Run 2 hash: $(sha256sum "$TEST_OUTPUT_BASE/run2/plan.json" | cut -d' ' -f1)"
  exit 1
fi

# Compare snapshot.md
echo "📊 Comparing snapshot.md files..."
if diff "$TEST_OUTPUT_BASE/run1/snapshot.md" "$TEST_OUTPUT_BASE/run2/snapshot.md" > /dev/null; then
  echo "  ✅ snapshot.md files are identical"
  SNAPSHOT_HASH=$(sha256sum "$TEST_OUTPUT_BASE/run1/snapshot.md" | cut -d' ' -f1)
  echo "     Hash: $SNAPSHOT_HASH"
else
  echo "  ❌ snapshot.md files differ"
  echo "     Run 1 hash: $(sha256sum "$TEST_OUTPUT_BASE/run1/snapshot.md" | cut -d' ' -f1)"
  echo "     Run 2 hash: $(sha256sum "$TEST_OUTPUT_BASE/run2/snapshot.md" | cut -d' ' -f1)"
  exit 1
fi

echo ""
echo "🎉 SUCCESS: All artifacts are deterministic!"
echo "   Both plan.json and snapshot.md produce identical bytes across runs"

# Clean up
rm -rf "$TEST_OUTPUT_BASE"
echo "🧹 Cleaned up test outputs"