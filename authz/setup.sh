#!/usr/bin/env bash
# T-19: dựng OpenFGA local qua Docker, ghi Authorization Model + tuple demo, rồi tự verify bằng
# check() thật. Chạy lại được bất cứ lúc nào (idempotent với container, không idempotent với store
# — chạy nhiều lần sẽ tạo nhiều store demo mới, không sao vì chỉ dùng cho dev/POC).
set -euo pipefail
cd "$(dirname "$0")"

FGA_BIN="${FGA_BIN:-fga}"
API_URL="${FGA_API_URL:-http://localhost:8080}"
CONTAINER_NAME="ai-dev-guardian-openfga"

if ! command -v "$FGA_BIN" >/dev/null 2>&1; then
  echo "Không tìm thấy 'fga' CLI trong PATH. Cài từ: https://github.com/openfga/cli/releases" >&2
  echo "(hoặc set FGA_BIN=/đường/dẫn/tới/fga)" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "==> Khởi động OpenFGA (Docker)..."
  docker run -d --name "$CONTAINER_NAME" \
    -p 8080:8080 -p 8081:8081 -p 3000:3000 \
    openfga/openfga run --playground-enabled
  echo "==> Chờ OpenFGA sẵn sàng..."
  until curl -sf "$API_URL/healthz" >/dev/null 2>&1; do sleep 1; done
else
  echo "==> OpenFGA container đã chạy sẵn, dùng lại."
fi

echo "==> Validate model.fga..."
"$FGA_BIN" model validate --file model.fga

echo "==> Tạo store mới..."
STORE_ID=$(curl -s -X POST "$API_URL/stores" -H "Content-Type: application/json" \
  -d '{"name": "ai-dev-guardian"}' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "    store-id: $STORE_ID"

echo "==> Ghi Authorization Model..."
"$FGA_BIN" model write --store-id "$STORE_ID" --api-url "$API_URL" --file model.fga

echo "==> Ghi tuple demo..."
"$FGA_BIN" tuple write --store-id "$STORE_ID" --api-url "$API_URL" --file tuples.demo.json

echo "==> Verify bằng check() thật..."
check() {
  local expect="$1" user="$2" relation="$3" object="$4"
  local result
  result=$("$FGA_BIN" query check --store-id "$STORE_ID" --api-url "$API_URL" "$user" "$relation" "$object" | grep -o '"allowed":[a-z]*' | cut -d: -f2)
  if [ "$result" = "$expect" ]; then
    echo "  OK   $user $relation $object -> $result"
  else
    echo "  FAIL $user $relation $object -> $result (kỳ vọng $expect)"
    exit 1
  fi
}

check true  user:admin-1       can_edit_direct policy:sso-redirect.policy.md
check false user:developer-1   can_edit_direct policy:sso-redirect.policy.md
check true  user:quang         can_edit_direct policy:sso-redirect.policy.md   # super_admin kế thừa qua org
check true  user:developer-1   can_view        audit_record:audit-1           # owner
check false user:developer-2   can_view        audit_record:audit-1           # T-09: không phải owner
check true  user:senior-dev-1  can_view        audit_record:audit-1           # team-wide view
check false user:nguoi-la      can_view        policy:sso-redirect.policy.md  # không liên quan gì

echo
echo "==> Tất cả check() đều đúng. STORE_ID=$STORE_ID"
echo "==> Playground: http://localhost:3000/playground"
