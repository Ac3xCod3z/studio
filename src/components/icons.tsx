
import type { SVGProps } from "react";

export const Logo = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 160 120"
        width="160"
        height="120"
        {...props}
    >
        <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feOffset result="offOut" in="SourceAlpha" dx="1" dy="1" />
                <feGaussianBlur result="blurOut" in="offOut" stdDeviation="1" />
                <feBlend in="SourceGraphic" in2="blurOut" mode="normal" />
            </filter>
        </defs>
        <g filter="url(#shadow)">
            <circle cx="80" cy="50" r="40" fill="#F0EFEF" />
            <path
                d="M40 90 V50 H50 V40 H110 V50 H120 V90 H110 V50 H95 V40 H65 V50 H50 V90 H40 Z"
                fill="#C0392B"
            />
            <path
                d="M30 40 C30 30, 130 30, 130 40 H120 C120 35, 40 35, 40 40 H30 Z"
                fill="#C0392B"
            />
            <text
                x="80"
                y="110"
                fontFamily="sans-serif"
                fontWeight="bold"
                fontSize="20"
                fill="#FFFFFF"
                stroke="#000000"
                strokeWidth="0.5"
                textAnchor="middle"
                alignmentBaseline="middle"
            >
                CENTSEI
            </text>
        </g>
    </svg>
);
