'use client';

import Image from 'next/image';
import { useState } from 'react';

type Props = {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
    preload?: boolean;
    loading?: 'eager' | 'lazy';
};

export function ItemImage(props: Props) {
    return <ImageFrame key={props.src} {...props} />;
}

function ImageFrame({
    src,
    alt,
    width,
    height,
    className = '',
    preload,
    loading,
}: Props) {
    const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
        'loading',
    );
    return (
        <span
            className={`relative block shrink-0 overflow-hidden ${className}`}
            style={{ aspectRatio: `${width} / ${height}` }}
        >
            {status === 'loading' && (
                <span
                    data-skeleton="image"
                    aria-hidden="true"
                    className="absolute inset-1 rounded-lg bg-slate-500/15 motion-safe:animate-pulse"
                />
            )}
            {status === 'error' ? (
                <span
                    role="img"
                    aria-label={alt || 'Изображение предмета недоступно'}
                    className="absolute inset-0 flex items-center justify-center px-2 text-center text-[10px] text-slate-400"
                >
                    Нет изображения
                </span>
            ) : (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    sizes="192px"
                    preload={preload}
                    loading={loading}
                    className="object-contain"
                    onLoad={() => setStatus('loaded')}
                    onError={() => setStatus('error')}
                />
            )}
        </span>
    );
}
