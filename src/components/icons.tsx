
import Image from "next/image";
import type { ComponentProps } from "react";

export const Logo = (props: Omit<ComponentProps<typeof Image>, 'src' | 'alt' >) => (
    <Image
        src="/logo.png"
        alt="Centsei Logo"
        width={120}
        height={40}
        className="object-contain"
        {...props}
    />
);
