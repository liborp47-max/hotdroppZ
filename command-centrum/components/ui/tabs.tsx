'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-9 items-center justify-center bg-white/[0.02] backdrop-blur-md border-b border-white/[0.08] p-0 text-[#6E6E6E]',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-all duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30',
      'bg-transparent text-[#A8A8A8] border-b border-transparent',
      'hover:text-[#E8E8E8] hover:bg-white/[0.04]',
      'data-[state=active]:bg-[rgba(0,224,133,0.06)]',
      'data-[state=active]:text-[#00E085]',
      'data-[state=active]:border-b-2 data-[state=active]:border-b-[#00E085]',
      'data-[state=active]:shadow-[inset_0_1px_0_rgba(0,224,133,0.10),0_0_10px_rgba(0,224,133,0.16)]',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-black focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00E085] focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
