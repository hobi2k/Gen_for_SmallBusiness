# TypeScript 빠른 기초

## 1. 이 문서는 누구를 위한가
이 문서는 Python은 읽을 수 있는데, 프런트엔드 코드를 보면 `왜 타입을 또 쓰지?`, `왜 문자열인데 미리 선언하지?`, `왜 에디터가 저걸 미리 잡지?` 같은 감각이 아직 안 잡힌 사람을 위한 문서다.

핵심은 하나다.

- `TypeScript`는 JavaScript에 타입 정보를 붙여서 코드를 더 안전하게 읽고 고치게 해주는 도구다.

Python으로 비유하면 이렇다.

- Python
  - `def greet(name: str) -> str:`
- TypeScript
  - `function greet(name: string): string {}`

즉 완전히 다른 철학이라기보다, Python의 타입 힌트를 훨씬 더 강하게 적용한다고 보면 시작하기 쉽다.

---

## 2. TypeScript를 왜 쓰는가
JavaScript만 쓰면 이런 문제가 자주 생긴다.

- 함수에 뭘 넣어야 하는지 코드만 봐서는 모호하다.
- 객체 키 이름을 틀려도 실행 전까지 모를 수 있다.
- API 응답 구조가 바뀌었는데 뒤늦게 화면에서 터질 수 있다.

TypeScript를 쓰면 이런 걸 빨리 잡을 수 있다.

- 이 함수가 어떤 값을 받는지 바로 보인다.
- 이 객체에 어떤 키가 있어야 하는지 바로 보인다.
- 이 값이 문자열인지 숫자인지 실행 전에 확인할 수 있다.

파이썬으로 치면:

- `mypy`, `pyright`, `pydantic`, 타입 힌트의 장점을
- 프런트 코드 전체에 더 강하게 적용하는 느낌이다.

---

## 3. TypeScript는 어디에 붙는가
React 프로젝트에서 TypeScript는 거의 모든 데이터 구조에 붙는다.

- 함수 인자
- 함수 반환값
- 컴포넌트 props
- 상태값
- API 요청 body
- API 응답 구조

예:

```ts
type ProjectPayload = {
  product_name: string;
  category: string;
  tone: string;
  video_duration_seconds: number;
};
```

이 타입 하나만 있어도 우리는 바로 알 수 있다.

- `product_name`은 문자열
- `video_duration_seconds`는 숫자
- 이 객체에는 저 키들이 있어야 함

즉 TypeScript는 “화면을 그리는 기술”이 아니라 “데이터 구조를 분명하게 만드는 기술”이다.

---

## 4. Python과 비교해서 보는 기본 문법

### 변수 타입

Python:

```python
title: str = "장사한컷"
count: int = 3
active: bool = True
```

TypeScript:

```ts
const title: string = '장사한컷';
const count: number = 3;
const active: boolean = true;
```

대응은 거의 비슷하다.

- `str` -> `string`
- `int`, `float` -> `number`
- `bool` -> `boolean`

---

## 5. 타입 추론
TypeScript는 항상 타입을 다 써야 하는 건 아니다.

```ts
const title = '딸기잼';
const count = 3;
```

위 코드는 자동으로:

- `title`은 `string`
- `count`는 `number`

로 추론된다.

Python에서 타입 힌트를 안 적어도 사람이 대충 아는 것과 비슷하지만, TypeScript는 그걸 도구가 실제로 계산해서 쓴다.

실무 기준:

- 단순 값: 추론에 맡겨도 됨
- 함수 인자, 반환값, API 구조: 타입을 적는 편이 좋음

---

## 6. 객체 타입이 제일 중요하다
프런트엔드에서는 객체가 핵심이다.

예:

```ts
type ProductRequest = {
  product_name: string;
  category: string;
  keywords: string[];
  tone: string;
};
```

이건 Python으로 치면 대충 이런 감각이다.

```python
from typing import TypedDict

class ProductRequest(TypedDict):
    product_name: str
    category: str
    keywords: list[str]
    tone: str
```

즉 TypeScript의 큰 힘은 “이 객체가 어떤 모양이어야 하는가”를 미리 못 박는 데 있다.

---

## 7. `type`과 `interface`
둘 다 객체 구조를 설명하는 데 쓴다.

```ts
type ProductRequest = {
  product_name: string;
  category: string;
};
```

```ts
interface ProductResponse {
  id: string;
  status: string;
}
```

처음에는 이렇게만 생각하면 된다.

- 둘 다 비슷하게 쓴다
- 객체 구조를 설명한다
- 실무에서는 섞여서 많이 보인다

초반엔 “둘의 철학적 차이”보다 “둘 다 데이터 구조 설명용”으로 받아들이는 게 낫다.

---

## 8. 유니언 타입은 자주 본다
이건 Python 초보가 처음엔 낯설어하는 부분이다.

