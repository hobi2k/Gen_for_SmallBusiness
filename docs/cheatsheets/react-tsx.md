# React + TSX를 처음부터 이해하기

이 문서는 React를 거의 처음 보는 상태를 기준으로 씁니다.  
특히 아래 질문에 답하게 만드는 게 목표입니다.

- 왜 화면을 함수로 만들지?
- `TSX`는 도대체 뭔지?
- `props`, `state`가 왜 필요한지?
- 코드가 왜 이렇게 길어지는지?

## 1. React를 한 줄로 설명하면

React는 **상태에 따라 화면을 다시 그리는 방식**입니다.

쉽게 말하면:

- 값이 바뀌면
- 화면도 다시 계산해서 보여준다

이 감각이 가장 중요합니다.

## 2. React는 왜 필요한가

HTML만으로도 화면은 만들 수 있습니다.  
문제는 서비스 화면은 계속 바뀐다는 점입니다.

예:

- 생성 중이면 "만드는 중..."이 떠야 함
- 응답이 오면 결과 카드가 보여야 함
- 보컬 모드를 고르면 가사 입력칸이 나타나야 함

이걸 손으로 직접 DOM을 조작하면서 관리하면 금방 복잡해집니다.

React는 이걸 이렇게 바꿉니다.

- 지금 상태가 이러면
- 화면은 이렇게 보여라

즉 "명령으로 화면을 고치는 방식"보다 "상태를 기준으로 화면을 설명하는 방식"입니다.

## 3. 컴포넌트는 뭐냐

React에서 화면은 작은 조각들로 나뉩니다.  
이 조각 하나를 **컴포넌트**라고 합니다.

예:

```tsx
export function TitleCard() {
  return <h1>장사한컷</h1>;
}
```

이건 화면 조각 하나입니다.

즉 React에서는 이런 식으로 생각합니다.

- 큰 페이지 하나
- 그 안에 작은 부품 여러 개

예를 들면 이 프로젝트에선:

- 상단 네비게이션
- 메인 채팅창
- 결과 카드
- 전용 생성 폼

같은 것들이 각각 컴포넌트입니다.

## 4. 왜 함수로 만드는가

React 컴포넌트는 보통 함수입니다.

```tsx
export function ModeCard() {
  return <div>카드</div>;
}
```

이걸 너무 어렵게 생각할 필요 없습니다.  
그냥 "화면 조각을 반환하는 함수"입니다.

Python으로 아주 거칠게 비유하면:

```python
def mode_card():
    return "<div>카드</div>"
```

같은 느낌입니다.  
다만 React는 문자열이 아니라 "화면 설명"을 반환한다고 보면 됩니다.

## 5. TSX는 뭐냐

이 부분이 제일 많이 헷갈립니다.

TSX는 **TypeScript 안에서 화면 문법을 같이 쓰는 형식**입니다.

예:

```tsx
const title = '장사한컷';

return <h1>{title}</h1>;
```

여기서:

- `const title = '장사한컷';`
  - TypeScript / JavaScript
- `<h1>{title}</h1>`
  - TSX

즉 TSX는 별도 언어라기보다,

- 로직
- 타입
- 화면

을 한 파일 안에 같이 쓰는 형식입니다.

그래서 화면을 직접 반환하는 파일은 보통 `.tsx` 확장자를 씁니다.

## 6. `.ts`와 `.tsx` 차이

### `.ts`

화면을 직접 그리지 않는 파일

예:

- 타입 정의
- 유틸 함수
- 설정 파일

### `.tsx`

화면을 직접 반환하는 파일

예:

- 컴포넌트
- 페이지 파일

즉 구분 기준은 단순합니다.

- 화면 JSX를 직접 쓰면 `.tsx`
- 안 쓰면 `.ts`

## 7. props는 뭐냐

`props`는 부모 컴포넌트가 자식 컴포넌트에게 넘기는 입력값입니다.

예:

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

읽는 법:

- `ModeCard`는 `title`, `description`을 받는다
- 받은 값을 화면에 뿌린다

Python 함수 인자처럼 보면 됩니다.

```python
def mode_card(title: str, description: str):
    ...
```

즉 props는 "컴포넌트 입력값"입니다.

## 8. state는 뭐냐

`state`는 컴포넌트가 기억해야 하는 값입니다.

예:

