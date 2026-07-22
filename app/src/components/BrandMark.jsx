export default function BrandMark({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="80 80 340 350" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="brandGold" x1="130" y1="120" x2="382" y2="392" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f7e7b0" />
          <stop offset="0.45" stopColor="#d4af37" />
          <stop offset="1" stopColor="#9c7a1f" />
        </linearGradient>
        <linearGradient id="brandGoldLight" x1="130" y1="120" x2="382" y2="260" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fdf6df" />
          <stop offset="1" stopColor="#e8c874" />
        </linearGradient>
        <linearGradient id="brandGoldDark" x1="160" y1="260" x2="352" y2="392" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c19a2e" />
          <stop offset="1" stopColor="#7a5f18" />
        </linearGradient>
      </defs>
      <path d="M256 96 L344 172 L308 172 L256 172 L204 172 L172 172 Z" fill="url(#brandGoldLight)" />
      <path d="M172 172 L204 172 L152 262 L110 208 Z" fill="url(#brandGold)" />
      <path d="M344 172 L172 172 L152 262 L256 172 Z" fill="url(#brandGoldLight)" fillOpacity={0.55} />
      <path d="M344 172 L402 208 L360 262 L308 172 Z" fill="url(#brandGold)" />
      <path d="M256 172 L308 172 L360 262 L152 262 Z" fill="url(#brandGold)" />
      <path d="M110 208 L152 262 L232 262 L204 172 Z" fill="url(#brandGoldDark)" fillOpacity={0.5} />
      <path d="M402 208 L360 262 L280 262 L308 172 Z" fill="url(#brandGoldDark)" fillOpacity={0.5} />
      <path d="M152 262 L232 262 L256 172 Z" fill="url(#brandGold)" fillOpacity={0.85} />
      <path d="M360 262 L280 262 L256 172 Z" fill="url(#brandGold)" fillOpacity={0.85} />
      <path d="M152 262 L360 262 L256 416 Z" fill="url(#brandGoldDark)" />
      <path d="M152 262 L256 262 L256 416 Z" fill="url(#brandGold)" />
      <path d="M256 262 L360 262 L256 416 Z" fill="url(#brandGoldLight)" fillOpacity={0.35} />
    </svg>
  );
}
