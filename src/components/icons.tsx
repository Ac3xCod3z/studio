import Image from "next/image";
import type { SVGProps } from "react";

export const Logo = (props: Omit<SVGProps<SVGSVGElement>, 'src'> & { src?: string, width?: number, height?: number, alt?: string }) => (
    <Image
        src="/logo.png"
        width={120}
        height={40}
        alt="Centsei Logo"
        className="object-contain"
        {...props}
    />
);
