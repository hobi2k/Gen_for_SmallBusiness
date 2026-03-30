# CSS + Tailwind CSS 실무 빠른 기초

## 1. CSS와 Tailwind를 같이 보는 이유
- `CSS`는 스타일을 직접 작성하는 기본 방식이다.
- `Tailwind CSS`는 작은 유틸리티 클래스로 스타일을 빠르게 조합하는 방식이다.

이 프로젝트에서는 둘 다 사용한다.
- 전역 스타일: 일반 CSS 파일
- 컴포넌트 스타일과 레이아웃: Tailwind 클래스

즉 실무에서는 둘 중 하나만 알면 안 되고, 역할 분리를 같이 봐야 한다.

## 2. CSS 기본 구조
```css
body {
  margin: 0;
  color: #111111;
}
```

구성:
- `body`: 선택자
- `margin: 0;`: 속성과 값

CSS는 “어떤 요소를 어떻게 보이게 할지” 적는 언어다.

## 3. 자주 쓰는 CSS 속성
### 크기
```css
width: 100%;
height: 200px;
max-width: 1200px;
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

## 4. 박스 모델
CSS 읽을 때 제일 중요한 개념 중 하나다.

순서:
- 내용 영역
- padding
- border
- margin

```css
.card {
  padding: 16px;
  border: 1px solid #ddd;
  margin: 24px;
}
```

헷갈릴 때 기준:
- 안쪽 여백: `padding`
- 바깥 여백: `margin`

## 5. display 핵심
### block
한 줄 전체를 차지한다.

### inline
글자처럼 흐른다.

### flex
가로/세로 정렬에 매우 자주 쓴다.

```css
.container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

### grid
2열, 3열 카드 배치에 자주 쓴다.

```css
.container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
```

## 6. position 아주 기초
```css
position: relative;
position: absolute;
position: fixed;
position: sticky;
```

실무에서 자주 쓰는 조합:
- 부모 `relative`
- 자식 `absolute`

이건 배지, 버튼 오버레이, 우측 상단 고정 요소 등에 많이 쓴다.

## 7. 반응형 기본
```css
@media (min-width: 768px) {
  .container {
    grid-template-columns: 1fr 1fr;
  }
}
```

의미:
- 화면이 넓어지면 2열로 바꾸겠다

## 8. Tailwind CSS란
Tailwind는 CSS 속성을 직접 쓰는 대신 작은 클래스 조각을 HTML/TSX 안에 조합하는 방식이다.

예:
```tsx
<div className="rounded-2xl border p-6 shadow-sm" />
```

이 한 줄 안에 CSS 여러 개가 들어 있다.

## 9. Tailwind 자주 쓰는 클래스
### 여백
- `p-4`: padding
- `px-4`: 좌우 padding
- `py-3`: 상하 padding
- `mt-6`: 위 margin
- `gap-4`: 요소 사이 간격

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
- `min-h-screen`
- `max-w-7xl`

### 모양
- `rounded-2xl`
- `border`
- `shadow-sm`
- `bg-white`

## 10. Tailwind 읽는 법
```tsx
<div className="rounded-[32px] border border-black/10 bg-white p-8 shadow-sm" />
```

이걸 읽을 때는 이렇게 끊으면 쉽다.
- `rounded-[32px]`: 모서리 둥글게
- `border border-black/10`: 연한 테두리
- `bg-white`: 흰 배경
- `p-8`: 안쪽 여백
- `shadow-sm`: 약한 그림자

## 11. 반응형 접두사
- `md:` 중간 화면 이상
- `lg:` 큰 화면 이상
- `xl:` 더 큰 화면 이상

예:
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" />
```

뜻:
- 기본은 한 줄
- 중간 화면에서는 2열
- 큰 화면에서는 3열

## 12. 실무에서 자주 보는 Tailwind 패턴
### 카드
```tsx
<div className="rounded-2xl border bg-white p-6 shadow-sm" />
```

### 버튼
```tsx
<button className="rounded-xl bg-black px-4 py-3 text-white" />
```

### 입력창
```tsx
<input className="w-full rounded-2xl border px-4 py-3" />
```

### 중앙 정렬
```tsx
<div className="flex items-center justify-center" />
```

## 13. 전역 CSS와 Tailwind 역할 나누기
이 프로젝트 기준으로 보면 이렇게 나누면 읽기 쉽다.

### 전역 CSS에 두는 것
- `body` 기본 배경
- 글자 기본 색
- reset 성격 스타일
- 전체 공통 규칙

### Tailwind로 두는 것
- 카드 여백
- 버튼 크기
- 폼 간격
- 레이아웃 정렬
- 반응형 분기

## 14. CSS / Tailwind 디버깅 포인트
### 여백이 이상함
- `padding`인지 `margin`인지 먼저 보기
- Tailwind에서는 `p-`, `m-`, `gap-` 구분하기

### 정렬이 이상함
- `flex`인지 `grid`인지 먼저 보기
- `justify-*`, `items-*`가 맞는지 보기

### 화면이 좁아지면 깨짐
- `md:`, `lg:` 같은 반응형 클래스 확인
- `max-w-*`, `w-full` 조합 확인

### 스타일이 안 먹음
- 클래스 이름 오타 확인
- 전역 CSS가 덮어쓰는지 확인
- Tailwind content 경로 설정 확인

## 15. 이 프로젝트에서 빨리 읽어야 할 것
- `globals.css`의 전역 배경과 기본 규칙
- `page.tsx`의 카드/레이아웃 클래스
- `project-form.tsx`의 입력창, 버튼, 간격 클래스
- `grid`, `flex`, `gap`, `rounded`, `border`, `shadow` 조합

## 16. 처음 읽을 때 추천 순서
1. 일반 CSS의 `body`, 전역 규칙 읽기
2. Tailwind에서 `layout -> spacing -> typography -> decoration` 순으로 보기
3. 반응형 접두사 확인
4. 카드/버튼/폼 패턴 반복 확인

## 17. 한 줄 요약
실무에서 CSS를 빨리 읽으려면 “레이아웃, 여백, 글자, 모양” 순서로 보면 된다. Tailwind도 결국 같은 내용이 더 잘게 쪼개져 있을 뿐이다.
