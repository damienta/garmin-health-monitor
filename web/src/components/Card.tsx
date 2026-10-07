import { animated, useSpring } from "@react-spring/web";
import type { ReactNode } from "react";

/**
 * A card that floats up into place on first render. A spring instead of a fixed-length
 * CSS transition, so the motion settles naturally. `delay` staggers cards on a page.
 */
export function Card({
  title,
  aside,
  delay = 0,
  className = "",
  children,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const style = useSpring({
    from: { opacity: 0, y: 12 },
    to: { opacity: 1, y: 0 },
    delay,
    config: { tension: 220, friction: 26 },
  });
  return (
    <animated.section className={`card ${className}`} style={style}>
      {(title || aside) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </animated.section>
  );
}
