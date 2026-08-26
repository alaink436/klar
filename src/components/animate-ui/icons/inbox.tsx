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
 * Posteingang, im Zuschnitt der uebrigen Icons dieses Ordners.
 *
 * Von Hand geschrieben statt per CLI nachgezogen: Ein Lauf des Generators
 * ueberschreibt `icon.tsx`, und dort steckt der Patch, ohne den `render` als
 * "[object Object]" im DOM landet und ueberhaupt kein Icon erscheint. Siehe
 * die Fallenliste in der Uebergabe.
 *
 * Bewegung: die Klappe faellt in die Wanne. Ein Posteingang, in dem etwas
 * ankommt, ist genau das, was die Seite dahinter zeigt.
 */

type InboxProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0 },
      animate: {
        y: [-3, 0],
        opacity: [0, 1],
        transition: { ease: 'easeOut', duration: 0.35 },
      },
    },
    path2: {
      initial: { opacity: 1 },
      animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        transition: { ease: 'easeInOut', duration: 0.45 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: InboxProps) {
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
      <motion.polyline
        points="22 12 16 12 14 15 10 15 8 12 2 12"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Inbox(props: InboxProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Inbox,
  Inbox as InboxIcon,
  type InboxProps,
  type InboxProps as InboxIconProps,
};
