'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

/**
 * Torte mit drei Kerzen, fuer den Menuepunkt MyCakeDay.
 *
 * Von Hand geschrieben wie `inbox.tsx`, aus demselben Grund: der Generator
 * ueberschreibt `icon.tsx` samt Patch. Die Pfade sind die von lucides `cake`.
 *
 * Bewegung: die drei Flammen flackern, der Zuckerguss zieht sich nach.
 */

type CakeProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    flame: {
      initial: { opacity: 1, scale: 1 },
      animate: {
        opacity: [1, 0.35, 1, 0.6, 1],
        scale: [1, 1.4, 0.9, 1.3, 1],
        transition: { ease: 'easeInOut', duration: 0.7 },
      },
    },
    glaze: {
      initial: { pathLength: 1 },
      animate: {
        pathLength: [0, 1],
        transition: { ease: 'easeInOut', duration: 0.5 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CakeProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
      <motion.path
        d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"
        variants={variants.glaze}
        initial="initial"
        animate={controls}
      />
      <path d="M2 21h20" />
      <path d="M7 8v3" />
      <path d="M12 8v3" />
      <path d="M17 8v3" />
      <motion.path d="M7 4h.01" variants={variants.flame} initial="initial" animate={controls} />
      <motion.path d="M12 4h.01" variants={variants.flame} initial="initial" animate={controls} />
      <motion.path d="M17 4h.01" variants={variants.flame} initial="initial" animate={controls} />
    </motion.svg>
  );
}

function Cake(props: CakeProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, Cake, Cake as CakeIcon, type CakeProps, type CakeProps as CakeIconProps };
