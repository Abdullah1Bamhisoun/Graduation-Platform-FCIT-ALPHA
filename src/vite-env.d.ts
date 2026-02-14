/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module 'react-resizable-panels' {
  import { ComponentType, HTMLAttributes } from 'react';
  export const Panel: ComponentType<HTMLAttributes<HTMLDivElement> & { defaultSize?: number; minSize?: number; maxSize?: number }>;
  export const PanelGroup: ComponentType<HTMLAttributes<HTMLDivElement> & { direction: 'horizontal' | 'vertical' }>;
  export const PanelResizeHandle: ComponentType<HTMLAttributes<HTMLDivElement>>;
}
