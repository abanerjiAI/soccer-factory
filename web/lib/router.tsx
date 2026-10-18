import { useEffect, useState } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

/** Hash router (#/lab). Hash routes need no server rewrite rules, so the built site works from any folder. */
const read = () => (window.location.hash.replace(/^#/, "") || "/").split("?")[0] || "/";

export function usePath(): string {
  const [p, setP] = useState(read);
  useEffect(() => {
    const h = () => {
      setP(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return p;
}

export function Link({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={`#${href}`} {...rest}>
      {children}
    </a>
  );
}

export const go = (path: string) => {
  window.location.hash = path;
};
