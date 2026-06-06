interface LogoProps {
  variant?: "icon" | "full";
  size?: number;
  className?: string;
}

const ICON_ASPECT = 320 / 360;
const FULL_ASPECT = 400 / 460;

export function Logo({ variant = "icon", size = 32, className = "" }: LogoProps) {
  const src = variant === "full" ? "/debate-ai-logo.svg" : "/debate-ai-icon.svg";
  const aspect = variant === "full" ? FULL_ASPECT : ICON_ASPECT;
  const height = Math.round(size / aspect);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="DebateAI"
      width={size}
      height={height}
      className={className}
      decoding="async"
    />
  );
}

interface LogoWithLabelProps {
  size?: number;
  className?: string;
  labelClassName?: string;
  showLabel?: boolean;
}

export function LogoWithLabel({
  size = 32,
  className = "",
  labelClassName = "text-[15px] font-semibold tracking-tight",
  showLabel = true,
}: LogoWithLabelProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo size={size} className="shrink-0" />
      {showLabel ? <span className={labelClassName}>DebateAI</span> : null}
    </div>
  );
}
