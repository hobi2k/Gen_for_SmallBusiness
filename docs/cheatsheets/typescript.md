# TypeScript 기초부터 다시 보기

이 문서는 "TypeScript가 낯설고, `export`가 뭔지도 잘 모르겠다"는 상태를 기준으로 씁니다.  
Python은 어느 정도 읽을 수 있지만, 프론트엔드 문법은 아직 감이 없는 사람을 위한 문서입니다.

## 1. TypeScript를 한 줄로 설명하면

TypeScript는 JavaScript에 "이 값은 어떤 모양이다"라는 설명을 더 붙인 언어입니다.

즉 핵심은 계산 자체보다 **데이터 구조를 분명하게 적는 것**입니다.

Python으로 비유하면:

```python
def greet(name: str) -> str:
    return f"안녕, {name}"
```

TypeScript로 비슷하게 쓰면:

```ts
function greet(name: string): string {
  return `안녕, ${name}`;
}
```

즉 "타입 힌트가 더 강하게 적용되는 JavaScript"라고 보면 시작하기 쉽습니다.

## 2. JavaScript와 TypeScript는 무슨 차이인가

JavaScript는 이런 식입니다.

```js
function greet(name) {
  return '안녕, ' + name;
}
```

이 코드는 실행은 되지만, `name`이 문자열이어야 하는지 숫자여도 되는지 코드만 봐서는 분명하지 않습니다.

TypeScript는 그걸 명확히 적습니다.

```ts
function greet(name: string): string {
  return `안녕, ${name}`;
}
```

이제 우리는 바로 알 수 있습니다.

- `name`은 문자열이어야 한다
- 이 함수는 문자열을 돌려준다

즉 TypeScript는 "나중에 헷갈릴 정보를 미리 적는 방식"입니다.

## 3. 가장 먼저 알아야 할 문법 5개

처음에는 이것만 알면 됩니다.

1. `const`, `let`
2. `type`, `interface`
3. `import`, `export`
4. 함수 선언
5. 객체와 배열 타입

이 다섯 개가 실제로 제일 많이 나옵니다.

## 4. `const`와 `let`

이건 변수 선언입니다.

```ts
const title = '장사한컷';
let count = 0;
```

읽는 법:

- `const`: 다시 다른 값으로 바꾸지 않을 변수
- `let`: 나중에 값이 바뀔 수 있는 변수

Python처럼 쓰면 이런 느낌입니다.

```python
title = "장사한컷"
count = 0
```

차이는 TypeScript/JavaScript는 변수 선언 키워드를 같이 써야 한다는 점입니다.

실무에서는 보통:

- 대부분 `const`
- 꼭 값이 바뀌어야 할 때만 `let`

을 씁니다.

## 5. 타입은 어디에 붙는가

기본형은 이 정도만 알면 충분합니다.

```ts
const title: string = '장사한컷';
const count: number = 3;
const active: boolean = true;
```

Python과 비교하면:

- `str` -> `string`
- `int`, `float` -> `number`
- `bool` -> `boolean`

즉 문법은 다르지만 감각은 비슷합니다.

## 6. TypeScript는 항상 타입을 다 쓰는가

아닙니다. TypeScript는 **타입 추론**을 합니다.

```ts
const title = '장사한컷';
const count = 3;
```

이렇게 적어도 TypeScript는 자동으로

- `title`은 `string`
- `count`는 `number`

라고 이해합니다.

그래서 실무에서는:

- 단순 변수는 추론에 맡기고
- 함수 인자, 반환값, 복잡한 객체 구조는 명시적으로 적는 경우가 많습니다

## 7. `export`와 `import`는 대체 뭔가

이 부분이 초보가 가장 자주 막히는 부분입니다.

### `export`

`export`는 "이 값을 다른 파일에서도 쓸 수 있게 꺼내 놓는다"는 뜻입니다.

예:

```ts
export const toneOptions = ['깔끔한 판매형', '따뜻한 공감형'];
```

뜻:

- `toneOptions`라는 값을
- 이 파일 안에서만 쓰는 게 아니라
- 다른 파일에서도 가져다 쓸 수 있게 공개한다

Python으로 비유하면:

- Python은 파일 안에 함수나 변수를 만들면 기본적으로 import 가능
- TypeScript는 보통 `export`를 붙여야 "밖에서 쓸 거다"가 분명해짐

### `import`

`import`는 다른 파일이 공개한 값을 가져오는 문법입니다.

```ts
import {toneOptions} from '@/lib/options';
```

뜻:

- `@/lib/options` 파일에서
- `toneOptions`를 가져오겠다

즉:

- `export` = 밖으로 내보냄
- `import` = 다른 파일에서 가져옴

### 같이 보면

파일 A:

```ts
export const appName = '장사한컷';
```

파일 B:

```ts
import {appName} from './file-a';
```

이렇게 한 파일이 공개하고, 다른 파일이 가져다 씁니다.

## 8. `export default`는 또 뭔가

`export default`는 "이 파일에서 가장 대표로 내보내는 값"을 뜻합니다.

예:

```ts
export default function HomePage() {
  return 'home';
}
```

다른 파일에서 가져올 때는 중괄호 없이 씁니다.

```ts
import HomePage from './page';
```

