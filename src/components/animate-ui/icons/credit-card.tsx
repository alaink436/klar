'use client';

// Nicht aus der Registry, siehe banknote.tsx. Pfade von lucide `credit-card`.
// Die Animation zeigt, was Auszahlen heisst: der Magnetstreifen wandert einmal
// durch die Karte.

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type CreditCardProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    rect: {
      initial: {
        scale: 1,
        transition: { ease: 'easeInOut', duration: 0.5 },
      },
      animate: {
        scale: [1, 1.06, 1],
        transition: { ease: 'easeInOut', duration: 0.5 },
      },
    },
    stripe: {
      initial: {
        x: 0,
        opacity: 1,
        transition: { ease: 'easeInOut', duration: 0.5 },
      },
      animate: {
        x: [0, 3, -3, 0],
        opacity: [1, 0.4, 0.4, 1],
        transition: { ease: 'easeInOut', duration: 0.5 },
      },
    },
  } satisfies Record<string, Variants>,
  'default-loop': {
    rect: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.06, 1],
        transition: { ease: 'easeInOut', duration: 1 },
      },
    },
    stripe: {
      initial: { x: 0, opacity: 1 },
      animate: {
        x: [0, 3, -3, 0],
        opacity: [1, 0.4, 0.4, 1],
        transition: { ease: 'easeInOut', duration: 1 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CreditCardProps) {
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
        height={14}
        x={2}
        y={5}
        rx={2}
        style={{ transformOrigin: '12px 12px' }}
        variants={variants.rect}
        initial="initial"
        animate={controls}
      />
      <motion.line
        x1={2}
        y1={10}
        x2={22}
        y2={10}
        variants={variants.stripe}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function CreditCard(props: CreditCardProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  CreditCard,
  CreditCard as CreditCardIcon,
  type CreditCardProps,
  type CreditCardProps as CreditCardIconProps,
};
