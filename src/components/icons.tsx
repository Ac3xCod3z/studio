import type { SVGProps } from "react";

export const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
    <path d="M12 18a6 6 0 0 0 6-6h-6V6a6 6 0 0 0-6 6h6v6z" />
    <path d="M12 6V3" />
    <path d="M12 3l2 2" />
    <path d="M12 3l-2 2" />
  </svg>
);
