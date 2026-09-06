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
 * Laden mit Markise, fuer „Partner" (die Konditoreien) im MyCakeDay-Bereich.
 * Von Hand nach lucides `store`. Bewegung: die Markise rollt aus.
 */

type StoreProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    markise: {
      initial: { pathLength: 1, opacity: 1 },
      animate: {
        pathLength: [0, 1],
        opacity: [0.4, 1],
        transition: { ease: 'easeOut', duration: 0.45 },
      },
    },
    tuer: {
      initial: { y: 0 },
      animate: { y: [2, 0], opacity: [0, 1], transition: { ease: 'easeOut', duration: 0.3, delay: 0.2 } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: StoreProps) {
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
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <motion.path
        d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"
        variants={variants.tuer}
        initial="initial"
        animate={controls}
      />
      <path d="M2 7h20" />
      <motion.path
        d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"
        variants={variants.markise}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Store(props: StoreProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, Store, Store as StoreIcon, type StoreProps, type StoreProps as StoreIconProps };
