
import type { SVGProps } from "react";

export const Logo = (props: SVGProps<SVGSVGElement>) => (
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500" {...props}>
        <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                <feOffset dx="2" dy="2" result="offsetblur"/>
                <feComponentTransfer>
                    <feFuncA type="linear" slope="0.5"/>
                </feComponentTransfer>
                <feMerge>
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <g filter="url(#shadow)">
            <circle cx="250" cy="250" r="200" fill="#F7F4EF"/>
            <g transform="translate(100, 150) scale(1.5)">
                <path d="M20,150 V50 h20 v100 z" fill="#D12920" />
                <path d="M160,150 V50 h20 v100 z" fill="#D12920" />
                <path d="M0,50 Q100,20 200,50 L180,50 Q100,40 20,50 z" fill="#D12920" />
                 <rect x="20" y="140" width="160" height="15" fill="#D12920" />
            </g>
        </g>
    </svg>
)
