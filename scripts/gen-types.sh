#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."

mkdir -p web/src/types/generated backend/roompass/generated
touch backend/roompass/generated/__init__.py
for file in schema/*.json; do
  name=$(basename "$file" .json)
  web/node_modules/.bin/json2ts -i "$file" -o "web/src/types/generated/$name.ts"
  uv run --project backend datamodel-codegen \
    --input "$file" --input-file-type jsonschema \
    --output "backend/roompass/generated/$name.py" \
    --output-model-type pydantic_v2.BaseModel \
    --target-python-version 3.13 --disable-timestamp --formatters builtin
done
