// Tailo brand mark: a needle and thread forming a "T".

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="url(#tailo-logo-g)" />
      <rect x="7" y="8.4" width="18" height="3.4" rx="1.7" fill="#ffffff" />
      <path d="M14.4 11.8 H17.6 V21 L16 25.8 L14.4 21 Z" fill="#ffffff" />
      <circle cx="16" cy="14.6" r="1.25" fill="#3568B5" />
      <path
        d="M16.8 14.2 C 23 13.2, 25.2 19, 21 23.2"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.92"
      />
      <defs>
        <linearGradient
          id="tailo-logo-g"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#5C93E8" />
          <stop offset="1" stopColor="#2C57A6" />
        </linearGradient>
      </defs>
    </svg>
  );
}
