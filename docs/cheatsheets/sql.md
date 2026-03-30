# SQL 빠른 치트시트

## 1. SQL이 하는 일
SQL은 데이터베이스 안의 데이터를 만들고, 읽고, 수정하고, 삭제하는 언어다.

## 2. 테이블 만들기
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  status TEXT NOT NULL
);
```

## 3. 데이터 넣기
```sql
INSERT INTO projects (id, product_name, status)
VALUES ('1', '수제 딸기잼', 'running');
```

## 4. 데이터 조회
```sql
SELECT * FROM projects;
```

조건 추가:
```sql
SELECT * FROM projects WHERE status = 'completed';
```

## 5. 데이터 수정
```sql
UPDATE projects
SET status = 'failed'
WHERE id = '1';
```

## 6. 데이터 삭제
```sql
DELETE FROM projects WHERE id = '1';
```

## 7. 정렬
```sql
SELECT * FROM projects ORDER BY created_at DESC;
```

## 8. 컬럼 추가
```sql
ALTER TABLE projects ADD COLUMN request_snapshot TEXT;
```

## 9. 지금 프로젝트에서 중요하게 볼 것
- `projects` 테이블 구조
- 상태값 조회
- 최근 프로젝트 정렬
- 스키마 보정용 `ALTER TABLE`
