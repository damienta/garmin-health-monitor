import { animated, useSpring } from "@react-spring/web";

/** A number that springs up from 0 on first render (instant with reduced motion). */
export function CountUp({ value }: { value: number }) {
  const { n } = useSpring({ from: { n: 0 }, to: { n: value }, config: { tension: 120, friction: 22 } });
  return <animated.span>{n.to((x) => Math.round(x))}</animated.span>;
}