```tsx
import {useState} from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

읽는 법:

- `count`
  - 현재 값
- `setCount`
  - 그 값을 바꾸는 함수

즉 state는 "화면이 기억해야 하는 값"입니다.

이 프로젝트에서 state 예시는 이런 것들입니다.

- 채팅 메시지 목록
- 현재 입력값
- 첨부 이미지 목록
- 생성 중 여부
- 진행률
- 응답 결과

## 9. 상태가 왜 중요하냐

React의 핵심은 이겁니다.

- state가 바뀌면
- 화면이 다시 그려진다

즉 버튼을 눌렀을 때 직접 DOM을 고치는 게 아니라,

1. state를 바꿈
2. React가 다시 그림

이 흐름입니다.

## 10. 이벤트는 뭔가

이벤트는 사용자의 행동입니다.

예:

```tsx
<button onClick={handleClick}>버튼</button>
<form onSubmit={handleSubmit}>...</form>
<input onChange={handleChange} />
```

읽는 법:

- 클릭하면 `handleClick`
- 제출하면 `handleSubmit`
- 입력이 바뀌면 `handleChange`

즉 이벤트 함수는 보통 state를 바꾸거나 API를 호출합니다.

## 11. 폼 처리는 보통 어떻게 읽어야 하나

예:

```tsx
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const productName = String(formData.get('product_name') ?? '');
}
```

읽는 순서:

1. 브라우저 기본 제출을 막음
2. 폼 값을 읽음
3. 필요한 구조로 정리
4. API로 보냄

즉 프론트 폼은 결국

- 입력 수집
- 값 정리
- API 요청

입니다.

## 12. 조건부 렌더링은 뭐냐

React는 "이 조건이면 보여주고, 아니면 숨겨라"를 코드 안에 직접 씁니다.

예:

```tsx
{message ? <p>{message}</p> : null}
```

뜻:

- `message`가 있으면 `<p>`를 보여주고
- 없으면 아무 것도 안 보여준다

또는:

```tsx
{isLoading && <p>로딩 중...</p>}
```

뜻:

- `isLoading`이 true일 때만 보여준다

이건 프론트 코드에서 정말 자주 나옵니다.

## 13. 리스트 렌더링은 뭐냐

배열이 있으면 보통 `map()`으로 화면에 뿌립니다.

```tsx
{messages.map((message) => (
  <div key={message.id}>{message.content}</div>
))}
```

뜻:

- `messages` 배열을 하나씩 꺼내서
- 각각 `<div>`로 만든다

여기서 `key`는 React가 각 항목을 구분하는 데 필요합니다.

즉 리스트를 그릴 때는:

- 배열
- `map`
- `key`

이 세 개를 같이 보면 됩니다.

## 14. `useEffect`는 언제 쓰나

`useEffect`는 어떤 값이 바뀌었을 때 부수 작업을 할 때 씁니다.

예:

- 타이머 시작/정리
- 외부 이벤트 등록/해제
- 특정 상태가 바뀌었을 때 추가 동작

이 프로젝트에선 진행률 타이머처럼 "화면 그리기 말고 추가로 해야 하는 일"에 씁니다.

즉 `useEffect`는 그냥 화면 출력이 아니라 **부가 동작**입니다.

## 15. 실제 파일 읽기 예시

### [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx)

이 파일은 아래 순서로 읽으면 됩니다.

1. 타입 정의
2. state 선언
3. 예시 프롬프트 배열
4. 파일 첨부 처리
5. `handleSubmit()`
6. 마지막 `return (...)`

즉 "상태 -> 이벤트 -> 화면" 순서로 읽으세요.

### [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx)

이 파일은 아래 순서가 좋습니다.

1. `GenerationMode` 보기
2. `contentMap` 보기
3. state 보기
4. `handleSubmit()` 보기
5. `mode === 'image'`, `mode === 'video'`, `mode === 'music'` 분기 보기

즉 이 파일은 "하나의 폼 컴포넌트가 세 화면을 어떻게 겸하는가"를 보여주는 예시입니다.

## 16. React 코드를 처음 읽을 때 추천 순서

파일 하나를 보면 이 순서대로 보세요.

1. 컴포넌트 이름
2. props 타입
3. state 선언
4. 이벤트 함수
5. 조건부 렌더링
6. 마지막 return

이 순서만 지켜도 JSX가 길어 보여도 훨씬 덜 막힙니다.

## 17. 한 줄 요약

React는 **상태가 바뀌면 화면이 다시 그려지는 방식**이고,  
TSX는 그 화면을 TypeScript 파일 안에서 같이 쓰게 해주는 형식입니다.

즉 처음엔 이렇게만 기억하면 됩니다.

- 컴포넌트 = 화면 함수
- props = 입력값
- state = 기억하는 값
- 이벤트 = 상태를 바꾸는 계기
- return = 실제 화면
