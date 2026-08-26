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
 * Kalender, im Zuschnitt der uebrigen Icons dieses Ordners.
 *
 * Von Hand geschrieben statt per CLI nachgezogen: Ein Lauf des Generators
 * ueberschreibt `icon.tsx`, und dort steckt der Patch, ohne den `render` als
 * "[object Object]" im DOM landet und ueberhaupt kein Icon erscheint.
 *
 * Bewegung: die sechs Tagespunkte tauchen nacheinander auf, wie eine Liste,
 * die sich fuellt. Das Blatt selbst bleibt stehen — ein Kalender, der wackelt,
 * sieht nach Termin-Chaos aus.
 */

type CalendarDaysProps = IconProps<keyof typeof animations>;

const punkt = (verzug: number): Variants => ({
  initial: { opacity: 1, scale: 1 },
  animate: {
    opacity: [0, 1],
    scale: [0.4, 1],
    transition: { ease: 'easeOut', duration: 0.28, delay: verzug },
  },
});

const animations = {
  default: {
    rahmen: {
      initial: { opacity: 1 },
      animate: {
        pathLength: [0.6, 1],
        transition: { ease: 'easeInOut', duration: 0.4 },
      },
    },
    p1: punkt(0.04),
    p2: punkt(0.09),
    p3: punkt(0.14),
    p4: punkt(0.19),
    p5: punkt(0.24),
    p6: punkt(0.29),
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CalendarDaysProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);
  const punkte: Array<[number, number, keyof typeof variants]> = [
    [8, 14, 'p1'],
    [12, 14, 'p2'],
    [16, 14, 'p3'],
    [8, 18, 'p4'],
    [12, 18, 'p5'],
    [16, 18, 'p6'],
  ];

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
      <motion.path
        d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        variants={variants.rahmen}
        initial="initial"
        animate={controls}
      />
      {punkte.map(([x, y, key]) => (
        <motion.path
          key={key}
          d={`M${x} ${y}h.01`}
          variants={variants[key]}
          initial="initial"
          animate={controls}
        />
      ))}
    </motion.svg>
  );
}

function CalendarDays(props: CalendarDaysProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  CalendarDays,
  CalendarDays as CalendarDaysIcon,
  type CalendarDaysProps,
  type CalendarDaysProps as CalendarDaysIconProps,
};