```ts
type Tone = '깔끔한 판매형' | '따뜻한 공감형' | '밝은 행사형';
```

뜻:

- 이 값은 아무 문자열이 아니라
- 저 세 값 중 하나여야 한다

Python으로 비유하면:

```python
from typing import Literal

Tone = Literal["깔끔한 판매형", "따뜻한 공감형", "밝은 행사형"]
```

이건 실무에서 정말 자주 쓴다.

- 상태값
- 탭 종류
- 모드 구분
- 고정된 선택지

---

## 9. 함수 타입

Python:

```python
def create_headline(product_name: str, tone: str) -> str:
    return f"{product_name}을 {tone} 분위기로 소개합니다."
```

TypeScript:

```ts
function createHeadline(productName: string, tone: string): string {
  return `${productName}을 ${tone} 분위기로 소개합니다.`;
}
```

읽는 법은 거의 같다.

- 인자 타입
- 반환 타입

를 보면 된다.

---

## 10. `null`, `undefined`는 왜 귀찮은가
Python은 보통 `None` 하나로 많이 정리되지만, TypeScript/JavaScript는 보통 둘을 나눠 본다.

- `null`
  - 비어 있음을 명시적으로 넣은 값
- `undefined`
  - 아직 값이 없거나, 아예 빠진 상태

예:

```ts
const summary: string | null = null;
const imagePath: string | undefined = undefined;
```

실무에서 초보가 자주 막히는 이유:

- “없을 수도 있는 값”을 바로 쓰면 에러가 날 수 있기 때문

그래서 보통 이렇게 처리한다.

```ts
const finalSummary = summary ?? '기본 소개';
```

---

## 11. 프런트에서 진짜 많이 보는 패턴

### 11-1. 배열 타입

```ts
const keywords: string[] = ['수제', '딸기', '선물'];
```

### 11-2. 객체 배열

```ts
const cards: {title: string; href: string}[] = [
  {title: '이미지 생성', href: '/image'},
  {title: '영상 생성', href: '/video'},
];
```

### 11-3. 선택 속성

```ts
type ChatResponse = {
  message?: string;
  asset_paths?: Record<string, string | string[]>;
};
```

`?`는 “있을 수도 있고 없을 수도 있음”이다.

---

## 12. `Record`는 딕셔너리처럼 읽으면 된다

```ts
type AssetMap = Record<string, string>;
```

이건 Python 감각으로 보면:

```python
dict[str, str]
```

처럼 보면 된다.

즉:

- 키는 문자열
- 값도 문자열

인 객체라는 뜻이다.

---

## 13. 제네릭은 “타입을 나중에 넣는 함수”
처음엔 깊게 들어갈 필요 없다.

```ts
function wrapValue<T>(value: T): {value: T} {
  return {value};
}
```

뜻:

- 어떤 타입이든 받아서
- 같은 타입으로 감싼다

Python으로 아주 느슨하게 비유하면:

```python
from typing import TypeVar

T = TypeVar("T")
```

같은 느낌이다.

---

## 14. 이 프로젝트에서 TypeScript를 어디서 읽어야 하나

### [generation-form.tsx](frontend/components/generation-form.tsx)
여기서 봐야 하는 것:

- `type GenerationMode = 'image' | 'video' | 'music'`
- `GenerationFormProps`
- `result` 상태 타입
- `payload` 객체 구조

즉:

- 화면보다 먼저
- “어떤 데이터가 오가나”를 읽는 파일이다

### [chat-panel.tsx](frontend/components/chat-panel.tsx)
여기서 봐야 하는 것:

- `ChatResponse`
- `ChatMessage`
- `latestResult` 타입

즉:

- 채팅 응답이 어떤 구조인지
- 메시지 배열이 어떤 구조인지

를 타입으로 먼저 설명하고 있다.

---

## 15. TypeScript를 읽을 때 순서
코드를 처음 볼 때는 이 순서가 가장 덜 헷갈린다.

1. `type`, `interface`부터 본다
2. 함수 인자 타입을 본다
3. 반환 타입을 본다
4. 상태 타입을 본다
5. 그 다음에 실제 로직을 본다

즉 프런트 코드를 볼 때는 HTML처럼 보이는 부분보다 먼저 “이 파일이 어떤 데이터를 다루는가”를 읽는 습관이 중요하다.

---

## 16. 한 줄 요약
TypeScript는 “화면을 만드는 기술”이 아니라, 화면과 API 사이에서 오가는 데이터 구조를 분명하게 적는 기술이다.

Python 기준으로 이해하면 이렇게 잡으면 된다.

- Python 타입 힌트보다 더 강하게 검사한다
- 객체 구조 설명이 특히 중요하다
- 프런트에서는 함수보다 “요청 객체, 응답 객체, 상태 객체”를 읽는 데 가장 큰 도움이 된다
