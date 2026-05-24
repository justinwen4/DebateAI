import Image from "next/image";

interface LogoProps {
  variant?: "icon" | "full";
  size?: number;
  className?: string;
}

export function Logo({ variant = "icon", size = 32, className = "" }: LogoProps) {
  const src = variant === "full" ? "/debate-ai-logo.png" : "/debate-ai-icon.png";
  const aspect = variant === "full" ? 1 : 580 / 1024;
  const height = Math.round(size * aspect);

  return (
    <Image
      src={src}
      alt="DebateAI"
      width={size}
      height={height}
      className={className}
      priority={size >= 32}
    />
  );
}

interface LogoWithLabelProps {
  size?: number;
  className?: string;
  labelClassName?: string;
}

export function LogoWithLabel({
  size = 32,
  className = "",
  labelClassName = "text-[15px] font-semibold tracking-tight",
}: LogoWithLabelProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo size={size} className="shrink-0 rounded-lg" />
      <span className={labelClassName}>DebateAI</span>
    </div>
  );
}
