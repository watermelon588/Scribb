// page-flip 2.0.7 ships without TypeScript declarations. This describes the
// small, documented public API used by the sketchbook, rather than masking it as any.
declare module 'page-flip' {
  interface FlipSettings {
    width: number; height: number; size: 'fixed' | 'stretch';
    showCover: boolean; usePortrait: boolean; startPage: number;
    flippingTime: number; drawShadow: boolean; maxShadowOpacity: number;
    showPageCorners: boolean; mobileScrollSupport: boolean;
    clickEventForward: boolean; swipeDistance: number;
    disableFlipByClick: boolean; useMouseEvents: boolean;
  }
  export class PageFlip {
    constructor(element: HTMLElement, settings: FlipSettings)
    loadFromHTML(pages: HTMLElement[]): void
    destroy(): void
    flipNext(corner?: 'top' | 'bottom'): void
    flipPrev(corner?: 'top' | 'bottom'): void
    flip(page: number, corner?: 'top' | 'bottom'): void
    turnToNextPage(): void
    turnToPrevPage(): void
    turnToPage(page: number): void
    startUserTouch(point: { x: number; y: number }): void
    userMove(point: { x: number; y: number }, isTouch: boolean): void
    userStop(point: { x: number; y: number }, cancel?: boolean): void
    on(event: 'flip', callback: (event: { data: number }) => void): void
    on(event: 'changeState', callback: (event: { data: 'read' | 'user_fold' | 'fold_corner' | 'flipping' }) => void): void
  }
}
