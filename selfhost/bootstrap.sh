#!/usr/bin/env bash
# Self-hosting fixpoint proof for the DensePy compiler.
# stage0: JS compiler builds gen1.py from selfhost/src/compiler.gpy
# stage1: gen1 compiles the corpus; differential vs JS compiler passes
# stage2: gen1 compiles itself -> gen2; gen2's corpus compilations are
#         byte-identical to gen1's, and the differential passes with gen2.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== stage0: JS compiler builds gen1.py =="
node bin/gpy.mjs build selfhost/src/compiler.gpy -o selfhost/gen1.py
python3 -c "import ast;ast.parse(open('selfhost/gen1.py',encoding='utf-8').read())"
echo "gen1.py built and parses"

echo "== stage1: differential (JS compiler vs gen1) =="
SELF_COMPILER=selfhost/gen1.py node selfhost/differential.mjs

echo "== stage2: gen1 compiles itself -> gen2 =="
python3 selfhost/gen1.py selfhost/src/compiler.gpy > selfhost/gen2.py
python3 -c "import ast;ast.parse(open('selfhost/gen2.py',encoding='utf-8').read())"
if cmp -s selfhost/gen1.py selfhost/gen2.py; then
  echo "gen1 == gen2 (byte-identical self-compilation fixpoint)"
else
  echo "gen1 != gen2 (bytes differ; still comparing corpus compilations)"
fi

rm -rf selfhost/.stage2
mkdir -p selfhost/.stage2/gen1 selfhost/.stage2/gen2
while IFS= read -r f; do
  out="${f#selfhost/corpus/}"
  out="${out//\//__}.py"
  python3 selfhost/gen1.py "$f" > "selfhost/.stage2/gen1/$out"
  python3 selfhost/gen2.py "$f" > "selfhost/.stage2/gen2/$out"
done < <(find selfhost/corpus -name '*.gpy' | sort)
diff -r selfhost/.stage2/gen1 selfhost/.stage2/gen2
echo "stage2: gen2 corpus compilations are byte-identical to gen1's"

echo "== stage2: differential (JS compiler vs gen2) =="
SELF_COMPILER=selfhost/gen2.py node selfhost/differential.mjs

echo "BOOTSTRAP OK"
