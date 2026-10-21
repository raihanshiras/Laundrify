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
      src={isMark ? "/laundrify-mark.svg" : "/laundrify-logo.svg"}
      alt="Laundrify"
      width={isMark ? 112 : 540}
      height={isMark ? 112 : 128}
      priority={priority}
      className={className}
      draggable={false}
    />
  );
}
