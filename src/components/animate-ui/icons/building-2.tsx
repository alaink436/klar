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
 * Buerohaus mit zwei Anbauten, fuer „Firmen" im MyCakeDay-Bereich.
 * Von Hand nach lucides `building-2`, wie die uebrigen Icons hier.
 * Bewegung: die Fenster leuchten von oben nach unten auf.
 */

type Building2Props = IconProps<keyof typeof animations>;

const animations = {
  default: {
    fenster1: { initial: { opacity: 1 }, animate: { opacity: [0.2, 1], transition: { duration: 0.25, delay: 0 } } },
    fenster2: { initial: { opacity: 1 }, animate: { opacity: [0.2, 1], transition: { duration: 0.25, delay: 0.08 } } },
    fenster3: { initial: { opacity: 1 }, animate: { opacity: [0.2, 1], transition: { duration: 0.25, delay: 0.16 } } },
    fenster4: { initial: { opacity: 1 }, animate: { opacity: [0.2, 1], transition: { duration: 0.25, delay: 0.24 } } },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: Building2Props) {
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
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <motion.path d="M10 6h4" variants={variants.fenster1} initial="initial" animate={controls} />
      <motion.path d="M10 10h4" variants={variants.fenster2} initial="initial" animate={controls} />
      <motion.path d="M10 14h4" variants={variants.fenster3} initial="initial" animate={controls} />
      <motion.path d="M10 18h4" variants={variants.fenster4} initial="initial" animate={controls} />
    </motion.svg>
  );
}

function Building2(props: Building2Props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Building2,
  Building2 as Building2Icon,
  type Building2Props,
  type Building2Props as Building2IconProps,
};
