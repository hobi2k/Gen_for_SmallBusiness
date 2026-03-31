# React + TSX 빠른 기초

## 1. 이 문서에서 가장 먼저 잡아야 할 감각
Python만 주로 보던 사람이 React 코드를 처음 보면 보통 이렇게 느낀다.

- 함수 안에서 왜 HTML 같은 걸 쓰지?
- 왜 화면을 함수로 만들지?
- 값이 바뀌면 왜 다시 그려지지?
- `TSX`는 또 뭐지?

핵심은 이겁니다.

- `React`는 화면을 함수 단위로 쪼개서 만드는 방식이다.
- `TSX`는 그 함수 안에서 화면 문법을 같이 쓰게 해주는 형식이다.

즉:

- React = 화면을 만드는 방식
- TSX = 그 React 화면을 쓰는 파일 문법

---

## 2. Python 기준으로 비유하면
Python 서버 코드를 쓸 때는 보통 이런 느낌이다.

- 함수가 값을 받아서
- 처리한 뒤
- 결과를 반환한다

React도 기본 감각은 비슷하다.

- 컴포넌트 함수가 값을 받아서
- 상태를 보고
- 화면을 반환한다

예:

```tsx
export function TitleCard() {
  return <h1>장사한컷</h1>;
}
```

이건 “화면 조각을 반환하는 함수”다.

Python 식으로 억지 비유하면:

```python
def title_card():
    return "<h1>장사한컷</h1>"
```

같은 느낌인데, React는 그 결과를 문자열이 아니라 “화면 설명”으로 다룬다고 보면 된다.

---

## 3. React는 왜 필요한가
순수 HTML만으로도 화면은 만들 수 있다. 그런데 서비스 화면은 보통 계속 바뀐다.

- 버튼 누르면 메시지가 바뀜
- 로딩 중이면 문구가 바뀜
- 결과가 오면 카드가 생김
- 탭에 따라 다른 화면이 보임

이런 걸 손으로 직접 DOM 조작하면서 만들면 금방 복잡해진다.

React는 그걸 이렇게 바꿔 생각하게 해준다.

- 지금 상태가 이러면
- 화면은 이렇게 보여라

즉 React는 “DOM 조작 라이브러리”처럼 보기보다,

- 상태 -> 화면

으로 연결하는 방식이라고 보는 게 더 잘 읽힌다.

---

## 4. 컴포넌트가 제일 중요하다
React는 화면을 큰 페이지 하나로 만들지 않고 작은 조각으로 나눈다.

예:

- 채팅 패널
- 생성 폼
- 결과 카드
- 상단 네비게이션

이 각각이 컴포넌트다.

예:

```tsx
export function SectionCard() {
  return <div>카드</div>;
}
```

즉 컴포넌트는:

- 화면 일부를 담당하는 함수

라고 이해하면 된다.

---

## 5. props는 함수 인자처럼 보면 된다
React 초보가 가장 먼저 읽어야 하는 건 `props`다.

```tsx
type ModeCardProps = {
  title: string;
  description: string;
};

export function ModeCard({title, description}: ModeCardProps) {
  return (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
```

여기서 `props`는 부모가 자식에게 주는 입력값이다.

Python으로 보면:

```python
def mode_card(title: str, description: str):
    ...
```

와 거의 같은 감각이다.

즉 컴포넌트를 읽을 때는 먼저:

1. 이 컴포넌트가 무슨 값을 받는가
2. 그 값을 어디에 뿌리는가

를 보면 된다.

---

## 6. TSX는 정확히 뭐냐
이 부분이 제일 많이 헷갈린다.

TSX는 “TypeScript 파일 안에서 HTML 비슷한 문법을 같이 쓰는 형식”이다.

예:

```tsx
const title = '장사한컷';

return <h1>{title}</h1>;
```

여기서:

- `const title = '장사한컷';`
  - TypeScript / JavaScript
- `<h1>{title}</h1>`
  - TSX 문법

즉 한 파일 안에:

- 로직
- 타입
- 화면

이 같이 들어간다.

그래서 `.tsx` 파일은 보통 “화면을 직접 반환하는 파일”이다.

반대로 `.ts` 파일은 보통:

- 유틸 함수
- 타입 정의
- 설정 파일

같이 화면을 직접 안 그리는 곳에 쓴다.

---

## 7. React와 TypeScript는 어디서 합쳐지나
이건 아주 단순하다.

- React는 컴포넌트 개념을 준다
- TypeScript는 그 컴포넌트에 타입을 붙인다
- TSX는 그 둘을 한 파일에서 같이 쓰게 해준다

예:

```tsx
type Props = {
  title: string;
};

export function Card({title}: Props) {
  return <div>{title}</div>;
}
```

여기서

- `type Props` -> TypeScript
- `function Card` -> React 컴포넌트
- `return <div>{title}</div>` -> TSX

즉 셋은 경쟁 관계가 아니라 한 파일 안에서 같이 작동한다.

---

## 8. 상태는 React의 핵심이다
React를 쓰는 가장 큰 이유는 상태 때문이다.

예:

