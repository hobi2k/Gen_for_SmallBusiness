# TypeScript 실무 빠른 기초

## 1. TypeScript를 왜 쓰는가
TypeScript는 JavaScript에 타입 정보를 추가해서 실수를 줄이고, 자동완성, 리팩터링, 코드 탐색을 쉽게 만들어 준다.

실무에서 체감하는 장점은 아래와 같다.
- 함수에 어떤 값이 들어가야 하는지 코드만 보고 알기 쉽다.
- 잘못된 키 이름, 잘못된 값 타입을 저장 전에 잡기 쉽다.
- 프론트엔드 상태, API 응답, 폼 입력 구조를 안정적으로 맞출 수 있다.

## 2. 가장 기본이 되는 타입
```ts
const title: string = '장사한컷';
const count: number = 3;
const isReady: boolean = true;
const nothing: null = null;
const noValue: undefined = undefined;
```

자주 보는 기본 타입:
- `string`
- `number`
- `boolean`
- `null`
- `undefined`
- `bigint`
- `symbol`

## 3. 타입 추론
TypeScript는 값을 보고 타입을 자동으로 추론한다.

```ts
const name = '수제 딸기잼';
const amount = 10;
const active = false;
```

위 코드는 각각 `string`, `number`, `boolean`으로 추론된다.

실무에서는 아래 기준으로 보면 된다.
- 단순 상수: 추론에 맡겨도 됨
- 함수 인자, 반환값, 복잡한 객체: 타입을 명시하는 편이 좋음

## 4. 배열과 객체 타입
### 배열
```ts
const keywords: string[] = ['수제', '딸기', '잼'];
const ids: number[] = [1, 2, 3];
```

다른 표기:
```ts
const keywords: Array<string> = ['수제', '딸기', '잼'];
```

### 객체
```ts
const payload: {
  productName: string;
  tone: string;
  keywords: string[];
} = {
  productName: '수제 딸기잼',
  tone: '깔끔한 판매형',
  keywords: ['수제', '잼'],
};
```

실무에서는 위처럼 인라인 타입을 길게 쓰기보다 `type`이나 `interface`로 빼는 경우가 많다.

## 5. type 과 interface
### type
```ts
type ProjectPayload = {
  productName: string;
  tone: string;
  script?: string | null;
};
```

### interface
```ts
interface ProjectResponse {
  id: string;
  productName: string;
  status: string;
}
```

대충 이렇게 생각하면 된다.
- `type`: 유니언, 복합 타입까지 자유롭게 표현할 때 편함
- `interface`: 객체 구조 설명에 자주 씀

실무에서는 둘 다 많이 쓰인다. React props는 `interface`, API 응답이나 상태 유니언은 `type`으로 보는 경우가 많다.

## 6. 선택 속성과 읽기 전용
### 선택 속성
```ts
type ProjectPayload = {
  productName: string;
  script?: string;
};
```
- `script`는 있어도 되고 없어도 된다.

### 읽기 전용
```ts
type ProjectSummary = {
  readonly id: string;
  title: string;
};
```
- `id`는 만든 뒤 바꾸지 않겠다는 뜻이다.

## 7. 유니언 타입과 리터럴 타입
### 유니언 타입
```ts
let value: string | number;
value = '광고';
value = 3;
```

### 리터럴 타입
```ts
let status: 'idle' | 'loading' | 'done' | 'error' = 'idle';
```

실무에서 매우 자주 쓴다.
- 상태값
- 분위기 값
- API 요청 단계
- 탭 종류

예:
```ts
type Tone = '깔끔한 판매형' | '따뜻한 공감형' | '밝은 행사형' | '고급스러운 브랜드형';
```

## 8. null 과 undefined 처리
TypeScript에서 초보가 가장 자주 막히는 부분이다.

```ts
const script: string | null = null;
const imagePath: string | undefined = undefined;
```

차이:
- `null`: 비어 있음을 명시적으로 넣은 값
- `undefined`: 아직 값이 없거나 빠진 상태

자주 보는 처리 방식:
```ts
if (script) {
  console.log(script.length);
}
```

기본값 넣기:
```ts
const finalScript = script ?? '기본 광고 문구';
```

## 9. 함수 타입
### 기본 함수
```ts
function createHeadline(productName: string, tone: string): string {
  return `${productName}을 ${tone} 분위기로 소개합니다.`;
}
```

