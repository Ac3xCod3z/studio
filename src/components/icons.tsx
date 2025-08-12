
import type { SVGProps } from "react";

export const Logo = (props: SVGProps<SVGSVGElement>) => (
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500" {...props}>
        <circle cx="250" cy="250" r="200" fill="#F7F4EF"/>
        <path d="M100,380 V150 h50 v170 h150 v-170 h50 v230 h-250
                 M125,150 h250 a20,20 0 0,0 -250,0
                 M100,150 a150,20 0 0,1 300,0"
              fill="#D12920"
              stroke="#D12920"
              strokeWidth="5"
        />
    </svg>
)
