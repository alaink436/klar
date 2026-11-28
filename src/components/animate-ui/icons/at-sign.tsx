'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type AtSignProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: {
        rotate: 0,
      },
      animate: {
        rotate: [0, -20, 10, 0],
        transition: {
          ease: 'easeInOut',
          duration: 0.8,
        },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: AtSignProps) {
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
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
      </motion.g>
    </motion.svg>
  );
}

function AtSign(props: AtSignProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  AtSign,
  AtSign as AtSignIcon,
  type AtSignProps,
  type AtSignProps as AtSignIconProps,
};
