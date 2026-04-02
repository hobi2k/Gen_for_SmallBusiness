# CSS와 Tailwind CSS를 처음부터 이해하기

이 문서는 CSS를 거의 처음 읽는 사람을 기준으로 씁니다.  
특히 아래 질문에 답하는 게 목표입니다.

- `margin`, `padding`이 왜 다른지
- `display: flex`가 뭔지
- Tailwind 클래스가 왜 한 줄에 길게 붙는지
- CSS와 Tailwind를 왜 같이 쓰는지

## 1. CSS를 한 줄로 설명하면

CSS는 **HTML 요소를 어떻게 보이게 할지 정하는 언어**입니다.

즉 HTML이 "무엇이 있는가"라면, CSS는 "그게 어떻게 보이는가"입니다.

예:

```css
body {
  background: white;
  color: #111111;
}
```

이건:

- 배경은 흰색
- 글자색은 진한 검정

으로 보이게 하라는 뜻입니다.

## 2. CSS 기본 문법

```css
body {
  margin: 0;
  color: #111111;
}
```

구성은 세 부분입니다.

- `body`
  - 어떤 요소를 고를지
  - 이걸 **선택자**라고 합니다
- `margin: 0;`
  - 속성:값
- `{ ... }`
  - 이 요소에 적용할 스타일 묶음

즉 읽는 법은:

"body라는 요소에 margin 0, color #111111을 적용한다"

## 3. 자주 보는 선택자

### 태그 선택자

```css
body { ... }
button { ... }
textarea { ... }
```

뜻:

- `body` 태그 전체
- `button` 태그 전체
- `textarea` 태그 전체

### 클래스 선택자

```css
.card { ... }
```

뜻:

- `class="card"`가 붙은 요소

### 여러 요소 같이

```css
textarea,
input,
select {
  font: inherit;
}
```

뜻:

- `textarea`, `input`, `select`에 같은 스타일 적용

## 4. 박스 모델이 제일 중요하다

CSS를 읽을 때 가장 중요한 개념 중 하나가 **박스 모델**입니다.

요소 하나를 상자로 생각하면 이렇게 됩니다.

1. 내용(content)
2. 안쪽 여백(padding)
3. 테두리(border)
4. 바깥 여백(margin)

즉:

- `padding` = 상자 안쪽 여백
- `margin` = 상자 바깥 여백

### 예

```css
.card {
  padding: 16px;
  border: 1px solid #ddd;
  margin: 24px;
}
```

읽는 법:

- 카드 내용과 테두리 사이에 16px
- 테두리는 1px
- 카드 바깥 여백은 24px

## 5. 자주 쓰는 CSS 속성

### 크기

```css
width: 100%;
height: 200px;
max-width: 1200px;
min-height: 100vh;
```

### 여백

```css
margin: 16px;
padding: 24px;
```

### 글자

```css
font-size: 16px;
font-weight: 600;
line-height: 1.6;
```

### 배경과 테두리

```css
background: white;
border: 1px solid #ddd;
border-radius: 24px;
```

### 그림자

```css
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
```

## 6. `display`는 레이아웃 핵심이다

이 속성을 이해하면 화면 정렬이 훨씬 쉬워집니다.

### `block`

한 줄을 넓게 차지합니다.

예:

- `div`
- `p`

### `inline`

글자처럼 흐릅니다.

예:

- `span`

### `flex`

가로/세로 정렬에 매우 자주 씁니다.

```css
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

뜻:

- `display: flex`
  - 자식들을 한 줄 정렬하기 쉬운 모드로 바꿈
- `justify-content`
  - 가로 방향 정렬
- `align-items`
  - 세로 방향 정렬

### `grid`

카드 여러 개를 칸처럼 배치할 때 좋습니다.

```css
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
```

뜻:

- 2열 그리드
- 카드 사이 간격 16px

## 7. `position`은 겹쳐 놓을 때 중요하다

### `relative`

자식 absolute 요소의 기준점이 됩니다.

### `absolute`

부모 기준으로 원하는 위치에 띄울 수 있습니다.

### `fixed`

화면에 고정됩니다.

### `sticky`

스크롤하면서 특정 위치에서 붙습니다.

예:

```css
.parent {
  position: relative;
}

