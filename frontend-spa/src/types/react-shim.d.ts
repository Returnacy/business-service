// Temporary minimal React type shims to avoid TS complaints in environments without @types/react
declare module 'react';
declare module 'react/jsx-runtime';

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
