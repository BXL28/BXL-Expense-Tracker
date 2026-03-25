import Image from "next/image";

type Props = {
  className?: string;
  /** Tail height class; width scales with aspect ratio */
  heightClass?: string;
};

export function BrandMark({ className = "", heightClass = "h-10" }: Props) {
  return (
    <Image
      src="/brand-logo.png"
      alt="BXL"
      width={160}
      height={160}
      className={`${heightClass} w-auto object-contain ${className}`.trim()}
      priority
    />
  );
}
