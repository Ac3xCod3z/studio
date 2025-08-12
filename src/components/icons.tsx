import Image from "next/image";
import type { ComponentProps } from "react";

export const Logo = (props: Omit<ComponentProps<typeof Image>, 'src' | 'alt' | 'width' | 'height'> & { src?: string }) => (
    <Image
        src="/logo.png"
        width={120}
        height={40}
        alt="Centsei Logo"
        className="object-contain"
        {...props}
    />
);
