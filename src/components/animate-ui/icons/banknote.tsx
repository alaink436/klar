'use client';

// Nicht aus der Registry: animate-ui fuehrt (Stand 2026-08-25) kein Geld-Icon.
// Pfade sind die von lucide `banknote`, die Animation folgt dem Hausmuster:
// die Note kippt leicht, der Betrag in der Mitte pulst einmal.

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type BanknoteProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    rect: {
      initial: {
        rotate: 0,
        transition: { ease: 'easeInOut', duration: 0.5 },
      },
      animate: {
        rotate: [0, -4, 0],
        transition: { ease: 'easeInOut', duration: 0.5 },
      },
    },
    circle: {
      initial: {
        scale: 1,
        transition: { ease: 'easeInOut', duration: 0.5 },
      },
      animate: {
        scale: [1, 1.25, 1],
        transition: { ease: 'easeInOut', duration: 0.5 },
      },
    },
    line1: {
      initial: { opacity: 1, transition: { duration: 0.4 } },
      animate: { opacity: [1, 0.3, 1], transition: { duration: 0.4 } },
    },
    line2: {
      initial: { opacity: 1, transition: { duration: 0.4 } },
      animate: {
        opacity: [1, 0.3, 1],
        transition: { duration: 0.4, delay: 0.08 },
      },
    },
  } satisfies Record<string, Variants>,
  'default-loop': {
    rect: {
      initial: { rotate: 0 },
      animate: {
        rotate: [0, -4, 0],
        transition: { ease: 'easeInOut', duration: 1 },
      },
    },
    circle: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.25, 1],
        transition: { ease: 'easeInOut', duration: 1 },
      },
    },
    line1: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.3, 1], transition: { duration: 1 } },
    },
    line2: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.3, 1], transition: { duration: 1 } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: BanknoteProps) {
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
      <motion.rect
        width={20}
        height={12}
        x={2}
        y={6}
        rx={2}
        style={{ transformOrigin: '12px 12px' }}
        variants={variants.rect}
        initial="initial"
        animate={controls}
      />
      <motion.circle
        cx={12}
        cy={12}
        r={2}
        style={{ transformOrigin: '12px 12px' }}
        variants={variants.circle}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M6 12h.01"
        variants={variants.line1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M18 12h.01"
        variants={variants.line2}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Banknote(props: BanknoteProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Banknote,
  Banknote as BanknoteIcon,
  type BanknoteProps,
  type BanknoteProps as BanknoteIconProps,
};
