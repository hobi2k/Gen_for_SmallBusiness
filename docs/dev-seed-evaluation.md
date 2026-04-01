# Dev Seed Evaluation Harness

시드 기반 추천/생성 품질을 빠르게 점검하려면 Next 앱을 띄운 뒤 아래 스크립트를 실행합니다.

```bash
npm run dev
node scripts/evaluate-dev-seeds.mjs
```

기본 대상은 `http://127.0.0.1:3000` 입니다. 다른 포트를 쓰면 `--base-url`로 바꿉니다.

```bash
node scripts/evaluate-dev-seeds.mjs --base-url http://127.0.0.1:3010
```

Markdown 리포트를 파일로 남기고 싶으면 `--out`을 추가합니다.

```bash
node scripts/evaluate-dev-seeds.mjs --out ./storage/reports/dev-seed-report.md
```

리포트에는 아래 항목이 포함됩니다.

- seed별 top 3 추천 스타일
- 추천 fallback 여부
- 생성 fallback 여부
- 생성 응답 스키마 적합성 여부
- seed별 스키마 문제 목록
