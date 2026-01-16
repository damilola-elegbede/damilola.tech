'use client';

import { useState } from 'react';
import {
  Hero,
  About,
  Experience,
  Skills,
  Education,
  Contact,
} from '@/components/sections';
import { ChatFab, ChatPanel } from '@/components/chat';
import { ThemeToggle } from '@/components/theme';

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => setIsChatOpen(!isChatOpen);
  const closeChat = () => setIsChatOpen(false);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-white focus:outline-none"
      >
        Skip to main content
      </a>
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <main id="main-content">
        <Hero onOpenChat={toggleChat} />
        <About />
        <Experience />
        <Skills />
        <Education />
        <Contact />
      </main>

      <ChatFab onClick={toggleChat} isOpen={isChatOpen} />
      <ChatPanel isOpen={isChatOpen} onClose={closeChat} />
    </>
  );
}