.badge {
  position: absolute;
  top: 12px;
  right: 12px;
}
```

뜻:

- `badge`를 부모 우상단에 띄운다

## 8. 반응형은 뭐냐

화면 크기에 따라 레이아웃을 바꾸는 것입니다.

예:

```css
@media (min-width: 768px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
```

뜻:

- 화면이 768px 이상이면 2열로 바꾼다

## 9. Tailwind CSS는 뭐냐

Tailwind는 CSS를 직접 길게 쓰는 대신, 작은 클래스 조각을 조합해서 스타일을 만드는 방식입니다.

예:

```tsx
<div className="rounded-2xl border p-6 shadow-sm" />
```

이 한 줄은 사실 아래 느낌입니다.

- `rounded-2xl`
  - 모서리 둥글게
- `border`
  - 테두리
- `p-6`
  - 안쪽 여백
- `shadow-sm`
  - 그림자

즉 Tailwind는 CSS를 없앤 게 아니라, CSS를 짧은 조각 이름으로 쪼개 놓은 방식입니다.

## 10. 왜 CSS와 Tailwind를 같이 쓰는가

이 프로젝트에서는 둘 다 씁니다.

### 일반 CSS에 두는 것

- `body` 배경
- 전역 폰트
- 기본 focus 스타일
- 앱 전체 공통 규칙

예:

- [frontend/app/globals.css](../../frontend/app/globals.css)

### Tailwind에 두는 것

- 카드 레이아웃
- 버튼 크기
- 폼 배치
- 여백
- 반응형 구성

즉:

- 전역 규칙 = CSS
- 컴포넌트 스타일 조립 = Tailwind

이렇게 나눠 보면 됩니다.

## 11. Tailwind 자주 쓰는 클래스

### 여백

- `p-4` = 안쪽 여백
- `px-4` = 좌우 여백
- `py-3` = 상하 여백
- `mt-6` = 위쪽 바깥 여백
- `gap-4` = 자식 요소 사이 간격

### 글자

- `text-sm`
- `text-xl`
- `font-medium`
- `font-semibold`
- `leading-7`

### 레이아웃

- `flex`
- `grid`
- `items-center`
- `justify-between`
- `w-full`
- `max-w-7xl`
- `min-h-[640px]`

### 모양

- `rounded-2xl`
- `border`
- `bg-white`
- `shadow-sm`

## 12. Tailwind 한 줄 읽는 법

예:

```tsx
<div className="rounded-[32px] border border-black/10 bg-white p-8 shadow-sm" />
```

이걸 읽을 때는 이 순서가 좋습니다.

1. 모양
   - `rounded-[32px]`
   - `border`
   - `bg-white`
   - `shadow-sm`
2. 여백
   - `p-8`
3. 색
   - `border-black/10`

즉 Tailwind는 왼쪽부터 다 읽으려 하지 말고, 성격별로 끊어 읽어야 합니다.

## 13. 반응형 접두사

Tailwind는 접두사로 반응형을 표시합니다.

- `md:`
- `lg:`
- `xl:`

예:

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" />
```

뜻:

- 기본은 한 줄
- 중간 화면부터 2열
- 큰 화면부터 3열

## 14. 이 프로젝트에서 먼저 보면 좋은 스타일 파일

### [frontend/app/globals.css](../../frontend/app/globals.css)

이 파일은 전역 규칙입니다.

처음엔 여기서 이것만 보면 됩니다.

- 폰트 import
- `body` 배경
- 기본 글자색
- 폼 focus 스타일

### [frontend/app/page.tsx](../../frontend/app/page.tsx)

Tailwind 카드/배치 읽기 좋습니다.

### [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx)

실제 폼 레이아웃, gap, rounded, border, responsive 패턴이 많이 나옵니다.

## 15. CSS와 Tailwind를 읽을 때 추천 순서

스타일 코드를 보면 이 순서로 읽으세요.

1. 레이아웃
   - `flex`, `grid`, `w-full`, `max-w-*`
2. 여백
   - `p-*`, `m-*`, `gap-*`
3. 글자
   - `text-*`, `font-*`, `leading-*`
4. 모양
   - `rounded-*`, `border`, `shadow-*`
5. 색
   - `bg-*`, `text-*`, `border-*`

이 순서로 보면 훨씬 덜 복잡합니다.

## 16. 초보가 자주 막히는 지점

### `margin`과 `padding`이 헷갈림

- 안쪽 여백 = `padding`
- 바깥 여백 = `margin`

### 정렬이 안 맞음

먼저 이걸 확인하세요.

- `flex`인지
- `grid`인지
- `justify-*`가 있는지
- `items-*`가 있는지

### 화면이 좁아지면 깨짐

- `md:`, `lg:`가 있는지
- 고정 폭이 너무 큰지
- `w-full`이 필요한지

### 클래스가 너무 길어서 못 읽겠음

한 번에 읽지 말고 끊어서 보세요.

- 레이아웃
- 여백
- 글자
- 모양

## 17. 한 줄 요약

CSS는 "어떻게 보이게 할지"를 직접 쓰는 언어이고,  
Tailwind는 그 스타일을 작은 조각 이름으로 빠르게 조합하는 방식입니다.

즉 둘은 경쟁 관계가 아니라,

- 전역 규칙은 CSS
- 화면 조립은 Tailwind

로 같이 쓰는 도구입니다.
