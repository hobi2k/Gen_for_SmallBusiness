# React + TSX 실무 빠른 기초

## 1. React와 TSX를 같이 보는 이유
- `React`는 화면을 컴포넌트 단위로 만드는 라이브러리다.
- `TSX`는 TypeScript 안에서 JSX 문법을 쓰는 형식이다.

실무에서는 둘이 항상 같이 움직인다.
이 문서는 “React 코드 읽는 법” 중심으로 보면 된다.

## 2. 컴포넌트가 가장 기본이다
```tsx
export function TitleCard() {
  return <h1>장사한컷</h1>;
}
```

이건 함수형 컴포넌트다.
React는 화면을 이런 함수들로 쪼개서 만든다.

읽는 순서:
1. 함수 이름
2. props를 받는지
3. state를 쓰는지
4. return 안에서 어떤 UI를 그리는지

## 3. props 읽기
```tsx
interface SectionCardProps {
  title: string;
  description: string;
}

export function SectionCard({title, description}: SectionCardProps) {
  return (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
```

`props`는 부모가 자식 컴포넌트에 넘겨주는 값이다.
실무에서 컴포넌트 읽을 때 제일 먼저 보는 곳이다.

체크 포인트:
- 어떤 값을 외부에서 받는가
- 어떤 값이 필수인가
- 어떤 값이 선택인가

## 4. JSX / TSX 기본 문법
```tsx
return (
  <section>
    <h1>제목</h1>
    <p>설명</p>
  </section>
);
```

중요한 규칙:
- 하나의 루트 요소로 감싸야 한다.
- JavaScript 값은 `{}` 안에 넣는다.
- HTML처럼 보이지만 실제로는 JavaScript 표현식이다.

예:
```tsx
const title = '장사한컷';
return <h1>{title}</h1>;
```

## 5. 상태 useState
```tsx
import {useState} from 'react';

export function Example() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

읽는 법:
- `count`: 현재 값
- `setCount`: 값을 바꾸는 함수

실무에서 자주 쓰는 상태:
- 로딩 여부
- 에러 메시지
- 폼 입력값
- 모달 열림/닫힘
- 현재 선택된 탭

## 6. 이벤트 처리
```tsx
function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
}
```

자주 보는 이벤트:
- `onClick`
- `onChange`
- `onSubmit`

예:
```tsx
<button onClick={handleClick}>버튼</button>
<form onSubmit={handleSubmit}>...</form>
<input onChange={handleChange} />
```

읽을 때 중요한 것:
- 이벤트가 어디서 발생하는지
- 상태를 어떤 함수로 바꾸는지
- API 호출이 있는지

## 7. 조건부 렌더링
```tsx
{message ? <p>{message}</p> : null}
```

뜻:
- `message`가 있으면 `<p>`를 보여주고
- 없으면 아무 것도 안 보여준다

자주 보는 패턴:
```tsx
{isLoading && <p>로딩 중...</p>}
```

```tsx
{items.length > 0 ? <List /> : <EmptyState />}
```

## 8. 리스트 렌더링
```tsx
{items.map((item) => (
  <div key={item.id}>{item.title}</div>
))}
```

여기서 중요한 건 `key`다.
- React가 리스트 항목을 구분할 때 쓴다.
- 보통 `id` 같은 고유값을 넣는다.

## 9. 폼 처리
이 프로젝트에서는 폼이 핵심이기 때문에 꼭 읽혀야 한다.

```tsx
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const payload = {
    product_name: String(formData.get('product_name') ?? ''),
    tone: String(formData.get('tone') ?? '깔끔한 판매형'),
  };
}
```

읽는 포인트:
- `event.preventDefault()`로 새로고침 막기
- `FormData`로 폼 값 꺼내기
- payload 객체로 API에 맞는 형태 만들기

## 10. 비동기 처리
```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

async function handleSubmit() {
  setIsSubmitting(true);
  try {
    const response = await fetch('/projects', {method: 'POST'});
  } finally {
    setIsSubmitting(false);
  }
}
```

실무에서 자주 보는 흐름:
1. 로딩 시작
2. API 요청
3. 성공 시 상태 갱신
4. 실패 시 에러 메시지
5. 마지막에 로딩 종료

## 11. use client
```tsx
'use client';
```

Next.js App Router에서 중요하다.
이게 필요한 경우:
- `useState`
- `useEffect`
- 이벤트 핸들러
- 브라우저 API 사용

필요 없는 경우:
- 단순 정적 화면
- 서버에서 바로 그려도 되는 컴포넌트

## 12. 부모와 자식 컴포넌트
```tsx
export function Parent() {
  return <Child title="배너 생성" />;
}
```

```tsx
export function Child({title}: {title: string}) {
  return <h2>{title}</h2>;
}
```

읽을 때 봐야 할 것:
- 데이터가 어디서 오고
- 어떤 컴포넌트로 내려가며
- 어디서 최종 렌더링되는지

## 13. 실무에서 자주 보는 패턴
### early return
```tsx
if (isLoading) {
  return <p>로딩 중...</p>;
}
```

### 공통 카드 컴포넌트 만들기
```tsx
<SectionCard title="문구부터 배너까지" description="한 번에 생성" />
```

### 버튼 비활성화
```tsx
<button disabled={isSubmitting}>생성 요청</button>
```

### 메시지 출력
```tsx
{message ? <p>{message}</p> : null}
```

## 14. React 코드를 읽을 때 순서
1. 컴포넌트 이름 확인
2. props 구조 확인
3. `useState` 있는지 확인
4. 이벤트 핸들러 확인
5. API 호출 있는지 확인
6. return 안에서 조건부 렌더링 확인
7. 리스트와 key 확인

## 15. 자주 만나는 문제
### 상태를 바꿨는데 화면이 안 바뀜
- state를 직접 수정했을 가능성
- `setState`를 안 썼을 가능성

### 리스트가 이상하게 렌더링됨
- `key`가 잘못됐을 가능성

### 폼 제출이 안 됨
- `onSubmit`이 없는지
- 버튼이 `type="submit"`이 아닌지
- `preventDefault` 흐름이 잘못됐는지 확인

### 브라우저 에러
- `use client`가 빠졌는지
- 서버 컴포넌트에서 브라우저 API를 썼는지 확인

## 16. 이 프로젝트에서 특히 읽어야 할 부분
- `project-form.tsx`의 제출 흐름
- `page.tsx`에서 카드 렌더링하는 방식
- `mock-data.ts` 같은 정적 데이터 사용 방식
- `isSubmitting`, `message` 같은 상태값 처리

## 17. 한 줄 요약
React 코드는 “컴포넌트 + 상태 + 이벤트 + 렌더링”의 반복이라고 보면 가장 빨리 읽힌다. 실무에서는 디자인보다 먼저 아래를 읽는 습관이 중요하다.
- 데이터는 어디서 오나
- 상태는 어디서 바뀌나
- 화면은 어떤 조건에서 달라지나