### 화살표 함수
```ts
const createHeadline = (productName: string, tone: string): string => {
  return `${productName}을 ${tone} 분위기로 소개합니다.`;
};
```

### 반환값이 없는 함수
```ts
function logMessage(message: string): void {
  console.log(message);
}
```

## 10. 제네릭 기초
제네릭은 “타입을 나중에 넣는 함수” 정도로 이해하면 시작하기 쉽다.

```ts
function wrapValue<T>(value: T): {value: T} {
  return {value};
}

const wrappedString = wrapValue('광고');
const wrappedNumber = wrapValue(3);
```

실무에서 자주 보이는 곳:
- API 응답 래퍼
- 공통 유틸 함수
- 상태 관리 라이브러리

## 11. 타입 단언과 위험한 구간
```ts
const input = document.getElementById('name') as HTMLInputElement;
```

이건 “내가 이 타입이라고 확신한다”는 뜻이다.
너무 많이 쓰면 위험하다.

실무 기준:
- 정말 브라우저 API나 라이브러리 타입이 애매할 때만 사용
- 먼저 `if`로 확인할 수 있으면 확인부터 하는 게 낫다

## 12. 좁히기
TypeScript는 조건문을 보고 타입 범위를 좁힌다.

```ts
function printValue(value: string | number) {
  if (typeof value === 'string') {
    console.log(value.toUpperCase());
    return;
  }

  console.log(value.toFixed(2));
}
```

이걸 `narrowing`이라고 본다.
실무에서 유니언 타입 쓸 때 계속 나온다.

## 13. 실무에서 자주 보는 문법
### 구조 분해
```ts
const project = {
  title: '수제 딸기잼',
  status: 'done',
};

const {title, status} = project;
```

### 스프레드
```ts
const basePayload = {title: '수제 딸기잼'};
const nextPayload = {...basePayload, tone: '깔끔한 판매형'};
```

### optional chaining
```ts
console.log(project?.title);
```

### nullish coalescing
```ts
const finalTitle = project.title ?? '제목 없음';
```

## 14. API 응답 타입 읽는 법
```ts
type ProjectResponse = {
  id: string;
  productName: string;
  status: 'running' | 'completed' | 'failed';
  heroAssetPath: string | null;
};
```

이 타입을 읽을 때 봐야 할 것:
- 어떤 키가 필수인지
- 어떤 키가 비어 있을 수 있는지
- 상태값 후보가 무엇인지
- 프런트에서 조건 분기가 필요한 값이 무엇인지

## 15. 폼 데이터 처리할 때 자주 보는 패턴
```ts
const payload = {
  productName: String(formData.get('product_name') ?? ''),
  tone: String(formData.get('tone') ?? '깔끔한 판매형'),
  keywords: String(formData.get('keywords') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
};
```

읽는 포인트:
- `String(...)`으로 문자열 강제 변환
- `??`로 기본값 처리
- `split -> map -> filter`로 문자열을 배열로 변환

## 16. 자주 만나는 에러 메시지
### `Type 'X' is not assignable to type 'Y'`
가장 흔하다. 타입이 맞지 않는 값을 넣은 것이다.

### `Object is possibly 'null'`
null 가능성이 있는데 바로 접근하려 했다는 뜻이다.

### `Property 'x' does not exist on type 'y'`
없는 키를 읽으려 했다는 뜻이다.

### `Argument of type 'X' is not assignable to parameter of type 'Y'`
함수에 잘못된 타입의 값을 넣은 것이다.

## 17. 이 프로젝트 기준으로 빨리 읽어야 할 포인트
- `payload` 객체가 어떤 구조인지
- `status`가 어떤 리터럴 값으로 관리되는지
- `string | null` 값이 어디에 있는지
- 폼에서 문자열을 배열로 바꾸는 흐름
- API 응답 타입과 화면 상태 타입이 어떻게 맞물리는지

## 18. 처음 읽을 때 추천 순서
1. `type`, `interface`부터 읽기
2. 함수 인자/반환 타입 보기
3. 유니언 타입과 null 처리 보기
4. 폼/응답 객체 구조 읽기
5. 에러 메시지 해석하기

## 19. 한 줄 요약
TypeScript는 “값의 모양을 미리 적어 두는 JavaScript”라고 생각하면 가장 빨리 익힌다. 실무에서는 문법보다도 아래 세 가지를 먼저 읽히는 게 중요하다.
- 객체 구조
- 함수 인자와 반환값
- null, 상태값, 유니언 처리
