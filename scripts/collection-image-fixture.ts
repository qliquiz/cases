// Use the real Next Image implementation in Bun's standalone browser bundle.
// next/image's CommonJS default interop is normally handled by the Next bundler.
export { Image as default } from 'next/dist/client/image-component';