반면 일반 `export`는 중괄호가 필요합니다.

```ts
export const title = '장사한컷';
import {title} from './file';
```

즉 구분은 이렇게 보면 됩니다.

- `export default`
  - 대표 하나
  - 가져올 때 중괄호 없음
- `export`
  - 여러 개 가능
  - 가져올 때 중괄호 필요

## 9. 객체 타입이 제일 중요하다

프론트엔드에서는 객체가 핵심입니다.

예:

```ts
type ProductRequest = {
  product_name: string;
  category: string;
  tone: string;
  video_duration_seconds: number;
};
```

이건 "이 객체는 이런 키들을 가져야 한다"는 뜻입니다.

Python으로 비교하면:

```python
from typing import TypedDict

class ProductRequest(TypedDict):
    product_name: str
    category: str
    tone: str
    video_duration_seconds: int
```

즉 TypeScript에서 중요한 건 **객체 모양을 명확히 적는 것**입니다.

## 10. `type`과 `interface`

둘 다 "데이터 구조 설명"에 씁니다.

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

초반에는 차이를 너무 깊게 파지 않아도 됩니다.

그냥 이렇게 받아들이면 됩니다.

- 둘 다 구조 설명용
- 프론트 코드에서 둘 다 많이 보임
- 처음엔 `type`이든 `interface`든 "이 객체는 이렇게 생겼다"라고 읽으면 충분함

## 11. 배열 타입

```ts
const keywords: string[] = ['수제', '딸기'];
```

뜻:

- 문자열이 여러 개 들어 있는 배열

Python으로 보면:

```python
keywords: list[str] = ["수제", "딸기"]
```

## 12. 함수 읽는 법

예:

```ts
function buildMessage(productName: string, tone: string): string {
  return `${productName}을 ${tone} 분위기로 소개합니다.`;
}
```

읽는 순서:

1. 함수 이름: `buildMessage`
2. 입력값: `productName`, `tone`
3. 각각의 타입: 둘 다 `string`
4. 반환값 타입: `string`

이 순서로 읽으면 됩니다.

## 13. `|`는 무슨 뜻인가

이건 유니언 타입입니다.

```ts
type VocalMode = 'instrumental' | 'vocal';
```

뜻:

- 아무 문자열이 아니라
- `instrumental` 또는 `vocal`만 가능

Python으로 비교하면:

```python
from typing import Literal

VocalMode = Literal["instrumental", "vocal"]
```

이건 실제 프론트 코드에서 자주 나옵니다.

- 모드 구분
- 탭 종류
- 상태값

## 14. `?`는 무슨 뜻인가

객체 타입에서 `?`는 "있을 수도 있고, 없을 수도 있다"는 뜻입니다.

```ts
type Result = {
  message?: string;
  project_root?: string;
};
```

뜻:

- `message`가 있을 수도 있음
- 아예 없을 수도 있음

즉 응답이 아직 안 왔거나, 일부 필드만 있는 상황을 표현할 때 씁니다.

## 15. `null`과 `undefined`

이건 Python의 `None`과 비슷하지만, 보통 둘을 나눠 씁니다.

- `null`: 비어 있음을 명시적으로 넣음
- `undefined`: 값이 아직 없거나 빠져 있음

예:

```ts
const status: string | null = null;
```

뜻:

- `status`는 문자열일 수도 있고
- 아직 값이 없어서 `null`일 수도 있다

## 16. 실제 코드 읽기 예시

예를 들어 이런 코드가 있으면:

```ts
type GenerationMode = 'image' | 'video' | 'music';

type GenerationFormProps = {
  mode: GenerationMode;
};

export function GenerationForm({mode}: GenerationFormProps) {
  return <div>{mode}</div>;
}
```

이걸 이렇게 읽으면 됩니다.

1. `GenerationMode`
   - mode는 `image`, `video`, `music` 중 하나
2. `GenerationFormProps`
   - 이 컴포넌트는 `mode`라는 값을 받음
3. `export function GenerationForm`
   - 이 함수를 다른 파일에서도 쓸 수 있게 공개함
4. `({mode}: GenerationFormProps)`
   - props 안에서 `mode`를 꺼내 쓰고 있음

즉 처음엔 한 줄씩 읽으려 하지 말고,

- 어떤 타입이 있는가
- 어떤 함수가 있는가
- 그 함수가 무슨 입력을 받는가

이 세 개만 먼저 보면 됩니다.

## 17. 이 프로젝트에서 먼저 보면 좋은 TypeScript 파일

- [frontend/lib/assets.ts](../../frontend/lib/assets.ts)
  - 타입, 배열, 유틸 함수 읽기 연습하기 좋음
- [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx)
  - props, 상태, FormData, fetch가 다 들어 있음
- [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx)
  - 실제 서비스형 TypeScript 흐름을 보기 좋음

## 18. 처음엔 이렇게 읽으면 된다

TypeScript 파일을 보면 이 순서대로 읽으세요.

1. `import`
2. `type` / `interface`
3. `export function`
4. 함수 인자 타입
5. 반환되는 값

처음부터 세부 문법을 다 이해하려 하지 말고, "이 파일이 어떤 값을 주고받는지"부터 보는 게 훨씬 낫습니다.
