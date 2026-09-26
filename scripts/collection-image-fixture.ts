// Standalone Bun fixtures need the same image config Next injects in the app.
import { Image } from 'next/dist/client/image-component';
import { imageConfigDefault } from 'next/dist/shared/lib/image-config';
import { ImageConfigContext } from 'next/dist/shared/lib/image-config-context.shared-runtime';
import type { ImageProps } from 'next/image';
import { createElement } from 'react';

import nextConfig from '../next.config';

export default function FixtureImage(props: ImageProps) {
    return createElement(
        ImageConfigContext.Provider,
        { value: { ...imageConfigDefault, ...nextConfig.images } },
        createElement(Image, props),
    );
}
