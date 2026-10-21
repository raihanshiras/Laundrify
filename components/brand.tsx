import Image from "next/image";

type BrandLogoProps = {
  variant?: "full" | "mark";
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ variant = "full", className = "", priority = false }: BrandLogoProps) {
  const isMark = variant === "mark";
  return (
    <Image
      src={isMark ? "/laundrify-mark.webp" : "/laundrify-logo.webp"}
      alt="Laundrify"
      width={isMark ? 240 : 540}
      height={isMark ? 137 : 99}
      priority={priority}
      className={className}
      draggable={false}
    />
  );
}