```tsx
import {useState} from 'react';

export function Example() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

읽는 법:

- `count`: 지금 화면이 참고하는 값
- `setCount`: 그 값을 바꾸는 함수

값이 바뀌면 React가 다시 화면을 그린다.

이게 React의 제일 중요한 감각이다.

- 상태가 바뀌면
- 화면도 다시 계산된다

Python 웹 서버처럼 요청 한 번 받고 HTML 한 번 만들고 끝나는 구조와는 감각이 다르다.

React는 브라우저 안에서 상태가 계속 바뀌는 화면을 다루는 데 맞춰져 있다.

---

## 9. 이벤트는 “상태를 바꾸는 계기”다

```tsx
<button onClick={handleClick}>생성</button>
<form onSubmit={handleSubmit}>...</form>
<input onChange={handleChange} />
```

이벤트를 읽을 때는 이렇게 보면 된다.

1. 무슨 이벤트인가
2. 어떤 함수가 실행되는가
3. 그 함수가 어떤 상태를 바꾸는가
4. 그 결과 어떤 화면이 달라지는가

즉 React 코드는 HTML처럼 읽기보다:

- 입력
- 상태 변화
- 화면 변화

순서로 읽는 게 훨씬 낫다.

---

## 10. 폼 처리 흐름
이 프로젝트에서 제일 중요한 React 패턴 중 하나다.

```tsx
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const payload = {
    product_name: String(formData.get('product_name') ?? ''),
  };
}
```

이걸 Python 기준으로 읽으면:

1. 브라우저 폼 제출을 막고
2. 폼 값을 읽어서
3. Python dict 비슷한 객체를 만들고
4. API로 보낸다

즉 React 폼은 결국:

- 입력값 수집
- 상태/객체 생성
- API 호출

이다.

---

## 11. 조건부 렌더링
React는 “조건에 따라 보여줄지 말지”를 코드 안에서 바로 쓴다.

```tsx
{message ? <p>{message}</p> : null}
```

뜻:

- `message`가 있으면 `<p>`를 보여주고
- 없으면 아무 것도 안 보여준다

또 자주 보는 형태:

```tsx
{isLoading && <p>로딩 중...</p>}
```

즉 Python의 `if`가 화면 안에 직접 들어간다고 보면 된다.

---

## 12. 리스트 렌더링

```tsx
{items.map((item) => (
  <div key={item.id}>{item.title}</div>
))}
```

이건 “배열을 돌면서 화면 조각을 만든다”는 뜻이다.

Python으로 비유하면:

```python
for item in items:
    print(item["title"])
```

같은 흐름인데, React에서는 그 결과가 화면 요소가 된다.

`key`는 React가 각 항목을 구분하는 데 꼭 필요하다.

---

## 13. `use client`는 왜 붙나
Next.js에서는 파일 맨 위에 이 문구가 붙을 수 있다.

```tsx
'use client';
```

이 뜻은:

- 이 컴포넌트는 브라우저에서 동작해야 한다

정도로 이해하면 된다.

필요한 경우:

- `useState`
- 클릭 이벤트
- 입력 폼
- 브라우저 API

즉 “사용자와 상호작용하는 컴포넌트”는 보통 붙는다.

---

## 14. 이 프로젝트에서 실제로 읽어볼 파일

### [chat-panel.tsx](frontend/components/chat-panel.tsx)
이 파일은 React 입문 예제로 좋다.

왜냐하면 여기엔 다 들어 있다.

- `useState`
- 폼 제출
- `fetch`
- 조건부 렌더링
- 메시지 리스트 렌더링

읽는 순서:

1. 상태 선언
2. `handleSubmit`
3. `return`

### [generation-form.tsx](/home/hosung/pytorch-demo/Gen_for_SmallBusiness/frontend/components/generation-form.tsx)
이 파일은 “실전 폼” 예제다.

여기서 봐야 할 것:

- 모드에 따라 화면이 달라지는 방식
- `payload` 만드는 방식
- 응답 결과를 상태에 넣는 방식
- 결과 패널을 조건에 따라 보여주는 방식

### [page.tsx](/home/hosung/pytorch-demo/Gen_for_SmallBusiness/frontend/app/page.tsx)
이 파일은 페이지 조립용이다.

여기서는:

- 큰 컴포넌트들을 어떻게 배치하는지
- 페이지 레벨에서 어떤 카드들을 조합하는지

를 보면 된다.

---

## 15. React 코드를 읽을 때 순서
처음엔 HTML처럼 읽지 말고 이 순서로 읽는 게 제일 좋다.

1. 이 파일이 컴포넌트인가
2. props는 뭔가
3. state는 뭔가
4. 이벤트 함수는 뭔가
5. API 호출이 있나
6. 조건부 렌더링이 있나
7. 마지막으로 TSX 레이아웃을 본다

즉 화면 모양보다 먼저:

- 입력
- 상태
- 변화

를 읽는 습관이 중요하다.

---

## 16. 초보가 자주 헷갈리는 부분

### “왜 함수가 화면을 반환하지?”
React는 화면을 조각 함수로 쪼개서 관리하기 때문이다.

### “왜 상태를 직접 바꾸면 안 되지?”
React는 상태 변경을 감지해서 다시 그린다. 그래서 `setState` 계열 함수를 통해 바꿔야 한다.

### “왜 HTML 같지만 HTML이 아니지?”
TSX는 HTML처럼 보이지만 실제로는 JavaScript/TypeScript 표현식이다.

### “`.ts`와 `.tsx`는 언제 나뉘지?”

- `.ts`: 화면 직접 반환 안 함
- `.tsx`: 화면 직접 반환함

---

## 17. 한 줄 요약
React는 “상태가 바뀌면 화면을 다시 그리는 함수형 UI 방식”이고, TSX는 그 화면을 TypeScript 안에서 쓰게 해주는 문법이다.

Python 기준으로 제일 편한 감각은 이거다.

- React 컴포넌트 = 화면을 반환하는 함수
- props = 함수 인자
- state = 화면을 바꾸는 내부 변수
- TSX = 그 함수 안에서 쓰는 화면 문법
