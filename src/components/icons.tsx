
import type { SVGProps } from "react";

export const Logo = (props: SVGProps<SVGSVGElement>) => (
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500" {...props}>
        <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feOffset result="offOut" in="SourceAlpha" dx="5" dy="5" />
                <feGaussianBlur result="blurOut" in="offOut" stdDeviation="5" />
                <feBlend in="SourceGraphic" in2="blurOut" mode="normal" />
            </filter>
        </defs>
        <g filter="url(#shadow)">
            <circle cx="250" cy="250" r="240" fill="#F0EFEB" stroke="black" strokeWidth="2" />
            <path d="M100,400 L100,150 C100,120 120,100 150,100 L350,100 C380,100 400,120 400,150 L400,400" stroke="black" strokeWidth="20" fill="none"/>
            <path d="M50,150 L450,150 C480,150 500,170 500,200 L0,200 C0,170 20,150 50,150" transform="translate(0, -50)" stroke="black" strokeWidth="20" fill="#D12920"/>
            <path d="M75,400 L425,400" stroke="black" strokeWidth="20" fill="none"/>
            <text x="250" y="460" fontFamily="Arial, sans-serif" fontSize="60" fontWeight="bold" fill="white" stroke="black" strokeWidth="2" textAnchor="middle" dominantBaseline="middle">CENTSEI</text>
        </g>
    </svg>
)
